/**
 * myconnect-community-admin — widget-elements module
 * ──────────────────────────────────────────────────────────────────
 * Contributed `$computed` helpers and actions. The host prepends the
 * slug `myconnect-community-admin_` to every name, so e.g. the
 * spec-side reference is `myconnect-community-admin_today`.
 */

import type {
  ComputedFunction,
  PluginActionStateStore,
  PluginElementsModule,
  PluginToolSession,
  PluginWidgetAction,
} from './types';

// ── today ────────────────────────────────────────────────────────────
// Today's date, UTC, as YYYY-MM-DD -- matches the YYYY-MM-DD shape
// get_signups_in_range/list_members already expect for fromDate/toDate.
// No args.
//
// Spec example:
//   { "$computed": "myconnect-community-admin_today" }
const today: ComputedFunction = () => new Date().toISOString().slice(0, 10);

// ── is_after ─────────────────────────────────────────────────────────
// True when YYYY-MM-DD string `a` is chronologically after `b` (plain
// string compare -- safe because the format is fixed-width). json-render's
// own `$cond` gt/lt only compare numbers, so a "fromDate after toDate"
// check needs this rather than a bare $cond.
//
// Args: { a: string, b: string }
//
// Spec example:
//   { "$computed": "myconnect-community-admin_is_after", "args": { "a": {"$state":"/ui/fromDate"}, "b": {"$state":"/ui/toDate"} } }
const is_after: ComputedFunction = (args) => {
  const a = String(args.a ?? '');
  const b = String(args.b ?? '');
  if (!a || !b) return false;
  return a > b;
};

function eventDatePart(value: unknown, timezone: unknown, part: Intl.DateTimeFormatOptions): string {
  if (value == null) return '';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  const tz = typeof timezone === 'string' && timezone ? timezone : undefined;
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, ...part }).format(d);
}

// ── event_card_day ──────────────────────────────────────────────────
// Day-of-month only (e.g. "25"), in the event's own timezone -- not the
// viewer's browser zone, since an event's displayed time must match what
// it was scheduled for regardless of who's looking.
// Args: { value: string (ISO), timezone?: string (IANA) }
const event_card_day: ComputedFunction = (args) =>
  eventDatePart(args.value, args.timezone, { day: 'numeric' });

// ── event_card_month ────────────────────────────────────────────────
// 3-letter month, upper case (e.g. "NOV"), in the event's own timezone.
// Args: { value: string (ISO), timezone?: string (IANA) }
const event_card_month: ComputedFunction = (args) =>
  eventDatePart(args.value, args.timezone, { month: 'short' }).toUpperCase();

// ── event_card_weekday_time ─────────────────────────────────────────
// "Wed 8:00 pm" -- weekday + 12-hour time, lower-case am/pm, in the
// event's own timezone.
// Args: { value: string (ISO), timezone?: string (IANA) }
const event_card_weekday_time: ComputedFunction = (args) => {
  const weekday = eventDatePart(args.value, args.timezone, { weekday: 'short' });
  const time = eventDatePart(args.value, args.timezone, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).toLowerCase().replace(/([ap])\.m\./, '$1m');
  if (!weekday || !time) return '';
  return `${weekday} ${time}`;
};

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      (
        {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        } as Record<string, string>
      )[c] ?? c,
  );
}

function titleCase(s: string): string {
  return s
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');
}

// dd-Mmm-yy, matching TILE-DISPLAY-STANDARDS' default date format.
function formatDate(iso: unknown): string {
  if (typeof iso !== 'string' || !iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = months[d.getUTCMonth()];
  const year = String(d.getUTCFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
}

interface ReportMember {
  id?: string;
  displayName?: string | null;
  email?: string | null;
  status?: string | null;
  role?: string | null;
  createdAt?: string | null;
  lastSeenAt?: string | null;
  tagsText?: string | null;
  accessGroups?: Array<{ name?: string | null } | null> | null;
}

// ── CSV encoding ────────────────────────────────────────────────────
// Every cell goes through `csvCell`, so member-controlled text (a display
// name may be any trimmed 1-80 character string, e.g. "=1+1") can't run as a
// spreadsheet formula. A cell whose first visible character is = + - @ (or
// the full-width ＝ ＋ － ＠), possibly behind whitespace, invisible or
// bidi-control characters, or that starts with any control character (tab,
// CR, LF...), gets a leading apostrophe. The apostrophe is visible in the
// cell: that's the tradeoff for not altering any other character. The
// stored member name is never changed. Every cell is then quoted (RFC 4180),
// so commas, quotes and CR / LF / CRLF inside a value round-trip exactly.
const FORMULA_LEAD =
  /^[\s\u0000-\u001F\u007F-\u009F­؜᠎​-‏‪-‮⁠-⁯﻿]*[=+\-@＝＋－＠]/;
const CONTROL_LEAD = /^[\u0000-\u001F\u007F]/;

export function neutralizeCsvFormula(value: string): string {
  return FORMULA_LEAD.test(value) || CONTROL_LEAD.test(value) ? `'${value}` : value;
}

export function csvCell(value: string): string {
  return `"${neutralizeCsvFormula(value).replace(/"/g, '""')}"`;
}

function csvRow(cells: string[]): string {
  return cells.map(csvCell).join(',') + '\r\n';
}

function text(value: unknown): string {
  return value == null ? '' : String(value);
}

export function signupsCsv(members: ReportMember[]): string {
  let csv = csvRow(['Name', 'Email', 'Status', 'Role', 'Joined', 'Last seen', 'Tags', 'Access group']);
  for (const m of members) {
    const groups = Array.isArray(m.accessGroups)
      ? m.accessGroups.map((g) => text(g?.name)).filter(Boolean).join(', ')
      : '';
    csv += csvRow([
      text(m.displayName),
      text(m.email),
      titleCase(text(m.status)),
      titleCase(text(m.role)),
      formatDate(m.createdAt),
      m.lastSeenAt ? formatDate(m.lastSeenAt) : 'Never',
      text(m.tagsText),
      groups,
    ]);
  }
  return csv;
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── export_signups_csv ──────────────────────────────────────────────
// Downloads every member who joined the selected community in the selected
// date range, one row each (name, email, status, role, joined, last seen,
// tags, access group). The CSV is built only once every page has arrived;
// any failure downloads nothing.
//
// Pages come from the host's isolated tool calls (`ctx.tools`, myHubV2
// widgets-system/plugin-tools.ts): each reply comes straight back here and
// is never cached or written to the tile's shared list_members state, every
// page goes to the same account (the host pins it and fails a reply from any
// other), and the session ends when the tile unmounts or its connection or
// signed-in user changes. A host without `ctx.tools` gets an error, never a
// fallback to the shared result path. Because the session can end between a
// reply resolving and this code resuming, every reply and the final download
// re-check the run and both abort signals first (`stopped`).
//
// The query is snapshotted at Download time. Each page is checked before
// it's kept: in the date range, newest first, no repeated member or cursor,
// a full page before every cursor, and nextCursor equal to the page's last
// id. After every page the selected community is re-checked.
//
// Ops (`params.op`):
//   start            { community, fromDate, toDate } (ignored while a run is active)
//   retry            restart the last query from page 1
//   cancel           stop now; the in-flight page is aborted and discarded
//   close            dismiss a finished / failed export
//   communityChanged { community } (cancels a run for another community)
const MCP = 'myconnect-community-admin';
const SELECTED_COMMUNITY = '/ui/selectedCommunity';
const EXPORT_VIEW = '/ui/signupsCsv';
const PAGE_LIMIT = 100; // list_members' own maximum
const MAX_PAGES = 2000;

interface ExportQuery {
  community: string;
  fromDate: string;
  toDate: string;
}

interface ExportRun {
  query: ExportQuery;
  controller: AbortController;
}

interface ExportView {
  status: 'running' | 'error' | 'done' | 'cancelled';
  open: boolean;
  busy: boolean;
  canCancel: boolean;
  canRetry: boolean;
  canClose: boolean;
  message: string;
  detail: string;
  notice: string;
}

// One active run per tile store; a run that isn't the current one stops at
// its next await and writes nothing.
const runs = new WeakMap<PluginActionStateStore, ExportRun>();
const lastQueries = new WeakMap<PluginActionStateStore, ExportQuery>();

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parseDate(v: unknown): string | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : null;
}

function parseQuery(params: Record<string, unknown>): ExportQuery | null {
  const community = typeof params.community === 'string' ? params.community.trim() : '';
  const fromDate = parseDate(params.fromDate);
  const toDate = parseDate(params.toDate);
  if (!community || !fromDate || !toDate || fromDate > toDate) return null;
  return { community, fromDate, toDate };
}

function describe(q: ExportQuery): string {
  return `${q.community} · ${q.fromDate} to ${q.toDate}`;
}

function members(n: number): string {
  return `${n} member${n === 1 ? '' : 's'}`;
}

function show(store: PluginActionStateStore, view: Partial<ExportView> & Pick<ExportView, 'status' | 'message'>) {
  const busy = view.status === 'running';
  store.set(EXPORT_VIEW, {
    open: busy || view.status === 'error',
    busy,
    canCancel: busy,
    canRetry: view.status === 'error',
    canClose: view.status === 'error',
    detail: '',
    notice: '',
    ...view,
  } satisfies ExportView);
}

const COMMUNITY_CHANGED = 'CSV download cancelled because the community changed. Nothing was downloaded.';
const CANCELLED = 'CSV download cancelled. Nothing was downloaded.';

function end(store: PluginActionStateStore, run: ExportRun) {
  if (runs.get(store) === run) runs.delete(store);
  run.controller.abort();
}

function fail(store: PluginActionStateStore, run: ExportRun, message: string) {
  end(store, run);
  show(store, { status: 'error', message: `${message} Nothing was downloaded.`, detail: describe(run.query) });
}

function cancel(store: PluginActionStateStore, notice: string) {
  const run = runs.get(store);
  if (!run) return;
  end(store, run);
  show(store, { status: 'cancelled', message: notice, notice });
}

const TOOL_ERRORS: Record<string, string> = {
  invalidated: 'The download stopped because the tile was closed or reloaded, or its connection or signed-in user changed.',
  'connection-changed': 'A page came from a different myConnect account than the first page.',
  'unverified-connection': "The workspace couldn't confirm which myConnect account answered. Bind a single account to this tile.",
  'ambiguous-connection': 'This tile is bound to more than one myConnect account. Bind a single account first.',
  'needs-connection': 'This tile needs a myConnect connection.',
  'not-allowed': "This workspace didn't allow the member list call for this tile.",
  unsupported: "This workspace can't download the CSV from this tile.",
};

interface PageCheck {
  seenIds: Set<string>;
  seenCursors: Set<string>;
  lastCreatedAt: number;
}

// Checks one list_members page against the pages before it. Returns a
// problem, or the page's members and next cursor (state updated).
function checkPage(
  query: ExportQuery,
  check: PageCheck,
  page: number,
  hadCursor: boolean,
  data: unknown,
): string | { items: ReportMember[]; next: string | null } {
  const bad = (why: string) => `Page ${page} of the member list didn't look right (${why}).`;
  if (!isRecord(data) || !Array.isArray(data.items) || !('nextCursor' in data)) return bad('unexpected response');
  const items = data.items as unknown[];
  const next = data.nextCursor;
  if (next !== null && (typeof next !== 'string' || !next)) return bad('invalid next-page cursor');
  if (items.length > PAGE_LIMIT) return bad('more rows than requested');
  if (hadCursor && items.length === 0) return `The member list changed while page ${page} was loading. Try again.`;

  const from = Date.parse(`${query.fromDate}T00:00:00.000Z`);
  const to = Date.parse(`${query.toDate}T23:59:59.999Z`);
  const ids = new Set<string>();
  let last = check.lastCreatedAt;
  for (const m of items) {
    if (!isRecord(m) || typeof m.id !== 'string' || !m.id) return bad('a member without an id');
    if (check.seenIds.has(m.id) || ids.has(m.id)) return bad('a member appeared twice');
    const at = typeof m.createdAt === 'string' ? Date.parse(m.createdAt) : Number.NaN;
    if (Number.isNaN(at)) return bad('a member without a join date');
    if (at < from || at > to) return bad('a member outside the selected dates');
    if (at > last) return bad('members out of order');
    last = at;
    ids.add(m.id);
  }
  if (typeof next === 'string') {
    if (items.length !== PAGE_LIMIT) return bad('a short page with more to come');
    if (next !== (items[items.length - 1] as { id: string }).id) return bad('next-page cursor mismatch');
    if (check.seenCursors.has(next)) return bad('a repeated next-page cursor');
    check.seenCursors.add(next);
  }
  for (const id of ids) check.seenIds.add(id);
  check.lastCreatedAt = last;
  return { items: items as ReportMember[], next: typeof next === 'string' ? next : null };
}

// True when the run must not go on: it was cancelled or superseded (write
// nothing), or the host ended the tool session after the reply resolved
// (fail; the reply may belong to a closed tile or a changed connection).
function stopped(store: PluginActionStateStore, tools: PluginToolSession, run: ExportRun): boolean {
  if (runs.get(store) !== run || run.controller.signal.aborted) return true;
  if (tools.signal.aborted) {
    fail(store, run, TOOL_ERRORS.invalidated!);
    return true;
  }
  return false;
}

async function exportAll(store: PluginActionStateStore, tools: PluginToolSession, run: ExportRun) {
  const { query } = run;
  const rows: ReportMember[] = [];
  const check: PageCheck = { seenIds: new Set(), seenCursors: new Set(), lastCreatedAt: Number.POSITIVE_INFINITY };
  let cursor: string | null = null;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const result = await tools.call(
      MCP,
      'list_members',
      {
        community: query.community,
        fromDate: query.fromDate,
        toDate: query.toDate,
        limit: PAGE_LIMIT,
        ...(cursor ? { cursor } : {}),
      },
      { signal: run.controller.signal },
    );
    if (stopped(store, tools, run)) return;
    if (store.get(SELECTED_COMMUNITY) !== query.community) {
      cancel(store, COMMUNITY_CHANGED);
      return;
    }
    if (!result.ok) {
      const reason = TOOL_ERRORS[result.code] ?? `myConnect couldn't return page ${page} of the member list: ${result.error}.`;
      fail(store, run, reason);
      return;
    }
    const checked = checkPage(query, check, page, cursor !== null, result.data);
    if (typeof checked === 'string') {
      fail(store, run, checked);
      return;
    }
    rows.push(...checked.items);
    if (!checked.next) {
      complete(store, tools, run, rows);
      return;
    }
    cursor = checked.next;
    show(store, {
      status: 'running',
      message: `Fetched ${members(rows.length)} so far. Fetching page ${page + 1}…`,
      detail: describe(query),
    });
  }
  fail(store, run, `This range has more than ${members(MAX_PAGES * PAGE_LIMIT)}. Pick a shorter date range.`);
}

function complete(store: PluginActionStateStore, tools: PluginToolSession, run: ExportRun, rows: ReportMember[]) {
  if (stopped(store, tools, run)) return;
  const { community, fromDate, toDate } = run.query;
  const slug = community.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'community';
  try {
    downloadCsv(`${slug}-signups-${fromDate}-to-${toDate}.csv`, signupsCsv(rows));
  } catch (err) {
    fail(store, run, `Couldn't save the CSV file (${err instanceof Error ? err.message : String(err)}).`);
    return;
  }
  end(store, run);
  const notice = rows.length
    ? `Downloaded ${members(rows.length)} (${describe(run.query)}).`
    : `No members joined in ${describe(run.query)}. Downloaded a CSV with just the header row.`;
  show(store, { status: 'done', message: notice, notice });
}

function begin(store: PluginActionStateStore, tools: PluginToolSession | undefined, query: ExportQuery) {
  if (runs.has(store)) return;
  lastQueries.set(store, query);
  if (!tools) {
    show(store, {
      status: 'error',
      message: 'This workspace needs an update before it can download this CSV. Nothing was downloaded.',
      detail: describe(query),
      canRetry: false,
    });
    return;
  }
  if (store.get(SELECTED_COMMUNITY) !== query.community) {
    show(store, {
      status: 'error',
      message: 'The selected community changed. Press "Show sign-ups", then "Download CSV" again.',
      canRetry: false,
    });
    return;
  }
  const run: ExportRun = { query, controller: new AbortController() };
  runs.set(store, run);
  show(store, { status: 'running', message: 'Fetching members…', detail: describe(query) });
  void exportAll(store, tools, run).catch((err) => {
    if (runs.get(store) === run) fail(store, run, `Something went wrong (${err instanceof Error ? err.message : String(err)}).`);
  });
}

const export_signups_csv: PluginWidgetAction = {
  description:
    'Download a CSV of every member who joined the selected community in the selected date range, fetching every list_members page first. Driven by op: start | retry | cancel | close | communityChanged.',
  schema: {
    type: 'object',
    properties: {
      op: { type: 'string', enum: ['start', 'retry', 'cancel', 'close', 'communityChanged'] },
      community: { type: 'string' },
      fromDate: { type: 'string' },
      toDate: { type: 'string' },
    },
    required: ['op'],
  },
  handler: (params, ctx) => {
    const store = ctx?.store;
    if (!store) return;
    switch (params.op) {
      case 'start': {
        if (runs.has(store)) return;
        const query = parseQuery(params);
        if (!query) {
          show(store, {
            status: 'error',
            message: 'Pick a community and a valid date range, press "Show sign-ups", then try again.',
            canRetry: false,
          });
          return;
        }
        begin(store, ctx.tools, query);
        return;
      }
      case 'retry': {
        const query = lastQueries.get(store);
        if (query) begin(store, ctx.tools, query);
        return;
      }
      case 'cancel':
        cancel(store, CANCELLED);
        return;
      case 'communityChanged': {
        const run = runs.get(store);
        if (run && params.community !== run.query.community) cancel(store, COMMUNITY_CHANGED);
        return;
      }
      case 'close':
        if (!runs.has(store)) store.set(EXPORT_VIEW, {});
        return;
    }
  },
};

interface ReportRsvp {
  displayName?: string;
  email?: string;
  status?: string;
  attendedAt?: string | null;
  sessionsText?: string | null;
  businessName?: string | null;
  industry?: string | null;
}

const RSVP_STATUS_LABELS: Record<string, string> = {
  yes: 'Going',
  waitlist: 'Waitlisted',
  no: 'Not going',
};
const RSVP_STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  yes: { bg: '#dcfce7', fg: '#15803d' },
  waitlist: { bg: '#fef3c7', fg: '#b45309' },
  no: { bg: '#e5e7eb', fg: '#374151' },
};

function rsvpStatusPill(status: unknown): string {
  const s = typeof status === 'string' ? status : '';
  const colors = RSVP_STATUS_COLORS[s] ?? RSVP_STATUS_COLORS.no!;
  const label = RSVP_STATUS_LABELS[s] ?? 'Unknown';
  return `<span style="display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600;background:${colors.bg};color:${colors.fg};">${escapeHtml(label)}</span>`;
}

// ── print_rsvp_report ───────────────────────────────────────────────
// Opens a new browser tab with a styled, printable RSVP roster for one
// event (member, email, RSVP status, sessions, attended, business name,
// industry), then triggers the browser's print dialog. Unlike
// print_report, this needs no fetch-then-gate dance: by the time the
// Print report button is visible, the event's RSVPs are already loaded
// into state (the popup that contains the button only shows after
// list_event_rsvps has resolved), so the click just reads what's
// already there -- no tool call in this action's own click, so no
// shared-path staleness risk either.
//
// Args: { eventTitle?, rsvps: ReportRsvp[] }
const print_rsvp_report: PluginWidgetAction = {
  description:
    'Open a printable RSVP roster (member, email, status, sessions, attended, business name, industry) for one event, and trigger the browser print dialog.',
  schema: {
    type: 'object',
    properties: {
      eventTitle: { type: 'string' },
      rsvps: { type: 'array' },
    },
    required: ['rsvps'],
  },
  handler: (params) => {
    const eventTitle =
      typeof params.eventTitle === 'string' && params.eventTitle ? params.eventTitle : 'Event';
    const rsvps: ReportRsvp[] = Array.isArray(params.rsvps) ? (params.rsvps as ReportRsvp[]) : [];

    const win = window.open('', '_blank');
    if (!win) return;

    const going = rsvps.filter((r) => r.status === 'yes').length;
    const waitlisted = rsvps.filter((r) => r.status === 'waitlist').length;
    const attended = rsvps.filter((r) => r.attendedAt).length;

    const statCard = (label: string, n: number, accent: string) => `
      <div style="flex:1;min-width:120px;background:#fff;border:1px solid #e5e7eb;border-top:4px solid ${accent};border-radius:10px;padding:14px 16px;">
        <div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.03em;">${escapeHtml(label)}</div>
        <div style="font-size:24px;font-weight:700;color:#111827;margin-top:4px;">${n}</div>
      </div>`;

    const rows = rsvps
      .map(
        (r) => `<tr>
          <td>${escapeHtml(r.displayName ?? '—')}</td>
          <td>${escapeHtml(r.email ?? '—')}</td>
          <td>${rsvpStatusPill(r.status)}</td>
          <td>${escapeHtml(r.sessionsText || '—')}</td>
          <td>${r.attendedAt ? escapeHtml(formatDate(r.attendedAt)) : 'Not yet'}</td>
          <td>${escapeHtml(r.businessName || '—')}</td>
          <td>${escapeHtml(r.industry || '—')}</td>
        </tr>`,
      )
      .join('');

    win.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>RSVPs — ${escapeHtml(eventTitle)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Arial, sans-serif; color: #111827; margin: 0; background: #f3f4f6; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .banner { background: linear-gradient(135deg, #1d4ed8, #0ea5e9); color: #fff; padding: 28px 32px; }
  .banner h1 { margin: 0; font-size: 20px; }
  .banner p { margin: 4px 0 0; font-size: 13px; opacity: .9; }
  .content { padding: 24px 32px 40px; }
  .cards { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 28px; }
  table { border-collapse: collapse; width: 100%; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,.06); }
  th, td { text-align: left; padding: 10px 14px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
  thead th { background: #eff6ff; color: #1d4ed8; font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: .03em; }
  tbody tr:nth-child(even) { background: #fafafa; }
  tbody tr:last-child td { border-bottom: none; }
  h2 { font-size: 14px; color: #374151; margin: 0 0 10px; }
  .meta { color: #6b7280; font-size: 12px; margin-top: 2px; }
  @media print { body { background: #fff; } }
</style>
</head>
<body>
  <div class="banner">
    <h1>${escapeHtml(eventTitle)} — RSVP report</h1>
    <p>${rsvps.length} RSVP(s)</p>
  </div>
  <div class="content">
    <div class="cards">
      ${statCard('Going', going, '#16a34a')}
      ${statCard('Waitlisted', waitlisted, '#d97706')}
      ${statCard('Attended', attended, '#1d4ed8')}
    </div>
    <h2>RSVPs</h2>
    ${
      rsvps.length
        ? `<table>
            <thead><tr><th>Member</th><th>Email</th><th>RSVP</th><th>Sessions</th><th>Attended</th><th>Business name</th><th>Industry</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>`
        : `<p class="meta">No RSVPs for this event.</p>`
    }
  </div>
</body>
</html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 250);
  },
};

const elements: PluginElementsModule = {
  slug: 'myconnect-community-admin',
  functions: { today, is_after, event_card_day, event_card_month, event_card_weekday_time },
  actions: { export_signups_csv, print_rsvp_report },
};
export default elements;
