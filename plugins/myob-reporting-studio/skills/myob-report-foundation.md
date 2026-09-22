---
name: myob-report-foundation
description: Apply the shared data, validation, visual, interactivity, and delivery rules for every MYOB report.
---
# MYOB report foundation

Load this skill with the specific report skill.

Resolve the MYOB company file, period or as-at date, and accounting basis (accrual/cash, where the underlying tool supports it) — but prefer declaring them as report inputs with sensible defaults over asking the user up front; ask only when a required choice genuinely cannot be defaulted. Do not ask for an output format: every report is a single self-contained HTML document saved through artifact_save with a .html filename.

Before starting any report, confirm the tool it needs actually exists in the current myob-accounting connector. All Wave 1 report types now have a backing tool or composite of tools; several Wave 2/3 report types (banking, budgets, payroll, inventory, jobs) do not yet — check the connector-map review before assuming a tool exists. If the data isn't exposed, say so plainly and suggest a MYOB export as a fallback — never approximate a report from adjacent data just because the real tool is missing.

Use the connected MYOB tools for live data. Never invent, estimate, silently substitute, or reuse illustrative workbook values. Mark unavailable figures N/A — not in source — and include a Sources & limitations section naming tool calls, report dates, basis, and assumptions explicitly approved by the user.

Perform every tie-out required by the report skill. Show a compact Validation section with each equation and Pass/Fail. If a material check fails, explain the discrepancy prominently.

## Live reports (the default)

A report over connected MYOB data is LIVE: never bake retrieved rows or computed figures into the HTML. Pass dataBindings to artifact_save and write the document to render everything from hydrated data through the injected MyHubReport SDK. The platform injects the SDK at serve time — never include, stub, or fetch it yourself.

* Declare one binding per MYOB dataset the report shows, targeting the myob-accounting MCP server's tools, e.g. `{ "id": "profit_and_loss", "tool": { "mcp": "myob-accounting", "name": "get_profit_and_loss" }, "params": { "from_date": { "kind": "input", "input": "from_date" }, "to_date": { "kind": "input", "input": "to_date" }, "reporting_basis": { "kind": "input", "input": "basis" } } }`. Param kinds: `{"kind":"static","value":…}` for choices fixed at authoring, `{"kind":"context","source":"now.date"}` for server-resolved values, `{"kind":"input","input":"…"}` for anything a reader may change.
* Declare inputs for the report's controls instead of interrogating the user:
  * `company_file` — when `list_company_files` exposes more than one, an enum input rendered as a selector in the report header; default to the file in play.
  * Date range / as-at — declare date inputs that map 1:1 onto the tool's REAL date parameters (`from_date`, `to_date`, or `date` for as-at reports). Period presets (this month, last quarter, YTD) are a CLIENT-SIDE picker that computes and sets the declared date inputs — never an input of their own.
  * `basis` — only when the tool takes a `reporting_basis` parameter (accrual/cash), declared as its own input mapped 1:1.
  * The report skill names which of these (and any report-specific inputs) apply.
* **THE MAPPING LAW:** every declared input must be consumed by some binding's params, and each binding param maps ONE declared input (or static/context value) onto ONE parameter the tool actually accepts — discover the tool's real parameters during generation and declare nothing the manifest does not use. The keys passed to `MyHubReport.getData(...)` and `MyHubReport.setInputs(...)` are the DECLARED INPUT NAMES exactly as written in inputs — never the tool's parameter names.
* During the generation turn call each tool ONCE to learn its response shape, then write mapping and rendering JavaScript against that shape. Do not paste the discovered values into the document.
* Render from `MyHubReport.onData(bundle => …)`: read `bundle.data[bindingId]` per section; for `bundle.errors[bindingId]` render a friendly per-section notice (`needs_connection` means this viewer has not connected MYOB — say that, offer nothing else). Show a loading skeleton until the first bundle arrives; never a permanently empty section.
* When a control changes, re-query just that data with `MyHubReport.getData(bindingId, { input: value })` and re-render the affected sections. Call `MyHubReport.setInputs({...})` on every control change so downloads and share links capture the reader's current view.
* Interactivity that does NOT need new data is client-side JavaScript over already-hydrated data — column sorting, a text filter on any long table, tab/segment switches. Never add a binding for sorting, filtering, or aggregation of data you already have.
* Recompute the Validation section's tie-outs in JavaScript on every hydration, against the numbers actually rendered.
* **Snapshot mode:** when `MyHubReport.mode === 'snapshot'` (downloads and share links serve frozen data), disable or hide controls that would re-query, keep client-side sorting/filtering working against the embedded data, and state clearly that figures are frozen as of the captured time.
* Data freshness in the header comes from `bundle.fetchedAt`, never the generation timestamp.

Reserve a STATIC report (no dataBindings, data baked in) for the one case it is right: the user explicitly wants a frozen, point-in-time analysis. Then pass `connectors: ["myob-accounting"]` to `artifact_save` so the library still shows the data source.

## Consistent visual system

Build accessible semantic HTML with all CSS and optional lightweight JavaScript inline; do not fetch external libraries. Use MYOB's real brand palette (sourced from MYOB's official Logo Usage Guide, developer.myob.com — not an AI-generated guess): primary `--accent:#5c247b`; secondaries `--yellow:#eab80f`, `--orange:#ec6915`, `--green:#76ad1c`, `--teal:#009699`, `--blue:#2aabe1`; ink tints `--ink-80:#333333`, `--ink-50:#7f7f7f`, `--ink-30:#b3b3b3`, `--ink-10:#e6e6e6`. MYOB's guide defines no red/danger color — use `--neg:#ec6915` (the orange) as the negative/overdue/failing-check color, a project judgment call, not a verified MYOB brand color. Use a responsive 12-column card grid, 8px spacing rhythm, system sans-serif, strong hierarchy, tabular numerals, bracketed negatives, and clear print styles. Prefer SVG/CSS charts with legends and accessible labels; charts re-render from hydrated data like every other section. Tables need sticky headers when useful, right-aligned numbers, visible totals, sortable columns, and horizontal overflow on small screens. Render input controls (company file selector, period picker, basis toggle, persona) as a compact control row in the header area, styled with the same system.

The header must show report name, company file, period, basis, and data freshness (from `bundle.fetchedAt`). Add an executive summary, then detail, validation, and sources. Save the final document with `artifact_save`; do not paste HTML into chat.

## Persona modes

Every report declares a `persona` input (not consumed by any data binding — it only controls rendering) with options `Client`, `Bookkeeper`, `Practitioner`, `Executive`, defaulting to `Bookkeeper`. Render it as a `<select id="personaSel">` in the controls row. `Client` and `Executive` render in **summary mode**: hide elements classed `detail-block` (line-item tables, per-transaction breakdowns) and show only headline totals, the executive summary, and validation results. `Bookkeeper` and `Practitioner` render in **detail mode**: show everything, including `detail-block` elements. Toggle by setting `document.body.className` to `persona-summary` or `persona-detail` and scoping CSS on those classes (`.persona-summary .detail-block{display:none;} .persona-detail .detail-block{display:block;}`). A failing validation check is never hidden by persona — Pass/Fail always renders regardless of mode. On persona change, call `MyHubReport.setInputs({persona: value})` so downloads/share links capture the reader's chosen mode; this never triggers a re-query since no binding consumes it.
