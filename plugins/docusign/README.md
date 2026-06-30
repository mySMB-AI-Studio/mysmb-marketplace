# DocuSign

DocuSign agreement workflows via DocuSign's hosted MCP server at `https://mcp.docusign.com/mcp`. Browser OAuth (Confidential Authorization Code Grant) — no env vars, no API keys, just click Connect.

Covers four API groups: **eSignature** (envelopes, recipients, reminders), **User Management** (users, account info), **Workflow Builder** (instance orchestration, pause/resume, triggers), and **Agreement Manager** (cross-product agreement list and detail). 21 tools total.

## Authentication

> **From the official DocuSign MCP documentation:**
> "Docusign MCP server supports access tokens only for Confidential Authorization Code Grant OAuth grant type."

**Confidential Authorization Code Grant** is an OAuth 2.0 flow used by server-hosted integrations. It applies here because:
- Users have individual DocuSign accounts and log in to MyHub individually.
- MyHub is a server-hosted integration with clients accessing via browser.

No environment variables or API keys are stored in this plugin; the DocuSign MCP server manages the full token lifecycle server-side.

### Flow summary

1. MyHub redirects the user's browser to the DocuSign authorization endpoint to obtain consent.
2. DocuSign redirects back with an authorization code.
3. The MCP server exchanges the code for an `access_token` + `refresh_token` using the token endpoint with `Authorization: Basic <Base64(integration_key:secret_key)>`.
4. Every API call sends `Authorization: Bearer <access_token>`.
5. The MCP server silently refreshes the access token using the refresh token before it expires — no manual rotation needed.

### Endpoints

| Environment | Authorization endpoint | Token endpoint |
|---|---|---|
| **Production** | `https://account.docusign.com/oauth/auth` | `https://account.docusign.com/oauth/token` |
| **Developer / Demo** | `https://account-d.docusign.com/oauth/auth` | `https://account-d.docusign.com/oauth/token` |

### Token lifetimes

| Token | Lifetime |
|---|---|
| Access token | 8 hours (28,800 seconds) |
| Refresh token | 30 days (rolling); add `extended` scope to extend by 30 days on every use |

### Prerequisites

Before connecting, you must have a DocuSign Integration Key (App) configured with:
- A **Client Secret** (required for Confidential Authorization Code Grant)
- Both redirect URIs listed below registered under the integration key
- **Admin consent granted** in DocuSign eSignature Admin (Settings → Apps and Keys → your app) for the `signature` and `impersonation` scopes — without admin consent, the `impersonation` scope will be silently denied and MCP calls will fail

## Configuration

No environment variables are required. Authentication is handled entirely by the DocuSign OAuth flow.

| Variable | Required | Description |
|---|---|---|
| *(none)* | — | Browser OAuth — credentials are never stored in env. |

## OAuth scopes requested

```
signature impersonation
```

- `signature` — eSignature, Workflow Builder, and Agreement Manager API access
- `impersonation` — required by the DocuSign-hosted MCP server to proxy API calls on the authenticated user's behalf; requested automatically during the browser OAuth consent screen

## Redirect URIs (required setup)

Before connecting, add **both** of these URIs to the **Redirect URIs** list for your Integration Key in DocuSign eSignature Admin (Settings → Apps and Keys → your app → Edit):

```
https://claude.ai/api/mcp/auth_callback
https://claude.com/api/mcp/auth_callback
```

## Tools

### eSignature API (8 tools)

| Tool | Description |
|---|---|
| `createEnvelope` | Create and optionally send an envelope — from a template (`templateId`) or from documents (`documents` + `recipients`); max 25 MB per file |
| `getAccount` | Retrieve account information and settings |
| `getEnvelope` | Get a single envelope by ID |
| `getEnvelopes` | List envelopes with filters — at least one of `from_date`, `envelope_ids`, or `transaction_ids` is required |
| `listRecipients` | List all recipients for a given envelope |
| `sendReminder` | Send a signing reminder to recipients of an envelope |
| `updateEnvelope` | Update envelope metadata or status (send draft, void, purge, etc.) |
| `updateEnvelopeRecipients` | Add, update, or remove recipients on an in-flight envelope |

### User Management (3 tools)

| Tool | Description |
|---|---|
| `getUser` | Get a single user's profile within an account |
| `getUserInfo` | Get the authenticated user's account details and API base URIs |
| `getUsers` | List users in the account with optional filters |

### Workflow Builder API (8 tools)

| Tool | Description |
|---|---|
| `cancelWorkflowInstance` | Cancel a running workflow instance |
| `getWorkflowInstance` | Get the status and data of a single workflow instance |
| `getWorkflowInstancesList` | List workflow instances for a workflow definition |
| `getWorkflowsList` | List all available workflow definitions |
| `getWorkflowTriggerRequirements` | Get the input schema required to trigger a workflow |
| `pauseNewWorkflowInstances` | Pause creation of new instances for a workflow |
| `resumeWorkflow` | Resume a paused workflow so it accepts new instances |
| `triggerWorkflow` | Start a new workflow instance with the required trigger data |

### Agreement Manager API (2 tools)

| Tool | Description |
|---|---|
| `getAllAgreements` | Retrieve all agreements across DocuSign products |
| `getAgreementDetails` | Get full details for a specific agreement |

## Widgets

- **Pending Envelopes** — envelopes awaiting action ordered by creation date, with status badge and recipient count
- **Recent Agreements** — latest agreements from Agreement Manager with status and type

## Key workflows

### Send a document for signature

1. `createEnvelope` — create an envelope; pass `templateId` for a template-based send, or `documents` + `recipients` for ad-hoc; set `status: "sent"` to dispatch immediately or `"created"` to hold as draft (template IDs are found in DocuSign Admin → Templates)
2. `getEnvelope` — poll for completion
3. `sendReminder` — nudge signers who haven't acted

### Monitor an in-flight envelope

1. `getEnvelopes` — filter by `status: "sent"` to see all pending
2. `listRecipients` — inspect which recipients have/haven't signed
3. `updateEnvelopeRecipients` — correct a recipient's email or add a new signer

### Orchestrate a workflow

1. `getWorkflowsList` — discover available definitions
2. `getWorkflowTriggerRequirements` — fetch the required input schema
3. `triggerWorkflow` — start a new instance
4. `getWorkflowInstance` — check progress
5. `cancelWorkflowInstance` or `resumeWorkflow` — manage instance lifecycle

## Destructive operations

- `createEnvelope` with `status: "sent"` — sends real emails to recipients immediately
- `sendReminder` — sends reminder emails to signers
- `cancelWorkflowInstance` — terminates a running workflow; not recoverable
- `updateEnvelopeRecipients` — modifying recipients on a sent envelope notifies them
- `pauseNewWorkflowInstances` — stops new instances system-wide for that workflow

## See also

- [DocuSign MCP Server documentation](https://developers.docusign.com/platform/mcp-server)
- [DocuSign MCP interactive tools catalog](https://mcp.docusign.com/tools)
- [DocuSign eSignature REST API](https://developers.docusign.com/docs/esign-rest-api/)
- [DocuSign Workflow Builder API](https://developers.docusign.com/docs/workflow-builder-api/)
- [DocuSign Agreement Manager API](https://developers.docusign.com/docs/click-api/)
- [Confidential Authorization Code Grant](https://developers.docusign.com/platform/auth/authcode/)
- [Authorization Code Grant refresh tokens](https://www.docusign.com/blog/developers/authorization-code-grant-refresh-tokens)
- [Authentication scopes reference](https://developers.docusign.com/platform/auth/reference/scopes/)
