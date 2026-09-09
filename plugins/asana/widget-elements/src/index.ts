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

  const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const todayMs = Date.parse(todayStr);

  let statOverdue = 0;
  let statDueToday = 0;

  const rows = raw.map((task) => {
    const id = String(task.gid ?? task.id ?? '');
    const title = String(task.name ?? '');
    const dueOn = task.due_on ? String(task.due_on) : null;

    // Project label from memberships or projects array
    const memberships = Array.isArray(task.memberships) ? (task.memberships as Record<string, unknown>[]) : [];
    const projects = Array.isArray(task.projects) ? (task.projects as Record<string, unknown>[]) : [];
    let projectLabel = '';
    if (memberships.length > 0) {
      const proj = memberships[0].project as Record<string, unknown> | undefined;
      if (proj) projectLabel = String(proj.name ?? '');
    } else if (projects.length > 0) {
      projectLabel = String((projects[0] as Record<string, unknown>).name ?? '');
    }

    let dueLabel = 'No due date';
    let isOverdue = false;
    let dueTone = 'muted';

    if (dueOn) {
      const dueMs = Date.parse(dueOn);
      if (!Number.isNaN(dueMs)) {
        const d = new Date(dueMs);
        const day = String(d.getDate()).padStart(2, '0');
        const month = MONTH_ABBR[d.getMonth()];
        const year = String(d.getFullYear()).slice(-2);
        dueLabel = `${day}-${month}-${year}`;

        if (dueMs < todayMs) {
          isOverdue = true;
          dueTone = 'danger';
          statOverdue++;
        } else if (dueOn === todayStr) {
          dueTone = 'warning';
          statDueToday++;
        }
      }
    }

    return {
      id,
      title,
      due_label: dueLabel,
      project_label: projectLabel,
      is_overdue: isOverdue,
      due_tone: dueTone,
      stat_total: '',
      stat_overdue: '',
      stat_due_today: '',
    };
  });

  rows[0].stat_total = String(raw.length);
  rows[0].stat_overdue = String(statOverdue);
  rows[0].stat_due_today = String(statDueToday);

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

const elements: PluginElementsModule = {
  slug: 'asana',
  functions: {
    format_date,
    flatten_my_tasks,
    flatten_projects,
  },
};

export default elements;
