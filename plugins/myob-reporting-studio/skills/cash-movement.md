---
name: MYOB Cash Movement
description: Generate a MYOB Cash Movement report — money in vs. out per bank account for a period, from ledger detail.
---

# Cash Movement / Statement of Cash Flow

Use `list_accounts` and keep the accounts with `Type` `Bank` (and `CreditCard`, if the reader wants cards included), excluding `IsHeader` accounts, to get the set of cash accounts. There is no cash-flow report tool. Then get each account's movements in the period from `list_journal_transactions` with `from_date`/`to_date`: either one unfiltered journal binding split client-side by `Lines[].Account.UID` (one call total), or one `account_uid`-mapped binding re-called per account in a bounded `getData` loop (the foundation's fan-out rule) when the unfiltered range is too large.

Do not attempt to compute a period-start or period-end balance. `list_accounts` only exposes `CurrentBalance` — the balance right now, not as of any other date. State this plainly rather than back-calculating a historical balance from current balance minus movements, which would silently assume no untracked activity exists outside the fetched range. Show current balance as a separate, clearly-labeled reference figure, not as this period's closing balance.

For each bank account, present: total money in (sum of debit-side movements — check sign convention against `IsCredit` the same way General Ledger does, don't assume), total money out (credit-side), net movement, and current balance (reference only). Below that, a chronological transaction list per account (reuse the same flatten/present pattern as `myob-reporting-studio:general-ledger` — don't redesign it) filtered to just that account's lines — the connector's `account_uid` filter returns whole transactions with ANY line on the account, so filter `Lines[]` client-side.

Validate (0.01 tolerance):
* For each account, sum of individual transaction movements equals the displayed money-in/money-out/net figures — pass-through arithmetic, same discipline as every other report.

If an account has zero transactions in the period, show it with $0 movement rather than omitting it (a bank account with no activity is itself information) — but only when its journal data actually loaded; an account whose call failed shows the error, never $0.

Disclose in Sources & limitations: no period-start/end balance is shown, only current balance and net movement; the transaction data and account-type detection are the same underlying tools used for General Ledger and Trial Balance — no new connector work was needed for this report.

## Interactivity

* Declare `from_date`/`to_date` with the same preset picker as General Ledger.
* Optional `account` `string` UID input (maxLength 36) to scope to one bank account instead of all, its dropdown filled from the cash accounts — a client-side filter, or the loop's single UID; never an enum, never `""`.
* Declare `persona` and `company_file` per the foundation skill.
* Per-account transaction tables sortable/filterable the same way as General Ledger's.
