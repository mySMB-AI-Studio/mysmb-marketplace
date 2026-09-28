---
name: MYOB Budget Management
description: View GL account budgets by month for the current or next financial year.
---

# Budget Management

Prompt ID M01. Menu: Reporting › Reports › Business › Budget management.

Use `get_budget` with `financial_year` as an integer — the year the AU financial year ends (2027 = FY2026-27). MYOB only exposes the current FY or the next FY — no historical budget years. The tool returns a `Budgets` array of `{Account: {Name, DisplayID}, MonthlyBudgets: [{Year, Month, Amount}]}` per account.

Render one row per account with a column per month (Jul–Jun for the AU FY), plus a row total. Group by account Classification the same way Categories List does, since budgets are set per GL account: add a `list_accounts` binding and join on the account (`DisplayID`, or `UID` if the budget rows carry one) to get each account's `Classification`; exclude `IsHeader` accounts from group subtotals. Show a company-wide total row summing all accounts per month. A budget row that matches no account goes in a visible "Unmatched" group.

If `Budgets` comes back empty, this is a genuine empty state (no budget set up in this company file for the selected year) — say so plainly, don't render a fabricated zero grid as if it were real data. If `get_budget` returns an error (e.g. a year outside current/next), show it per the foundation's error contract.

**Scope note:** this report shows the budget figures MYOB holds, not a budget-vs-actual variance comparison — MYOB's own "Budget management" report is the budget numbers themselves; a variance view would need to cross-reference `get_profit_and_loss_3m` per account per month, which is out of scope here unless requested separately.

Validate (0.01 tolerance): each account's row total equals the sum of its months; the company-wide monthly totals equal the sum of the account rows.

## Interactivity

* Declare `financial_year` as a `number` input (not an enum) mapped to `financial_year`, defaulting to the current FY at authoring. On load, compute the current FY client-side (the year of the next 30 June) and re-query if the default is stale. The control offers only the current and next FY, per the tool's real constraint.
* `persona` and `company_file` inputs per the foundation skill.

## Sources & limitations

Tools used: `get_budget`, plus `list_accounts` for classification grouping. MYOB restricts this endpoint to the current or next financial year only — do not offer a year picker beyond those two options.
