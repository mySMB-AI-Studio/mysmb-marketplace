---
name: quickbooks-spreadsheet-sync
description: Get any QuickBooks Online report into Excel or Google Sheets from this agent — the equivalent of QuickBooks Spreadsheet Sync (Q05). Use when the user asks for a report in Excel or Google Sheets, Spreadsheet Sync, refreshable spreadsheets, exporting QuickBooks data to a spreadsheet, or a multi-company (consolidated) spreadsheet.
---

# Spreadsheet Sync (Excel / Google Sheets) (Q05)

Use when the user asks for a report in Excel or Google Sheets, Spreadsheet Sync, refreshable spreadsheets, exporting QuickBooks data to a spreadsheet, or a multi-company (consolidated) spreadsheet. This is a **guide**: it has no page or data of its own and works through the family reports.

QuickBooks location: Reports › Spreadsheet sync. Library: QuickBooks Reports Prompt Library v1.1 → Prompts → Q05. Delivery: Wave 4 (Feature F6).

QuickBooks **Spreadsheet Sync** is an Excel add-in for QuickBooks Online Advanced, **not an API**, so it is not available here. Every report this agent builds already has **Download Excel**, which is the replacement.

## Steps

1. Build the report the user wants with its family skill (load `quickbooks-reporting-studio:quickbooks-report-foundation` first). Never ask for an output format — the report is HTML with Download PDF and Download Excel.
2. In the completion note, point to **Download Excel** in the report and say what the file holds: one sheet per table with the report header block, A$ number format, bold totals with live SUM formulas, plus a **Validation** sheet (every check and its result) and a **Parameters** sheet (period, basis and display settings).
3. For raw lists ("all open invoices in Excel", "every transaction last month"), build the Custom report builder (`quickbooks-reporting-studio:quickbooks-custom-report-builder`) with the matching report — for example Transaction List — then Download Excel.

## Spreadsheet Sync features

| Feature | Here |
|---|---|
| Run report in Excel | Download Excel in any report |
| Run report in Google Sheets | Download Excel, then in Google Sheets use File › Import (or upload the file to Google Drive and open it with Google Sheets) |
| Refresh the spreadsheet | Open the live report (it refetches on open) and Download Excel again |
| 2-way sync and bulk edits | N/A — this is a reporting agent; it never writes to QuickBooks. Make edits in QuickBooks |
| Multi-company groups (consolidation) | N/A — one QuickBooks company per connection, and a report never mixes companies (LIB-002). Build the report for each company on its own connection and combine the Excel files outside the workspace |

## Members

| Member / view | How |
|---|---|
| Run report in Excel | Download Excel in every report (.xlsx with formulas, Validation and Parameters sheets) |
| Run report in Google Sheets | Import the downloaded .xlsx |
| 2-way sync (bulk edits) | N/A — read-only reporting |
| Multi-company groups | N/A — one company per connection |

## Validation

- The Excel file carries the report's Validation sheet

## QA test script

1. Ask for the request this guide covers (see *Use when*). Confirm the agent builds or saves the right family report and says what is N/A.
2. Confirm the saved report validates and its Download Excel file opens with the Validation and Parameters sheets.
3. Compare with QuickBooks: Feature page only (add-in) — confirm a downloaded .xlsx opens in Excel and imports into Google Sheets with totals intact.
