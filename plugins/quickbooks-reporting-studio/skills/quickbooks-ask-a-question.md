---
name: quickbooks-ask-a-question
description: Answer a plain-English question about QuickBooks Online figures with one tool call, the exact period and the source line, and offer the full live report (Q37). Use when the user asks a plain-English question about their QuickBooks figures, such as how much was spent on something, who owes the most, what net profit was, or what the bank balance is.
---

# Ask a question (Q37)

Use when the user asks a plain-English question about their QuickBooks figures, such as how much was spent on something, who owes the most, what net profit was, or what the bank balance is. This replaces QuickBooks' "Ask a question (BETA)" and Intuit Intelligence. It answers in chat; it does not build a page unless the user wants the full report.

## Steps

1. **Decide the shape.** One figure or a short list ("net profit last month", "who owes us the most", "bank balance") → answer in chat. A full statement, dashboard or pack → load `quickbooks-reporting-studio:quickbooks-report-foundation` and the family skill (table below) and build the report.
2. **Resolve the period** from the question. Read `FiscalYearStartMonth` with `qbo_query` (`SELECT * FROM CompanyInfo`) for "this financial year" or "year to date". Always state the exact dates you used. If the period is genuinely ambiguous, ask one short question.
3. **Call one tool** that holds the answer:

| Question | Tool | Read |
|---|---|---|
| Income, expenses, gross or net profit for a period | `get_report_profit_and_loss` (start_date, end_date, accounting_method) | Section groups Income, COGS, GrossProfit, Expenses, NetIncome |
| Spending on an account or category | `get_report_profit_and_loss` | The account row (match by label, case-insensitive) |
| Spending with a supplier | `get_report_vendor_expenses` | The supplier row |
| Sales to a customer or of a product | `get_report_customer_sales` / `get_report_item_sales` | The customer / product row |
| Who owes us / what is overdue | `get_report_aged_receivables` | Rows and bands; TOTAL |
| Who we owe / bills due | `get_report_aged_payables` | Rows and bands; TOTAL |
| Bank or card balances | `list_account` (where "AccountType IN ('Bank', 'Credit Card')") | CurrentBalance ("In QuickBooks") |
| Assets, liabilities, equity at a date | `get_report_balance_sheet` (end_date) | Groups TotalAssets, Liabilities, Equity |
| GST for a quarter | `get_report_tax_summary` | BAS labels 1A, 1B, 9 (may return no rows — then say GST is unavailable, not zero) |
| A specific invoice or bill | `list_invoice` / `list_bill` (where "DocNumber = '…'") | Balance, DueDate |

4. **Answer** in one to three sentences: the figure (QuickBooks format, e.g. -A$175,286.75), the period, the basis, and the source — "from the QuickBooks Profit and Loss, 1 August 2026 to 31 August 2026, accrual basis, line Net Income". If you added lines together, list them.
5. **Offer the full report** ("Want the live Profit and Loss for August?") and build it with the family skill if the user says yes.

## Guardrails

- Only figures a tool returned. Never estimate, forecast or advise. Missing data is "N/A — not in source".
- If QuickBooks is not connected, say so and point to Settings → Connections.
- Questions the Accounting API cannot answer (audit log, payroll, bank-feed status): say so and offer the QuickBooks export route.

## Validation

- Answer figures tie to the underlying report (the answer names the report line or lines used)

## Routing — full reports

| Family | Skill |
|---|---|
| Q17 Profit and Loss family | `quickbooks-reporting-studio:quickbooks-profit-and-loss` |
| Q18 Balance Sheet family | `quickbooks-reporting-studio:quickbooks-balance-sheet` |
| Q19 Statement of Cash Flows | `quickbooks-reporting-studio:quickbooks-statement-of-cash-flows` |
| Q24 Accounts receivable family | `quickbooks-reporting-studio:quickbooks-aged-receivables` |
| Q26 Accounts payable family | `quickbooks-reporting-studio:quickbooks-aged-payables` |
| Q22 Trial Balance family | `quickbooks-reporting-studio:quickbooks-trial-balance` |
| Q28 GST and PAYG family (BAS) | `quickbooks-reporting-studio:quickbooks-gst-bas` |
| Q15 GST overview (BAS centre) | `quickbooks-reporting-studio:quickbooks-gst-overview` |
| Q20 Business Snapshot | `quickbooks-reporting-studio:quickbooks-business-snapshot` |
| Q00 Homepage — Business at a glance | `quickbooks-reporting-studio:quickbooks-homepage` |
| Q07 Cash flow overview | `quickbooks-reporting-studio:quickbooks-cash-flow-overview` |
| Q06 Performance centre (KPI charts) | `quickbooks-reporting-studio:quickbooks-performance-centre` |
| Q04 Management reports (report packs) | `quickbooks-reporting-studio:quickbooks-management-reports` |
| Q16 Client overview (accountant-only) | `quickbooks-reporting-studio:quickbooks-client-overview` |
| Q23 General Ledger and transaction-list family | `quickbooks-reporting-studio:quickbooks-general-ledger` |
| Q25 Sales and customers family | `quickbooks-reporting-studio:quickbooks-sales-and-customers` |
| Q27 Expenses and suppliers family | `quickbooks-reporting-studio:quickbooks-expenses-and-suppliers` |
| Q01 Business feed | `quickbooks-reporting-studio:quickbooks-business-feed` |
| Q08 Budgets (Budget vs Actuals) | `quickbooks-reporting-studio:quickbooks-budgets` |
| Q10 Expenses & Pay Bills overview | `quickbooks-reporting-studio:quickbooks-expenses-overview` |
| Q11 Sales & Get Paid overview | `quickbooks-reporting-studio:quickbooks-sales-overview` |
| Q14 Inventory overview | `quickbooks-reporting-studio:quickbooks-inventory-overview` |
| Q30 Inventory family | `quickbooks-reporting-studio:quickbooks-inventory` |
| Q12 Customer Hub overview | `quickbooks-reporting-studio:quickbooks-customer-hub` |
| Q13 Projects overview | `quickbooks-reporting-studio:quickbooks-projects-overview` |
| Q29 Projects family | `quickbooks-reporting-studio:quickbooks-projects` |
| Q36 Exchange gains and losses (multi-currency) | `quickbooks-reporting-studio:quickbooks-exchange-gains-losses` |
| Q35 Custom report builder | `quickbooks-reporting-studio:quickbooks-custom-report-builder` |

## QA test script

1. Ask five questions covering profit, a supplier, who owes the most, the bank balance and GST. Each answer states the figure, the exact period, the basis and the source line, and matches the same QuickBooks report.
2. Example: 'What was net profit in August?' → Net Earnings −A$175,286.75 (Profit and Loss, August 2026, accrual).
3. Ask an ambiguous question ("how did we do?") — the agent asks one short clarifying question or picks a stated default period.
