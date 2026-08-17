---
name: business-central-query-data
description: Query and update Dynamics 365 Business Central ERP data (customers, items, sales invoices, orders, receivables). Use when the user asks about their BC data, invoices, stock levels, debtors, or wants to look something up "in Business Central".
---

# Query Business Central data

The `business-central` MCP server is Microsoft-hosted. Which tools you see depends on the tenant's MCP Server Configuration in BC — check your tool list first and pick the matching workflow.

## Workflow A — typed per-page tools (names like `List_APIV2SalesInvoices_PAG30012`)

The configuration pins specific API pages. Tool naming: `List…` = read, `Create…`/`ListUpdate…`/`Delete…` = writes (only present if the BC admin allowed them).

1. Call the `List…` tool for the entity you need. Results are Business Central API v2.0 entities with camelCase fields (`displayName`, `balanceDue`, `totalAmountIncludingTax`, `dueDate`, `status`, …).
2. Filter and aggregate in your reasoning — don't guess at unsupported query parameters. If a call fails on a parameter, retry with none.

## Workflow B — dynamic tools (`bc_actions_search` / `bc_actions_describe` / `bc_actions_invoke`)

The configuration uses Dynamic Tool Mode; you discover actions at runtime:

1. `bc_actions_search` with keywords ("customers", "sales invoice", "inventory", "vendor payments") to find candidate actions.
2. `bc_actions_describe` on the chosen action to confirm its exact parameters — never invoke undescribed actions with guessed parameters.
3. `bc_actions_invoke` to execute it.

## Data conventions

- Sales invoice `status`: `Draft`, `In Review`, `Open` (posted, unpaid), `Paid`, `Canceled`, `Corrective`. "Unpaid invoices" = status `Open`; use `remainingAmount` for what's still owed.
- `currencyCode` is blank for local-currency records — report amounts in the org's local currency, don't invent a currency.
- Aged AR (`agedAccountsReceivables`): `currentAmount` is not yet due; `period1/2/3Amount` are the overdue buckets (labels in `period1/2/3Label`).
- Item `inventory` is quantity on hand; only `type: Inventory` items have meaningful stock.

## Rules

- **Reads freely, writes carefully.** Before any `Create…`/`ListUpdate…`/`Delete…` or a bound action (posting, canceling an invoice), state exactly what will change and get the user's confirmation.
- Everything runs as the signed-in user — if a call returns a permissions error, say so; don't retry with different tools to work around it.
- On `Internal_CompanyNotFound`, the connection's `Company` header isn't reaching the server — point the user at the plugin README's Known Issues section rather than retrying.
