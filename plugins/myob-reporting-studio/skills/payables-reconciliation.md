---
name: MYOB Payables Reconciliation
description: Reconciles the open-bill subledger against the Balance Sheet's Accounts Payable control account, as at a date. Declares a detail_level toggle — Summary shows just the tie-out comparison; Detail adds the per-bill, tax-code breakdown.
---

# Payables Reconciliation

Prompt ID M41/M42 (merged) · MYOB menu: Reporting › Reports › Purchases › Payables reconciliation with tax / Payables reconciliation exceptions. This is the exact payables mirror of `myob-reporting-studio:receivables-reconciliation`: `Purchase/Bill` in place of `Sale/Invoice`, an Accounts Payable control account in place of Accounts Receivable. Same tools, same tie-out mechanics, opposite side of the ledger.

Use `list_bills` (`status: "Open"`, `page_index: 0` so every page is fetched) for the subledger side, and `get_balance_sheet` (as at the selected `date`, matching basis) for the control-account side. The subledger total is the sum of `BalanceDueAmount` across all open bills — the amount still owed, not `TotalAmount`. Open supplier credits/debit notes (negative bills — check the live status value, e.g. `Credit`/`Debit`) reduce the payable: include them with their sign, and if this file's `status: "Open"` call doesn't return them, say so in Sources & limitations, since unapplied supplier credits would then show up as a difference.

Identify the Accounts Payable control account(s) with a `list_accounts` binding filtered to `type: "AccountsPayable"` (exclude `IsHeader` accounts) — never a name regex or a hardcoded DisplayID, company files vary. Match those UIDs against the Balance Sheet's `AccountsBreakdown` `Account.UID` and sum their `AccountTotal` for the control-account total.

Compute `diff = subledgerTotal - controlTotal` and `tie = Math.abs(diff) < 0.01`.

**Always render the Summary section**, regardless of `detail_level`: a two-card layout (subledger total, control account total) plus a difference row, with a Pass/Fail badge — this is the cheap default, no extra calls beyond the three bindings above.

**When `detail_level` is "Detail", additionally render the per-bill, tax-code breakdown** underneath the summary comparison — the full bill-level detail and aging that the subledger total was built from.

These rules apply regardless of `detail_level` — never gated by the toggle:

* **Do not infer a cause when the two sides don't tie.** A manual journal against the control account and a genuine timing difference look identical from this data — state plainly that a discrepancy exists and that this report cannot distinguish between them, rather than guessing.
* **Point-in-time limitation — disclose with a visible banner, not just in Sources:** `list_bills` with `status: "Open"` reflects bills open *right now*; MYOB has no historical "open as at a past date" snapshot. If the selected Balance Sheet date is not today, the two sides are not for the same point in time — say so before showing the comparison.
* If no `AccountsPayable` account is found (or none of them appears on the Balance Sheet), render the control-account side as "not identified" rather than guessing an account, and skip the tie-out badge (render "control account not identified" instead of Pass/Fail) — regardless of `detail_level`.
* If either source failed (see the foundation's error contract), the tie-out is N/A — never Pass.

## Interactivity

* Declare a `date` (as-at) input mapped to `get_balance_sheet`'s `date` param; `list_bills` has no date param for "open as at X" (see limitation above) so it always reflects current opens regardless of the selected date — the banner covers this.
* Declare `basis` (enum `Accrual` / `Cash`) mapped to `get_balance_sheet`'s `reporting_basis`.
* Declare `detail_level` (enum: Summary / Detail, default Summary) — a presentation input, distinct from `persona`: `persona` controls display density of whatever's already being rendered; `detail_level` controls whether the per-bill/tax-code breakdown renders at all. No per-bill drill-down beyond this is required (that's Aged Payables' job) — keep the Detail section to the tax/aging breakdown itself.
* Declare `persona` and `company_file` per the foundation skill.

## Sources & limitations

Tools used: `list_bills` (status=Open, all pages) for the subledger, summed on `BalanceDueAmount`; `get_balance_sheet` (matching basis) for the GL control account, as at the selected date; `list_accounts` (`type: "AccountsPayable"`) to identify the control account. Point-in-time limitation applies whenever the selected date isn't today (see banner above). `detail_level` changes only what's rendered, never what's queried or computed.
