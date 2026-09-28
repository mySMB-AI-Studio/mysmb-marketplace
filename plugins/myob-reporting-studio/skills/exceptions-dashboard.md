---
name: MYOB Exceptions Dashboard
description: Generate a MYOB Exceptions Dashboard — flags genuine anomalies needing attention, not routine figures.
---

# Exceptions Dashboard

This report exists to surface things that are wrong or unusual, not to restate normal figures — if nothing genuinely exceptional is found in a category, say so plainly ("No exceptions found") rather than padding the report with routine numbers to look busy. A category whose source failed shows the error (per the foundation's error contract) and "not checked" — never "No exceptions found".

Declare bindings and reuse the detection logic of the other MYOB reports where it exists; where this report defines its own rule, the rule and threshold are stated here and disclosed in the report:

* **Balance Sheet tie-out** (`get_balance_sheet`, `date` = today): reuse the exact sign-verification and accounting-equation check from `myob-reporting-studio:balance-sheet`. If it doesn't balance, this is the single most important exception on the page — lead with it.
* **Account sign anomalies** (`list_accounts`, excluding `IsHeader` accounts): first establish the file's sign convention from the data (the same sign test `myob-reporting-studio:trial-balance` uses), then flag any account whose `CurrentBalance` sits on the opposite side from its `Classification`'s normal balance (e.g. a negative Asset). **Whitelist contra and naturally opposite accounts** — don't flag them: accumulated depreciation/amortisation and provisions/allowances for doubtful debts under Asset (name matches `/accum|depreciation|amorti[sz]ation|provision|doubtful|allowance/i`), owner drawings/dividends and current-year earnings or retained earnings in a loss position under Equity (`/drawing|dividend|earnings|retained/i`). List the whitelisted accounts in a collapsed "not flagged (contra)" note so the reader can see what was skipped. A `Bank` account below zero is flagged as "overdrawn", not as a sign error.
* **P&L concentration risk** (`get_profit_and_loss_3m`, FY to date, joined to `list_accounts` for `Classification` — the tool returns no totals): this report's own rule is "one account is more than 40% of its classification's total", applied to `Income`, `CostOfSales`, `Expense`, `OtherIncome` and `OtherExpense` only when that classification has at least 3 accounts and a non-zero total. Flag it with the account name, its amount, the classification total and the percentage.
* **Severely overdue balances** (`get_aged_receivables` / `get_aged_payables`, as at today): flag any customer/supplier with a nonzero (> 0.01) 90+ bucket — list them by name and amount, don't just show the aggregate bucket total (that's what the Dashboard card already shows; this report's job is to name names). Ageing uses today's open items.

Present each category as its own section: a clear title, a plain count ("3 exceptions found" / "No exceptions found"), and a table of the specific items when any exist. Order sections by severity: Balance Sheet tie-out first (affects the whole set of books), then sign anomalies, then concentration risk, then severely overdue balances.

Validate (0.01 tolerance):
* Each flagged item's underlying figure matches what its source tool actually returned (a pass-through check, same as Dashboard) — this report selects and highlights, it doesn't invent figures. Checks over failed sources are N/A.

Disclose in Sources & limitations exactly which thresholds were used (the 40% concentration rule and its 3-account minimum, the 90+ day bucket, the contra whitelist patterns) so the reader knows what "exception" means here, and that these are heuristics, not MYOB-flagged issues — MYOB itself doesn't have an "exceptions" concept in its API.

## Interactivity

* Declare `from_date`/`to_date` date inputs for the P&L binding; on load compute FY to date client-side (1 July → today) and re-query with `MyHubReport.getData`. Everything else is as at today.
* Declare `basis` (enum `Accrual` / `Cash`), and `persona` and `company_file` per the foundation skill.
* A **Refresh** button re-runs every check.
* Each section's table sortable by amount.
