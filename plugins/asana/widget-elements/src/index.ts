import type { ComputedFunction, PluginElementsModule } from './types';

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/**
 * Format an ISO date string to dd-Mmm-yy (e.g. "09-Sep-26").
 *
 * Args: { value: string }
 *
 * Spec example:
 *   { "$computed": "asana_format_date", "args": { "value": { "$item": "due_on" } } }
 */
const format_date: ComputedFunction = (args) => {
  const raw = args.value;
  if (!raw) return '';
  const ms = Date.parse(String(raw));
  if (Number.isNaN(ms)) return '';
  const d = new Date(ms);
  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTH_ABBR[d.getMonth()];
  const year = String(d.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
};

/**
 * Flattens a list_tasks response into display rows for the My Tasks tile.
 * Filters to tasks assigned to the current user (all tasks in the response
 * when called with assignee=me).
 *
 * Row 0 carries aggregate stat fields: stat_total, stat_overdue, stat_due_today.
 * Each row has: id, title, due_label (dd-Mmm-yy or "No due date"),
 * project_label (first project name or ""), is_overdue (bool),
 * due_tone ("danger" if overdue, "warning" if due today, "muted" otherwise).
 *
 * Args: { value: array }
 */
const flatten_my_tasks: ComputedFunction = (args) => {
  const raw = Array.isArray(args.value) ? (args.value as Record<string, unknown>[]) : [];
  if (raw.length === 0) return [];

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayMs = Date.parse(todayStr);

  let statDueToday = 0;
  let statOverdue = 0;

  const rows = raw.map((task) => {
    const id = String(task.gid ?? task.id ?? '');
    const title = String(task.name ?? '');
    const dueOn = task.due_on ? String(task.due_on) : null;

    const memberships = Array.isArray(task.memberships) ? (task.memberships as Record<string, unknown>[]) : [];
    const projects = Array.isArray(task.projects) ? (task.projects as Record<string, unknown>[]) : [];
    let projectLabel = '';
    if (memberships.length > 0) {
      const proj = memberships[0].project as Record<string, unknown> | undefined;
      if (proj) projectLabel = String(proj.name ?? '');
    } else if (projects.length > 0) {
      projectLabel = String((projects[0] as Record<string, unknown>).name ?? '');
    }

    let dueLabel = '';
    let dueTone = 'muted';
    let circleTone = 'muted';

    if (dueOn) {
      const dueMs = Date.parse(dueOn);
      if (!Number.isNaN(dueMs)) {
        const d = new Date(dueMs);
        const formatted = `${String(d.getDate()).padStart(2, '0')}-${MONTH_ABBR[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
        if (dueMs < todayMs) {
          dueLabel = formatted;
          dueTone = 'destructive';
          circleTone = 'destructive';
          statOverdue++;
        } else if (dueOn === todayStr) {
          dueLabel = 'Due Today';
          dueTone = 'warning';
          circleTone = 'warning';
          statDueToday++;
        } else {
          dueLabel = formatted;
          dueTone = 'muted';
          circleTone = 'success';
        }
      }
    }

    return {
      id,
      title,
      due_label: dueLabel,
      project_label: projectLabel,
      due_tone: dueTone,
      circle_tone: circleTone,
      footer_label: '',
    };
  });

  const total = raw.length;
  rows[0].footer_label = statDueToday > 0
    ? `${statDueToday} of ${total} task${total === 1 ? '' : 's'} due today`
    : statOverdue > 0
    ? `${statOverdue} overdue task${statOverdue === 1 ? '' : 's'}`
    : '';

  return rows;
};

/**
 * Flattens a list_projects response into display rows for the Projects tile.
 * Row 0 carries stat_total.
 * Each row has: id, name, member_count ("—" when not available), permalink_url.
 *
 * Args: { value: array }
 */
const flatten_projects: ComputedFunction = (args) => {
  const raw = Array.isArray(args.value) ? (args.value as Record<string, unknown>[]) : [];
  if (raw.length === 0) return [];

  const rows = raw.map((proj) => {
    const id = String(proj.gid ?? proj.id ?? '');
    const name = String(proj.name ?? '');
    const memberCount = proj.members != null
      ? String(Array.isArray(proj.members) ? proj.members.length : proj.members)
      : '—';
    const permalinkUrl = String(proj.permalink_url ?? '');

    return {
      id,
      name,
      member_count: memberCount,
      permalink_url: permalinkUrl,
      stat_total: '',
    };
  });

  rows[0].stat_total = String(raw.length);

  return rows;
};

/**
 * Flattens a list_projects response into display rows for the Project Progress tile.
 * Calculates task completion percentage from task_counts opt_fields.
 * tone: "destructive" (<40%), "warning" (40–69%), "muted" (≥70% or no tasks).
 * Row 0 carries footer_label: "N active projects".
 *
 * Args: { value: array }
 */

// ── Team Workload board ──────────────────────────────────────────────────────
// `flatten_workload_board` is the single helper behind the Team Workload tile,
// in the same one-pass shape as the other boards: sort, scale, tone and label
// together, because a tile spec can only repeat over a flat array in state.
//
// What `get_team_workload` can and cannot tell us, read off the server source and
// confirmed against the live workspace on 2026-11-12:
//
//  - CAPACITY IS NOT AN ASANA FIELD. Nothing on this connector reports a
//    per-person task capacity, so the tile makes capacity an explicit control
//    the viewer sets, defaulting to 8. Every "% load", "Over by N" and colour
//    below is measured against that number, not against anything Asana says.
//  - `task_count` SATURATES AT 100. The server counts incomplete tasks with
//    `limit: 100` and does not paginate, so a member with more than 100 active
//    tasks reads as exactly 100. The tile says so when it happens rather than
//    presenting the number as exact.
//  - THE MEMBER LIST IS NOT A CURATED TEAM. It is the first `member_limit`
//    users `/users` returns for the workspace, so it can include people with
//    no tasks and omit people who have them.
//  - ONE NUMBER PER PERSON. No due dates, no projects, no overdue split --
//    so the tile cannot break a member's load down any further.

const CAP_MIN = 1;
const CAP_MAX = 20;
const CAP_DEFAULT = 8;
const COUNT_SATURATION = 100;
const NEAR_CAPACITY = 0.8;

type WorkloadStatus = 'ok' | 'busy' | 'over';
const WORKLOAD_TONE: Record<WorkloadStatus, string> = {
  ok: 'brand',
  busy: 'warning',
  over: 'destructive',
};

const WORKLOAD_SORTS = ['most', 'least', 'az'] as const;
type WorkloadSort = (typeof WORKLOAD_SORTS)[number];
const WORKLOAD_SORT_LABEL: Record<WorkloadSort, string> = {
  most: 'Most tasks',
  least: 'Fewest first',
  az: 'A–Z',
};

function clampCapacity(raw: unknown): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return CAP_DEFAULT;
  return Math.min(CAP_MAX, Math.max(CAP_MIN, n));
}

/**
 * Clamped step for the capacity stepper's − / + buttons. Kept separate from
 * the board helper because the buttons write `/ui/cap`, and the board is
 * recomputed from the watch on that path.
 *
 * Args: { value: number, delta: number }
 *
 * Spec example:
 *   { "$computed": "asana_step_capacity",
 *     "args": { "value": { "$state": "/ui/cap" }, "delta": 1 } }
 */
const step_capacity: ComputedFunction = (args) => {
  const delta = Math.round(Number(args.delta)) || 0;
  return clampCapacity(clampCapacity(args.value) + delta);
};

/**
 * Builds the whole Team Workload view from a `get_team_workload` response.
 *
 * Args: { value: array, cap: number, sort: "most" | "least" | "az" }
 *
 * Returns an object written to `/ui/board`:
 *   header_label, has_members, empty_message
 *   stat_total, total_caption, balance_label, balance_tone, avg_label,
 *   busiest_label
 *   cap_value, cap_at_min, cap_at_max
 *   sort_label, sort_most_selected, sort_least_selected, sort_az_selected
 *   bar_template, rows[], legend[], footnote, footer_label
 */
const flatten_workload_board: ComputedFunction = (args) => {
  const raw = Array.isArray(args.value) ? (args.value as Record<string, unknown>[]) : [];
  const cap = clampCapacity(args.cap);
  const sort: WorkloadSort = (WORKLOAD_SORTS as readonly string[]).includes(String(args.sort))
    ? (String(args.sort) as WorkloadSort)
    : 'most';

  const members = raw.map((entry, index) => {
    const m = entry as Record<string, unknown>;
    const { displayName, initials } = formatPersonName(String(m.name ?? m.email ?? ''));
    const count = Math.max(0, Math.round(Number(m.task_count ?? 0)) || 0);
    return {
      id: String(m.user_gid ?? m.email ?? `member-${index}`),
      display_name: displayName || 'Unknown',
      initials: initials || '?',
      count,
    };
  });

  const total = members.reduce((sum, m) => sum + m.count, 0);
  const maxCount = members.reduce((max, m) => Math.max(max, m.count), 0);
  const avg = members.length > 0 ? total / members.length : 0;
  const saturated = members.filter((m) => m.count >= COUNT_SATURATION).length;

  // Each member's bar is two grid tracks: `cap` units of within-capacity width
  // and `headroom` units past it. The track sizes are the same on every row,
  // so the gap between the two tracks falls at the same x on all of them --
  // that gap IS the capacity line the reference design draws as a dashed rule.
  //
  // Headroom is clamped at both ends. It is never zero, so the capacity line
  // never sits flush against the card edge; and it is never wider than the
  // capacity zone itself, so one person on 100 tasks against a capacity of 8
  // cannot squeeze everyone else's bar down to a sliver. The over-capacity
  // segment therefore saturates at twice capacity -- past that the "Over by N"
  // label carries the magnitude, which a bar that long could not anyway.
  const headroom = Math.min(cap, Math.max(maxCount - cap, Math.ceil(cap * 0.15), 1));

  const sorted = [...members].sort((a, b) => {
    if (sort === 'az') return a.display_name.localeCompare(b.display_name);
    if (sort === 'least') return a.count - b.count || a.display_name.localeCompare(b.display_name);
    return b.count - a.count || a.display_name.localeCompare(b.display_name);
  });

  let busy = 0;
  let over = 0;
  const rows = sorted.map((m) => {
    const status: WorkloadStatus =
      m.count > cap ? 'over' : m.count >= cap * NEAR_CAPACITY ? 'busy' : 'ok';
    if (status === 'busy') busy += 1;
    if (status === 'over') over += 1;

    return {
      id: m.id,
      display_name: m.display_name,
      initials: m.initials,
      tone: WORKLOAD_TONE[status],
      count_label: `${m.count}${m.count >= COUNT_SATURATION ? '+' : ''} task${m.count === 1 ? '' : 's'}`,
      fill_pct: Math.round((Math.min(m.count, cap) / cap) * 100),
      over_pct: m.count > cap ? Math.min(100, Math.round(((m.count - cap) / headroom) * 100)) : 0,
      load_label: m.count > cap ? `Over by ${m.count - cap}` : `${Math.round((m.count / cap) * 100)}% load`,
      load_tone: status === 'ok' ? 'muted' : WORKLOAD_TONE[status],
      share_label: total > 0 ? `${Math.round((m.count / total) * 100)}% of team` : '',
    };
  });

  // Spread, not range: max/avg says "how far above everyone else is the
  // busiest person", which is the question the badge answers. A range would
  // read the same for a team of 1 and 9 as for a team of 5 and 13.
  const ratio = avg > 0 ? maxCount / avg : 1;
  const balance =
    ratio <= 1.2
      ? { label: 'Well balanced', tone: 'success' }
      : ratio <= 1.5
        ? { label: 'Slightly uneven', tone: 'warning' }
        : { label: 'Uneven', tone: 'destructive' };

  const busiest = [...members].sort(
    (a, b) => b.count - a.count || a.display_name.localeCompare(b.display_name),
  )[0];

  return {
    header_label: `Asana · ${members.length} team member${members.length === 1 ? '' : 's'}`,
    has_members: members.length > 0,
    empty_message: 'No team members found.',

    stat_total: String(total),
    total_caption: `active task${total === 1 ? '' : 's'} across team`,
    balance_label: balance.label,
    balance_tone: balance.tone,
    avg_label: `avg ${avg.toFixed(1)} per person`,
    busiest_label: busiest ? `busiest ${busiest.display_name} · ${busiest.count}` : '',

    cap_value: String(cap),
    cap_at_min: cap <= CAP_MIN,
    cap_at_max: cap >= CAP_MAX,

    sort_label: `Sort: ${WORKLOAD_SORT_LABEL[sort]}`,
    sort_most_selected: sort === 'most',
    sort_least_selected: sort === 'least',
    sort_az_selected: sort === 'az',

    bar_template: `minmax(0, ${cap}fr) minmax(0, ${headroom}fr)`,
    rows,

    legend: [
      { id: 'ok', label: 'Under 80%', tone: WORKLOAD_TONE.ok },
      { id: 'busy', label: busy > 0 ? `Near capacity (${busy})` : 'Near capacity', tone: WORKLOAD_TONE.busy },
      { id: 'over', label: over > 0 ? `Over capacity (${over})` : 'Over capacity', tone: WORKLOAD_TONE.over },
    ],

    footnote:
      saturated > 0
        ? `Capacity is your setting, not an Asana field. ${saturated} member${saturated === 1 ? '' : 's'} hit the connector's 100-task counting limit, so the real total may be higher.`
        : 'Capacity is your setting, not an Asana field — % load and colour are measured against it. Counts are every active task in the workspace.',
    footer_label: `${total} active task${total === 1 ? '' : 's'} across team`,
  };
};

// ── My Tasks board ───────────────────────────────────────────────────────────
// Everything below supports `flatten_my_tasks_board`, the single helper behind
// the My Tasks tile. It does the whole view in one pass -- bucket, filter,
// sort, group, label -- because a tile spec can only repeat over a flat array
// in state, so any grouping or filtering has to be baked into the rows.

const CATEGORY_TONES = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'] as const;

/**
 * Project chips shown before the list, excluding the "All" chip.
 *
 * Three, because the chips live in a flex `Row` and `Badge` is `shrink-0`:
 * past about four pills the row cannot fit them and they overflow the card
 * instead of wrapping or scrolling. The system has no horizontally-scrolling
 * container and `Row` has no wrap, so this cap IS the layout. Measured at
 * the tile's 5-column preferred width.
 */
const MAX_PROJECT_CHIPS = 3;

/** Longest project name a chip shows before eliding -- same reason as above.
 *  The full name is still on every row underneath. */
const CHIP_LABEL_MAX = 11;

function elide(label: string): string {
  return label.length > CHIP_LABEL_MAX
    ? `${label.slice(0, CHIP_LABEL_MAX - 1).trimEnd()}…`
    : label;
}

const TAB_KEYS = ['overdue', 'upcoming', 'completed'] as const;
type TabKey = (typeof TAB_KEYS)[number];

const TAB_NOUN: Record<TabKey, string> = {
  overdue: 'overdue',
  upcoming: 'upcoming',
  completed: 'completed',
};

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** The viewer's own calendar date as YYYY-MM-DD. */
function todayIsoDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

/**
 * dd-Mmm-yy from a YYYY-MM-DD string (TILE-DISPLAY-STANDARDS date format).
 *
 * String maths only -- deliberately no `Date.parse`. Asana's `due_on` is a
 * calendar date with no time or zone; parsing it yields UTC midnight, which
 * `getDate()` then renders as the PREVIOUS day for any viewer west of UTC.
 */
function formatIsoDate(ymd: string): string {
  const [y, m, d] = ymd.split('-');
  const month = MONTH_ABBR[Number(m) - 1];
  if (!y || !month || !d) return '';
  return `${pad2(Number(d))}-${month}-${y.slice(2)}`;
}

/** Whole days from `from` to `to`, both YYYY-MM-DD. Positive when `to` is later. */
function daysBetween(to: string, from: string): number {
  const [ty, tm, td] = to.split('-').map(Number);
  const [fy, fm, fd] = from.split('-').map(Number);
  if ([ty, tm, td, fy, fm, fd].some((n) => !Number.isFinite(n))) return 0;
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}

/**
 * Non-status colours for the projects on screen, assigned by position so the
 * visible set is always distinct. Hashing the name (the technique
 * `flatten_activity_board` uses for people) is stable across refreshes but
 * collides: three projects in one view can land on the same `chart-*` tone,
 * which defeats the whole point of colouring them. Positional assignment over
 * a deterministic ordering keeps a project's colour stable for as long as the
 * tab's project mix is stable, and keeps the chips telling them apart.
 *
 * A project name is a category label, not a state, so these are `chart-*`
 * tones rather than success/warning/destructive -- TILE-DISPLAY-STANDARDS §7.
 */
function toneMapFor(orderedProjects: string[]): Map<string, string> {
  const tones = new Map<string, string>();
  orderedProjects.forEach((label, index) => {
    tones.set(label, CATEGORY_TONES[index % CATEGORY_TONES.length]);
  });
  return tones;
}

function projectNameOf(task: Record<string, unknown>): string {
  const memberships = Array.isArray(task.memberships) ? (task.memberships as Record<string, unknown>[]) : [];
  if (memberships.length > 0) {
    const proj = memberships[0].project as Record<string, unknown> | undefined;
    if (proj) return String(proj.name ?? '');
  }
  const projects = Array.isArray(task.projects) ? (task.projects as Record<string, unknown>[]) : [];
  if (projects.length > 0) return String((projects[0] as Record<string, unknown>).name ?? '');
  return '';
}

interface BoardTask {
  id: string;
  title: string;
  project: string;
  due_on: string;
  done_on: string;
  url: string;
  tab: TabKey;
  /** Sort key within the tab: due date for open work, completion day for done. */
  sort: string;
}

/** The due/done pill: text plus the tone that carries the urgency. */
function duePill(task: BoardTask, today: string): { label: string; tone: string } {
  if (task.tab === 'completed') {
    if (!task.done_on) return { label: 'Done', tone: 'success' };
    const ago = daysBetween(today, task.done_on);
    if (ago <= 0) return { label: 'Done today', tone: 'success' };
    if (ago === 1) return { label: 'Done yesterday', tone: 'success' };
    return { label: `Done ${formatIsoDate(task.done_on)}`, tone: 'success' };
  }
  if (!task.due_on) return { label: 'No due date', tone: 'muted' };
  const days = daysBetween(task.due_on, today);
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, tone: 'destructive' };
  if (days === 0) return { label: 'Today', tone: 'warning' };
  if (days === 1) return { label: 'Tomorrow', tone: 'info' };
  return { label: formatIsoDate(task.due_on), tone: 'muted' };
}

/** The run heading a task falls under. Buckets are monotonic in the sort key,
 *  so consecutive tasks sharing a heading form one group. */
function groupOf(task: BoardTask, today: string): { label: string; tone: string } {
  if (task.tab === 'completed') {
    if (!task.done_on) return { label: 'Earlier', tone: 'muted' };
    const ago = daysBetween(today, task.done_on);
    if (ago <= 0) return { label: 'Today', tone: 'muted' };
    if (ago === 1) return { label: 'Yesterday', tone: 'muted' };
    return { label: 'Earlier', tone: 'muted' };
  }
  if (!task.due_on) return { label: 'No due date', tone: 'muted' };
  const days = daysBetween(task.due_on, today);
  if (days < 0) {
    const over = Math.abs(days);
    if (over >= 60) return { label: '60+ days overdue', tone: 'destructive' };
    if (over >= 30) return { label: '30–59 days overdue', tone: 'destructive' };
    if (over >= 8) return { label: '8–29 days overdue', tone: 'destructive' };
    return { label: 'This week', tone: 'destructive' };
  }
  if (days === 0) return { label: 'Today', tone: 'warning' };
  if (days === 1) return { label: 'Tomorrow', tone: 'muted' };
  if (days <= 7) return { label: 'Later this week', tone: 'muted' };
  if (days <= 14) return { label: 'Next week', tone: 'muted' };
  return { label: 'Later', tone: 'muted' };
}

/**
 * Builds the whole My Tasks board from one `list_tasks` response: the three
 * tab counts, the project filter chips, and the grouped rows for whichever
 * tab and project are selected.
 *
 * Args: { value: array, tab?: string, project?: string }
 *   value   -- `list_tasks`' `data` array (assignee=me, completed_since set
 *              far enough back to carry the Completed tab).
 *   tab     -- 'overdue' | 'upcoming' | 'completed'. Defaults to 'overdue',
 *              which is also the tile's first paint: the overdue tab is the
 *              one that needs attention, so it leads.
 *   project -- a project name, or 'All' / absent for no filter.
 *
 * Returns ONE object (not an array) at `/ui/board`, because the tile needs
 * counts and chips alongside the rows and a tile spec can only repeat over a
 * flat array. Rows carry their own group heading (`show_group`), so a single
 * flat repeat renders a grouped list.
 *
 * Bucketing: a task is Completed if Asana says so, Overdue if its due date is
 * before the viewer's today, and Upcoming otherwise -- which includes tasks
 * with no due date at all, grouped under "No due date" at the end.
 *
 * KNOWN APPROXIMATION -- the Completed tab's "Done today / yesterday" reads
 * `modified_at`, not a real completion timestamp. The gateway's
 * TASK_OPT_FIELDS (myhub-mcp-servers src/integrations/asana/servers/asana.ts)
 * doesn't request `completed_at`, so it isn't in the response. Completing a
 * task does modify it, so the two agree for anything completed and then left
 * alone; editing a task after completing it makes the row look more recent
 * than it is. Adding `completed_at` to TASK_OPT_FIELDS is a one-line gateway
 * change that would make this exact -- a different repo, so it is flagged
 * rather than assumed here.
 */
const flatten_my_tasks_board: ComputedFunction = (args) => {
  const raw = Array.isArray(args.value) ? (args.value as Record<string, unknown>[]) : [];
  const requestedTab = String(args.tab ?? '');
  const tab: TabKey = (TAB_KEYS as readonly string[]).includes(requestedTab)
    ? (requestedTab as TabKey)
    : 'overdue';
  const project = args.project ? String(args.project) : 'All';
  const today = todayIsoDate();

  const tasks: BoardTask[] = raw.map((task) => {
    const isCompleted = Boolean(task.completed);
    const dueOn = task.due_on ? String(task.due_on).slice(0, 10) : '';
    // See the KNOWN APPROXIMATION note above: modified_at stands in for a
    // completion timestamp the gateway doesn't return.
    const doneOn = task.modified_at ? String(task.modified_at).slice(0, 10) : '';
    const taskTab: TabKey = isCompleted ? 'completed' : dueOn && dueOn < today ? 'overdue' : 'upcoming';
    return {
      id: String(task.gid ?? task.id ?? ''),
      title: String(task.name ?? ''),
      project: projectNameOf(task),
      due_on: dueOn,
      done_on: doneOn,
      url: task.permalink_url ? String(task.permalink_url) : '',
      tab: taskTab,
      // Open work sorts by due date, soonest first; undated work sorts last.
      // Completed sorts newest first, so the key is inverted at sort time.
      sort: taskTab === 'completed' ? doneOn : dueOn || '9999-12-31',
    };
  });

  const counts: Record<TabKey, number> = { overdue: 0, upcoming: 0, completed: 0 };
  for (const task of tasks) counts[task.tab]++;

  const dueThisWeek = tasks.filter(
    (task) => task.tab === 'upcoming' && task.due_on && daysBetween(task.due_on, today) <= 7,
  ).length;

  const inTab = tasks
    .filter((task) => task.tab === tab)
    .sort((a, b) => (tab === 'completed' ? b.sort.localeCompare(a.sort) : a.sort.localeCompare(b.sort)));

  // Chips describe the selected tab, so they always add up to its count.
  const tally = new Map<string, number>();
  for (const task of inTab) {
    if (!task.project) continue;
    tally.set(task.project, (tally.get(task.project) ?? 0) + 1);
  }
  const ranked = [...tally.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_PROJECT_CHIPS);
  const projectTones = toneMapFor(ranked.map(([label]) => label));
  const chips = ranked.map(([label, count]) => ({
    id: label,
    label,
    count,
    // One string, because the chip is a single Badge: it is the only system
    // primitive that renders a true pill (rounded-full), and a Badge styles
    // its `text` as a whole. Composing dot + label + count as Badge children
    // instead would let each child's own tone class fight the solid pill's
    // white text on the selected chip.
    chip_text: `${elide(label)}  ${count}`,
    tone: projectTones.get(label) ?? 'muted',
    selected: label === project,
  }));

  // A filter on a project that has nothing left in this tab (every task
  // completed, say) would show an empty list with no way back, so fall back.
  const activeProject = chips.some((chip) => chip.label === project) ? project : 'All';
  const visible = activeProject === 'All' ? inTab : inTab.filter((task) => task.project === activeProject);

  const groupSizes = new Map<string, number>();
  for (const task of visible) {
    const label = groupOf(task, today).label;
    groupSizes.set(label, (groupSizes.get(label) ?? 0) + 1);
  }

  let lastGroup = '';
  const rows = visible.map((task) => {
    const pill = duePill(task, today);
    const group = groupOf(task, today);
    const isNewGroup = group.label !== lastGroup;
    lastGroup = group.label;
    const isDone = task.tab === 'completed';
    return {
      id: task.id,
      title: task.title,
      title_tone: isDone ? 'muted' : 'default',
      project_label: task.project,
      project_tone: projectTones.get(task.project) ?? 'muted',
      show_project: Boolean(task.project),
      due_label: pill.label,
      due_tone: pill.tone,
      // Lucide names: an empty ring to tick, a filled check once done.
      circle_icon: isDone ? 'CircleCheck' : 'Circle',
      circle_tone: isDone ? 'success' : pill.tone === 'muted' ? 'muted' : pill.tone,
      circle_label: isDone ? `Reopen ${task.title}` : `Complete ${task.title}`,
      /** What complete_task should set `completed` to -- a tick completes, a
       *  tick on a done row reopens. */
      complete_to: !isDone,
      url: task.url,
      has_url: Boolean(task.url),
      show_group: isNewGroup,
      // Upper-cased here rather than by a CSS class: `Caption` has no
      // transform prop and plugin elements can't ship CSS (composites are
      // JSON sub-specs over system primitives only).
      group_label: group.label.toUpperCase(),
      group_tone: group.tone,
      group_count: groupSizes.get(group.label) ?? 1,
    };
  });

  const total = inTab.length;
  const noun = TAB_NOUN[tab];

  return {
    tab,
    header_label:
      tasks.length === 0
        ? 'Asana'
        : `Asana · ${counts.overdue} overdue · ${dueThisWeek} due this week`,
    overdue_count: counts.overdue,
    upcoming_count: counts.upcoming,
    completed_count: counts.completed,
    tab_overdue_selected: tab === 'overdue',
    tab_upcoming_selected: tab === 'upcoming',
    tab_completed_selected: tab === 'completed',
    projects: chips,
    show_projects: chips.length > 1,
    all_selected: activeProject === 'All',
    all_count: total,
    all_text: `All  ${total}`,
    rows,
    has_rows: rows.length > 0,
    empty_message:
      tab === 'overdue'
        ? "You're all caught up — nothing overdue."
        : tab === 'upcoming'
        ? 'Nothing coming up.'
        : 'Nothing completed in the last 30 days.',
    footer_label:
      activeProject === 'All'
        ? `${total} ${noun} ${total === 1 ? 'task' : 'tasks'}`
        : `${rows.length} of ${total} ${noun} · ${activeProject}`,
  };
};

// ── Overdue Tasks board ──────────────────────────────────────────────────────
// `flatten_overdue_board` is the single helper behind the Overdue Tasks tile,
// built the same way as `flatten_my_tasks_board` above: one pass that filters,
// buckets, sorts, groups and labels, because a tile spec can only repeat over
// a flat array, so grouping has to be baked into the rows.

const OVERDUE_BUCKETS = ['crit', 'high', 'low'] as const;
type BucketKey = (typeof OVERDUE_BUCKETS)[number];

/**
 * How far past due each bucket is, and the tone that carries it.
 *
 * The reference design wanted red / orange / yellow. The token palette has
 * exactly one amber (`warning`) between `destructive` and the neutrals, so
 * the three severities map to destructive / warning / info instead -- blue
 * reads as the least urgent step and, unlike a muted grey, stays clearly
 * visible when its chip is the selected filter. Token tones only, never a
 * hand-picked hex (TILE-DISPLAY-STANDARDS).
 */
const BUCKET_TONE: Record<BucketKey, string> = {
  crit: 'destructive',
  high: 'warning',
  low: 'info',
};

/** Chip text is deliberately terse: four pills plus the group-by control have
 *  to share one row at the tile's 5-column width, and `Badge` is `shrink-0`,
 *  so a long label overflows the card rather than wrapping. The group heading
 *  underneath spells the same bucket out in full. */
const BUCKET_CHIP: Record<BucketKey, string> = {
  crit: '60+d',
  high: '30–59d',
  low: '<30d',
};

const BUCKET_HEADING: Record<BucketKey, string> = {
  crit: '60+ days overdue',
  high: '30–59 days overdue',
  low: 'Under 30 days overdue',
};

function bucketFor(daysOverdue: number): BucketKey {
  if (daysOverdue >= 60) return 'crit';
  if (daysOverdue >= 30) return 'high';
  return 'low';
}

interface OverdueTask {
  id: string;
  title: string;
  project: string;
  due_on: string;
  url: string;
  days: number;
  bucket: BucketKey;
}

interface OverdueGroup {
  label: string;
  tone: string;
  meta: string;
  dot_tone: string;
  show_dot: boolean;
  items: OverdueTask[];
}

/**
 * Builds the whole Overdue Tasks board from one `list_tasks` response: the
 * three summary stats, the severity bar, the bucket filter chips, and the
 * grouped rows for whichever bucket and grouping are selected.
 *
 * Args: { value: array, bucket?: string, group?: string }
 *   value  -- `list_tasks`' `data` array (assignee=me, completed_since=now,
 *             so only open work comes back).
 *   bucket -- 'all' | 'crit' | 'high' | 'low'. Defaults to 'all'.
 *   group  -- 'age' (default) | 'project'. Age is the default because the
 *             tile exists to surface what is worst, and age IS the severity.
 *
 * Returns ONE object (not an array) at `/ui/board` -- same reason as
 * `flatten_my_tasks_board`: the tile needs stats and chips alongside the rows.
 *
 * "Overdue" is strictly `due_on` earlier than the viewer's own calendar day.
 * A task with no due date cannot be late, so it is absent entirely rather than
 * swept into the oldest bucket.
 */
const flatten_overdue_board: ComputedFunction = (args) => {
  const raw = Array.isArray(args.value) ? (args.value as Record<string, unknown>[]) : [];
  const today = todayIsoDate();
  const groupMode = String(args.group ?? 'age') === 'project' ? 'project' : 'age';

  const tasks: OverdueTask[] = [];
  for (const task of raw) {
    if (task.completed) continue;
    const dueOn = task.due_on ? String(task.due_on).slice(0, 10) : '';
    if (!dueOn || dueOn >= today) continue;
    const days = daysBetween(today, dueOn);
    tasks.push({
      id: String(task.gid ?? task.id ?? ''),
      title: String(task.name ?? ''),
      project: projectNameOf(task),
      due_on: dueOn,
      url: task.permalink_url ? String(task.permalink_url) : '',
      days,
      bucket: bucketFor(days),
    });
  }
  // Oldest first, so index 0 is the longest-overdue task everywhere below.
  tasks.sort((a, b) => a.due_on.localeCompare(b.due_on) || a.title.localeCompare(b.title));

  const total = tasks.length;
  const counts: Record<BucketKey, number> = { crit: 0, high: 0, low: 0 };
  for (const task of tasks) counts[task.bucket]++;

  const longest = total > 0 ? tasks[0].days : 0;
  const avgDays = total > 0 ? Math.round(tasks.reduce((sum, t) => sum + t.days, 0) / total) : 0;

  // Project colours are assigned over the full task list ordered by how old
  // each project's worst task is, so a project keeps its colour when the user
  // filters to a bucket or flips the grouping. Positional, not hashed, for
  // the same reason as `toneMapFor`'s doc: hashes collide, and two projects
  // sharing a colour defeats the point of colouring them at all.
  const projectOrder: string[] = [];
  for (const task of tasks) {
    if (task.project && !projectOrder.includes(task.project)) projectOrder.push(task.project);
  }
  const projectTones = toneMapFor(projectOrder);

  // A bucket filter that nothing matches would show an empty list with no way
  // back, so fall back to 'all' -- same guard as the My Tasks project chips.
  const requested = String(args.bucket ?? 'all');
  const bucket: string =
    (OVERDUE_BUCKETS as readonly string[]).includes(requested) && counts[requested as BucketKey] > 0
      ? requested
      : 'all';

  const filtered = bucket === 'all' ? tasks : tasks.filter((task) => task.bucket === bucket);

  // The severity bar: one segment per non-empty bucket, widths proportional to
  // the counts. `Row.template` takes a raw grid-template-columns string, so
  // "6fr 5fr 3fr" is the only way to express proportion without inline CSS.
  const segments = OVERDUE_BUCKETS.filter((key) => counts[key] > 0).map((key) => ({
    id: key,
    tone: BUCKET_TONE[key],
    span: counts[key],
  }));
  const barTemplate = segments.map((segment) => `${segment.span}fr`).join(' ');

  const chips = [
    {
      id: 'all',
      bucket: 'all',
      chip_text: `All  ${total}`,
      tone: 'default',
      selected: bucket === 'all',
    },
    ...OVERDUE_BUCKETS.filter((key) => counts[key] > 0).map((key) => ({
      id: key,
      bucket: key as string,
      chip_text: `${BUCKET_CHIP[key]}  ${counts[key]}`,
      tone: BUCKET_TONE[key],
      selected: bucket === key,
    })),
  ];

  let groups: OverdueGroup[];
  if (groupMode === 'project') {
    const byProject = new Map<string, OverdueTask[]>();
    for (const task of filtered) {
      const label = task.project || 'No project';
      const items = byProject.get(label);
      if (items) items.push(task);
      else byProject.set(label, [task]);
    }
    groups = [...byProject.entries()]
      .map(([label, items]) => ({
        label,
        tone: 'muted',
        // items[0] is the group's oldest task: `filtered` is already sorted
        // oldest-first and the Map preserves insertion order within a key.
        meta: `oldest ${items[0].days}d`,
        dot_tone: projectTones.get(label) ?? 'muted',
        show_dot: true,
        items,
      }))
      .sort((a, b) => b.items[0].days - a.items[0].days);
  } else {
    groups = OVERDUE_BUCKETS.map((key) => ({
      label: BUCKET_HEADING[key],
      tone: BUCKET_TONE[key],
      meta: '',
      dot_tone: 'muted',
      show_dot: false,
      items: filtered.filter((task) => task.bucket === key),
    })).filter((group) => group.items.length > 0);
  }

  const rows = groups.flatMap((group) =>
    group.items.map((task, index) => {
      const showProject = groupMode === 'age' && Boolean(task.project);
      return {
        id: task.id,
        title: task.title,
        sev_tone: BUCKET_TONE[task.bucket],
        due_label: `${task.days}d overdue`,
        project_tone: projectTones.get(task.project) ?? 'muted',
        show_project: showProject,
        // Project and due date are ONE string, not two Texts in a Row: a flex
        // child only honours `truncate` when something gives it min-w-0, which
        // the system does only for a Stack/Row with `grow`. As two siblings the
        // second one wrapped to a line of its own for every long project name,
        // making rows jump between 56 and 69 px tall. Grouping by project
        // already names the project in its heading, so the row only repeats it
        // when the grouping is by age.
        sub_label: showProject
          ? `${task.project} · due ${formatIsoDate(task.due_on)}`
          : `Due ${formatIsoDate(task.due_on)}`,
        circle_label: `Complete ${task.title}`,
        url: task.url,
        has_url: Boolean(task.url),
        // Only the first row of a run carries the heading, so one flat repeat
        // renders a grouped list.
        show_group: index === 0,
        // Upper-cased here, not by a class: `Caption` has no transform prop
        // and plugin elements cannot ship CSS.
        group_label: group.label.toUpperCase(),
        group_tone: group.tone,
        group_count: group.items.length,
        group_meta: group.meta,
        show_group_meta: index === 0 && Boolean(group.meta),
        group_dot_tone: group.dot_tone,
        show_group_dot: index === 0 && group.show_dot,
      };
    }),
  );

  const projectCount = projectOrder.length;
  const bucketLabel = bucket === 'all' ? '' : BUCKET_HEADING[bucket as BucketKey];

  return {
    header_label: total === 0 ? 'Asana' : `Asana · avg ${avgDays} days late`,
    has_tasks: total > 0,
    stat_overdue: total,
    stat_projects: projectCount,
    stat_longest: `${longest}d`,
    segments,
    bar_template: barTemplate,
    chips,
    show_chips: chips.length > 2,
    group_age_selected: groupMode === 'age',
    group_project_selected: groupMode === 'project',
    rows,
    has_rows: rows.length > 0,
    empty_message: "You're all caught up — nothing overdue.",
    footer_label:
      bucket === 'all'
        ? `${total} overdue · ${projectCount} ${projectCount === 1 ? 'project' : 'projects'}`
        : `${rows.length} of ${total} overdue · ${bucketLabel}`,
  };
};

// ── Project Progress board ───────────────────────────────────────────────────
// `flatten_project_board` is the single helper behind the Project Progress
// tile, same one-pass shape as the two boards above.
//
// WHAT THE API DOES NOT GIVE US -- the reference design showed an overdue count
// per project and derived each project's status from it. `list_projects`
// returns `task_counts` with `num_tasks` and `num_completed_tasks` and nothing
// else: no due dates, no overdue tally (confirmed against the live workspace on
// 2026-11-11). Asana has no project-level overdue field either -- getting one
// would mean listing every task of every project, which is one call per project
// and not something a tile's single dataProvider can do. So status here is
// derived from completion instead, on the same thresholds the previous version
// of this tile already used, and the second caption slot carries the remaining
// count rather than an overdue count.

const PROGRESS_STATES = ['behind', 'risk', 'ok'] as const;
type ProgressState = (typeof PROGRESS_STATES)[number];

/** Completion below this is "Behind"; below RISK_BELOW is "At risk". */
const BEHIND_BELOW = 40;
const RISK_BELOW = 70;

const PROGRESS_TONE: Record<ProgressState, string> = {
  behind: 'destructive',
  risk: 'warning',
  ok: 'success',
};

const PROGRESS_LABEL: Record<ProgressState, string> = {
  behind: 'Behind',
  risk: 'At risk',
  ok: 'On track',
};

const SORT_KEYS = ['low', 'high', 'az'] as const;
type SortKey = (typeof SORT_KEYS)[number];

/** The sort control is a one-button cycle, so each mode names the next one. */
const SORT_NEXT: Record<SortKey, SortKey> = { low: 'high', high: 'az', az: 'low' };

function progressStateFor(pct: number): ProgressState {
  if (pct < BEHIND_BELOW) return 'behind';
  if (pct < RISK_BELOW) return 'risk';
  return 'ok';
}

interface ProjectCard {
  id: string;
  name: string;
  pct: number;
  /** '' for a project with no tasks at all -- it has no percentage to show. */
  state: ProgressState | '';
  done: number;
  total: number;
  url: string;
}

/**
 * Builds the whole Project Progress board from one `list_projects` response:
 * the overall completion hero, the status filter chips, and the project cards
 * for whichever filter and sort are selected.
 *
 * Args: { value: array, filter?: string, sort?: string }
 *   value  -- `list_projects`' `data` array.
 *   filter -- 'all' (default) | 'behind' | 'risk' | 'ok'.
 *   sort   -- 'low' (default, worst first) | 'high' | 'az'. Lowest-first is the
 *             default because the tile is for spotting what is lagging.
 *
 * Returns ONE object at `/ui/board` -- the tile needs the hero and the chips
 * alongside the cards, and a spec can only repeat over a flat array.
 *
 * A project with no tasks has no percentage, so it gets its own "No tasks"
 * state: it stays visible under "All" but is deliberately absent from the
 * status chips and their counts, rather than being rounded into "Behind" at 0%.
 */
const flatten_project_board: ComputedFunction = (args) => {
  const raw = Array.isArray(args.value) ? (args.value as Record<string, unknown>[]) : [];

  const requestedSort = String(args.sort ?? 'low');
  const sort: SortKey = (SORT_KEYS as readonly string[]).includes(requestedSort)
    ? (requestedSort as SortKey)
    : 'low';

  const projects: ProjectCard[] = raw.map((proj) => {
    const counts = (proj.task_counts ?? null) as Record<string, unknown> | null;
    const total = counts ? Number(counts.num_tasks ?? 0) : 0;
    const done = counts ? Number(counts.num_completed_tasks ?? 0) : 0;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return {
      id: String(proj.gid ?? proj.id ?? ''),
      name: String(proj.name ?? ''),
      pct,
      state: total > 0 ? progressStateFor(pct) : '',
      done,
      total,
      url: proj.permalink_url ? String(proj.permalink_url) : '',
    };
  });

  const counts: Record<ProgressState, number> = { behind: 0, risk: 0, ok: 0 };
  for (const project of projects) {
    if (project.state) counts[project.state]++;
  }

  const totalTasks = projects.reduce((sum, p) => sum + p.total, 0);
  const doneTasks = projects.reduce((sum, p) => sum + p.done, 0);
  const overallPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  // A filter nothing matches would strand the user on an empty grid, so fall
  // back to 'all' -- same guard as the other two boards.
  const requestedFilter = String(args.filter ?? 'all');
  const filter: string =
    (PROGRESS_STATES as readonly string[]).includes(requestedFilter) &&
    counts[requestedFilter as ProgressState] > 0
      ? requestedFilter
      : 'all';

  const chips = [
    {
      id: 'all',
      filter: 'all',
      chip_text: `All  ${projects.length}`,
      tone: 'default',
      selected: filter === 'all',
    },
    // A status with nothing in it is dropped rather than shown as a dead "0":
    // the chips are for narrowing, and a chip that can only ever empty the grid
    // is noise in a row that is already tight for space.
    ...PROGRESS_STATES.filter((key) => counts[key] > 0).map((key) => ({
      id: key,
      filter: key as string,
      chip_text: `${PROGRESS_LABEL[key]}  ${counts[key]}`,
      tone: PROGRESS_TONE[key],
      selected: filter === key,
    })),
  ];

  const visible = filter === 'all' ? projects : projects.filter((p) => p.state === filter);
  const sorted = [...visible].sort((a, b) => {
    if (sort === 'az') return a.name.localeCompare(b.name);
    if (sort === 'high') return b.pct - a.pct || a.name.localeCompare(b.name);
    return a.pct - b.pct || a.name.localeCompare(b.name);
  });

  const cards = sorted.map((project) => {
    const hasTasks = project.total > 0;
    const tone = hasTasks ? PROGRESS_TONE[project.state as ProgressState] : 'muted';
    const left = project.total - project.done;
    return {
      id: project.id,
      name: project.name,
      pct: project.pct,
      pct_label: hasTasks ? `${project.pct}%` : '—',
      tone,
      status_label: hasTasks ? PROGRESS_LABEL[project.state as ProgressState] : 'No tasks',
      done_label: hasTasks ? `${project.done} of ${project.total} done` : 'No tasks yet',
      left_label: `${left} left`,
      show_left: hasTasks && left > 0,
      url: project.url,
      has_url: Boolean(project.url),
    };
  });

  const projectNoun = projects.length === 1 ? 'project' : 'projects';

  return {
    header_label:
      projects.length === 0
        ? 'Asana'
        : `Asana · ${projects.length} active ${projectNoun}`,
    has_projects: projects.length > 0,
    overall_pct: overallPct,
    overall_pct_label: `${overallPct}%`,
    overall_tone: totalTasks > 0 ? PROGRESS_TONE[progressStateFor(overallPct)] : 'muted',
    hero_tasks_label: `${doneTasks} of ${totalTasks} tasks complete`,
    hero_projects_label: `across ${projects.length} ${projectNoun}`,
    chips,
    show_chips: chips.length > 1,
    sort,
    sort_label:
      sort === 'low' ? 'Sort: Lowest %' : sort === 'high' ? 'Sort: Highest %' : 'Sort: A–Z',
    sort_next: SORT_NEXT[sort],
    sort_low_selected: sort === 'low',
    sort_high_selected: sort === 'high',
    sort_az_selected: sort === 'az',
    cards,
    has_cards: cards.length > 0,
    empty_message: 'No active projects found.',
    footer_label:
      filter === 'all'
        ? `${projects.length} active ${projectNoun} · ${doneTasks} of ${totalTasks} tasks done`
        : `${cards.length} of ${projects.length} ${projectNoun} · ${PROGRESS_LABEL[filter as ProgressState]}`,
  };
};

/**
 * Flattens a `list_milestones` response into the whole Upcoming Milestones
 * view: a "next milestone" hero, a proportional runway of date markers, and
 * a grouped, range-filtered list.
 *
 * What `list_milestones` can and cannot tell us, read off the server source
 * (`myhub-mcp-servers` asana.ts) and confirmed against the live workspace on
 * 2026-11-13:
 *
 *  - ONLY THE FIRST 20 ACTIVE PROJECTS ARE SCANNED. The server asks
 *    `/projects` for `limit: 20` and does not paginate, so a milestone in the
 *    21st project is invisible to this tile. The footnote says so.
 *  - THE PER-PROJECT TASK FETCH IS NOT PAGINATED EITHER, so a milestone past
 *    the first page of a very busy project's task list can be missed.
 *  - A MILESTONE IS A TASK WITH `resource_subtype === "milestone"` AND A DUE
 *    DATE. A task a team treats as a milestone but never flagged as one, or
 *    one with no due date, never appears.
 *  - NO PROJECT COLOUR. `/projects` is fetched with `opt_fields: "gid,name"`,
 *    so the per-project colour dots in the reference design have no data
 *    behind them. Projects are told apart by name here rather than by a
 *    colour this connector would have to invent.
 *  - NO OWNER AND NO PERMALINK. `opt_fields` asks for neither, so there is no
 *    assignee to show, and row links are built from `project_gid` + `gid` in
 *    Asana's long-standing `/0/{project}/{task}` form rather than from a real
 *    `permalink_url`.
 */
const RANGE_KEYS = ['14', '30', 'all'] as const;
type RangeKey = (typeof RANGE_KEYS)[number];
const RANGE_DAYS: Record<RangeKey, number> = {
  '14': 14,
  '30': 30,
  all: Number.POSITIVE_INFINITY,
};

/** Within this many days the milestone reads as urgent rather than planned. */
const MILESTONE_SOON_DAYS = 3;

/**
 * Minimum separation between two runway markers, as a fraction of the axis --
 * roughly one dot's width on a tile-sized card. Applied as a nudge to the
 * SECOND of two markers that would otherwise overlap, rather than as a floor
 * under every track: a floor shifts every later marker right by its own width
 * as well, which quietly turns a proportional runway into an evenly-spaced one
 * once there are more than a handful of milestones.
 */
const RUNWAY_MIN_SEPARATION = 0.03;

const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Weekday for a YYYY-MM-DD calendar date, read in UTC so it cannot slip a day. */
function weekdayOf(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (![y, m, d].every((n) => Number.isFinite(n))) return '';
  return WEEKDAY_ABBR[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? '';
}

/** YYYY-MM-DD `days` after `ymd`, in UTC. */
function isoPlusDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (![y, m, d].every((n) => Number.isFinite(n))) return ymd;
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`;
}

/**
 * Builds the whole Upcoming Milestones view.
 *
 * Args: { value: array, range: "14" | "30" | "all" }
 *
 * Returns an object written to `/ui/board`:
 *   header_label, has_any, has_rows, empty_message
 *   has_next, next_name, next_meta, next_count, next_count_caption,
 *   next_tone, next_url, next_has_url
 *   range_14_variant / range_14_tone (and _30_, _all_)
 *   show_runway, runway_template, markers[], axis_start_label, axis_end_label
 *   rows[], footnote, footer_label
 */
const flatten_milestone_runway: ComputedFunction = (args) => {
  const raw = Array.isArray(args.value) ? (args.value as Record<string, unknown>[]) : [];
  const range: RangeKey = (RANGE_KEYS as readonly string[]).includes(String(args.range))
    ? (String(args.range) as RangeKey)
    : 'all';
  const today = todayIsoDate();

  const all = raw
    .map((entry, index) => {
      const m = entry as Record<string, unknown>;
      const id = String(m.gid ?? `milestone-${index}`);
      const projectGid = String(m.project_gid ?? '');
      const dueOn = String(m.due_on ?? '');
      return {
        id,
        name: String(m.name ?? '').trim() || 'Untitled milestone',
        project: String(m.project_name ?? ''),
        due_on: dueOn,
        days: dueOn ? daysBetween(dueOn, today) : 0,
        url: m.gid && projectGid ? `https://app.asana.com/0/${projectGid}/${id}` : '',
      };
    })
    .filter((m) => m.due_on !== '')
    // The server sorts, but a tile should not lean on an upstream sort it does
    // not control -- and `days` is measured against the VIEWER's today, which
    // can differ from the server's by a day in either direction.
    .sort((a, b) => a.days - b.days || a.name.localeCompare(b.name));

  const within = all.filter((m) => m.days <= RANGE_DAYS[range]);
  const projectCount = new Set(within.map((m) => m.project).filter(Boolean)).size;

  // The hero is the soonest milestone overall, not the soonest one inside the
  // chosen range: "what is next" should not change because the viewer narrowed
  // the runway to a fortnight.
  const next = all[0];
  const nextTone = next && next.days <= MILESTONE_SOON_DAYS ? 'warning' : 'brand';

  // The axis always starts at today. For a fixed range it ends at the range;
  // for "All" it ends a week past the last milestone, so the final marker sits
  // inside the rail rather than flush against its end.
  const lastDays = within.length > 0 ? within[within.length - 1].days : 0;
  const axisDays = range === 'all' ? Math.max(lastDays + 7, 28) : RANGE_DAYS[range];

  let lastGroup = '';
  const rows = within.map((m) => {
    const soon = m.days <= MILESTONE_SOON_DAYS;
    const group = `${MONTH_FULL[Number(m.due_on.split('-')[1]) - 1] ?? ''} ${m.due_on.slice(0, 4)}`.trim();
    const showGroup = group !== lastGroup;
    lastGroup = group;

    return {
      id: m.id,
      name: m.name,
      // The date tile carries the weekday and the day of the month for
      // scanning; the meta line carries the full dd-Mmm-yy, which is the form
      // the display standard requires a tile to actually show.
      weekday_label: weekdayOf(m.due_on).toUpperCase(),
      day_label: String(Number(m.due_on.split('-')[2] ?? 0)),
      tone: soon ? 'warning' : 'brand',
      meta_label: m.project ? `${m.project} · ${formatIsoDate(m.due_on)}` : formatIsoDate(m.due_on),
      in_label: m.days <= 0 ? 'Today' : m.days === 1 ? 'Tomorrow' : `in ${m.days}d`,
      url: m.url,
      has_url: m.url !== '',
      show_group: showGroup,
      group_label: group,
    };
  });

  // The runway is one grid row whose tracks are the GAPS between consecutive
  // milestones, scaled to the axis. Each marker sits at the end of its own
  // track, so the dots land at their true proportional dates, and a trailing
  // filler track with no child holds the rest of the axis open. This is the
  // only way to place something at an arbitrary x here: no element in the
  // system takes a position or a width.
  let cursor = 0;
  let placed = 0;
  const tracks: string[] = [];
  const markers = within.map((m) => {
    const raw = Math.min(1, Math.max(0, m.days / axisDays));
    // Two milestones on the same day draw one dot on top of the other, so the
    // later one is nudged along just far enough to stay its own dot.
    const pos = placed === 0 ? raw : Math.min(1, Math.max(raw, cursor + RUNWAY_MIN_SEPARATION));
    placed += 1;
    // Thousandths, so the fr units stay whole numbers.
    const span = Math.max(0, Math.round((pos - cursor) * 1000));
    cursor = pos;
    // Each marker hangs off the END of its track, so a milestone due today
    // sits in a zero-width first track and its dot would hang off the left of
    // the rail entirely. One dot's worth of floor on the first track only
    // keeps it on the rail; later tracks take no floor, so the rest of the
    // runway stays proportional.
    tracks.push(`minmax(${placed === 1 ? '0.5rem' : '0'}, ${span}fr)`);
    return { id: m.id, tone: m.days <= MILESTONE_SOON_DAYS ? 'warning' : 'brand' };
  });
  tracks.push(`minmax(0, ${Math.max(0, Math.round((1 - cursor) * 1000))}fr)`);

  const soonCount = within.filter((m) => m.days <= MILESTONE_SOON_DAYS).length;

  return {
    header_label: all.length > 0 ? `Asana · ${all.length} upcoming` : 'Asana',
    has_any: all.length > 0,
    has_rows: rows.length > 0,
    empty_message:
      all.length === 0 || range === 'all'
        ? 'No incomplete milestones are due across your active projects.'
        : range === '14'
          ? 'Nothing due in the next two weeks — widen the runway to see what is further out.'
          : 'Nothing due in the next month — widen the runway to see what is further out.',

    has_next: Boolean(next),
    next_name: next ? next.name : '',
    next_meta: next
      ? next.project
        ? `${next.project} · ${formatIsoDate(next.due_on)}`
        : formatIsoDate(next.due_on)
      : '',
    next_count: next ? (next.days <= 0 ? 'Today' : String(next.days)) : '',
    next_count_caption: next
      ? next.days <= 0
        ? 'due now'
        : next.days === 1
          ? 'day to go'
          : 'days to go'
      : '',
    next_tone: nextTone,
    next_url: next ? next.url : '',
    next_has_url: Boolean(next && next.url),

    range_14_variant: range === '14' ? 'soft' : 'outline',
    range_14_tone: range === '14' ? 'brand' : 'muted',
    range_30_variant: range === '30' ? 'soft' : 'outline',
    range_30_tone: range === '30' ? 'brand' : 'muted',
    range_all_variant: range === 'all' ? 'soft' : 'outline',
    range_all_tone: range === 'all' ? 'brand' : 'muted',

    show_runway: markers.length > 0,
    runway_template: tracks.join(' '),
    markers,
    axis_start_label: 'Today',
    axis_end_label: formatIsoDate(isoPlusDays(today, axisDays)),

    rows,

    footnote:
      'Milestones are Asana tasks flagged as milestones with a due date, found by scanning the first 20 active projects in the workspace — anything in a project past those 20 is not searched. Rows open Asana from project and task ids, not from an API permalink.',
    footer_label:
      all.length === 0
        ? 'Synced from Asana'
        : rows.length === all.length
          ? `${all.length} milestone${all.length === 1 ? '' : 's'} · ${projectCount} project${projectCount === 1 ? '' : 's'}`
          : `${rows.length} of ${all.length} shown${soonCount > 0 ? ` · ${soonCount} within 3 days` : ''}`,
  };
};

/**
 * Turns a compact Asana user's `name` into "F. Lastname" display + "FL"
 * initials. Handles a real data-quality wrinkle confirmed live 2026-09-15:
 * some accounts have never set an Asana display name, so `name` is just
 * their raw email (e.g. "jeremy.fermin@mysmb.com") -- detected and split on
 * "." in the local part to recover a name-shaped string before formatting,
 * rather than showing the initials of an email address.
 */
function formatPersonName(rawName: string): { displayName: string; initials: string } {
  let fullName = rawName.trim();
  if (fullName.includes('@')) {
    const localPart = fullName.split('@')[0];
    fullName = localPart
      .split(/[.\-_]+/)
      .filter(Boolean)
      .map((p) => p[0].toUpperCase() + p.slice(1))
      .join(' ');
  }
  if (!fullName) return { displayName: '', initials: '' };

  const parts = fullName.split(/\s+/).filter(Boolean);
  const displayName = parts.length >= 2 ? `${parts[0][0]}. ${parts[parts.length - 1]}` : fullName;
  const initials = (parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`
    : fullName.slice(0, 2)
  ).toUpperCase();
  return { displayName, initials };
}

// ── Recent Activity board ────────────────────────────────────────────────────
// `flatten_activity_board` is the single helper behind the Recent Activity
// tile. Same one-pass shape as the other three boards: filter, sort, group and
// label in one go, because a tile spec can only repeat over a flat array.
//
// It carries forward every caveat `flatten_recent_activity` documented, all of
// them re-confirmed against the live workspace on 2026-11-11:
//
//  - THIS IS NOT A REAL ACTIVITY STREAM. The Asana MCP gateway has no
//    stories/events tool, so comments, status-column moves and "added N tasks"
//    events don't exist here. Activity is derived from task fields that ARE
//    real: `completed`, `modified_at`, `created_at` and `assignee`.
//  - THE ACTOR IS A PROXY. `assignee` is who the task belongs to, not a
//    confirmed record of who completed or edited it — nothing in this gateway
//    can say that. Disclosed in the tile's own footnote, not just here.
//  - `completed_at` IS NOT RETURNED. The live response carries exactly gid,
//    assignee, completed, created_at, due_on, modified_at, name, notes,
//    permalink_url, projects, resource_subtype, workspace. The previous helper
//    read `completed_at` and silently fell through to `modified_at` every
//    time; this one reads `modified_at` directly and says so. Completing a
//    task does modify it, so the two agree unless the task is edited again
//    afterwards. Adding `completed_at` to TASK_OPT_FIELDS in
//    myhub-mcp-servers would make it exact -- a different repo.
//  - ONE HARDCODED PROJECT. `dataProvider.params.project_gid` is fixed because
//    the platform has no per-installation widget config. Pointing the tile at
//    another project means editing that value.

const MONTH_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const ACTIVITY_TYPES = ['completed', 'updated'] as const;
type ActivityType = (typeof ACTIVITY_TYPES)[number];

const ACTIVITY_TONE: Record<ActivityType, string> = {
  completed: 'success',
  // Orange, from the tile's own `brandColor` -- an edit isn't a status, so it
  // gets the connector's accent rather than warning/destructive.
  updated: 'brand',
};

const ACTIVITY_CHIP: Record<ActivityType, string> = {
  completed: 'Done',
  updated: 'Updated',
};

/** Newest first, so index 0 is the most recent event everywhere below. */
const MAX_ACTIVITY_ROWS = 20;

interface ActivityEvent {
  id: string;
  title: string;
  person: string;
  display_name: string;
  initials: string;
  type: ActivityType;
  at: string;
  at_ms: number;
  url: string;
}

/** "just now" / "5h ago" / "3d ago", then dd-Mmm-yy past a week.
 *  Relative reads better for a feed, but anything older than a few days is
 *  more useful as a real date -- and TILE-DISPLAY-STANDARDS fixes that format. */
function activityTimeLabel(atMs: number, nowMs: number): string {
  const diff = nowMs - atMs;
  if (!Number.isFinite(diff) || diff < 0) return '';
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(diff / 86400000);
  if (days < 7) return `${days}d ago`;
  const d = new Date(atMs);
  return `${pad2(d.getDate())}-${MONTH_ABBR[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`;
}

/** TODAY / YESTERDAY / SEPTEMBER 2026. Upper-cased here because `Caption` has
 *  no transform prop and plugin elements cannot ship CSS. */
function activityGroupOf(atMs: number, now: Date): { label: string; today: boolean } {
  const d = new Date(atMs);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const daysBack = Math.round((startOfToday - startOfDay) / 86400000);
  if (daysBack <= 0) return { label: 'TODAY', today: true };
  if (daysBack === 1) return { label: 'YESTERDAY', today: false };
  return { label: `${MONTH_FULL[d.getMonth()]} ${d.getFullYear()}`.toUpperCase(), today: false };
}

/**
 * Builds the whole Recent Activity board from one project-scoped `list_tasks`
 * response: the people filter, the action filter with its counts, and the
 * grouped feed for whichever filters are selected.
 *
 * Args: { value: array, type?: string, who?: string }
 *   value -- `list_tasks`' `data` array, project_gid-scoped.
 *   type  -- 'all' (default) | 'completed' | 'updated'.
 *   who   -- an assignee's raw name, or '' / absent for everyone.
 *
 * The two filters are faceted: the action counts describe whoever is selected
 * in the people row, so the chips always add up to what the feed can show.
 *
 * Returns ONE object at `/ui/board`.
 */
const flatten_activity_board: ComputedFunction = (args) => {
  const raw = Array.isArray(args.value) ? (args.value as Record<string, unknown>[]) : [];
  const now = new Date();
  const nowMs = now.getTime();

  const events: ActivityEvent[] = [];
  for (const task of raw) {
    const id = String(task.gid ?? task.id ?? '');
    const isCompleted = Boolean(task.completed);
    // See the header note: `completed_at` is not in the response, so the
    // modification time stands in for the completion time.
    const at = String(task.modified_at ?? task.created_at ?? '');
    const atMs = Date.parse(at);
    if (!Number.isFinite(atMs)) continue;

    const assignee = (task.assignee ?? null) as Record<string, unknown> | null;
    const person = assignee?.name ? String(assignee.name) : '';
    const { displayName, initials } = formatPersonName(person);

    const projects = Array.isArray(task.projects) ? (task.projects as Record<string, unknown>[]) : [];
    const projectGid = projects.length > 0 ? String(projects[0].gid ?? '') : '';
    const permalink = task.permalink_url ? String(task.permalink_url) : '';

    events.push({
      id,
      title: String(task.name ?? ''),
      person,
      display_name: displayName,
      initials,
      type: isCompleted ? 'completed' : 'updated',
      at,
      at_ms: atMs,
      url: permalink || (id && projectGid ? `https://app.asana.com/0/${projectGid}/${id}` : ''),
    });
  }

  events.sort((a, b) => b.at_ms - a.at_ms);
  const recent = events.slice(0, MAX_ACTIVITY_ROWS);

  // People, in order of their most recent event -- `recent` is already sorted,
  // so first-seen is most-recently-active. Positional chart tones for the same
  // reason as `toneMapFor`: hashing a name is stable but collides, and two
  // people sharing a colour defeats the avatars entirely.
  const peopleOrder: string[] = [];
  for (const event of recent) {
    if (event.person && !peopleOrder.includes(event.person)) peopleOrder.push(event.person);
  }
  const personTones = toneMapFor(peopleOrder);

  const requestedWho = String(args.who ?? '');
  const who = peopleOrder.includes(requestedWho) ? requestedWho : '';

  const byPerson = who ? recent.filter((event) => event.person === who) : recent;

  const counts: Record<ActivityType, number> = { completed: 0, updated: 0 };
  for (const event of byPerson) counts[event.type]++;

  // A filter nothing matches would strand the user on an empty feed.
  const requestedType = String(args.type ?? 'all');
  const type: string =
    (ACTIVITY_TYPES as readonly string[]).includes(requestedType) &&
    counts[requestedType as ActivityType] > 0
      ? requestedType
      : 'all';

  const visible = type === 'all' ? byPerson : byPerson.filter((event) => event.type === type);

  const whoLabel = who ? formatPersonName(who).displayName : '';

  const people = peopleOrder.map((person) => {
    const selected = person === who;
    const { displayName, initials } = formatPersonName(person);
    return {
      id: person,
      initials,
      label: displayName,
      selected,
      // Everyone keeps their colour until someone is picked, then the rest go
      // muted -- the reference design's "dim the others" behaviour, which is
      // also the only selection signal `Avatar` can carry (it takes initials,
      // tone and size, and nothing else).
      tone: !who || selected ? personTones.get(person) ?? 'muted' : 'muted',
      /** Clicking the selected person clears the filter. */
      click_value: selected ? '' : person,
    };
  });

  const chips = [
    {
      id: 'all',
      type: 'all',
      chip_text: `All  ${byPerson.length}`,
      tone: 'default',
      selected: type === 'all',
    },
    ...ACTIVITY_TYPES.filter((key) => counts[key] > 0).map((key) => ({
      id: key,
      type: key as string,
      chip_text: `${ACTIVITY_CHIP[key]}  ${counts[key]}`,
      tone: ACTIVITY_TONE[key],
      selected: type === key,
    })),
  ];

  let lastGroup = '';
  const rows = visible.map((event) => {
    const group = activityGroupOf(event.at_ms, now);
    const isNewGroup = group.label !== lastGroup;
    lastGroup = group.label;
    return {
      id: event.id,
      title: event.title,
      initials: event.initials,
      avatar_tone: event.person ? personTones.get(event.person) ?? 'muted' : 'muted',
      name_label: event.display_name || 'Unassigned',
      verb_label: event.type === 'completed' ? 'completed' : 'updated',
      verb_tone: ACTIVITY_TONE[event.type],
      /** Flagged in the feed for a day, same window as the "just now"/"Nh ago"
       *  labels, so "NEW" and the timestamp never disagree. */
      is_new: nowMs - event.at_ms < 86400000,
      time_label: activityTimeLabel(event.at_ms, nowMs),
      url: event.url,
      has_url: Boolean(event.url),
      show_group: isNewGroup,
      group_label: group.label,
      group_tone: group.today ? 'brand' : 'muted',
    };
  });

  const firstProject = raw.find((task) => {
    const projects = Array.isArray(task.projects) ? (task.projects as Record<string, unknown>[]) : [];
    return projects.length > 0;
  });
  const projectEntry = firstProject
    ? ((firstProject.projects as Record<string, unknown>[])[0] ?? null)
    : null;
  const projectName = projectEntry ? String(projectEntry.name ?? '') : '';
  const projectGid = projectEntry ? String(projectEntry.gid ?? '') : '';
  // The task permalink is `.../project/<gid>/task/<gid>`, so the project's own
  // page is that URL with the task segment removed -- derived from a real API
  // value rather than hand-built, the same preference `flatten_projects` has.
  const sampleUrl = recent.find((event) => event.url.includes('/task/'))?.url ?? '';
  const projectUrl = sampleUrl
    ? sampleUrl.slice(0, sampleUrl.indexOf('/task/'))
    : projectGid
      ? `https://app.asana.com/0/${projectGid}`
      : 'https://app.asana.com/';

  return {
    project_name: projectName,
    show_project: Boolean(projectName),
    project_url: projectUrl,
    has_events: recent.length > 0,
    people,
    show_people: people.length > 1,
    // A named chip beside the avatars, shown only while a person is picked.
    // The avatars carry selection by colour alone (`Avatar` takes initials,
    // tone and size and nothing else), and those colours are `chart-*` --
    // categorical tones that a platform build without them renders as bare
    // initials, which would leave the filter with no visible state at all.
    // This chip is a semantic tone, so it renders everywhere, and it doubles
    // as the obvious way to clear the filter.
    who_label: whoLabel,
    show_who: Boolean(who),
    chips,
    show_chips: chips.length > 1,
    type,
    rows,
    has_rows: rows.length > 0,
    empty_message: 'No activity matches these filters.',
    footnote:
      'Completions and edits only, attributed to each task’s assignee — Asana’s activity stream (comments, column moves) isn’t available to this connector.',
    footer_label:
      rows.length === recent.length
        ? `${recent.length} recent item${recent.length === 1 ? '' : 's'}`
        : `${rows.length} of ${recent.length}${whoLabel ? ` · ${whoLabel}` : ''}${
            type === 'all' ? '' : ` · ${ACTIVITY_CHIP[type as ActivityType]}`
          }`,
  };
};


const elements: PluginElementsModule = {
  slug: 'asana',
  functions: {
    format_date,
    flatten_my_tasks,
    flatten_projects,
    flatten_project_board,
    flatten_overdue_board,
    flatten_workload_board,
    step_capacity,
    flatten_my_tasks_board,
    flatten_milestone_runway,
    flatten_activity_board,
  },
};

export default elements;
