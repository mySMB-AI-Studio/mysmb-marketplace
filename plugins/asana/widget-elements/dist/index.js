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
    let atRisk = 0;
    let behind = 0;
    const rows = raw.map((proj) => {
        const id = String(proj.gid ?? proj.id ?? '');
        const name = String(proj.name ?? '');
        const taskCounts = proj.task_counts;
        const numTasks = taskCounts ? Number(taskCounts.num_tasks ?? 0) : 0;
        const numCompleted = taskCounts ? Number(taskCounts.num_completed_tasks ?? 0) : 0;
        const pct = numTasks > 0 ? Math.round((numCompleted / numTasks) * 100) : 0;
        let tone = 'muted';
        let pctLabel = '—';
        if (numTasks > 0) {
            pctLabel = `${pct}%`;
            if (pct < 40) {
                tone = 'destructive';
                behind++;
            }
            else if (pct < 70) {
                tone = 'warning';
                atRisk++;
            }
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
const flatten_team_workload = (args) => {
    const raw = Array.isArray(args.value) ? args.value : [];
    if (raw.length === 0)
        return [];
    // already sorted desc by task_count from the MCP tool
    const maxCount = Number(raw[0].task_count ?? 0);
    const rows = raw.map((member) => {
        const m = member;
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
    const totalTasks = raw.reduce((sum, m) => sum + Number(m.task_count ?? 0), 0);
    rows[0].footer_label = `${totalTasks} active task${totalTasks === 1 ? '' : 's'} across team`;
    return rows;
};
const flatten_overdue_tasks = (args) => {
    const raw = Array.isArray(args.value) ? args.value : [];
    if (raw.length === 0)
        return [];
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayMs = Date.parse(todayStr);
    const overdueItems = [];
    for (const task of raw) {
        const dueOn = task.due_on ? String(task.due_on) : null;
        if (!dueOn)
            continue;
        const dueMs = Date.parse(dueOn);
        if (Number.isNaN(dueMs) || dueMs >= todayMs)
            continue;
        const daysOverdue = Math.round((todayMs - dueMs) / 86400000);
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
        overdueItems.push({ task, daysOverdue, projectLabel });
    }
    if (overdueItems.length === 0)
        return [];
    overdueItems.sort((a, b) => b.daysOverdue - a.daysOverdue);
    const uniqueProjects = new Set(overdueItems.map(i => i.projectLabel).filter(Boolean));
    const longestDays = overdueItems[0].daysOverdue;
    const rows = overdueItems.map((item) => ({
        id: String(item.task.gid ?? item.task.id ?? ''),
        title: String(item.task.name ?? ''),
        project_label: item.projectLabel,
        overdue_label: `${item.daysOverdue}d overdue`,
        days_overdue: item.daysOverdue,
        stat_overdue: '',
        stat_projects: '',
        stat_longest: '',
    }));
    rows[0].stat_overdue = String(overdueItems.length);
    rows[0].stat_projects = String(uniqueProjects.size);
    rows[0].stat_longest = `${longestDays}d`;
    return rows;
};
const flatten_my_tasks_tabs = (args) => {
    const raw = Array.isArray(args.value) ? args.value : [];
    if (raw.length === 0)
        return { upcoming: [], overdue: [], completed: [] };
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayMs = Date.parse(todayStr);
    const upcoming = [];
    const overdue = [];
    const completed = [];
    for (const task of raw) {
        const id = String(task.gid ?? task.id ?? '');
        const title = String(task.name ?? '');
        const dueOn = task.due_on ? String(task.due_on) : null;
        const isCompleted = Boolean(task.completed);
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
        let circleTone = isCompleted ? 'success' : 'info';
        let sortMs = isCompleted ? -1 : Infinity;
        if (dueOn) {
            const dueMs = Date.parse(dueOn);
            if (!Number.isNaN(dueMs)) {
                sortMs = dueMs;
                const d = new Date(dueMs);
                const formatted = `${String(d.getDate()).padStart(2, '0')}-${MONTH_ABBR[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
                if (!isCompleted) {
                    if (dueMs < todayMs) {
                        dueLabel = formatted;
                        dueTone = 'destructive';
                        circleTone = 'destructive';
                    }
                    else if (dueOn === todayStr) {
                        dueLabel = 'Due Today';
                        dueTone = 'warning';
                        circleTone = 'warning';
                    }
                    else {
                        dueLabel = formatted;
                        dueTone = 'muted';
                        circleTone = 'info';
                    }
                }
                else {
                    dueLabel = formatted;
                }
            }
        }
        const row = { id, title, due_label: dueLabel, project_label: projectLabel, due_tone: dueTone, circle_tone: circleTone, _sort: sortMs };
        if (isCompleted) {
            completed.push(row);
        }
        else if (dueOn && !Number.isNaN(Date.parse(dueOn)) && Date.parse(dueOn) < todayMs) {
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
const elements = {
    slug: 'asana',
    functions: {
        format_date,
        flatten_my_tasks,
        flatten_projects,
        flatten_project_progress,
        flatten_overdue_tasks,
        flatten_team_workload,
        flatten_my_tasks_tabs,
    },
};
export default elements;
