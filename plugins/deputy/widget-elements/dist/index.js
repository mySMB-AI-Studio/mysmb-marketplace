// Department is a portal-defined, open-ended label with no inherent
// good/bad meaning — a categorical (non-status) case per
// TILE-DISPLAY-STANDARDS.md §7, which calls for the `chart-1`..`chart-5`
// palette rather than a status tone. Deputy's own OperationalUnit record
// carries a `Colour` hex field, but the platform's tone system doesn't
// accept raw hex (§7's "Decorative color" section forbids it explicitly,
// to keep color decisions funneled through the shared token table) — so
// departments are assigned the standard categorical palette instead,
// ranked by Deputy's own `RosterSortOrder` (its own display order) rather
// than re-deriving an order with no real meaning here.
const CHART_TONES = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'];
/**
 * Flattens a `list_departments` response into rows for the Departments
 * tile, ordered by Deputy's own `RosterSortOrder` and assigned a
 * `chart-1..5` tone in that order (cycling past 5 departments rather than
 * crashing or falling back to a status tone).
 *
 * Args: { departments: array }
 * Returns: array of { id, name, company, tone, active }
 *
 * Spec example:
 *   {
 *     "$computed": "deputy_department_rows",
 *     "args": { "departments": { "$state": "/deputy-token/list_departments" } }
 *   }
 */
const department_rows = (args) => {
    const departments = Array.isArray(args.departments) ? args.departments : [];
    return [...departments]
        .sort((a, b) => (Number(a.RosterSortOrder) || 0) - (Number(b.RosterSortOrder) || 0))
        .map((dept, i) => ({
        id: dept.Id,
        name: dept.OperationalUnitName ?? 'Unnamed department',
        company: dept.CompanyName ?? '—',
        tone: CHART_TONES[i % CHART_TONES.length],
        active: dept.Active !== false,
    }));
};
/**
 * Flattens a `list_timesheets` response into rows for the Timesheets tile.
 * Deputy nests the employee name and department name under `_DPMetaData`
 * (`EmployeeInfo.DisplayName`, `OperationalUnitInfo.OperationalUnitName`)
 * rather than as flat fields, and the Table component only reads a single
 * flat field per cell — so this flattens both up front, falling back to an
 * honest placeholder rather than a blank cell if either is missing on a
 * given record.
 *
 * Args: { timesheets: array }
 * Returns: array of { id, employee, department, date, hours, comment }
 *
 * Spec example:
 *   {
 *     "$computed": "deputy_timesheet_rows",
 *     "args": { "timesheets": { "$state": "/deputy-token/list_timesheets" } }
 *   }
 */
const timesheet_rows = (args) => {
    const timesheets = Array.isArray(args.timesheets) ? args.timesheets : [];
    return timesheets.map((sheet) => {
        const meta = sheet._DPMetaData;
        const employeeInfo = meta?.EmployeeInfo;
        const opUnitInfo = meta?.OperationalUnitInfo;
        const totalTime = sheet.TotalTime;
        return {
            id: sheet.Id,
            employee: employeeInfo?.DisplayName ?? '—',
            department: opUnitInfo?.OperationalUnitName ?? '—',
            date: sheet.Date ?? null,
            hours: typeof totalTime === 'number' ? `${totalTime.toFixed(1)} hrs` : '—',
            comment: sheet.EmployeeComment || '—',
        };
    });
};
/**
 * Flattens a `get_my_tasks` response into rows for the My Tasks tile.
 * Deputy nests the assignee's name under `_DPMetaData.UserResponsibleInfo.
 * DisplayName` rather than as a flat field — flattened here for the same
 * reason as `deputy_timesheet_rows`. `dueDate` and `completed` are kept
 * as their own fields (raw ISO date, plain boolean) rather than
 * pre-formatted, since the widget spec drives the due-date label/tone
 * per row via the system's own `due_date_au`/`is_overdue` — connector-
 * agnostic date logic that belongs in the system, not duplicated here.
 *
 * Args: { tasks: array }
 * Returns: array of { id, title, comment, assignee, dueDate, completed }
 *
 * Spec example:
 *   {
 *     "$computed": "deputy_my_task_rows",
 *     "args": { "tasks": { "$state": "/deputy-token/get_my_tasks" } }
 *   }
 */
const my_task_rows = (args) => {
    const tasks = Array.isArray(args.tasks) ? args.tasks : [];
    return tasks.map((task) => {
        const meta = task._DPMetaData;
        const responsibleInfo = meta?.UserResponsibleInfo;
        return {
            id: task.Id,
            title: task.Question || 'Untitled task',
            comment: task.Comment || '—',
            assignee: responsibleInfo?.DisplayName ?? '—',
            dueDate: task.DueDate ?? null,
            completed: task.TsCompleted != null,
        };
    });
};
const elements = {
    slug: 'deputy',
    functions: {
        department_rows,
        timesheet_rows,
        my_task_rows,
    },
};
export default elements;
