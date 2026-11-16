/**
 * clickup — widget-elements module
 * ──────────────────────────────────────────────────────────────────
 * Contributed `$computed` helpers. The host prepends the slug
 * `clickup_` to every name, so e.g. the spec-side reference is
 * `clickup_date`.
 */
// ClickUp's REST API returns due_date / date_created / date_updated / a
// comment's date as a STRING of Unix milliseconds (e.g. "1699920000000"),
// confirmed against ClickUp's own live docs (Get Tasks, Get Task Comments)
// -- not a plain number and not ISO-8601, so the system's generic
// format_date_au/due_date_au/is_overdue helpers (which expect YYYY-MM-DD,
// /Date(...)/  or an ISO string) silently fail to parse it. This single
// parser is the one place that knows ClickUp's date shape; every function
// below goes through it.
function parseClickUpMs(value) {
    if (value == null || value === '')
        return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}
// ── date ─────────────────────────────────────────────────────────────
// Any ClickUp epoch-ms date field (due_date, date_created, date_updated,
// a comment's date) as dd/mm/yyyy. "—" when missing/unparseable.
// Args: { value: string | number | null }
const date = (args) => {
    const ms = parseClickUpMs(args.value);
    if (ms == null)
        return '—';
    const d = new Date(ms);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
};
function daysUntil(ms) {
    const due = new Date(ms);
    due.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((today.getTime() - due.getTime()) / 86_400_000);
}
// ── due_status_text ──────────────────────────────────────────────────
// "Nd overdue" / "Due today" / "Not yet due" / "No due date" -- same
// phrasing convention as this marketplace's other aging-style reports.
// Args: { value: string | number | null } (a task's due_date)
const due_status_text = (args) => {
    const ms = parseClickUpMs(args.value);
    if (ms == null)
        return 'No due date';
    const days = daysUntil(ms);
    if (days > 0)
        return `${days}d overdue`;
    if (days === 0)
        return 'Due today';
    return 'Not yet due';
};
// ── due_status_tone ──────────────────────────────────────────────────
// Tone for the due_status_text pill: destructive (overdue), warning (due
// today), success (not yet due), muted (no due date set).
// Args: { value: string | number | null }
const due_status_tone = (args) => {
    const ms = parseClickUpMs(args.value);
    if (ms == null)
        return 'muted';
    const days = daysUntil(ms);
    if (days > 0)
        return 'destructive';
    if (days === 0)
        return 'warning';
    return 'success';
};
const PRIORITY_LABELS = {
    urgent: 'Urgent',
    high: 'High',
    normal: 'Normal',
    low: 'Low',
};
const PRIORITY_TONES = {
    urgent: 'destructive',
    high: 'warning',
    normal: 'muted',
    low: 'muted',
};
// ── priority_label ───────────────────────────────────────────────────
// ClickUp's priority object's own `priority` field is already lower-case
// ("urgent" | "high" | "normal" | "low" -- note "normal", not "medium")
// and the field itself is null when no priority is set on the task.
// Title-cases it, or "No priority" when null. Args: { value: string | null }
const priority_label = (args) => {
    const v = args.value == null ? '' : String(args.value);
    return PRIORITY_LABELS[v] ?? (v ? v : 'No priority');
};
// ── priority_tone ────────────────────────────────────────────────────
// Args: { value: string | null }
const priority_tone = (args) => {
    const v = args.value == null ? '' : String(args.value);
    return PRIORITY_TONES[v] ?? 'muted';
};
// ── assignee_names ───────────────────────────────────────────────────
// ClickUp's assignees array carries full user objects; join their
// usernames for a compact display line. "Unassigned" when empty.
// Args: { value: Array<{ username?: string }> | null | undefined }
const assignee_names = (args) => {
    const arr = Array.isArray(args.value) ? args.value : [];
    const names = arr.map((a) => a?.username).filter((n) => !!n);
    return names.length ? names.join(', ') : 'Unassigned';
};
// ── task_url ─────────────────────────────────────────────────────────
// ClickUp's stable public task URL pattern (app.clickup.com/t/<task_id>).
// The Get Task / Get Tasks responses don't document a ready-made `url`
// field, so this is constructed, not passed through.
// Args: { task_id: string }
const task_url = (args) => {
    const id = args.task_id == null ? '' : String(args.task_id);
    return id ? `https://app.clickup.com/t/${id}` : '';
};
const elements = {
    slug: 'clickup',
    functions: {
        date,
        due_status_text,
        due_status_tone,
        priority_label,
        priority_tone,
        assignee_names,
        task_url,
    },
};
export default elements;
