/**
 * monday.com's board activity log reports events as internal snake_case
 * codes (e.g. "create_pulse", "change_column_value") — not something to
 * show a user as-is. Maps the common codes to a short human phrase;
 * anything unrecognised falls back to a humanized version of the code
 * itself (underscores → spaces, first letter capitalized) rather than
 * hiding or erroring on an event monday adds later.
 *
 * Args: { value: string }
 *
 * Spec example:
 *   { "$computed": "monday_activity_label", "args": { "value": { "$item": "event" } } }
 */
const KNOWN_EVENTS = {
    create_pulse: 'created an item',
    delete_pulse: 'deleted an item',
    archive_pulse: 'archived an item',
    duplicate_pulse: 'duplicated an item',
    // monday fires "move_pulse_from_group"/"_into_group" as a pair of events
    // for a single drag — confirmed against real activity logs — both read
    // fine as the same phrase since the row's own timestamp/context already
    // disambiguates direction.
    move_pulse_into_group: 'moved an item',
    move_pulse_from_group: 'moved an item',
    update_name: 'renamed an item',
    update_column_value: 'updated a column value',
    create_update: 'posted an update',
    delete_update: 'deleted an update',
    create_column: 'added a column',
    delete_column: 'deleted a column',
    // Guessed names kept in case a different monday API version/event uses
    // them — harmless if never matched, and the generic humanized fallback
    // covers anything unrecognized either way.
    change_column_value: 'updated a column value',
    change_column_metadata: 'renamed a column',
    create_group: 'added a group',
    delete_group: 'deleted a group',
    archive_group: 'archived a group',
    create_board: 'created the board',
    archive_board: 'archived the board',
    add_subscribers_to_board: 'added subscribers',
    remove_subscribers_from_board: 'removed subscribers',
};
function labelForEvent(raw) {
    const trimmed = raw.trim();
    if (!trimmed)
        return '';
    const known = KNOWN_EVENTS[trimmed];
    if (known)
        return known;
    const humanized = trimmed.replace(/_/g, ' ');
    return humanized.charAt(0).toUpperCase() + humanized.slice(1);
}
const activity_label = (args) => labelForEvent(String(args.value ?? ''));
const KNOWN_ENTITIES = { pulse: 'Item', board: 'Board' };
/**
 * Humanizes monday's `entity` field ("pulse" → "Item", "board" → "Board").
 * monday calls board items "pulses" internally — not a word to show a user.
 *
 * Args: { value: string }
 *
 * Spec example:
 *   { "$computed": "monday_entity_label", "args": { "value": { "$item": "entity" } } }
 */
const entity_label = (args) => {
    const raw = String(args.value ?? '').trim();
    if (!raw)
        return '';
    return KNOWN_ENTITIES[raw] ?? raw.charAt(0).toUpperCase() + raw.slice(1);
};
/**
 * Pretty-prints a JSON string for display (monday's activity_logs `data`
 * field). Falls back to the raw string unchanged if it isn't valid JSON —
 * never hides or errors on a shape monday changes later.
 *
 * Args: { value: string }
 *
 * Spec example:
 *   { "$computed": "monday_pretty_json", "args": { "value": { "$item": "data" } } }
 */
const pretty_json = (args) => {
    const raw = String(args.value ?? '');
    if (!raw)
        return '';
    try {
        return JSON.stringify(JSON.parse(raw), null, 2);
    }
    catch {
        return raw;
    }
};
/**
 * Display-ready state for the Board Activity tile: flattens monday's raw
 * activity rows (nested `user: { name }`, raw `event` codes) into
 * `actor_name`/`action_text`/`created_at` plus the raw `event`/`entity`/`data`
 * fields for the expanded detail view, and precomputes the scope caption.
 * Kept separate from per-item `relative_time`/`format_date` bindings in the
 * JSON itself — those must stay live-computed at render time (baking a
 * "3 minutes ago" string into this view-model would go stale between
 * re-renders), matching the Board Snapshot freshness caption below.
 *
 * Args: { value: array }
 *
 * Spec example:
 *   { "$computed": "monday_activity_dashboard", "args": { "value": { "$state": "/monday/get_board_activity" } } }
 */
/**
 * Pulls a human-readable string out of a monday activity-log field value,
 * which can be a plain string, a number/boolean, or a nested object shaped
 * differently per column type (`{name: "..."}` for a name/text column,
 * `{label: "..."}` or `{label: {text: "..."}}` for others). Falls back to an
 * em dash for anything unrecognized rather than guessing — the caller treats
 * that as "nothing readable came out of this."
 */
function textOf(v) {
    if (v === null || v === undefined)
        return '—';
    if (typeof v === 'string')
        return v || '—';
    if (typeof v === 'number' || typeof v === 'boolean')
        return String(v);
    if (typeof v === 'object') {
        const o = v;
        if (typeof o.name === 'string' && o.name)
            return o.name;
        if (typeof o.label === 'string' && o.label)
            return o.label;
        const nestedLabel = (o.label ?? null);
        if (nestedLabel && typeof nestedLabel.text === 'string' && nestedLabel.text)
            return nestedLabel.text;
        if (typeof o.text === 'string' && o.text)
            return o.text;
    }
    return '—';
}
/**
 * Turns an activity row's raw `data` field (monday's own internal payload
 * shape, which varies per event type) into one readable sentence for the
 * two event types that dominate real activity logs — a rename or a column
 * value change. Everything else returns '' (no detail row shown) rather
 * than falling back to a pretty-printed JSON blob: a raw `{"column_title":
 * "Name", "group_id": "group_mm8sb8qf", ...}` dump reads like unfinished
 * debug output, confirmed directly from a real monday.com activity log
 * during live testing — not worth showing over no detail at all.
 *
 * Spec example:
 *   { "$computed": "monday_activity_detail", "args": { "event": { "$item": "event" }, "data": { "$item": "data" } } }
 */
const activity_detail = (args) => {
    const event = String(args.event ?? '');
    const raw = args.data;
    let data;
    if (typeof raw === 'string' && raw) {
        try {
            data = JSON.parse(raw);
        }
        catch {
            return '';
        }
    }
    else if (raw && typeof raw === 'object') {
        data = raw;
    }
    else {
        return '';
    }
    if (event === 'update_name') {
        const from = textOf(data.previous_value);
        const to = textOf(data.value);
        return from === '—' && to === '—' ? '' : `Renamed from "${from}" to "${to}"`;
    }
    if (event === 'update_column_value' || event === 'change_column_value') {
        const column = typeof data.column_title === 'string' ? data.column_title.trim() : '';
        const from = textOf(data.previous_value);
        const to = textOf(data.value);
        if (from === '—' && to === '—')
            return '';
        return column ? `${column}: "${from}" → "${to}"` : `"${from}" → "${to}"`;
    }
    return '';
};
const activity_dashboard = (args) => {
    const arr = Array.isArray(args.value) ? args.value : [];
    const rows = arr.map((row) => {
        const r = (row ?? {});
        const user = (r.user ?? null);
        const actorName = typeof user?.name === 'string' && user.name ? user.name : 'Someone';
        const event = String(r.event ?? '');
        return {
            id: r.id,
            actor_name: actorName,
            action_text: labelForEvent(event),
            created_at: r.created_at,
            event,
            entity: r.entity,
            detailText: activity_detail({ event, data: r.data }),
        };
    });
    const total = rows.length;
    return {
        hasData: total > 0,
        total,
        scopeText: total > 0 ? `Showing the last ${total.toLocaleString('en-US')} ${total === 1 ? 'event' : 'events'}` : '',
        rows,
    };
};
/**
 * Display-ready state for My Profile: pulls the pieces of `get_user_context`
 * the tile shows into one shape, so the JSON only ever binds flat fields
 * (no dotted `account.name` reads, which `$item`/plain `$state` reads don't
 * support reliably across this system — see [[project-widget-binding-timing]]).
 *
 * Args: { context: object } — the raw `get_user_context` result.
 *
 * Spec example:
 *   { "$computed": "monday_profile_dashboard", "args": { "context": { "$state": "/monday/get_user_context" } } }
 */
const profile_dashboard = (args) => {
    const ctx = (args.context && typeof args.context === 'object' ? args.context : {});
    const name = typeof ctx.name === 'string' ? ctx.name.trim() : '';
    const account = (ctx.account ?? null);
    return {
        hasData: !!name,
        name: name || 'Unknown user',
        email: typeof ctx.email === 'string' ? ctx.email : '',
        title: typeof ctx.title === 'string' ? ctx.title.trim() : '',
        accountName: typeof account?.name === 'string' ? account.name : '',
    };
};
const KIND_TONES = { main: 'brand', shareable: 'success', template: 'muted' };
function kindTone(kind) {
    return KIND_TONES[kind.toLowerCase()] ?? 'muted';
}
function titleCase(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
/**
 * Display-ready state for Workspaces: a headline total, a kind breakdown
 * (main/shareable/template/other — busiest first) for the colored dot-row
 * list, and the plain row list for the detail view. One dashboard function
 * per tile, not scattered `count`/`filter_by` calls in the JSON — see
 * [[reference-tile-visual-design-patterns]].
 *
 * Args: { value: array } — the raw `list_workspaces` `.workspaces` array.
 *
 * Spec example:
 *   { "$computed": "monday_workspaces_dashboard", "args": { "value": { "$state": "/monday/list_workspaces/workspaces" } } }
 */
/** "1 board" vs "3 boards" — monday.com·count eyebrows read oddly otherwise ("1 boards"). */
function pluralCount(n, singular, plural = `${singular}s`) {
    return `${n.toLocaleString('en-US')} ${n === 1 ? singular : plural}`;
}
const workspaces_dashboard = (args) => {
    const list = Array.isArray(args.value) ? args.value : [];
    const total = list.length;
    const counts = {};
    for (const ws of list) {
        const kind = String(ws.kind ?? 'other').trim().toLowerCase() || 'other';
        counts[kind] = (counts[kind] ?? 0) + 1;
    }
    const kindRows = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([kind, count]) => ({ kind: titleCase(kind), count, tone: kindTone(kind) }));
    const rows = list.map((ws) => ({
        id: ws.id,
        name: ws.name,
        description: typeof ws.description === 'string' ? ws.description : '',
        kind: titleCase(String(ws.kind ?? '').trim() || 'other'),
        kindTone: kindTone(String(ws.kind ?? 'other')),
    }));
    return {
        hasData: total > 0,
        total,
        scopeText: `monday.com · ${pluralCount(total, 'workspace')}`,
        kindRows,
        rows,
    };
};
/**
 * Display-ready state for My Boards: total/active/archived counts with
 * their share of the total (for the stat-grid + bar cells). The Table
 * below still reads the raw `/monday/get_board_info/boards` array directly
 * — `Table`'s `field` resolution supports dotted paths (`workspace.name`),
 * unlike `$item` elsewhere, so no reshaping is needed for it.
 *
 * Args: { value: array } — the raw `get_board_info` `.boards` array.
 *
 * Spec example:
 *   { "$computed": "monday_boards_dashboard", "args": { "value": { "$state": "/monday/get_board_info/boards" } } }
 */
const boards_dashboard = (args) => {
    const list = Array.isArray(args.value) ? args.value : [];
    const total = list.length;
    const active = list.filter((b) => String(b.state ?? '').trim().toLowerCase() === 'active').length;
    const archived = list.filter((b) => String(b.state ?? '').trim().toLowerCase() === 'archived').length;
    const pct = (n) => (total > 0 ? Math.round((n / total) * 100) : 0);
    return {
        hasData: total > 0,
        total,
        scopeText: `monday.com · ${pluralCount(total, 'board')}`,
        activeCount: active,
        activePct: pct(active),
        archivedCount: archived,
        archivedPct: pct(archived),
    };
};
/** First and last word of a name, e.g. "Sean Matthew Baker" → "SB". Falls back to "?" for a blank name. */
function initialsOf(name) {
    const words = name.split(/\s+/).filter(Boolean);
    const picked = words.length > 1 ? [words[0], words[words.length - 1]] : words;
    return picked.map((w) => w[0].toUpperCase()).join('') || '?';
}
/**
 * Display-ready state for Team Members: total/admin/guest counts with
 * their share of the total, and one row per member with initials, a role
 * label ("Admin"/"Guest"/"Member", one badge instead of two conditionally-
 * visible ones) and matching tones precomputed.
 *
 * Args: { value: array } — the raw `list_users_and_teams` `.users` array.
 *
 * Spec example:
 *   { "$computed": "monday_team_dashboard", "args": { "value": { "$state": "/monday/list_users_and_teams/users" } } }
 */
const team_dashboard = (args) => {
    const list = Array.isArray(args.value) ? args.value : [];
    const total = list.length;
    const admins = list.filter((u) => u.is_admin === true).length;
    const guests = list.filter((u) => u.is_guest === true).length;
    const pct = (n) => (total > 0 ? Math.round((n / total) * 100) : 0);
    const rows = list.map((u) => {
        const name = String(u.name ?? '').trim() || 'Unnamed';
        const isAdmin = u.is_admin === true;
        const isGuest = u.is_guest === true;
        const roleLabel = isAdmin ? 'Admin' : isGuest ? 'Guest' : 'Member';
        const roleTone = isAdmin ? 'brand' : isGuest ? 'muted' : 'success';
        return {
            id: u.id,
            name,
            email: typeof u.email === 'string' ? u.email : '',
            initials: initialsOf(name),
            avatarTone: isAdmin ? 'brand' : 'muted',
            roleLabel,
            roleTone,
        };
    });
    return {
        hasData: total > 0,
        total,
        scopeText: `monday.com · ${pluralCount(total, 'member')}`,
        adminCount: admins,
        adminPct: pct(admins),
        guestCount: guests,
        guestPct: pct(guests),
        rows,
    };
};
/**
 * Display-ready state for Board Snapshot: item/group/column-type counts for
 * the headline stat grid, plus the groups array passed straight through for
 * the existing `BarChart`. `updated_at`'s `relative_time` formatting stays a
 * live `$computed` at the binding site in the JSON (not baked in here) so it
 * doesn't go stale between re-renders — same reasoning as the activity
 * dashboard above.
 *
 * Takes each field as its OWN arg bound to its own `/monday/board_insights/<field>`
 * state path — NOT one `value` arg bound to the bare `/monday/board_insights`
 * path. Confirmed against `resultToStateWrites` (myHubV2's
 * `widgets-system/call-tool.ts`): a tool result that's a plain object (not an
 * array) is fanned out into one state write per field — the bare base path
 * itself is never written. `board_insights` returns exactly that shape (a
 * flat object), so a `value` arg bound to the bare path always reads
 * `undefined` — confirmed live (real monday data, real board, real token):
 * the tile rendered completely blank past the board picker, no error, no
 * loading spinner, because `hasData` was permanently false. (Board Items'
 * and Board Activity's dashboard fns don't have this bug because their tools
 * return an array at the top level, which the SAME helper writes to the bare
 * base path directly — see those tools' own fan-out behavior before copying
 * this one-`value`-arg shape onto a new tool without checking its result shape.)
 *
 * Args: { id, totalItems, groups: array, columnTypes: array } — each bound to
 *   its own `/monday/board_insights/<field>` path.
 *
 * Spec example:
 *   { "$computed": "monday_board_snapshot_dashboard", "args": {
 *       "id": { "$state": "/monday/board_insights/id" },
 *       "totalItems": { "$state": "/monday/board_insights/total_items" },
 *       "groups": { "$state": "/monday/board_insights/groups" },
 *       "columnTypes": { "$state": "/monday/board_insights/column_types" } } }
 */
const board_snapshot_dashboard = (args) => {
    const groups = Array.isArray(args.groups) ? args.groups : [];
    const columnTypes = Array.isArray(args.columnTypes) ? args.columnTypes : [];
    return {
        hasData: args.id !== undefined && args.id !== null && args.id !== '',
        totalItems: Number(args.totalItems) || 0,
        groupCount: groups.length,
        columnCount: columnTypes.length,
        groups,
        columnTypesText: columnTypes.length ? `Column types: ${columnTypes.join(', ')}` : '',
    };
};
const columnsOf = (item) => (Array.isArray(item.column_values) ? item.column_values : []);
function findStatusColumnId(items) {
    const firstColumns = columnsOf(items[0] ?? {});
    const byTitle = firstColumns.find((cv) => String(cv.title ?? '').trim().toLowerCase() === 'status');
    const byType = firstColumns.find((cv) => cv.type === 'status');
    const target = byTitle ?? byType;
    return target ? String(target.id) : null;
}
function readStatusText(item, columnId) {
    if (!columnId)
        return 'No status';
    const match = columnsOf(item).find((cv) => cv.id === columnId);
    const text = typeof match?.text === 'string' ? match.text.trim() : '';
    return text || 'No status';
}
const KNOWN_STATUS_TONES = {
    Done: 'success',
    'Working on it': 'warning',
    Stuck: 'destructive',
};
/**
 * Display-ready state for Board Items: total/group/done counts for the hero
 * stat + chips, a status-tone-mapped row per item for the colored badge
 * list, and `segments` pre-shaped for `Donut`. Replaces the earlier
 * scattered `count`/`distinct_by`/`count_where`/`monday_status_tone` calls
 * spread across the widget JSON with one function, per
 * [[reference-tile-visual-design-patterns]] — anything not in
 * `KNOWN_STATUS_TONES` (including "Not Started"/"No status" and any custom
 * label a board defines) renders `muted` rather than guessing a color that
 * might read as more or less urgent than it is.
 *
 * Args: { value: array } — raw items from `get_board_items_page`, each with
 *   a `column_values: [{ id, title, type, text }]` array and a `group`.
 *
 * Spec example:
 *   { "$computed": "monday_board_items_dashboard", "args": { "value": { "$state": "/monday/get_board_items_page/items" } } }
 */
const board_items_dashboard = (args) => {
    const items = Array.isArray(args.value) ? args.value : [];
    const total = items.length;
    const columnId = findStatusColumnId(items);
    const groupTitles = new Set();
    const statusCounts = {};
    const rows = items.map((item) => {
        const group = (item.group ?? null);
        const groupTitle = typeof group?.title === 'string' ? group.title : '';
        const status = readStatusText(item, columnId);
        if (groupTitle)
            groupTitles.add(groupTitle);
        statusCounts[status] = (statusCounts[status] ?? 0) + 1;
        return {
            id: item.id,
            name: item.name,
            updatedAt: item.updated_at,
            groupTitle,
            status,
            statusTone: KNOWN_STATUS_TONES[status] ?? 'muted',
        };
    });
    const segments = Object.entries(statusCounts).map(([status, count]) => ({
        value: count,
        label: status,
        tone: KNOWN_STATUS_TONES[status] ?? 'muted',
    }));
    return {
        hasData: total > 0,
        total,
        groupCount: groupTitles.size,
        doneCount: statusCounts.Done ?? 0,
        rows,
        segments,
    };
};
/**
 * Looks up the real monday.com URL for the currently-selected board, for a
 * tile's "Open in monday.com" button. `boards` is the raw array from
 * get_board_info (each with its own `url`, exposed by myhub-mcp-servers —
 * never hand-build a monday board URL, see that fix's own commit message
 * for why). Returns '' when no board is selected or found, so a bound
 * Button can stay disabled rather than linking nowhere. Kept separate from
 * `board_items_dashboard` above since it reads a different source
 * (`get_board_info`, not `get_board_items_page`) and has its own watch
 * trigger (`/ui/selectedBoardId`, not the items report).
 *
 * Args: { boards: array, selectedId: string }
 *
 * Spec example:
 *   { "$computed": "monday_board_url", "args": { "boards": { "$state": "/monday/get_board_info/boards" }, "selectedId": { "$state": "/ui/selectedBoardId" } } }
 */
const board_url = (args) => {
    const boards = Array.isArray(args.boards) ? args.boards : [];
    const selectedId = String(args.selectedId ?? '');
    if (!selectedId)
        return '';
    const match = boards.find((b) => String(b.id ?? '') === selectedId);
    return typeof match?.url === 'string' ? match.url : '';
};
const elements = {
    slug: 'monday',
    functions: {
        activity_label,
        entity_label,
        pretty_json,
        activity_dashboard,
        profile_dashboard,
        workspaces_dashboard,
        boards_dashboard,
        team_dashboard,
        board_snapshot_dashboard,
        board_items_dashboard,
        board_url,
    },
};
export default elements;
