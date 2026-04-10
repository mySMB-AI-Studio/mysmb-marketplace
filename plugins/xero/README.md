# Xero plugin

A Claude Code plugin that packages the **official Xero MCP server**
([`@xeroapi/xero-mcp-server`](https://github.com/XeroAPI/xero-mcp-server)) with
a curated set of SMB-focused slash commands and subagents. Part of the
[mySMB Marketplace](../../README.md).

## What it does

The official upstream server exposes ~50 tools covering contacts, invoices,
credit notes, bank transactions, payroll, and financial reports. This plugin
layers on top of that:

- Cash-flow focused slash commands tuned for SMB owners asking plain-English
  questions.
- Two subagents with different postures for different kinds of work
  (accuracy-first reporting vs. action-first collections).

### Slash commands

| Command | What it does |
| ------- | ------------ |
| `/xero:reports` | Summarises the last full calendar month's profit and loss in plain English. |
| `/xero:who-owes-me` | Accounts receivable summary - total outstanding, aged buckets, top debtors. |
| `/xero:overdue` | Lists just the overdue invoices, sorted most-urgent first. |
| `/xero:chase` | Drafts polite follow-up emails for the top overdue customers. **Drafts only - the plugin does not send email.** |
| `/xero:cash-snapshot` | One-screen view combining current AR with last month's P&L. |

### Subagents

- **`xero-bookkeeper`** - careful, numerate, cite-the-numbers assistant for
  reporting, P&L interpretation, and invoice creation.
- **`xero-collections`** - action-oriented specialist for chasing overdue
  invoices. Read-only; cannot create invoices or send email. Hands off
  non-collections questions to `xero-bookkeeper`.

## Auth model

This plugin uses Xero's **Custom Connections** flow - a machine-to-machine
integration scoped to a single Xero organisation. There is no interactive
user OAuth. The upstream server exchanges the client id and secret for an
app-scoped access token itself and caches it in memory.

Custom Connections are a **paid Xero feature**. The connected organisation
must be on a paid Xero plan, and each Custom Connection app is bound to
exactly one organisation at creation time.

## Configuration

All credentials are read from environment variables at startup. MyHub injects
these at session start from the tenant's secrets vault; Claude Code users can
set them in their shell.

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `XERO_CLIENT_ID` | yes | Client id of the Xero Custom Connection app. |
| `XERO_CLIENT_SECRET` | yes | Client secret of the Xero Custom Connection app. |

That is the entire configuration surface. The upstream server does not need
a tenant id (Custom Connections are already scoped to one organisation) or
a redirect URI (the client-credentials flow has no browser round-trip).

### Getting your credentials

1. Go to <https://developer.xero.com/app/manage> and create a new app.
2. Choose **Custom Connection** as the integration type. You cannot change
   this later.
3. Pick the Xero organisation the connection will be bound to. That
   organisation must be on a paid Xero plan.
4. Grant the scopes listed in the upstream server's README.
5. Copy the generated client id and client secret into the connection form.

## Install (Claude Code)

```
/plugin marketplace add mySMB-AI-Studio/mysmb-marketplace
/plugin install xero@mysmb-marketplace
```

Then export `XERO_CLIENT_ID` and `XERO_CLIENT_SECRET` and restart your
session. The first time the plugin runs, `npx` will download
`@xeroapi/xero-mcp-server` and cache it; subsequent starts are fast.

## Why we ship the upstream server instead of a custom one

Earlier revisions of this plugin shipped a small custom MCP server under
`server/`. We swapped it for the official `@xeroapi/xero-mcp-server`
because:

- The upstream server exposes roughly ten times as many tools.
- It is maintained by Xero themselves, so schema and scope changes land
  upstream rather than here.
- The configuration surface is smaller: two env vars instead of four.

The trade-off is that first-run start pays an `npx` install cost. Every
subsequent start uses the npx cache, and the tenant runtime can pre-warm
the cache once per container image.

## License

MIT.
