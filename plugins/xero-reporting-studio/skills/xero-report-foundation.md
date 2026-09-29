---
name: xero-report-foundation
description: Apply the shared data, connector, validation, visual, interactivity, and delivery rules for every Xero report. Load it with the specific report skill.
---
# Xero report foundation

Load this skill with the specific report skill.

Resolve the Xero organisation, period or as-at date, accounting basis, and presentation currency — but prefer declaring them as report inputs with sensible defaults (see Live reports below) over asking the user up front; ask only when a required choice genuinely cannot be defaulted. Do not ask for an output format: every report is a single self-contained HTML document saved through `artifact_save` with a `.html` filename.

Before building, confirm every tool the report needs exists on the `xero-accounting` connector (see Connector facts). If a dataset has no endpoint, say so plainly and mark it N/A — not in source; never approximate a report from adjacent data because the real tool is missing, and never use tool names from other Xero connectors.

Use the connected Xero tools for live data. Never invent, estimate, silently substitute, or reuse illustrative workbook values. Mark unavailable figures N/A — not in source — and include a Sources & limitations section naming tool calls, report dates, basis, currency, missing inputs, and assumptions explicitly approved by the user.

Perform every tie-out required by the report skill. Show a compact Validation section with each equation and Pass/Fail. If a material check fails, explain the discrepancy prominently. **A check is Pass only when every figure it uses was actually returned.** A check computed from missing, errored, truncated or empty data renders N/A (or Fail when the missing data is itself the problem) — never Pass. Compare money with a tolerance of 0.01 everywhere (`Math.abs(a - b) < 0.01`).

## Connector facts (xero-accounting)

- **Organisation:** every read tool accepts an optional `xero_tenant_id` (string). It must be one of the organisations the user authorised; omitted or `""` means the connection's default organisation. `list_connections` (no params) returns `{ activeTenantId, tenants: [{ tenantId, tenantName, tenantType }] }` — the organisation picker source. `get_organisation` (no params besides `xero_tenant_id`) returns `{ Organisations: [{ Name, LegalName, BaseCurrency, CountryCode, FinancialYearEndDay, FinancialYearEndMonth, … }] }` — the organisation name, base currency and financial year end.
- **Parameters** are sent to Xero as query-string values (typed per the rule below); dates are `YYYY-MM-DD`. Unknown params are silently dropped, so a misspelt param fails quietly — use exactly the names below.
- **Reports** (all return the Reports shape described in *Reading Xero reports*):
  - `get_profit_and_loss`: `fromDate`, `toDate`, `periods` (integer), `timeframe` (`MONTH` | `QUARTER` | `YEAR`), `trackingCategoryID`, `trackingOptionID`, `trackingCategoryID2`, `trackingOptionID2`, `standardLayout` (boolean), `paymentsOnly` (boolean — `true` = cash basis).
  - `get_balance_sheet`: `date`, `periods` (integer), `timeframe` (`MONTH` | `QUARTER` | `YEAR`), `trackingOptionID1`, `trackingOptionID2`, `standardLayout` (boolean), `paymentsOnly` (boolean).
  - `get_trial_balance`: `date`, `paymentsOnly` (boolean).
  - `get_bank_summary`: `fromDate`, `toDate` — per bank account Opening balance, Cash received, Cash spent, Closing balance. No periods param: one call per date range.
  - `get_executive_summary`: `date` — cash, profitability and balance-sheet ratios for the month, including debtor and creditor days.
  - `get_budget_summary`: `date`, `periods` (integer), `timeframe` (INTEGER `1` | `3` | `12` — not the MONTH/QUARTER/YEAR enum).
  - `get_aged_receivables_by_contact` / `get_aged_payables_by_contact`: `contactID`, `date`, `fromDate`, `toDate`. ONE contact per call, and Xero REQUIRES `contactID` even though the schema marks it optional. **There is no all-contacts ageing report** — build all-contacts ageing from `list_invoices` (see the Aged Receivables skill); use these two only for a single-contact drill-down.
- **Lists** return 100 rows per page (`page` integer, starting at 1; there is no page-size param):
  - `list_invoices`: `where` (e.g. `Type=="ACCREC"` for sales invoices, `Type=="ACCPAY"` for bills — there is no separate bills tool), `order` (e.g. `DueDate ASC`), `ids`, `invoiceNumbers`, `contactIDs`, `statuses` (comma-separated, e.g. `AUTHORISED` or `DRAFT,SUBMITTED,AUTHORISED`), `includeArchived` (boolean), `createdByMyApp` (boolean), `summaryOnly` (boolean), `page`, `searchTerm`. Rows: `{ InvoiceID, InvoiceNumber, Type, Contact{ContactID, Name}, Date, DueDate, Status, SubTotal, TotalTax, Total, AmountDue, AmountPaid, CurrencyCode, CurrencyRate, … }`. Dates arrive as `/Date(ms+0000)/` plus `DateString` / `DueDateString` (ISO — use the first 10 characters). `AmountDue` is the balance as of now, not as of an earlier as-at date.
  - `list_payments` (`where`, `order`, `page`), `list_bank_transactions` (`where`, `order`, `page`, `unitdp`), `list_credit_notes` (`where`, `order`, `page`), `list_contacts` (`where`, `order`, `ids`, `page`, `includeArchived`, `summaryOnly`, `searchTerm`), `list_purchase_orders` (`where`, `order`, `status`, `dateFrom`, `dateTo`, `page`), `list_linked_transactions` (`status` = `APPROVED` | `DRAFT` | `ONDRAFT` | `BILLED` | `VOIDED`, `page`), `list_budgets` (`dateFrom`, `dateTo`).
  - `list_accounts` (`where`, `order`) — chart of accounts only, **no balances**; balances come from `get_balance_sheet`, `get_trial_balance` or `get_bank_summary`.
  - `list_tax_rates` (`where`, `order`), `list_tracking_categories` (`TrackingCategories[].TrackingCategoryID`, `.Options[].TrackingOptionID`).
  - `list_journals` (`offset`) may fail as unauthorised — the connector does not hold the journals scope. Do not depend on it.
- **No endpoint** exists for: Activity Statement / BAS, the Cash Summary report, a cash-flow statement, Xero Analytics (Syft) widgets and AI insights, the Business Health Scorecard, industry benchmarks, and bank-feed statement balances. Say so as N/A — not in source.
- Reports never write. Do not call any create, update, delete, archive, email or void tool.

## Reading Xero reports

Every report tool returns `{ Reports: [{ ReportName, ReportTitles[], ReportDate, Rows: [...] }] }`. Each row has `RowType` of `Header`, `Section`, `Row` or `SummaryRow`, an optional `Title`, nested `Rows` (sections), and `Cells: [{ Value, Attributes? }]`.

- The `Header` row's cells are the column labels (first cell is the label column; the rest are periods or comparison dates).
- A `Section` has a `Title` (e.g. Income, Less Cost of Sales, Bank, Current Assets) and child rows. A `Row` is an account line: `Cells[0].Value` is the account name and `Cells[0].Attributes` may carry `{ Id: 'account', Value: '<AccountID>' }`. A `SummaryRow` is the section total. Computed lines such as Gross Profit or Net Profit usually sit in a Section with an empty `Title`.
- **Cell values are strings.** Parse to numbers (`parseFloat(v.replace(/,/g, ''))`); an empty cell on an account row is 0, but a missing total is N/A — never 0.
- Find sections by `Title` (case-insensitive, tolerant of "Less "/"Plus " prefixes) as discovered on the generation call — never by position; layouts differ per organisation.
- Take section totals from the `SummaryRow`, then recompute them from the account rows as a validation.

## Error contract

In `onData`, treat a source as FAILED when `bundle.errors[id]` is set (codes `tool_error`, `tool_not_found`, `invalid_inputs`, `needs_connection`, `connection_unavailable`, `unknown_binding`); after `getData`, a rejected promise is the same failure. Write one helper and use it for every section. For a failed source:

- Show the error message in that section. For `needs_connection`, say this viewer has not connected Xero — offer nothing else. For an organisation the viewer is not authorised for (a `tool_error` naming `xero_tenant_id`), say so and offer the organisation picker.
- Never render $0, an empty table, or "no items" as if it were real data.
- Mark every check that uses it N/A or Fail — never Pass.
- Keep rendering every other section.

## Live reports (the default)

A report over connected Xero data is LIVE: never bake retrieved rows or computed figures into the HTML. Pass `dataBindings` to `artifact_save` and write the document to render everything from hydrated data through the injected `MyHubReport` SDK. The platform injects the SDK at serve time — never include, stub, or fetch it yourself.

- Declare one binding per Xero dataset the report shows, targeting the `xero-accounting` MCP server's tools, e.g. `{ "id": "profit_and_loss", "tool": { "mcp": "xero-accounting", "name": "get_profit_and_loss" }, "params": { "fromDate": { "kind": "input", "input": "from_date" }, "toDate": { "kind": "input", "input": "to_date" }, "xero_tenant_id": { "kind": "input", "input": "organisation" } } }`. Param kinds: `{"kind":"static","value":…}` for choices fixed at authoring, `{"kind":"context","source":"now.date"}` for today, `{"kind":"input","input":"…"}` for anything a reader may change.
- **Limits:** at most 8 declared inputs and 12 bindings. Input types are `string`, `date`, `enum`, `number`, `boolean`. Every binding id must be read somewhere in the HTML.
- **Typed parameters:** a boolean tool param (`paymentsOnly`, `standardLayout`, `summaryOnly`, `includeArchived`) is a static JSON boolean (`{ "kind": "static", "value": true }`) or a declared `boolean` input — never an `enum` or `string` input. A number param (`periods`, `page`, and `get_budget_summary`'s `timeframe`) is a static JSON number or a `number` input. `timeframe` on `get_profit_and_loss` / `get_balance_sheet` is a static string or an `enum` input with options `MONTH`, `QUARTER`, `YEAR`.
- Declare `inputs` for the report's controls instead of interrogating the user:
  - `organisation` — ALWAYS declared: a `string` input (maxLength 64, default `""` = the connection's default organisation) holding a tenantId. Bind it to `xero_tenant_id` on EVERY binding except `list_connections`. Add a `connections` binding to `list_connections` and fill the header selector from its `tenants` client-side (hide the selector when there is only one). Add an `organisation` binding to `get_organisation`; the header shows ITS `Name` and `BaseCurrency` — the organisation actually queried — never a hardcoded label. Switching organisation re-queries every other binding for that organisation only.
  - Date range / as-at — declare `date` inputs that map 1:1 onto the tool's REAL date parameters (for example `from_date` → `fromDate`, `to_date` → `toDate`, `as_at_date` → `date`; a date default may be `"today"`). Period presets (this month, last month, this quarter, last quarter, YTD, last financial year) are a CLIENT-SIDE picker that computes and sets the declared date inputs — never an input of their own.
  - **Financial-year presets** come from `get_organisation`'s `FinancialYearEndMonth` / `FinancialYearEndDay`: the current FY ends on the next occurrence of that month/day on or after today (clamp the day to the month's length), and starts the day after the previous FY end. Recompute when the organisation changes. For a relative default (FY to date, last month), compute the dates on first load, then re-query with `getData` and call `setInputs` so the view and share links agree; skip this in snapshot mode.
  - `basis` — `get_profit_and_loss`, `get_balance_sheet` and `get_trial_balance` take `paymentsOnly`: declare a `boolean` input (e.g. `cash_basis`, default `false` = accrual) and label the control Accrual / Cash. Comparison controls (`periods`, `timeframe`) likewise, each as its own typed input mapped 1:1.
  - The report skill names which of these (and any report-specific inputs) apply.
- **Enum inputs** hold 1–12 options fixed at authoring. Never declare an enum "populated from" a list (contacts, accounts, tracking options, organisations). An entity picker (contact, account, tracking option) is a `string` input holding the ID, filled client-side from a list binding or rows the report already has. For "all", OMIT the param — filter client-side over an unfiltered binding, or call a second, filtered binding with `getData` only once a real ID is chosen. Never send `""` for an entity ID (the organisation input is the one exception, because the connector treats `""` as the default organisation).
- **Paging:** lists return 100 rows per page. Declare a `number` input `page` (default 1, min 1) and bind it to `page` on every list binding. After the bundle arrives, while the last page returned exactly 100 rows, fetch the next with `await MyHubReport.getData(id, { ...currentInputs, page: n })` and append. Bound the loop (state the cap, e.g. 20 pages = 2,000 rows), show progress, and when the cap is hit show a "may be truncated" banner and mark completeness checks N/A. Never pass `page` other than 1 to `setInputs`. Snapshots keep only the bundle data (page 1), so in snapshot mode say which totals need the live report. `where`, `order` and `statuses` are static strings fixed at authoring — they cannot embed a reader-changeable date. Filter date windows client-side (on `DateString` / `DueDateString`); with `order: Date DESC` you may stop paging once a page's rows all predate the window.
- **Fan-out:** when a section needs one call per range or entity (e.g. `get_bank_summary` per month), declare ONE binding whose params map declared inputs, and loop client-side with `getData(id, { ...currentInputs, from_date, to_date })`. Keep it bounded (e.g. 12 calls), show progress, disclose it in Sources & limitations, and never pass loop values to `setInputs`; the same snapshot caveat applies.
- THE MAPPING LAW: every declared input must be consumed by some binding's `params`, and each binding param maps ONE declared input (or static/context value) onto ONE parameter the tool actually accepts — discover the tool's real parameters during generation and declare nothing the manifest does not use. The keys passed to `MyHubReport.getData(...)` and `MyHubReport.setInputs(...)` are the DECLARED INPUT NAMES exactly as written in `inputs` — never the tool's parameter names. The platform rejects any undeclared key at hydration (`invalid_inputs` / "unknown input"), so a control wired to a tool parameter name will always fail. Controls that only change the view (ageing by due or invoice date, filters, tabs) are client-side state, not inputs.
- During the generation turn call each tool ONCE to learn its response shape, then write mapping and rendering JavaScript against that shape. Do not paste the discovered values into the document.
- Render from `MyHubReport.onData(bundle => …)`: read `bundle.data[bindingId]` per section and apply the error contract above. Show a loading skeleton until the first bundle arrives; never a permanently empty section.
- When a control changes, re-query just the affected bindings with `MyHubReport.getData(bindingId, { ...currentInputs, changed: value })` and re-render the affected sections. Call `MyHubReport.setInputs({...})` on every control change so downloads and share links capture the reader's current view.
- Interactivity that does NOT need new data is client-side JavaScript over already-hydrated data — column sorting on every table, a text filter box on any long table (contacts, invoices, line items), tab or segment switches between report views. Never add a binding for sorting, filtering, or aggregation of data you already have.
- Recompute the Validation section's tie-outs in JavaScript on every hydration, against the numbers actually rendered. A Pass baked at generation time is meaningless once the data refreshes.
- Snapshot mode: when `MyHubReport.mode === 'snapshot'` (downloads and share links serve frozen data), disable or hide controls that would re-query, keep client-side sorting and filtering working against the embedded data, and state clearly that figures are frozen as of the captured time.
- Data freshness in the header comes from `bundle.fetchedAt`, never the generation timestamp.

Reserve a STATIC report (no `dataBindings`, data baked in) for the one case it is right: the user explicitly wants a frozen, point-in-time analysis. Then pass `connectors: ["xero-accounting"]` to `artifact_save` so the library still shows the data source.

## Consistent visual system

Build accessible semantic HTML with all CSS and optional lightweight JavaScript inline; do not fetch external libraries. Use a calm Xero-inspired system: #13B5EA accent, navy #172B4D text, #F5F7FA canvas, white cards, #D8E1E8 borders, green #168A52 positive, red #C9362B overdue/negative. Use a responsive 12-column card grid, 8px spacing rhythm, system sans-serif, strong hierarchy, tabular numerals, bracketed negatives, and clear print styles. Prefer SVG/CSS charts with legends and accessible labels; charts re-render from hydrated data like every other section. Tables need sticky headers when useful, right-aligned numbers, visible totals, sortable columns, and horizontal overflow on small screens. Render input controls (organisation selector, period picker, basis toggle) as a compact control row in the header area, styled with the same system.

**Dark mode:** define every colour as a CSS custom property on `:root` and override them under `:root[data-myhub-theme='dark']` (canvas, cards, text, borders, muted text, chart colours). The host sets that attribute; never use `prefers-color-scheme`.

The header must show report name, organisation (the one actually queried), period, basis, currency (`BaseCurrency`), and data freshness (from `bundle.fetchedAt`). Add an executive summary, then detail, validation, and sources. Save the final document with `artifact_save`; do not paste HTML into chat.
