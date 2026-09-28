---
name: MYOB Exceptions Dashboard
description: Generate a MYOB Exceptions Dashboard — flags genuine anomalies needing attention, not routine figures.
---

# Exceptions Dashboard

This report exists to surface things that are wrong or unusual, not to restate normal figures — if nothing genuinely exceptional is found in a category, say so plainly ("No exceptions found") rather than padding the report with routine numbers to look busy.

Declare bindings and reuse the exact detection logic already proven in the other MYOB reports — don't invent new heuristics:

* **Balance Sheet tie-out** (`get_balance_sheet`, as at today): reuse the exact sign-verification and accounting-equation check from `myob-balance-sheet`. If it doesn't balance, this is the single most important exception on the page — lead with it.
* **Account sign anomalies** (`list_accounts`): flag any Asset-classified account with a negative `CurrentBalance`, or Liability/Equity-classified account with a positive one where the sign convention says otherwise — this is exactly the same category of issue as the anomalies already found in Balance Sheet/Trial Balance. Reuse that classification/sign logic, don't rebuild it differently here.
* **P&L concentration risk** (`get_profit_and_loss`, current month and/or YTD): reuse the same "one account >40% of its classification total" check already used in the P&L skill. Flag it here as an exception, with the account name and both raw figures.
* **Severely overdue balances** (`get_aged_receivables` / `get_aged_payables`, as at today): flag any customer/supplier with a nonzero 90+ bucket specifically — list them by name and amount, don't just show the aggregate bucket total (that's what the Dashboard card already shows; this report's job is to name names).

Present each category as its own section: a clear title, a plain count ("3 exceptions found" / "No exceptions found"), and a table of the specific items when any exist. Order sections by severity: Balance Sheet tie-out first (affects the whole set of books), then sign anomalies, then concentration risk, then severely overdue balances.

Validate:
* Each flagged item's underlying figure matches what its source tool actually returned (a pass-through check, same as Dashboard) — this report doesn't compute anything new, it selects and highlights.

Disclose in Sources & limitations exactly which thresholds were used (the 40% concentration threshold, the 90+ day bucket) so the reader knows what "exception" means here, and that these are heuristics, not MYOB-flagged issues — MYOB itself doesn't have an "exceptions" concept in its API.

## Interactivity

* No date range beyond each check's natural current-period/as-at-today default, same as Dashboard. 
* A **Refresh** button re-runs every check. 
* Each section's table sortable by amount.
