# Mailchimp Transactional

Send and manage transactional emails via [Mailchimp Transactional](https://mailchimp.com/developer/transactional/) (formerly Mandrill), backed by Mailchimp's official hosted MCP server at `https://mandrillapp.com/mcp`.

Covers account status checks, template building, full API exploration, failed-send diagnostics, integration guidance, and onboarding assistance — everything needed to operate a transactional email programme from the MyHub workspace.

## Authentication

Mailchimp Transactional uses API-key authentication. The key is passed as a Bearer token in the `Authorization` header on every MCP request. API keys are scoped to your Mandrill account and can be created and revoked at any time.

## Configuration

| Variable | Required | Description |
|---|---|---|
| `MANDRILL_API_KEY` | yes | A Mailchimp Transactional (Mandrill) API key. Generate one under **Transactional → Settings → SMTP & API Info → Add API Key**. Stored encrypted in the per-user credentials vault — never committed to this repository. |

### Prerequisites

Before the MCP will work, ensure you have:

- A Mailchimp Transactional (Mandrill) account with an **authenticated sending domain** — verify your domain under **Settings → Sending Domains**.
- An API key with the correct permissions (see below).

### How to get your API key

1. Log in to [Mailchimp](https://login.mailchimp.com/) and open **Transactional** from the top navigation (requires a Transactional add-on or standalone Mandrill account).
2. Go to **Settings → SMTP & API Info**.
3. Click **Add API Key** and optionally label it (e.g. `myHub workspace`).
4. Copy the generated key — it begins with `md-` — and paste it into the Connect dialog.
5. To revoke access at any time, return to the same page and delete the key.

> **Security note:** API keys grant full access to your Mandrill account. Treat them like passwords. Each workspace user should ideally use their own key so that access can be revoked individually.

### API key permissions

Unrestricted API keys work by default. If you are using a **restricted API key**, you must enable the **"AI Agents" permission group** on that key for the MCP to function. Without it, all MCP tool calls will be rejected. To enable it: go to **Settings → SMTP & API Info**, edit the restricted key, and check the "AI Agents" group.

## Tools

| Tool | What it does |
|---|---|
| `account_status` | Returns the current status of your Mandrill account — quota, reputation, sending history summary |
| `build_template` | Constructs a Mandrill template from a description or requirements |
| `call_api` | Calls any Mailchimp Transactional REST API endpoint directly |
| `describe_api` | Describes a specific API endpoint — parameters, request/response schema |
| `diagnose_failed_send` | Diagnoses why a transactional send failed — rejects, bounces, spam complaints |
| `integrate_api` | Provides code examples and integration guidance for the Transactional API |
| `list_api` | Lists all available Mailchimp Transactional API endpoints |
| `onboarding` | Step-by-step onboarding assistance for new Mandrill accounts |
| `submit_feedback` | Submits feedback to the Mailchimp Transactional MCP team |

## Agent

The plugin ships a **Mailchimp Transactional Assistant** agent (`agents/mailchimp-transactional-assistant.md`) that guides the AI on how to use each tool effectively — including when to run diagnostics before retrying a send, how to discover available endpoints via `list_api` and `describe_api`, and how to sequence the onboarding flow for new accounts.

## Widgets

| Widget | Tool | What it shows |
|---|---|---|
| **Account Status** | `account_status` | Reputation score, hourly/daily sending quota used vs available, and account health summary |

## Destructive operations

Confirm before calling — these operations send real email or mutate account data:

- `call_api` — can trigger live sends, template saves, allowlist/denylist changes, or webhook registration depending on the endpoint called. Always use `describe_api` first to understand what an endpoint does.
- `build_template` — creates or overwrites templates in your Mandrill account if a save endpoint is called as part of the build flow.

## See also

- [Mailchimp Transactional MCP guide](https://mailchimp.com/developer/transactional/guides/how-to-use-mailchimps-transactional-messaging-mcp)
- [Mailchimp Transactional API reference](https://mailchimp.com/developer/transactional/api/)
- [Mandrill account settings](https://mandrillapp.com/settings/)
