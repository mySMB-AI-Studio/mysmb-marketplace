---
name: MYOB Custom Reports
description: Save any MYOB report with the reader's own settings (company file, period preset, basis, compare, view, display, branding) as a named live report in the Reports library — the equivalent of MYOB Custom reports (M62). Use when the user asks to customise a report and save it, "Save as", their custom reports, a report with their own default period, view, columns or display settings, or to recreate a MYOB custom report they already use.
---
# Custom Reports (M62)

Use when the user asks to customise a report and save it, "Save as", their custom reports, a report with their own default period, view, columns or display settings, or to recreate a MYOB custom report they already use. This is a **guide**: it has no page or data of its own and works through the kit reports. Load `myob-report-foundation` first.

MYOB location: Reporting → Custom reports (Customise on any report). Library: MYOB Reports Prompt Library v1.2 → Prompts → M62. Delivery: Wave 2 (P2, delivery order 40).

MYOB **custom reports** (Customise → Save as) are **not in the MYOB API**, so the agent cannot read the custom reports a file already has. Instead, any kit report can be saved with the user's own settings, and it stays live: it refetches and re-validates on every open, and a relative period ("Last month", "This financial year to date") rolls forward.

## Save a customised report ("Save as")

1. Find the base report and load `myob-reporting-studio:myob-report-foundation` and its report skill. Prefer a kit report (it has a template); a report skill that is still a written specification can only be rebuilt with the settings, not saved as a live template copy.
2. Collect the settings the user wants and map each MYOB customisation to an input:

| MYOB setting | Set in the report's inputs |
|---|---|
| Company file | `company_file` = the `Id` from `list_company_files` (empty = the connection's file) |
| Date range preset (This month, Last financial quarter, …) | the `display` preset `p` (or `a` for an as-at report) and the date inputs |
| Accounting method (Cash / Accrual) | the basis input, where the report has one |
| Compare with (previous period, last year, year to date) | `display.c` |
| Report within the family (for example Aged by due date) | `display.v` |
| Show cents, Divide by 1000, Show zero balances, Negatives in brackets, Show in red | `display.cents`, `k`, `zeros`, `neg`, `red` |
| Header and footer, compact view | `display.hdr`, `ftr`, `dens` |
| MYOB or mySMB branding, a brand colour | `display.style` (`myob` / `mysmb`), `display.b` (only when the user asks) |
| View as (persona) | `persona` |
| Columns shown, hidden or reordered (Customise → columns) | N/A — the kit reports have MYOB's fixed columns; say so, and offer the closest view |
| Filters on customer, supplier, job or account | N/A unless the report has that view; say so |

3. Create it as the foundation's *Build a kit report* says (`artifact_from_template` with only the changed inputs). `title` = "MYOB " + the user's name for the report in Title Case (for example "MYOB Monthly Board P&L"); `description` = the base report and its settings in one line, with the company file ("Profit and Loss · Last month · Accrual · compare last year · mySMB.com").
4. Tag it: on the copy path add `"custom-report"` to the report skill's tags, plus one `"group:<name>"` tag when the user names a group. With `artifact_from_template`, say in the completion note that the report is in the Reports library under its name.
5. Completion note: the name, the base report, the settings saved, and that it is live and refreshes on every open.

## The custom reports list

| MYOB | Here |
|---|---|
| Custom reports list | The Reports library (search by name, or the `custom-report` tag) |
| Open a custom report | Open the saved report; it refetches with its saved settings |
| Rename or delete | In the Reports library |
| Share | The report window's Share (a frozen snapshot) |

## Recreate an existing MYOB custom report

Ask for its name and settings, or a screenshot or export of it, map them with the table above, and confirm anything the kit cannot reproduce (columns, filters) before saving.

## Members

| Member / view | How |
|---|---|
| Save as (a customised report) | Any kit report saved with the reader's settings as a named live report |
| Custom reports list | The Reports library (name, owner, updated, sharing) |
| Column chooser and filters | N/A — kit reports keep MYOB's fixed columns |
| Existing MYOB custom reports | N/A — not in the MYOB API; recreate from the settings |

## Validation

- The saved report passes the same validation as its base report

## QA test script

1. Ask for the request this guide covers (see *Use when*). Confirm the agent saves the right kit report with the settings and says what is N/A.
2. Reopen the saved report: it opens on the saved settings, refetches and validates; its Download Excel file has the Validation and Parameters sheets.
3. Captured empty (no custom reports in the sample file) — save Profit and Loss as "Monthly board P&L" on Last month, compare last year, and confirm it reopens on the new month next month.
