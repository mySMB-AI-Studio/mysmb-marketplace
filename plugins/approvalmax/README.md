# ApprovalMax

Access [ApprovalMax](https://www.approvalmax.com) approval-workflow data via the **myHub-hosted ApprovalMax MCP gateway** — a self-hosted connector (`myhub-mcp-servers/src/integrations/approvalmax`) that talks to ApprovalMax's Public API on your behalf. Covers the companies (organizations) the connected user can access, the user directory, Xero-sourced bills and purchase orders moving through approval, and ApprovalMax's system-agnostic "standalone documents" resource — the closest thing to a generic pending-approvals list.

Browser OAuth through myHub — no API keys, no env vars. Click Connect, sign in to ApprovalMax, and you're done.

## Configuration

No environment variables are required on the client side — this plugin's `.mcp.json` points at myHub's own hosted MCP gateway, and myHub injects the OAuth bearer token automatically once you connect.

On first use, Connect redirects to ApprovalMax's OAuth 2.0 authorization page (`https://identity.approvalmax.com/connect/authorize`) — sign in and grant access. The connection requests `https://www.approvalmax.com/scopes/public_api/read`, `https://www.approvalmax.com/scopes/public_api/write`, `openid`, and `offline_access`.

Token behavior: ApprovalMax access tokens expire after 3600 seconds; myHub proactively refreshes them using the real refresh token issued alongside (`offline_access` was requested). If the connection ever stops working, click Connect again to re-authorize.

### Prerequisites

- An ApprovalMax account with access to at least one company (organization).
- ApprovalMax has no single "org" a connection is bound to — a connected user can see multiple companies, and every resource call takes an explicit `company_id`. Call `list_companies` first to get the id(s) you need; almost every other tool requires it.

## Tools & resources

This connector exposes the following MCP tools, backed directly by ApprovalMax's Public API:

### Companies

| Tool | Description |
|------|-------------|
| `list_companies` | Every ApprovalMax company (organization) the connected user can access. Call this first — every other tool requires the `company_id` returned here. |

### User directory

| Tool | Description |
|------|-------------|
| `list_users` | The user directory (approvers, requesters) for a company. |
| `get_user` | Full detail for a single ApprovalMax user. |

### Standalone documents (generic "requests")

| Tool | Description |
|------|-------------|
| `list_requests` | Standalone (system-agnostic, custom-workflow) approval requests for a company — the closest ApprovalMax resource to a generic "pending approvals" list. Filter with `request_status`. Does **not** include Xero bills or purchase orders — use `list_bills` / `list_purchase_orders` for those. Paginated via `continuation_token`. |
| `get_request` | Full detail for a single standalone approval request, including its approval event history. |

### Xero-sourced bills

| Tool | Description |
|------|-------------|
| `list_bills` | Xero-sourced supplier bills going through ApprovalMax's approval workflow for a company. Filter with `request_status`. Paginated via `continuation_token`. |
| `get_bill` | Full detail for a single Xero bill, including line items, approval events, and payment allocations. |
| `create_bill` | Submit a new Xero bill into ApprovalMax's approval workflow. |

### Xero-sourced purchase orders

| Tool | Description |
|------|-------------|
| `list_purchase_orders` | Xero-sourced purchase orders going through ApprovalMax's approval workflow for a company. Filter with `request_status`. Paginated via `continuation_token`. |
| `get_purchase_order` | Full detail for a single Xero purchase order, including line items, delivery details, and approval events. |

## Capabilities this connector does NOT have

- **QuickBooks or NetSuite-sourced documents.** ApprovalMax's Public API has no single unified "all approval requests" endpoint — each source-accounting-system + document-type pair is its own endpoint. This connector covers Xero-sourced bills/purchase orders (mySMB's dominant accounting integration) plus the vendor's system-agnostic standalone-documents resource. QuickBooks/NetSuite-sourced documents are not wired up.
- **Approving or rejecting a request.** No tool currently submits an approval decision — this is a read-first cut plus bill creation only.

## Destructive / mutating operations

Confirm before calling — this changes workspace/company data:

- `create_bill` — submits a new Xero bill into the approval workflow. Note: the `tax_type` field's exact wire shape is unverified against a live account — sanity-check a real submission before relying on this in production.

There is no delete or approve/reject tool exposed by this connector.

## Rate limits

Follow ApprovalMax's own published Public API rate limits. If a tool call returns a `429`, wait a few seconds and retry once.

## See also

- [ApprovalMax Developer docs](https://developer.approvalmax.com/docs)
- [ApprovalMax OAuth authorization flow](https://developer.approvalmax.com/docs/authorization-flow)
