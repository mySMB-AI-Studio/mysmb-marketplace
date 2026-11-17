/**
 * clickup — widget-elements module
 * ──────────────────────────────────────────────────────────────────
 * Contributed `$computed` helpers. The host prepends the slug
 * `clickup_` to every name, so e.g. the spec-side reference is
 * `clickup_date`.
 */
// ClickUp's v2 REST API (tasks, comments) returns due_date / date_created /
// date_updated / a comment's date as a STRING of Unix milliseconds (e.g.
// "1699920000000"), confirmed against ClickUp's own live docs (Get Tasks,
// Get Task Comments) -- not a plain number and not ISO-8601, so the
// system's generic format_date_au/due_date_au/is_overdue helpers (which
// expect YYYY-MM-DD, /Date(...)/ or an ISO string) silently fail to parse
// it. Chat's v3 API (channels) documents its created_at/updated_at/
// latest_comment_at fields only as `"type": "string"` with no format
// given -- not confirmed epoch-ms like v2, and not confirmed ISO either.
// This parser tries epoch-ms first (the v2-confirmed shape), then falls
// back to Date.parse (covers ISO-8601) so either API version's date shape
// resolves correctly without guessing which one v3 actually uses.
function parseClickUpMs(value) {
    if (value == null || value === '')
        return null;
    const n = Number(value);
    if (Number.isFinite(n))
        return n;
    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) ? parsed : null;
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
const CHANNEL_TYPE_LABELS = {
    CHANNEL: 'Channel',
    DM: 'Direct message',
    GROUP_DM: 'Group DM',
    ASK_AI: 'Ask AI',
};
// ── channel_type_label ───────────────────────────────────────────────
// Args: { value: string | null } -- a channel's `type` field
const channel_type_label = (args) => {
    const v = args.value == null ? '' : String(args.value);
    return CHANNEL_TYPE_LABELS[v] ?? (v || 'Channel');
};
// Decorative categorical colors (chart-1..5), not status tones -- a
// channel's type isn't "good" or "bad", it's one of several kinds, same
// reasoning as @myhub/widget-tokens' own chart-N doc comment.
const CHANNEL_TYPE_TONES = {
    CHANNEL: 'chart-1',
    DM: 'chart-2',
    GROUP_DM: 'chart-3',
    ASK_AI: 'chart-4',
};
// ── channel_type_tone ────────────────────────────────────────────────
// Args: { value: string | null } -- a channel's `type` field
const channel_type_tone = (args) => {
    const v = args.value == null ? '' : String(args.value);
    return CHANNEL_TYPE_TONES[v] ?? 'chart-5';
};
const CHANNEL_VISIBILITY_LABELS = {
    PUBLIC: 'Public',
    PRIVATE: 'Private',
};
// ── channel_visibility_label ─────────────────────────────────────────
// Args: { value: string | null } -- a channel's `visibility` field
const channel_visibility_label = (args) => {
    const v = args.value == null ? '' : String(args.value);
    return CHANNEL_VISIBILITY_LABELS[v] ?? (v || '');
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
// ── list_url ─────────────────────────────────────────────────────────
// ClickUp's list-view web URL. Confirmed live that list/folder objects
// carry no `url` field of their own (unlike a task, which does) -- same
// constructed-URL approach as task_url above.
// Args: { team_id: string, list_id: string }
const list_url = (args) => {
    const team = args.team_id == null ? '' : String(args.team_id);
    const list = args.list_id == null ? '' : String(args.list_id);
    return team && list ? `https://app.clickup.com/${team}/v/li/${list}` : '';
};
// ── explorer_items ───────────────────────────────────────────────────
// Combines one Space's Folders and folderless Lists into a single sorted
// array for the Workspace Explorer tile, each tagged with `kind` so the
// row template can give folders a drill-in chevron and lists an
// open-in-ClickUp action instead. ClickUp keeps these as two separate
// endpoints (list_folders / list_folderless_lists); a Space's real
// contents are the union of both.
// Args: { folders: ClickUpFolder[], lists: ClickUpList[] }
const explorer_items = (args) => {
    const folders = Array.isArray(args.folders) ? args.folders : [];
    const lists = Array.isArray(args.lists) ? args.lists : [];
    const items = [
        ...folders.map((f) => ({ id: `folder-${f.id}`, rawId: f.id, name: f.name, kind: 'folder', count: f.task_count ?? 0 })),
        ...lists.map((l) => ({ id: `list-${l.id}`, rawId: l.id, name: l.name, kind: 'list', count: l.task_count ?? 0 })),
    ];
    items.sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? '')));
    return items;
};
// ── folder_lists ─────────────────────────────────────────────────────
// Same tagging as explorer_items but for the Lists inside one Folder
// (list_lists) -- these are always leaves (Folders don't nest further in
// ClickUp), so every row is kind: 'list'.
// Args: { lists: ClickUpList[] }
const folder_lists = (args) => {
    const lists = Array.isArray(args.lists) ? args.lists : [];
    return lists
        .map((l) => ({ id: `list-${l.id}`, rawId: l.id, name: l.name, kind: 'list', count: l.task_count ?? 0 }))
        .sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? '')));
};
const STATUS_TYPE_TONES = {
    open: 'muted',
    custom: 'accent',
    done: 'success',
    closed: 'success',
};
/** A header row's separator in a synthetic row id -- never a real ClickUp id, so collisions with a task id are impossible. */
const ROW_ID_SEP = '::';
// ── board_rows ───────────────────────────────────────────────────────
// Flattens list_tasks into header+task rows for the Task Board's three
// views (status / assignee / urgent), so the tile can repeat over ONE
// array instead of needing a nested repeat (untested in this renderer).
// A task with several assignees appears once per assignee in that view,
// so each row's `id` is synthesized (task id alone isn't unique there).
// Args: { tasks: ClickUpTask[], view: 'status' | 'assignee' | 'urgent' }
const board_rows = (args) => {
    const tasks = Array.isArray(args.tasks) ? args.tasks : [];
    const view = String(args.view ?? 'status');
    if (view === 'assignee') {
        const groups = new Map();
        for (const t of tasks) {
            const assignees = Array.isArray(t.assignees) && t.assignees.length ? t.assignees : [{ id: 'unassigned', username: 'Unassigned' }];
            for (const a of assignees) {
                const key = String(a?.id ?? 'unassigned');
                if (!groups.has(key))
                    groups.set(key, { label: String(a?.username ?? 'Unassigned'), tasks: [] });
                groups.get(key).tasks.push(t);
            }
        }
        const keys = [...groups.keys()].sort((a, b) => {
            if (a === 'unassigned')
                return 1;
            if (b === 'unassigned')
                return -1;
            return groups.get(a).label.localeCompare(groups.get(b).label);
        });
        const rows = [];
        for (const key of keys) {
            const g = groups.get(key);
            rows.push({ kind: 'header', id: `h${ROW_ID_SEP}${key}`, label: g.label, count: g.tasks.length, tone: 'accent' });
            g.tasks.forEach((t) => rows.push({ kind: 'task', id: `t${ROW_ID_SEP}${key}${ROW_ID_SEP}${t.id}`, task: t }));
        }
        return rows;
    }
    if (view === 'urgent') {
        const buckets = { overdue: [], today: [], soon: [] };
        for (const t of tasks) {
            const ms = parseClickUpMs(t.due_date);
            if (ms == null)
                continue;
            const days = daysUntil(ms);
            if (days > 0)
                buckets.overdue.push(t);
            else if (days === 0)
                buckets.today.push(t);
            else if (days >= -3)
                buckets.soon.push(t);
        }
        const defs = [
            ['overdue', 'Overdue', 'destructive'],
            ['today', 'Due today', 'warning'],
            ['soon', 'Due soon (3 days)', 'info'],
        ];
        const rows = [];
        for (const [key, label, tone] of defs) {
            const list = buckets[key];
            if (!list.length)
                continue;
            rows.push({ kind: 'header', id: `h${ROW_ID_SEP}${key}`, label, count: list.length, tone });
            list.forEach((t) => rows.push({ kind: 'task', id: `t${ROW_ID_SEP}${key}${ROW_ID_SEP}${t.id}`, task: t }));
        }
        return rows;
    }
    // status (default)
    const groups = new Map();
    for (const t of tasks) {
        const label = String(t?.status?.status ?? 'No status');
        const tone = STATUS_TYPE_TONES[String(t?.status?.type ?? '')] ?? 'muted';
        if (!groups.has(label))
            groups.set(label, { label, tone, tasks: [] });
        groups.get(label).tasks.push(t);
    }
    const rows = [];
    for (const [key, g] of groups) {
        rows.push({ kind: 'header', id: `h${ROW_ID_SEP}${key}`, label: g.label, count: g.tasks.length, tone: g.tone });
        g.tasks.forEach((t) => rows.push({ kind: 'task', id: `t${ROW_ID_SEP}${key}${ROW_ID_SEP}${t.id}`, task: t }));
    }
    return rows;
};
// ── date_to_epoch_ms ─────────────────────────────────────────────────
// A <DateInput>'s "YYYY-MM-DD" to the epoch-ms integer create_task's
// due_date param needs. null (not 0) when blank, so the quick-add form
// can omit due_date entirely rather than sending midnight-UTC-1970.
// Args: { value: string }
const date_to_epoch_ms = (args) => {
    const raw = args.value == null ? '' : String(args.value).trim();
    if (!raw)
        return null;
    const ms = Date.parse(`${raw}T00:00:00Z`);
    return Number.isFinite(ms) ? ms : null;
};
// ── tab_variant ──────────────────────────────────────────────────────
// Args: { active: string, match: string }
const tab_variant = (args) => (String(args.active ?? '') === String(args.match ?? '') ? 'primary' : 'secondary');
// ── is_blank ─────────────────────────────────────────────────────────
// `{"$state": path, "not": true}` as a plain prop value (e.g. a Button's
// `disabled`) does NOT negate -- `not` is only honored by the
// visibility-condition evaluator, confirmed live while building the
// Mail and Folders tile. Use this instead to disable-until-non-blank.
// Args: { value: string }
const is_blank = (args) => !String(args.value ?? '').trim();
// ── priority_value_to_int ────────────────────────────────────────────
// The quick-add priority <Select>'s value is always a string (native
// HTML select); create_task's `priority` param needs an int 1-4, or
// omitted/null when nothing was picked.
// Args: { value: string }
const priority_value_to_int = (args) => {
    const raw = args.value == null ? '' : String(args.value).trim();
    if (!raw)
        return null;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 1 && n <= 4 ? n : null;
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
        channel_type_label,
        channel_type_tone,
        channel_visibility_label,
        list_url,
        explorer_items,
        folder_lists,
        board_rows,
        date_to_epoch_ms,
        tab_variant,
        is_blank,
        priority_value_to_int,
    },
};
export default elements;
