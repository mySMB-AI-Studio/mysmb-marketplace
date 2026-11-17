// Synthetic fixtures for the myConnect Community Admin sign-ups CSV tests.
// No real member data: every record here is generated.

export interface SyntheticMember {
  id: string;
  community: string;
  displayName: string;
  email: string;
  status: string;
  role: string;
  createdAt: string;
  lastSeenAt: string | null;
  tagsText: string | null;
  accessGroups: Array<{ id: string; name: string }>;
}

/** `count` members of `community`, one per minute back from `newest`. */
export function makeMembers(
  count: number,
  opts: { community?: string; newest?: string; idPrefix?: string } = {},
): SyntheticMember[] {
  const community = opts.community ?? 'alpha';
  const newest = Date.parse(opts.newest ?? '2026-03-31T12:00:00.000Z');
  const prefix = opts.idPrefix ?? community;
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-${String(i).padStart(6, '0')}`,
    community,
    displayName: `Synthetic Member ${i}`,
    email: `member${i}@example.test`,
    status: i % 3 === 0 ? 'invited' : 'active',
    role: 'member',
    createdAt: new Date(newest - i * 60_000).toISOString(),
    lastSeenAt: i % 2 === 0 ? null : new Date(newest).toISOString(),
    tagsText: i % 4 === 0 ? 'Synthetic, Test' : null,
    accessGroups: i % 5 === 0 ? [{ id: 'g1', name: 'Group One' }] : [],
  }));
}

/**
 * Mirrors myconnect's list_members (apps/web/lib/mcp/tools/community-admin.ts):
 * createdAt/fromDate/toDate inclusive UTC days, orderBy createdAt desc then id
 * desc, take limit + 1, Prisma cursor { id } with skip 1, nextCursor = last
 * returned id when more rows exist. A cursor that no longer exists yields no
 * rows, as Prisma does.
 */
export function listMembersPage(all: SyntheticMember[], params: Record<string, unknown>) {
  const limit = Math.min(100, Math.max(1, Number(params.limit ?? 25)));
  const from = params.fromDate ? Date.parse(`${params.fromDate}T00:00:00.000Z`) : -Infinity;
  const to = params.toDate ? Date.parse(`${params.toDate}T23:59:59.999Z`) : Infinity;
  const rows = all
    .filter((m) => m.community === params.community)
    .filter((m) => {
      const at = Date.parse(m.createdAt);
      return at >= from && at <= to;
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
  let start = 0;
  if (typeof params.cursor === 'string') {
    const at = rows.findIndex((m) => m.id === params.cursor);
    if (at < 0) return { items: [], nextCursor: null };
    start = at + 1;
  }
  const page = rows.slice(start, start + limit + 1);
  const items = page.slice(0, limit).map(({ community: _c, ...m }) => ({ ...m }));
  return { items, nextCursor: page.length > limit ? items[items.length - 1]!.id : null };
}

/** RFC 4180 parser: quoted fields may hold commas, quotes, CR and LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 2;
      } else if (c === '"') {
        quoted = false;
        i += 1;
      } else {
        cell += c;
        i += 1;
      }
    } else if (c === '"') {
      quoted = true;
      i += 1;
    } else if (c === ',') {
      row.push(cell);
      cell = '';
      i += 1;
    } else if (c === '\r' && text[i + 1] === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i += 2;
    } else {
      cell += c;
      i += 1;
    }
  }
  if (quoted) throw new Error('unterminated quoted field');
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** Harmless strings that look like formulas, plus text that must survive verbatim. */
export const TRICKY_NAMES = [
  '=1+1',
  '+1+1',
  '-1+1',
  '@SUM(1,1)',
  ' =1+1',
  '\t=1+1',
  '\r=1+1',
  '\n=1+1',
  ' =1+1',
  '​=1+1',
  '‮=1+1',
  '﻿=1+1',
  '＝1+1',
  '-',
  'Smith, "Jo"',
  'line one\nline two',
  'line one\r\nline two',
  'line one\rline two',
  'Zoë Ångström',
  '山田 太郎',
  'محمد',
  '👩🏽‍💻 Dev',
  'é combining',
  'a=b+c',
  'Plain Name',
];

type ToolResult =
  | { ok: true; data: unknown; provenance: { source: 'personal' | 'service'; accountId?: string; serviceConnectionId?: string } }
  | { ok: false; code: string; error: string };

export interface FakeCall {
  mcp: string;
  tool: string;
  params: Record<string, unknown>;
  signal?: AbortSignal;
  release: (result?: ToolResult) => void;
  done: boolean;
}

/**
 * Stand-in for the host's `ctx.tools` session (myHubV2 plugin-tools.ts):
 * replies come straight back, from the synthetic backend above. `manual`
 * holds replies until released; `ignoreAbort` lets a reply arrive after its
 * signal fired (the exporter must still drop it); `respond` overrides a
 * call's reply (`{ data }` replaces just the data). `abortSessionAt` aborts
 * the session's signal and THEN resolves that call successfully — the host
 * ending the session after its reply already resolved.
 */
export class FakeTools {
  calls: FakeCall[] = [];
  manual = false;
  ignoreAbort = false;
  respond?: (call: number, params: Record<string, unknown>) => Partial<ToolResult> | { data: unknown } | undefined;
  abortSessionAt?: number;
  constructor(public members: SyntheticMember[]) {}

  session() {
    const controller = new AbortController();
    return {
      signal: controller.signal,
      call: (mcp: string, tool: string, params: Record<string, unknown> = {}, options?: { signal?: AbortSignal }) =>
        new Promise<ToolResult>((resolve) => {
          const wire = JSON.parse(JSON.stringify(params)) as Record<string, unknown>;
          const call: FakeCall = { mcp, tool, params: wire, signal: options?.signal, done: false, release: () => {} };
          const index = this.calls.push(call);
          call.release = (result) => {
            if (call.done) return;
            call.done = true;
            if (index === this.abortSessionAt) controller.abort();
            resolve(result ?? this.reply(index, wire));
          };
          if (!this.ignoreAbort) {
            options?.signal?.addEventListener('abort', () => call.release({ ok: false, code: 'invalidated', error: 'cancelled' }));
          }
          if (!this.manual) setTimeout(() => call.release(), 0);
        }),
    };
  }

  reply(index: number, params: Record<string, unknown>): ToolResult {
    const provenance = { source: 'personal' as const, accountId: 'acc-a' };
    const override = this.respond?.(index, params);
    if (override && 'ok' in override && override.ok === false) return override as ToolResult;
    if (override && 'data' in override) return { ok: true, data: override.data, provenance };
    return { ok: true, data: listMembersPage(this.members, params), provenance };
  }

  releaseAll() {
    for (const c of this.calls) c.release();
  }
}
