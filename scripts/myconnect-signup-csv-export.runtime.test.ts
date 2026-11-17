// @vitest-environment jsdom
//
// Sign-ups CSV export in the real widget runtime: the shipped
// widgets/myconnect-admin.json spec rendered by @json-render/react 0.16.0 on
// React 19.2.4 (the versions pinned in myHubV2's lockfile) and the BUILT
// widget-elements module. Ordinary `<mcp>.<tool>` actions mirror myHubV2's
// widgets-system/registry.ts (they write the shared /<mcp>/<tool> state);
// plugin actions get `{ store, tools }` like the host, with `tools` a
// synthetic isolated session (FakeTools). The host's own dispatcher and
// renderer lifecycle are tested in myHubV2. Synthetic data only.
//
// The one stand-in is the component set: simple DOM stubs replace myHubV2's
// components, matching their interaction surface (Button is a native button
// honouring `disabled`; a clickable Row is role="button" tabIndex=0 with
// Enter/Space; Overlay renders a backdrop button and its children with no
// focus trap, like the host's).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement as h, act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createStateStore, type StateStore } from '@json-render/core';
import { JSONUIProvider, Renderer } from '@json-render/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import elements from '../plugins/myconnect-community-admin/widget-elements/dist/index.js';
import { FakeTools, listMembersPage, makeMembers, parseCsv, type SyntheticMember } from './myconnect-signup-csv-export.fixtures';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const MCP = 'myconnect-community-admin';
const widget = JSON.parse(
  readFileSync(join(process.cwd(), 'plugins/myconnect-community-admin/widgets/myconnect-admin.json'), 'utf8'),
);

// Tag each element with its key so tests can find the rendered DOM node.
const spec = structuredClone(widget.spec);
for (const [key, el] of Object.entries(spec.elements as Record<string, { props?: Record<string, unknown> }>)) {
  el.props = { ...(el.props ?? {}), __key: key };
}

function Stub({ element, children, emit }: { element: { type: string; props: Record<string, unknown> }; children?: ReactNode; emit: (e: string) => void }) {
  const p = element.props ?? {};
  const key = p.__key as string;
  const label = typeof p.label === 'string' ? p.label : typeof p.text === 'string' ? p.text : '';
  switch (element.type) {
    case 'Button':
      return h('button', { type: 'button', 'data-key': key, disabled: p.disabled === true, onClick: () => emit('click') }, label);
    case 'IconButton':
      return h('button', { type: 'button', 'data-key': key, 'aria-label': String(p.ariaLabel ?? ''), onClick: () => emit('click') });
    case 'Row':
      return p.clickable
        ? h(
            'div',
            {
              'data-key': key,
              role: 'button',
              tabIndex: 0,
              onClick: () => emit('click'),
              onKeyDown: (e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && emit('click'),
            },
            children,
          )
        : h('div', { 'data-key': key }, children);
    case 'Overlay':
      return h(
        'div',
        { 'data-key': key, 'data-overlay': '' },
        h('button', { type: 'button', 'aria-label': 'Close overlay', onClick: () => emit('backdropClick') }),
        h('div', null, children),
      );
    case 'Select':
      return h('select', { 'data-key': key });
    case 'DateInput':
      return h('input', { 'data-key': key });
    case 'Text':
    case 'Caption':
    case 'Heading':
    case 'Eyebrow':
      return h('span', { 'data-key': key }, label);
    default:
      return h('div', { 'data-key': key, 'data-type': element.type }, children);
  }
}

// ── synthetic host ───────────────────────────────────────────────────
/** Ordinary (shared-state) tool calls the spec's own actions make. */
class SharedCalls {
  calls: Array<{ tool: string; params: Record<string, unknown>; release: () => void }> = [];
  manual = false;
  constructor(public members: SyntheticMember[]) {}
  call(tool: string, params: Record<string, unknown>) {
    const wire = JSON.parse(JSON.stringify(params)) as Record<string, unknown>;
    return new Promise<{ ok: boolean; data?: unknown }>((resolve) => {
      let done = false;
      const release = () => {
        if (done) return;
        done = true;
        if (tool === 'list_members') resolve({ ok: true, data: listMembersPage(this.members, wire) });
        else if (tool === 'get_signups_in_range') resolve({ ok: true, data: { fromDate: '2026-01-01', toDate: '2026-03-31' } });
        else resolve({ ok: true, data: {} });
      };
      this.calls.push({ tool, params: wire, release });
      if (!this.manual) setTimeout(release, 0);
    });
  }
  releaseAll() {
    for (const c of this.calls) c.release();
  }
}

function specActions(): string[] {
  const found = new Set<string>();
  const walk = (n: unknown) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== 'object') return;
    const o = n as Record<string, unknown>;
    if (typeof o.action === 'string' && o.action.includes('.')) found.add(o.action);
    Object.values(o).forEach(walk);
  };
  for (const el of Object.values(spec.elements as Record<string, { on?: unknown; watch?: unknown }>)) {
    walk(el.on);
    walk(el.watch);
  }
  return [...found];
}

/** Same shape as myHubV2 buildRegistry: shared-state tool handlers + plugin actions with ctx. */
function buildHandlers(store: StateStore, shared: SharedCalls, tools: FakeTools | null) {
  const handlers: Record<string, (params: Record<string, unknown>) => Promise<void>> = {};
  for (const name of specActions()) {
    const [mcp, tool] = name.split('.') as [string, string];
    const loadingKey = `/_loading/${mcp}.${tool}`;
    const errorKey = `/_errors/${mcp}.${tool}`;
    handlers[name] = async (params) => {
      store.set(errorKey, '');
      store.set(loadingKey, true);
      try {
        const result = await shared.call(tool, params ?? {});
        const data = result.data;
        const writes: Array<[string, unknown]> =
          data && typeof data === 'object' && !Array.isArray(data)
            ? Object.entries(data).map(([k, v]) => [`/${mcp}/${tool}/${k}`, v])
            : [[`/${mcp}/${tool}`, data]];
        for (const [path, value] of writes) store.set(path, value);
      } finally {
        store.set(loadingKey, false);
      }
    };
  }
  for (const [name, action] of Object.entries(elements.actions ?? {})) {
    handlers[`${elements.slug}_${name}`] = async (params) => {
      await action.handler(params ?? {}, { store, ...(tools ? { tools: tools.session() } : {}) });
    };
  }
  return handlers;
}

const functions = new Proxy(
  Object.fromEntries(Object.entries(elements.functions ?? {}).map(([k, f]) => [`${elements.slug}_${k}`, f])) as Record<string, unknown>,
  { get: (t, k: string) => t[k] ?? (() => undefined), has: () => true },
);

const BEFORE_LIST = { items: [{ id: 'members-tab-row', displayName: 'Shown before', createdAt: '2026-01-05T00:00:00.000Z' }], nextCursor: null };

function initialState() {
  return {
    [MCP]: {
      list_communities: [
        { slug: 'alpha', name: 'Alpha' },
        { slug: 'beta', name: 'Beta' },
      ],
      get_signups_in_range: { fromDate: '2026-01-01', toDate: '2026-03-31', total: 0, monthly: [{ month: '2026-03', label: 'Mar 2026', total: 1 }] },
      list_members: BEFORE_LIST,
      list_access_groups: [{ id: 'g1', name: 'Group One', memberCount: 1 }],
    },
    ui: { selectedCommunity: 'alpha', activeTab: 'analytics', fromDate: '2026-01-01', toDate: '2026-03-31' },
  };
}

// ── harness ──────────────────────────────────────────────────────────
interface Tile {
  store: StateStore;
  tools: FakeTools;
  shared: SharedCalls;
  container: HTMLElement;
}

const mounted: Root[] = [];
let downloads: Array<{ filename: string; blob: Blob }> = [];

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
  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    downloads.push({ filename: this.download, blob: blobs.get(this.href)! });
  };
});

afterEach(async () => {
  for (const root of mounted.splice(0)) await act(async () => root.unmount());
  document.body.innerHTML = '';
});

async function mount(members: SyntheticMember[], opts: { tools?: boolean } = {}): Promise<Tile> {
  const store = createStateStore(initialState());
  const tools = new FakeTools(members);
  const shared = new SharedCalls(members);
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push(root);
  const handlers = buildHandlers(store, shared, opts.tools === false ? null : tools);
  await act(async () => {
    root.render(h(JSONUIProvider, { registry: {}, store, handlers, functions } as never, h(Renderer, { spec, registry: {}, fallback: Stub } as never)));
  });
  return { store, tools, shared, container };
}

async function tick(ms = 0) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

async function until(cond: () => boolean, what: string) {
  for (let i = 0; i < 400; i++) {
    if (cond()) return;
    await tick(1);
  }
  throw new Error(`timed out waiting for ${what}`);
}

function el(tile: Tile, key: string) {
  return tile.container.querySelector<HTMLElement>(`[data-key="${key}"]`);
}

async function click(tile: Tile, key: string) {
  const node = el(tile, key);
  if (!node) throw new Error(`${key} is not rendered`);
  await act(async () => node.click());
}

const view = (tile: Tile) => (tile.store.get('/ui/signupsCsv') ?? {}) as Record<string, unknown>;

async function csvRows(i = 0) {
  const buf = new Uint8Array(await downloads[i]!.blob.arrayBuffer());
  expect([...buf.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  return parseCsv(new TextDecoder('utf-8', { ignoreBOM: true }).decode(buf).slice(1));
}

// ── tests ────────────────────────────────────────────────────────────
describe('sign-ups CSV export in the real widget runtime', () => {
  it('the spec dispatches list_members itself (the host only lets plugin actions call tools the spec uses)', () => {
    expect(specActions()).toContain(`${MCP}.list_members`);
  });

  it.each([
    [0, 1],
    [1, 1],
    [100, 1],
    [101, 2],
    [250, 3],
  ])('%i members: Download CSV pages through ctx.tools (%i call(s)), downloads once, shared state untouched', async (count, pages) => {
    const tile = await mount(makeMembers(count));
    expect(el(tile, 'printReportBtn')!.textContent).toBe('Download CSV');
    await click(tile, 'printReportBtn');
    await until(() => downloads.length === 1, 'download');
    await tick(5);
    expect(tile.tools.calls).toHaveLength(pages);
    expect(tile.tools.calls.map((c) => c.params.cursor)).toEqual([undefined, ...tile.tools.calls.slice(1).map((_, i) => tile.tools.members[(i + 1) * 100 - 1]!.id)]);
    expect(tile.shared.calls.filter((c) => c.tool === 'list_members')).toHaveLength(0);
    expect(downloads[0]!.filename).toBe('alpha-signups-2026-01-01-to-2026-03-31.csv');
    expect(await csvRows()).toHaveLength(count + 1);
    expect(view(tile)).toMatchObject({ status: 'done', open: false, busy: false });
    expect(el(tile, 'signupsCsvOverlay')).toBeNull();
    expect(el(tile, 'signupsCsvNotice')!.textContent).toMatch(count ? `Downloaded ${count} member` : /header row/);
    expect(tile.store.get(`/${MCP}/list_members`)).toBe(BEFORE_LIST);
  });

  it('shows progress and disables the button while pages load; repeated clicks start one run', async () => {
    const tile = await mount(makeMembers(250));
    tile.tools.manual = true;
    const btn = el(tile, 'printReportBtn')!;
    await act(async () => {
      for (let i = 0; i < 5; i++) btn.click();
    });
    await until(() => tile.tools.calls.length === 1, 'page 1');
    expect(view(tile)).toMatchObject({ status: 'running', busy: true, open: true });
    expect((el(tile, 'printReportBtn') as HTMLButtonElement).disabled).toBe(true);
    expect(el(tile, 'printReportBtn')!.textContent).toBe('Preparing CSV…');
    for (let page = 1; page <= 3; page++) {
      await until(() => tile.tools.calls.length === page, `page ${page}`);
      if (page === 2) expect(el(tile, 'signupsCsvMessage')!.textContent).toMatch(/Fetched 100 members so far/);
      await act(async () => tile.tools.calls[page - 1]!.release());
    }
    await until(() => downloads.length === 1, 'download');
    await tick(5);
    expect(tile.tools.calls).toHaveLength(3);
    expect(downloads).toHaveLength(1);
  });

  it('a later page fails: nothing downloads, the error shows, Try again downloads everything once', async () => {
    const tile = await mount(makeMembers(250));
    let failed = false;
    tile.tools.respond = (call) => {
      if (call === 2 && !failed) {
        failed = true;
        return { ok: false, code: 'tool-error', error: 'upstream 502' };
      }
      return undefined;
    };
    await click(tile, 'printReportBtn');
    await until(() => view(tile).status === 'error', 'error');
    expect(downloads).toHaveLength(0);
    expect(el(tile, 'signupsCsvMessage')!.textContent).toMatch(/upstream 502.*Nothing was downloaded\./);
    expect(el(tile, 'signupsCsvCancelBtn')).toBeNull();
    await click(tile, 'signupsCsvRetryBtn');
    await until(() => downloads.length === 1, 'download after retry');
    expect(await csvRows()).toHaveLength(251);
  });

  it('Cancel stops at once; a new Download starts clean', async () => {
    const tile = await mount(makeMembers(250));
    tile.tools.manual = true;
    await click(tile, 'printReportBtn');
    await until(() => tile.tools.calls.length === 1, 'page 1');
    await click(tile, 'signupsCsvCancelBtn');
    expect(tile.tools.calls[0]!.signal?.aborted).toBe(true);
    expect(view(tile).status).toBe('cancelled');
    expect((el(tile, 'printReportBtn') as HTMLButtonElement).disabled).toBe(false);
    tile.tools.manual = false;
    await click(tile, 'printReportBtn');
    await until(() => downloads.length === 1, 'download');
    expect(await csvRows()).toHaveLength(251);
  });

  it('a Members-tab load during the export writes only its own shared state; the CSV is unaffected', async () => {
    const all = makeMembers(250);
    const tile = await mount(all);
    tile.tools.manual = true;
    await click(tile, 'printReportBtn');
    await until(() => tile.tools.calls.length === 1, 'page 1');
    // The tab bar stays usable (keyboard or pointer); its body.watch reloads list_members.
    await click(tile, 'membersTabBtn');
    await until(() => tile.shared.calls.some((c) => c.tool === 'list_members'), 'members load');
    tile.shared.releaseAll();
    await tick(5);
    for (let page = 1; page <= 3; page++) {
      await until(() => tile.tools.calls.length === page, `page ${page}`);
      await act(async () => tile.tools.calls[page - 1]!.release());
    }
    await until(() => downloads.length === 1, 'download');
    expect((await csvRows()).slice(1).map((r) => r[1])).toEqual(all.map((m) => m.email));
    const shown = tile.store.get(`/${MCP}/list_members`) as { items: unknown[] };
    expect(shown.items).toHaveLength(20); // the Members tab's own limit-20 load
  });

  it('switching community mid-run cancels with no download', async () => {
    const tile = await mount([...makeMembers(250), ...makeMembers(250, { community: 'beta' })]);
    tile.tools.manual = true;
    await click(tile, 'printReportBtn');
    await until(() => tile.tools.calls.length === 1, 'page 1');
    await act(async () => tile.store.set('/ui/selectedCommunity', 'beta'));
    await until(() => view(tile).status === 'cancelled', 'cancelled');
    tile.tools.releaseAll();
    await tick(5);
    expect(downloads).toHaveLength(0);
    expect(tile.tools.calls).toHaveLength(1);
    expect(el(tile, 'signupsCsvNotice')!.textContent).toMatch(/community changed/);
  });

  it('on a host without ctx.tools: an error, no tool call, no download', async () => {
    const tile = await mount(makeMembers(5), { tools: false });
    await click(tile, 'printReportBtn');
    await tick(5);
    expect(view(tile)).toMatchObject({ status: 'error', canRetry: false });
    expect(el(tile, 'signupsCsvMessage')!.textContent).toMatch(/needs an update/);
    expect(tile.shared.calls.filter((c) => c.tool === 'list_members')).toHaveLength(0);
    expect(downloads).toHaveLength(0);
  });
});
