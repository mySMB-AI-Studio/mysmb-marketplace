---
name: quickbooks-custom-reports
description: Save any QuickBooks Online report with the reader's own settings (period preset, basis, columns, compare, view, display, branding) as a named live report in the Reports library — the equivalent of QuickBooks Custom reports (Q03). Use when the user asks to save a customised report, 'Save As' / 'Save customisations', their custom reports, a report group, or to recreate a QuickBooks custom report they already use.
---

# Custom reports (saved customisations) (Q03)

Use when the user asks to save a customised report, 'Save As' / 'Save customisations', their custom reports, a report group, or to recreate a QuickBooks custom report they already use. This is a **guide**: it has no page or data of its own and works through the family reports.

QuickBooks location: Reports › Custom reports. Library: QuickBooks Reports Prompt Library v1.1 → Prompts → Q03. Delivery: Wave 4 (Feature F6).

This replaces QuickBooks' **Custom reports** list. QuickBooks saved customisations are **not in the Accounting API**, so the agent cannot read the user's existing custom reports. Instead, every report this agent builds can be saved with the user's own settings, and it stays live: it refetches and re-validates on every open, and a relative period ("Last month", "This financial year to date") rolls forward.

## Save a customised report ("Save As")

1. Identify the base report and load `quickbooks-reporting-studio:quickbooks-report-foundation` and its family skill (the agent's routing list).
2. Collect the settings the user wants. Map each QuickBooks customisation to a control:

| QuickBooks customisation | Set in the family's dataBindings defaults |
|---|---|
| Report period (preset) | `display.p` (period) or `display.a` (as of), and the date defaults |
| Accounting method | the basis input (`Cash` / `Accrual`) |
| Display columns by | the columns input where the family has one |
| Compare to (previous period / previous year / year to date) | `display.c` |
| Report within the family (for example Aged Payables Detail) | `display.v` |
| Show cents, divide by 1000, except zero amounts, negative numbers, show in red | `display.cents`, `k`, `zeros`, `neg`, `red` |
| Header / footer, compact view | `display.hdr`, `ftr`, `dens` |
| Brand colour, house style | `display.b` (only when the user asks), `display.style` |
| Filters on customer, supplier, class, location, product | N/A unless the family has the filter; say so |
| Rows / columns the family does not have | N/A — offer the Custom report builder (`quickbooks-reporting-studio:quickbooks-custom-report-builder`) |

3. Build the report exactly as the foundation says, with the `defaults` in the config equal to the manifest defaults.
4. Save with `artifact_save`: `title` = "<Company> — <the user's name for the report>" (for example "Enterprise AI Pty Ltd — Monthly board P&L"), `description` = the base report and its settings in one line ("Profit and Loss · Last month · Accrual · compare previous year"), `tags` = the family tags + `"custom-report"` + one `"group:<name>"` tag when the user names a report group.
5. Completion note: the name, the base report, the settings saved, and that it is in the Reports library and refreshes on every open.

## The custom reports list

| QuickBooks column | Here |
|---|---|
| Report name | The saved report title in the Reports library |
| Created by / Last modified by | The Reports library owner and updated time |
| Date range | The period preset in the description; it rolls forward on open |
| Access | Workspace sharing in the Reports library |
| Email / schedule | N/A — not in the Accounting API. Use the report window's Share, or QuickBooks' own scheduled email |
| Report groups | `group:<name>` tags |

## Recreate an existing QuickBooks custom report

Ask the user for the report name and its settings, or a screenshot or export of it, and map the settings with the table above. Confirm anything the family cannot reproduce before saving.

## Change or delete

To change a saved report, rebuild it with the new settings and save it again with the same title; the user deletes the old one in the Reports library.

## Members

| Member / view | How |
|---|---|
| Saved reports (Save As / Save customisations) | Any family report saved with the user's settings as a named live report |
| Custom reports list | The Reports library (name, owner, updated, sharing) |
| Report groups | `group:<name>` tags |
| Scheduled emails | N/A — not in the Accounting API |
| Existing QuickBooks custom reports | N/A — not in the Accounting API; recreate from the settings |

## Validation

- The saved report passes the same validation as its family report

## QA test script

1. Ask for the request this guide covers (see *Use when*). Confirm the agent builds or saves the right family report and says what is N/A.
2. Confirm the saved report validates and its Download Excel file opens with the Validation and Parameters sheets.
3. Compare with QuickBooks: Captured empty (no custom reports in the sample file).
