# Xero plugin

A Claude Code plugin that exposes a Xero accounting integration as a stdio MCP
server. Part of the [mySMB Marketplace](../../README.md).

## What it does

Gives the agent a handful of structured tools for talking to Xero:

- `list_invoices(status?, limit?)` - recent invoices for the configured tenant.
- `get_contact(contact_id)` - single contact by id.
- `create_invoice(contact_id, line_items)` - creates a draft invoice.
- `get_profit_and_loss(from_date, to_date)` - the P&L report for a date range.

The server also ships:

- A `/xero:reports` slash command that summarises the last month's P&L in
  plain English.
- A `xero-bookkeeper` subagent tuned for careful, cite-the-numbers bookkeeping
  questions.

## Auth model

This plugin uses Xero's **machine-to-machine** custom connection flow
(`grant_type=client_credentials`). There is no interactive user OAuth. The
server exchanges the client id / secret for an app-scoped access token at
startup, caches it in memory, and refreshes when it expires. All requests are
scoped to a single configured tenant.

## Configuration

All credentials are read from environment variables at startup. MyHub injects
these at session start from the tenant's secrets vault; Claude Code users can
set them in their shell.

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `XERO_CLIENT_ID` | yes | Client id of the Xero custom connection app. |
| `XERO_CLIENT_SECRET` | yes | Client secret of the Xero custom connection app. |
| `XERO_REDIRECT_URI` | yes | Redirect URI registered on the Xero app. Required by the Xero SDK even for client-credentials flows. |
| `XERO_TENANT_ID` | yes | The Xero tenant (organisation) id to scope all requests to. |

If any of the above are missing the server prints an error to stderr and
exits 1 - it will never start an MCP session without credentials and will
never prompt interactively.

## Install (Claude Code)

```
/plugin marketplace add mySMB-AI-Studio/mysmb-marketplace
/plugin install xero@mysmb-marketplace
```

Then export the four variables above and restart your session.

## Development

```bash
cd plugins/xero/server
npm install
npm run build
```

The compiled `dist/` output is committed so the plugin runs with zero
install-time steps on tenant containers.

## License

MIT.
