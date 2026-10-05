// MYOB library reports that are not kit reports: a guide (M62 custom reports) and two pages built from the MYOB export the user
// attaches (M13 journal security audit, M31 workers compensation — not in MYOB's API). gen-myob.js writes their skills (new
// names, so myob-…) and adds them to the agent; the export pages are reports/<page>.template.html with the stylesheet filled in.
const SLUG = 'myob-reporting-studio';
module.exports = [
  {
    m: 'M62', skill: 'myob-custom-reports', type: 'guide', name: 'MYOB Custom Reports', title: 'Custom Reports', wave: 'Wave 2 (P2, delivery order 40)',
    menu: 'Reporting → Custom reports (Customise on any report)',
    trigger: 'the user asks to customise a report and save it, "Save as", their custom reports, a report with their own default period, view, columns or display settings, or to recreate a MYOB custom report they already use',
    description: 'Save any MYOB report with the reader\'s own settings (company file, period preset, basis, compare, view, display, branding) as a named live report in the Reports library — the equivalent of MYOB Custom reports (M62)',
    body: `MYOB **custom reports** (Customise → Save as) are **not in the MYOB API**, so the agent cannot read the custom reports a file already has. Instead, any kit report can be saved with the user's own settings, and it stays live: it refetches and re-validates on every open, and a relative period ("Last month", "This financial year to date") rolls forward.

## Save a customised report ("Save as")

1. Find the base report and load \`${SLUG}:myob-report-foundation\` and its report skill. Prefer a kit report (it has a template); a report skill that is still a written specification can only be rebuilt with the settings, not saved as a live template copy.
2. Collect the settings the user wants and map each MYOB customisation to an input:

| MYOB setting | Set in the report's inputs |
|---|---|
| Company file | \`company_file\` = the \`Id\` from \`list_company_files\` (empty = the connection's file) |
| Date range preset (This month, Last financial quarter, …) | the \`display\` preset \`p\` (or \`a\` for an as-at report) and the date inputs |
| Accounting method (Cash / Accrual) | the basis input, where the report has one |
| Compare with (previous period, last year, year to date) | \`display.c\` |
| Report within the family (for example Aged by due date) | \`display.v\` |
| Show cents, Divide by 1000, Show zero balances, Negatives in brackets, Show in red | \`display.cents\`, \`k\`, \`zeros\`, \`neg\`, \`red\` |
| Header and footer, compact view | \`display.hdr\`, \`ftr\`, \`dens\` |
| MYOB or mySMB branding, a brand colour | \`display.style\` (\`myob\` / \`mysmb\`), \`display.b\` (only when the user asks) |
| View as (persona) | \`persona\` |
| Columns shown, hidden or reordered (Customise → columns) | N/A — the kit reports have MYOB's fixed columns; say so, and offer the closest view |
| Filters on customer, supplier, job or account | N/A unless the report has that view; say so |

3. Create it as the foundation's *Build a kit report* says (\`artifact_from_template\` with only the changed inputs). \`title\` = "MYOB " + the user's name for the report in Title Case (for example "MYOB Monthly Board P&L"); \`description\` = the base report and its settings in one line, with the company file ("Profit and Loss · Last month · Accrual · compare last year · mySMB.com").
4. Tag it: on the copy path add \`"custom-report"\` to the report skill's tags, plus one \`"group:<name>"\` tag when the user names a group. With \`artifact_from_template\`, say in the completion note that the report is in the Reports library under its name.
5. Completion note: the name, the base report, the settings saved, and that it is live and refreshes on every open.

## The custom reports list

| MYOB | Here |
|---|---|
| Custom reports list | The Reports library (search by name, or the \`custom-report\` tag) |
| Open a custom report | Open the saved report; it refetches with its saved settings |
| Rename or delete | In the Reports library |
| Share | The report window's Share (a frozen snapshot) |

## Recreate an existing MYOB custom report

Ask for its name and settings, or a screenshot or export of it, map them with the table above, and confirm anything the kit cannot reproduce (columns, filters) before saving.`,
    members: [['Save as (a customised report)', 'Any kit report saved with the reader\'s settings as a named live report'], ['Custom reports list', 'The Reports library (name, owner, updated, sharing)'], ['Column chooser and filters', 'N/A — kit reports keep MYOB\'s fixed columns'], ['Existing MYOB custom reports', 'N/A — not in the MYOB API; recreate from the settings']],
    checks: ['The saved report passes the same validation as its base report'],
    golden: 'Captured empty (no custom reports in the sample file) — save Profit and Loss as "Monthly board P&L" on Last month, compare last year, and confirm it reopens on the new month next month.',
  },
  {
    m: 'M13', skill: 'myob-journal-security-audit', type: 'export', page: 'journal-audit', name: 'MYOB Journal Security Audit', title: 'Journal Security Audit', wave: 'Wave 2 (P2, delivery order 37)',
    menu: 'Reporting → Reports → Business → Journal security audit',
    trigger: 'the user asks for the journal security audit, who changed or deleted transactions, an audit trail, changes to transactions, or edits to a locked or prior period',
    description: 'MYOB Journal Security Audit (M13) from the MYOB export the user attaches — who added, changed or deleted which transactions, with prior-period changes flagged',
    exportPath: 'MYOB › Reporting › Reports › Business › Journal security audit › set Session date and Transaction date › Export › Excel',
    rows: 'For each row take: `actionDate` (Action date, ISO `YYYY-MM-DD HH:MM` when unambiguous), `user`, `action` (Added / Changed / Deleted / Reversed …, as written), `type` (transaction type), `txnDate` (Transaction date, `YYYY-MM-DD`), `memo`, `ref` (ID / reference, when present), `debit` and `credit` (numbers, or null)',
    dataShape: '{"company": …, "period": "Session date: <d Month yyyy> - <d Month yyyy>", "lockDate": "YYYY-MM-DD" or null (only if the user gives the file\'s lock date), "fileName": "<attached file name>", "rows": [ … ]}',
    members: [['Journal security audit', 'Every row of the export: action date, user, action, type, transaction date, memo, debit, credit'], ['Counts by user and by action', 'Tiles above the table and a bar chart of changes by user'], ['Prior-period changes', 'A change or deletion of a transaction dated before the month it was changed in (or on or before the lock date, when given) is flagged'], ['Filters', 'User, action, transaction type, search and action date from / to'], ['Live data', 'N/A — MYOB\'s API does not expose the journal security audit']],
    checks: ['Counts by action sum to the rows shown', 'Every row has an action date, a user and an action'],
    golden: 'Captured empty for the default period in the sample file — export a month with changes from the golden-set file and confirm every row appears once and the counts add up.',
  },
  {
    m: 'M31', skill: 'myob-workers-compensation', type: 'export', page: 'workers-comp', name: 'MYOB Workers Compensation', title: 'Workers Compensation', wave: 'Wave 3 (P3, delivery order 52)',
    menu: 'Reporting → Reports → Payroll → Workers compensation (New) → Estimation of wages',
    trigger: 'the user asks for workers compensation, the estimation of wages, estimated remuneration by state, or wages for a workers compensation policy or renewal',
    description: 'MYOB Workers Compensation — Estimation of wages (M31) from the MYOB export the user attaches: estimated remuneration by state for a policy or renewal',
    exportPath: 'MYOB › Reporting › Reports › Payroll › Workers compensation › open the estimation › Export (if MYOB offers it; otherwise a screenshot or the printed estimation)',
    rows: 'One entry per estimation: `period` (Estimation period as written), `created` (Date created, `YYYY-MM-DD`), `states` = `[{"state": "NSW", "remuneration": number, "employees": number or null}]`, `total` (Total estimated remuneration, a number), and `employees` = `[{"name", "state", "remuneration"}]` only when the export lists employees. Pay figures may be shown; **never include tax file numbers, bank details, dates of birth, addresses or contact details**',
    dataShape: '{"company": …, "fileName": "<attached file name>", "estimations": [ … ]}',
    members: [['Estimation of wages', 'Each estimation: period, date created, states, total estimated remuneration'], ['Remuneration by state', 'Table and bar chart per estimation'], ['Employees', 'Per employee and state, when the export lists them'], ['New estimation', 'N/A — an action in MYOB, not a report'], ['Live data', 'N/A — MYOB\'s API does not expose workers compensation estimations']],
    checks: ['Σ states = total estimated remuneration (every estimation)', 'Σ employees = their state\'s remuneration (when employees are listed)'],
    golden: 'Captured empty in the sample file ("No estimation reports created yet") — create an estimation in the golden-set file, export it and confirm the state totals add up to MYOB\'s total.',
  },
];
