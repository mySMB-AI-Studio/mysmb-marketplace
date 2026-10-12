# Odoo

Direct access to **mySMB's own Odoo ERP instance** via a community MCP Server app installed on Odoo itself — contacts and calendar. This is a **separate integration from `odoo-extract`**, which wraps Odoo's unrelated paid OCR document-digitization service. Don't confuse the two.

## Authentication

This connects straight to `https://mysmb.odoo.com/mcp` with a personal Odoo API key sent as `Authorization: Bearer <key>` — no OAuth, no myhub-mcp-servers proxy in between. Generate a key from Odoo's own "Save your API Key" dialog (shown exactly once) and paste it when connecting this plugin. It's stored encrypted in your personal credentials vault, like any other API-key plugin.

This MCP capability is **not a stock Odoo feature** — it comes from a community "MCP Server" app installed on this specific Odoo instance, which is why there's no official Odoo documentation page to link here.

## Configuration

| Variable | Used by |
|---|---|
| `ODOO_API_KEY` | `odoo` MCP server |

## Tools

Odoo's native MCP server is a **generic, model-agnostic query interface** — not per-resource tools like other connectors. It exposes 5 tools; this plugin's widgets only use `ai_tool_search`, but all 5 are available to the chat/agent for ad-hoc queries:

| Tool | Description |
|---|---|
| `ai_tool_mcp_retrieve_initial_context` | Current user, timezone, and company context. Odoo's own instructions say callers must invoke this once at the start of a conversation before any other tool. |
| `ai_tool_get_models` | List every Odoo model (technical name + description) accessible to the current user. |
| `ai_tool_get_fields` | Searchable fields for a given model — required before building a valid domain for that model. |
| `ai_tool_search` | Search a model with a domain filter, specific fields, pagination. Returns `{records, total_count}`. |
| `ai_tool_read_group` | Aggregate queries (sums, counts, averages) grouped by field, with an optional `having` filter. |

### Two real constraints that shape every tile here

Confirmed live against this actual Odoo instance while building this plugin (Odoo's native MCP has no documentation of its own to check against):

1. **`domain` is a Python literal string, not JSON.** Tuples use parentheses, not brackets, and booleans/null are capitalized — e.g. `"[('state', '!=', 'cancel')]"`, not `'[["state","!=","cancel"]]'` (which Odoo rejects as malformed).
2. **Relational fields return a bare numeric ID only.** `ai_tool_search` explicitly refuses dot-paths like `"partner_id.name"` — there's no way to ask for a linked record's name in one call. Resolving it would need a *second* `ai_tool_search` call, but the host writes every tool's result to the fixed path `/odoo/ai_tool_search` regardless of which model was queried — a second call on the same widget would silently overwrite the first one's result at that exact path. That's why the Calendar widget doesn't show an organizer/attendee name. A proper fix is a dedicated `myhub-mcp-servers` backend tool (the same pattern as the `odoo-extract` integration) that resolves the name server-side before the widget ever sees it.

## Widgets

- **Contacts** — every `res.partner` record (people and companies), with email/phone.
- **Calendar** — upcoming `calendar.event` meetings, soonest first (day/time, subject, busy/available, location, a Join button when a meeting URL is set). Odoo's own domain filter can't express "starting from now" (it's one Python-literal string; the host's `$today`-style dynamic tokens only substitute a param whose entire value is the token, not a fragment inside a larger domain string), so this widget fetches everything and filters out already-ended meetings client-side. Times are converted from Odoo's UTC wire format to mySMB's own Asia/Manila company timezone — safe here because this plugin is wired to one specific company instance, not a generic multi-tenant Odoo connection.

Both widgets are verified against real, populated data on mySMB's own Odoo instance: 3 real contacts and 1 real upcoming meeting.

Sales Orders and Invoices widgets were also built and schema-verified against this instance, but aren't shipped in this plugin yet — the instance has zero real sales orders or invoices, so only their empty states have been confirmed. They'll ship separately once there's real data to verify row rendering against.

## Destructive operations

None — every tile here only reads data (`ai_tool_search`). No tool in this plugin's tiles creates, updates, or deletes Odoo records.

## See also

- [Odoo Extract API plugin](../odoo-extract/README.md) — the unrelated OCR service, not this ERP connection.
