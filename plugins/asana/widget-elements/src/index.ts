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
const flatten_project_progress: ComputedFunction = (args) => {
  const raw = Array.isArray(args.value) ? (args.value as Record<string, unknown>[]) : [];
  if (raw.length === 0) return [];

  let atRisk = 0;
  let behind = 0;

  const rows = raw.map((proj) => {
    const id = String(proj.gid ?? proj.id ?? '');
    const name = String(proj.name ?? '');

    const taskCounts = proj.task_counts as Record<string, unknown> | null | undefined;
    const numTasks = taskCounts ? Number(taskCounts.num_tasks ?? 0) : 0;
    const numCompleted = taskCounts ? Number(taskCounts.num_completed_tasks ?? 0) : 0;
    const pct = numTasks > 0 ? Math.round((numCompleted / numTasks) * 100) : 0;

    let tone = 'muted';
    let pctLabel = '—';
    if (numTasks > 0) {
      pctLabel = `${pct}%`;
      if (pct < 40) { tone = 'destructive'; behind++; }
      else if (pct < 70) { tone = 'warning'; atRisk++; }
    }

    return {
      id,
      name,
      pct,
      pct_label: pctLabel,
      tone,
      stat_active: '',
      stat_at_risk: '',
      stat_behind: '',
      footer_label: '',
    };
  });

  const total = raw.length;
  rows[0].stat_active = String(total);
  rows[0].stat_at_risk = String(atRisk);
  rows[0].stat_behind = String(behind);
  rows[0].footer_label = `${total} active project${total === 1 ? '' : 's'}`;

  return rows;
};

/**
 * Flattens a get_team_workload response into display rows for the Team Workload tile.
 * Expects data already sorted descending by task_count from the MCP tool.
 *
 * Row 0 carries footer_label: "N active tasks across team".
 * Each row has: id, display_name ("F. Lastname"), initials ("AC"), task_count,
 * task_label ("N task(s)"), pct (0–100 relative to max), footer_label.
 *
 * Args: { value: array }
 */
const flatten_team_workload: ComputedFunction = (args) => {
  const raw = Array.isArray(args.value) ? (args.value as Record<string, unknown>[]) : [];
  if (raw.length === 0) return [];

  // already sorted desc by task_count from the MCP tool
  const maxCount = Number((raw[0] as Record<string, unknown>).task_count ?? 0);

  const rows = raw.map((member) => {
    const m = member as Record<string, unknown>;
    const id = String(m.user_gid ?? '');
    const fullName = String(m.name ?? '');
    const taskCount = Number(m.task_count ?? 0);

    // "F. Lastname" format
    const parts = fullName.trim().split(/\s+/);
    const displayName = parts.length >= 2
      ? `${parts[0][0]}. ${parts[parts.length - 1]}`
      : fullName;

    // "AC" initials
    const initials = parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : fullName.slice(0, 2).toUpperCase();

    const pct = maxCount > 0 ? Math.round((taskCount / maxCount) * 100) : 0;
    const taskLabel = `${taskCount} task${taskCount === 1 ? '' : 's'}`;

    return {
      id,
      display_name: displayName,
      initials,
      task_count: taskCount,
      task_label: taskLabel,
      pct,
      footer_label: '',
    };
  });

  const totalTasks = raw.reduce((sum, m) => sum + Number((m as Record<string, unknown>).task_count ?? 0), 0);
  rows[0].footer_label = `${totalTasks} active task${totalTasks === 1 ? '' : 's'} across team`;

  return rows;
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
 * `flatten_recent_activity` uses for people) is stable across refreshes but
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

/**
 * Flattens a list_milestones response into display rows for the Upcoming
 * Milestones tile. `list_milestones` is server-side pre-filtered to
 * incomplete milestones due today or later, sorted by due date ascending --
 * so unlike `flatten_my_tasks`/`flatten_my_tasks_tabs` above, there is no
 * overdue/destructive case to handle here, only "due today" vs "due later".
 *
 * Row 0 carries footer_label: "N upcoming milestones".
 * Each row has: id, name, due_label (dd-Mmm-yy or "Due Today"),
 * due_tone ("warning" if due today, "brand" [mint] otherwise), project_label, url.
 *
 * `url` is built client-side from `project_gid` + `gid` as
 * `https://app.asana.com/0/{project_gid}/{gid}` -- Asana's long-standing
 * "legacy" task deep-link format (project id then task id). `list_milestones`
 * doesn't request the real `permalink_url` field the way this plugin's
 * `flatten_projects` does (that would need a `myhub-mcp-servers` change,
 * a different repo), so this is a manually-constructed link based on
 * Asana's known URL convention, NOT sandbox-confirmed by actually clicking
 * it -- unlike `flatten_projects`' `permalink_url`, which IS a real API
 * value. Flag for live click-through verification.
 *
 * Args: { value: array } -- `list_milestones`'s `data` array.
 */
const flatten_milestones: ComputedFunction = (args) => {
  const raw = Array.isArray(args.value) ? (args.value as Record<string, unknown>[]) : [];
  if (raw.length === 0) return [];

  const todayStr = new Date().toISOString().slice(0, 10);

  const rows = raw.map((m) => {
    const id = String(m.gid ?? '');
    const name = String(m.name ?? '');
    const projectLabel = String(m.project_name ?? '');
    const projectGid = String(m.project_gid ?? '');
    const url = id && projectGid ? `https://app.asana.com/0/${projectGid}/${id}` : '';
    const dueOn = m.due_on ? String(m.due_on) : null;

    // 'brand' (mint) is the calm default per the mockup Neil supplied 2026-09-14
    // -- only "due today" escalates to 'warning'. Deliberately not 'muted':
    // a date isn't a "nothing to report" field the way an untouched status is.
    let dueLabel = '';
    let dueTone = 'brand';
    if (dueOn) {
      if (dueOn === todayStr) {
        dueLabel = 'Due Today';
        dueTone = 'warning';
      } else {
        const ms = Date.parse(dueOn);
        if (!Number.isNaN(ms)) {
          const d = new Date(ms);
          dueLabel = `${String(d.getDate()).padStart(2, '0')}-${MONTH_ABBR[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
        }
      }
    }

    return { id, name, due_label: dueLabel, due_tone: dueTone, project_label: projectLabel, url, footer_label: '' };
  });

  const total = raw.length;
  rows[0].footer_label = `${total} upcoming milestone${total === 1 ? '' : 's'}`;

  return rows;
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

/**
 * Flattens a list_tasks response (project_gid-scoped) into rows for the
 * Recent Activity tile.
 *
 * Approximation, not a true activity feed: the Asana MCP gateway has no
 * stories/events tool (no per-task comments, status-column moves, or
 * "added N tasks" grouping) as of 2026-09-15 -- only list_tasks, get_task,
 * list_projects, get_project, list_sections, list_users, get_team_workload,
 * list_milestones, plus the write tools. This derives "activity" purely from
 * task fields that ARE real: `completed`/`completed_at`, `modified_at`, and
 * `assignee` (a real compact-user field, live-confirmed 2026-09-15).
 *
 * Scoping history (this function has flip-flopped on user request while
 * chasing a reference mockup -- kept here so a future session doesn't
 * re-derive it from scratch):
 * 1. `assignee: "me"`, no name shown -- every row was implicitly "you".
 * 2. `created_by` instead -- confirmed via a live captured list_tasks
 *    response that this gateway never returns that field, even though it's
 *    a real Asana Task field. Dead end.
 * 3. `project_gid`-scoped + `assignee` -- live-confirmed varied real names,
 *    but only one project's worth of activity.
 * 4. Reverted to (1) on user request (multi-project breadth over names).
 * 5. THIS version: back to (3) on user request ("match the mockup as
 *    closely as possible" -- the mockup's whole visual identity is
 *    per-row colored-initial avatars with varied names, which is only
 *    achievable scoped to one project). `assignee` is still a proxy, not a
 *    confirmed per-action actor (no stories tool exists to say who actually
 *    clicked "complete" or edited a field) -- disclosed in the tile's
 *    footer. Pointing this at a different project means editing
 *    dataProvider.params.project_gid directly -- no per-installation
 *    config mechanism exists on this platform (checked CREATING_PLUGINS.md).
 *
 * Deliberately NOT done, even in the name of mockup fidelity: fabricating
 * "commented on", "moved ... Done", or "added N tasks to" text. Those need
 * a stories/events tool this gateway doesn't have -- inventing them would
 * misrepresent real task data as activity that didn't happen.
 *
 * Row 0 carries footer_label: "N recent items".
 * Each row has: id, title (`F. Lastname completed "X"` / `... updated "X"`,
 * or plain `Completed "X"` / `Updated "X"` if a task somehow has no
 * assignee), initials ('' if no assignee -- Avatar falls back to a neutral
 * "·" glyph), avatar_tone (chart-1..5, deterministic per person; 'muted' if
 * no assignee), activity_at (ISO timestamp used for sort + relative_time,
 * rendered BELOW the title as a Caption -- hand-rolled instead of
 * ActivityItem specifically so the timestamp sits on its own line rather
 * than ActivityItem's fixed right-hand column, which was getting clipped
 * off-screen on longer titles at this tile's width), url (task deep link,
 * '' if not derivable).
 *
 * `url` prefers the task's own `permalink_url` (a real API field, same as
 * `flatten_projects` trusts for projects); if list_tasks doesn't return it
 * for this task, falls back to the client-built legacy deep link
 * `https://app.asana.com/0/{project_gid}/{gid}` the same way
 * `flatten_milestones` does above -- NOT sandbox-confirmed by actually
 * clicking it, same caveat as that fallback.
 *
 * Args: { value: array } -- list_tasks' `data` array, called with
 * completed_since far enough in the past to include completed tasks too
 * (see asana-my-tasks' tabs redesign for the same technique).
 */
const flatten_recent_activity: ComputedFunction = (args) => {
  const raw = Array.isArray(args.value) ? (args.value as Record<string, unknown>[]) : [];
  if (raw.length === 0) return [];

  const rows = raw.map((task) => {
    const id = String(task.gid ?? task.id ?? '');
    const title = String(task.name ?? '');
    const isCompleted = Boolean(task.completed);
    const completedAt = task.completed_at ? String(task.completed_at) : null;
    const modifiedAt = task.modified_at ? String(task.modified_at) : null;
    const createdAt = task.created_at ? String(task.created_at) : null;

    const activityAt = (isCompleted && completedAt) ? completedAt : (modifiedAt ?? createdAt ?? '');

    const memberships = Array.isArray(task.memberships) ? (task.memberships as Record<string, unknown>[]) : [];
    const projects = Array.isArray(task.projects) ? (task.projects as Record<string, unknown>[]) : [];
    let projectGid = '';
    if (memberships.length > 0) {
      const proj = memberships[0].project as Record<string, unknown> | undefined;
      if (proj) projectGid = String(proj.gid ?? '');
    } else if (projects.length > 0) {
      projectGid = String((projects[0] as Record<string, unknown>).gid ?? '');
    }

    const permalinkUrl = task.permalink_url ? String(task.permalink_url) : '';
    const url = permalinkUrl || (id && projectGid ? `https://app.asana.com/0/${projectGid}/${id}` : '');

    const assignee = task.assignee as Record<string, unknown> | null | undefined;
    const rawAssigneeName = assignee?.name ? String(assignee.name) : '';
    const { displayName, initials } = formatPersonName(rawAssigneeName);

    const verb = isCompleted ? 'completed' : 'updated';
    const titleText = displayName ? `${displayName} ${verb} "${title}"` : `${verb[0].toUpperCase()}${verb.slice(1)} "${title}"`;

    // Deterministic per-person color, not a status tone (nothing here
    // represents state) -- per TILE-DISPLAY-STANDARDS.md §7's "Categorical
    // (multi-color, non-status) breakdowns" guidance, this is exactly the
    // chart-1..5 use case: coloring several arbitrary category labels (here,
    // people) distinctly, where no single accent or status tone fits any
    // one of them. Hashing the raw name (not initials) keeps two different
    // people who happen to share initials from also sharing a color.
    const CHART_TONES = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'] as const;
    let hash = 0;
    for (let i = 0; i < rawAssigneeName.length; i++) hash = (hash * 31 + rawAssigneeName.charCodeAt(i)) >>> 0;
    const avatarTone = rawAssigneeName ? CHART_TONES[hash % CHART_TONES.length] : 'muted';

    return {
      id,
      title: titleText,
      initials,
      avatar_tone: avatarTone,
      activity_at: activityAt,
      url,
      footer_label: '',
    };
  });

  rows.sort((a, b) => (Date.parse(b.activity_at) || 0) - (Date.parse(a.activity_at) || 0));

  const top = rows.slice(0, 20);
  const total = top.length;
  if (total > 0) top[0].footer_label = `${total} recent item${total === 1 ? '' : 's'}`;

  return top;
};

const elements: PluginElementsModule = {
  slug: 'asana',
  functions: {
    format_date,
    flatten_my_tasks,
    flatten_projects,
    flatten_project_progress,
    flatten_overdue_board,
    flatten_team_workload,
    flatten_my_tasks_board,
    flatten_milestones,
    flatten_recent_activity,
  },
};

export default elements;
