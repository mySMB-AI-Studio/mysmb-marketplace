import type { ComputedFunction, PluginElementsModule } from './types';

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDdMmmYy(isoDate: string): string {
  const ms = Date.parse(isoDate);
  if (Number.isNaN(ms)) return '';
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
function dueLabelAndTone(due: string | null, dueComplete: boolean): { label: string; tone: string } {
  if (dueComplete) return { label: due ? formatDdMmmYy(due) : 'Completed', tone: 'success' };
  if (!due) return { label: '', tone: 'muted' };

  const dueMs = Date.parse(due);
  if (Number.isNaN(dueMs)) return { label: '', tone: 'muted' };

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayMs = Date.parse(todayStr);
  const dueDateStr = due.slice(0, 10);

  if (dueDateStr === todayStr) return { label: 'Due Today', tone: 'warning' };
  if (dueMs < todayMs) return { label: formatDdMmmYy(due), tone: 'destructive' };
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
const flatten_my_cards_tabs: ComputedFunction = (args) => {
  const raw = Array.isArray(args.value) ? (args.value as Record<string, unknown>[]) : [];
  if (raw.length === 0) return { upcoming: [], overdue: [], completed: [] };

  const upcoming: Record<string, unknown>[] = [];
  const overdue: Record<string, unknown>[] = [];
  const completed: Record<string, unknown>[] = [];

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
    } else if (due && !Number.isNaN(Date.parse(due)) && due.slice(0, 10) < new Date().toISOString().slice(0, 10)) {
      overdue.push(row);
    } else {
      upcoming.push(row);
    }
  }

  upcoming.sort((a, b) => (a._sort as number) - (b._sort as number));
  overdue.sort((a, b) => (a._sort as number) - (b._sort as number));

  const clean = (rows: Record<string, unknown>[]) => rows.map(({ _sort: _s, ...r }) => r);
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
const flatten_overdue_cards: ComputedFunction = (args) => {
  const raw = Array.isArray(args.value) ? (args.value as Record<string, unknown>[]) : [];
  if (raw.length === 0) return [];

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayMs = Date.parse(todayStr);

  const overdueItems: Array<{ card: Record<string, unknown>; daysOverdue: number }> = [];

  for (const card of raw) {
    if (card.dueComplete) continue;
    const due = card.due ? String(card.due) : null;
    if (!due) continue;
    const dueDateStr = due.slice(0, 10);
    if (dueDateStr >= todayStr) continue;
    const daysOverdue = Math.round((todayMs - Date.parse(dueDateStr)) / 86400000);
    overdueItems.push({ card, daysOverdue });
  }

  if (overdueItems.length === 0) return [];

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
const flatten_boards: ComputedFunction = (args) => {
  const raw = Array.isArray(args.value) ? (args.value as Record<string, unknown>[]) : [];
  if (raw.length === 0) return [];

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
const format_lists_cards_summary: ComputedFunction = (args) => {
  const v = (args.value ?? {}) as Record<string, unknown>;
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
const flatten_all_lists: ComputedFunction = (args) => {
  const raw = Array.isArray(args.value) ? (args.value as Record<string, unknown>[]) : [];
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
const flatten_all_cards: ComputedFunction = (args) => {
  const raw = Array.isArray(args.value) ? (args.value as Record<string, unknown>[]) : [];
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
 * are excluded entirely — matching the tile's own "Card due / dueComplete
 * fields" footer disclosure of exactly what powers it.
 *
 * Args: { value: array } — list_all_cards' `data` array.
 */
const flatten_due_date_tracker: ComputedFunction = (args) => {
  const raw = Array.isArray(args.value) ? (args.value as Record<string, unknown>[]) : [];

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayMs = Date.parse(todayStr);
  const weekAheadMs = todayMs + 7 * 86400000;

  let overdueCount = 0;
  let todayCount = 0;
  let weekCount = 0;

  for (const card of raw) {
    if (card.dueComplete) continue;
    const due = card.due ? String(card.due) : null;
    if (!due) continue;
    const dueDateStr = due.slice(0, 10);
    const dueMs = Date.parse(dueDateStr);
    if (Number.isNaN(dueMs)) continue;

    if (dueDateStr === todayStr) {
      todayCount++;
    } else if (dueMs < todayMs) {
      overdueCount++;
    } else if (dueMs <= weekAheadMs) {
      weekCount++;
    }
  }

  return {
    overdue_count: overdueCount,
    today_count: todayCount,
    week_count: weekCount,
  };
};

/**
 * Formats one Due Date Tracker legend entry, e.g. "Overdue · 7".
 *
 * Args: { label: string, value: number }
 */
const format_tracker_legend: ComputedFunction = (args) => {
  const label = String(args.label ?? '');
  const value = Number(args.value ?? 0);
  return `${label} · ${value}`;
};

const elements: PluginElementsModule = {
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
  },
};

export default elements;
