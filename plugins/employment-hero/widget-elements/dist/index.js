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
        const empName = typeof item.employee_name === 'string' && item.employee_name
            ? item.employee_name
            : `${item.first_name ?? ''} ${item.last_name ?? ''}`.trim();
        const { display: startDisplay, ts: startTs } = formatEhDate(item.start_date);
        const { display: endDisplay } = formatEhDate(item.end_date);
        const startDayTs = startTs > 0
            ? new Date(new Date(startTs).setHours(0, 0, 0, 0))
            : null;
        let statusLabel;
        let statusTone;
        if (startDayTs && startDayTs.getTime() < todayTs) {
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
        return {
            id: String(item.id ?? ''),
            employee_name: empName,
            leave_type: String(item.leave_type ?? ''),
            date_range: dateRange,
            status_label: statusLabel,
            status_tone: statusTone,
        };
    });
};
const elements = {
    slug: 'employment-hero',
    functions: {
        set_sort_field,
        employment_type_tone,
        flatten_employees,
        flatten_leave_requests,
    },
};
export default elements;
