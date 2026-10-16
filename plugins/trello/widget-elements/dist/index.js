const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function formatDdMmmYy(isoDate) {
    const ms = Date.parse(isoDate);
    if (Number.isNaN(ms))
        return '';
    const d = new Date(ms);
    const day = String(d.getDate()).padStart(2, '0');
    const month = MONTH_ABBR[d.getMonth()];
    const year = String(d.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
}
/**
 * Derives a due-date label/tone pair for one card, following
 * TILE-DISPLAY-STANDARDS.md §7's exact overdue-escalation model: muted while
 * not yet due, warning on the due date itself (that day only), destructive
 * from the day after — no further grace period, no "success" for a merely
 * not-yet-due card (success is reserved for done/paid/completed elsewhere in
 * this doc).
 */
function dueLabelAndTone(due, dueComplete) {
    if (dueComplete)
        return { label: due ? formatDdMmmYy(due) : 'Completed', tone: 'success' };
    if (!due)
        return { label: '', tone: 'muted' };
    const dueMs = Date.parse(due);
    if (Number.isNaN(dueMs))
        return { label: '', tone: 'muted' };
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayMs = Date.parse(todayStr);
    const dueDateStr = due.slice(0, 10);
    if (dueDateStr === todayStr)
        return { label: 'Due Today', tone: 'warning' };
    if (dueMs < todayMs)
        return { label: formatDdMmmYy(due), tone: 'destructive' };
    return { label: formatDdMmmYy(due), tone: 'muted' };
}
/**
 * Flattens a list_my_cards response into Upcoming / Overdue / Completed tabs
 * for the My Cards tile — mirrors Asana's My Tasks tabbed layout, adapted to
 * Trello's data shape: Trello cards have no `completed` boolean the way Asana
 * tasks do, so `dueComplete` (the due-date checkbox) is the closest real
 * analog and drives the Completed bucket here.
 *
 * Args: { value: array } — list_my_cards' `data` array (each row already
 * carries a resolved `board_name` from the MCP tool).
 */
const flatten_my_cards_tabs = (args) => {
    const raw = Array.isArray(args.value) ? args.value : [];
    if (raw.length === 0)
        return { upcoming: [], overdue: [], completed: [] };
    const upcoming = [];
    const overdue = [];
    const completed = [];
    for (const card of raw) {
        const id = String(card.id ?? '');
        const title = String(card.name ?? '');
        const boardLabel = String(card.board_name ?? '');
        const due = card.due ? String(card.due) : null;
        const dueComplete = Boolean(card.dueComplete);
        const { label: dueLabel, tone: dueTone } = dueLabelAndTone(due, dueComplete);
        const sortMs = due ? (Date.parse(due) || Infinity) : (dueComplete ? -1 : Infinity);
        const row = { id, title, board_label: boardLabel, due_label: dueLabel, due_tone: dueTone, _sort: sortMs };
        if (dueComplete) {
            completed.push(row);
        }
        else if (due && !Number.isNaN(Date.parse(due)) && due.slice(0, 10) < new Date().toISOString().slice(0, 10)) {
            overdue.push(row);
        }
        else {
            upcoming.push(row);
        }
    }
    upcoming.sort((a, b) => a._sort - b._sort);
    overdue.sort((a, b) => a._sort - b._sort);
    const clean = (rows) => rows.map(({ _sort: _s, ...r }) => r);
    return { upcoming: clean(upcoming), overdue: clean(overdue), completed: clean(completed) };
};
/**
 * Flattens a list_my_cards response into display rows for the Overdue Cards
 * tile — mirrors Asana's Overdue Tasks tile exactly: per-card "Nd overdue"
 * badges, sorted most-overdue-first, with aggregate stats on row 0
 * (stat_overdue, stat_boards, stat_longest).
 *
 * Args: { value: array } — list_my_cards' `data` array.
 */
const flatten_overdue_cards = (args) => {
    const raw = Array.isArray(args.value) ? args.value : [];
    if (raw.length === 0)
        return [];
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayMs = Date.parse(todayStr);
    const overdueItems = [];
    for (const card of raw) {
        if (card.dueComplete)
            continue;
        const due = card.due ? String(card.due) : null;
        if (!due)
            continue;
        const dueDateStr = due.slice(0, 10);
        if (dueDateStr >= todayStr)
            continue;
        const daysOverdue = Math.round((todayMs - Date.parse(dueDateStr)) / 86400000);
        overdueItems.push({ card, daysOverdue });
    }
    if (overdueItems.length === 0)
        return [];
    overdueItems.sort((a, b) => b.daysOverdue - a.daysOverdue);
    const uniqueBoards = new Set(overdueItems.map((i) => String(i.card.board_name ?? '')).filter(Boolean));
    const longestDays = overdueItems[0].daysOverdue;
    const rows = overdueItems.map((item) => ({
        id: String(item.card.id ?? ''),
        title: String(item.card.name ?? ''),
        board_label: String(item.card.board_name ?? ''),
        overdue_label: `${item.daysOverdue}d overdue`,
        stat_overdue: '',
        stat_boards: '',
        stat_longest: '',
    }));
    rows[0].stat_overdue = String(overdueItems.length);
    rows[0].stat_boards = String(uniqueBoards.size);
    rows[0].stat_longest = `${longestDays}d`;
    return rows;
};
/**
 * Flattens a list_boards response into display rows for the Boards tile.
 * Row 0 carries stat_total.
 *
 * Args: { value: array } — list_boards' `data` array.
 */
const flatten_boards = (args) => {
    const raw = Array.isArray(args.value) ? args.value : [];
    if (raw.length === 0)
        return [];
    const rows = raw.map((board) => ({
        id: String(board.id ?? ''),
        name: String(board.name ?? ''),
        url: String(board.shortUrl ?? board.url ?? ''),
        stat_total: '',
    }));
    rows[0].stat_total = String(raw.length);
    return rows;
};
/**
 * Formats the "N lists · N cards tracked" summary line for the Board Health
 * Overview tile.
 *
 * Args: { value: object } — get_boards_health_summary's response object
 * ({ total_lists, total_cards_tracked, ... }).
 */
const format_lists_cards_summary = (args) => {
    const v = (args.value ?? {});
    const lists = Number(v.total_lists ?? 0);
    const cards = Number(v.total_cards_tracked ?? 0);
    return `${lists} list${lists === 1 ? '' : 's'} · ${cards} card${cards === 1 ? '' : 's'} tracked`;
};
/**
 * Flattens a list_all_lists response into display rows for the Board Health
 * Overview tile's in-tile list drill-down. Each row carries the list's own
 * name plus its board name as a caption, grouped implicitly by Trello's
 * natural board order (list_all_lists' per-board fan-out order) rather than
 * an explicit sort — this is an expand-to-browse view, not a report, so
 * stable-but-arbitrary ordering is fine.
 *
 * Args: { value: array } — list_all_lists' `data` array.
 */
const flatten_all_lists = (args) => {
    const raw = Array.isArray(args.value) ? args.value : [];
    return raw.map((list) => ({
        id: String(list.id ?? ''),
        name: String(list.name ?? ''),
        board_label: String(list.board_name ?? ''),
    }));
};
/**
 * Flattens a list_all_cards response into display rows for the Board Health
 * Overview tile's in-tile card drill-down — the sibling of flatten_all_lists,
 * reusing the same due-date label/tone logic as the My Cards / Overdue Cards
 * tiles for consistency.
 *
 * Args: { value: array } — list_all_cards' `data` array.
 */
const flatten_all_cards = (args) => {
    const raw = Array.isArray(args.value) ? args.value : [];
    return raw.map((card) => {
        const due = card.due ? String(card.due) : null;
        const { label, tone } = dueLabelAndTone(due, Boolean(card.dueComplete));
        return {
            id: String(card.id ?? ''),
            name: String(card.name ?? ''),
            board_label: String(card.board_name ?? ''),
            due_label: label,
            due_tone: tone,
        };
    });
};
/**
 * Buckets a list_all_cards response into overdue / due-today / due-this-week
 * counts for the Due Date Tracker tile. A card counts toward exactly one
 * bucket, or none at all:
 *   - overdue: has a due date, not dueComplete, date is before today.
 *   - today: has a due date, not dueComplete, date is today.
 *   - week: has a due date, not dueComplete, date is 1-7 days from today.
 * Cards with no due date, already dueComplete, or due more than 7 days out
 * are excluded entirely.
 *
 * Also returns the actual card rows per bucket (id, name, board_label,
 * due_label), not just counts — powers the tile's click-to-expand detail
 * view. Reuses the same list_all_cards data already fetched for the counts;
 * no extra tool call needed.
 *
 * Args: { value: array } — list_all_cards' `data` array.
 */
const flatten_due_date_tracker = (args) => {
    const raw = Array.isArray(args.value) ? args.value : [];
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayMs = Date.parse(todayStr);
    const weekAheadMs = todayMs + 7 * 86400000;
    const overdueRows = [];
    const todayRows = [];
    const weekRows = [];
    for (const card of raw) {
        if (card.dueComplete)
            continue;
        const due = card.due ? String(card.due) : null;
        if (!due)
            continue;
        const dueDateStr = due.slice(0, 10);
        const dueMs = Date.parse(dueDateStr);
        if (Number.isNaN(dueMs))
            continue;
        const row = {
            id: String(card.id ?? ''),
            name: String(card.name ?? ''),
            board_label: String(card.board_name ?? ''),
            due_label: formatDdMmmYy(due),
        };
        if (dueDateStr === todayStr) {
            todayRows.push(row);
        }
        else if (dueMs < todayMs) {
            overdueRows.push(row);
        }
        else if (dueMs <= weekAheadMs) {
            weekRows.push(row);
        }
    }
    return {
        overdue_count: overdueRows.length,
        today_count: todayRows.length,
        week_count: weekRows.length,
        overdue_rows: overdueRows,
        today_rows: todayRows,
        week_rows: weekRows,
    };
};
/**
 * Formats one Due Date Tracker legend entry, e.g. "Overdue · 7".
 *
 * Args: { label: string, value: number }
 */
const format_tracker_legend = (args) => {
    const label = String(args.label ?? '');
    const value = Number(args.value ?? 0);
    return `${label} · ${value}`;
};
/**
 * Turns a raw member name into "F. Lastname" display + "FL" initials.
 * Handles the data-quality wrinkle also seen in Asana's own team-workload
 * tile: some accounts have no display name set, so `name` is a raw email —
 * split on "." in the local part to recover a name-shaped string first.
 */
function formatPersonName(rawName) {
    let fullName = rawName.trim();
    if (fullName.includes('@')) {
        const localPart = fullName.split('@')[0];
        fullName = localPart
            .split(/[.\-_]+/)
            .filter(Boolean)
            .map((p) => p[0].toUpperCase() + p.slice(1))
            .join(' ');
    }
    if (!fullName)
        return { displayName: '', initials: '' };
    const parts = fullName.split(/\s+/).filter(Boolean);
    const displayName = parts.length >= 2 ? `${parts[0][0]}. ${parts[parts.length - 1]}` : fullName;
    const initials = (parts.length >= 2
        ? `${parts[0][0]}${parts[parts.length - 1][0]}`
        : fullName.slice(0, 2)).toUpperCase();
    return { displayName, initials };
}
// chart-4 (#d6409f, hot pink/magenta) excluded deliberately per feedback --
// reads as too loud/unprofessional for a business-workload tile. The
// remaining 4 (blurple / teal / amber / sky blue) stay within a calmer,
// more conventional business palette while still giving each person a
// distinct, deterministic color.
const CHART_TONES = ['chart-1', 'chart-2', 'chart-3', 'chart-5'];
/**
 * Flattens a get_team_workload response into display rows for the Team
 * Workload tile. Sorts descending by count, derives "F. Lastname" + initials
 * per member, assigns each a deterministic chart-1..5 tone (categorical, not
 * status — per TILE-DISPLAY-STANDARDS.md §7's "coloring several arbitrary
 * category labels distinctly" guidance, same pattern as Asana's own
 * recent-activity avatar coloring), and scales each bar relative to the top
 * member's count (not the grand total) — matching Asana's own Team Workload
 * tile's pct formula in this same codebase.
 *
 * Args: { value: array } — get_team_workload's `members` array.
 */
const flatten_team_workload = (args) => {
    const raw = Array.isArray(args.value) ? args.value : [];
    if (raw.length === 0)
        return [];
    const sorted = [...raw].sort((a, b) => Number(b.count ?? 0) - Number(a.count ?? 0));
    const maxCount = Number(sorted[0].count ?? 0);
    return sorted.map((member) => {
        const rawName = String(member.name ?? '');
        const { displayName, initials } = formatPersonName(rawName);
        const count = Number(member.count ?? 0);
        const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
        let hash = 0;
        for (let i = 0; i < rawName.length; i++)
            hash = (hash * 31 + rawName.charCodeAt(i)) >>> 0;
        const avatarTone = rawName ? CHART_TONES[hash % CHART_TONES.length] : 'muted';
        const rawCards = Array.isArray(member.cards) ? member.cards : [];
        const cards = rawCards.map((card) => ({
            id: String(card.id ?? ''),
            name: String(card.name ?? ''),
            board_label: String(card.board_name ?? ''),
        }));
        return {
            member_id: String(member.member_id ?? ''),
            name: displayName || rawName,
            initials,
            count,
            pct,
            avatar_tone: avatarTone,
            cards,
        };
    });
};
/** Number of per-row inline card slots rendered before falling back to "+N more". */
const TEAM_WORKLOAD_INLINE_CARD_SLOTS = 5;
/**
 * Formats the "+N more" overflow caption for a Team Workload row's inline
 * card list. Rendered inline (not via repeat — nested repeats aren't
 * supported by this renderer) as a bounded set of positional $item slots
 * (cards/0, cards/1, ... cards/4); this covers whatever's left beyond that
 * bound rather than silently truncating with no disclosure.
 *
 * Args: { count: number }
 */
const format_more_cards_count = (args) => {
    const count = Number(args.count ?? 0);
    const extra = count - TEAM_WORKLOAD_INLINE_CARD_SLOTS;
    return extra > 0 ? `+${extra} more` : '';
};
/**
 * Builds one activity row's display text for the Recent Activity tile from a
 * raw Trello Action object, per action type:
 *   - createCard: "added {card}"
 *   - commentCard: "commented on {card}"
 *   - updateCard (list change): "moved {card} to {list}" — falls back to
 *     "updated {card}" if listAfter is missing (e.g. a non-list-change
 *     updateCard slipped through the filter).
 * Unrecognized types fall back to "updated {card}" too, rather than showing
 * nothing — the action genuinely happened, even if its exact phrasing isn't
 * modeled.
 */
function formatActionText(type, data) {
    const cardName = String(data.card?.name ?? 'a card');
    if (type === 'createCard')
        return `added ${cardName}`;
    if (type === 'commentCard')
        return `commented on ${cardName}`;
    if (type === 'updateCard') {
        const listAfter = data.listAfter?.name;
        if (listAfter)
            return `moved ${cardName} to ${String(listAfter)}`;
    }
    return `updated ${cardName}`;
}
/**
 * Flattens a get_recent_activity response into display rows for the Recent
 * Activity tile. Each row gets a deterministic chart-1..5 dot tone per actor
 * (same categorical-color pattern as Team Workload's avatars), the raw ISO
 * date (formatted via the system baseline relative_time function directly
 * in the widget spec, not here), and a type-specific action_text.
 *
 * Args: { value: array, search?: string, person?: string } —
 * get_recent_activity's `actions` array (raw Trello Action objects), an
 * optional case-insensitive substring filter matched against the actor's
 * name and the formatted action text, and an optional exact actor-name
 * filter (from the person dropdown, populated by list_activity_people —
 * values there already come from the same displayName derivation as
 * actor_name here, so an exact match is safe).
 */
const flatten_recent_activity = (args) => {
    const raw = Array.isArray(args.value) ? args.value : [];
    const search = String(args.search ?? '').trim().toLowerCase();
    const person = String(args.person ?? '').trim().toLowerCase();
    const rows = raw.map((action) => {
        const memberCreator = (action.memberCreator ?? {});
        const rawName = String(memberCreator.fullName ?? memberCreator.username ?? 'Someone');
        const { displayName } = formatPersonName(rawName);
        let hash = 0;
        for (let i = 0; i < rawName.length; i++)
            hash = (hash * 31 + rawName.charCodeAt(i)) >>> 0;
        const actorTone = rawName ? CHART_TONES[hash % CHART_TONES.length] : 'muted';
        return {
            id: String(action.id ?? ''),
            actor_name: displayName || rawName,
            actor_tone: actorTone,
            action_text: formatActionText(String(action.type ?? ''), (action.data ?? {})),
            date: String(action.date ?? ''),
        };
    });
    return rows.filter((row) => {
        const matchesSearch = !search || row.actor_name.toLowerCase().includes(search) || row.action_text.toLowerCase().includes(search);
        const matchesPerson = !person || row.actor_name.toLowerCase() === person;
        return matchesSearch && matchesPerson;
    });
};
/**
 * Lists the distinct people who appear in a get_recent_activity response,
 * for the person-filter dropdown. "All people" is always first (empty
 * value — no filter). Names use the same formatPersonName derivation as
 * flatten_recent_activity's actor_name, so dropdown values match rows
 * exactly.
 *
 * Args: { value: array } — get_recent_activity's raw `actions` array.
 */
const list_activity_people = (args) => {
    const raw = Array.isArray(args.value) ? args.value : [];
    const seen = new Map();
    for (const action of raw) {
        const memberCreator = (action.memberCreator ?? {});
        const rawName = String(memberCreator.fullName ?? memberCreator.username ?? '');
        if (!rawName)
            continue;
        const { displayName } = formatPersonName(rawName);
        const name = displayName || rawName;
        const key = name.toLowerCase();
        if (!seen.has(key))
            seen.set(key, name);
    }
    const people = Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
    return [{ value: '', label: 'All people' }, ...people.map((name) => ({ value: name, label: name }))];
};
/**
 * Formats an activity row's date for display next to its relative-time
 * caption ("1d ago · 15-Oct-26") — except today's actions, which show
 * "Today" instead of repeating a date the viewer already knows. Compared
 * against the viewer's LOCAL calendar day (matching how `date` already
 * reads via `relative_time`), not UTC.
 *
 * Args: { value: string } — an ISO date string.
 */
const format_activity_date = (args) => {
    const raw = args.value;
    if (raw == null || raw === '')
        return '';
    const ms = Date.parse(String(raw));
    if (Number.isNaN(ms))
        return String(raw);
    const d = new Date(ms);
    const now = new Date();
    const isToday = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    return isToday ? 'Today' : formatDdMmmYy(String(raw));
};
const elements = {
    slug: 'trello',
    functions: {
        flatten_my_cards_tabs,
        flatten_overdue_cards,
        flatten_boards,
        flatten_all_lists,
        flatten_all_cards,
        format_lists_cards_summary,
        flatten_due_date_tracker,
        format_tracker_legend,
        flatten_team_workload,
        format_more_cards_count,
        flatten_recent_activity,
        list_activity_people,
        format_activity_date,
    },
};
export default elements;
