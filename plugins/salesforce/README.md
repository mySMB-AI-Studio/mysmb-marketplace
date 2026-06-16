# Salesforce

Connect Salesforce CRM to myHub via the Salesforce-hosted MCP gateway. Browser OAuth flow — no env vars, no API keys, just click Connect.

Covers opportunities, accounts, contacts, cases, and arbitrary SOQL queries across your Salesforce org.

## Authentication

Salesforce uses browser OAuth. On first use the browser redirects to `login.salesforce.com` — sign in and authorise the app. The gateway exchanges the code for an access token and handles token refresh transparently.

No environment variables or API keys are required.

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

- **Recent Opportunities** — open pipeline ordered by close date; each row shows opportunity name, account, amount, stage and win probability with a progress bar
- **Key Accounts** — recently viewed accounts with industry subtitle and account-type badge

## See also

- [Salesforce Platform MCP documentation](https://developer.salesforce.com/docs/einstein/genai/guide/mcp-intro.html)
- [SOQL reference](https://developer.salesforce.com/docs/atlas.en-us.soql_sosl.meta/soql_sosl/sforce_api_calls_soql.htm)
