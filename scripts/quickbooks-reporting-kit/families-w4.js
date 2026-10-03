// Wave 4 family metadata (Feature F6) — appended to families.js. Q32–Q34 (payroll) wait on an Employment Hero payroll connector.
const SLUG = 'quickbooks-reporting-studio';
module.exports = [
  { id: 'forecast', q: 'Q09', skill: 'quickbooks-forecasts', title: 'Forecasts', menu: 'Reports › Financial planning › Forecasts', wave: 'Wave 4 (Feature F6)',
    trigger: 'the user asks for a forecast, a projection, a financial forecast, what next year might look like, forecast vs actual, or a what-if with income or expenses changed by a percentage',
    discovery: '`get_report_profit_and_loss` with `summarize_column_by` = Month from the base-period start to today — expect one Money column per month (MetaData StartDate / EndDate) plus Total, and section groups Income, COGS, Expenses, OtherIncome, OtherExpenses, NetIncome',
    dates: 'Preset `last_12m` (the last 12 complete months) as the base period. Set `horizon` (3, 6, 12, 18 or 24 months) and `method` (`trend`, `average` or `seasonal`) from the request; default 12 months, `trend`. Put growth assumptions the user states in `adjust` as JSON — section keys `Income`, `COGS`, `Expenses`, `OtherIncome`, `OtherExpenses`, or `a:<account id>` — for example `{"Income":5,"Expenses":-3}` (at most 400 characters). For forecast vs actual, use `last_fy` or a custom base period that ends before today.',
    fileName: 'quickbooks-forecast.html', tags: ['quickbooks', 'forecast', 'planning'],
    note: 'A forecast is an **estimate** projected from QuickBooks actuals — QuickBooks has no forecast endpoint. The report says so in the title, the chart, the notes and the Excel file. Never present a forecast figure as a QuickBooks figure.',
    members: [['Create forecast (base period, growth assumptions)', 'Base period controls + Forecast months + Method (linear trend, average, same month last year) + Growth assumptions (section %, and account % in Bookkeeper view)'], ['Forecast grid by account × month', 'Report = Forecast'], ['Scenario columns', 'Report = Forecast scenarios (base actual · no adjustments · with adjustments · change)'], ['Forecast vs actual', 'Report = Forecast vs actual (months since the base period)'], ['Actual → forecast line with confidence band', 'Chart on every view (80% range from the base-period variation)'], ['Saved QuickBooks forecasts', 'N/A — not in the Accounting API']],
    checks: ['Base period equals actuals: net profit rebuilt from the accounts = QuickBooks Net Income (every month)', 'Monthly columns = QuickBooks total (every account)', 'Forecast net profit = income − cost of sales − expenses + other income − other expenses', 'Base period has enough history for the method'],
    golden: 'Captured empty state (no forecast saved in QuickBooks) — compare the base-period months with the Profit and Loss by month for the same dates.' },
  { id: 'employees-time', q: 'Q31', skill: 'quickbooks-employees-and-time', title: 'Employees and time family', menu: 'Reports › Standard reports › Employees / Payroll · Time', wave: 'Wave 4 (Feature F6)',
    trigger: 'the user asks for time activities, timesheets, hours by employee, billable hours, recent or edited time entries, time by pay type, or the employee contact list',
    discovery: "`list_time_activity` (latest 1,000 by date) — expect `QueryResponse.TimeActivity[]` with TxnDate, NameOf (Employee | Vendor), EmployeeRef / VendorRef, CustomerRef, ItemRef, BillableStatus, HourlyRate, Hours + Minutes (or StartTime / EndTime + breaks); `list_employee` (active). QuickBooks returns full records (it does not accept field lists in queries): the report shows only contact fields and hours, but a downloaded or shared snapshot carries what QuickBooks returned, so say so when the user shares it",
    dates: 'Preset `this_month`. Time has no accounting basis.',
    fileName: 'quickbooks-time-activities.html', tags: ['quickbooks', 'time', 'employees'],
    members: [['Time Activities by Employee Detail', 'Employee | Date | Customer | Product/Service | Description | Rate | Duration | Billable | Amount, "Total for" each employee'], ['Timesheet Detail', 'Report = Timesheet Detail (start, end, break, duration)'], ['Recent/Edited Time Activities', 'Report = Recent/Edited — created or last modified in the period'], ['Time Summary by Pay Type', 'Report = Time Summary by Pay Type — N/A unless QuickBooks Payroll pay types are on the time activities (AU payroll is in Employment Hero)'], ['Employee Contact List', 'Report = Employee Contact List (phone, mobile, email, address, employee ID — active employees)'], ['Employee filter', 'Employee picker above the report']],
    checks: ['Σ hours per employee = total hours', 'Billable + non-billable hours = total hours', 'Every time activity names an employee or supplier', 'All time activities in the period were loaded (latest 1,000)'],
    golden: 'Layout per QBO documentation: Employee | Date | Customer | Product/Service | Duration | Billable.' },
  { id: 'custom-reports', q: 'Q03', skill: 'quickbooks-custom-reports', title: 'Custom reports (saved customisations)', menu: 'Reports › Custom reports', wave: 'Wave 4 (Feature F6)', static: 'doc',
    trigger: "the user asks to save a customised report, 'Save As' / 'Save customisations', their custom reports, a report group, or to recreate a QuickBooks custom report they already use",
    description: 'Save any QuickBooks Online report with the reader\'s own settings (period preset, basis, columns, compare, view, display, branding) as a named live report in the Reports library — the equivalent of QuickBooks Custom reports (Q03)',
    checks: ['The saved report passes the same validation as its family report'],
    body: `This replaces QuickBooks' **Custom reports** list. QuickBooks saved customisations are **not in the Accounting API**, so the agent cannot read the user's existing custom reports. Instead, every report this agent builds can be saved with the user's own settings, and it stays live: it refetches and re-validates on every open, and a relative period ("Last month", "This financial year to date") rolls forward.

## Save a customised report ("Save As")

1. Identify the base report and load \`${SLUG}:quickbooks-report-foundation\` and its family skill (the agent's routing list).
2. Collect the settings the user wants. Map each QuickBooks customisation to a control:

| QuickBooks customisation | Set in the family's dataBindings defaults |
|---|---|
| Report period (preset) | \`display.p\` (period) or \`display.a\` (as of), and the date defaults |
| Accounting method | the basis input (\`Cash\` / \`Accrual\`) |
| Display columns by | the columns input where the family has one |
| Compare to (previous period / previous year / year to date) | \`display.c\` |
| Report within the family (for example Aged Payables Detail) | \`display.v\` |
| Show cents, divide by 1000, except zero amounts, negative numbers, show in red | \`display.cents\`, \`k\`, \`zeros\`, \`neg\`, \`red\` |
| Header / footer, compact view | \`display.hdr\`, \`ftr\`, \`dens\` |
| Brand colour, house style | \`display.b\` (only when the user asks), \`display.style\` |
| Filters on customer, supplier, class, location, product | N/A unless the family has the filter; say so |
| Rows / columns the family does not have | N/A — offer the Custom report builder (\`${SLUG}:quickbooks-custom-report-builder\`) |

3. Build the report exactly as the foundation says, with the \`defaults\` in the config equal to the manifest defaults.
4. Save with \`artifact_save\`: \`title\` = "<Company> — <the user's name for the report>" (for example "Enterprise AI Pty Ltd — Monthly board P&L"), \`description\` = the base report and its settings in one line ("Profit and Loss · Last month · Accrual · compare previous year"), \`tags\` = the family tags + \`"custom-report"\` + one \`"group:<name>"\` tag when the user names a report group.
5. Completion note: the name, the base report, the settings saved, and that it is in the Reports library and refreshes on every open.

## The custom reports list

| QuickBooks column | Here |
|---|---|
| Report name | The saved report title in the Reports library |
| Created by / Last modified by | The Reports library owner and updated time |
| Date range | The period preset in the description; it rolls forward on open |
| Access | Workspace sharing in the Reports library |
| Email / schedule | N/A — not in the Accounting API. Use the report window's Share, or QuickBooks' own scheduled email |
| Report groups | \`group:<name>\` tags |

## Recreate an existing QuickBooks custom report

Ask the user for the report name and its settings, or a screenshot or export of it, and map the settings with the table above. Confirm anything the family cannot reproduce before saving.

## Change or delete

To change a saved report, rebuild it with the new settings and save it again with the same title; the user deletes the old one in the Reports library.`,
    members: [['Saved reports (Save As / Save customisations)', 'Any family report saved with the user\'s settings as a named live report'], ['Custom reports list', 'The Reports library (name, owner, updated, sharing)'], ['Report groups', '`group:<name>` tags'], ['Scheduled emails', 'N/A — not in the Accounting API'], ['Existing QuickBooks custom reports', 'N/A — not in the Accounting API; recreate from the settings']],
    golden: 'Captured empty (no custom reports in the sample file).' },
  { id: 'spreadsheet-sync', q: 'Q05', skill: 'quickbooks-spreadsheet-sync', title: 'Spreadsheet Sync (Excel / Google Sheets)', menu: 'Reports › Spreadsheet sync', wave: 'Wave 4 (Feature F6)', static: 'doc',
    trigger: 'the user asks for a report in Excel or Google Sheets, Spreadsheet Sync, refreshable spreadsheets, exporting QuickBooks data to a spreadsheet, or a multi-company (consolidated) spreadsheet',
    description: 'Get any QuickBooks Online report into Excel or Google Sheets from this agent — the equivalent of QuickBooks Spreadsheet Sync (Q05)',
    checks: ['The Excel file carries the report\'s Validation sheet'],
    body: `QuickBooks **Spreadsheet Sync** is an Excel add-in for QuickBooks Online Advanced, **not an API**, so it is not available here. Every report this agent builds already has **Download Excel**, which is the replacement.

## Steps

1. Build the report the user wants with its family skill (load \`${SLUG}:quickbooks-report-foundation\` first). Never ask for an output format — the report is HTML with Download PDF and Download Excel.
2. In the completion note, point to **Download Excel** in the report and say what the file holds: one sheet per table with the report header block, A$ number format, bold totals with live SUM formulas, plus a **Validation** sheet (every check and its result) and a **Parameters** sheet (period, basis and display settings).
3. For raw lists ("all open invoices in Excel", "every transaction last month"), build the Custom report builder (\`${SLUG}:quickbooks-custom-report-builder\`) with the matching report — for example Transaction List — then Download Excel.

## Spreadsheet Sync features

| Feature | Here |
|---|---|
| Run report in Excel | Download Excel in any report |
| Run report in Google Sheets | Download Excel, then in Google Sheets use File › Import (or upload the file to Google Drive and open it with Google Sheets) |
| Refresh the spreadsheet | Open the live report (it refetches on open) and Download Excel again |
| 2-way sync and bulk edits | N/A — this is a reporting agent; it never writes to QuickBooks. Make edits in QuickBooks |
| Multi-company groups (consolidation) | N/A — one QuickBooks company per connection, and a report never mixes companies (LIB-002). Build the report for each company on its own connection and combine the Excel files outside the workspace |`,
    members: [['Run report in Excel', 'Download Excel in every report (.xlsx with formulas, Validation and Parameters sheets)'], ['Run report in Google Sheets', 'Import the downloaded .xlsx'], ['2-way sync (bulk edits)', 'N/A — read-only reporting'], ['Multi-company groups', 'N/A — one company per connection']],
    golden: 'Feature page only (add-in) — confirm a downloaded .xlsx opens in Excel and imports into Google Sheets with totals intact.' }
];
