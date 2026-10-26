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
/**
 * Deputy has no payroll/payslip data at all (confirmed against every tool
 * this integration exposes) -- there's nothing to reconcile HOURS against
 * the way the Xero Payroll AU tiles do. What Deputy DOES track per
 * timesheet is whether it's been approved (`TimeApproved`) and whether
 * it's actually been exported toward payroll (`Exported`, null until it
 * has). This flattens list_timesheets into one row per employee over the
 * fetched window, counting how many of their timesheets are missing each
 * step, so "needs approval" and "approved but never exported" surface as
 * two distinct, real problems rather than being conflated or guessed at.
 *
 * Args: { timesheets: array }
 * Returns: array of { id, name, totalHours, timesheetCount,
 *   notApprovedCount, notExportedCount, label, tone }
 *
 * Spec example:
 *   {
 *     "$computed": "deputy_timesheet_check_rows",
 *     "args": { "timesheets": { "$state": "/deputy-token/list_timesheets" } }
 *   }
 */
const timesheet_check_rows = (args) => {
    const timesheets = Array.isArray(args.timesheets) ? args.timesheets : [];
    const byEmployee = new Map();
    for (const sheet of timesheets) {
        const employeeId = sheet.Employee;
        if (employeeId == null)
            continue;
        const name = sheet._DPMetaData?.EmployeeInfo?.DisplayName ?? `Employee #${employeeId}`;
        const entry = byEmployee.get(employeeId) ?? { name, totalHours: 0, timesheetCount: 0, notApprovedCount: 0, notExportedCount: 0 };
        entry.totalHours += Number(sheet.TotalTime ?? 0);
        entry.timesheetCount += 1;
        if (sheet.TimeApproved !== true)
            entry.notApprovedCount += 1;
        else if (!sheet.Exported)
            entry.notExportedCount += 1; // only a distinct problem once it's actually approved
        byEmployee.set(employeeId, entry);
    }
    const rows = Array.from(byEmployee.entries()).map(([employeeId, e]) => {
        const issues = [];
        if (e.notApprovedCount > 0)
            issues.push(`${e.notApprovedCount} not approved`);
        if (e.notExportedCount > 0)
            issues.push(`${e.notExportedCount} not exported`);
        return {
            id: String(employeeId),
            name: e.name,
            totalHours: Math.round(e.totalHours * 100) / 100,
            timesheetCount: e.timesheetCount,
            notApprovedCount: e.notApprovedCount,
            notExportedCount: e.notExportedCount,
            label: issues.length ? issues.join(' · ') : 'All approved & exported',
            tone: e.notApprovedCount > 0 ? 'destructive' : e.notExportedCount > 0 ? 'warning' : 'success',
        };
    });
    // Issues first, then clean rows -- same "problems surface first"
    // convention as the Xero payroll tiles.
    const rank = (r) => (r.notApprovedCount > 0 ? 0 : r.notExportedCount > 0 ? 1 : 2);
    rows.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
    return rows;
};
const elements = {
    slug: 'deputy',
    functions: {
        department_rows,
        timesheet_rows,
        my_task_rows,
        timesheet_check_rows,
    },
};
export default elements;
