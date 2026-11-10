import type { ComputedFunction, PluginElementsModule } from './types';

type AnyRecord = Record<string, unknown>;

/** Age groups the Pending Signatures tile shows, in row order. `max` is the last day count in the group. */
const AGE_GROUPS = [
  { id: 'fresh', label: '0–2 days pending', tone: 'chart-3', countTone: 'default', max: 2 },
  { id: 'aging', label: '3–5 days pending', tone: 'warning', countTone: 'default', max: 5 },
  { id: 'overdue', label: '6+ days — overdue', tone: 'destructive', countTone: 'destructive', max: Infinity },
] as const;
type AgeGroupId = (typeof AGE_GROUPS)[number]['id'];

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DOC_ROWS = 20;
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Signer actions that still need doing; everything else (SIGNED, APPROVED, …) is finished. */
const DONE_ACTION = new Set(['SIGNED', 'APPROVED', 'VIEWED_AND_SIGNED', 'DECLINED']);

/** "05-Nov-26" in the viewer's time zone. */
function ddMmmYy(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}-${MONTH_ABBR[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
}

/** Local midnight of an epoch-ms time. */
function startOfDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Zoho Sign returns times as epoch milliseconds (number or numeric string). */
function toDate(v: unknown): Date | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : /^\d+$/.test(String(v)) ? Number(v) : Date.parse(String(v));
  const d = new Date(n);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The `requests` array, whether the tool returns Zoho's body as-is or wrapped in `data`. */
function requestList(report: AnyRecord): AnyRecord[] | null {
  if (Array.isArray(report.requests)) return report.requests as AnyRecord[];
  const data = report.data as AnyRecord | undefined;
  if (data && Array.isArray(data.requests)) return data.requests as AnyRecord[];
  if (Array.isArray(report.data)) return report.data as AnyRecord[];
  return null;
}

/** First signer still to act, in signing order. */
function nextSigner(r: AnyRecord): string {
  const actions = (Array.isArray(r.actions) ? r.actions : []) as AnyRecord[];
  const waiting = actions
    .filter((a) => !DONE_ACTION.has(String(a.action_status ?? '').toUpperCase()))
    .filter((a) => String(a.action_type ?? 'SIGN').toUpperCase() !== 'VIEW')
    .sort((a, b) => (Number(a.signing_order) || 0) - (Number(b.signing_order) || 0));
  const a = waiting[0];
  if (!a) return '';
  return String(a.recipient_name ?? '').trim() || String(a.recipient_email ?? '').trim();
}

/**
 * Display-ready state for the Pending Signatures tile, from `list_requests`.
 * Keeps requests still in progress, ages each from when it was sent
 * (`sign_submitted_time`, else `created_time`) and groups them as 0–2 days,
 * 3–5 days or 6+ days overdue. `selected` is the group whose documents show
 * under its row.
 *
 * Spec: `{ "$computed": "zoho-sign_pending_signatures_dashboard", "args": { "report": { "$state": "/zoho-sign/list_requests" }, "selected": { "$state": "/ui/signBucket" } } }`
 */
const pending_signatures_dashboard: ComputedFunction = (args) => {
  // The MCP passes Zoho API failures (expired token, bad request) back as a plain error string.
  if (typeof args.report === 'string' && args.report.trim()) return { loaded: false, failed: true, hasData: false };
  const report = (args.report && typeof args.report === 'object' ? args.report : {}) as AnyRecord;
  const list = requestList(report);
  const loaded = list !== null;
  const all = list ?? [];
  const selected = typeof args.selected === 'string' ? args.selected : '';
  const now = Date.now();

  const pending = all
    .filter((r) => String(r.request_status ?? '').toLowerCase() === 'inprogress')
    .map((r) => {
      const sent = toDate(r.sign_submitted_time) ?? toDate(r.created_time);
      // Calendar days in the viewer's time zone, so "sent yesterday" reads 1 day even under 24 hours.
      const days = sent ? Math.max(0, Math.round((startOfDay(now) - startOfDay(sent.getTime())) / DAY_MS)) : 0;
      const group = AGE_GROUPS.find((g) => days <= g.max)!;
      return { r, sent, days, group };
    })
    // Longest waiting first.
    .sort((a, b) => b.days - a.days);

  const counts: Record<AgeGroupId, number> = { fresh: 0, aging: 0, overdue: 0 };
  for (const p of pending) counts[p.group.id] += 1;
  const total = pending.length;

  const inGroup = selected ? pending.filter((p) => p.group.id === selected) : [];
  const selectedDocs = inGroup.slice(0, MAX_DOC_ROWS).map(({ r, sent, days, group }) => {
    const signer = nextSigner(r);
    return {
      id: String(r.request_id ?? r.request_name ?? Math.random()),
      name: String(r.request_name ?? '').trim() || 'Untitled document',
      detail: [signer ? `Awaiting ${signer}` : 'Awaiting signer', sent ? `sent ${ddMmmYy(sent)}` : ''].filter(Boolean).join(' · '),
      ageText: days === 0 ? 'Today' : days === 1 ? '1 day' : `${days} days`,
      tone: group.tone,
      badgeTone: group.id === 'overdue' ? 'destructive' : group.id === 'aging' ? 'warning' : 'muted',
    };
  });

  const pageContext = (report.page_context ?? (report.data as AnyRecord | undefined)?.page_context) as AnyRecord | undefined;

  return {
    loaded,
    hasData: total > 0,
    totalDisplay: total.toLocaleString('en-US'),
    totalLabel: total === 1 ? 'document waiting on a signer' : 'documents waiting on a signer',
    rows: AGE_GROUPS.map((g) => ({
      id: g.id,
      label: g.label,
      tone: g.tone,
      countTone: counts[g.id] > 0 ? g.countTone : 'default',
      countDisplay: counts[g.id].toLocaleString('en-US'),
      expanded: g.id === selected,
      chevron: g.id === selected ? 'ChevronUp' : 'ChevronDown',
      // What a click on this row writes to `/ui/signBucket`.
      toggle: g.id === selected ? '' : g.id,
    })),
    selectedDocs,
    selectedEmpty: !!selected && selectedDocs.length === 0,
    selectedNote:
      inGroup.length > selectedDocs.length
        ? `Showing ${selectedDocs.length} of ${inGroup.length.toLocaleString('en-US')} documents, longest waiting first.`
        : '',
    capNote: pageContext?.has_more_rows === true ? `Based on the newest ${all.length.toLocaleString('en-US')} signature requests.` : '',
  };
};

const elements: PluginElementsModule = {
  slug: 'zoho-sign',
  functions: {
    pending_signatures_dashboard,
  },
  actions: {},
};

export default elements;
