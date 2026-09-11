# Dext

Connect Dext Precision to MyHub via the myHub-hosted Dext MCP gateway. Access client health scores, alert levels, and practice-wide activity statistics — all secured with a static API token.

## Authentication

This plugin uses a static bearer token. To connect:

1. Log in to Dext Precision.
2. Go to **Practice Settings** → **Data Health** → **API Tokens**.
3. Click **Create token** and copy the value shown (it is only displayed once).
4. Click **Connect** in the MyHub workspace and paste the token into the **Dext API Token** field.

## Configuration

| Variable | Description |
|---|---|
| `DEXT_API_TOKEN` | Personal API token generated in Dext Precision under Practice Settings → Data Health → API Tokens. Sent as `Authorization: Bearer <token>` on every request. |

## Tools

- `list_clients` — returns all clients with `id`, `name`, `practiceCode`, `providerId`, `healthScore` (0–100), and `alertLevel` ("low" / "medium" / "high")
- `get_client` — detailed client data: debtor balance, average debtor days, one-day impact, bank reconciliation status, VAT/HMRC status, year-end date
- `get_client_activity_stats` — rolling annual, monthly average, and quarterly average activity stats: turnover, transaction counts (sales, bills, credits, manual journals, bank transactions), YoY/MoM % changes

## Widgets

- **Client Health** (`dext-client-health`) — list of all clients with health score and alert level badge; KPI stat shows total client count
- **Activity Stats** (`dext-activity-stats`) — KPI grid: total clients, average health score, and count by alert level (high / medium / low)

## See also

- [Dext Precision](https://precision.dext.com)
