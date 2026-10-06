// MYOB Reports Prompt Library v1.2 families built on the tested kit. Each writes skills/<skill>.md (existing file stems, so the
// agent blueprint's skill ids do not change). Reports not listed here keep their prose skills.
module.exports = [
  {
    m: 'M04', skill: 'profit-and-loss', name: 'MYOB Profit and Loss', report: 'pnl', wave: 'Wave 1 (P1, delivery order 1)',
    title: 'Profit and Loss', menu: 'Reporting → Reports → Business → Profit and loss',
    trigger: 'the user asks for a profit and loss, P&L, income statement, trading statement, net profit, income and expenses for a period, or a P&L comparison with last year',
    discovery: 'Call `get_profit_and_loss_3m` once with `from_date` = the financial-year start, `to_date` = today and `reporting_basis` = `Accrual`, and call `list_company_files` once. Expect `{StartDate, EndDate, ReportingBasis, AccountsBreakdown:[{Account:{UID,Name,DisplayID}, AccountTotal}]}` — one total per account and **no section totals** (the kit classifies each account with `list_accounts` and adds them up). An empty `AccountsBreakdown` means no activity, not an error. `{"__error": …}` is a failed call',
    dates: '`from_date` = start of the period asked for (default: financial-year start, e.g. `2026-07-01`); `to_date` = end of the period (default `"today"`). Set the display preset `p` to match (`this_fy_td` by default; `this_month`, `last_month`, `this_quarter`, `last_quarter`, `last_fy` or `custom`). Comparison dates are set by the kit from the Compare to control; leave their defaults.',
    members: [['Profit and loss', 'Report = Profit and Loss (default)'], ['Profit and loss as % of income', 'Report = P&L as % of income'], ['Profit and loss comparison', 'Compare to = Previous period / Previous year / Year to date (adds comparison, $ change and % change columns)'], ['Cash basis', 'Accounting method = Cash'], ['Breakdown by month / category / job', 'N/A — the MYOB API P&L summary returns one total per account (say so; offer the total view)']],
    checks: ['Every account on the P&L is classified (Income, Cost of Sales, Expense, Other Income, Other Expense from the chart of accounts)', 'Section totals = Σ their accounts', 'Gross Profit = Income − Cost of Sales; Net Profit = Gross Profit − Expenses + Other Income − Other Expenses', '**Independent tie:** for a financial-year-to-date range, Net Profit = Current Year Earnings on the Balance Sheet at the end date (a separate MYOB report); other ranges show this as information', 'Comparison period loaded (when Compare to is on)'],
    golden: 'mySMB.com, 1 Jul – 9 Sep 2026 accrual: Sales / Total income / Gross profit 2,115.43; Electricity & Gas 290.91; Office Supplies 132.27; Telephone & Internet 81.77; Total expenses 504.95; Net profit 1,610.48; last year 0.00. Live on 28 Sep 2026 (FY to date): Income 4,317.25, Expenses 2,134.49, Net profit 2,182.76',
    fileName: 'myob-profit-and-loss.html', tags: ['myob', 'profit-and-loss', 'M04', 'financial-statement'],
  },
  {
    m: 'M02', skill: 'balance-sheet', name: 'MYOB Balance Sheet', report: 'bs', wave: 'Wave 1 (P1, delivery order 2)',
    title: 'Balance Sheet', menu: 'Reporting → Reports → Business → Balance sheet',
    trigger: 'the user asks for a balance sheet, statement of financial position, net assets, assets and liabilities as at a date, or a balance sheet comparison',
    discovery: 'Call `get_balance_sheet` once with `date` = today and `reporting_basis` = `Accrual`, and call `list_company_files` once. Expect `{AsOfDate, AccountsBreakdown:[{Account:{UID,Name,DisplayID}, AccountTotal}]}` — no totals; values are positive in each account\'s normal balance (an overdrawn bank is negative). The Equity section includes MYOB\'s Current Year Earnings account (this year\'s profit to date). `{"__error": …}` is a failed call',
    dates: '`as_at` = the balance date asked for (default `"today"`); set the display preset `a` to `today`, `end_last_month`, `end_last_quarter`, `end_last_fy` or `custom` to match. `fy_start` is derived by the kit from `as_at` — leave its default. `compare_as_at` is set by the Compare to control.',
    members: [['Balance sheet', 'Report = Balance Sheet (default)'], ['Balance sheet summary', 'Report = Summary (totals only)'], ['Comparison with last year / last month end', 'Compare to = Previous year / Previous month end'], ['Category levels 1–4, Consolidate', 'N/A — the MYOB API returns account totals only (header groupings are not reported); one company file per report']],
    checks: ["Total Assets = Total Liabilities + Total Equity. If they differ by exactly last financial year's net profit (a file not yet rolled over — MYOB's account summary then omits it), the report adds a computed equity line \"Prior year earnings not yet closed to Retained Earnings\" and an information line to roll over the year; any other difference fails and shows last year's profit for diagnosis", 'Every account on the Balance Sheet is classified', 'Section totals = Σ their accounts', '**Independent tie:** Current Year Earnings = P&L Net Profit from the financial-year start to the as-at date (a separate MYOB report)', 'Comparison date loaded (when Compare to is on)'],
    golden: 'mySMB.com as at 9 Sep 2026: Bank (555.45); Accounts receivable 2,326.96; Total assets 1,771.51; GST 161.03; Total liabilities 161.03; Net assets / Current year earnings / Total equity 1,610.48. Live on 28 Sep 2026: Total assets 3,896.01 (receivables 4,328.96, bank (432.95)), Total liabilities 1,713.25, Total equity 2,182.76',
    fileName: 'myob-balance-sheet.html', tags: ['myob', 'balance-sheet', 'M02', 'financial-statement'],
  },
  {
    m: 'M03', skill: 'trial-balance', name: 'MYOB Trial Balance', report: 'tb', wave: 'Wave 1 (P1, delivery order 12)',
    title: 'Trial Balance', menu: 'Reporting → Reports → Business → Trial balance',
    trigger: 'the user asks for a trial balance, TB, debits and credits by account, or every category\'s balance as at a date',
    discovery: 'Call `get_balance_sheet` once with `date` = today and `reporting_basis` = `Accrual`, and `list_company_files` once. MYOB\'s API has no trial balance report: the report takes balance-sheet accounts from the Balance Sheet at the date and income and expense accounts from the Profit and Loss for the financial year to that date. A `{"__error": …}` result is a failed call: report its message',
    dates: '`as_at` = the balance date (default `"today"`; display preset `a` = `today`, `end_last_month`, `end_last_quarter`, `end_last_fy` or `custom`). `fy_start` and `prev_fy_start` are derived by the kit — leave them. For a cash-basis request set `basis` to `Cash`. The view is display `v` (`tb` | `class` | `list`).',
    members: [['Trial balance', 'Every category with its debit or credit balance as at the date (balance-sheet categories at the date, income and expense year to date)'], ['By classification', 'Report = By classification (debit and credit totals per classification)'], ['Categories list', 'Report = Categories list (the whole chart of accounts — also its own template, MYOB Categories List)'], ['Activity columns for a date range', 'See the General ledger (MYOB\'s trial balance activity detail is not in the API)']],
    checks: ['Total debits = total credits (balance-sheet accounts at the date + income and expense accounts year to date — two MYOB reports); last financial year\'s profit not yet closed is shown as its own line when it is exactly the difference', '**Independent tie:** Current Year Earnings on the Balance Sheet = net profit for the financial year to date', 'Every account is classified (chart of accounts)'],
    golden: 'mySMB.com, September 2026: 1-1110 Business Bank Account #1 credit 555.45 · 1-1200 Accounts Receivable debit 2,326.96 · GST credit 161.03 · 4-1400 Sales credit 2,115.43 · 6-1430 Electricity & Gas 290.91; debits = credits',
    fileName: 'myob-trial-balance.html', tags: ['myob', 'trial-balance', 'M03', 'financial-statement'],
  },
  {
    "m": "M10",
    "skill": "categories-list",
    "name": "MYOB Categories List",
    "report": "cl",
    "wave": "Wave 2 (P2)",
    "title": "Categories List",
    "menu": "Reporting → Reports → Business → Categories list",
    "trigger": "the user asks for the categories list, chart of accounts, list of accounts or categories with their balances, or account types",
    "discovery": "Call `list_accounts` once and `get_balance_sheet` once with `date` = today, and `list_company_files` once. `list_accounts` gives the chart (DisplayID, Name, Classification, Type, IsHeader, IsActive, Level) and each account's current balance today; balances at another date come from the Balance Sheet (balance-sheet categories) and the Profit and Loss for the financial year to the date (income and expense categories), as the Trial Balance does",
    "dates": "`as_at` = the balance date (default `\"today\"`; display preset `a`). `fy_start` and `prev_fy_start` are derived by the kit — leave them. The view is display `v` (`list` by default; the Trial Balance views are there too); `zeros` = 1 shows zero-balance categories (default on).",
    "members": [
      [
        "Categories list",
        "Every category in MYOB's order by classification: header categories as labels, account no., name, type, inactive marked, balance at the date, current balance today, a total per classification"
      ],
      [
        "Balances at a date",
        "As at control (balance-sheet categories from the Balance Sheet, income and expense year to date from the P&L)"
      ],
      [
        "Show zero balances",
        "Customise → Except zero amounts"
      ]
    ],
    "checks": [
      "Total debits = total credits (as the Trial Balance)",
      "**Independent tie:** Current Year Earnings on the Balance Sheet = net profit for the financial year to date",
      "**Independent tie (today):** balance-sheet categories' current balance (list_accounts) = the Balance Sheet today",
      "Every account is classified (chart of accounts)"
    ],
    "golden": "mySMB.com as at 28 Sep 2026: every category in the chart; 1-1110 Business Bank Account #1 and 1-1200 Accounts Receivable equal the Balance Sheet",
    "fileName": "myob-categories-list.html",
    "tags": [
      "myob",
      "categories-list",
      "M10",
      "chart-of-accounts"
    ]
  },
  {
    m: 'M32', skill: 'unpaid-invoices', name: 'MYOB Unpaid Invoices', report: 'ar', wave: 'Wave 1 (P1, delivery order 4)',
    title: 'Unpaid Invoices', menu: 'Reporting → Reports → Sales → Unpaid invoices',
    trigger: 'the user asks for unpaid invoices, who owes them money, outstanding sales invoices, a chase list, or receivables by customer with ageing',
    discovery: 'Call `list_invoices` once with `status` = `Open`, and `list_company_files` once. Expect `{Count, Items:[{Number, Date, Customer{Name, DisplayID, UID}, BalanceDueAmount, TotalAmount, TotalTax, Terms{DueDate}, Status}]}`. A `{"__error": …}` result is a failed call: report its message',
    dates: 'Always as at today — MYOB\'s API gives today\'s open balances (the kit sets `as_at`; leave it). The ageing method is `method` (`Invoice date` — MYOB\'s default — or `Due date`). The view is display `v` (`customers` | `invoices`).',
    members: [['Unpaid invoices', 'Customer name | Customer number | 0 - 30 | 31 - 60 | 61 - 90 | 90+ | Total due, one row per customer, totals row'], ['Invoices', 'Report = Invoices (each open invoice with its age)'], ['Ageing by due date', 'Ageing method = Days since due date (adds a Not due column)'], ['As at an earlier date', 'N/A — MYOB\'s API gives today\'s open balances']],
    checks: ['Each customer\'s total due = Σ its age buckets, and the report total = Σ the invoices', '**Independent tie:** total due = the receivables account (type Accounts Receivable) on the Balance Sheet', 'Every unpaid invoice has a customer (and a due date when ageing by due date)'],
    golden: 'mySMB.com as at 9 Sep 2026 (days since invoice date): Daniel Lee 45.00 | 0.00 | 1,375.00 | 0.00 | 1,420.00 · Michael Thompson 534.75 · Sarah Mitchell 185.00 · Total 2,326.96 = the receivables account',
    fileName: 'myob-unpaid-invoices.html', tags: ['myob', 'unpaid-invoices', 'M32', 'receivables'],
  },
  {
    m: 'M32', skill: 'aged-receivables', name: 'MYOB Aged Receivables', report: 'ag', wave: 'Wave 1 (P1 — the unpaid invoices report aged by due date)',
    title: 'Aged Receivables', menu: 'Reporting → Reports → Sales → Unpaid invoices (ageing by due date)',
    trigger: 'the user asks for aged receivables, aged debtors, an ageing of what customers owe, or overdue invoices by age',
    discovery: 'Call `list_invoices` once with `status` = `Open`, and `list_company_files` once. A `{"__error": …}` result is a failed call: report its message',
    dates: 'Always as at today — MYOB\'s API gives today\'s open balances. Ageing is by due date (`method` = `Due date`; set `Invoice date` for MYOB\'s default). The view is display `v` (`customers` | `invoices`).',
    members: [['Aged receivables', 'Customer | Not due | 1 - 30 | 31 - 60 | 61 - 90 | 90+ | Total due'], ['Invoices', 'Report = Invoices'], ['Ageing by invoice date', 'Ageing method = Days since invoice date']],
    checks: ['Each customer\'s total due = Σ its age buckets', '**Independent tie:** total due = the receivables account on the Balance Sheet', 'Every unpaid invoice has a customer and a due date'],
    golden: 'mySMB.com as at 9 Sep 2026: total 2,326.96 = the receivables account; overdue by due date as on the MYOB dashboard',
    fileName: 'myob-aged-receivables.html', tags: ['myob', 'aged-receivables', 'receivables', 'ageing'],
  },
  {
    m: 'M33, M34', skill: 'receivables-reconciliation', name: 'MYOB Receivables Reconciliation', report: 'rr', wave: 'Wave 1 (P1, delivery order 5; M34 P2)',
    title: 'Receivables Reconciliation', menu: 'Reporting → Reports → Sales → Receivables reconciliation with tax / Receivables reconciliation exceptions',
    trigger: 'the user asks for a receivables reconciliation, to reconcile debtors or accounts receivable, whether the customer balances match the receivables account, or receivables exceptions',
    discovery: 'Call `list_invoices` once with `status` = `Open`, and `get_balance_sheet` once with `date` = today, and `list_company_files` once. A `{"__error": …}` result is a failed call: report its message',
    dates: 'Always as at today (MYOB\'s API gives today\'s open balances; the kit sets `as_at`). Reconciliation with tax (M33) or exceptions (M34) is display `v` (`recon` | `exceptions`).',
    members: [['Receivables reconciliation with tax (M33)', 'Name | Amount outstanding | Tax outstanding per customer; Total; Receivables account; Out of balance amount'], ['Receivables reconciliation exceptions (M34)', 'Report = Reconciliation exceptions (the tie-out and its possible causes)'], ['As at an earlier date', 'N/A — MYOB\'s API gives today\'s open balances']],
    checks: ['**Independent tie:** total outstanding − the receivables account (Balance Sheet) = out of balance amount, 0.00 expected', 'Tax outstanding = each invoice\'s tax pro rata to what is still owed', 'Each invoice: subtotal + tax = total'],
    golden: 'mySMB.com as at 9 Sep 2026: Daniel Lee 1,420.00 / 129.09 · Michael Thompson 534.75 / 48.61 · Total 2,326.96 / 211.53 · Receivables account 2,326.96 · Out of balance 0.00',
    fileName: 'myob-receivables-reconciliation.html', tags: ['myob', 'receivables', 'reconciliation', 'M33', 'M34'],
  },
  {
    m: 'M38', skill: 'sales-register', name: 'MYOB Sales Register', report: 'sr', wave: 'Wave 1 (P1, delivery order 10)',
    title: 'Sales Register', menu: 'Reporting → Reports → Sales → Sales register',
    trigger: 'the user asks for a sales register, a list of sales invoices for a period, or invoices by status',
    discovery: 'Call `list_invoices` once with `status` = `All`, `from_date` / `to_date` = the period, and `list_company_files` once. A `{"__error": …}` result is a failed call: report its message',
    dates: '`from_date` / `to_date` = the period (default: the financial year to date; display preset `p` = `this_fy_td`, `this_month`, `last_month`, `this_quarter`, `last_quarter`, `last_fy` or `custom`). `status` = `All`, `Open` or `Closed`. `as_at` is set by the kit. The view is display `v` (`register` | `customers`).',
    members: [['Sales register', 'Date | Invoice No. | Customer PO No. | Customer name | Total amount | Amount due | Status, totals row'], ['Customer sales', 'Report = Customer sales (M35)'], ['Quotes and orders', 'N/A — the connector reads invoices only']],
    checks: ['**Independent tie:** Σ sale amount (ex tax) = Income on the Profit and Loss for the period', 'Σ amount due = the receivables account on the Balance Sheet (when every open invoice is in the period; information otherwise)', 'Counts by status add up to the invoices listed'],
    golden: 'mySMB.com 1 Jul – 9 Sep 2026: 12 invoices, all Open (INV00000011 01/07/2026 Daniel Lee 1,375.00 · INV00000012 20/07/2026 Michael Thompson 528.00 …) · Total 2,326.96 / 2,326.96',
    fileName: 'myob-sales-register.html', tags: ['myob', 'sales-register', 'M38', 'sales'],
  },
  {
    "m": "M37",
    "skill": "customer-transactions",
    "name": "MYOB Customer Transactions",
    "report": "tr",
    "wave": "Wave 2 (P2)",
    "title": "Customer Transactions",
    "menu": "Reporting → Reports → Sales → Customer transactions",
    "trigger": "the user asks for customer transactions, a customer history or activity, invoices and payments for a customer, or all sales transactions in a period",
    "discovery": "Call `list_invoices` once with `status` = `All` and `from_date` / `to_date` = the period, `list_payments` once for the same dates (`page_size` 1000), and `list_company_files` once. Credit notes come back as negative invoices. A `{\"__error\": …}` result is a failed call: report its message",
    "dates": "`from_date` / `to_date` = the period (default: this month; display preset `p`). `prev_day` is derived by the kit — leave it. The view is display `v` (`customers` | `list`); `x` = a customer UID to open on one customer.",
    "members": [
      [
        "Customer transactions",
        "Per customer: every invoice, credit note and payment in date order, with charges, payments and a running net change, and a total per customer"
      ],
      [
        "All transactions",
        "Report = All transactions (one list in date order)"
      ],
      [
        "Customer picker",
        "Customer select above the report"
      ],
      [
        "Credit applications, refunds, adjustments",
        "N/A — not in the connector"
      ]
    ],
    "checks": [
      "**Independent tie:** invoices − payments = the movement of Accounts Receivable on the Balance Sheet (the day before the period and its end)",
      "Every transaction names a customer",
      "All payments in the period were loaded (one page of 1,000; a warning when it is full)"
    ],
    "golden": "mySMB.com September 2026: invoices − payments = the change in Accounts Receivable between 31 August and 28 September",
    "fileName": "myob-customer-transactions.html",
    "tags": [
      "myob",
      "customer-transactions",
      "M37",
      "sales"
    ]
  },
  {
    m: 'M35', skill: 'customer-sales', name: 'MYOB Customer Sales', report: 'cs', wave: 'Wave 1 (P1, delivery order 11)',
    title: 'Customer Sales', menu: 'Reporting → Reports → Sales → Customer sales',
    trigger: 'the user asks for customer sales, sales by customer, top customers, or how much each customer bought in a period',
    discovery: 'Call `list_invoices` once with `status` = `All`, `from_date` / `to_date` = the period, and `list_company_files` once. A `{"__error": …}` result is a failed call: report its message',
    dates: '`from_date` / `to_date` = the period (default: the financial year to date; display preset `p` as for the Sales register). `status` = `All`, `Open` or `Closed`. The view is display `v` (`customers` | `register`).',
    members: [['Customer sales', 'Customer name | Customer number | Sale amount | Tax | Current balance, totals row, top-10 chart and the largest customer\'s share'], ['Sales register', 'Report = Sales register (M38)'], ['Customer sales (detail, M36)', 'Not yet — invoice lines are not confirmed in the connector\'s invoice list']],
    checks: ['**Independent tie:** Σ sale amount (ex tax) = Income on the Profit and Loss for the period', 'Every customer\'s current balance adds up to the receivables account on the Balance Sheet', 'Counts by status add up to the invoices listed'],
    golden: 'mySMB.com 1 Jul – 9 Sep 2026: Daniel Lee 1,290.91 / 129.09 / 1,420.00 · Michael Thompson 486.14 / 48.61 / 534.75 · Σ sale amount 2,115.43 = P&L income',
    fileName: 'myob-customer-sales.html', tags: ['myob', 'customer-sales', 'M35', 'sales'],
  },
  {
    m: 'M05', skill: 'cash-movement', name: 'MYOB Cash Movement', report: 'cm', wave: 'Wave 1 (P1, delivery order 3)',
    title: 'Cash Movement', menu: 'Reporting → Reports → Business → Cash movement',
    trigger: 'the user asks for cash movement, where the cash went, cash in and out, or how the bank balance changed over a period',
    discovery: 'Call `get_profit_and_loss_3m` once for the period (`reporting_basis` = `Accrual`), `get_balance_sheet` once at the period end, and `list_company_files` once. A `{"__error": …}` result is a failed call: report its message',
    dates: '`from_date` / `to_date` = the period (default: the financial year to date; display preset `p` as for the Profit and Loss). `prev_day` is derived by the kit — leave it. The view is display `v` (`cm` | `bank`).',
    members: [['Cash movement', 'The P&L for the period, then the change in every non-bank account as its effect on cash, Net Cash Movement in (Out), opening and closing bank balances'], ['Bank accounts', 'Report = Bank accounts (opening, movement, closing per bank account)'], ['Comparison with last year, monthly breakdown', 'Not yet']],
    checks: ['**Independent tie:** closing bank balance = opening bank balance + net cash movement (bank accounts on two Balance Sheets vs the P&L and every other account\'s change)', 'Net cash movement = net profit + the change in every non-bank account', 'Every account is classified, with at least one bank account', 'A year-end close inside the period is shown for information'],
    golden: 'mySMB.com 1 Jul – 9 Sep 2026: Net profit 1,610.48; receivables up 2,326.96 (uses cash); GST up 161.03; bank closing (555.45) = opening 0.00 + net cash movement (555.45)',
    fileName: 'myob-cash-movement.html', tags: ['myob', 'cash-movement', 'M05', 'cash'],
  },
  {
    m: 'M08', skill: 'general-ledger', name: 'MYOB General Ledger', report: 'gl', wave: 'Wave 1 (P1, delivery order 13)',
    title: 'General Ledger', menu: 'Reporting → Reports → Business → General ledger',
    trigger: 'the user asks for a general ledger, GL, the transactions on a category or account, or every journal for a period',
    discovery: 'Call `list_journal_transactions` once with `from_date` / `to_date` = the period, and `list_company_files` once. Expect `{Count, Items:[{DisplayID, JournalType, DateOccurred, Description, Lines:[{Account{UID, Name, DisplayID}, Amount, IsCredit}]}]}`. A `{"__error": …}` result is a failed call: report its message',
    dates: '`from_date` / `to_date` = the period (default: this month; display preset `p` = `this_month`, `last_month`, `this_quarter`, `this_fy_td` or `custom`). `prev_day` and `fy_start` are derived by the kit — leave them. The view is display `v` (`accounts` | `transactions` | `journal` | `category`).',
    members: [['General ledger', 'Code | Category name | Open | Debit | Credit | Net activity | Balance, one row per category with activity'], ['Transactions', 'Report = Transactions (every journal line)'], ['Journal entries', 'Report = Journal entries (also its own template, MYOB Journal Entries)'], ['Category transactions', 'Report = Category transactions (also its own template, MYOB Categories Transactions)'], ['Tax amount per line', 'N/A — not in the journal list']],
    checks: ['Σ debits = Σ credits, and every journal transaction balances', '**Independent tie:** balance-sheet categories — open (Balance Sheet the day before) + net activity = the closing Balance Sheet', '**Independent tie:** income and expense categories — net activity = the Profit and Loss for the period'],
    golden: 'mySMB.com September 2026: 1-1110 Business Bank Account #1 open (555.45) → balance (555.45); 1-1200 Accounts Receivable 2,326.96 → 2,326.96 (no September activity)',
    fileName: 'myob-general-ledger.html', tags: ['myob', 'general-ledger', 'M08', 'journals'],
  },
  {
    "m": "M09",
    "skill": "journal-entries",
    "name": "MYOB Journal Entries",
    "report": "je",
    "wave": "Wave 2 (P2)",
    "title": "Journal Entries",
    "menu": "Reporting → Reports → Business → Journal entries",
    "trigger": "the user asks for journal entries, every transaction in a period as journals, debits and credits per transaction, or a journal listing",
    "discovery": "Call `list_journal_transactions` once with `from_date` / `to_date` = the period, and `list_company_files` once. Expect `{Count, Items:[{DisplayID, JournalType, DateOccurred, Description, Lines:[{Account{UID, Name, DisplayID}, Amount, IsCredit, LineDescription}]}]}` — debit or credit comes from `IsCredit`. A `{\"__error\": …}` result is a failed call: report its message",
    "dates": "`from_date` / `to_date` = the period (default: this month; display preset `p` = `this_month`, `last_month`, `this_quarter`, `this_fy_td` or `custom`). `prev_day` and `fy_start` are derived by the kit — leave them. The view is display `v` (`journal` by default; the General ledger views are there too).",
    "members": [
      [
        "Journal entries",
        "One block per transaction: date, ID No., source and description, then every line (category, memo, debit, credit) in entry order, and its total — a transaction that does not balance is flagged"
      ],
      [
        "Search",
        "Search box over description, ID No. and categories"
      ],
      [
        "Transaction type or source module",
        "Source column (MYOB journal type)"
      ],
      [
        "Tax amount per line",
        "N/A — not in the journal list"
      ]
    ],
    "checks": [
      "Σ debits = Σ credits, and every journal transaction balances (each one is flagged in the report)",
      "**Independent tie:** balance-sheet categories — open (Balance Sheet the day before) + net activity = the closing Balance Sheet",
      "**Independent tie:** income and expense categories — net activity = the Profit and Loss for the period"
    ],
    "golden": "mySMB.com September 2026: every journal balances; the sale journals post Sales, GST and Accounts Receivable; totals equal the General Ledger for the same month",
    "fileName": "myob-journal-entries.html",
    "tags": [
      "myob",
      "journal-entries",
      "M09",
      "journals"
    ]
  },
  {
    "m": "M11",
    "skill": "categories-transactions",
    "name": "MYOB Categories Transactions",
    "report": "cx",
    "wave": "Wave 2 (P2)",
    "title": "Categories Transactions",
    "menu": "Reporting → Reports → Business → Categories transactions",
    "trigger": "the user asks for the transactions on a category or account, category transactions, the activity on one account for a period, or the debit or credit side of a category",
    "discovery": "Call `list_journal_transactions` once with `from_date` / `to_date` = the period, and `list_accounts` and `list_company_files` once. When the user names a category, find its `UID` in `list_accounts` and set `display.x` to it; otherwise leave `x` empty (every category with activity). Only the lines on the category show, never a transaction's other lines",
    "dates": "`from_date` / `to_date` = the period (default: this month; display preset `p`). `prev_day` and `fy_start` are derived by the kit — leave them. The view is display `v` (`category` by default).",
    "members": [
      [
        "Categories transactions",
        "Per category: opening balance, its own lines (date, ID No., source, memo, debit, credit), totals, net activity and closing balance"
      ],
      [
        "Category picker",
        "Category select above the report (all categories with activity by default)"
      ],
      [
        "Running balance per line",
        "N/A — the opening and closing balances come from MYOB's reports; per-line balances are not shown"
      ]
    ],
    "checks": [
      "Σ debits = Σ credits, and every journal transaction balances",
      "**Independent tie:** balance-sheet categories — opening + net activity = the closing Balance Sheet (the closing balance is shown under each category, with MYOB's own figure when they differ)",
      "**Independent tie:** income and expense categories — net activity = the Profit and Loss for the period"
    ],
    "golden": "mySMB.com September 2026: 6-1430 Electricity & Gas — one line 290.91 debit, closing = the P&L year to date",
    "fileName": "myob-categories-transactions.html",
    "tags": [
      "myob",
      "categories-transactions",
      "M11",
      "journals"
    ]
  },
  {
    "m": "M12",
    "skill": "contacts",
    "name": "MYOB Contacts",
    "report": "co",
    "wave": "Wave 2 (P2)",
    "title": "Contacts",
    "menu": "Reporting → Reports → Business → Contacts",
    "trigger": "the user asks for contacts, the contact list, customers or suppliers list, a customer or supplier directory, or contact balances",
    "discovery": "Call `list_contacts` once with `type` = `All` and `page_size` = 1000, and `list_company_files` once. Expect `Items:[{UID, CompanyName, FirstName, LastName, IsIndividual, DisplayID, IsActive, Type, CurrentBalance}]` — MYOB's contact list usually has no addresses; the report shows email and phone only when MYOB returns them, and only for customers and suppliers. One page holds up to 1,000 contacts: at exactly 1,000 the report says the list may be cut off",
    "dates": "No dates — the list and balances are today's. Set `type` (`All`, `Customer`, `Supplier`) from the request. The view is display `v` (`directory` | `balances`); `x` = `active` hides inactive contacts.",
    "members": [
      [
        "Contacts",
        "Grouped by type (customers, suppliers, employees, personal) with a count per group: name, ID, status, email and phone (customers and suppliers, when MYOB returns them), balance"
      ],
      [
        "Balances",
        "Report = Balances (customers who owe you, suppliers you owe)"
      ],
      [
        "Contact type",
        "Contact type select (refetches)"
      ],
      [
        "Search, hide inactive",
        "Above the report"
      ],
      [
        "Addresses",
        "N/A — not shown; employee and personal contacts never show contact details"
      ]
    ],
    "checks": [
      "Contacts shown = the contacts MYOB returned (N/A with a warning at 1,000 — one page)",
      "**Independent tie:** customer balances = open invoices (a separate MYOB list)",
      "**Independent tie:** supplier balances = open bills (a separate MYOB list)"
    ],
    "golden": "mySMB.com: customers and suppliers with their balances; customer balances total = Unpaid Invoices total",
    "fileName": "myob-contacts.html",
    "tags": [
      "myob",
      "contacts",
      "M12",
      "directory"
    ]
  },
  {
    m: 'M00', skill: 'dashboard', name: 'MYOB Dashboard', report: 'db', wave: 'Wave 1 (P1, delivery order 6)',
    title: 'Dashboard', menu: 'Dashboard (home)',
    trigger: 'the user asks for a dashboard, the MYOB home dashboard, a business overview, how the business is doing today, or what needs doing (overdue invoices, GST to pay, super payable)',
    discovery: 'Call `get_profit_and_loss_3m` once with `from_date` = the first day of the month two months ago (e.g. `2026-07-01` in September), `to_date` = today and `reporting_basis` = `Accrual`, and `list_company_files` once. A `{"__error": …}` result is a failed call: report its message',
    dates: 'Always as at today — MYOB\'s dashboard periods are fixed (last 3 months, this financial year, today) and its API gives today\'s open balances. `as_at`, `m3_start`, `fy_start` and `chart_from` are set by the kit — leave them. There is no view to choose.',
    members: [['Up next', 'The number of overdue invoices'], ['Your business', 'Income and Expenses for the last 3 months, Financial position (net profit this financial year), and a monthly Income / Expense / Net profit chart from the financial year\'s first month'], ['Accounts', 'Bank balance (accounts of type Bank) and Money owed (credit cards), MYOB\'s balances today'], ['GST', 'To pay (or to claim), GST collected and GST paid: the accounts the GST tax codes post to'], ['Overdue invoices', 'Total overdue; Over 30, 16 to 30 and 1 to 15 days overdue (count and $); what is owed on every open invoice'], ['Superannuation payable, PAYG withholding', 'The balances of the liability accounts with those names'], ['Pay runs, Uploads', 'N/A — the connector has no list of pay runs; uploads are not part of a report']],
    checks: ['**Independent tie:** last 3 months — income and expenses on the Profit and Loss = the journals (two MYOB sources)', 'Financial position = the chart\'s months added up', '**Independent tie:** Financial position = Current Year Earnings on the Balance Sheet', '**Independent tie:** money owed to you (open invoices) = the receivables account on the Balance Sheet', 'The overdue age bands add up to the overdue total, and Up next counts every overdue invoice', 'GST to pay = collected − paid, naming the accounts used (information)'],
    golden: 'mySMB.com, 9 Sep 2026: Income $2,115.43 (last 3 months) · Expenses $504.95 · Financial position $1,610.48 · GST $161.03 to pay (collected $161.03 / paid $0.00) · Overdue invoices $2,326.96 (over 30 days 2 / $1,903.00; 16–30 days 10 / $423.96; 1–15 days 0 / $0.00) · Superannuation payable $0.00 · Up next: 12 overdue invoices',
    fileName: 'myob-dashboard.html', tags: ['myob', 'dashboard', 'M00', 'overview'],
  },
  {
    m: 'M59', skill: 'exceptions-dashboard', name: 'MYOB Exceptions Dashboard', report: 'ex', wave: 'Wave 1 (P1, delivery order 9)',
    title: 'Exceptions Dashboard', menu: 'Reporting → Exceptions dashboard',
    trigger: 'the user asks for the exceptions dashboard, a review before BAS or month-end, data-quality checks, whether receivables or payables reconcile, future-dated or prepaid transactions, or tax code exceptions',
    discovery: 'Call `list_invoices` once with `status` = `Open`, and `list_company_files` once. A `{"__error": …}` result is a failed call: report its message',
    dates: '`from_date` / `to_date` = the review period (default: the financial year to date; display preset `p` = `this_fy_td`, `this_month`, `last_month`, `this_quarter`, `last_quarter`, `last_fy` or `custom`). `as_at` and `day_after` are set by the kit — leave them (the reconciliations use today\'s open balances; future dated means dated after today).',
    members: [['Transaction review', 'Receivables and Payables reconciliation exceptions (open documents today vs the control accounts), Future dated transactions (dated after today), Prepaid transactions (paid before their own date)'], ['Tax review', 'Tax amount variance: line tax codes when MYOB returns invoice lines, otherwise tax above the GST rate or totals that don\'t add up'], ['Tax code exceptions (invoice transactions)', 'Lines whose tax code is not the account\'s default — when MYOB returns invoice lines; otherwise N/A'], ['Tax code exceptions (cash transactions)', 'N/A — the connector has no spend money / receive money list'], ['Readiness and dollarised risk', 'Checks passed ÷ 7, and Σ the exception amounts']],
    checks: ['**Independent tie:** receivables — open invoices today = the receivables account on the Balance Sheet', '**Independent tie:** payables — open bills today = the payables account on the Balance Sheet', 'Future dated, prepaid and tax checks each list their exceptions with amounts', 'A check whose data the connector does not have shows N/A with the reason, never a pass'],
    golden: 'mySMB.com, 1 Jul – 9 Sep 2026: Receivables reconciliation exceptions ✓ · Payables reconciliation exceptions ✓ · Future dated / Prepaid / Tax amount variance / Tax code exceptions — no exceptions flagged',
    fileName: 'myob-exceptions-dashboard.html', tags: ['myob', 'exceptions-dashboard', 'M59', 'review'],
  },
  {
    m: 'M19', skill: 'myob-statement-of-cash-flows', name: 'MYOB Statement of Cash Flows', report: 'sc', wave: 'Wave 1 (P1, delivery order 14)',
    title: 'Statement of Cash Flows', menu: 'Reporting → Reports → Banking → Statement of cash flow',
    trigger: 'the user asks for a statement of cash flows, a cash flow statement, operating / investing / financing cash flows, or how cash changed over a period (for a lender or the board)',
    discovery: 'Call `get_profit_and_loss_3m` once for the period (`reporting_basis` = `Accrual`), `get_balance_sheet` once at the period end, and `list_company_files` once. A `{"__error": …}` result is a failed call: report its message',
    dates: '`from_date` / `to_date` = the period (default: this month to date, as MYOB opens it; display preset `p` = `this_month_td`, `this_month`, `last_month`, `this_quarter`, `last_quarter`, `this_fy_td`, `last_fy` or `custom`). `prev_day` is derived by the kit — leave it. The view is display `v` (`detail` = expanded to category lines | `summary` = the three activities only).',
    members: [['Statement of cash flow', 'Classification | Net cash flow ($): operating, investing and financing activities (each expandable to its category lines), Net increase/decrease for the period, Cash at the beginning and at the end of the period, and a waterfall from opening to closing cash'], ['Collapsed', 'Report = Collapsed (the three activities only)'], ['Each account\'s own cash-flow classification', 'N/A — MYOB\'s API does not expose it: activities follow the account type (stated in the report)']],
    checks: ['**Independent tie:** cash at the end = cash at the beginning + net increase/decrease (bank accounts on two Balance Sheets vs the P&L and every other account\'s change)', 'Net increase/decrease = operating + investing + financing', 'Every account has a type in the chart of accounts, with at least one bank account', 'A year-end close inside the period is shown for information'],
    golden: 'mySMB.com 1–9 Sep 2026: operating 0.00 · investing 0.00 · financing 0.00 · Net increase/decrease 0.00 · Cash at the beginning (555.45) · Cash at the end (555.45)',
    fileName: 'myob-statement-of-cash-flows.html', tags: ['myob', 'statement-of-cash-flows', 'M19', 'cash'],
  },
  {
    m: 'M60', skill: 'myob-report-pack', name: 'MYOB Report Pack', report: 'rp', wave: 'Wave 1 (P1, delivery order 15)',
    title: 'Report Pack', menu: 'Reporting → Report packs → Management Report',
    trigger: 'the user asks for a report pack, a management report, a monthly board or owner pack, or the balance sheet, profit and loss and cash movement together in one document',
    discovery: 'Call `get_profit_and_loss_3m` once for the period (`reporting_basis` = `Accrual`), `get_balance_sheet` once at the period end, and `list_company_files` once. A `{"__error": …}` result is a failed call: report its message',
    dates: '`from_date` / `to_date` = the period (default: last month — a monthly pack; display preset `p` = `last_month`, `this_month`, `last_quarter`, `this_fy_td`, `last_fy` or `custom`). `prev_day` is derived by the kit — leave it. Pages are display `x`: one letter per page in order — `C` cover, `T` contents, `S` executive summary, `B` balance sheet, `P` profit & loss, `M` cash movement, `D` disclaimer (default `CTSBPM`; add `D` for a disclaimer page).',
    members: [['Management Report', 'Cover page → Table of contents → Executive summary (income, expenses, net profit, cash and a chart) → Balance sheet → Profit & loss → Cash movement, one set of preferences for every page; each page prints on its own sheet'], ['Pages', 'Include, exclude and reorder pages in the report (Pages); a full-page disclaimer is optional'], ['PDF style templates, saving a pack template', 'N/A — MYOB actions, not reproduced (Branding and Customise cover the styling)']],
    checks: ['Balance sheet: Total Assets = Total Liabilities + Total Equity', '**Independent tie:** net profit (P&L) = the Current Year Earnings movement on the Balance Sheet (two Balance Sheets) = the P&L line of Cash movement', '**Independent tie:** Cash movement — closing bank = opening bank + net cash movement', 'P&L section totals = Σ their accounts, and every account is classified'],
    golden: 'Template "Management Report" by MYOB: pages Cover · Contents · Balance sheet · Profit & loss · Cash movement; mySMB.com figures as in MYOB Balance Sheet, Profit and Loss and Cash Movement for the same period',
    fileName: 'myob-report-pack.html', tags: ['myob', 'report-pack', 'M60', 'management-report'],
  },
  {
    m: 'M06', also: ['M07', 'M61'], skill: 'gst-summary', name: 'MYOB GST Summary (BAS)', report: 'gst', wave: 'Wave 1 (P1) — M06, with M07 GST return and M61 BAS',
    title: 'GST Summary (BAS)', menu: 'Reporting → Reports → Business → GST report / GST return; Reporting → BAS',
    trigger: 'the user asks for a GST report, GST summary, GST return, BAS, activity statement, GST payable or refund, GST by tax code, or BAS labels (G1, 1A, 1B, W1, W2) for a period',
    discovery: 'Call `get_gst_summary` once for the period (`reporting_basis` = `Accrual` unless asked for cash), `list_tax_codes` once and `list_company_files` once. Expect `{StartDate, EndDate, ReportingBasis, TaxCodeBreakdown:[{SalesTotal, PurchasesTotal, TaxCollected, TaxPaid, TaxRate, TaxCode{UID,Code}}]}` — GST-inclusive totals per tax code and **no BAS labels** (MYOB\'s API has no link from codes to labels). `get_payroll_category_summary` gives W1 / W2 (it may be missing on older connectors — then W1 / W2 are N/A). A `{"__error": …}` result is a failed call: report its message',
    dates: '`from_date` / `to_date` = the BAS period (default: last quarter — display preset `p` = `last_quarter`; `this_quarter`, `last_month`, `this_month` or `custom`). `basis` = `Accrual` or `Cash` (the client\'s GST accounting basis). The view is display `v`: `bas` (activity statement, default), `return` (GST return labels and the mapping) or `codes` (GST report by tax code). `bas_map` holds the client\'s tax code → BAS label mapping (default `G2=EXP;G3=FRE;G4=ITS;G10=CAP;X=N-T`) — change it only when the user gives their mapping.',
    members: [['BAS (activity statement)', 'G1, G2, G3, G10, G11, 1A, 1B; PAYG W1 / W2; summary 8A, 8B and 9 (payable or refund) — marked Draft, check before lodging'], ['GST return (BAS labels)', 'Report = GST return: G1–G12 worksheet with the codes behind each label, and the editable mapping for this client'], ['GST report by tax code', 'Report = GST report by tax code: GST-inclusive sales and purchases, GST collected and paid, net, per code'], ['Simpler BAS', 'G1, 1A and 1B on the BAS view'], ['G7 / G18 adjustments, G13–G15, fuel tax credits, PAYG instalments (T7), lodging', 'N/A — not in MYOB\'s API (MYOB\'s AI BAS and lodgement are in its app only)']],
    checks: ['MYOB returned the requested period (the tax code summary echoes the dates)', 'Each tax code\'s GST = its rate on its GST-inclusive amounts (a file whose totals exclude GST is detected and grossed up)', 'G1 covers G2 + G3 + G4 (G6 not negative)', '**Independent (information):** 1A − 1B = the GST accounts\' movement in the period\'s journals, BAS payments (journals with only GST and bank lines) left out — accrual basis', 'Codes left out of the BAS (N-T, non-GST taxes) listed with their amounts'],
    golden: 'mySMB.com: the Dashboard\'s GST line (2-1212 GST Balance) for the same period; MYOB GST return for the quarter',
    fileName: 'myob-gst-summary-bas.html', tags: ['myob', 'gst', 'bas', 'M06', 'M07', 'M61', 'tax'],
  },
  {
    m: 'M17', skill: 'myob-bank-reconciliation-status', name: 'MYOB Bank Reconciliation Status', report: 'br', wave: 'Wave 2 (P2)',
    title: 'Bank Reconciliation Status', menu: 'Reporting → Reports → Banking → Banking reconciliation',
    trigger: 'the user asks for a bank reconciliation, banking reconciliation report, reconciliation status, when the bank accounts were last reconciled, unreconciled or unpresented transactions, or the reconciled bank balance',
    discovery: 'Call `list_accounts` once (bank and credit card accounts carry `LastReconciledDate`, null = never reconciled), `list_journal_transactions` once from the start of last financial year to the date (each line carries `ReconciledDate`, null = not reconciled) and `list_company_files` once. MYOB\'s API has no reconciliation report: the status comes from those two dates. A `{"__error": …}` result is a failed call: report its message',
    dates: '`as_at` = the date (default `"today"`; display preset `a` = `today`, `end_last_month` or `custom`). `since_date` / `prev_day` are derived by the kit (the start of last financial year — how far back unreconciled transactions are looked for); leave them. The view is display `v`: `status` (default) or `items` (unreconciled transactions).',
    members: [['Reconciliation status', 'Per bank and credit card account: last reconciled date, days since, status (up to date / overdue / never reconciled), balance in MYOB, unreconciled deposits and withdrawals, reconciled balance, oldest unreconciled item'], ['Unreconciled transactions', 'Report = Unreconciled transactions: every unreconciled journal line on a bank or card account with its age'], ['Bank statement comparison', 'N/A — the bank feed is not compared here (see Bank transactions)']],
    checks: ['**Independent tie:** each account\'s balance at the date = its balance the day before the look-back + its journal movement (two Balance Sheets vs the journals)', 'There is at least one bank or credit card account', 'Reconciled balance = balance in MYOB − unreconciled transactions, per account', 'Accounts not reconciled in the last 31 days, and unreconciled items older than 60 days (information)'],
    golden: 'MYOB Banking reconciliation report for the same account and date',
    fileName: 'myob-bank-reconciliation-status.html', tags: ['myob', 'banking', 'reconciliation', 'M17'],
  },
  {
    "m": "M15",
    "skill": "bank-activity",
    "name": "MYOB Bank Activity",
    "report": "ba",
    "wave": "Wave 2 (P2)",
    "title": "Bank Activity",
    "menu": "Reporting → Reports → Banking → Bank activity",
    "trigger": "the user asks for bank activity, the transactions on a bank or credit-card account with a running balance, money in and out of the bank, or spend and receive money for a period",
    "discovery": "Call `list_journal_transactions` once with `from_date` / `to_date` = the period, `list_accounts` once (bank and credit-card accounts) and `list_company_files` once. When the user names an account, set `display.x` to its `UID`; otherwise leave `x` empty (every bank and credit-card account)",
    "dates": "`from_date` / `to_date` = the period (default: this month; display preset `p`). `prev_day` is derived by the kit — leave it. The view is display `v` (`activity` | `summary`).",
    "members": [
      [
        "Bank activity",
        "Per bank and credit-card account: opening balance, each journal line (date, ID No., type — spend, receive, transfer, payment —, description, money in, money out, running balance) and the closing balance"
      ],
      [
        "Summary by account",
        "Report = Summary by account (opening, in, out, closing, Balance Sheet)"
      ],
      [
        "Account picker",
        "Account select above the report"
      ]
    ],
    "checks": [
      "**Independent tie:** every bank and credit-card account — opening (Balance Sheet the day before) + money in − money out = the closing Balance Sheet",
      "There is at least one bank or credit-card account"
    ],
    "golden": "mySMB.com September 2026: 1-1110 Business Bank Account #1 opening + September activity = the 28 September balance",
    "fileName": "myob-bank-activity.html",
    "tags": [
      "myob",
      "bank-activity",
      "M15",
      "banking"
    ]
  },
  {
    "m": "M16",
    "skill": "bank-transactions",
    "name": "MYOB Bank Transactions",
    "report": "bt",
    "wave": "Wave 2 (P2)",
    "title": "Bank Transactions",
    "menu": "Reporting → Reports → Banking → Bank transactions",
    "trigger": "the user asks for bank transactions, bank feed lines, the bank statement lines, or transactions from the bank feed for a period",
    "discovery": "Call `list_bank_statement_lines` once with `status` = `All` and `from_date` / `to_date` = the period, and `list_company_files` once. Expect `{Date, Description, Account, Amount, IsCredit, Status (Uncoded / Coded / Hidden), Reference}` per line — `IsCredit` = money in. An empty list can mean bank feeds are not set up: say so",
    "dates": "`from_date` / `to_date` = the period (default: this month; display preset `p`). `prev_day` is derived by the kit — leave it. The view is display `v` (`transactions` | `coding`); `x` = an account UID.",
    "members": [
      [
        "Bank transactions",
        "Per account in date order: date, description, reference, status, money in, money out, a running total from the start of the range"
      ],
      [
        "Coding",
        "Report = Coding (also its own template, MYOB Coding)"
      ],
      [
        "Account picker",
        "Account select above the report"
      ],
      [
        "Statement opening and closing balance",
        "N/A — not in the feed lines"
      ]
    ],
    "checks": [
      "Lines by status add up to every line (count and amount)",
      "Every line has a coding status",
      "For information: coded feed lines vs the ledger's movement on each account (they differ when entries have no feed line)"
    ],
    "golden": "mySMB.com September 2026: coded lines equal the ledger movement on each feed account; recent lines uncoded",
    "fileName": "myob-bank-transactions.html",
    "tags": [
      "myob",
      "bank-transactions",
      "M16",
      "banking"
    ]
  },
  {
    "m": "M18",
    "skill": "coding",
    "name": "MYOB Coding",
    "report": "bc",
    "wave": "Wave 2 (P2)",
    "title": "Coding",
    "menu": "Reporting → Reports → Banking → Coding",
    "trigger": "the user asks for the coding report, uncoded bank transactions, the bank-feed coding backlog, or how many feed lines still need coding",
    "discovery": "Call `list_bank_statement_lines` once with `status` = `All` and `from_date` / `to_date` = the period, and `list_company_files` once — as Bank Transactions. The uncoded lines are the backlog: put them first",
    "dates": "`from_date` / `to_date` = the period (default: this month; display preset `p`). The view is display `v` (`coding` by default).",
    "members": [
      [
        "Coding",
        "Count and amount per status (Uncoded first, then Coded, Hidden) and a table per status"
      ],
      [
        "Bank transactions",
        "Report = Bank transactions (per account in date order)"
      ],
      [
        "Account picker",
        "Account select above the report"
      ]
    ],
    "checks": [
      "Lines by status add up to every line (count and amount)",
      "Every line has a coding status",
      "For information: coded feed lines vs the ledger's movement on each account"
    ],
    "golden": "mySMB.com September 2026: the last days' feed lines are uncoded; everything earlier is coded",
    "fileName": "myob-coding.html",
    "tags": [
      "myob",
      "coding",
      "M18",
      "banking"
    ]
  },
  {
    m: 'M39', skill: 'item-sales', name: 'MYOB Item Sales', report: 'il', wave: 'Wave 2 (P2)',
    title: 'Item Sales', menu: 'Reporting → Reports → Sales → Item sales',
    trigger: 'the user asks for item sales, sales by item or product, units sold, best-selling items, or revenue per inventory item for a period',
    discovery: 'Call `list_invoice_lines` once for the period (`status` = `All`) — one row per invoice line across every layout, with `Item{Number,Name}`, `Account`, `Quantity`, `UnitPrice`, `Total`, `TaxCode` and the invoice\'s `Number`, `Date`, `Customer`, `IsTaxInclusive` — plus `list_invoices` once (the tie) and `list_company_files` once. A `{"__error": …}` result is a failed call: report its message',
    dates: '`from_date` / `to_date` = the period (default: this financial year to date — display preset `p` = `this_fy_td`; `this_month`, `last_month`, `this_quarter`, `last_quarter`, `last_fy` or `custom`). The view is display `v`: `item` (default), `analysis` (by month, with estimated margin) or `customer` (customer sales detail).',
    members: [['Item sales', 'Per item: units sold, sales ex tax, % of sales, average price; lines with no item grouped by account'], ['Item sales analysis', 'See MYOB Item Sales Analysis'], ['Customer sales (detail)', 'See MYOB Customer Sales (Detail)']],
    checks: ['**Independent tie:** each invoice\'s lines add up to its amount on MYOB\'s invoice list (layout lines vs the invoice list — two MYOB sources)', 'Every invoice in the period has its lines', 'All the period\'s lines were returned (no truncation)'],
    golden: 'MYOB Item sales report for the same period',
    fileName: 'myob-item-sales.html', tags: ['myob', 'item-sales', 'M39', 'sales'],
  },
  {
    m: 'M49', skill: 'item-sales-analysis', name: 'MYOB Item Sales Analysis', report: 'ia', wave: 'Wave 3 (P3)',
    title: 'Item Sales Analysis', menu: 'Reporting → Reports → Inventory → Item sales analysis',
    trigger: 'the user asks for item sales analysis, item margin or gross profit by item, item sales trend by month, or performance per product over time',
    discovery: 'Call `list_invoice_lines` once for the period (`status` = `All`), `list_invoices` once, `list_items` once (`AverageCost` per item — the estimated cost) and `list_company_files` once. A `{"__error": …}` result is a failed call: report its message',
    dates: '`from_date` / `to_date` = the period (default: this financial year to date; display preset `p` as for Item Sales). The view is display `v` (`analysis` by default).',
    members: [['Item sales analysis', 'Per item: sales ex tax per month, total, estimated cost (units × MYOB\'s current average cost), estimated gross margin and margin %'], ['Cost at the time of each sale', 'N/A — the invoice lines carry no cost; estimated at the current average cost']],
    checks: ['**Independent tie:** each invoice\'s lines add up to its amount on MYOB\'s invoice list', 'Every invoice in the period has its lines', 'All the period\'s lines were returned'],
    golden: 'MYOB Item sales analysis for the same period (margins differ where average cost has moved)',
    fileName: 'myob-item-sales-analysis.html', tags: ['myob', 'item-sales', 'margin', 'M49', 'inventory'],
  },
  {
    m: 'M36', skill: 'myob-customer-sales-detail', name: 'MYOB Customer Sales (Detail)', report: 'cd', wave: 'Wave 2 (P2)',
    title: 'Customer Sales (Detail)', menu: 'Reporting → Reports → Sales → Customer sales (detail)',
    trigger: 'the user asks for customer sales detail, what each customer bought, invoice lines by customer, or sales by customer and item for a period',
    discovery: 'Call `list_invoice_lines` once for the period (`status` = `All`), `list_invoices` once and `list_company_files` once. A `{"__error": …}` result is a failed call: report its message',
    dates: '`from_date` / `to_date` = the period (default: this financial year to date; display preset `p` as for Item Sales). The view is display `v` (`customer` by default).',
    members: [['Customer sales (detail)', 'Every invoice line by customer: date, invoice, item or account, description, quantity, unit price, amount ex tax, tax code'], ['Summary by customer', 'See MYOB Customer Sales']],
    checks: ['**Independent tie:** each invoice\'s lines add up to its amount on MYOB\'s invoice list', 'Every invoice in the period has its lines', 'All the period\'s lines were returned'],
    golden: 'MYOB Customer sales (detail) for the same period',
    fileName: 'myob-customer-sales-detail.html', tags: ['myob', 'customer-sales', 'detail', 'M36', 'sales'],
  },
  {
    m: 'M44', skill: 'myob-supplier-purchases-detail', name: 'MYOB Supplier Purchases (Detail)', report: 'bd', wave: 'Wave 2 (P2)',
    title: 'Supplier Purchases (Detail)', menu: 'Reporting → Reports → Purchases → Supplier purchases (detail)',
    trigger: 'the user asks for supplier purchases detail, what was bought from each supplier, bill lines by supplier, or purchases by item or account for a period',
    discovery: 'Call `list_bill_lines` once for the period (`status` = `All`) — one row per bill line across every layout — plus `list_bills` once (the tie) and `list_company_files` once. A `{"__error": …}` result is a failed call: report its message',
    dates: '`from_date` / `to_date` = the period (default: this financial year to date — display preset `p` = `this_fy_td`, or another preset / `custom`). The view is display `v`: `supplier` (default) or `item` (purchases by item / account).',
    members: [['Supplier purchases (detail)', 'Every bill line by supplier: date, bill, item or account, description, quantity, unit price, amount ex tax, tax code'], ['Purchases by item / account', 'Report = Purchases by item / account'], ['Summary by supplier', 'See MYOB Supplier Purchases']],
    checks: ['**Independent tie:** each bill\'s lines add up to its amount on MYOB\'s bill list (layout lines vs the bill list — two MYOB sources)', 'Every bill in the period has its lines', 'All the period\'s lines were returned'],
    golden: 'MYOB Supplier purchases (detail) for the same period',
    fileName: 'myob-supplier-purchases-detail.html', tags: ['myob', 'supplier-purchases', 'detail', 'M44', 'purchases'],
  },
  {
    "wave": "Wave 3 (P3)",
    "m": "M48",
    "skill": "stock-on-hand",
    "name": "MYOB Stock on Hand",
    "report": "iv",
    "title": "Stock on Hand",
    "menu": "Reporting → Reports → Inventory → Stock on hand",
    "trigger": "the user asks for stock on hand, stock levels, inventory quantities, committed or on-order stock, what is available, or out-of-stock items",
    "discovery": "Call `list_items` once, `get_balance_sheet` once with `date` = today, and `list_company_files` once. Expect per item `QuantityOnHand`, `QuantityCommitted`, `QuantityOnOrder`, `QuantityAvailable`, `AverageCost`, `CurrentValue`, `IsInventoried`, `AssetAccount` — today's figures; MYOB keeps no history of them",
    "dates": "`as_at` = the Balance Sheet date for the value tie (default `\"today\"`; display preset `a`). Quantities and values are always today's. The view is display `v` (`stock` by default; also `reorder`, `list`, `recon`).",
    "members": [
      [
        "Stock on hand",
        "Active inventoried items: on hand, committed, on order, available, average cost, value; no stock highlighted"
      ],
      [
        "Other inventory views",
        "Report = Reorder, Item list, Inventory value reconciliation (each also its own template)"
      ]
    ],
    "checks": [
      "**Independent tie (today):** the items' value = the inventory account(s) on the Balance Sheet",
      "MYOB's available quantity = on hand − committed (or + on order, as the file computes it)"
    ],
    "golden": "mySMB.com has no inventoried items — confirm on a file with stock that the values add up to the inventory account",
    "fileName": "myob-stock-on-hand.html",
    "tags": [
      "myob",
      "inventory",
      "M48",
      "stock"
    ]
  },
  {
    "wave": "Wave 3 (P3)",
    "m": "M47",
    "skill": "reorder",
    "name": "MYOB Reorder",
    "report": "ro",
    "title": "Reorder",
    "menu": "Reporting → Reports → Inventory → Reorder",
    "trigger": "the user asks for the reorder report, items to reorder, stock below minimum levels, what to buy, or restocking",
    "discovery": "Call `list_items` once and `list_company_files` once (as Stock on Hand). The minimum level, default order quantity and supplier come from each item's `BuyingDetails.RestockingInformation`; items without a minimum level are not watched — never invent a threshold",
    "dates": "No dates — quantities are today's. The view is display `v` (`reorder` by default).",
    "members": [
      [
        "Reorder",
        "Items at or below their minimum level: on hand, minimum, below minimum, order quantity, supplier, estimated cost (order quantity × last purchase price), largest shortfall first"
      ],
      [
        "Items without a minimum level",
        "Counted and listed above the table — not watched"
      ]
    ],
    "checks": [
      "**Independent tie (today):** the items' value = the inventory account(s) on the Balance Sheet",
      "Every item listed is at or below its minimum level"
    ],
    "golden": "Confirm on a file with stock that every listed item is at or below its MYOB minimum level",
    "fileName": "myob-reorder.html",
    "tags": [
      "myob",
      "inventory",
      "M47",
      "reorder"
    ]
  },
  {
    "wave": "Wave 3 (P3)",
    "m": "M51",
    "skill": "item-list",
    "name": "MYOB Item List",
    "report": "it",
    "title": "Item List",
    "menu": "Reporting → Reports → Inventory → Item list",
    "trigger": "the user asks for the item list, a list of items or products with prices and costs, or inactive items",
    "discovery": "Call `list_items` once and `list_company_files` once (as Stock on Hand). Every item, active and inactive; services too",
    "dates": "No dates. The view is display `v` (`list` by default); `x` = `active` shows active items only.",
    "members": [
      [
        "Item list",
        "Every item: number, name, type (bought / sold / inventoried), selling price, standard cost, average cost, value, status — inactive items muted"
      ],
      [
        "Active items only",
        "Checkbox above the table"
      ]
    ],
    "checks": [
      "**Independent tie (today):** the items' value = the inventory account(s) on the Balance Sheet"
    ],
    "golden": "mySMB.com: Widget standard and Widget deluxe (sold items)",
    "fileName": "myob-item-list.html",
    "tags": [
      "myob",
      "inventory",
      "M51",
      "items"
    ]
  },
  {
    "wave": "Wave 3 (P3)",
    "m": "M52",
    "skill": "inventory-value-reconciliation",
    "name": "MYOB Inventory Value Reconciliation",
    "report": "vr",
    "title": "Inventory Value Reconciliation",
    "menu": "Reporting → Reports → Inventory → Inventory value reconciliation",
    "trigger": "the user asks to reconcile inventory, the inventory value reconciliation, whether stock value matches the balance sheet, or the inventory control account",
    "discovery": "Call `list_items` once, `get_balance_sheet` once with `date` = today, `list_accounts` once and `list_company_files` once. The control account is each inventoried item's `AssetAccount` (else asset accounts named inventory or stock). Never infer the cause of a difference",
    "dates": "`as_at` = the Balance Sheet date (default `\"today\"`). Item values are today's, so only today compares like with like — the report says so for any other date. The view is display `v` (`recon` by default).",
    "members": [
      [
        "Inventory value reconciliation",
        "Items' value today vs the inventory account(s) at the date, the difference, the accounts and the items"
      ],
      [
        "A past date",
        "Banner: the two sides are not for the same day; the tie is N/A"
      ]
    ],
    "checks": [
      "**Independent tie (today):** the items' value = the inventory account(s) on the Balance Sheet",
      "Each item's value = on hand × average cost"
    ],
    "golden": "Confirm on a file with stock that the difference is nil today, or that MYOB's own reconciliation report shows the same difference",
    "fileName": "myob-inventory-value-reconciliation.html",
    "tags": [
      "myob",
      "inventory",
      "M52",
      "reconciliation"
    ]
  },
  {
    "wave": "Wave 3 (P3)",
    "m": "M50",
    "skill": "items-register",
    "name": "MYOB Items Register",
    "report": "ir",
    "title": "Items Register",
    "menu": "Reporting → Reports → Inventory → Items register",
    "trigger": "the user asks for the items register, stock movements, item transactions, purchases and sales of an item, or how stock levels changed",
    "discovery": "Call `list_items` once, `list_invoice_lines` and `list_bill_lines` once each from the period start to today, `list_inventory_adjustments` once for the same dates, and `list_company_files` once. Only lines for inventoried items move stock; MYOB keeps only today's on hand, so the opening quantity is worked back from it",
    "dates": "`from_date` = the period start (default: this month; display preset `p`); `to_date` = the end shown (movements are always read to today). The view is display `v` (`register` | `summary`); `x` = an item UID.",
    "members": [
      [
        "Items register",
        "Per inventoried item: opening quantity, each purchase, sale and adjustment (date, reference, customer / supplier / memo, quantity) with the running on hand, and the closing quantity"
      ],
      [
        "Summary by item",
        "Report = Summary by item (opening, purchased, sold, adjusted, closing)"
      ],
      [
        "Item picker",
        "Item select above the report"
      ],
      [
        "Movement cost and value, transfers and builds",
        "N/A — quantities only; not in the connector"
      ]
    ],
    "checks": [
      "No item has a negative opening quantity (worked back from today's on hand — a negative means movements are missing)",
      "Every movement names an item in MYOB's item list",
      "For information: lines that do not move stock (services, lines without an item)"
    ],
    "golden": "Confirm on a file with stock that the closing quantity today equals MYOB's on hand and the opening is not negative",
    "fileName": "myob-items-register.html",
    "tags": [
      "myob",
      "inventory",
      "M50",
      "register"
    ]
  },
  {
    m: 'M23', skill: 'myob-pay-run-history', name: 'MYOB Pay Run History', report: 'py', wave: 'Wave 3 (P3)',
    title: 'Pay Run History', menu: 'Reporting → Reports → Payroll → Pay run history',
    trigger: 'the user asks for pay run history, pay runs, what was paid in each pay run, payroll totals by pay date, or wages, PAYG and super per pay run',
    discovery: 'Call `list_payroll_advices` once (one advice per paycheque, all employees — `GrossPay`, `NetPay`, `PaymentDate`, `PayPeriodStartDate` / `EndDate`, `Lines[{PayrollCategory{Name,Type}, Hours, Amount}]`, `SuperannuationFund`; dates of birth removed) and `get_payroll_category_summary` once (the tie), plus `list_company_files`. MYOB\'s API has no pay-run list: a pay run is the paycheques sharing a payment date and pay period. A `{"__error": …}` result is a failed call: report its message',
    dates: '`from_date` / `to_date` = the period, by payment date (default: this financial year to date — display preset `p` = `this_fy_td`, or another preset / `custom`). `adv_from` / `adv_to` are derived by the kit — leave them. The view is display `v`: `runs` (default), `register`, `summary`, `fund` or `super`.',
    members: [['Pay run history', 'Per pay run: payment date, pay period, employees, gross, PAYG, deductions, net, super, hours'], ['Payroll register / summary / accrual by fund / superannuation payments', 'See those MYOB reports (the same data on other views)']],
    checks: ['**Independent tie:** wages and PAYG on the paycheques = MYOB\'s payroll category summary for the period (two MYOB reports)', 'Pay runs add up to the paycheques', 'Each paycheque: net = gross − PAYG − deductions (information — salary sacrifice and other items can differ)'],
    golden: 'MYOB Pay run history for the same period',
    fileName: 'myob-pay-run-history.html', tags: ['myob', 'payroll', 'pay-runs', 'M23'],
  },
  {
    m: 'M21', also: ['M22'], skill: 'payroll-register', name: 'MYOB Payroll Register', report: 'pyr', wave: 'Wave 3 (P3)',
    title: 'Payroll Register', menu: 'Reporting → Reports → Payroll → Payroll register',
    trigger: 'the user asks for a payroll register, per-employee payroll, each employee\'s pays for a period, or gross, tax, net and super by employee',
    discovery: 'As for MYOB Pay Run History: `list_payroll_advices` once, `get_payroll_category_summary` once, `list_company_files` once.',
    dates: '`from_date` / `to_date` = the period by payment date (default: this financial year to date). The view is display `v` (`register` by default).',
    members: [['Payroll register', 'Every paycheque: employee, payment date, period end, gross, PAYG, deductions, net, super, hours']],
    checks: ['**Independent tie:** wages and PAYG = MYOB\'s payroll category summary', 'Pay runs add up to the paycheques'],
    golden: 'MYOB Payroll register for the same period',
    fileName: 'myob-payroll-register.html', tags: ['myob', 'payroll', 'register', 'M21'],
  },
  {
    m: 'M20', skill: 'payroll-summary', name: 'MYOB Payroll Summary', report: 'pys', wave: 'Wave 3 (P3)',
    title: 'Payroll Summary', menu: 'Reporting → Reports → Payroll → Payroll summary',
    trigger: 'the user asks for a payroll summary, payroll totals by category, total wages, tax, deductions and super for a period, or payroll costs for the business',
    discovery: 'As for MYOB Pay Run History: `list_payroll_advices` once, `get_payroll_category_summary` once, `list_company_files` once.',
    dates: '`from_date` / `to_date` = the period by payment date (default: this financial year to date). The view is display `v` (`summary` by default).',
    members: [['Payroll summary', 'Totals by payroll category (wages, tax, deductions, super, entitlements, expenses) with hours and employees']],
    checks: ['**Independent tie:** wages and PAYG = MYOB\'s payroll category summary', 'Pay runs add up to the paycheques'],
    golden: 'MYOB Payroll summary for the same period',
    fileName: 'myob-payroll-summary.html', tags: ['myob', 'payroll', 'summary', 'M20'],
  },
  {
    m: 'M25', also: ['M26'], skill: 'accrual-by-fund', name: 'MYOB Accrual by Fund', report: 'pyf', wave: 'Wave 3 (P3) — M25 and the detail M26',
    title: 'Accrual by Fund', menu: 'Reporting → Reports → Payroll → Accrual by fund',
    trigger: 'the user asks for superannuation accrual by fund, super by fund, super accrued per employee, or the super guarantee owed to each fund',
    discovery: 'As for MYOB Pay Run History: `list_payroll_advices` once (each paycheque\'s Superannuation lines and `SuperannuationFund`), `get_payroll_category_summary` once, `list_company_files` once.',
    dates: '`from_date` / `to_date` = the period by payment date (default: this financial year to date; a super quarter is the usual choice). The view is display `v` (`fund` by default).',
    members: [['Accrual by fund', 'Super accrued per fund'], ['Accrual by fund (detail)', 'Per fund and employee: pays and super accrued (M26)']],
    checks: ['**Independent tie:** wages and PAYG = MYOB\'s payroll category summary', 'Pay runs add up to the paycheques'],
    golden: 'MYOB Accrual by fund for the same period',
    fileName: 'myob-accrual-by-fund.html', tags: ['myob', 'payroll', 'superannuation', 'M25', 'M26'],
  },
  {
    m: 'M27', skill: 'myob-superannuation-payments', name: 'MYOB Superannuation Payments', report: 'pyp', wave: 'Wave 3 (P3)',
    title: 'Superannuation Payments', menu: 'Reporting → Reports → Payroll → Superannuation payments',
    trigger: 'the user asks for superannuation payments, super paid, whether super has been paid, or super accrued versus paid for a quarter',
    discovery: 'As for MYOB Pay Run History, plus `list_journal_transactions` for the period and `list_accounts` once: MYOB\'s API has no super payment list, so super paid = the cash payments debiting the super payable account. A `{"__error": …}` result is a failed call: report its message',
    dates: '`from_date` / `to_date` = the period (default: this financial year to date; a super quarter is the usual choice). The view is display `v` (`super` by default).',
    members: [['Superannuation payments', 'Payments from the super payable account (date, description, amount) and super accrued vs paid'], ['Payments by fund from MYOB\'s Pay Superannuation', 'N/A — not in MYOB\'s API (approximated from the journals)']],
    checks: ['**Independent tie:** wages and PAYG = MYOB\'s payroll category summary', 'Super accrued (paycheques) vs paid from the super payable account (information)'],
    golden: 'MYOB Superannuation payments for the same period (by fund there; total here)',
    fileName: 'myob-superannuation-payments.html', tags: ['myob', 'payroll', 'superannuation', 'payments', 'M27'],
  },
  {
    "m": "M30",
    "skill": "pay-item-transactions",
    "name": "MYOB Pay Item Transactions",
    "report": "pyi",
    "wave": "Wave 3 (P3)",
    "title": "Pay Item Transactions",
    "menu": "Reporting → Reports → Payroll → Pay item transactions",
    "trigger": "the user asks for pay item transactions, payroll transactions grouped by pay item or payroll category, every employee paid a pay item, or totals per pay item for a period",
    "discovery": "Call `list_payroll_advices` once with `from_date` / `to_date` 45 days wider than the period (the kit derives `adv_from` / `adv_to`), and `list_company_files` once. Every paycheque's lines are grouped by `PayrollCategory.Name` — no call per employee is needed",
    "dates": "`from_date` / `to_date` = the period by payment date (default: this financial year to date; display preset `p`). `adv_from` / `adv_to` are derived by the kit — leave them. The view is display `v` (`items` by default; the other payroll views are there too).",
    "members": [
      [
        "Pay item transactions",
        "One section per pay item (wages, tax, super, deductions…): each employee's paycheque lines with payment date, period end, hours and amount, and a total per pay item"
      ],
      [
        "Other payroll views",
        "Report = Pay run history, Payroll register, Payroll summary, Accrual by fund, Superannuation payments"
      ]
    ],
    "checks": [
      "**Independent tie:** wages and PAYG on the paycheques = MYOB's payroll category summary for the period",
      "Pay item totals = every paycheque line",
      "Pay runs add up to the paycheques"
    ],
    "golden": "mySMB.com FY to date: Base Salary, PAYG Withholding and Superannuation Guarantee sections for Alex Morgan and Sam Lee; wages and PAYG equal the payroll category summary",
    "fileName": "myob-pay-item-transactions.html",
    "tags": [
      "myob",
      "payroll",
      "M30",
      "pay-items"
    ]
  },
  {
    "m": "M24",
    "skill": "timesheets",
    "name": "MYOB Timesheets",
    "report": "tm",
    "wave": "Wave 3 (P3)",
    "title": "Timesheets",
    "menu": "Reporting → Reports → Payroll → Timesheets",
    "trigger": "the user asks for timesheets, hours logged by employees, time by week or by job or customer, or unprocessed timesheet hours",
    "discovery": "Call `list_timesheets` once with `from_date` / `to_date` = the period, and `list_company_files` once. Expect `{Employee, StartDate, EndDate, Lines:[{PayrollCategory, Job, Activity, Customer, Notes, Entries:[{Date, Hours, Processed}]}]}` — entries are kept by their own date. Logged time is not paid hours: never compare it with pay advices",
    "dates": "`from_date` / `to_date` = the period (default: this month; display preset `p`). The view is display `v` (`weeks` | `summary`); `x` = an employee UID.",
    "members": [
      [
        "Timesheets",
        "Per employee per week: hours and whether processed, with daily entries (date, payroll category, job · activity · customer, notes, hours, processed)"
      ],
      [
        "Hours by employee",
        "Report = Hours by employee (by payroll category: hours, processed, not yet processed)"
      ],
      [
        "Employee picker",
        "Employee select above the report"
      ],
      [
        "Cost and billing rates",
        "N/A — not in the timesheet list"
      ]
    ],
    "checks": [
      "Hours per employee add up to the hours logged",
      "Every entry is dated inside its timesheet week",
      "For information: hours not yet processed in a pay run"
    ],
    "golden": "mySMB.com September 2026: Alex Morgan 7.6 hours a day, Sam Lee 4 hours Monday–Thursday; the last week not yet processed",
    "fileName": "myob-timesheets.html",
    "tags": [
      "myob",
      "timesheets",
      "M24",
      "payroll"
    ]
  },
  {
    "m": "M28",
    "also": [
      "M29"
    ],
    "skill": "leave-balance",
    "name": "MYOB Leave Balance",
    "report": "lv",
    "wave": "Wave 3 (P3) — M28 and the detail M29",
    "title": "Leave Balance",
    "menu": "Reporting → Reports → Payroll → Leave balance / Leave balance (detail)",
    "trigger": "the user asks for leave balances, annual or personal leave owing, holiday leave accrued, entitlement balances, leave liability, or the leave balance detail",
    "discovery": "Call `list_employee_leave_balances` once, and `list_company_files` once. Expect, per active employee, `Entitlements:[{Name, IsAssigned, CarryOver, YearToDate, Total}]` (Total = CarryOver + YearToDate, in hours) with `HourlyRate`. Tax file numbers, dates of birth and payslip email are not returned by the connector. Discover the entitlement names (they differ per file)",
    "dates": "No dates — balances are today's. The view is display `v` (`employees` | `entitlements` for the detail by entitlement).",
    "members": [
      [
        "Leave balance",
        "Per employee: each entitlement's hours carried over, this year (net) and balance, and a value at the hourly rate (estimate)"
      ],
      [
        "Leave balance (detail)",
        "Report = Leave balance (detail): by entitlement, every employee under it"
      ],
      [
        "Negative balances",
        "Flagged above the table"
      ],
      [
        "Balances at a past date; accrued and taken separately",
        "N/A — MYOB keeps today's balance and the net for the year"
      ]
    ],
    "checks": [
      "Carried over + this year = balance (every entitlement — MYOB's own definition)",
      "For information: negative leave balances",
      "For information: balances without an hourly rate (not valued)"
    ],
    "golden": "mySMB.com: Alex Morgan Holiday Leave 114.50 hours (76.00 carried over + 38.50 this year); Sam Lee Personal Leave negative",
    "fileName": "myob-leave-balance.html",
    "tags": [
      "myob",
      "leave",
      "M28",
      "M29",
      "payroll"
    ]
  },
  {
    m: 'M40', skill: 'unpaid-bills', name: 'MYOB Unpaid Bills', report: 'ub', wave: 'Wave 2 (P2)',
    title: 'Unpaid Bills', menu: 'Reporting → Reports → Purchases → Unpaid bills',
    trigger: 'the user asks for unpaid bills, what they owe suppliers, outstanding purchase bills, a payment run list, or payables by supplier with ageing',
    discovery: 'Call `list_bills` once with `status` = `Open`, and `list_company_files` once. Expect `{Count, Items:[{Number, Date, SupplierInvoiceNumber, Supplier{Name, DisplayID, UID}, BalanceDueAmount, TotalAmount, TotalTax, Terms{DueDate}, Status}]}`. A `{"__error": …}` result is a failed call: report its message',
    dates: 'Always as at today — MYOB\'s API gives today\'s open balances (the kit sets `as_at`; leave it). The ageing method is `method` (`Bill date` — MYOB\'s default — or `Due date`). The view is display `v` (`suppliers` | `bills`).',
    members: [['Unpaid bills', 'Supplier name | Supplier number | 0 - 30 | 31 - 60 | 61 - 90 | 90+ | Total due, one row per supplier, totals row'], ['Bills', 'Report = Bills (each open bill with its age)'], ['Ageing by due date', 'Ageing method = Days since due date (adds a Not due column)'], ['As at an earlier date', 'N/A — MYOB\'s API gives today\'s open balances']],
    checks: ['Each supplier\'s total due = Σ its age buckets, and the report total = Σ the bills', '**Independent tie:** total due = the payables account (type Accounts Payable) on the Balance Sheet', 'Every unpaid bill has a supplier (and a due date when ageing by due date)'],
    golden: 'mySMB.com as at 9 Sep 2026: no unpaid bills (the sample file is empty — the columns mirror Unpaid invoices); on a file with bills, the total due = the payables account',
    fileName: 'myob-unpaid-bills.html', tags: ['myob', 'unpaid-bills', 'M40', 'payables'],
  },
  {
    m: 'M40', skill: 'aged-payables', name: 'MYOB Aged Payables', report: 'ap', wave: 'Wave 2 (P2 — the unpaid bills report aged by due date)',
    title: 'Aged Payables', menu: 'Reporting → Reports → Purchases → Unpaid bills (ageing by due date)',
    trigger: 'the user asks for aged payables, aged creditors, an ageing of what they owe suppliers, or overdue bills by age',
    discovery: 'Call `list_bills` once with `status` = `Open`, and `list_company_files` once. A `{"__error": …}` result is a failed call: report its message',
    dates: 'Always as at today — MYOB\'s API gives today\'s open balances. Ageing is by due date (`method` = `Due date`; set `Bill date` for MYOB\'s default). The view is display `v` (`suppliers` | `bills`).',
    members: [['Aged payables', 'Supplier | Not due | 1 - 30 | 31 - 60 | 61 - 90 | 90+ | Total due'], ['Bills', 'Report = Bills'], ['Ageing by bill date', 'Ageing method = Days since bill date']],
    checks: ['Each supplier\'s total due = Σ its age buckets', '**Independent tie:** total due = the payables account on the Balance Sheet', 'Every unpaid bill has a supplier and a due date'],
    golden: 'mySMB.com: no unpaid bills on the sample file; on a file with bills, the total due = the payables account',
    fileName: 'myob-aged-payables.html', tags: ['myob', 'aged-payables', 'payables', 'ageing'],
  },
  {
    m: 'M41, M42', skill: 'payables-reconciliation', name: 'MYOB Payables Reconciliation', report: 'pr', wave: 'Wave 2 (P2)',
    title: 'Payables Reconciliation', menu: 'Reporting → Reports → Purchases → Payables reconciliation with tax / Payables reconciliation exceptions',
    trigger: 'the user asks for a payables reconciliation, to reconcile creditors or accounts payable, whether the supplier balances match the payables account, or payables exceptions',
    discovery: 'Call `list_bills` once with `status` = `Open`, `get_balance_sheet` once with `date` = today, and `list_company_files` once. A `{"__error": …}` result is a failed call: report its message',
    dates: 'Always as at today (MYOB\'s API gives today\'s open balances; the kit sets `as_at`). Reconciliation with tax (M41) or exceptions (M42) is display `v` (`recon` | `exceptions`).',
    members: [['Payables reconciliation with tax (M41)', 'Name | Amount outstanding | Tax outstanding per supplier; Total; Payables account; Out of balance amount'], ['Payables reconciliation exceptions (M42)', 'Report = Reconciliation exceptions (the tie-out and its possible causes)'], ['As at an earlier date', 'N/A — MYOB\'s API gives today\'s open balances']],
    checks: ['**Independent tie:** total outstanding − the payables account (Balance Sheet) = out of balance amount, 0.00 expected', 'Tax outstanding = each bill\'s tax pro rata to what is still owed', 'Each bill: subtotal + tax = total'],
    golden: 'mySMB.com: no open bills on the sample file — total outstanding 0.00 = payables account 0.00, out of balance 0.00',
    fileName: 'myob-payables-reconciliation.html', tags: ['myob', 'payables', 'reconciliation', 'M41', 'M42'],
  },
  {
    m: 'M46', skill: 'purchase-register', name: 'MYOB Purchase Register', report: 'pg', wave: 'Wave 2 (P2)',
    title: 'Purchase Register', menu: 'Reporting → Reports → Purchases → Purchase register',
    trigger: 'the user asks for a purchase register, a list of purchase bills for a period, or bills by status',
    discovery: 'Call `list_bills` once with `status` = `All`, `from_date` / `to_date` = the period, and `list_company_files` once. A `{"__error": …}` result is a failed call: report its message',
    dates: '`from_date` / `to_date` = the period (default: the financial year to date; display preset `p` = `this_fy_td`, `this_month`, `last_month`, `this_quarter`, `last_quarter`, `last_fy` or `custom`). `status` = `All`, `Open` or `Closed`. `as_at` is set by the kit. The view is display `v` (`register` | `suppliers`).',
    members: [['Purchase register', 'Date | PO No. | Supplier Inv No. | Supplier name | Amount | Amount due | Status, totals row'], ['Supplier purchases', 'Report = Supplier purchases (M43)'], ['Purchase orders, quotes and the Received column', 'N/A — the connector reads bills only']],
    checks: ['**Independent tie:** Σ bill amounts (with tax) = the credits to the payables account in the period\'s journals', 'Σ amount due = the payables account on the Balance Sheet (when every open bill is in the period; information otherwise)', 'Counts by status add up to the bills listed'],
    golden: 'mySMB.com 1 Jul – 9 Sep 2026: no bills on the sample file; on a file with bills, Σ bills = the payables account\'s credits in the period',
    fileName: 'myob-purchase-register.html', tags: ['myob', 'purchase-register', 'M46', 'purchases'],
  },
  {
    "m": "M45",
    "skill": "supplier-transactions",
    "name": "MYOB Supplier Transactions",
    "report": "ts",
    "wave": "Wave 2 (P2)",
    "title": "Supplier Transactions",
    "menu": "Reporting → Reports → Purchases → Supplier transactions",
    "trigger": "the user asks for supplier transactions, a supplier history or activity, bills and payments for a supplier, or all purchase transactions in a period",
    "discovery": "Call `list_bills` once with `status` = `All` and `from_date` / `to_date` = the period, `list_supplier_payments` once for the same dates (`page_size` 1000), and `list_company_files` once. Supplier credits come back as negative bills. A `{\"__error\": …}` result is a failed call: report its message",
    "dates": "`from_date` / `to_date` = the period (default: this month; display preset `p`). `prev_day` is derived by the kit — leave it. The view is display `v` (`suppliers` | `list`); `x` = a supplier UID to open on one supplier.",
    "members": [
      [
        "Supplier transactions",
        "Per supplier: every bill, credit and payment in date order, with charges, payments and a running net change, and a total per supplier"
      ],
      [
        "All transactions",
        "Report = All transactions (one list in date order)"
      ],
      [
        "Supplier picker",
        "Supplier select above the report"
      ],
      [
        "Supplier debit notes, refunds, adjustments",
        "N/A — not in the connector"
      ]
    ],
    "checks": [
      "**Independent tie:** bills − payments = the movement of Accounts Payable on the Balance Sheet (the day before the period and its end)",
      "Every transaction names a supplier",
      "All payments in the period were loaded (one page of 1,000; a warning when it is full)"
    ],
    "golden": "mySMB.com September 2026: bills − payments = the change in Accounts Payable between 31 August and 28 September",
    "fileName": "myob-supplier-transactions.html",
    "tags": [
      "myob",
      "supplier-transactions",
      "M45",
      "purchases"
    ]
  },
  {
    m: 'M43', skill: 'supplier-purchases', name: 'MYOB Supplier Purchases', report: 'sp', wave: 'Wave 2 (P2)',
    title: 'Supplier Purchases', menu: 'Reporting → Reports → Purchases → Supplier purchases',
    trigger: 'the user asks for supplier purchases, purchases by supplier, top suppliers, or how much they bought from each supplier in a period',
    discovery: 'Call `list_bills` once with `status` = `All`, `from_date` / `to_date` = the period, and `list_company_files` once. A `{"__error": …}` result is a failed call: report its message',
    dates: '`from_date` / `to_date` = the period (default: the financial year to date; display preset `p` as for the Purchase register). `status` = `All`, `Open` or `Closed`. The view is display `v` (`suppliers` | `register`).',
    members: [['Supplier purchases', 'Supplier name | Supplier number | Purchase amount | Tax | Current balance, totals row, top-10 chart and the largest supplier\'s share'], ['Purchase register', 'Report = Purchase register (M46)'], ['Supplier purchases (detail, M44)', 'Not yet — bill lines are not confirmed in the connector\'s bill list']],
    checks: ['**Independent tie:** Σ bill amounts = the credits to the payables account in the period\'s journals', 'Every supplier\'s current balance adds up to the payables account on the Balance Sheet', 'Counts by status add up to the bills listed'],
    golden: 'mySMB.com: no bills on the sample file; on a file with bills, every supplier\'s current balance adds up to the payables account',
    fileName: 'myob-supplier-purchases.html', tags: ['myob', 'supplier-purchases', 'M43', 'purchases'],
  },
  {
    m: 'M63', skill: 'myob-reports-catalogue', name: 'MYOB Reports Catalogue', report: 'ct', wave: 'Wave 2 (P2, delivery order 39)',
    title: 'Reports Catalogue', menu: 'Reporting → Reports → All',
    trigger: 'the user asks for the reports catalogue, the list of MYOB reports, which reports are available, what the agent can build, or wants to browse, search or favourite reports',
    discovery: 'Call `list_company_files` once (the header and the client selector). The catalogue holds no company figures: its rows are the MYOB Reports Prompt Library (M00–M63) with what this agent offers for each, built into the report',
    dates: 'No dates. `display.v` opens on a tab (`all`, `Business`, `Banking`, `Payroll`, `Sales`, `Purchases`, `Inventory`, `Jobs`, `More` or `fav`); `display.x` holds favourites as prompt IDs separated by commas (for example `M04,M32`) — set it when the user asks to keep favourites.',
    members: [['All tab and group blocks', 'Business, Banking, Payroll, Sales, Purchases, Inventory and Jobs reports, and More (dashboard, exceptions, report packs, BAS, custom reports, this catalogue)'], ['Search reports', 'Search box above the tabs'], ['Favourites', 'Star a report; the ★ Favourites tab lists them'], ['Status per report', 'Live template · On request · From your MYOB export · Guide, with the name to ask for'], ['Run a report', 'Ask the agent for it by the name shown (a catalogue cannot start a chat)']],
    checks: ['Every report maps to a prompt ID in this library (M00–M63)', 'Reports per MYOB tab match MYOB (Business 14 · Banking 5 · Payroll 12 · Sales 8 · Purchases 7 · Inventory 6 · Jobs 6)'],
    golden: '58 reports: Business 14 · Banking 5 · Payroll 12 · Sales 8 · Purchases 7 · Inventory 6 · Jobs 6, plus 6 more Reporting pages (64 prompt IDs)',
    fileName: 'myob-reports-catalogue.html', tags: ['myob', 'catalogue', 'M63'],
  },
];
