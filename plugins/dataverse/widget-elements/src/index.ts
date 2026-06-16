/**
 * dataverse — widget-elements module
 *
 * Helpers tailored to Dataverse OData payload shapes:
 *  - Opportunity `salesstagecode` is a global option-set int. The
 *    default ships with four stages (Qualify=0, Develop=1, Propose=2,
 *    Close=3). Tenants can extend it — for v1 we hardcode the
 *    defaults; a future helper can call `describe_picklist` to fetch
 *    the tenant's actual labels.
 *  - `estimatedvalue` is a money column (number) and
 *    `closeprobability` is an int 0-100 — weighted forecast is
 *    `estimatedvalue * closeprobability / 100`.
 *  - `customerid_account` arrives as a nested object when fetched
 *    with `$expand=customerid_account($select=name)`.
 */

import type { ComputedFunction, PluginElementsModule } from './types.js';

// ── Stage labels ────────────────────────────────────────────────────
//
// Default D365 Sales `salesstagecode` option-set values. Tone palette
// mirrors the AR-aging pattern from xero-accounting: more advanced
// stages get warmer tones culminating in success at close.

const STAGE_ORDER: ReadonlyArray<number> = [0, 1, 2, 3];

const STAGE_LABELS: Record<number, { label: string; tone: string }> = {
  0: { label: 'Qualify', tone: 'muted' },
  1: { label: 'Develop', tone: 'info' },
  2: { label: 'Propose', tone: 'warning' },
  3: { label: 'Close', tone: 'success' },
};

interface OpportunityRow {
  opportunityid?: string;
  name?: string;
  estimatedvalue?: number;
  closeprobability?: number;
  estimatedclosedate?: string;
  salesstagecode?: number;
  statecode?: number;
  customerid_account?: { name?: string; accountid?: string };
}

function asOppArray(value: unknown): OpportunityRow[] {
  return Array.isArray(value) ? (value as OpportunityRow[]) : [];
}

function weightedValueOf(op: OpportunityRow): number {
  const v = Number(op.estimatedvalue ?? 0);
  const p = Number(op.closeprobability ?? 0);
  if (!Number.isFinite(v) || !Number.isFinite(p)) return 0;
  return v * (p / 100);
}

// ── pipeline_stages ─────────────────────────────────────────────────
//
// Group opportunities by `salesstagecode` into the four default
// stages and return a fixed-order array so the widget can render a
// stable shape — even buckets with zero opportunities are emitted so
// the layout doesn't flicker as deals move.
//
// Args: { value: Opportunity[] }
// Returns: Array<{ key, code, count, total, weighted, tone }>

const pipeline_stages: ComputedFunction = (args) => {
  const opps = asOppArray(args.value);
  const buckets = new Map<number, { count: number; total: number; weighted: number }>();
  for (const code of STAGE_ORDER) {
    buckets.set(code, { count: 0, total: 0, weighted: 0 });
  }
  for (const op of opps) {
    const code = typeof op.salesstagecode === 'number' ? op.salesstagecode : 0;
    if (!buckets.has(code)) buckets.set(code, { count: 0, total: 0, weighted: 0 });
    const b = buckets.get(code)!;
    b.count += 1;
    b.total += Number(op.estimatedvalue ?? 0) || 0;
    b.weighted += weightedValueOf(op);
  }
  return STAGE_ORDER.map((code) => {
    const b = buckets.get(code)!;
    const meta = STAGE_LABELS[code] ?? { label: `Stage ${code}`, tone: 'muted' };
    return {
      key: meta.label,
      code,
      count: b.count,
      total: b.total,
      weighted: b.weighted,
      tone: meta.tone,
    };
  });
};

// ── ops_in_stage ────────────────────────────────────────────────────
//
// Filter the opportunity list down to a single stage. We accept the
// stage *label* (e.g. "Qualify") rather than the numeric code so the
// widget's `selectedStage` state can stay human-readable.
//
// Args: { value: Opportunity[], stage: string }

const ops_in_stage: ComputedFunction = (args) => {
  const opps = asOppArray(args.value);
  const wanted = typeof args.stage === 'string' ? args.stage : '';
  if (!wanted) return [];
  const entry = Object.entries(STAGE_LABELS).find(([, v]) => v.label === wanted);
  if (!entry) return [];
  const code = Number(entry[0]);
  return opps.filter((op) => Number(op.salesstagecode ?? 0) === code);
};

// ── weighted ────────────────────────────────────────────────────────
//
// Compute the weighted value of one opportunity: estimated value
// scaled by the close probability percentage. Used inline so each
// opportunity row can show its own forecast contribution.
//
// Args: { value: number, probability: number (0-100) }

const weighted: ComputedFunction = (args) => {
  const v = Number(args.value ?? 0);
  const p = Number(args.probability ?? 0);
  if (!Number.isFinite(v) || !Number.isFinite(p)) return 0;
  return v * (p / 100);
};

// ── close_label ─────────────────────────────────────────────────────
//
// Friendly relative-time label for an estimated close date:
//   "closes today" / "closes in 14d" / "14d past due" / "no date"
// Mirrors the spirit of the xero-accounting overdue_label helper.
//
// Args: { value: string | undefined } — ISO date

const close_label: ComputedFunction = (args) => {
  const raw = args.value;
  if (!raw || typeof raw !== 'string') return 'no date';
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return 'no date';
  const day = 24 * 60 * 60 * 1000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(ms);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / day);
  if (diff === 0) return 'closes today';
  if (diff > 0) return `closes in ${diff}d`;
  return `${-diff}d past due`;
};

// ── close_tone ──────────────────────────────────────────────────────
//
// Tone for a close-date badge — flags slipping deals visually.
//
// Args: { value: string | undefined } — ISO date

const close_tone: ComputedFunction = (args) => {
  const raw = args.value;
  if (!raw || typeof raw !== 'string') return 'muted';
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return 'muted';
  const day = 24 * 60 * 60 * 1000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(ms);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / day);
  if (diff < 0) return 'destructive';
  if (diff <= 7) return 'warning';
  return 'muted';
};

// ── task_overdue_count ───────────────────────────────────────────────
//
// Count tasks where scheduledend is in the past (overdue).
//
// Args: { value: unknown[] }

const task_overdue_count: ComputedFunction = (args) => {
  const tasks = Array.isArray(args.value)
    ? (args.value as Array<Record<string, unknown>>)
    : [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return tasks.filter((t) => {
    const due = t.scheduledend;
    if (!due || typeof due !== 'string') return false;
    const d = new Date(due);
    return !isNaN(d.getTime()) && d < today;
  }).length;
};

// ── task_priority_label ──────────────────────────────────────────────
//
// Human-readable priority label from Dataverse task prioritycode.
// Widget spec: 1=High, 2=Normal, 3=Low.
//
// Args: { value: number }

const task_priority_label: ComputedFunction = (args) => {
  const code = Number(args.value);
  if (code === 1) return 'High';
  if (code === 2) return 'Normal';
  if (code === 3) return 'Low';
  return '';
};

// ── task_priority_tone ───────────────────────────────────────────────
//
// Tone badge colour for task priority.
// 1=High → destructive, 2=Normal → muted, 3=Low → info.
//
// Args: { value: number }

const task_priority_tone: ComputedFunction = (args) => {
  const code = Number(args.value);
  if (code === 1) return 'destructive';
  if (code === 3) return 'info';
  return 'muted';
};

// ── account_risk_label ───────────────────────────────────────────────
//
// Risk label based on days since modifiedon:
//   ≥30 days → "At Risk", ≥14 days → "Warning", else "".
//
// Args: { value: string | undefined } — ISO datetime (modifiedon)

const account_risk_label: ComputedFunction = (args) => {
  const raw = args.value;
  if (!raw || typeof raw !== 'string') return '';
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return '';
  const daysSince = Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000));
  if (daysSince >= 30) return 'At Risk';
  if (daysSince >= 14) return 'Warning';
  return '';
};

// ── account_risk_tone ────────────────────────────────────────────────
//
// Tone for the account risk badge.
//   ≥30 days → destructive, ≥14 days → warning, else muted.
//
// Args: { value: string | undefined } — ISO datetime (modifiedon)

const account_risk_tone: ComputedFunction = (args) => {
  const raw = args.value;
  if (!raw || typeof raw !== 'string') return 'muted';
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return 'muted';
  const daysSince = Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000));
  if (daysSince >= 30) return 'destructive';
  if (daysSince >= 14) return 'warning';
  return 'muted';
};

// ── activity_type_icon ───────────────────────────────────────────────
//
// Lucide icon name for a Dataverse activitytypecode string.
//
// Args: { value: string | undefined }

const activity_type_icon: ComputedFunction = (args) => {
  switch (String(args.value ?? '').toLowerCase()) {
    case 'email':       return 'Mail';
    case 'phonecall':   return 'Phone';
    case 'task':        return 'CheckSquare';
    case 'appointment': return 'Calendar';
    case 'letter':      return 'FileText';
    case 'fax':         return 'Printer';
    default:            return 'Activity';
  }
};

// ── qa_grade_tone ────────────────────────────────────────────────────
//
// Tone for a QA grade badge.
// PASS → success, NEEDS COACHING → warning, FAIL → destructive.
//
// Args: { value: string | undefined }

const qa_grade_tone: ComputedFunction = (args) => {
  const grade = String(args.value ?? '').toUpperCase();
  if (grade === 'PASS') return 'success';
  if (grade === 'NEEDS COACHING') return 'warning';
  if (grade === 'FAIL') return 'destructive';
  return 'muted';
};

// ── qa_score_tone ────────────────────────────────────────────────────
//
// Tone for a QA numeric score badge.
// ≥80 → success, ≥60 → warning, <60 → destructive.
//
// Args: { value: number | undefined }

const qa_score_tone: ComputedFunction = (args) => {
  const score = Number(args.value ?? 0);
  if (score >= 80) return 'success';
  if (score >= 60) return 'warning';
  return 'destructive';
};

const elements: PluginElementsModule = {
  slug: 'dataverse',
  functions: {
    pipeline_stages,
    ops_in_stage,
    weighted,
    close_label,
    close_tone,
    task_overdue_count,
    task_priority_label,
    task_priority_tone,
    account_risk_label,
    account_risk_tone,
    activity_type_icon,
    qa_grade_tone,
    qa_score_tone,
  },
};

export default elements;
