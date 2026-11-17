// Sign-ups CSV export: encoding and the export flow, run against the BUILT
// widget-elements module (dist/index.js) the host loads, with a real
// @json-render/core state store and a synthetic `ctx.tools` session (the
// host's isolated tool calls; the host side is tested in myHubV2's
// widgets-system/plugin-tools.test.ts). Spec wiring is covered with the real
// React renderer in myconnect-signup-csv-export.runtime.test.ts.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createStateStore, type StateStore } from '@json-render/core';
import elements, { csvCell, neutralizeCsvFormula, signupsCsv } from '../plugins/myconnect-community-admin/widget-elements/dist/index.js';
import { FakeTools, listMembersPage, makeMembers, parseCsv, TRICKY_NAMES, type SyntheticMember } from './myconnect-signup-csv-export.fixtures';

const action = elements.actions!.export_signups_csv!;

interface Download {
  filename: string;
  bytes: Uint8Array;
}
let downloads: Download[];
const pending: Promise<unknown>[] = [];

beforeEach(() => {
  downloads = [];
  const blobs = new Map<string, Blob>();
  let n = 0;
  URL.createObjectURL = (blob: Blob) => {
    const url = `blob:test/${++n}`;
    blobs.set(url, blob);
    return url;
  };
  URL.revokeObjectURL = () => {};
  // Minimal DOM: capture what the download anchor would save.
  (globalThis as Record<string, unknown>).document = {
    body: { appendChild() {} },
    createElement() {
      const a = { href: '', download: '', remove() {}, click() {} };
      a.click = () => {
        const blob = blobs.get(a.href)!;
        pending.push(blob.arrayBuffer().then((buf) => downloads.push({ filename: a.download, bytes: new Uint8Array(buf) })));
      };
      return a;
    },
  };
});
afterEach(() => {
  delete (globalThis as Record<string, unknown>).document;
});

const BEFORE_LIST = { items: [{ id: 'members-tab-row' }], nextCursor: null };

function newStore(): StateStore {
  return createStateStore({
    ui: { selectedCommunity: 'alpha' },
    'myconnect-community-admin': { list_members: BEFORE_LIST },
  });
}

async function op(store: StateStore, params: Record<string, unknown>, tools?: FakeTools | null) {
  await action.handler(params, { store, ...(tools ? { tools: tools.session() } : {}) });
}

const start = (store: StateStore, tools: FakeTools | null, from = '2026-01-01', to = '2026-03-31') =>
  op(store, { op: 'start', community: 'alpha', fromDate: from, toDate: to }, tools);

const view = (store: StateStore) => (store.get('/ui/signupsCsv') ?? {}) as Record<string, unknown>;

async function until(cond: () => boolean, what: string) {
  for (let i = 0; i < 2000; i++) {
    if (cond()) {
      await Promise.all(pending.splice(0));
      return;
    }
    await new Promise((r) => setTimeout(r, 0));
  }
  throw new Error(`timed out waiting for ${what}`);
}

const settled = (store: StateStore) => () => view(store).busy !== true;

function decode(d: Download) {
  return new TextDecoder('utf-8', { ignoreBOM: true }).decode(d.bytes);
}
const csvRows = (i = 0) => parseCsv(decode(downloads[i]!).slice(1));

describe('CSV encoding (built exporter)', () => {
  it('prefixes formula-looking and control-led values with an apostrophe, nothing else', () => {
    for (const v of ['=1+1', '+1+1', '-1+1', '@SUM(1,1)', ' =1+1', '\t=1+1', ' =1+1', '​=1+1', '‮=1+1', '﻿=1+1', '＝1+1', '-', '\tplain', '\rplain', '\nplain']) {
      expect(neutralizeCsvFormula(v)).toBe(`'${v}`);
    }
    for (const v of ['', 'Plain Name', 'a=b+c', 'Smith, "Jo"', '山田 太郎', '👩🏽‍💻 Dev', "'already", '1-2', 'line\n=1+1']) {
      expect(neutralizeCsvFormula(v)).toBe(v);
    }
  });

  it('quotes every cell and doubles quotes', () => {
    expect(csvCell('a')).toBe('"a"');
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvCell('=1+1')).toBe(`"'=1+1"`);
    expect(csvCell('a\r\nb')).toBe('"a\r\nb"');
  });

  it('round-trips every tricky value through an RFC 4180 parser, in every text column', () => {
    const members = TRICKY_NAMES.map((name, i) => ({
      displayName: name,
      email: name,
      status: 'active',
      role: 'member',
      createdAt: '2026-02-03T00:00:00.000Z',
      lastSeenAt: null,
      tagsText: name,
      accessGroups: [{ name }],
    }));
    const rows = parseCsv(signupsCsv(members as never));
    expect(rows[0]).toEqual(['Name', 'Email', 'Status', 'Role', 'Joined', 'Last seen', 'Tags', 'Access group']);
    expect(rows).toHaveLength(TRICKY_NAMES.length + 1);
    TRICKY_NAMES.forEach((name, i) => {
      const expected = neutralizeCsvFormula(name);
      const row = rows[i + 1]!;
      expect(row[0]).toBe(expected);
      expect(row[1]).toBe(expected);
      expect(row[6]).toBe(expected);
      expect(row[7]).toBe(expected);
      expect(row.slice(2, 6)).toEqual(['Active', 'Member', '03-Feb-26', 'Never']);
      // Removing the one added apostrophe gives back the exact original.
      expect(expected.startsWith("'") && expected !== name ? expected.slice(1) : expected).toBe(name);
    });
  });

  it('does not mutate the member objects it is given', () => {
    const m = { displayName: '=1+1', email: 'x@example.test', createdAt: '2026-02-03T00:00:00.000Z' };
    signupsCsv([m] as never);
    expect(m.displayName).toBe('=1+1');
  });
});

describe('export flow (built action + ctx.tools)', () => {
  it.each([
    [0, 1],
    [1, 1],
    [100, 1],
    [101, 2],
    [250, 3],
  ])('%i members -> %i page call(s), one complete UTF-8 BOM download, shared state untouched', async (count, pages) => {
    const all = makeMembers(count);
    const tools = new FakeTools(all);
    const store = newStore();
    await start(store, tools);
    await until(settled(store), 'done');
    expect(tools.calls).toHaveLength(pages);
    expect(tools.calls.every((c) => c.mcp === 'myconnect-community-admin' && c.tool === 'list_members')).toBe(true);
    expect(tools.calls.every((c) => c.params.limit === 100 && c.params.community === 'alpha')).toBe(true);
    expect(tools.calls[0]!.params.cursor).toBeUndefined();
    tools.calls.slice(1).forEach((c, i) => expect(c.params.cursor).toBe(all[(i + 1) * 100 - 1]!.id));
    expect(downloads).toHaveLength(1);
    expect(downloads[0]!.filename).toBe('alpha-signups-2026-01-01-to-2026-03-31.csv');
    expect([...downloads[0]!.bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(csvRows()).toHaveLength(count + 1);
    expect(csvRows().slice(1).map((r) => r[1])).toEqual(all.map((m) => m.email));
    expect(view(store)).toMatchObject({ status: 'done', open: false, busy: false });
    expect(store.get('/myconnect-community-admin/list_members')).toBe(BEFORE_LIST);
    expect(store.get('/_loading/myconnect-community-admin.list_members')).toBeUndefined();
    expect(store.get('/_errors/myconnect-community-admin.list_members')).toBeUndefined();
  });

  it('only exports the snapshotted community and dates', async () => {
    const all = [
      ...makeMembers(150, { community: 'alpha' }),
      ...makeMembers(30, { community: 'beta' }),
      ...makeMembers(5, { community: 'alpha', newest: '2026-05-01T12:00:00.000Z', idPrefix: 'late' }),
    ];
    const tools = new FakeTools(all);
    const store = newStore();
    await start(store, tools);
    await until(settled(store), 'done');
    expect(csvRows()).toHaveLength(151);
  });

  const faults: Array<[string, (call: number, p: Record<string, unknown>, all: SyntheticMember[]) => unknown]> = [
    ['a later page fails', (call) => (call === 2 ? { ok: false, code: 'tool-error', error: 'upstream 502' } : undefined)],
    ['a later page comes from another account', (call) => (call === 2 ? { ok: false, code: 'connection-changed', error: 'x' } : undefined)],
    ['the tile is closed or its connection changes mid-run', (call) => (call === 3 ? { ok: false, code: 'invalidated', error: 'x' } : undefined)],
    ['the account cannot be proven', (call) => (call === 1 ? { ok: false, code: 'unverified-connection', error: 'x' } : undefined)],
    ['a cursor loops back', (call, p, all) => (call === 3 ? { data: { ...listMembersPage(all, p), nextCursor: all[99]!.id } } : undefined)],
    ['a member repeats across pages', (call, p, all) => (call === 2 ? { data: listMembersPage(all, { ...p, cursor: all[98]!.id }) } : undefined)],
    ['a short page claims more', (call, p, all) => {
      if (call !== 1) return undefined;
      const page = listMembersPage(all, p);
      return { data: { items: page.items.slice(0, 50), nextCursor: page.items[49]!.id } };
    }],
    ['nextCursor is not the last id', (call, p, all) => (call === 1 ? { data: { ...listMembersPage(all, p), nextCursor: all[3]!.id } } : undefined)],
    ['a member is outside the dates', (call, p, all) => {
      if (call !== 2) return undefined;
      const page = listMembersPage(all, p);
      page.items[0] = { ...page.items[0]!, createdAt: '2025-12-31T23:59:59.999Z' };
      return { data: page };
    }],
    ['members are out of order', (call, p, all) => {
      if (call !== 2) return undefined;
      const page = listMembersPage(all, p);
      page.items[1] = { ...page.items[1]!, createdAt: '2026-03-31T12:00:00.000Z' };
      return { data: page };
    }],
    ['the response has no nextCursor', (call, p, all) => (call === 1 ? { data: { items: listMembersPage(all, p).items } } : undefined)],
    ['a cursor page comes back empty', (call) => (call === 2 ? { data: { items: [], nextCursor: null } } : undefined)],
    ['a member has no id', (call, p, all) => {
      if (call !== 1) return undefined;
      const page = listMembersPage(all, p);
      page.items[5] = { ...page.items[5]!, id: '' };
      return { data: page };
    }],
  ];

  it.each(faults)('fails closed with no download when %s; Try again then downloads everything once', async (_name, fault) => {
    const all = makeMembers(250);
    const tools = new FakeTools(all);
    tools.respond = (call, p) => fault(call, p, all) as never;
    const store = newStore();
    await start(store, tools);
    await until(settled(store), 'error');
    expect(downloads).toHaveLength(0);
    expect(view(store)).toMatchObject({ status: 'error', open: true, canRetry: true, canClose: true, busy: false });
    expect(String(view(store).message)).toMatch(/Nothing was downloaded\.$/);
    expect(store.get('/myconnect-community-admin/list_members')).toBe(BEFORE_LIST);

    tools.respond = undefined;
    await op(store, { op: 'retry' }, tools);
    await until(settled(store), 'retry done');
    expect(downloads).toHaveLength(1);
    expect(csvRows()).toHaveLength(251);
  });

  it('fails closed on a host without ctx.tools (no fallback, no retry)', async () => {
    const store = newStore();
    await start(store, null);
    expect(view(store)).toMatchObject({ status: 'error', canRetry: false });
    expect(String(view(store).message)).toMatch(/needs an update/);
    expect(downloads).toHaveLength(0);
  });

  it('ignores repeated Download presses while a run is active', async () => {
    const tools = new FakeTools(makeMembers(250));
    tools.manual = true;
    const store = newStore();
    await Promise.all([start(store, tools), start(store, tools), start(store, tools, '2026-02-01', '2026-02-02')]);
    await until(() => tools.calls.length === 1, 'page 1');
    tools.manual = false;
    tools.releaseAll();
    await until(settled(store), 'done');
    expect(tools.calls).toHaveLength(3);
    expect(downloads).toHaveLength(1);
    expect(csvRows()).toHaveLength(251);
  });

  it('Cancel aborts the in-flight page; its late reply and the old run never touch a new run', async () => {
    const all = makeMembers(250);
    const tools = new FakeTools(all);
    tools.manual = true;
    tools.ignoreAbort = true; // the reply still arrives after cancel
    const store = newStore();
    await start(store, tools);
    await until(() => tools.calls.length === 1, 'page 1');
    const old = tools.calls[0]!;
    await op(store, { op: 'cancel' }, tools);
    expect(old.signal?.aborted).toBe(true);
    expect(view(store)).toMatchObject({ status: 'cancelled', busy: false });

    await start(store, tools);
    await until(() => tools.calls.length === 2, 'new page 1');
    old.release({ ok: true, data: { items: [{ id: 'stale', createdAt: '2026-03-01T00:00:00.000Z' }], nextCursor: null }, provenance: { source: 'personal', accountId: 'acc-a' } });
    tools.manual = false;
    tools.releaseAll();
    await until(settled(store), 'done');
    expect(downloads).toHaveLength(1);
    const rows = csvRows();
    expect(rows).toHaveLength(251);
    expect(rows.some((r) => r[1] === '')).toBe(false);
    expect(tools.calls).toHaveLength(4);
  });

  it.each([
    ['a middle page', 2, 250],
    ['the last page', 3, 250],
    ['the only page', 1, 40],
  ])('a successful reply after the host ended the session (%s): no download, no stale completion', async (_label, at, count) => {
    const tools = new FakeTools(makeMembers(count));
    tools.abortSessionAt = at;
    const store = newStore();
    await start(store, tools);
    await until(settled(store), 'stopped');
    await new Promise((r) => setTimeout(r, 20));
    expect(downloads).toHaveLength(0);
    expect(tools.calls).toHaveLength(at);
    expect(view(store)).toMatchObject({ status: 'error', busy: false, canRetry: true });
    expect(String(view(store).message)).toMatch(/tile was closed or reloaded, or its connection or signed-in user changed/);
    expect(view(store).notice).toBe('');
  });

  it('a community change is caught synchronously after the page that straddles it', async () => {
    const tools = new FakeTools(makeMembers(250));
    tools.manual = true;
    const store = newStore();
    await start(store, tools);
    await until(() => tools.calls.length === 1, 'page 1');
    store.set('/ui/selectedCommunity', 'beta');
    tools.releaseAll();
    await until(settled(store), 'cancelled');
    expect(view(store).status).toBe('cancelled');
    expect(String(view(store).notice)).toMatch(/community changed/);
    expect(tools.calls).toHaveLength(1);
    expect(downloads).toHaveLength(0);
  });

  it('communityChanged cancels a run for another community and aborts its page', async () => {
    const tools = new FakeTools(makeMembers(250));
    tools.manual = true;
    const store = newStore();
    await start(store, tools);
    await until(() => tools.calls.length === 1, 'page 1');
    await op(store, { op: 'communityChanged', community: 'alpha' }, tools);
    expect(view(store).status).toBe('running');
    await op(store, { op: 'communityChanged', community: 'beta' }, tools);
    expect(tools.calls[0]!.signal?.aborted).toBe(true);
    expect(view(store).status).toBe('cancelled');
  });

  it('other list_members writes to the shared state during a run do not reach the CSV', async () => {
    const all = makeMembers(250);
    const tools = new FakeTools(all);
    tools.manual = true;
    const store = newStore();
    await start(store, tools);
    for (let page = 1; page <= 3; page++) {
      await until(() => tools.calls.length === page, `page ${page}`);
      store.set('/myconnect-community-admin/list_members', { items: [{ id: `members-tab-${page}` }], nextCursor: 'x' });
      tools.calls[page - 1]!.release();
    }
    await until(settled(store), 'done');
    expect(csvRows().slice(1).map((r) => r[1])).toEqual(all.map((m) => m.email));
    expect(store.get('/myconnect-community-admin/list_members')).toEqual({ items: [{ id: 'members-tab-3' }], nextCursor: 'x' });
  });

  it('keeps no member rows in widget state', async () => {
    const tools = new FakeTools(makeMembers(150));
    const store = newStore();
    await start(store, tools);
    await until(settled(store), 'done');
    expect(JSON.stringify(store.get('/ui'))).not.toContain('@example.test');
  });

  it('bad input never calls a tool', async () => {
    const tools = new FakeTools(makeMembers(5));
    const store = newStore();
    await start(store, tools, '2026-03-31', '2026-01-01');
    await op(store, { op: 'start', community: 'alpha', fromDate: '2026-02-30', toDate: '2026-03-01' }, tools);
    expect(tools.calls).toHaveLength(0);
    expect(view(store)).toMatchObject({ status: 'error', canRetry: false });
  });
});
