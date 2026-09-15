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
        let circleTone = 'muted';
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
                        circleTone = 'success';
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
const flatten_milestones = (args) => {
    const raw = Array.isArray(args.value) ? args.value : [];
    if (raw.length === 0)
        return [];
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
            }
            else {
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
const flatten_recent_activity = (args) => {
    const raw = Array.isArray(args.value) ? args.value : [];
    if (raw.length === 0)
        return [];
    const rows = raw.map((task) => {
        const id = String(task.gid ?? task.id ?? '');
        const title = String(task.name ?? '');
        const isCompleted = Boolean(task.completed);
        const completedAt = task.completed_at ? String(task.completed_at) : null;
        const modifiedAt = task.modified_at ? String(task.modified_at) : null;
        const createdAt = task.created_at ? String(task.created_at) : null;
        const activityAt = (isCompleted && completedAt) ? completedAt : (modifiedAt ?? createdAt ?? '');
        const memberships = Array.isArray(task.memberships) ? task.memberships : [];
        const projects = Array.isArray(task.projects) ? task.projects : [];
        let projectGid = '';
        if (memberships.length > 0) {
            const proj = memberships[0].project;
            if (proj)
                projectGid = String(proj.gid ?? '');
        }
        else if (projects.length > 0) {
            projectGid = String(projects[0].gid ?? '');
        }
        const permalinkUrl = task.permalink_url ? String(task.permalink_url) : '';
        const url = permalinkUrl || (id && projectGid ? `https://app.asana.com/0/${projectGid}/${id}` : '');
        const assignee = task.assignee;
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
        const CHART_TONES = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'];
        let hash = 0;
        for (let i = 0; i < rawAssigneeName.length; i++)
            hash = (hash * 31 + rawAssigneeName.charCodeAt(i)) >>> 0;
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
    if (total > 0)
        top[0].footer_label = `${total} recent item${total === 1 ? '' : 's'}`;
    return top;
};
const elements = {
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
