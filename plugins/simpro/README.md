# SimPro

Connect SimPro job management software to myHub. SimPro is the leading field-service platform used by Australian trade contractors — electricians, plumbers, HVAC, and construction businesses — to manage quotes, jobs, customers, and invoices end-to-end.

Quotes in SimPro represent the estimation pipeline. For electrical contractors using **Ground Plan** estimating software, Ground Plan pushes completed estimates directly into SimPro as quotes, making SimPro the single source of truth for the entire estimation-to-completion lifecycle.

## Authentication

SimPro uses API key authentication. Keys are created by a SimPro administrator and scoped to a company.

**Step 1 — Create an API key**

In SimPro: **Administration** > **API Keys** > **Add API Key**. Give the key a descriptive name (e.g. "myHub Integration"), set an expiry if required by your security policy, and click Save. Copy the key — it will not be shown again.

**Step 2 — Find your Company ID**

In SimPro: **Administration** > **Company** > note the numeric Company ID shown in the URL or on the company details page (e.g. `0` for the default company).

**Step 3 — Find your Base URL**

Your SimPro base URL is the root of your SimPro instance, e.g. `https://api.simprosuite.com` or a region-specific URL provided by SimPro support.

**Step 4 — Enter credentials in the Connect modal**

Enter your Base URL, Company ID, and API Key when prompted by the myHub Connect modal.

## Configuration

| Variable | Description |
|---|---|
| `SIMPRO_BASE_URL` | The root URL of your SimPro instance, e.g. `https://api.simprosuite.com`. No trailing slash. |
| `SIMPRO_COMPANY_ID` | The numeric SimPro company ID. Usually `0` for the default company. |
| `SIMPRO_API_KEY` | API key created under Administration > API Keys. Stored encrypted per user. |

## Tools

| Tool | Description |
|---|---|
| `list_quotes` | List quotes (estimates from Ground Plan and manual entries). Returns `{ items, totalCount }`. |
| `get_quote` | Get full detail for a single quote by ID. |
| `list_jobs` | List jobs (active, completed, and pending). Returns `{ items, totalCount }`. |
| `get_job` | Get full detail for a single job by ID. |
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
