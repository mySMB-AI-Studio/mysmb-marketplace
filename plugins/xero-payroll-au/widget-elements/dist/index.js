/**
 * xero-payroll-au — widget-elements module
 * ──────────────────────────────────────────────────────────────────
 * Connector-specific `$computed` helpers contributed to the host's
 * widgets-system at runtime. The host prepends the slug `xero-payroll-au_`
 * to every name in `functions`, so e.g. the spec-side reference is
 * `xero-payroll-au_fortnightly_pay_run_rows`.
 */
function toEpochMs(raw) {
    if (raw == null)
        return null;
    if (typeof raw === 'number')
        return raw;
    if (typeof raw !== 'string')
        return null;
    const m = raw.match(/\/Date\((-?\d+)([+-]\d{4})?\)\//);
    if (m)
        return Number(m[1]);
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : null;
}
// TILE-DISPLAY-STANDARDS.md §3: never show a raw connector enum straight —
// Title Case the Xero PayRunStatus string (e.g. "POSTED" → "Posted") rather
// than the raw SCREAMING_CASE. Tone alone (statusTone) only controls color.
function titleCase(raw) {
    if (!raw)
        return '';
    return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}
function formatShortDate(raw) {
    const ms = toEpochMs(raw);
    if (ms == null)
        return '—';
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
const format_dollars = (args) => {
    const raw = args.value;
    if (raw == null || raw === '')
        return '';
    const num = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(num))
        return String(raw);
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
// PayRunStatus is a real binary-ish status (TILE-DISPLAY-STANDARDS.md §7's
// restraint model applies) — POSTED means the pay run is finalized and paid
// out, a genuine "done" state (success); DRAFT/anything else is a real
// pending action item still awaiting review/posting (warning), not a
// no-news-is-good-news default.
function statusTone(status) {
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
const fortnightly_pay_run_rows = (args) => {
    const payRuns = Array.isArray(args.payRuns) ? args.payRuns : [];
    const calendars = Array.isArray(args.payrollCalendars) ? args.payrollCalendars : [];
    const fortnightlyCalendarIds = new Set(calendars
        .filter((c) => String(c.CalendarType ?? '').toUpperCase() === 'FORTNIGHTLY')
        .map((c) => c.PayrollCalendarID));
    return payRuns
        .filter((r) => fortnightlyCalendarIds.has(r.PayrollCalendarID))
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
        status: titleCase(r.PayRunStatus || 'DRAFT'),
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
const pay_run_breakdown = (args) => {
    const rows = Array.isArray(args.rows) ? args.rows : [];
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
const elements = {
    slug: 'xero-payroll-au',
    functions: {
        fortnightly_pay_run_rows,
        pay_run_breakdown,
        format_dollars,
    },
};
export default elements;
