# Deputy

Manage your **Deputy** workforce scheduling via the myHub-hosted Deputy MCP gateway — a self-hosted connector (`myhub-mcp-servers/src/integrations/deputy`) that talks to Deputy's own REST API on your behalf. Covers companies, departments, teams, employees, timesheets, shifts (roster), and leave requests, all through a single OAuth-authenticated endpoint.

Browser OAuth through myHub — no API keys, no env vars. Click Connect, sign in to your Deputy account, authorize access, and you're done.

## Configuration

No configuration variables are required.

## Tools & resources

This connector exposes the following MCP tools, backed directly by Deputy's REST API (v1, plus the v2 schedule endpoint for shifts).

### Companies

| Tool | Description |
|------|-------------|
| `list_companies` | List companies/business entities. Returns Id, CompanyName, TradingName, ABN and other company details. |

### Departments

| Tool | Description |
|------|-------------|
| `list_departments` | List departments (OperationalUnits). Returns OperationalUnitName, CompanyId, ParentOperationalUnitId, Active. |
| `create_department` | Create a new department. Requires a name and a CompanyId; optionally assign a parent department. |

### Teams

| Tool | Description |
|------|-------------|
| `list_teams` | List teams. Returns TeamName, Active, and related fields. |

### Employees

| Tool | Description |
|------|-------------|
| `list_employees` | List employees. Returns FirstName, LastName, Email, Active, CompanyId, StartDate, TerminationDate. |

### Timesheets

| Tool | Description |
|------|-------------|
| `list_timesheets` | List timesheets. Returns EmployeeId, Date, StartTime, EndTime, TotalTime, PayPeriodId. Optionally filter by date range. |

### Shifts (Roster)

| Tool | Description |
|------|-------------|
| `list_shifts` | List scheduled shifts (Roster entries). Returns Employee, StartTime, EndTime, OperationalUnit, and related fields. Optionally filter by date range. |

### Leave

| Tool | Description |
|------|-------------|
| `list_leave` | List leave requests. Returns Employee, DateStart, DateEnd, Comment, Status, and related fields. Optionally filter by date range. |
