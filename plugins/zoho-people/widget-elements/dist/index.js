/**
 * Leave types shown first, in this order, to match the Leave Balance & Requests
 * mock. Other (custom) leave types follow in Zoho's own order.
 */
const LEAVE_ORDER = ['Casual Leave', 'Sick Leave', 'Earned Leave'];
/** Requests that no longer count against the year. */
const INACTIVE_STATUSES = ['Rejected', 'Cancelled'];
/** `11`, `11.5` — at most one decimal, no trailing `.0`. */
function formatCount(n) {
    return (Math.round(n * 10) / 10).toLocaleString('en-US', { maximumFractionDigits: 1 });
}
/**
 * Zoho People's form APIs return each record wrapped in an object keyed by its
 * record ID: `[{ "<id>": [{ ...fields }] }]`. Flattens that to
 * `{ id, ...fields }[]`.
 */
function unwrapFormRecords(value) {
    if (!Array.isArray(value))
        return [];
    const out = [];
    for (const entry of value) {
        if (!entry || typeof entry !== 'object')
            continue;
        for (const [id, rows] of Object.entries(entry)) {
            const fields = Array.isArray(rows) ? rows[0] : rows;
            if (fields && typeof fields === 'object')
                out.push({ id, ...fields });
        }
    }
    return out;
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Zoho People `02-Dec-2026` → sortable `2026-12-02`, or '' if unparseable. */
function sortKey(date) {
    const m = /^(\d{2})-([A-Za-z]{3})-(\d{4})$/.exec(String(date ?? '').trim());
    if (!m)
        return '';
    const month = MONTHS.indexOf(m[2].charAt(0).toUpperCase() + m[2].slice(1).toLowerCase()) + 1;
    return month ? `${m[3]}-${String(month).padStart(2, '0')}-${m[1]}` : '';
}
/** Zoho People `02-Dec-2026` → `02-Dec-26` (TILE-DISPLAY-STANDARDS §1). */
function ddMmmYy(date) {
    const d = String(date ?? '').trim();
    return /^\d{2}-[A-Za-z]{3}-\d{4}$/.test(d) ? d.slice(0, 7) + d.slice(9) : d;
}
/**
 * Zoho People's lookup display value `1 - Sean Matthew - Baker` (employee ID,
 * first name, last name) as `Sean Matthew Baker`.
 */
function personName(value) {
    const parts = String(value ?? '').split(' - ').map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1 && /^[\w.]+$/.test(parts[0]) && /\d/.test(parts[0]))
        parts.shift();
    return parts.join(' ');
}
/** Year of a Zoho People `dd-Mmm-yyyy` date (`02-Dec-2026` → 2026), or NaN. */
function yearOf(date) {
    const m = /-(\d{4})$/.exec(String(date ?? '').trim());
    return m ? Number(m[1]) : NaN;
}
/**
 * The signed-in employee's leave for the Leave Balance & Requests tile: total
 * days available, each leave type's balance, and this year's leave requests.
 *
 * - Balances come from `get_leave_types` called with no user, which Zoho
 *   answers for the signed-in user. Types with `DoNotDisplayBalance` are left
 *   out; only day-based types count towards the total.
 * - Each type's yearly total comes from Zoho's leave report (`report`): taken
 *   (booked this year, upcoming leave included) + available after those
 *   bookings. Rows, bars and the hero use that available figure, so available
 *   + used = total; the header adds days used of the overall total. Until the
 *   report loads, rows show Zoho's balance as of today alone.
 * - Clicking a leave type expands this year's requests of that type
 *   (`openRequests`), soonest first; clicking the requests box expands all of
 *   them, each labelled with its type (`allRequests`).
 * - Requests come from the `leave` form, which returns every employee's
 *   requests to an admin, so they're filtered to the signed-in employee
 *   (`my_employee_record`). Until both have loaded, `requestsLoaded` is false.
 *
 * Args:
 *   leaveTypes   — `get_leave_types` `response.result`: `{ Id, Name, BalanceCount, AvailedCount, Unit, DoNotDisplayBalance }[]`
 *   me           — `my_employee_record` `response.result`: `[{ "<employee record id>": [{ ... }] }]`
 *   leaveRecords — `get_form_records` (form `leave`) `response.result`: `[{ "<id>": [{ From, To, Daystaken, Reasonforleave, AddedBy, ApprovalStatus, "Leavetype.ID", "Employee_ID.ID" }] }]`
 *   selected     — the expanded leave type's `id` (`/ui/selectedLeave`), or empty for none
 *   showAll      — true when the "N requests this year" box is expanded (`/ui/showAllRequests`)
 *   report       — the leave report's `leavetypes`: `{ leavetypeName, taken, available }[]` (optional)
 *
 * Spec: `{ "$computed": "zoho-people_leave_balance_dashboard", "args": { "leaveTypes": { "$state": "/zoho-people/get_leave_types/response/result" }, ... } }`
 */
const leave_balance_dashboard = (args) => {
    const raw = Array.isArray(args.leaveTypes) ? args.leaveTypes : [];
    const rank = (name) => {
        const i = LEAVE_ORDER.indexOf(name);
        return i === -1 ? LEAVE_ORDER.length : i;
    };
    const visible = raw
        .map((t, i) => ({ t, i, name: String(t.Name ?? '').trim() || 'Leave' }))
        .filter(({ t }) => t.DoNotDisplayBalance !== true)
        .sort((a, b) => rank(a.name) - rank(b.name) || a.i - b.i);
    const selected = String(args.selected ?? '');
    // Each type's yearly total, from the leave report: taken (booked this year,
    // including upcoming leave) + available at year end. Matched by name — the
    // report's numeric leave-type IDs lose precision in JSON.
    const report = new Map();
    for (const r of Array.isArray(args.report) ? args.report : []) {
        const taken = Number(r.taken) || 0;
        const left = Number(r.available) || 0;
        report.set(String(r.leavetypeName ?? '').trim(), { taken, available: left, total: taken + left });
    }
    const hasReport = report.size > 0;
    let available = 0;
    let used = 0;
    let total = 0;
    const types = visible.map(({ t, name }) => {
        // Available after this year's bookings, from the report. `BalanceCount` is
        // only the fallback until it loads: Zoho deducts booked leave from it only
        // once the leave date arrives, so it overstates what's left to book.
        const hours = String(t.Unit ?? '').toLowerCase().startsWith('hour');
        const yearly = report.get(name);
        const balance = yearly ? yearly.available : Number(t.BalanceCount) || 0;
        if (!hours) {
            available += balance;
            used += yearly?.taken ?? 0;
            total += yearly?.total ?? 0;
        }
        const unit = hours ? 'h' : 'd';
        const id = String(t.Id ?? name);
        return {
            id,
            name,
            expanded: id === selected,
            // What a click on this row writes to `/ui/selectedLeave`: open it, or close it if already open.
            toggleValue: id === selected ? '' : id,
            // Remaining of the type's yearly total (`11 of 12d`); just the balance until the report loads.
            pct: yearly && yearly.total > 0 ? Math.round((Math.max(0, balance) / yearly.total) * 100) : 100,
            balanceDisplay: yearly ? `${formatCount(balance)} of ${formatCount(yearly.total)}${unit}` : `${formatCount(balance)}${unit}`,
        };
    });
    const meId = unwrapFormRecords(args.me)[0]?.id;
    const requestsLoaded = Boolean(meId) && Array.isArray(args.leaveRecords);
    const year = new Date().getFullYear();
    const mine = requestsLoaded
        ? unwrapFormRecords(args.leaveRecords).filter((r) => String(r['Employee_ID.ID'] ?? '') === meId &&
            yearOf(r.From) === year &&
            !INACTIVE_STATUSES.includes(String(r.ApprovalStatus ?? '')))
        : [];
    const pending = mine.filter((r) => r.ApprovalStatus === 'Pending').length;
    const selectedName = types.find((t) => t.id === selected)?.name ?? 'leave';
    // One display row per request. `withType` prefixes the reason with the leave
    // type, for the all-requests list where types are mixed.
    const toRow = (r, withType) => {
        const from = ddMmmYy(r.From);
        const to = ddMmmYy(r.To);
        const days = Number(r.Daystaken);
        const isPending = r.ApprovalStatus === 'Pending';
        const reason = String(r.Reasonforleave ?? '').trim();
        const typeName = String(r.Leavetype ?? '').trim();
        return {
            id: String(r.id),
            dates: to && to !== from ? `${from} – ${to}` : from,
            reason: withType ? [typeName, reason].filter(Boolean).join(' · ') : reason,
            // Who entered the request — usually the employee, or a manager/HR filing for them.
            filedBy: personName(r.AddedBy) ? `Filed by ${personName(r.AddedBy)}` : '',
            daysDisplay: Number.isFinite(days) ? `${formatCount(days)}d` : '',
            statusLabel: isPending ? 'Pending' : 'Booked',
            statusTone: isPending ? 'warning' : 'success',
        };
    };
    const byDate = (a, b) => sortKey(a.From).localeCompare(sortKey(b.From));
    const openRequests = mine
        .filter((r) => String(r['Leavetype.ID'] ?? '') === selected)
        .sort(byDate)
        .map((r) => toRow(r, false));
    const showAll = args.showAll === true && mine.length > 0;
    return {
        availableDisplay: formatCount(available),
        // `days available · 4 used of 36` — day-based types only, like the total.
        availableLabel: `${available === 1 ? 'day' : 'days'} available${hasReport ? ` · ${formatCount(used)} used of ${formatCount(total)}` : ''}`,
        types,
        requestsLoaded,
        requestsText: `${mine.length} ${mine.length === 1 ? 'request' : 'requests'} this year`,
        // Booked once nothing is waiting on approval (approved, or approval not enabled).
        statusLabel: mine.length === 0 ? '' : pending > 0 ? `${pending} pending` : 'Booked',
        statusTone: pending > 0 ? 'warning' : 'success',
        // The expanded type's requests. Returned here rather than by a second watch
        // action: a watch stops its action list once one action writes state.
        openRequests,
        openNote: !selected || openRequests.length > 0
            ? ''
            : requestsLoaded ? `No ${selectedName} requests this year.` : 'Loading requests…',
        // The requests box expanded: every request this year, all types, soonest first.
        allExpanded: showAll,
        allToggle: !showAll,
        allRequests: showAll ? [...mine].sort(byDate).map((r) => toRow(r, true)) : [],
    };
};
/**
 * Query params for Zoho People's leave user report (`passthrough_get` on
 * `/v2/leavetracker/reports/user`) covering the signed-in employee's current
 * calendar year. Returns null until `my_employee_record` has loaded.
 *
 * Args:
 *   me — `my_employee_record` `response.result`
 *
 * Spec: `{ "$computed": "zoho-people_leave_report_params", "args": { "me": { "$state": "/zoho-people/my_employee_record/response/result" } } }`
 */
const leave_report_params = (args) => {
    const meId = unwrapFormRecords(args.me)[0]?.id;
    if (!meId)
        return null;
    const year = new Date().getFullYear();
    return { employee: meId, from: `${year}-01-01`, to: `${year}-12-31`, dateFormat: 'yyyy-MM-dd' };
};
const elements = {
    slug: 'zoho-people',
    functions: {
        leave_balance_dashboard,
        leave_report_params,
    },
};
export default elements;
