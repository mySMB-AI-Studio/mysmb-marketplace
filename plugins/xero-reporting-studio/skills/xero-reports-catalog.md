---
name: xero-reports-catalog
description: Build an interactive index of every Xero report skill in this library, grouped by category, with search and links to each. Use for "reports catalog", "what reports can you build", "report library", "list of Xero reports".
---
# Reports Catalog

This is navigation, not a data report, and stays a lightweight written specification — not a kit report. `xero-report-foundation`'s *Build a kit report* pipeline exists to assemble a tested `dataBindings` manifest against a report config that renders Xero report **figures** (P&L, Balance Sheet, a scorecard, a chart); this page carries no such figures — it is a list of skill names, categories and descriptions that Claude already knows at generation time. Giving it a `dataBindings` manifest and the full `{{KIT}}` engine would mean declaring bindings nothing on the page reads (the foundation's mapping law: "every declared input must be consumed by some binding" cuts the other way here — there is nothing to consume). The only live Xero call this page makes is for organisation context in the header, exactly as a small, targeted binding — not the report engine.

Load `xero-report-foundation` for the connector facts and the *Rules for report skills without a kit config*, but do not follow *Build a kit report* — there is no report config or `{{KIT}}`/`{{CSS}}` assembly here, just a self-contained HTML/CSS/JS index page in the same visual system (Xero-inspired palette, dark mode via `data-myhub-theme`, tabular numerals) that the foundation's *Consistent visual system* section describes for every report.

## What it does

Call `get_organisation` once and `list_connections` once (bound the same way every other skill binds them — `organisation` input → `xero_tenant_id`, plus a `connections` binding for the picker) so the header can show which Xero organisation this catalog is being offered for. No other Xero data is read.

Build an interactive HTML index, grouped by category, with a search/filter box and one entry per report skill. Link every implemented skill by its real name so the reader can ask for it directly. Categories and entries, current as of this library:

- **Financial statements**: Profit and Loss (`xero-profit-and-loss`, kit report) · Balance Sheet (`xero-balance-sheet`, kit report) · Trial Balance (`xero-trial-balance`, kit report) · General Ledger — disclosed as scope-gated, may be unavailable on this connection (`xero-general-ledger`) · Tracking-Category Profit and Loss (`xero-tracking-category-pnl`)
- **Payables and receivables**: Aged Receivables (`xero-aged-receivables`, kit report) · Aged Payables (`xero-aged-payables`, kit report) · Sales Register / Customer Sales (`xero-sales-register`)
- **Reconciliations**: Bank Reconciliation Status — Reconciled vs Unreconciled only, no third "coded" state (`xero-bank-reconciliation-status`)
- **Taxes and balances**: Activity Statement — a GST summary, not a lodgeable BAS (`xero-activity-statement`) · GST Reconciliation Detail — same non-BAS disclosure (`xero-gst-reconciliation-detail`)
- **Cash**: Cash Summary (`xero-cash-summary`, kit report) · Cash Position (`xero-cash-position`, kit report) · Cash Flow Manager (`xero-cash-flow-manager`, kit report)
- **Dashboards / overviews**: Business Overview (`xero-business-overview`, kit report) · Sales Overview (`xero-sales-overview`, kit report) · Purchases Overview (`xero-purchases-overview`, kit report) · Performance Overview (`xero-performance-overview`, kit report) · Exceptions Dashboard (`xero-exceptions-dashboard`)
- **Planning and scoring**: Business Health Scorecard — an independently computed scorecard, not Xero's own score (`xero-business-health-scorecard`, kit report) · Budget vs Actual (`xero-budget-vs-actual`) · Month-End Task List — a checklist, not a WorkQ push (`xero-month-end-task-list`)
- **Analytics**: Visualise — Profitability / Cash / Accounts / KPIs charts, plus an honest no-data state for External data and Industry benchmarks (`xero-visualise`, kit report)
- **Library**: Reports Catalog (this skill) · Report Pack — bundles other report skills into one document, no data of its own (`xero-report-pack`)

That is all twenty-six skill files present in this plugin today (`plugins/xero-reporting-studio/skills/`, excluding the shared `xero-report-foundation`). If a future skill is added or removed, update this list from the actual directory contents — never guess or leave a stale entry, and never describe a skill this plugin doesn't actually carry.

Mark entries with no connector endpoint as such, not "coming soon": lodging an Activity Statement / BAS, a true cash-flow *statement* (as distinct from the Cash Flow Manager's short-term projection), Xero Analytics (Syft) widgets and AI insights, Xero's own Business Health Scorecard, and industry benchmarks. Say plainly that these have no data source on `xero-accounting` and are not planned as a "future update" — they would need a different connector or a different Xero product entirely.

## Validation

- Every linked entry names a skill file that actually exists in this plugin (recheck against the directory listing before publishing, not from memory)
- Every "no endpoint" entry is one confirmed absent from the foundation's *Connector facts*, not merely unbuilt
- Organisation name loaded (pass/fail on the `get_organisation` call; this is the only check on this page, since the page carries no financial figures to tie out)

## Save as

`fileName`: `xero-reports-catalog.html` · `tags`: ["xero","catalog","index","library"]
