# Salesforce

Connect Salesforce CRM to myHub via the Salesforce-hosted MCP gateway. Browser OAuth flow — no env vars, no API keys, just click Connect.

Covers opportunities, accounts, contacts, cases, and arbitrary SOQL queries across your Salesforce org.

## Authentication

Paste a Salesforce OAuth access token into the Connect modal. Tokens expire after ~2 hours — re-paste a fresh one when widgets stop loading.

**Step 1 — Activate the Hosted MCP Server in your Salesforce org**

Setup → search "MCP Servers" → Salesforce Servers tab → click "Platform SObject (All)" → click Activate.

**Step 2 — Configure your External Client App**

Setup → External Client App Manager → open your app → API (Enable OAuth Settings):
- Add scope: "Access Salesforce Hosted MCP Servers"
- Add scope: "Perform requests at any time"
- Check: "Require Proof Key for Code Exchange (PKCE)"
- Check: "Issue JSON Web Token (JWT)-based access tokens"
- Uncheck: "Require secret for Web Server Flow" and "Require secret for Refresh Token Flow"
- Save, then copy the Consumer Key from Settings → OAuth Settings → Consumer Key and Secret.

**Step 3 — Get an access token via Salesforce CLI**

```
sf org login web --client-id <your-consumer-key> --alias sf-mcp
SF_TEMP_SHOW_SECRETS=true sf org display --target-org sf-mcp --verbose
```

Copy the `Access Token` value and paste it into the Connect modal.

Tokens expire after ~2 hours. Re-run the `sf org display` command for a fresh token when widgets stop loading.

## Configuration

| Variable | Description |
|---|---|
| `SALESFORCE_ACCESS_TOKEN` | JWT-based OAuth access token from an External Client App with the "Access Salesforce Hosted MCP Servers" scope. Stored encrypted per user. |

## Tools & resources

### Queries
- `soql_query` — run any SOQL query against your org; returns records with related-object fields resolved

### Records
- `getRecentItems` — list recently viewed records for a given SObject type (e.g. Account, Opportunity, Contact)
- `getSobjectRecords` — list records for any SObject with optional filter
- `getSobjectRecord` — get a single record by Id
- `createSobjectRecord` — create a new record
- `updateSobjectRecord` — update an existing record
- `deleteSobjectRecord` — delete a record

### Metadata
- `describeSobject` — describe the fields and relationships of any SObject
- `listSobjects` — list all SObject types available in the org

## Widgets

### Live (requires connector)
- **Recent Opportunities** — open pipeline ordered by close date; each row shows opportunity name, account, amount, stage and win probability with a progress bar
- **Key Accounts** — recently viewed accounts with industry subtitle and account-type badge

### Demo (static, no connector required)
- **Sales Overview (Demo)** — quarterly KPI tiles for opportunities count, pipeline value, closed won, and win rate with sparkline trends
- **Recent Opportunities (Demo)** — 10 hardcoded opportunities with avatar, account, probability bar, amount and stage
- **Key Accounts (Demo)** — 10 hardcoded accounts with clickable rows and an Overlay detail panel showing industry, location, owner, phone, revenue, and open opportunity count
- **Lead Funnel (Demo)** — 5-stage lead conversion funnel with per-stage progress bars and a conversion-rate KPI
- **Quota Attainment (Demo)** — 5 sales reps with closed vs. quota amounts, attainment progress bars, and colour-coded badges

## See also

- [Salesforce Platform MCP documentation](https://developer.salesforce.com/docs/einstein/genai/guide/mcp-intro.html)
- [External Client App setup guide](https://developer.salesforce.com/docs/platform/hosted-mcp-servers/guide/create-external-client-app.html)
- [SOQL reference](https://developer.salesforce.com/docs/atlas.en-us.soql_sosl.meta/soql_sosl/sforce_api_calls_soql.htm)
