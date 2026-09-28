---
name: MYOB Categories List
description: Generate a MYOB Categories List report — chart of accounts with balances, grouped by type.
---

# Categories List (Prompt ID M10 — Reporting › Reports › Business › Categories list)

Use `list_accounts` with no filter (or `type`/`classification` when the reader narrows it) to pull the full chart of accounts. Group rows by `Classification` — the real values are `Asset`, `Liability`, `Equity`, `Income`, `CostOfSales`, `Expense`, `OtherIncome`, `OtherExpense` (display labels may add spaces, e.g. "Cost of Sales") — with a subtotal per group, then a grand total. Show `DisplayID`, `Name`, `Type`, `IsActive`, and `CurrentBalance` per account. Header accounts (`IsHeader: true`) are grouping rows: show them as labels (indented structure), but exclude them from every subtotal and the grand total, or their roll-up balances double count.

**As-of-date limitation — disclose plainly, do not paper over it:** `list_accounts` only exposes `CurrentBalance`, the live balance right now. MYOB's "as at a specified date" framing for this report cannot be honored from this tool — there is no historical as-of-date balance available (the same limitation already disclosed for Trial Balance, which uses this identical tool). Label the balance column "Current balance" rather than implying it reflects whatever date the reader has selected, and state this explicitly in Sources & limitations rather than silently accepting an as-of-date input that does nothing.

Validate (0.01 tolerance): each classification's subtotal sums its member (non-header) accounts; subtotals sum to the grand total.

## Interactivity

* Declare `persona` and `company_file` per the foundation skill.
* No date input — since the underlying data can't honor one, don't declare a control that would silently do nothing.
* Optional `active_only` boolean presentation input (show inactive accounts or not), a client-side filter over already-hydrated data — no re-query needed, and not bound to `is_active`.
* Client-side sort by name/balance within each classification group.

## Sources & limitations

Tool used: `list_accounts` (`/GeneralLedger/Account`), no new connector work needed. Balances are current, not as-of-date — see limitation above.
