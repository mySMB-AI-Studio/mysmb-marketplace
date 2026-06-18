# Oracle NetSuite

Connect Oracle NetSuite ERP to myHub via the myHub-hosted TBA (Token-Based Authentication) MCP gateway. Covers accounts, contacts, customers, transactions, SuiteQL querying, and pre-built dashboard analytics for finance teams.

## Tools & resources

### Records
- List and get accounts, contacts, customers, and transactions
- Create and update customer records
- Run arbitrary SuiteQL queries (`netsuite_suiteql`)

### Dashboard analytics
- **Revenue summary** — current and prior calendar month revenue with month-over-month change
- **AR aging** — outstanding invoice balances bucketed by days overdue (0–30, 31–60, 61–90, 90+)
- **Open sales orders** — pending approval, pending fulfillment, and partially fulfilled orders
- **Cash position** — total cash balance across all active bank accounts
- **Top customers** — top N customers by invoiced revenue over a configurable rolling window

## Widgets

- **Revenue at a Glance** — KPI tiles and sparkline for current vs. prior month revenue
- **AR Aging** — overdue invoice buckets as a bar chart with key totals
- **Open Sales Orders** — live table of open orders with status badges
- **Cash Position** — total cash balance broken down by bank account
- **Top Customers** — bar chart of top 5 customers by revenue

## Authentication

NetSuite uses Token-Based Authentication (OAuth 1.0a / HMAC-SHA256). You need a TBA integration record and a token pair in your NetSuite account. All five credentials are required.

### Required role permissions

The NetSuite role assigned to the access token **must** have all of the following permissions enabled. Missing any one of them causes a silent `INVALID_LOGIN_ATTEMPT` 401 — the most common setup failure.

| Permission | Where to enable |
|---|---|
| **REST Web Services** | Setup → Users/Roles → Manage Roles → [role] → Permissions → Setup |
| **Log in using Access Tokens** | Setup → Users/Roles → Manage Roles → [role] → Permissions → Setup |
| **Access Token Management** | Setup → Users/Roles → Manage Roles → [role] → Permissions → Setup |
| **User Access Tokens** | Setup → Users/Roles → Manage Roles → [role] → Permissions → Setup |
| **Allow JS/HTML Uploads** | Setup → Users/Roles → Manage Roles → [role] → Permissions → Setup |

> **Tip:** "REST Web Services" is the most commonly missed permission. If credentials look correct but every request returns `INVALID_LOGIN_ATTEMPT`, check this one first.

## Configuration

| Variable | Required | Description |
|---|---|---|
| `NETSUITE_ACCOUNT_ID` | ✅ | Your NetSuite account ID (e.g. `1234567` or `1234567_SB1` for sandbox). Found under **Setup → Company → Company Information**. |
| `NETSUITE_CONSUMER_KEY` | ✅ | Consumer key from your TBA integration record (**Setup → Integration → Manage Integrations**). |
| `NETSUITE_CONSUMER_SECRET` | ✅ | Consumer secret from the same integration record. |
| `NETSUITE_TOKEN_ID` | ✅ | Token ID from the access token you generated for your user (**Setup → Users/Roles → Access Tokens**). |
| `NETSUITE_TOKEN_SECRET` | ✅ | Token secret from the same access token. |

## See also
- [NetSuite TBA setup guide](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4247337262.html)
- [SuiteQL reference](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_156257770590.html)
