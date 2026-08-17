---
name: business-central-verify-setup
description: Verify a Business Central connection and that the dashboard tiles' tool bindings match the live server. Use after first connecting Business Central, when BC tiles show an error state, or when asked to "check the Business Central setup".
---

# Verify the Business Central setup

The BC MCP server generates tool names from the tenant's MCP Server Configuration, and the server is in preview — so the tile bindings are verified against the live server once per environment.

## Steps

1. **List the tools** the `business-central` server currently exposes.
2. **Classify the mode:**
   - Only `bc_actions_search` / `bc_actions_describe` / `bc_actions_invoke` → the connection points at a **Dynamic Tool Mode** configuration (or no `ConfigurationName` at all). Tiles cannot work in this mode — tell the user to create/point at the read-only tile configuration described in the plugin README (page 8351, Dynamic Tool Mode off, pages 30031/30012/30008/30009 with Allow Read).
   - Per-page tools present → continue.
3. **Check the three expected tile bindings:**
   - `List_APIV2AgedAR_PAG30031` (Receivables Aging)
   - `List_APIV2SalesInvoices_PAG30012` (Unpaid Invoices)
   - `List_APIV2Items_PAG30008` (Low Stock)
4. **If a name differs** (e.g. different casing/separator but same `PAG` number): report the exact live names next to the expected ones, and flag that each affected widget's `dataProvider.tool` in `plugins/business-central/widgets/*.json` needs that one-line update. Do not silently work around it.
5. **Smoke-test one read** — call the Aged AR list tool (or the closest live equivalent) and confirm rows come back with `balanceDue` / `period1Amount` fields. An `Internal_CompanyNotFound` error means the `Company` header isn't reaching the server (see README → Known Issues).
6. **Report** a short pass/fail summary per tile.
