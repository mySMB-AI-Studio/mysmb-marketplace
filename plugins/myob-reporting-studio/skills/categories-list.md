# Categories List (Prompt ID M10 — Reporting › Reports › Business › Categories list)

Use `list_accounts` with no filter (or `type`/`classification` when the reader narrows it) to pull the full chart of accounts. Group rows by `Classification` (Asset, Liability, Equity, Income, Cost of Sales, Expense, Other Income, Other Expense) with a subtotal per group, then a grand total. Show `DisplayID`, `Name`, `Type`, `IsActive`, and `CurrentBalance` per account.

**As-of-date limitation — disclose plainly, do not paper over it:** `list_accounts` only exposes `CurrentBalance`, the live balance right now. MYOB's "as at a specified date" framing for this report cannot be honored from this tool — there is no historical as-of-date balance available (the same limitation already disclosed for Trial Balance, which uses this identical tool). Label the balance column "Current balance" rather than implying it reflects whatever date the reader has selected, and state this explicitly in Sources & limitations rather than silently accepting an as-of-date input that does nothing.

Validate: each classification's subtotal sums its member accounts; subtotals sum to the grand total.

## Interactivity

* Declare `persona` per the foundation skill.
* No date input — since the underlying data can't honor one, don't declare a control that would silently do nothing.
* Optional `is_active` toggle (show inactive accounts or not), client-side filter over already-hydrated data — no re-query needed.
* Client-side sort by name/balance within each classification group.

## Sources & limitations

Tool used: `list_accounts` (`/GeneralLedger/Account`), no new connector work needed. Balances are current, not as-of-date — see limitation above.
