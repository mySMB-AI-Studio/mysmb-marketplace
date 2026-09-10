const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/**
 * Format an ISO date string to dd-Mmm-yy (e.g. "09-Sep-26").
 *
 * Args: { value: string }
 *
 * Spec example:
 *   { "$computed": "asana_format_date", "args": { "value": { "$item": "due_on" } } }
 */
const format_date = (args) => {
    const raw = args.value;
    if (!raw)
        return '';
    const ms = Date.parse(String(raw));
    if (Number.isNaN(ms))
        return '';
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
const flatten_my_tasks = (args) => {
    const raw = Array.isArray(args.value) ? args.value : [];
    if (raw.length === 0)
        return [];
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayMs = Date.parse(todayStr);
    let statDueToday = 0;
    let statOverdue = 0;
    const rows = raw.map((task) => {
        const id = String(task.gid ?? task.id ?? '');
        const title = String(task.name ?? '');
        const dueOn = task.due_on ? String(task.due_on) : null;
        const memberships = Array.isArray(task.memberships) ? task.memberships : [];
        const projects = Array.isArray(task.projects) ? task.projects : [];
        let projectLabel = '';
        if (memberships.length > 0) {
            const proj = memberships[0].project;
            if (proj)
                projectLabel = String(proj.name ?? '');
        }
        else if (projects.length > 0) {
            projectLabel = String(projects[0].name ?? '');
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
                }
                else if (dueOn === todayStr) {
                    dueLabel = 'Due Today';
                    dueTone = 'warning';
                    circleTone = 'warning';
                    statDueToday++;
                }
                else {
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
const flatten_projects = (args) => {
    const raw = Array.isArray(args.value) ? args.value : [];
    if (raw.length === 0)
        return [];
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
const flatten_project_progress = (args) => {
    const raw = Array.isArray(args.value) ? args.value : [];
    if (raw.length === 0)
        return [];
    const rows = raw.map((proj) => {
        const id = String(proj.gid ?? proj.id ?? '');
        const name = String(proj.name ?? '');
        const taskCounts = proj.task_counts;
        const total = taskCounts ? Number(taskCounts.num_tasks ?? 0) : 0;
        const completed = taskCounts ? Number(taskCounts.num_completed_tasks ?? 0) : 0;
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
        let tone = 'muted';
        let pctLabel = '—';
        if (total > 0) {
            pctLabel = `${pct}%`;
            if (pct < 40)
                tone = 'destructive';
            else if (pct < 70)
                tone = 'warning';
        }
        return {
            id,
            name,
            pct,
            pct_label: pctLabel,
            tone,
            footer_label: '',
        };
    });
    const total = raw.length;
    rows[0].footer_label = `${total} active project${total === 1 ? '' : 's'}`;
    return rows;
};
const elements = {
    slug: 'asana',
    functions: {
        format_date,
        flatten_my_tasks,
        flatten_projects,
        flatten_project_progress,
    },
};
export default elements;
