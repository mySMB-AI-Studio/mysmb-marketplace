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
// ── channel_display_name ─────────────────────────────────────────────
// DM and ASK_AI channels carry no `name` field at all (confirmed live) --
// fall back to the type label ("Direct message", etc.) so every channel
// row and the messages-view header always has something to show.
// Args: { name: string | null, type: string | null }
const channel_display_name = (args) => {
    const name = typeof args.name === 'string' ? args.name.trim() : '';
    return name || channel_type_label({ value: args.type });
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
// ── member_options ───────────────────────────────────────────────────
// Turns a list_members response into Select-ready {value,label} options.
// Confirmed live that a member's `username` can be null (email-only
// invite, never set a display name) -- falls back to email, then a
// "User <id>" placeholder, so the picker never shows a blank label.
// Args: { value: array }
const member_options = (args) => {
    const members = Array.isArray(args.value) ? args.value : [];
    return members.map((m) => {
        const id = m.id == null ? '' : String(m.id);
        const username = typeof m.username === 'string' ? m.username.trim() : '';
        const email = typeof m.email === 'string' ? m.email.trim() : '';
        return { value: id, label: username || email || `User ${id}` };
    });
};
// ── assignee_param ───────────────────────────────────────────────────
// Wraps a single Select'ed member id (a string, or '' for "unassigned")
// into the array shape ClickUp's create_task `assignees` param expects.
// Args: { value: string | null }
const assignee_param = (args) => {
    const id = typeof args.value === 'string' ? args.value.trim() : '';
    const n = Number(id);
    return id && Number.isFinite(n) ? [n] : [];
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
        // Each assignee gets its own decorative chart-N tone (cycling, same
        // convention as tag_tone/category_rank_tone) -- "who's carrying what"
        // has no inherent severity ordering, so a flat tone for everyone made
        // every assignee's section look identical. "Unassigned" always sorts
        // last (above) and stays muted rather than taking a chart color, since
        // it's an absence of an assignee, not one more category among equals.
        let colorIndex = 0;
        for (const key of keys) {
            const g = groups.get(key);
            const tone = key === 'unassigned' ? 'muted' : CATEGORY_TONE_CYCLE[colorIndex++ % CATEGORY_TONE_CYCLE.length];
            rows.push({ kind: 'header', id: `h${ROW_ID_SEP}${key}`, label: g.label, count: g.tasks.length, tone });
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
// ── format_duration_ms ───────────────────────────────────────────────
// A time entry's `duration` is an epoch-ms-style string (same convention
// as every other ClickUp date/duration field this plugin already parses)
// representing a LENGTH, not a point in time -- e.g. "5400000" = 1h30m.
// Args: { value: string | number | null }
const format_duration_ms = (args) => {
    const ms = parseClickUpMs(args.value);
    if (ms == null || ms <= 0)
        return '0m';
    const totalMinutes = Math.round(ms / 60_000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0)
        return `${minutes}m`;
    if (minutes === 0)
        return `${hours}h`;
    return `${hours}h ${minutes}m`;
};
// ── total_duration_ms ────────────────────────────────────────────────
// Sums a list of time entries' `duration` fields and formats the total
// the same way format_duration_ms does a single entry.
// Args: { entries: Array<{ duration?: string | number | null }> }
const total_duration_ms = (args) => {
    const entries = Array.isArray(args.entries) ? args.entries : [];
    const totalMs = entries.reduce((sum, e) => sum + (parseClickUpMs(e.duration) ?? 0), 0);
    return format_duration_ms({ value: totalMs });
};
// ── days_ago_ms ──────────────────────────────────────────────────────
// Epoch ms for "N days ago from now, at midnight local time" -- used to
// build list_time_entries' start_date/end_date window from a simple
// "Last N days" button instead of a raw timestamp.
// Args: { days: number | string }
const days_ago_ms = (args) => {
    const days = Number(args.days ?? 0);
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (Number.isFinite(days) ? days : 0));
    return d.getTime();
};
// ── now_ms ───────────────────────────────────────────────────────────
// The current moment, for use as a range's END boundary. Deliberately
// separate from days_ago_ms(0): that function returns midnight at the
// START of today (by design, so "7 days ago" lines up to a clean day
// boundary), which is WRONG as an end boundary -- it excludes everything
// logged later today. Confirmed live: a time entry created minutes
// earlier today didn't show up in Time Tracking's "Last 30 days" filter
// until end_date switched from days_ago_ms(0) to this function.
const now_ms = () => Date.now();
// ── goal_percent_label ──────────────────────────────────────────────
// ClickUp's `percent_completed` on a Goal is a float (e.g. 71.428571…).
// Round it to a whole number for display.
// Args: { value: number }
const goal_percent_label = (args) => {
    const n = Number(args.value);
    if (!Number.isFinite(n))
        return '0%';
    return `${Math.round(n)}%`;
};
// ── goal_progress_tone ───────────────────────────────────────────────
// Semantic (not decorative) tone for a Goal's progress bar/percent --
// unlike CHANNEL_TYPE_TONES' categorical chart-N cycle, "25% complete"
// really is worse than "90% complete", so a status-style tone fits.
// Args: { value: number } -- a Goal's percent_completed (0-100 float)
const goal_progress_tone = (args) => {
    const n = Number(args.value);
    if (!Number.isFinite(n))
        return 'muted';
    if (n >= 100)
        return 'success';
    if (n >= 50)
        return 'accent';
    if (n > 0)
        return 'warning';
    return 'muted';
};
// Decorative categorical cycle (chart-1..5) for things with no inherent
// "good/bad" ordering -- same reasoning as CHANNEL_TYPE_TONES below.
const CATEGORY_TONE_CYCLE = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'];
// ── tag_tone ─────────────────────────────────────────────────────────
// ClickUp Tags carry their own tag_fg/tag_bg hex colors, but this
// renderer's Badge only accepts a token `tone` (no raw-hex prop exists
// on any system component -- confirmed against components.tsx) -- so
// this assigns each tag a stable decorative tone by its position in the
// full tag list, mirroring the system's own `category_rank_tone`
// (functions.ts) but keyed on a tag's `name` field instead of `value`.
// Args: { tags: array (the full list_tags response), name: string }
const tag_tone = (args) => {
    const tags = Array.isArray(args.tags) ? args.tags : [];
    const name = String(args.name ?? '');
    const index = tags.findIndex((t) => String(t?.name ?? '') === name);
    if (index < 0)
        return 'muted';
    return CATEGORY_TONE_CYCLE[index % CATEGORY_TONE_CYCLE.length];
};
// ── custom_field_type_tone ───────────────────────────────────────────
// Categorical (decorative) tone per ClickUp Custom Field `type` -- field
// types confirmed against ClickUp's Custom Fields API docs.
// Args: { value: string | null }
const CUSTOM_FIELD_TYPE_TONES = {
    text: 'chart-1',
    short_text: 'chart-1',
    email: 'chart-1',
    url: 'chart-1',
    phone: 'chart-1',
    drop_down: 'chart-2',
    labels: 'chart-2',
    tasks: 'chart-2',
    users: 'chart-2',
    number: 'chart-3',
    currency: 'chart-3',
    emoji: 'chart-3',
    date: 'chart-4',
    checkbox: 'chart-5',
    manual_progress: 'chart-5',
    automatic_progress: 'chart-5',
};
const custom_field_type_tone = (args) => {
    const v = args.value == null ? '' : String(args.value);
    return CUSTOM_FIELD_TYPE_TONES[v] ?? 'muted';
};
// ── view_type_tone ───────────────────────────────────────────────────
// Categorical (decorative) tone per ClickUp View `type`.
// Args: { value: string | null }
const VIEW_TYPE_TONES = {
    list: 'chart-1',
    board: 'chart-2',
    calendar: 'chart-3',
    gantt: 'chart-4',
    table: 'chart-1',
    doc: 'chart-5',
    location_overview: 'chart-2',
    timeline: 'chart-4',
    workload: 'chart-3',
    activity: 'chart-5',
    map: 'chart-2',
    mind_map: 'chart-5',
    dashboard: 'chart-1',
};
const view_type_tone = (args) => {
    const v = args.value == null ? '' : String(args.value);
    return VIEW_TYPE_TONES[v] ?? 'muted';
};
// ── checklist_badge_tone ─────────────────────────────────────────────
// Semantic tone for a checklist's "{resolved}/{total}" badge -- success
// once every item is resolved, accent for partial progress, muted for an
// empty (no items yet) checklist.
// Args: { resolved: number, total: number }
const checklist_badge_tone = (args) => {
    const resolved = Number(args.resolved ?? 0);
    const total = Number(args.total ?? 0);
    if (total <= 0)
        return 'muted';
    if (resolved >= total)
        return 'success';
    if (resolved > 0)
        return 'accent';
    return 'muted';
};
// ── dependency_tone ──────────────────────────────────────────────────
// Semantic tone per dependency_rows' `kind`/`label` -- "Waiting on" means
// THIS task is blocked by another one (worth flagging, warning), "Blocking"
// means this task blocks someone else (informational, not a problem for
// the viewer), "Linked task" is a plain non-directional link (muted).
// Args: { label: string }
const dependency_tone = (args) => {
    const label = String(args.label ?? '');
    if (label === 'Waiting on')
        return 'warning';
    if (label === 'Blocking')
        return 'info';
    return 'muted';
};
// ── checklist_rows ───────────────────────────────────────────────────
// Flattens a task's `checklists` array (each with its own nested `items`)
// into ONE array of header + item rows for a single non-nested `repeat`,
// following the same flattening convention as `board_rows` -- nested
// `repeat` is untested in this renderer, so two-level data always gets
// flattened with a synthetic `id` + `kind` tag instead.
// Args: { checklists: array }
const checklist_rows = (args) => {
    const checklists = Array.isArray(args.checklists) ? args.checklists : [];
    const rows = [];
    for (const cl of checklists) {
        const clId = String(cl.id ?? '');
        const resolved = Number(cl.resolved ?? 0);
        const unresolved = Number(cl.unresolved ?? 0);
        rows.push({ id: `h::${clId}`, kind: 'header', name: cl.name, resolved, total: resolved + unresolved });
        const items = Array.isArray(cl.items) ? cl.items : [];
        for (const item of items) {
            rows.push({
                id: `i::${clId}::${String(item.id ?? '')}`,
                kind: 'item',
                name: item.name,
                resolved: Boolean(item.resolved),
            });
        }
    }
    return rows;
};
// ── dependency_rows ──────────────────────────────────────────────────
// Combines a task's `dependencies` (waiting-on / blocking links to other
// tasks) and `linked_tasks` (plain links) into one flat array, each row
// tagged with which OTHER task it points at and a plain-English label --
// ClickUp's dependency objects only carry task ids on both sides, so the
// row's own task_id/depends_on (or task_id/link_id) pair is compared
// against the current task to work out which id is "the other one".
// Args: { dependencies: array, linked_tasks: array, task_id: string }
const dependency_rows = (args) => {
    const taskId = String(args.task_id ?? '');
    const deps = Array.isArray(args.dependencies) ? args.dependencies : [];
    const links = Array.isArray(args.linked_tasks) ? args.linked_tasks : [];
    const rows = [];
    deps.forEach((d, i) => {
        const depTaskId = String(d.task_id ?? '');
        const dependsOn = String(d.depends_on ?? '');
        const otherId = depTaskId === taskId ? dependsOn : depTaskId;
        const label = depTaskId === taskId ? 'Waiting on' : 'Blocking';
        if (!otherId)
            return;
        rows.push({ id: `dep::${i}::${otherId}`, kind: 'dependency', label, otherTaskId: otherId });
    });
    links.forEach((l, i) => {
        const a = String(l.task_id ?? '');
        const b = String(l.link_id ?? '');
        const otherId = a === taskId ? b : a;
        if (!otherId)
            return;
        rows.push({ id: `link::${i}::${otherId}`, kind: 'link', label: 'Linked task', otherTaskId: otherId });
    });
    return rows;
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
        format_duration_ms,
        total_duration_ms,
        days_ago_ms,
        now_ms,
        goal_percent_label,
        checklist_rows,
        dependency_rows,
        channel_display_name,
        member_options,
        assignee_param,
        goal_progress_tone,
        tag_tone,
        custom_field_type_tone,
        view_type_tone,
        checklist_badge_tone,
        dependency_tone,
    },
};
export default elements;
