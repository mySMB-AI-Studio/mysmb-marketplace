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
/** Rows in the expanded employee list (TILE-DISPLAY-STANDARDS §11). */
const MAX_EMPLOYEE_ROWS = 20;
/** `9:02 AM` for a Date, in the viewer's time zone. */
function clockTime(d) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
/** A getUserReport time such as `06-Nov-2026 07:57 AM` as 24h `HH:mm`; '' if it has none. */
function reportTime(value) {
    const m = /(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?\s*$/.exec(String(value ?? '').trim());
    if (!m)
        return '';
    let hour = Number(m[1]);
    const meridiem = m[3]?.toUpperCase();
    if (meridiem === 'PM' && hour < 12)
        hour += 12;
    if (meridiem === 'AM' && hour === 12)
        hour = 0;
    return `${String(hour).padStart(2, '0')}:${m[2]}`;
}
/** `7:57 AM` for a 24h `HH:mm`. */
function clock12(time) {
    const [h, m] = time.split(':').map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}
/** `11 min` / `1 hr 5 min` from an `HH:mm` lateness; '' if unparseable. */
function lateText(value) {
    const m = /^(\d+):(\d{2})/.exec(String(value ?? ''));
    if (!m)
        return '';
    const [h, min] = [Number(m[1]), Number(m[2])];
    return [h ? `${h} hr` : '', min || !h ? `${min} min` : ''].filter(Boolean).join(' ');
}
const ATTENDANCE_STATUSES = ['present', 'late', 'absent', 'leave', 'weekend', 'holiday', 'unknown'];
/**
 * Today's attendance across the organisation for the Today's Attendance tile,
 * from the `attendance_today` tool (one Zoho getUserReport per active
 * employee, for today in the org's time zone).
 *
 * - Scheduled: tracked employees not on a weekend or holiday whose report
 *   loaded. The bar, legend and percentage cover them.
 * - Present / Late: checked in, on time or late against their own shift;
 *   Absent: no check-in; On leave: on leave for the day.
 * - The percentage is present ÷ scheduled, so late arrivals don't count
 *   towards it — as in the mock.
 *
 * Args:
 *   report — `attendance_today` result: `{ date, timezone, summary, employees: [{ erecno, name, status, firstIn, lateBy, zohoStatus, leaveCode }] }`
 *   showEmployees — true when the "N employees tracked" box is expanded (`/ui/showEmployees`)
 *
 * Spec: `{ "$computed": "zoho-people_attendance_today_dashboard", "args": { "report": { "$state": "/zoho-people/attendance_today" }, "showEmployees": { "$state": "/ui/showEmployees" } } }`
 */
const attendance_today_dashboard = (args) => {
    const report = (args.report && typeof args.report === 'object' ? args.report : {});
    const loaded = Array.isArray(report.employees);
    const people = (loaded ? report.employees : []).map((e) => {
        const status = ATTENDANCE_STATUSES.includes(e.status)
            ? e.status
            : 'unknown';
        return {
            id: String(e.erecno ?? e.employeeId ?? e.email),
            name: String(e.name ?? '').trim() || String(e.email ?? 'Employee'),
            status,
            time: reportTime(e.firstIn),
            late: lateText(e.lateBy),
            // Zoho's day status names the leave type (`Casual Leave`); leaveCode is only its code (`CL`).
            leave: String(e.zohoStatus || e.leaveCode || '').trim(),
        };
    });
    const count = (...statuses) => people.filter((p) => statuses.includes(p.status)).length;
    const tracked = people.length;
    const present = count('present');
    const late = count('late');
    const absent = count('absent');
    const onLeave = count('leave');
    const offDay = count('weekend', 'holiday');
    const unknown = count('unknown');
    const scheduled = present + late + absent + onLeave;
    // The "N employees tracked" box expanded: everyone tracked, present first
    // (earliest check-in first), then late, absent, on leave, off and unavailable.
    const showEmployees = args.showEmployees === true && tracked > 0;
    const statusRank = {
        present: 0,
        late: 1,
        absent: 2,
        leave: 3,
        weekend: 4,
        holiday: 4,
        unknown: 5,
    };
    const statusLabel = {
        present: 'Present',
        late: 'Late',
        absent: 'Absent',
        leave: 'On leave',
        weekend: 'Day off',
        holiday: 'Holiday',
        unknown: 'Unavailable',
    };
    // Badge colours. Absent is red here rather than the bar's grey: a `muted`
    // badge renders colourless. Days off and unloaded reports stay grey.
    const statusTone = {
        present: 'success',
        late: 'warning',
        absent: 'destructive',
        leave: 'chart-4',
        weekend: 'muted',
        holiday: 'muted',
        unknown: 'muted',
    };
    const detail = (p) => {
        const checkedIn = p.time ? `Checked in ${clock12(p.time)}` : 'Checked in';
        switch (p.status) {
            case 'present':
                return checkedIn;
            case 'late':
                return p.late ? `${checkedIn} · ${p.late} late` : checkedIn;
            case 'absent':
                return 'No check-in today';
            case 'leave':
                return p.leave || 'On leave today';
            case 'weekend':
                return 'Not scheduled today';
            case 'holiday':
                return 'Public holiday';
            default:
                return "Couldn't load attendance";
        }
    };
    const employeeList = showEmployees
        ? [...people]
            .sort((a, b) => statusRank[a.status] - statusRank[b.status] || a.time.localeCompare(b.time) || a.name.localeCompare(b.name))
            .slice(0, MAX_EMPLOYEE_ROWS)
            .map((p) => ({
            id: p.id,
            name: p.name,
            detail: detail(p),
            statusLabel: statusLabel[p.status],
            statusTone: statusTone[p.status],
        }))
        : [];
    // On leave only gets a legend column when someone is on leave.
    const legend = [
        { key: 'present', label: 'Present', tone: 'success', count: present },
        { key: 'late', label: 'Late', tone: 'warning', count: late },
        { key: 'absent', label: 'Absent', tone: 'destructive', count: absent },
        { key: 'leave', label: 'On leave', tone: 'chart-4', count: onLeave },
    ]
        .filter((s) => s.key !== 'leave' || s.count > 0)
        .map((s) => ({
        ...s,
        countDisplay: s.count.toLocaleString('en-US'),
        // Legend label and count colour. Absent's dot and bar segment are red,
        // but its label and count stay the normal text colour.
        textTone: s.key === 'absent' ? 'default' : s.tone,
    }));
    const segments = legend.filter((s) => s.count > 0);
    return {
        loaded,
        tracked,
        // Everyone tracked is on a weekend or holiday (or couldn't be loaded).
        nobodyScheduled: loaded && tracked > 0 && scheduled === 0,
        presentPctDisplay: `${scheduled ? Math.round((present / scheduled) * 100) : 0}%`,
        // One bar segment per non-empty status, sized by its count.
        barTemplate: segments.map((s) => `${s.count}fr`).join(' '),
        segments,
        legend,
        legendTemplate: legend.map(() => '1fr').join(' '),
        // Employees left out of the bar are named after the tracked count.
        trackedText: [
            `${tracked.toLocaleString('en-US')} ${tracked === 1 ? 'employee' : 'employees'} tracked`,
            offDay ? `${offDay.toLocaleString('en-US')} off today` : '',
            unknown ? `${unknown.toLocaleString('en-US')} unavailable` : '',
        ]
            .filter(Boolean)
            .join(' · '),
        syncedText: `Synced ${clockTime(new Date())}`,
        employeesExpanded: showEmployees,
        // What a click on the tracked row writes to `/ui/showEmployees`.
        employeesToggle: !showEmployees,
        employeeList,
        employeesNote: showEmployees && tracked > MAX_EMPLOYEE_ROWS
            ? `Showing ${MAX_EMPLOYEE_ROWS} of ${tracked.toLocaleString('en-US')} employees.`
            : '',
    };
};
/** `yyyy-MM-dd` for a local date. */
function localIsoDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/**
 * This week's Monday (`edge: "start"`) or Sunday (`edge: "end"`) as
 * `yyyy-MM-dd`, in the viewer's time zone — `list_timesheets`' fromDate and
 * toDate. One date per call: action params resolve `$computed` per key, so a
 * function returning the whole params object is never evaluated.
 *
 * Spec: `{ "$computed": "zoho-people_timesheet_week_date", "args": { "edge": "start" } }`
 */
const timesheet_week_date = (args) => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - ((day.getDay() + 6) % 7) + (args.edge === 'end' ? 6 : 0));
    return localIsoDate(day);
};
/** A Zoho People list response's rows: `{ response: { result: [...] } }` or a bare array. */
function resultRows(value) {
    const result = value?.response
        ? value.response.result
        : value;
    return Array.isArray(result) ? result.filter((r) => r && typeof r === 'object') : [];
}
/** Minutes in one time log: `hoursInMins`, else `hours` as `HH:mm` or decimal hours. */
function timeLogMinutes(log) {
    const mins = Number(log.hoursInMins ?? log.minutes);
    if (Number.isFinite(mins) && mins > 0)
        return mins;
    const hours = String(log.hours ?? log.totaltime ?? '').trim();
    const hm = /^(\d+):(\d{2})/.exec(hours);
    if (hm)
        return Number(hm[1]) * 60 + Number(hm[2]);
    const dec = Number(hours);
    return Number.isFinite(dec) ? dec * 60 : 0;
}
/** `186.5` — hours to one decimal place, without a trailing `.0`. */
function hoursDisplay(mins) {
    return (Math.round((mins / 60) * 10) / 10).toLocaleString('en-US', { maximumFractionDigits: 1 });
}
/** Minutes in an `HH:mm` duration; 0 if unparseable. */
function hhmmMinutes(value) {
    const m = /^(\d+):(\d{2})/.exec(String(value ?? ''));
    return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}
/** A Zoho `dd-MMM-yyyy` (or `yyyy-MM-dd`) date as a local Date; null if unparseable. */
function zohoDate(value) {
    const s = String(value ?? '').trim();
    const dmy = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(s);
    if (dmy) {
        const month = MONTHS.indexOf(dmy[2].charAt(0).toUpperCase() + dmy[2].slice(1).toLowerCase());
        return month < 0 ? null : new Date(Number(dmy[3]), month, Number(dmy[1]));
    }
    const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    return ymd ? new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3])) : null;
}
/** `11 Oct – 17 Oct 2026` for a timesheet period (`11 Oct 2025 – 2 Jan 2026` across years). */
function periodDisplay(from, to) {
    const fmt = (d, year) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) });
    if (!from || !to)
        return from ? fmt(from, true) : to ? fmt(to, true) : '';
    return `${fmt(from, from.getFullYear() !== to.getFullYear())} – ${fmt(to, true)}`;
}
/** Rows in the expanded pending-timesheet list (TILE-DISPLAY-STANDARDS §11). */
const MAX_TIMESHEET_ROWS = 20;
/**
 * This week's logged hours for the Timesheet Summary tile.
 *
 * - Total, billable and non-billable hours from this week's time logs.
 *   A log counts as billable unless its `billingStatus` says non-billable.
 * - Progress against a weekly hour target (fixed in the tile spec).
 * - Timesheets awaiting approval (any period), and — when that box is
 *   expanded — the list of them, the longest-waiting period first.
 *
 * Args:
 *   logs        — `list_timesheets` (this week) `response.result`: `[{ hours: "HH:mm", hoursInMins, billingStatus }]`
 *   pending     — `passthrough_get` (`/timetracker/gettimesheet`, `approvalStatus: pending`) `response.result`: `[{ recordId, employeeName, fromDate, toDate, totalHours, billableHours }]`
 *   targetHours — weekly target in hours
 *   showPending — true when the "N timesheets awaiting approval" box is expanded (`/ui/showPending`)
 *
 * Spec: `{ "$computed": "zoho-people_timesheet_summary_dashboard", "args": { "logs": { "$state": "/zoho-people/list_timesheets/response/result" }, "pending": { "$state": "/zoho-people/passthrough_get/response/result" }, "targetHours": 200, "showPending": { "$state": "/ui/showPending" } } }`
 */
const timesheet_summary_dashboard = (args) => {
    const loaded = Array.isArray(args.logs) && Array.isArray(args.pending);
    const logs = resultRows(args.logs);
    let billable = 0;
    let nonBillable = 0;
    for (const log of logs) {
        const mins = timeLogMinutes(log);
        if (/non/i.test(String(log.billingStatus ?? log.billableStatus ?? '')))
            nonBillable += mins;
        else
            billable += mins;
    }
    const total = billable + nonBillable;
    const pending = resultRows(args.pending);
    const pendingCount = pending.length;
    const target = Number(args.targetHours) > 0 ? Number(args.targetHours) : 0;
    const pct = target ? Math.round((total / 60 / target) * 100) : 0;
    const showPending = args.showPending === true && pendingCount > 0;
    const pendingList = showPending
        ? pending
            .map((t) => ({ t, from: zohoDate(t.fromDate), to: zohoDate(t.toDate) }))
            .sort((a, b) => (a.from?.getTime() ?? Infinity) - (b.from?.getTime() ?? Infinity) ||
            String(a.t.employeeName ?? '').localeCompare(String(b.t.employeeName ?? '')))
            .slice(0, MAX_TIMESHEET_ROWS)
            .map(({ t, from, to }, i) => {
            const totalMins = hhmmMinutes(t.totalHours);
            const billableMins = hhmmMinutes(t.billableHours);
            return {
                id: String(t.recordId ?? t.listId ?? i),
                name: String(t.employeeName ?? '').trim() || String(t.employeeEmail ?? 'Employee'),
                // `11 Oct – 17 Oct 2026 · 5h billable`
                detail: `${periodDisplay(from, to) || String(t.timesheetName ?? 'Timesheet')} · ${hoursDisplay(billableMins)}h billable`,
                hoursDisplay: `${hoursDisplay(totalMins)}h`,
            };
        })
        : [];
    return {
        loaded,
        hasData: total > 0 || pendingCount > 0,
        totalDisplay: hoursDisplay(total),
        targetText: `of ${target.toLocaleString('en-US')} hr target`,
        targetPctDisplay: `${pct}%`,
        // The bar fills to 100% once the target is reached.
        targetPct: Math.min(pct, 100),
        billableDisplay: `${hoursDisplay(billable)}h`,
        nonBillableDisplay: `${hoursDisplay(nonBillable)}h`, pendingCount,
        pendingText: `${pendingCount.toLocaleString('en-US')} ${pendingCount === 1 ? 'timesheet' : 'timesheets'} awaiting approval`,
        pendingExpanded: showPending,
        // What a click on the pending row writes to `/ui/showPending`.
        pendingToggle: !showPending,
        pendingChevron: showPending ? 'ChevronUp' : 'ChevronDown',
        pendingList,
        pendingNote: showPending && pendingCount > MAX_TIMESHEET_ROWS
            ? `Showing ${MAX_TIMESHEET_ROWS} of ${pendingCount.toLocaleString('en-US')} timesheets.`
            : '',
    };
};
/**
 * How far each onboarding status is through onboarding. Zoho exposes no
 * per-candidate completion figure, so the bar moves in steps with the status.
 */
const ONBOARDING_STAGE_PCT = {
    'Not Triggered': 0,
    Triggered: 25,
    'In progress': 50,
    'Reopened by admin': 50,
    'Completed by candidate': 75,
    Completed: 100,
    'Converted to employee': 100,
};
/** Hires listed on the Onboarding Progress tile, soonest joining first. */
const MAX_ONBOARDING_ROWS = 5;
/** Hires starting next week count as on track once they're at least this far (In progress). */
const ON_TRACK_PCT = 50;
/**
 * New hires onboarding in Zoho People for the Onboarding Progress tile.
 *
 * - In progress: candidates not yet converted to employees.
 * - Each hire's progress comes from their onboarding status
 *   (`ONBOARDING_STAGE_PCT`); listed soonest joining date first.
 * - Starting next week: joining Monday–Sunday next week (viewer's time zone).
 *   On track when every one of them is at least In progress, else Behind.
 *   When that box is expanded, the list of them, soonest joining first.
 *
 * Args:
 *   report       — `onboarding_progress` result: `{ candidates: [{ recordId, name, joiningDate: "yyyy-MM-dd" | null, onboardingStatus }] }`
 *   showStarting — true when the "N starting next week" box is expanded (`/ui/showStarting`)
 *   selectedHire — id of the hire whose details are expanded (`/ui/selectedHire`), or ''
 *
 * Spec: `{ "$computed": "zoho-people_onboarding_progress_dashboard", "args": { "report": { "$state": "/zoho-people/onboarding_progress" }, "showStarting": { "$state": "/ui/showStarting" }, "selectedHire": { "$state": "/ui/selectedHire" } } }`
 */
const onboarding_progress_dashboard = (args) => {
    const report = (args.report && typeof args.report === 'object' ? args.report : {});
    const loaded = Array.isArray(report.candidates);
    const hires = (loaded ? report.candidates : [])
        .filter((c) => c.onboardingStatus !== 'Converted to employee')
        .map((c) => {
        const pct = ONBOARDING_STAGE_PCT[String(c.onboardingStatus ?? '')] ?? 0;
        return {
            id: String(c.recordId ?? c.candidateId ?? c.email),
            name: String(c.name ?? '').trim() || String(c.email ?? 'New hire'),
            joining: /^\d{4}-\d{2}-\d{2}$/.test(String(c.joiningDate ?? '')) ? String(c.joiningDate) : '',
            status: String(c.onboardingStatus ?? '').trim() || 'Not Triggered',
            candidateId: String(c.candidateId ?? '').trim(),
            email: String(c.email ?? '').trim(),
            department: String(c.department ?? '').trim(),
            designation: String(c.designation ?? '').trim(),
            pct,
            pctDisplay: `${pct}%`,
            // Green once onboarding is complete, else the tile's brand blue.
            barTone: pct >= 100 ? 'success' : 'brand',
        };
    })
        .sort((a, b) => (a.joining || '9999').localeCompare(b.joining || '9999') || a.name.localeCompare(b.name));
    const count = hires.length;
    const selectedHire = typeof args.selectedHire === 'string' ? args.selectedHire : '';
    // Next week, Monday to Sunday.
    const monday = new Date();
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const [from, to] = [localIsoDate(monday), localIsoDate(sunday)];
    const starting = hires.filter((h) => h.joining >= from && h.joining <= to);
    const startingCount = starting.length;
    const allMonday = starting.every((h) => h.joining === from);
    const onTrack = starting.every((h) => h.pct >= ON_TRACK_PCT);
    const showStarting = args.showStarting === true && startingCount > 0;
    const startingList = showStarting
        ? starting.slice(0, MAX_ONBOARDING_ROWS).map((h) => ({
            id: h.id,
            name: h.name,
            // `Starts Mon 16 Nov · Triggered`
            detail: `Starts ${zohoDate(h.joining)?.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) ?? h.joining} · ${h.status}`,
            pctDisplay: h.pctDisplay,
            tone: h.pct >= 100 ? 'success' : h.pct >= ON_TRACK_PCT ? 'brand' : 'warning',
        }))
        : [];
    return {
        loaded,
        hasData: count > 0,
        inProgressDisplay: count.toLocaleString('en-US'),
        inProgressLabel: count === 1 ? 'new hire in progress' : 'new hires in progress',
        hires: hires.slice(0, MAX_ONBOARDING_ROWS).map((h) => ({
            id: h.id,
            name: h.name,
            pct: h.pct,
            pctDisplay: h.pctDisplay,
            barTone: h.barTone,
            expanded: h.id === selectedHire,
            chevron: h.id === selectedHire ? 'ChevronUp' : 'ChevronDown',
            // What a click on this hire writes to `/ui/selectedHire`.
            toggle: h.id === selectedHire ? '' : h.id,
        })),
        // Details of the expanded hire; empty fields are left out.
        selectedHireDetails: (() => {
            const h = hires.find((x) => x.id === selectedHire);
            if (!h)
                return [];
            const joining = h.joining
                ? (zohoDate(h.joining)?.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) ?? h.joining)
                : 'Not set';
            return [
                ['status', 'Onboarding status', `${h.status} (${h.pctDisplay})`],
                ['joining', 'Joining date', joining],
                ['candidateId', 'Candidate ID', h.candidateId],
                ['department', 'Department', h.department],
                ['designation', 'Designation', h.designation],
                ['email', 'Email', h.email],
            ]
                .filter(([, , value]) => value)
                .map(([id, label, value]) => ({ id, label, value }));
        })(),
        hiresNote: count > MAX_ONBOARDING_ROWS
            ? `Showing ${MAX_ONBOARDING_ROWS} of ${count.toLocaleString('en-US')} new hires.`
            : '',
        startingCount,
        startingText: `${startingCount.toLocaleString('en-US')} starting next ${allMonday ? 'Monday' : 'week'}`,
        startStatusLabel: onTrack ? 'On track' : 'Behind',
        startStatusTone: onTrack ? 'brand' : 'warning',
        startingExpanded: showStarting,
        // What a click on the starting row writes to `/ui/showStarting`.
        startingToggle: !showStarting,
        startingChevron: showStarting ? 'ChevronUp' : 'ChevronDown',
        startingList,
        startingNote: showStarting && startingCount > MAX_ONBOARDING_ROWS
            ? `Showing ${MAX_ONBOARDING_ROWS} of ${startingCount.toLocaleString('en-US')} new hires.`
            : '',
    };
};
const elements = {
    slug: 'zoho-people',
    functions: {
        leave_balance_dashboard,
        leave_report_params,
        attendance_today_dashboard,
        timesheet_week_date,
        timesheet_summary_dashboard,
        onboarding_progress_dashboard,
    },
};
export default elements;
