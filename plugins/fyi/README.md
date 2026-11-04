# FYI

Read-only dashboard tiles for [FYI](https://fyi.app) (FYI Docs), the practice-management and document-management
platform for accounting and professional-services firms. Backed by the myHub-hosted `fyi` MCP server
(`myhub-mcp-servers/src/integrations/fyi`), which talks to FYI's External API.

## Configuration

| Variable | Required | Description |
|---|---|---|
| `FYI_ACCESS_ID` | Yes | The practice's FYI **Access Key ID** (FYI → Automation → Apps → Create new secret). |
| `FYI_ACCESS_SECRET` | Yes | The matching **Access Key Secret**, shown once when the key is created. |
| `FYI_REGION` | No | `au` (default; Australia and New Zealand) or `uk`. Keys only work in their own region. |
| `FYI_APPLICATION_ID` | No | Only for keys issued under an FYI App Partner application. Leave blank for practice-generated keys. |

FYI plan requirements: API keys need FYI **Pro or Elite**; time data needs Pro or Elite; invoices need **Elite**. A tile
whose data the plan doesn't include shows a "Couldn't load FYI data" message rather than a false zero.

## Tools

Overview tools (counting and sorting are done server-side, because FYI's API has no sort or job-state filter):

- `get_jobs_overview` — open/overdue/due-soon counts, open jobs by state, workload per manager, most overdue and most recently updated jobs
- `get_tasks_overview` — open tasks by due bucket, per assignee, and the overdue + upcoming list
- `get_recent_documents` — documents filed in the last N days, per day, by type and by customer
- `get_invoices_overview` — outstanding total, aging buckets and the most overdue invoices (Elite)
- `get_time_summary` — chargeable vs total hours and billable amount for a date range, per staff member (Pro or Elite)
- `get_client_snapshot` — one customer's details, open jobs, tasks, recent documents and outstanding invoices

Record tools: `list_clients`, `get_client`, `list_client_groups`, `list_jobs`, `get_job`, `list_job_states`,
`list_tasks`, `list_task_statuses`, `list_documents`, `get_document`, `list_time_entries`, `list_invoices`,
`list_users`, `list_cabinets`, `list_custom_fields`.

No create, update, upload or download tools are exposed — this connector is read-only by design.

## Widgets

- **Open jobs by state** (`fyi-open-jobs-by-state`) — open jobs per job state (donut) and the most overdue jobs
- **Recent jobs** (`fyi-recent-jobs`) — most recently updated jobs with customer, manager, state and due date
- **Open tasks due soon** (`fyi-open-tasks-due-soon`) — overdue / due today / next 7 days, with the task list
- **Recently filed documents** (`fyi-recently-filed-documents`) — documents filed per day over the last 7 days, and the latest ones
- **Outstanding invoices** (`fyi-outstanding-invoices`) — outstanding total, aging bar and the most overdue invoices (Elite)
- **Chargeable time this month** (`fyi-chargeable-time-this-month`) — chargeable hours and rate, per staff member (Pro or Elite)
- **Workload by manager** (`fyi-workload-by-manager`) — open jobs per manager split into overdue, due this week and other

Tile notes: FYI's job states are defined by each practice, so they render as plain text rather than status badges.
Money uses the practice's region currency (AUD for au, GBP for uk). The decorative accent is the platform default mint.
