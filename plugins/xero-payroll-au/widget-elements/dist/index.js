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
const NON_BOTH_META = {
    missing_from_payroll: { label: 'Missing from payroll', tone: 'warning', icon: 'AlertTriangle' },
    paid_without_timesheet: { label: 'Paid without timesheet', tone: 'destructive', icon: 'AlertTriangle' },
    // get_hours_reconciliation only: an hourly employee (a real rate-based
    // earnings line) with no timesheet and zero hours this period -- a real
    // gap, not the same neutral "nothing to check" state as no_timesheet.
    // Caught live: this was previously indistinguishable from a salaried
    // employee because both had zero unit-based payroll hours.
    missing_timesheet: { label: 'No timesheet · 0h', tone: 'warning', icon: 'AlertTriangle' },
    no_timesheet: { label: 'N/A (salaried)', tone: 'muted', icon: 'Minus' },
};
function checkRowMeta(args) {
    const category = String(args.category ?? '');
    if (category !== 'both') {
        return NON_BOTH_META[category] ?? { label: category || 'Unknown', tone: 'muted', icon: 'HelpCircle' };
    }
    const notApproved = Boolean(args.notApproved);
    const hasVariance = Boolean(args.hasVariance);
    const variance = Number(args.variance ?? 0);
    const varianceLabel = `${Math.abs(variance)}h variance`;
    if (notApproved && hasVariance)
        return { label: `Not approved · ${varianceLabel}`, tone: 'destructive', icon: 'AlertTriangle' };
    if (hasVariance)
        return { label: varianceLabel, tone: 'destructive', icon: 'AlertTriangle' };
    if (notApproved)
        return { label: 'Not approved', tone: 'warning', icon: 'Clock' };
    return { label: 'Match', tone: 'success', icon: 'CheckCircle2' };
}
/** Args: { category, notApproved, hasVariance, variance } — one employee row. */
const check_row_label = (args) => checkRowMeta(args).label;
/** Args: { category, notApproved, hasVariance, variance } — one employee row. */
const check_row_tone = (args) => checkRowMeta(args).tone;
/** Args: { category, notApproved, hasVariance, variance } — one employee row. */
const check_row_icon = (args) => checkRowMeta(args).icon;
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
const title_case = (args) => titleCase(String(args.value ?? ''));
function hoursReconRowMeta(args) {
    const category = String(args.category ?? '');
    if (category !== 'both') {
        return NON_BOTH_META[category] ?? { label: category || 'Unknown', tone: 'muted', icon: 'HelpCircle' };
    }
    const notApproved = Boolean(args.notApproved);
    const hasVariance = Boolean(args.hasVariance);
    const hasUnmappedRate = Boolean(args.hasUnmappedRate);
    const variance = Number(args.variance ?? 0);
    const issues = [];
    if (notApproved)
        issues.push('Not approved');
    if (hasVariance)
        issues.push(`${Math.abs(variance)}h variance`);
    if (hasUnmappedRate)
        issues.push('Unmapped rate');
    if (issues.length === 0)
        return { label: 'Match', tone: 'success', icon: 'CheckCircle2' };
    const tone = hasVariance || hasUnmappedRate ? 'destructive' : 'warning';
    const icon = hasVariance || hasUnmappedRate ? 'AlertTriangle' : 'Clock';
    return { label: issues.join(' · '), tone, icon };
}
/** Args: { category, notApproved, hasVariance, hasUnmappedRate, variance } — one employee row. */
const hours_recon_row_label = (args) => hoursReconRowMeta(args).label;
/** Args: { category, notApproved, hasVariance, hasUnmappedRate, variance } — one employee row. */
const hours_recon_row_tone = (args) => hoursReconRowMeta(args).tone;
/** Args: { category, notApproved, hasVariance, hasUnmappedRate, variance } — one employee row. */
const hours_recon_row_icon = (args) => hoursReconRowMeta(args).icon;
function hoursReconSummaryMeta(args) {
    const approved = Number(args.approvedCount) || 0;
    const draft = Number(args.draftCount) || 0;
    const missing = Number(args.missingTimesheetCount) || 0;
    const allClear = draft === 0 && missing === 0;
    return {
        label: `${approved} approved · ${draft} draft · ${missing} missing`,
        tone: allClear ? 'success' : 'warning',
        icon: allClear ? 'CheckCircle2' : 'AlertTriangle',
    };
}
/** Args: { approvedCount, draftCount, missingTimesheetCount }. */
const hours_recon_summary_label = (args) => hoursReconSummaryMeta(args).label;
/** Args: { approvedCount, draftCount, missingTimesheetCount }. */
const hours_recon_summary_tone = (args) => hoursReconSummaryMeta(args).tone;
/** Args: { approvedCount, draftCount, missingTimesheetCount }. */
const hours_recon_summary_icon = (args) => hoursReconSummaryMeta(args).icon;
/** One employee's segment (earnings-rate) sub-row — no approval concept at this level, just a hours match/variance. Args: { hasVariance, variance }. */
const segment_row_label = (args) => args.hasVariance ? `${Math.abs(Number(args.variance ?? 0))}h variance` : 'Match';
/** Args: { hasVariance }. */
const segment_row_tone = (args) => (args.hasVariance ? 'destructive' : 'success');
/**
 * Flattens get_hours_reconciliation's `employees` array (each with a nested
 * `segments` array) into a single FLAT list of rows for the Hours
 * Reconciliation tile: one "employee" row per employee, immediately
 * followed by one "segment" row per earnings rate on that employee. There's
 * no nested/relative repeat in this plugin system's widget schema
 * (repeat.statePath is always an absolute state path) — same reasoning and
 * pattern already used for the Read.ai Meeting Folders tile's
 * folder->meetings flattening. The tile's single repeated row template
 * shows either the employee header or a segment line depending on each
 * row's own `row_type`, with segment rows additionally gated on matching
 * the currently-expanded employee id.
 *
 * Args: { value: array } — get_hours_reconciliation's raw `employees` array.
 */
const flatten_employee_segments = (args) => {
    const employees = Array.isArray(args.value) ? args.value : [];
    const rows = [];
    for (const emp of employees) {
        const employeeId = String(emp.employeeId ?? '');
        rows.push({
            id: employeeId,
            row_type: 'employee',
            employee_id: employeeId,
            name: emp.name,
            category: emp.category,
            notApproved: Boolean(emp.notApproved),
            hasVariance: Boolean(emp.hasVariance),
            hasUnmappedRate: Boolean(emp.hasUnmappedRate),
            variance: emp.variance ?? 0,
            timesheetHours: emp.timesheetHours ?? 0,
            payrollHours: emp.payrollHours ?? 0,
        });
        for (const seg of emp.segments ?? []) {
            rows.push({
                id: `${employeeId}:${seg.earningsRateId ?? ''}`,
                row_type: 'segment',
                employee_id: employeeId,
                name: seg.name,
                timesheetHours: seg.timesheetHours ?? 0,
                payrollHours: seg.payrollHours ?? 0,
                variance: seg.variance ?? 0,
                hasVariance: Boolean(seg.hasVariance),
            });
        }
    }
    return rows;
};
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
const payroll_readiness_rows = (args) => {
    const employees = Array.isArray(args.employees) ? args.employees : [];
    return employees.map((e) => {
        const missing = e.missingFields ?? [];
        const pending = e.pendingLeave ?? [];
        const statusLabel = e.hasBalanceConflict ? 'Balance conflict' : e.ready ? 'Ready' : 'Needs attention';
        const parts = [];
        if (missing.length)
            parts.push(`Missing: ${missing.join(', ')}`);
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
const super_reconciliation_status = (args) => {
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
const elements = {
    slug: 'xero-payroll-au',
    functions: {
        fortnightly_pay_run_rows,
        pay_run_breakdown,
        format_dollars,
        check_row_label,
        check_row_tone,
        check_row_icon,
        title_case,
        hours_recon_row_label,
        hours_recon_row_tone,
        hours_recon_row_icon,
        hours_recon_summary_label,
        hours_recon_summary_tone,
        hours_recon_summary_icon,
        segment_row_label,
        segment_row_tone,
        flatten_employee_segments,
        payroll_readiness_rows,
        super_reconciliation_status,
    },
};
export default elements;
