/**
 * xero-payroll-au — widget-elements module
 * ──────────────────────────────────────────────────────────────────
 * Connector-specific `$computed` helpers contributed to the host's
 * widgets-system at runtime. The host prepends the slug `xero-payroll-au_`
 * to every name in `functions`, so e.g. the spec-side reference is
 * `xero-payroll-au_fortnightly_pay_run_rows`.
 */

import type { ComputedFunction, PluginElementsModule } from './types';

function toEpochMs(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') return raw;
  if (typeof raw !== 'string') return null;
  const m = raw.match(/\/Date\((-?\d+)([+-]\d{4})?\)\//);
  if (m) return Number(m[1]);
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

// TILE-DISPLAY-STANDARDS.md §3: never show a raw connector enum straight —
// Title Case the Xero PayRunStatus string (e.g. "POSTED" → "Posted") rather
// than the raw SCREAMING_CASE. Tone alone (statusTone) only controls color.
function titleCase(raw: string): string {
  if (!raw) return '';
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

function formatShortDate(raw: unknown): string {
  const ms = toEpochMs(raw);
  if (ms == null) return '—';
  return new Date(ms).toLocaleDateString(undefined, { year: '2-digit', month: 'short', day: 'numeric' });
}

/**
 * Formats a number as a plain "$1,234.56" — no locale currency prefix.
 * The system's own `format_currency` uses `Intl.NumberFormat('en-US', {
 * style: 'currency', currency: 'AUD' })`, which renders "A$1,234.56" (the
 * standard AUD/USD disambiguation prefix for the en-US locale). Since this
 * connector is AU-only by definition, that disambiguation is redundant
 * here — a plain "$" is unambiguous and was requested explicitly.
 *
 * Args: { value: number }
 *
 * Spec example:
 *   { "$computed": "xero-payroll-au_format_dollars", "args": { "value": { "$item": "wages" } } }
 */
const format_dollars: ComputedFunction = (args) => {
  const raw = args.value;
  if (raw == null || raw === '') return '';
  const num = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(num)) return String(raw);
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// PayRunStatus is a real binary-ish status (TILE-DISPLAY-STANDARDS.md §7's
// restraint model applies) — POSTED means the pay run is finalized and paid
// out, a genuine "done" state (success); DRAFT/anything else is a real
// pending action item still awaiting review/posting (warning), not a
// no-news-is-good-news default.
function statusTone(status: unknown): string {
  return String(status ?? '').toUpperCase() === 'POSTED' ? 'success' : 'warning';
}

/**
 * Flattens a `list_pay_runs` response, filtered to only the pay runs whose
 * `PayrollCalendarID` belongs to a FORTNIGHTLY calendar — resolved from a
 * `list_payroll_calendars` response rather than hardcoding any specific
 * calendar ID, since that ID is org-specific and differs per Xero
 * organisation. Ranked most-recent pay period first.
 *
 * Args: { payRuns: array, payrollCalendars: array }
 * Returns: array of { id, periodStart, periodEnd, paymentDate, wages, tax,
 *                      superAmount, deductions, netPay, status, statusTone }
 *
 * Spec example:
 *   {
 *     "$computed": "xero-payroll-au_fortnightly_pay_run_rows",
 *     "args": {
 *       "payRuns": { "$state": "/xero-payroll-au/list_pay_runs/PayRuns" },
 *       "payrollCalendars": { "$state": "/xero-payroll-au/list_payroll_calendars/PayrollCalendars" }
 *     }
 *   }
 */
const fortnightly_pay_run_rows: ComputedFunction = (args) => {
  const payRuns = Array.isArray(args.payRuns) ? (args.payRuns as Record<string, unknown>[]) : [];
  const calendars = Array.isArray(args.payrollCalendars) ? (args.payrollCalendars as Record<string, unknown>[]) : [];

  const fortnightlyCalendarIds = new Set(
    calendars
      .filter((c) => String(c.CalendarType ?? '').toUpperCase() === 'FORTNIGHTLY')
      .map((c) => c.PayrollCalendarID as string),
  );

  return payRuns
    .filter((r) => fortnightlyCalendarIds.has(r.PayrollCalendarID as string))
    .sort((a, b) => (toEpochMs(b.PayRunPeriodEndDate) ?? 0) - (toEpochMs(a.PayRunPeriodEndDate) ?? 0))
    .map((r) => ({
      id: r.PayRunID,
      periodStart: formatShortDate(r.PayRunPeriodStartDate),
      periodEnd: formatShortDate(r.PayRunPeriodEndDate),
      paymentDate: formatShortDate(r.PaymentDate),
      wages: Number(r.Wages) || 0,
      tax: Number(r.Tax) || 0,
      superAmount: Number(r.Super) || 0,
      deductions: Number(r.Deductions) || 0,
      netPay: Number(r.NetPay) || 0,
      status: titleCase((r.PayRunStatus as string) || 'DRAFT'),
      statusTone: statusTone(r.PayRunStatus),
    }));
};

/**
 * Groups fortnightly pay-run rows (from `fortnightly_pay_run_rows`) into a
 * Posted/Draft breakdown bar, reading each row's already-assigned
 * `statusTone` rather than re-deriving it, so the bar always agrees with
 * each row's own badge.
 *
 * Args: { rows: array }
 * Returns: { total, segments: [{ status, count, tone }], template }
 *
 * Spec example:
 *   {
 *     "$computed": "xero-payroll-au_pay_run_breakdown",
 *     "args": { "rows": { "$state": "/ui/rows" } }
 *   }
 */
const pay_run_breakdown: ComputedFunction = (args) => {
  const rows = Array.isArray(args.rows) ? (args.rows as Record<string, unknown>[]) : [];

  const posted = rows.filter((r) => r.statusTone === 'success').length;
  const draft = rows.length - posted;

  const segments = [
    { status: 'Posted', count: posted, tone: 'success' },
    { status: 'Draft', count: draft, tone: 'warning' },
  ].filter((s) => s.count > 0);

  return {
    total: rows.length,
    segments,
    template: segments.length ? segments.map((s) => `${s.count}fr`).join(' ') : '1fr',
  };
};

// get_timesheet_approval_check's per-employee `category` (structural:
// where the employee's data is present) combined with its two independent
// exception flags `notApproved`/`hasVariance` (only meaningful within
// category "both") into a single display label/tone/icon. An employee can
// be not-approved AND have a variance at the same time (e.g. a Draft
// timesheet whose hours also don't match an already-built payslip) — both
// must show, not just whichever was checked first, so this combines them
// into one label (e.g. "Not approved · 38h variance") rather than picking
// one. "no_timesheet" (salaried, nothing to check) deliberately reads as
// muted/neutral, not success — it isn't a passed check, it's not
// applicable.
interface CheckRowArgs {
  category?: unknown;
  notApproved?: unknown;
  hasVariance?: unknown;
  variance?: unknown;
}

const NON_BOTH_META: Record<string, { label: string; tone: string; icon: string }> = {
  missing_from_payroll: { label: 'Missing from payroll', tone: 'warning', icon: 'AlertTriangle' },
  paid_without_timesheet: { label: 'Paid without timesheet', tone: 'destructive', icon: 'AlertTriangle' },
  no_timesheet: { label: 'N/A (salaried)', tone: 'muted', icon: 'Minus' },
};

function checkRowMeta(args: CheckRowArgs): { label: string; tone: string; icon: string } {
  const category = String(args.category ?? '');
  if (category !== 'both') {
    return NON_BOTH_META[category] ?? { label: category || 'Unknown', tone: 'muted', icon: 'HelpCircle' };
  }
  const notApproved = Boolean(args.notApproved);
  const hasVariance = Boolean(args.hasVariance);
  const variance = Number(args.variance ?? 0);
  const varianceLabel = `${Math.abs(variance)}h variance`;

  if (notApproved && hasVariance) return { label: `Not approved · ${varianceLabel}`, tone: 'destructive', icon: 'AlertTriangle' };
  if (hasVariance) return { label: varianceLabel, tone: 'destructive', icon: 'AlertTriangle' };
  if (notApproved) return { label: 'Not approved', tone: 'warning', icon: 'Clock' };
  return { label: 'Match', tone: 'success', icon: 'CheckCircle2' };
}

/** Args: { category, notApproved, hasVariance, variance } — one employee row. */
const check_row_label: ComputedFunction = (args) => checkRowMeta(args).label;

/** Args: { category, notApproved, hasVariance, variance } — one employee row. */
const check_row_tone: ComputedFunction = (args) => checkRowMeta(args).tone;

/** Args: { category, notApproved, hasVariance, variance } — one employee row. */
const check_row_icon: ComputedFunction = (args) => checkRowMeta(args).icon;

/**
 * Title-cases a raw connector enum (e.g. Xero's PayRunStatus "DRAFT" →
 * "Draft") — TILE-DISPLAY-STANDARDS.md §3 never shows a raw SCREAMING_CASE
 * enum straight. Exported standalone (the existing private `titleCase`
 * above only serves `fortnightly_pay_run_rows`) for any tile that needs to
 * display a raw status string directly, e.g. get_timesheet_approval_check's
 * `payRun.status`, which isn't pre-labeled server-side.
 *
 * Args: { value: string }
 */
const title_case: ComputedFunction = (args) => titleCase(String(args.value ?? ''));

interface ReadinessPendingLeave {
  title?: string;
  requestedUnits?: number;
  currentBalance?: number;
  exceedsBalance?: boolean;
}
interface ReadinessEmployee {
  employeeId?: string;
  name?: string;
  isTerminated?: boolean;
  ready?: boolean;
  missingFields?: string[];
  hasBalanceConflict?: boolean;
  pendingLeave?: ReadinessPendingLeave[];
}

/**
 * Flattens get_payroll_readiness_check's per-employee output into rows for
 * the system Table component. Table cells are single-line by design (see
 * the Reconciliation tile fix this session), so missing fields and
 * pending-leave detail are each combined into one readable summary string
 * per employee rather than split into separate columns per issue.
 *
 * Args: { employees: array }
 * Returns: array of { id, name, employmentType, statusLabel, issuesSummary }
 */
const payroll_readiness_rows: ComputedFunction = (args) => {
  const employees = Array.isArray(args.employees) ? (args.employees as ReadinessEmployee[]) : [];

  return employees.map((e) => {
    const missing = e.missingFields ?? [];
    const pending = e.pendingLeave ?? [];

    const statusLabel = e.hasBalanceConflict ? 'Balance conflict' : e.ready ? 'Ready' : 'Needs attention';

    const parts: string[] = [];
    if (missing.length) parts.push(`Missing: ${missing.join(', ')}`);
    if (pending.length) {
      const pendingText = pending
        .map((p) => {
          const flag = p.exceedsBalance ? ' — exceeds balance' : '';
          return `${p.title ?? 'Leave'} ${p.requestedUnits ?? 0}h (balance ${p.currentBalance ?? 0}h)${flag}`;
        })
        .join('; ');
      parts.push(`Pending: ${pendingText}`);
    }

    return {
      id: e.employeeId ?? '',
      name: e.name || 'Unknown employee',
      employmentType: e.isTerminated ? 'Terminated' : 'Active',
      statusLabel,
      issuesSummary: parts.length ? parts.join(' · ') : 'No issues',
    };
  });
};

// Compares get_super_contribution_summary's totalAccrued (payroll side)
// against get_account_movement's movement (balance-sheet side, the same
// liability account's actual GL movement for the same calendar-month
// window) -- a real binary-ish status (TILE-DISPLAY-STANDARDS.md §7's
// restraint model applies): "success" when they match within a cent
// (rounding), a genuine "done" state; "destructive" for a real mismatch
// that needs investigation, not a no-news-is-good-news default; "muted"
// only when the liability account itself couldn't be matched on the
// balance sheet at all (a setup problem, not a reconciliation result).
interface SuperStatusArgs {
  totalAccrued?: unknown;
  movement?: unknown;
  accountFound?: unknown;
  accountName?: unknown;
}

const super_reconciliation_status: ComputedFunction = (args: SuperStatusArgs) => {
  const totalAccrued = Math.round((Number(args.totalAccrued) || 0) * 100) / 100;
  const movement = Math.round((Number(args.movement) || 0) * 100) / 100;
  const accountFound = Boolean(args.accountFound);
  const accountName = typeof args.accountName === 'string' ? args.accountName : null;
  const difference = Math.round((movement - totalAccrued) * 100) / 100;
  const isMatch = accountFound && Math.abs(difference) < 0.01;

  return {
    accountName,
    accountFound,
    totalAccrued,
    movement,
    difference,
    matchLabel: !accountFound ? 'Account not found' : isMatch ? 'Reconciled' : 'Mismatch',
    matchTone: !accountFound ? 'muted' : isMatch ? 'success' : 'destructive',
  };
};

const elements: PluginElementsModule = {
  slug: 'xero-payroll-au',
  functions: {
    fortnightly_pay_run_rows,
    pay_run_breakdown,
    format_dollars,
    check_row_label,
    check_row_tone,
    check_row_icon,
    title_case,
    payroll_readiness_rows,
    super_reconciliation_status,
  },
};

export default elements;
