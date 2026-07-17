# Simpro

Connect Simpro job management software to myHub. Simpro is the leading field-service platform used by Australian trade contractors — electricians, plumbers, HVAC, and construction businesses — to manage quotes, jobs, customers, and invoices end-to-end.

Quotes in Simpro represent the estimation pipeline. For electrical contractors using **Ground Plan** estimating software, Ground Plan pushes completed estimates directly into Simpro as quotes, making Simpro the single source of truth for the entire estimation-to-completion lifecycle.

## Authentication

Simpro uses browser OAuth 2.0 via the Simpro Partner Program — no API keys.

Click **Connect** in myHub, enter your Simpro **Build domain** (e.g. `yourcompany.simprosuite.com`) when prompted, sign in to Simpro in the popup, and pick the company to connect. Tokens are stored and refreshed by the myHub-hosted MCP gateway.

## Configuration

No `${VAR}` placeholders — the connection is browser OAuth (no user-supplied credentials). The MCP gateway itself must be deployed with `SIMPRO_CLIENT_ID` / `SIMPRO_CLIENT_SECRET` (Simpro Partner Program app credentials) on the Container App; see `myhub-mcp-servers`.

## Tools

| Tool | Description |
|---|---|
| `list_companies` | List the companies visible to the connected user. |
| `list_quotes` | List quotes (estimates from Ground Plan and manual entries). Returns `{ items, totalCount }`. |
| `get_quote` | Get full detail for a single quote by ID. |
| `get_quote_sections` | Get the sections/cost-centre breakdown for a quote. |
| `list_jobs` | List jobs (active, completed, and pending). Returns `{ items, totalCount }`. |
| `list_todays_jobs` | List jobs scheduled for today with real schedule times. |
| `get_job` | Get full detail for a single job by ID. |
| `list_cost_center_items` | List cost-centre line items. |
| `list_customers` | List customers. Returns `{ items, totalCount }`. |
| `list_invoices` | List invoices. Returns `{ items, totalCount }`. |

## Widgets

### Live (requires connector)

- **Quote Pipeline** — scrollable list of quotes from SimPro (including Ground Plan estimates), showing quote name, customer, total, and status
- **Active Jobs** — scrollable list of current jobs with customer, total, and status
- **Invoice Summary** — scrollable list of invoices with amount and colour-coded status badge (Paid, Sent, Pending, Overdue, Void)

### Demo (static, no connector required)

- **Quote Pipeline (Demo)** — 8 hardcoded electrical contractor quotes typical for a business like Level Electrical
- **Active Jobs (Demo)** — 7 hardcoded jobs across typical trade stages (In Progress, Pending Inspection, Completed)
- **Invoice Summary (Demo)** — 8 hardcoded invoices spanning all status types with appropriate badge colours

## See also

- [SimPro API reference](https://developer.simpro.co/reference)
- [SimPro API authentication](https://developer.simpro.co/reference/authentication)
- [Ground Plan estimating software](https://www.groundplan.com.au)
