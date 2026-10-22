/**
 * `list_individual_appointments` filters through Cliniko's own `q[]` query
 * syntax (one string expression per element, ANDed together) — confirmed via
 * Cliniko's official API docs: https://docs.api.cliniko.com/openapi/individual-appointment
 * `did_not_arrive` is a boolean-filterable field; `starts_at` is a
 * datetime-filterable field. There is no single-call "appointments on this
 * day" filter, so a day is expressed as a half-open range:
 * `starts_at >= day start` AND `starts_at < next day start`.
 *
 * Day boundaries are computed in the viewer's own local timezone (not
 * Cliniko's practice timezone, which isn't exposed by any tool here) —
 * the date picker itself operates in local-day terms, so this is the only
 * boundary available without guessing the clinic's configured timezone.
 */
const no_show_query = (args) => {
    const iso = args.date;
    if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
        return ['did_not_arrive:=true'];
    }
    const [y, m, d] = iso.split('-').map(Number);
    const dayStart = new Date(y, m - 1, d, 0, 0, 0, 0);
    const dayEnd = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
    return [
        'did_not_arrive:=true',
        `starts_at:>=${dayStart.toISOString()}`,
        `starts_at:<${dayEnd.toISOString()}`,
    ];
};
/** individual_appointment.starts_at (ISO datetime) → "2:30 pm", or '—'. Args: { value: string } */
const format_appointment_time = (args) => {
    const raw = args.value;
    if (!raw || typeof raw !== 'string')
        return '—';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime()))
        return '—';
    return d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
};
/** individual_appointment.starts_at (ISO datetime) → "12 Oct 2026", or '—'. Args: { value: string } */
const format_appointment_date = (args) => {
    const raw = args.value;
    if (!raw || typeof raw !== 'string')
        return '—';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime()))
        return '—';
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
};
/**
 * `patient_name` is Cliniko's own denormalized convenience field on the
 * appointment resource — everything else relational (practitioner,
 * business, appointment_type) comes back as a link-only object with no
 * embedded name, confirmed via the same API docs. Falls back when absent
 * rather than showing a blank row. Args: { value: string | null }
 */
const patient_display_name = (args) => {
    const v = args.value;
    return typeof v === 'string' && v.trim().length > 0 ? v.trim() : 'Unknown patient';
};
/**
 * Relational fields on an appointment are link-only (see the file header),
 * e.g. `patient.links.self` = "https://api.au5.cliniko.com/v1/patients/123".
 * Pulls the trailing numeric id out of that URL so it can be passed to
 * `cliniko-patients.get_patient` — confirmed live, this tool genuinely
 * lives on a SEPARATE MCP server (`cliniko-patients`, not
 * `cliniko-scheduling`), so its result lands at its own state path and
 * can't collide with the appointments list the way a second call on the
 * SAME generic tool would (the problem this plugin would otherwise share
 * with Odoo's `ai_tool_search`). Args: { value: string }
 */
const extract_patient_id = (args) => {
    const v = args.value;
    if (typeof v !== 'string')
        return '';
    const m = v.match(/\/patients\/(\d+)/);
    return m ? m[1] : '';
};
/**
 * Cliniko's API host (api.au5.cliniko.com) is never the practice's own web
 * app host — that host is only ever confirmed by looking at a real field
 * that already contains it. `telehealth_url` is the one such field
 * (confirmed present on every sampled appointment, telehealth or not):
 * "https://<practice>.au5.cliniko.com/appointments/<id>/connect". Its
 * origin is reused here to build a patient-record link on the SAME
 * confirmed host, which a live request proved is a real, auth-gated route
 * (401, not the generic 200 a nonexistent path returns on this host) —
 * not something guessed from scratch. Args: { telehealthUrl, patientId }
 */
const patient_web_url = (args) => {
    const telehealthUrl = args.telehealthUrl;
    const patientId = args.patientId;
    if (typeof telehealthUrl !== 'string' || !patientId)
        return '';
    try {
        const origin = new URL(telehealthUrl).origin;
        return `${origin}/patients/${patientId}`;
    }
    catch {
        return '';
    }
};
/**
 * Today (UTC), YYYY-MM-DD — the start of get_next_available_time's search
 * window. Takes no meaningful input; evaluated fresh on each click so a tile
 * left open overnight still searches from the real "today".
 */
const today_date = () => new Date().toISOString().slice(0, 10);
/**
 * Today + 6 days (UTC), YYYY-MM-DD — the end of get_next_available_time's
 * search window. Cliniko's API rejects a from/to span of more than 7 days
 * (confirmed via docs.api.cliniko.com), so this is the widest window a
 * single call can cover.
 */
const today_plus_6_date = () => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 6);
    return d.toISOString().slice(0, 10);
};
/**
 * "12 Oct 2026 at 2:30 pm (Sydney time)" for a next-available-time result.
 * Always formats in Australia/Sydney — NOT derived from the business
 * record's own configured timezone. This plugin's test org has its business
 * set to Pacific/Noumea (New Caledonia), which doesn't reflect where the
 * practice actually is, and every other automation in this cycle already
 * falls back to "Australia/Sydney" as the sensible default when a per-practice
 * timezone isn't being honoured — matching that convention here rather than
 * trusting unreliable test-org configuration.
 * Args: { value: string (UTC ISO appointment_start) }
 */
const format_next_available = (args) => {
    const raw = args.value;
    if (!raw || typeof raw !== 'string')
        return '—';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime()))
        return '—';
    const opts = { timeZone: 'Australia/Sydney' };
    const dateStr = d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', ...opts });
    const timeStr = d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true, ...opts });
    return `${dateStr} at ${timeStr} (Sydney time)`;
};
const elements = {
    slug: 'cliniko-scheduling',
    functions: {
        no_show_query,
        format_appointment_time,
        format_appointment_date,
        patient_display_name,
        extract_patient_id,
        patient_web_url,
        today_date,
        today_plus_6_date,
        format_next_available,
    },
};
export default elements;
