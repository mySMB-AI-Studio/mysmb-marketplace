/**
 * employment-hero — widget-elements module
 * ──────────────────────────────────────────────────────────────────────────
 * Connector-specific `$computed` helpers contributed to the host's
 * widgets-system at runtime. The host prepends the slug `employment-hero_`
 * to every name in `functions`.
 */
// ── set_sort_field ────────────────────────────────────────────────────────────
// Set the active sort field. If already sorting by that field, toggles
// direction (asc ↔ desc). Otherwise resets to field|asc.
// Args: { current: string, field: string }
const set_sort_field = (args) => {
    const current = String(args.current ?? '');
    const field = String(args.field ?? '');
    const [currentField, currentDir] = current.split('|');
    if (currentField === field)
        return `${field}|${currentDir === 'asc' ? 'desc' : 'asc'}`;
    return `${field}|asc`;
};
// ── employment_type_tone ──────────────────────────────────────────────────────
// Map EH employment type string to a semantic badge tone.
// Args: { type: string }
const employment_type_tone = (args) => {
    const t = String(args.type ?? '').toLowerCase();
    if (t.includes('full'))
        return 'success';
    if (t.includes('part'))
        return 'warning';
    if (t.includes('casual'))
        return 'info';
    if (t.includes('contract'))
        return 'accent';
    return 'default';
};
// ── Shared date helper ────────────────────────────────────────────────────────
// Parses an ISO date string and returns display string (dd-Mmm-yy per tile
// display standards v2) and a numeric timestamp for sorting.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function formatEhDate(raw) {
    const s = String(raw ?? '');
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m)
        return { display: '', ts: 0 };
    const day = parseInt(m[3], 10);
    const mon = parseInt(m[2], 10) - 1;
    const year = parseInt(m[1], 10);
    return {
        display: `${String(day).padStart(2, '0')}-${MONTHS[mon] ?? m[2]}-${String(year).slice(-2)}`,
        ts: new Date(year, mon, day).getTime(),
    };
}
// ── flatten_employees ─────────────────────────────────────────────────────────
// Sort and normalise raw EH employee objects into display-ready row data.
// Args: { value: raw items array, key: sort key e.g. "full_name|asc" }
const flatten_employees = (args) => {
    const raw = Array.isArray(args.value) ? [...args.value] : [];
    const keyStr = String(args.key ?? 'full_name|asc');
    const [field, dir] = keyStr.split('|');
    const rows = raw.map(item => {
        const { display: startDate, ts: dateSortKey } = formatEhDate(item.start_date);
        return {
            id: String(item.id ?? ''),
            full_name: `${item.first_name ?? ''} ${item.last_name ?? ''}`.trim(),
            job_title: String(item.job_title ?? ''),
            employment_type: String(item.employment_type ?? ''),
            start_date: startDate,
            date_sort_key: dateSortKey,
        };
    });
    rows.sort((a, b) => {
        const av = a[field] ?? '';
        const bv = b[field] ?? '';
        const an = Number(av), bn = Number(bv);
        const cmp = !isNaN(an) && !isNaN(bn) ? an - bn : String(av).localeCompare(String(bv));
        return dir === 'desc' ? -cmp : cmp;
    });
    return rows.map(({ date_sort_key: _dk, ...rest }) => rest);
};
// ── flatten_leave_requests ────────────────────────────────────────────────────
// Normalise raw EH leave request objects into display-ready row data.
// Formats ISO dates to dd-Mmm-yy, builds date range string, computes
// status label (Pending / Starts Today / Overdue) and tone per tile standards.
// Args: { value: raw items array }
const flatten_leave_requests = (args) => {
    const raw = Array.isArray(args.value) ? [...args.value] : [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTs = today.getTime();
    return raw.map(item => {
        // Try multiple EH field paths for employee name
        const emp = item.employee;
        const empName = (typeof item.employee_name === 'string' && item.employee_name)
            ? item.employee_name
            : (typeof item.requester_name === 'string' && item.requester_name)
                ? item.requester_name
                : emp
                    ? (typeof emp.name === 'string' && emp.name)
                        ? emp.name
                        : `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim()
                    : `${item.first_name ?? ''} ${item.last_name ?? ''}`.trim();
        // Try multiple EH field paths for leave type (leave_category_name first, matching server-side resolveLeaveType)
        const lt = item.leave_type;
        const leaveType = (typeof item.leave_category_name === 'string' && item.leave_category_name)
            ? item.leave_category_name
            : (typeof lt === 'string' && lt)
                ? lt
                : (lt && typeof lt === 'object' && typeof lt.name === 'string')
                    ? lt.name
                    : (typeof item.leave_type_name === 'string' && item.leave_type_name)
                        ? item.leave_type_name
                        : '';
        const { display: startDisplay, ts: startTs } = formatEhDate(item.start_date);
        const { display: endDisplay } = formatEhDate(item.end_date);
        const startDayTs = startTs > 0
            ? new Date(new Date(startTs).setHours(0, 0, 0, 0))
            : null;
        const rawStatus = String(item.status ?? '').toLowerCase();
        let statusLabel;
        let statusTone;
        if (rawStatus === 'approved') {
            statusLabel = 'Approved';
            statusTone = 'success';
        }
        else if (rawStatus === 'declined' || rawStatus === 'rejected') {
            statusLabel = 'Declined';
            statusTone = 'destructive';
        }
        else if (startDayTs && startDayTs.getTime() < todayTs) {
            statusLabel = 'Overdue';
            statusTone = 'destructive';
        }
        else if (startDayTs && startDayTs.getTime() === todayTs) {
            statusLabel = 'Starts Today';
            statusTone = 'warning';
        }
        else {
            statusLabel = 'Pending';
            statusTone = 'muted';
        }
        const dateRange = [startDisplay, endDisplay].filter(Boolean).join(' → ');
        const reviewUrl = String(item.review_url ?? '');
        return {
            id: String(item.id ?? ''),
            employee_name: empName,
            leave_type: leaveType,
            date_range: dateRange,
            date_leave_line: [dateRange, leaveType].filter(Boolean).join(' · '),
            review_url: reviewUrl,
            show_review_link: reviewUrl ? 'true' : '',
            status_label: statusLabel,
            status_tone: statusTone,
        };
    });
};
// ── Shared leave-type resolver ────────────────────────────────────────────────
function resolveEhLeaveType(item) {
    if (typeof item.leave_category_name === 'string' && item.leave_category_name)
        return item.leave_category_name;
    const lt = item.leave_type;
    if (typeof lt === 'string' && lt)
        return lt;
    if (lt && typeof lt === 'object') {
        if (typeof lt.name === 'string' && lt.name)
            return lt.name;
        if (typeof lt.title === 'string' && lt.title)
            return lt.title;
    }
    if (typeof item.leave_type_name === 'string' && item.leave_type_name)
        return item.leave_type_name;
    return '';
}
// ── flatten_upcoming_leave ────────────────────────────────────────────────────
// Filters approved leave to start_date >= today, sorts ascending.
// Always emits status_label "Approved" / status_tone "success".
// Single-day leave shows one date; multi-day shows "dd-Mmm-yy → dd-Mmm-yy".
// Args: { value: raw items array }
const flatten_upcoming_leave = (args) => {
    const raw = Array.isArray(args.value) ? [...args.value] : [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTs = today.getTime();
    return raw
        .filter(item => {
        const { ts } = formatEhDate(item.start_date);
        return ts > 0 && ts >= todayTs;
    })
        .sort((a, b) => formatEhDate(a.start_date).ts - formatEhDate(b.start_date).ts)
        .map(item => {
        const { display: startDisplay } = formatEhDate(item.start_date);
        const { display: endDisplay } = formatEhDate(item.end_date);
        const dateRange = !endDisplay || startDisplay === endDisplay
            ? startDisplay
            : `${startDisplay} → ${endDisplay}`;
        const emp = item.employee;
        const empName = (typeof item.employee_name === 'string' && item.employee_name)
            ? item.employee_name
            : emp
                ? (typeof emp.name === 'string' && emp.name)
                    ? emp.name
                    : `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim()
                : `${item.first_name ?? ''} ${item.last_name ?? ''}`.trim();
        const rawStatus = String(item.status ?? '').toLowerCase();
        const statusLabel = rawStatus === 'approved' ? 'Approved'
            : rawStatus === 'declined' || rawStatus === 'rejected' ? 'Declined'
                : 'Pending';
        const statusTone = rawStatus === 'approved' ? 'success'
            : rawStatus === 'declined' || rawStatus === 'rejected' ? 'destructive'
                : 'muted';
        return {
            id: String(item.id ?? ''),
            employee_name: empName,
            leave_type: resolveEhLeaveType(item),
            date_range: dateRange,
            status_label: statusLabel,
            status_tone: statusTone,
        };
    });
};
// ── flatten_my_leave_requests ─────────────────────────────────────────────────
// Normalises the current user's leave requests into display-ready rows.
// Maps EH status → Approved (success) / Declined (destructive) / Pending (muted).
// Sorts by start_date descending (most recent first).
// Args: { value: raw items array }
const flatten_my_leave_requests = (args) => {
    const raw = Array.isArray(args.value) ? [...args.value] : [];
    return [...raw]
        .sort((a, b) => formatEhDate(b.start_date).ts - formatEhDate(a.start_date).ts)
        .map(item => {
        const { display: startDisplay } = formatEhDate(item.start_date);
        const { display: endDisplay } = formatEhDate(item.end_date);
        const dateRange = !endDisplay || startDisplay === endDisplay
            ? startDisplay
            : `${startDisplay} → ${endDisplay}`;
        const rawStatus = String(item.status ?? '').toLowerCase();
        let statusLabel;
        let statusTone;
        if (rawStatus === 'approved') {
            statusLabel = 'Approved';
            statusTone = 'success';
        }
        else if (rawStatus === 'declined' || rawStatus === 'rejected') {
            statusLabel = 'Declined';
            statusTone = 'destructive';
        }
        else {
            statusLabel = 'Pending';
            statusTone = 'muted';
        }
        const emp = item.employee;
        const empName = (typeof item.employee_name === 'string' && item.employee_name)
            ? item.employee_name
            : emp
                ? (typeof emp.name === 'string' && emp.name)
                    ? emp.name
                    : `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim()
                : `${item.first_name ?? ''} ${item.last_name ?? ''}`.trim();
        const { display: submittedDisplay } = formatEhDate(item.created_at ?? item.submitted_at ?? item.lodged_at ?? item.lodgement_date ?? item.date_lodged);
        let submittedLabel = submittedDisplay ? `Submitted ${submittedDisplay}` : '';
        if (rawStatus === 'approved') {
            const { display: actionDisplay } = formatEhDate(item.approved_at ?? item.approved_date ?? item.reviewed_at ?? item.actioned_at);
            if (actionDisplay)
                submittedLabel += ` · Approved ${actionDisplay}`;
        }
        else if (rawStatus === 'declined' || rawStatus === 'rejected') {
            const { display: actionDisplay } = formatEhDate(item.declined_at ?? item.declined_date ?? item.rejected_at ?? item.reviewed_at ?? item.actioned_at);
            if (actionDisplay)
                submittedLabel += ` · Declined ${actionDisplay}`;
        }
        return {
            id: String(item.id ?? ''),
            employee_name: empName,
            leave_type: resolveEhLeaveType(item),
            date_range: dateRange,
            status_label: statusLabel,
            status_tone: statusTone,
            submitted_label: submittedLabel,
        };
    });
};
// ── flatten_compliance_at_risk ────────────────────────────────────────────────
// The MCP server pre-filters to at-risk items only and sets status_label/
// status_tone ("Overdue"/"Due Today") and status_tone. This function only
// builds display_name and formats due_date — both unavailable server-side.
// Args: { value: pre-filtered items array from list_compliance_documents }
const flatten_compliance_at_risk = (args) => {
    const raw = Array.isArray(args.value) ? args.value : [];
    return raw.map(item => {
        const certName = String(item.name ?? item.certification_name ?? item.document_name ?? item.title ?? '');
        const empName = String(item.employee_name ?? '').trim();
        const displayName = empName ? `${certName} — ${empName}` : certName;
        const dueRaw = item.due_date ?? item.expiry_date ?? item.expires_at;
        const { display: dueDisplay } = formatEhDate(dueRaw);
        return {
            id: String(item.id ?? ''),
            display_name: displayName,
            due_date: dueDisplay,
            status_label: String(item.status_label ?? ''),
            status_tone: String(item.status_tone ?? ''),
        };
    });
};
// ── flatten_timesheets_to_approve ─────────────────────────────────────────────
// Normalises per-employee aggregated timesheet data into display-ready rows.
// Status: "Overdue" (destructive) if end_date < today, "Pending" (muted) otherwise.
// Args: { value: raw items array }
const flatten_timesheets_to_approve = (args) => {
    const raw = Array.isArray(args.value) ? [...args.value] : [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTs = today.getTime();
    return raw.map(item => {
        const emp = item.employee;
        const empName = String(item.employee_name ?? emp?.name ??
            `${emp?.first_name ?? ''} ${emp?.last_name ?? ''}`.trim() ?? '');
        const totalHours = Number(item.total_hours ?? item.hours ?? 0);
        const hoursDisplay = `${totalHours.toFixed(1)} hrs`;
        const { display: startDisplay } = formatEhDate(item.start_date);
        const { display: endDisplay, ts: endTs } = formatEhDate(item.end_date);
        const payPeriod = !endDisplay || startDisplay === endDisplay
            ? startDisplay
            : `${startDisplay} → ${endDisplay}`;
        return {
            id: String(item.id ?? ''),
            employee_name: empName,
            hours_display: hoursDisplay,
            pay_period: payPeriod,
            status_label: endTs > 0 && endTs < todayTs ? 'Overdue' : 'Pending',
            status_tone: endTs > 0 && endTs < todayTs ? 'destructive' : 'muted',
        };
    });
};
// ── flatten_my_upcoming_leave ─────────────────────────────────────────────────
// Filters the current user's approved leave to start_date >= today, sorts
// ascending, and computes a "In X Days" / "Tomorrow" / "Today" countdown.
// Args: { value: raw items array }
const flatten_my_upcoming_leave = (args) => {
    const raw = Array.isArray(args.value) ? [...args.value] : [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTs = today.getTime();
    return raw
        .filter(item => {
        const { ts } = formatEhDate(item.start_date);
        return ts > 0 && ts >= todayTs;
    })
        .sort((a, b) => formatEhDate(a.start_date).ts - formatEhDate(b.start_date).ts)
        .map(item => {
        const { display: startDisplay, ts: startTs } = formatEhDate(item.start_date);
        const { display: endDisplay } = formatEhDate(item.end_date);
        const dateRange = !endDisplay || startDisplay === endDisplay
            ? startDisplay
            : `${startDisplay} → ${endDisplay}`;
        const daysUntil = Math.round((startTs - todayTs) / 86400000);
        const daysLabel = daysUntil === 0 ? 'Today'
            : daysUntil === 1 ? 'Tomorrow'
                : `In ${daysUntil} Days`;
        return {
            id: String(item.id ?? ''),
            leave_type: resolveEhLeaveType(item),
            date_range: dateRange,
            days_label: daysLabel,
        };
    });
};
// ── flatten_direct_reports_upcoming_leave ─────────────────────────────────────
// Formats approved upcoming leave for the connected manager's direct reports.
// date_header uses uppercase months (dd-MMM-yy) with day-of-week for single days.
// Args: { value: raw items array from get_direct_reports_upcoming_leave }
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_UPPER = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
function formatEhDateUpper(raw) {
    const s = String(raw ?? '');
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m)
        return { display: '', ts: 0, dow: '' };
    const day = parseInt(m[3], 10);
    const mon = parseInt(m[2], 10) - 1;
    const year = parseInt(m[1], 10);
    const d = new Date(year, mon, day);
    return {
        display: `${String(day).padStart(2, '0')}-${MONTHS_UPPER[mon] ?? m[2]}-${String(year).slice(-2)}`,
        ts: d.getTime(),
        dow: (DAYS_SHORT[d.getDay()] ?? '').toUpperCase(),
    };
}
const flatten_direct_reports_upcoming_leave = (args) => {
    const raw = Array.isArray(args.value) ? [...args.value] : [];
    return raw.map(item => {
        const { display: startDisplay, dow } = formatEhDateUpper(item.start_date);
        const { display: endDisplay } = formatEhDateUpper(item.end_date);
        let dateHeader;
        if (!endDisplay || startDisplay === endDisplay) {
            dateHeader = dow ? `${startDisplay} (${dow})` : startDisplay;
        }
        else {
            dateHeader = `${startDisplay} → ${endDisplay}`;
        }
        const emp = item.employee;
        const empName = (typeof item.employee_name === 'string' && item.employee_name)
            ? item.employee_name
            : emp
                ? `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim()
                : `${item.first_name ?? ''} ${item.last_name ?? ''}`.trim();
        return {
            id: String(item.id ?? ''),
            date_header: dateHeader,
            employee_name: empName,
            leave_type: resolveEhLeaveType(item),
        };
    });
};
// ── flatten_timesheet_daily_summary ──────────────────────────────────────────
// Groups this-week timesheet entries by date, sums hours per day.
// Index-0 item carries period_range and total_hours_display for the header badge.
// Args: { value: raw items from get_timesheets_this_week }
const flatten_timesheet_daily_summary = (args) => {
    const raw = Array.isArray(args.value) ? args.value : [];
    if (raw.length === 0)
        return [];
    const groups = new Map();
    let totalHours = 0;
    let minDate = '';
    let maxDate = '';
    for (const item of raw) {
        const date = String(item.date ?? '');
        if (!date)
            continue;
        const hrs = Number(item.hours ?? 0);
        totalHours += hrs;
        if (!minDate || date < minDate)
            minDate = date;
        if (!maxDate || date > maxDate)
            maxDate = date;
        const existing = groups.get(date);
        if (existing) {
            existing.hours += hrs;
            existing.count += 1;
        }
        else {
            groups.set(date, { hours: hrs, count: 1 });
        }
    }
    const sortedDates = Array.from(groups.keys()).sort();
    // Derive period_range from server-provided _period_start/_period_end so it
    // always matches the API window, even if EH leaks entries outside it.
    const pStart = String(raw[0]?._period_start ?? minDate);
    const pEnd = String(raw[0]?._period_end ?? maxDate);
    const { display: startDisplay } = formatEhDate(pStart);
    const { display: endDisplay } = formatEhDate(pEnd);
    const periodRange = startDisplay === endDisplay ? startDisplay : `${startDisplay} → ${endDisplay}`;
    const totalRounded = Math.round(totalHours * 10) / 10;
    const totalHoursDisplay = `${totalRounded} hrs`;
    return sortedDates.map((date, i) => {
        const g = groups.get(date);
        const { display: dateHeader } = formatEhDate(date);
        const dayHrs = Math.round(g.hours * 10) / 10;
        return {
            id: date,
            date_header: dateHeader,
            hours_display: `${dayHrs} hrs`,
            entry_count_label: g.count === 1 ? '1 entry' : `${g.count} entries`,
            period_range: i === 0 ? periodRange : '',
            total_hours_display: i === 0 ? totalHoursDisplay : '',
        };
    });
};
// ── toggle_status_filter ──────────────────────────────────────────────────────
// Toggles the active status filter. Clicking the same value clears it (shows all).
// Args: { current: string, value: string }
const toggle_status_filter = (args) => {
    const current = String(args.current ?? '');
    const value = String(args.value ?? '');
    return current === value ? '' : value;
};
// ── flatten_team_timesheet_entries ────────────────────────────────────────────
// Groups this-week timesheet entries by employee, sums hours, computes composite
// status (Overdue if any pending entry's date < today, Approved if all approved,
// else Pending). Index-0 row carries period_range, stat counts, and filter_*_active flags.
// Args: { value: raw items from get_timesheets_this_week, filter?: "Pending"|"Approved"|"Overdue"|"" }
const flatten_team_timesheet_entries = (args) => {
    const raw = Array.isArray(args.value) ? args.value : [];
    if (raw.length === 0)
        return [];
    const statusFilter = String(args.filter ?? '');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTs = today.getTime();
    // Derive period_range from server-provided _period_start/_period_end so it
    // always matches the API window, even if EH leaks entries outside it.
    const pStart = String(raw[0]?._period_start ?? '');
    const pEnd = String(raw[0]?._period_end ?? '');
    const { display: psDisplay } = formatEhDate(pStart);
    const { display: peDisplay } = formatEhDate(pEnd);
    const periodRange = psDisplay === peDisplay ? psDisplay : `${psDisplay} → ${peDisplay}`;
    const groups = new Map();
    for (const item of raw) {
        const empId = String(item.employee_id ?? item.id ?? '');
        if (!empId)
            continue;
        const hrs = Number(item.hours ?? 0);
        const rawStatus = String(item.status ?? '').toLowerCase();
        const date = String(item.date ?? '');
        const existing = groups.get(empId);
        if (existing) {
            existing.hours += hrs;
            existing.statuses.push(rawStatus);
            existing.dates.push(date);
        }
        else {
            groups.set(empId, {
                employee_name: String(item.employee_name ?? '').trim(),
                hours: hrs,
                statuses: [rawStatus],
                dates: [date],
                review_url: String(item.review_url ?? ''),
            });
        }
    }
    let pendingCount = 0, approvedCount = 0, overdueCount = 0;
    const allRows = Array.from(groups.entries()).map(([empId, g]) => {
        const hrs = Math.round(g.hours * 10) / 10;
        const allApproved = g.statuses.every(s => s === 'approved');
        const isOverdue = !allApproved && g.statuses.some((s, i) => {
            const { ts } = formatEhDate(g.dates[i]);
            return (s === 'pending' || s === '') && ts > 0 && ts < todayTs;
        });
        let statusLabel, statusTone;
        if (isOverdue) {
            statusLabel = 'Overdue';
            statusTone = 'destructive';
            overdueCount++;
        }
        else if (allApproved) {
            statusLabel = 'Approved';
            statusTone = 'success';
            approvedCount++;
        }
        else {
            statusLabel = 'Pending';
            statusTone = 'muted';
            pendingCount++;
        }
        return {
            id: empId,
            employee_name: g.employee_name,
            hours_this_week: `${hrs} hrs this week`,
            status_label: statusLabel,
            status_tone: statusTone,
            show_review_link: isOverdue && !!g.review_url ? 'true' : '',
            review_url: g.review_url,
            period_range: '',
            stat_pending: '',
            stat_approved: '',
            stat_overdue: '',
            filter_pending_active: '',
            filter_approved_active: '',
            filter_overdue_active: '',
        };
    });
    allRows.sort((a, b) => a.employee_name.localeCompare(b.employee_name));
    // Apply filter — always preserve stats on index 0 of the returned array
    const rows = statusFilter
        ? allRows.filter(r => r.status_label === statusFilter)
        : allRows;
    const target = rows.length > 0 ? rows[0] : allRows[0];
    if (target) {
        target.period_range = periodRange;
        target.stat_pending = String(pendingCount);
        target.stat_approved = String(approvedCount);
        target.stat_overdue = String(overdueCount);
        target.filter_pending_active = statusFilter === 'Pending' ? 'true' : '';
        target.filter_approved_active = statusFilter === 'Approved' ? 'true' : '';
        target.filter_overdue_active = statusFilter === 'Overdue' ? 'true' : '';
    }
    return rows;
};
const elements = {
    slug: 'employment-hero',
    functions: {
        set_sort_field,
        employment_type_tone,
        toggle_status_filter,
        flatten_employees,
        flatten_leave_requests,
        flatten_upcoming_leave,
        flatten_my_leave_requests,
        flatten_my_upcoming_leave,
        flatten_compliance_at_risk,
        flatten_timesheets_to_approve,
        flatten_direct_reports_upcoming_leave,
        flatten_timesheet_daily_summary,
        flatten_team_timesheet_entries,
    },
};
export default elements;
