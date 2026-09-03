---
name: xero-report-foundation
description: Apply the shared data, validation, visual, interactivity, and delivery rules for every Xero report.
---
# Xero report foundation

Load this skill with the specific report skill.

Resolve the Xero organisation, period or as-at date, accounting basis, and presentation currency — but prefer declaring them as report inputs with sensible defaults (see Live reports below) over asking the user up front; ask only when a required choice genuinely cannot be defaulted. Do not ask for an output format: every report is a single self-contained HTML document saved through `artifact_save` with a `.html` filename.

Use the connected Xero tools for live data. Never invent, estimate, silently substitute, or reuse illustrative workbook values. Mark unavailable figures N/A - not in source and include a Sources & limitations section naming tool calls, report dates, basis, currency, missing inputs, and assumptions explicitly approved by the user.

Perform every tie-out required by the report skill. Show a compact Validation section with each equation and Pass/Fail. If a material check fails, explain the discrepancy prominently.

## Live reports (the default)

A report over connected Xero data is LIVE: never bake retrieved rows or computed figures into the HTML. Pass `dataBindings` to `artifact_save` and write the document to render everything from hydrated data through the injected `MyHubReport` SDK. The platform injects the SDK at serve time — never include, stub, or fetch it yourself.

- Declare one binding per Xero dataset the report shows, targeting the `xero-accounting` MCP server's tools, e.g. `{ "id": "aged_receivables", "tool": { "mcp": "xero-accounting", "name": "get_aged_receivables_by_contact" }, "params": { "date": { "kind": "input", "input": "as_at_date" } } }`. Param kinds: `{"kind":"static","value":…}` for choices fixed at authoring, `{"kind":"context","source":"now.date"}` for server-resolved values, `{"kind":"input","input":"…"}` for anything a reader may change.
- Declare `inputs` for the report's controls instead of interrogating the user:
  - `organisation` — when the connector exposes more than one organisation (`get_organisation`), an enum input rendered as a selector in the report header; default to the organisation in play.
  - `period` — enum presets suited to the report (for example `this_month`, `last_month`, `this_quarter`, `ytd`) or explicit `date` inputs; date inputs may default to `"today"`.
  - `basis` — enum `accrual` | `cash` where the underlying tool supports it.
  - The report skill names which of these (and any report-specific inputs) apply.
- During the generation turn call each tool ONCE to learn its response shape, then write mapping and rendering JavaScript against that shape. Do not paste the discovered values into the document.
- Render from `MyHubReport.onData(bundle => …)`: read `bundle.data[bindingId]` per section; for `bundle.errors[bindingId]` render a friendly per-section notice (`needs_connection` means this viewer has not connected Xero — say that, offer nothing else). Show a loading skeleton until the first bundle arrives; never a permanently empty section.
- When a control changes, re-query just that data with `MyHubReport.getData(bindingId, { input: value })` and re-render the affected sections. Call `MyHubReport.setInputs({...})` on every control change so downloads and share links capture the reader's current view.
- Interactivity that does NOT need new data is client-side JavaScript over already-hydrated data — column sorting on every table, a text filter box on any long table (contacts, invoices, line items), tab or segment switches between report views. Never add a binding for sorting, filtering, or aggregation of data you already have.
- Recompute the Validation section's tie-outs in JavaScript on every hydration, against the numbers actually rendered. A Pass baked at generation time is meaningless once the data refreshes.
- Snapshot mode: when `MyHubReport.mode === 'snapshot'` (downloads and share links serve frozen data), disable or hide controls that would re-query, keep client-side sorting and filtering working against the embedded data, and state clearly that figures are frozen as of the captured time.
- Data freshness in the header comes from `bundle.fetchedAt`, never the generation timestamp.

Reserve a STATIC report (no `dataBindings`, data baked in, today's older rules) for the one case it is right: the user explicitly wants a frozen, point-in-time analysis. Then pass `connectors: ["xero-accounting"]` to `artifact_save` so the library still shows the data source.

## Consistent visual system

Build accessible semantic HTML with all CSS and optional lightweight JavaScript inline; do not fetch external libraries. Use a calm Xero-inspired system: #13B5EA accent, navy #172B4D text, #F5F7FA canvas, white cards, #D8E1E8 borders, green #168A52 positive, red #C9362B overdue/negative. Use a responsive 12-column card grid, 8px spacing rhythm, system sans-serif, strong hierarchy, tabular numerals, bracketed negatives, and clear print styles. Prefer SVG/CSS charts with legends and accessible labels; charts re-render from hydrated data like every other section. Tables need sticky headers when useful, right-aligned numbers, visible totals, sortable columns, and horizontal overflow on small screens. Render input controls (organisation selector, period picker, basis toggle) as a compact control row in the header area, styled with the same system.

The header must show report name, organisation, period, basis, currency, and data freshness (from `bundle.fetchedAt`). Add an executive summary, then detail, validation, and sources. Save the final document with `artifact_save`; do not paste HTML into chat.
