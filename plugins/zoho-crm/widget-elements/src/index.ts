import type { ComputedFunction, PluginElementsModule } from './types';

type AnyRecord = Record<string, unknown>;

/**
 * Zoho CRM's default Deals pipeline, in order. Stages not listed here (custom
 * stages) sort after these, largest value first.
 */
const STAGE_ORDER = [
  'Qualification',
  'Needs Analysis',
  'Value Proposition',
  'Identify Decision Makers',
  'Id. Decision Makers',
  'Perception Analysis',
  'Proposal/Price Quote',
  'Negotiation/Review',
];

/**
 * Currency symbol prefix. USD shows as a bare `$` — a recorded decision to
 * match the Deal Pipeline Snapshot mock (see the tile's PR); other codes use
 * the platform's prefixed symbols.
 */
const SYMBOLS: Record<string, string> = {
  USD: '$', AUD: 'A$', NZD: 'NZ$', CAD: 'C$', GBP: '£', EUR: '€', INR: '₹', JPY: '¥',
};

function symbolFor(currency: unknown): string {
  const code = String(currency || 'USD').toUpperCase();
  return SYMBOLS[code] ?? `${code} `;
}

/** `$734,500` — whole units (deliberate 0dp, per the mock). */
function formatWhole(n: number, currency: unknown): string {
  return `${symbolFor(currency)}${Math.round(n).toLocaleString('en-US')}`;
}

/** `$268.5K`, `$1.2M`, `$950` — compact, at most one decimal, no trailing `.0`. */
function formatCompact(n: number, currency: unknown): string {
  const abs = Math.abs(n);
  const [div, unit] = abs >= 1e9 ? [1e9, 'B'] : abs >= 1e6 ? [1e6, 'M'] : abs >= 1e3 ? [1e3, 'K'] : [1, ''];
  const v = Math.round((n / div) * 10) / 10;
  return `${symbolFor(currency)}${v.toLocaleString('en-US', { maximumFractionDigits: 1 })}${unit}`;
}

/**
 * Decorative per-stage colour, by position in the pipeline (TILE-DISPLAY-STANDARDS
 * §10 categorical palette, led by the tile's brand blue). Not a status: no stage
 * is better or worse than another. Cycles if an org has more than six open stages.
 */
const STAGE_TONES = ['brand', 'chart-2', 'chart-1', 'chart-3', 'chart-4', 'chart-5'];

/**
 * Zoho writes `Proposal/Price Quote`; show `Proposal / Price Quote`. Its
 * abbreviated `Id. Decision Makers` value shows as the spelled-out stage name.
 */
function stageLabel(stage: string): string {
  if (stage === 'Id. Decision Makers') return 'Identify Decision Makers';
  return stage.replace(/\s*\/\s*/g, ' / ');
}

/**
 * Summarise open Zoho CRM deals (rows from `coql_query`) for the Deal Pipeline
 * Snapshot tile: total value, deal and stage counts, and one row per stage in
 * pipeline order with its value and bar width (percent of the largest stage).
 *
 * Args:
 *   value       — the COQL `data` array: `{ id, Deal_Name, Stage, Amount, Currency? }[]`
 *   moreRecords — COQL `info.more_records`; true when the 200-row limit cut the list
 *   currency    — fallback ISO code when a deal has no `Currency` (single-currency orgs)
 *   selected    — the expanded stage's `key` (`/ui/selectedStage`), or empty for none
 *
 * Spec: `{ "$computed": "zoho-crm_pipeline_snapshot_dashboard", "args": { "value": { "$state": "/zoho-crm/coql_query/data" }, "currency": "USD" } }`
 */
const pipeline_snapshot_dashboard: ComputedFunction = (args) => {
  const rows = Array.isArray(args.value) ? (args.value as AnyRecord[]) : [];
  const currency = rows.find((r) => typeof r.Currency === 'string' && r.Currency)?.Currency ?? args.currency;

  const byStage = new Map<string, { amount: number; count: number }>();
  let total = 0;
  for (const r of rows) {
    const stage = String(r.Stage ?? '').trim() || 'No stage';
    const amount = Number(r.Amount);
    const value = Number.isFinite(amount) ? amount : 0;
    const s = byStage.get(stage) ?? { amount: 0, count: 0 };
    s.amount += value;
    s.count += 1;
    byStage.set(stage, s);
    total += value;
  }

  const rank = (stage: string) => {
    const i = STAGE_ORDER.indexOf(stage);
    return i === -1 ? STAGE_ORDER.length : i;
  };
  const ordered = [...byStage.entries()].sort(
    ([a, x], [b, y]) => rank(a) - rank(b) || y.amount - x.amount,
  );
  const max = Math.max(0, ...ordered.map(([, s]) => s.amount));

  const dealCount = rows.length;
  const stageCount = ordered.length;
  const truncated = args.moreRecords === true;
  const selected = String(args.selected ?? '');
  return {
    totalDisplay: formatWhole(total, currency),
    dealCount,
    dealLabel: dealCount === 1 ? 'Deal' : 'Deals',
    stageCount,
    stageLabel: stageCount === 1 ? 'Stage' : 'Stages',
    stages: ordered.map(([stage, s], i) => ({
      key: stage,
      label: stageLabel(stage),
      count: s.count,
      pct: max > 0 ? Math.round((s.amount / max) * 100) : 0,
      amountDisplay: formatCompact(s.amount, currency),
      tone: STAGE_TONES[i % STAGE_TONES.length],
      expanded: stage === selected,
      // What a click on this row writes to `/ui/selectedStage`: open it, or close it if already open.
      toggleValue: stage === selected ? '' : stage,
      chevron: stage === selected ? 'ChevronDown' : 'ChevronRight',
    })),
    // The expanded stage's deals, largest first. Returned here rather than by a
    // second watch action: a watch stops its action list once one action writes state.
    openDeals: rows
      .filter((r) => selected && (String(r.Stage ?? '').trim() || 'No stage') === selected)
      .map((r) => ({ id: String(r.id ?? ''), name: String(r.Deal_Name ?? 'Untitled deal'), amount: Number(r.Amount) || 0 }))
      .sort((a, b) => b.amount - a.amount)
      .map((d) => ({ id: d.id, name: d.name, amountDisplay: formatCompact(d.amount, currency) })),
    truncated,
    coverageText: truncated ? `Showing the first ${dealCount} open deals` : '',
  };
};

/**
 * Lead status colours — a recorded decision to match the Lead Inbox mock (see
 * the tile's PR), which puts `Attempted to Contact` on `destructive` where
 * TILE-DISPLAY-STANDARDS §7 would use `info`. Statuses the mock doesn't show
 * follow §7. Unknown (custom) statuses fall back to `info`.
 */
const LEAD_STATUS_TONES: Record<string, string> = {
  'Not Contacted': 'warning',
  'Attempted to Contact': 'destructive',
  'Contacted': 'success',
  'Contact in Future': 'info',
  'Pre-Qualified': 'success',
  'Not Qualified': 'muted',
  'Lost Lead': 'muted',
  'Junk Lead': 'muted',
};

/**
 * Decorative avatar colours (§10 categorical); a name always gets the same one.
 * Brand blue stands in for pink `chart-4`, at the requester's preference.
 */
const AVATAR_TONES = ['chart-1', 'chart-2', 'chart-3', 'brand', 'chart-5'];

const MAX_LEAD_ROWS = 20;

function hashTone(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

function initialsOf(first: unknown, last: unknown, full: string): string {
  const f = String(first ?? '').trim();
  const l = String(last ?? '').trim();
  if (f || l) return `${f.charAt(0)}${l.charAt(0)}`.toUpperCase() || '·';
  const parts = full.split(/\s+/).filter(Boolean);
  return parts.map((p) => p.charAt(0)).slice(0, 2).join('').toUpperCase() || '·';
}

/** Local Monday 00:00 of the current week. */
function weekStart(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/** `2 days ago`, `1 day ago`, `5 hours ago` — spelled out, per the mock. */
function timeAgo(ms: number, now: number): string {
  const min = Math.floor((now - ms) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} ${min === 1 ? 'minute' : 'minutes'} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ${hr === 1 ? 'hour' : 'hours'} ago`;
  const day = Math.floor(hr / 24);
  return `${day} ${day === 1 ? 'day' : 'days'} ago`;
}

/**
 * This week's new Zoho CRM leads (rows from `coql_query`, newest first) for the
 * Lead Inbox tile: how many still await first contact, the week's total, and
 * up to 20 display-ready rows. "This week" is Monday 00:00 local time to now.
 *
 * Args:
 *   value       — the COQL `data` array: `{ id, Full_Name, First_Name, Last_Name, Company, Lead_Source, Lead_Status, Created_Time }[]`
 *   moreRecords — COQL `info.more_records`; true when the 200-row limit cut the list
 *
 * Spec: `{ "$computed": "zoho-crm_lead_inbox_dashboard", "args": { "value": { "$state": "/zoho-crm/coql_query/data" } } }`
 */
const lead_inbox_dashboard: ComputedFunction = (args) => {
  const rows = Array.isArray(args.value) ? (args.value as AnyRecord[]) : [];
  const now = Date.now();
  const since = weekStart(new Date(now)).getTime();

  const week = rows
    .map((r) => ({ r, ms: Date.parse(String(r.Created_Time ?? '')) }))
    .filter(({ ms }) => Number.isFinite(ms) && ms >= since)
    .sort((a, b) => b.ms - a.ms);

  const total = week.length;
  const awaitingCount = week.filter(({ r }) => r.Lead_Status === 'Not Contacted').length;
  // Every fetched row is from this week and Zoho has more: the week's count is a floor.
  const cutBySource = args.moreRecords === true && total === rows.length && total > 0;
  const shown = week.slice(0, MAX_LEAD_ROWS);

  const leads = shown.map(({ r, ms }) => {
    const name = String(r.Full_Name ?? '').trim() || 'Unnamed lead';
    const status = String(r.Lead_Status ?? '').trim();
    return {
      id: String(r.id ?? name),
      name,
      initials: initialsOf(r.First_Name, r.Last_Name, name),
      avatarTone: hashTone(name),
      meta: [r.Company, r.Lead_Source].map((v) => String(v ?? '').trim()).filter(Boolean).join(' · '),
      statusLabel: status || 'No Status',
      statusTone: status ? (LEAD_STATUS_TONES[status] ?? 'info') : 'muted',
      when: timeAgo(ms, now),
    };
  });

  const truncated = cutBySource || total > shown.length;
  return {
    awaitingCount,
    heroCaption: `Awaiting first contact · ${total}${cutBySource ? '+' : ''} total ${total === 1 ? 'lead' : 'leads'} this week`,
    leads,
    truncated,
    coverageText: truncated ? `Showing ${shown.length} of ${total}${cutBySource ? '+' : ''} leads this week` : '',
  };
};

const elements: PluginElementsModule = {
  slug: 'zoho-crm',
  functions: {
    pipeline_snapshot_dashboard,
    lead_inbox_dashboard,
  },
};

export default elements;
