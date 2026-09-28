---
name: MYOB Inventory Value Reconciliation
description: Reconcile total on-hand inventory value against the Balance Sheet's linked inventory/stock control account, as at a date.
---

# Inventory Value Reconciliation

Prompt ID M52 · Reporting › Reports › Inventory › Inventory value reconciliation. MYOB's description: "Compares the total value of all on-hand inventory to the current balance of the linked inventory categories." Mirrors `myob-reporting-studio:receivables-reconciliation` / `myob-reporting-studio:payables-reconciliation`'s tie-out pattern, but on the ASSET side of the ledger. Those find their control accounts by MYOB account Type; inventory has no dedicated Type (it usually sits under `OtherCurrentAsset`), so a name match is used here.

Use `list_items` (active items) for the subledger side, summing `CurrentValue` across all items — this is MYOB's own computed on-hand value per item, not something derived here. Use `get_balance_sheet` (as at the selected `date`, matching basis) for the control-account side. On `AccountsBreakdown`, identify the inventory control account(s) by name pattern `/inventory|stock/i` against `Account.Name`, limited to asset accounts (join to `list_accounts` on `Account.UID` if you need `Classification`) — do not hardcode a DisplayID.

Compute `diff = subledgerTotal - controlTotal` and `tie = Math.abs(diff) < 0.01`. Render as a two-card comparison (subledger total, control account total) plus a difference row, with a Pass/Fail badge.

**Do not infer a cause when the two sides don't tie.** A manual journal against the inventory account and a genuine timing/costing-method difference look identical from this data — state that a discrepancy exists without guessing which.

**Point-in-time limitation — disclose with a visible banner:** `list_items`' `CurrentValue` reflects stock value *right now*; MYOB has no historical "on-hand value as at a past date" snapshot. If the selected Balance Sheet date isn't today, the two sides are not for the same point in time — say so before showing the comparison.

If no account matches the inventory naming pattern, render the control-account side as "not identified" and skip the Pass/Fail badge. If either source failed, the tie-out is N/A, never Pass.

## Interactivity

* Declare a `date` (as-at) input mapped to `get_balance_sheet`'s `date` param — `list_items` has no equivalent date param (see limitation above).
* Declare `basis` (enum `Accrual` / `Cash`) mapped to `get_balance_sheet`'s `reporting_basis`.
* `persona` and `company_file` inputs per the foundation skill.

## Sources & limitations

Tools used: `list_items` (all active items, summed `CurrentValue`) for the subledger; `get_balance_sheet` for the control account, as at the selected date. Control account identified by name pattern `/inventory|stock/i` among asset accounts, not a fixed DisplayID. Point-in-time limitation applies whenever the selected date isn't today.
