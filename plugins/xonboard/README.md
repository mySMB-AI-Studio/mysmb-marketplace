# Xonboard

Read **Xonboard** employee-onboarding data through the myHub-hosted Xonboard MCP
gateway. Xonboard is an employee-onboarding product used by accounting and
payroll practices, built on Xero Payroll — but it does **not** have a separate
public API of its own. Xonboard is built on and documented as a customer
product of **[SuperAPI](https://superapi.com.au)**, an embedded Australian
superannuation-onboarding platform. This plugin connects to SuperAPI's real,
documented API under the Xonboard product name — employer, employee, and
onboarding-session data.

This plugin wires up the `.mcp.json` pointer and the Connect modal so it can be
installed and configured, and ships four **static demo tiles** previewing what
a live connection will look like: Onboarding Pipeline, Pending Actions, Super
Fund Selections, and Compliance Status. The Xonboard MCP server itself is
being built in parallel in a separate `myhub-mcp-servers` PR — these tiles have
no `dataProvider` yet and show illustrative sample data for a fictional
accounting/payroll practice, not a real practice's figures, pending that
server going live and a real SuperAPI product key.

## Authentication

SuperAPI uses a plain **API key** model — not OAuth, no token exchange, no
client secret. Your SuperAPI **product key** (format `superapiproduct_...`) is
sent as the `x-api-key` header on every call; you never paste a bearer token.

Product keys are issued directly by SuperAPI's team — contact
support@superapi.com.au, or go through your existing SuperAPI partner contact,
and ask for a Xonboard product key. There is no public self-serve signup.
Sandbox vs production is a flag SuperAPI's team sets per-partner on the same
API host (`https://api.superapi.com.au/api/v1`) — there is no separate sandbox
URL.

See [SuperAPI docs](https://docs.superapi.com.au/).

## Configuration

Set this when connecting the plugin in myHub (Settings → Plugins → Connections):

| Variable | Required | Description |
|---|---|---|
| `XONBOARD_API_KEY` | Yes | SuperAPI *product* key (prefix `superapiproduct_`), not a partner key. Issued directly by SuperAPI — contact support@superapi.com.au or your SuperAPI partner contact. Sent as the `x-api-key` header. |

## Status

Connector scaffold + 4 static demo tiles (no live data yet). Untested against a
live SuperAPI product key: the paired MCP server isn't deployed yet and no
real Xonboard/SuperAPI credentials exist. Once both are ready, these tiles
need a `dataProvider` wired up and their sample rows replaced with real fields
confirmed against SuperAPI's own documented responses.
