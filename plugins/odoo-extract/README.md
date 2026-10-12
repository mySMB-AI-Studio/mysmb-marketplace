# Odoo Extract API

Digitize invoices, bank statements, expense reports, and resumes via [Odoo's Extract API](https://www.odoo.com/documentation/19.0/developer/reference/extract_api.html) — a paid OCR + AI field-extraction service — through the myHub-hosted MCP gateway (`myhub-mcp-servers/src/integrations/odoo-extract`). **This is not a general Odoo ERP connector** — it has no access to Odoo's CRM, accounting records, contacts, or any other model. Single IAP account token, no OAuth, no browser connect flow.

## Authentication

Odoo's Extract API authenticates with a single `account_token` (an Odoo IAP — In-App Purchase — account token), sent as a field inside every JSON-RPC2 request body rather than an OAuth token or an HTTP header. mySMB holds one IAP account for this service — there is no per-user credential, and every successful `parse_*` call spends one credit from that shared account.

## Configuration

No environment variables are required in this plugin — the account token lives server-side in the myHub-hosted MCP gateway (`ODOO_ACCOUNT_TOKEN`, sourced from the `ODOO_CLIENT_SECRET` secret), not here.

| Variable | Required | Description |
|---|---|---|
| *(none)* | — | Server-side static token — nothing to configure in this plugin. |

## Tools

Flow per document type: call `parse_<type>` with the document as base64 to get a `document_token`, then poll `get_<type>_result` with that token until `status` is `"success"` (extraction runs asynchronously on Odoo's side, typically a few seconds) — or pass `webhook_url` to `parse_<type>` to be notified instead of polling.

| Tool | Description |
|---|---|
| `parse_invoice` | Submit an invoice for extraction (total, due date, VAT number, supplier, line items, SWIFT/IBAN, etc.). Accepts `user_infos` (company VAT/name/country/lang/email, `perspective`) — optional, but Odoo's own docs say it "greatly improves the quality of the result, especially for invoices." |
| `get_invoice_result` | Fetch the extraction result for a `parse_invoice` call. |
| `parse_bank_statement` | Submit a bank statement for extraction (opening/closing balance, statement lines). |
| `get_bank_statement_result` | Fetch the extraction result for a `parse_bank_statement` call. |
| `parse_expense` | Submit an expense receipt/report for extraction (total, date, currency, description). |
| `get_expense_result` | Fetch the extraction result for a `parse_expense` call. |
| `parse_applicant` | Submit a resume/CV for extraction (name, email, phone, mobile). |
| `get_applicant_result` | Fetch the extraction result for a `parse_applicant` call. |

Every tool accepts an optional `use_test_token: true` to use Odoo's free `integration_token` instead of spending a real IAP credit — useful for testing, but subject to strict daily rate limits on Odoo's side.

### A note on API versions

Odoo's own docs list the "latest" API version per document type as invoice:123, bank_statement:100, expense:132, applicant:102. **Those numbers are wrong** — live-probing `https://extract.api.odoo.com` directly (while building this integration) showed every one of those routes returns a literal HTTP 404. The actual highest version that routes at all, for all four document types, is **2** — that's what this connector uses by default (overridable per call via `version` if Odoo ships something newer). `get_result` at version 2 is confirmed working end-to-end against the real API; `parse` at version 1/2 returned an in-band `error_unsupported_version` when tested with the free `integration_token` (tried with both a trivial image and a real tiny PDF) — unresolved without spending a real credit against the production `ODOO_ACCOUNT_TOKEN`. Worth a live check with the real token before leaning on `parse_*` in production.

## Rate limits / costs

Each successful `parse_*` call (without `use_test_token`) spends one credit from mySMB's shared Odoo IAP account. There is no per-tenant or per-user quota — every call draws from the same pool. `use_test_token: true` swaps to Odoo's free `integration_token`, which is rate-limited per day on Odoo's side rather than billed.

## Destructive operations

None in the traditional sense — `parse_*` tools don't modify any existing data, but each successful call spends a real, shared IAP credit. Treat it like a metered resource, not a free read.

## See also

- [Odoo Extract API docs](https://www.odoo.com/documentation/19.0/developer/reference/extract_api.html)
