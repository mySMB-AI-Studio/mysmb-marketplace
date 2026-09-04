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
  - Date range / as-at — declare `date` inputs that map 1:1 onto the tool's REAL date parameters (for example `from_date`, `to_date`, `as_at_date`; a date default may be `"today"`). Period presets (this month, last quarter, YTD) are a CLIENT-SIDE picker that computes and sets the declared date inputs — never an input of their own, unless the tool itself takes a preset parameter.
  - `basis` or comparison controls — only when the tool takes an equivalent parameter (accrual/cash toggle, `periods`, `timeframe`, `paymentsOnly`, …), each declared as its own input mapped 1:1.
  - The report skill names which of these (and any report-specific inputs) apply.
- THE MAPPING LAW: every declared input must be consumed by some binding's `params`, and each binding param maps ONE declared input (or static/context value) onto ONE parameter the tool actually accepts — discover the tool's real parameters during generation and declare nothing the manifest does not use. The keys passed to `MyHubReport.getData(...)` and `MyHubReport.setInputs(...)` are the DECLARED INPUT NAMES exactly as written in `inputs` — never the tool's parameter names. The platform rejects any undeclared key at hydration (`invalid_inputs` / "unknown input"), so a control wired to a tool parameter name will always fail.
- BINDING ECONOMY: at most FIVE bindings per report. Xero allows only 5 concurrent requests per organisation, and every binding is a live call on each open and refresh — beyond ~5 each one only adds latency, rate-limit pressure, and failure surface. Reuse one dataset across sections (a single P&L trend call feeds the KPI row, the chart, AND the monthly table); never add a second binding for a slice of data an already-held response contains. If a report idea genuinely needs more than five datasets, cut scope or merge calls — do not declare six.
- During the generation turn call each tool ONCE to learn its response shape, then write mapping and rendering JavaScript against that shape. Do not paste the discovered values into the document.
- Render from `MyHubReport.onData(bundle => …)`: read `bundle.data[bindingId]` per section; for `bundle.errors[bindingId]` render a friendly per-section notice (`needs_connection` means this viewer has not connected Xero — say that, offer nothing else). Show a loading skeleton until the first bundle arrives; never a permanently empty section.
- When a control changes, re-query just that data with `MyHubReport.getData(bindingId, { input: value })` and re-render the affected sections. Call `MyHubReport.setInputs({...})` on every control change so downloads and share links capture the reader's current view.
- ERROR HANDLING IS PART OF THE CONTRACT: every `getData` promise MUST have a rejection path that renders. On failure, show the affected section's error notice (same styled treatment as a `bundle.errors` entry) and keep the control usable so the reader can simply retry. An empty `.catch(() => {})` is FORBIDDEN — a throttled or failed re-query would keep stale figures on screen and the filter would look dead. When the message mentions a rate limit or 429, say so in plain words: "Xero is briefly rate-limited — try again in a few seconds."
- Interactivity that does NOT need new data is client-side JavaScript over already-hydrated data — column sorting on every table, a text filter box on any long table (contacts, invoices, line items), tab or segment switches between report views. Never add a binding for sorting, filtering, or aggregation of data you already have.
- Recompute the Validation section's tie-outs in JavaScript on every hydration, against the numbers actually rendered. A Pass baked at generation time is meaningless once the data refreshes.
- Snapshot mode: when `MyHubReport.mode === 'snapshot'` (downloads and share links serve frozen data), disable or hide controls that would re-query, keep client-side sorting and filtering working against the embedded data, and state clearly that figures are frozen as of the captured time.
- Data freshness in the header comes from `bundle.fetchedAt`, never the generation timestamp.

Reserve a STATIC report (no `dataBindings`, data baked in, today's older rules) for the one case it is right: the user explicitly wants a frozen, point-in-time analysis. Then pass `connectors: ["xero-accounting"]` to `artifact_save` so the library still shows the data source.

## Consistent visual system

Build accessible semantic HTML with all CSS and optional lightweight JavaScript inline; do not fetch external libraries. Use a calm Xero-inspired system: #13B5EA accent, navy #172B4D text, #F5F7FA canvas, white cards, #D8E1E8 borders, green #168A52 positive, red #C9362B overdue/negative. Use a responsive 12-column card grid, 8px spacing rhythm, system sans-serif, strong hierarchy, tabular numerals, bracketed negatives, and clear print styles.

Charts are REAL inline SVG drawn in a `viewBox`, never stacks of styled divs: axes with labelled ticks, light horizontal gridlines, properly scaled bars/lines/areas, a legend, and accessibility (`role="img"` + `aria-label` on the svg, a `<title>` per mark for hover values). Line charts plot their points; proportion charts are stroke-dasharray donut rings, not percentage-width divs. Write each chart as one small reusable JS function taking (data, container) so quality stays uniform across sections, and re-render it from hydrated data like every other section. A report must look composed even when data is missing or failed — error and empty states are styled cards in the same visual system, never raw text or a collapsed section.

Tables need sticky headers when useful, right-aligned numbers, visible totals, sortable columns, and horizontal overflow on small screens. Render input controls (organisation selector, period picker, basis toggle) as a compact control row in the header area, styled with the same system.

The header must show report name, organisation, period, basis, currency, and data freshness (from `bundle.fetchedAt`). Add an executive summary, then detail, validation, and sources. Save the final document with `artifact_save`; do not paste HTML into chat.
