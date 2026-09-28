# Deputy

Manage your **Deputy** workforce scheduling via the myHub-hosted Deputy MCP gateway — a self-hosted connector (`myhub-mcp-servers/src/integrations/deputy`) that talks to Deputy's own REST API on your behalf. Covers companies, departments, teams, employees, timesheets, shifts (roster), and leave requests.

Two ways to connect, matching Deputy's own two supported auth modes:

- **`deputy` (OAuth, recommended)** — Browser OAuth through myHub, no API keys, no env vars. Click Connect, sign in to your Deputy account, authorize access, and you're done. Tokens auto-refresh.
- **`deputy-token` (permanent access token)** — for a long-lived token that doesn't need re-authorising, generated directly from Deputy's own developer portal. Requires two values (below). This is also Deputy's own recommended path for first-time development/testing — see [Deputy's "Hello World" guide](https://developer.deputy.com/docs/the-hello-world-of-deputy).

## Configuration

Only needed if you're using the `deputy-token` server — `deputy` (OAuth) needs no configuration.

| Variable | Required for | Description |
|---|---|---|
| `DEPUTY_TOKEN` | `deputy-token` | A permanent access token from Deputy's own OAuth clients admin page (`https://{installname}.{geo}.deputy.com/exec/devapp/oauth_clients` — create a client, then generate a permanent token from it). Deputy quotes these as lasting ~10 years. |
| `DEPUTY_INSTALL_URL` | `deputy-token` | Your Deputy business's own install URL, e.g. `https://simonssambos.au.deputy.com` — the `{geo}` segment (`au`, `uk`, `na`, …) is part of the real domain, not optional. This is the same URL shown in your browser's address bar once logged into Deputy. |

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
