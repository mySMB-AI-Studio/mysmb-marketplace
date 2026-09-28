---
name: MYOB Pay Item Transactions
description: All payroll transactions grouped by pay item (e.g. Base Salary, PAYG Withholding) across all employees, for a period — not grouped by employee. Use MYOB Payroll Register or MYOB Payroll Activity instead for an employee-first view.
---

# Pay Item Transactions

Prompt ID M30 · MYOB menu: Reporting › Reports › Payroll › Pay item transactions. MYOB's own description: "A list of all transactions grouped by pay item."

Same source and call pattern as Payroll Register/Activity: `list_employees` (`is_active: true`), then `get_employee_payroll_advice` per employee with `from_date`/`to_date`. The grouping is the orthogonal cut — by pay item first, employees within each, rather than by employee first.

**Critical unconfirmed point — resolve live, not from docs (same caveat as the other payroll skills, restated because each skill must handle it independently):** whether `from_date`/`to_date` actually filter `get_employee_payroll_advice` to multiple pay periods, or whether MYOB ignores them and this endpoint always returns just the employee's single most recent advice, is NOT confirmed by MYOB's documentation. Resolve this live: call it once for one employee and inspect the shape.
- **If multiple advices are returned across the range:** pool every `Lines[]` entry from every employee's advices in range, then group by `PayrollCategory.Name`.
- **If only the single most recent advice is ever returned:** disclose plainly that this shows only the latest pay period's transactions, not the full period — say so in the header.

Render one section per distinct `PayrollCategory.Name` (e.g. "Base Salary", "PAYG Withholding", "Superannuation Guarantee") — under each, one row per employee who has a line for that category in range, with the amount and the pay date/period it belongs to. Show a per-pay-item total, and a grand total across all pay items.

Validate: the grand total across all pay-item sections reconciles to the sum of all individual lines pooled at the start — construction-guaranteed, so a mismatch signals a real bug, not a data quirk.

## Interactivity

* Declare `from_date`/`to_date` inputs with a client-side preset picker.
* Declare `persona` per the foundation skill — Client/Executive see per-pay-item totals only; Bookkeeper/Practitioner see the employee-level rows under each pay item.
* Pay-item sections collapsible/expandable client-side once hydrated — no new data call for this.

## Sources & limitations

Tools used: `list_employees`, `get_employee_payroll_advice` per active employee, pooled and grouped client-side by pay item. State clearly whether this generation resolved the date-range aggregation to the multi-advice or single-latest-advice branch.
