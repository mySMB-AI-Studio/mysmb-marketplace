# Budget Management

Prompt ID M01. Menu: Reporting › Reports › Business › Budget management.

Use `get_budget` with `financial_year` (MYOB only exposes the current AU FY or the next FY — no historical budget years). The tool returns a `Budgets` array of `{Account: {Name, DisplayID}, MonthlyBudgets: [{Year, Month, Amount}]}` per account.

Render one row per account with a column per month (Jul–Jun for the AU FY), plus a row total. Group by account Type/Classification the same way Categories List does, since budgets are set per GL account. Show a company-wide total row summing all accounts per month.

If `Budgets` comes back empty, this is a genuine empty state (no budget set up in this company file for the selected year) — say so plainly, don't render a fabricated zero grid as if it were real data.

**Scope note:** this report shows the budget figures MYOB holds, not a budget-vs-actual variance comparison — MYOB's own "Budget management" report is the budget numbers themselves; a variance view would need to cross-reference `get_profit_and_loss` per account per month, which is out of scope here unless requested separately.

## Interactivity

* Declare a `financial_year` enum input (current FY / next FY only, per the tool's real constraint) — re-query `get_budget` on change.
* `persona` input per the foundation skill.

## Sources & limitations

Tool used: `get_budget`. MYOB restricts this endpoint to the current or next financial year only — do not offer a year picker beyond those two options.
