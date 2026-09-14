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

const flatten_my_tasks_tabs: ComputedFunction = (args) => {
  const raw = Array.isArray(args.value) ? (args.value as Record<string, unknown>[]) : [];
  if (raw.length === 0) return { upcoming: [], overdue: [], completed: [] };

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayMs = Date.parse(todayStr);

  const upcoming: Record<string, unknown>[] = [];
  const overdue:  Record<string, unknown>[] = [];
  const completed: Record<string, unknown>[] = [];

  for (const task of raw) {
    const id    = String(task.gid ?? task.id ?? '');
    const title = String(task.name ?? '');
    const dueOn = task.due_on ? String(task.due_on) : null;
    const isCompleted = Boolean(task.completed);

    const memberships = Array.isArray(task.memberships) ? (task.memberships as Record<string, unknown>[]) : [];
    const projects    = Array.isArray(task.projects)    ? (task.projects    as Record<string, unknown>[]) : [];
    let projectLabel = '';
    if (memberships.length > 0) {
      const proj = memberships[0].project as Record<string, unknown> | undefined;
      if (proj) projectLabel = String(proj.name ?? '');
    } else if (projects.length > 0) {
      projectLabel = String((projects[0] as Record<string, unknown>).name ?? '');
    }

    let dueLabel   = '';
    let dueTone    = 'muted';
    let circleTone = 'muted';
    let sortMs: number = isCompleted ? -1 : Infinity;

    if (dueOn) {
      const dueMs = Date.parse(dueOn);
      if (!Number.isNaN(dueMs)) {
        sortMs = dueMs;
        const d = new Date(dueMs);
        const formatted = `${String(d.getDate()).padStart(2, '0')}-${MONTH_ABBR[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
        if (!isCompleted) {
          if (dueMs < todayMs) {
            dueLabel   = formatted;
            dueTone    = 'destructive';
            circleTone = 'destructive';
          } else if (dueOn === todayStr) {
            dueLabel   = 'Due Today';
            dueTone    = 'warning';
            circleTone = 'warning';
          } else {
            dueLabel   = formatted;
            dueTone    = 'muted';
            circleTone = 'success';
          }
        } else {
          dueLabel = formatted;
        }
      }
    }

    const row: Record<string, unknown> = { id, title, due_label: dueLabel, project_label: projectLabel, due_tone: dueTone, circle_tone: circleTone, _sort: sortMs };

    if (isCompleted) {
      completed.push(row);
    } else if (dueOn && !Number.isNaN(Date.parse(dueOn)) && Date.parse(dueOn) < todayMs) {
      overdue.push(row);
    } else {
      upcoming.push(row);
    }
  }

  upcoming.sort((a, b) => (a._sort as number) - (b._sort as number));
  overdue.sort((a, b)  => (a._sort as number) - (b._sort as number));

  const clean = (rows: Record<string, unknown>[]) => rows.map(({ _sort: _s, ...r }) => r);
  return { upcoming: clean(upcoming), overdue: clean(overdue), completed: clean(completed) };
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
 * Flattens a list_tasks response (assignee=me) into rows for the Recent
 * Activity tile.
 *
 * Approximation, not a true activity feed: the Asana MCP gateway has no
 * stories/events tool (no per-task comments, status-column moves, or
 * "added N tasks" grouping) as of 2026-09-14 -- only list_tasks, get_task,
 * list_projects, get_project, list_sections, list_users, get_team_workload,
 * list_milestones, plus the write tools. This derives "activity" purely from
 * two task fields that ARE real: `completed`/`completed_at` (a genuine event)
 * and `modified_at` (a genuine but vaguer "something changed" signal -- it
 * can't distinguish a comment from a title edit from a due-date change).
 * Every row is implicitly the current user's own task (assignee=me), so
 * there's no cross-teammate attribution to show -- the leading icon encodes
 * the action type (completed vs. updated) instead of a per-person avatar.
 * The tile's footer discloses this scope/limitation per TILE-DISPLAY-
 * STANDARDS.md §13 rather than presenting it as a full team activity feed.
 *
 * Row 0 carries footer_label: "N recent items".
 * Each row has: id, title (`Completed "X"` / `Updated "X"`), subtitle
 * (project label or ''), activity_at (ISO timestamp used for sort +
 * relative_time), icon_name, tone, url (task deep link, '' if not
 * derivable).
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
    let projectLabel = '';
    let projectGid = '';
    if (memberships.length > 0) {
      const proj = memberships[0].project as Record<string, unknown> | undefined;
      if (proj) {
        projectLabel = String(proj.name ?? '');
        projectGid = String(proj.gid ?? '');
      }
    } else if (projects.length > 0) {
      const proj = projects[0] as Record<string, unknown>;
      projectLabel = String(proj.name ?? '');
      projectGid = String(proj.gid ?? '');
    }

    const permalinkUrl = task.permalink_url ? String(task.permalink_url) : '';
    const url = permalinkUrl || (id && projectGid ? `https://app.asana.com/0/${projectGid}/${id}` : '');

    return {
      id,
      title: isCompleted ? `Completed "${title}"` : `Updated "${title}"`,
      subtitle: projectLabel,
      activity_at: activityAt,
      icon_name: isCompleted ? 'CheckCircle2' : 'Pencil',
      tone: isCompleted ? 'success' : 'muted',
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
    flatten_team_workload,
    flatten_my_tasks_tabs,
    flatten_milestones,
    flatten_recent_activity,
  },
};

export default elements;
