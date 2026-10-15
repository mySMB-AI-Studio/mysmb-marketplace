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
 * Formats the completion caption for the Board Health Overview tile's ring.
 * Trello has no notion of a card being "done" outside the due-date-complete
 * checkbox, so completion is defined as completed_due_cards divided by every
 * card that HAS a due date (completed + remaining) — cards with no due date
 * at all aren't part of this ratio, since they're neither complete nor
 * overdue, just untracked for this purpose.
 *
 * Args: { value: object } — get_boards_health_summary's response object
 * ({ completed_due_cards, remaining_due_cards, ... }).
 */
const format_completion_pct = (args) => {
    const v = (args.value ?? {});
    const completed = Number(v.completed_due_cards ?? 0);
    const remaining = Number(v.remaining_due_cards ?? 0);
    const total = completed + remaining;
    if (total === 0)
        return 'No due dates tracked';
    const pct = Math.round((completed / total) * 100);
    return `${pct}% complete`;
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
const elements = {
    slug: 'trello',
    functions: {
        flatten_my_cards_tabs,
        flatten_overdue_cards,
        flatten_boards,
        format_completion_pct,
        format_lists_cards_summary,
    },
};
export default elements;
