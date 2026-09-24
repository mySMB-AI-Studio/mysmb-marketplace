# Bank Transactions

Prompt ID M16. Menu: Reporting › Reports › Banking › Bank transactions.

Use `list_bank_statement_lines` (`status: "All"`, `account_uid`, date range). This calls MYOB's `Banking/Statement` endpoint directly — the same bank-feed/imported-statement data the Bank Transactions page in MYOB shows, unlike Bank Activity (a separate report in this library) which is derived from the general ledger. Say this distinction plainly in the header: this report reflects bank-feed lines, not journal postings.

Fields per line: `Date`, `Description`, `Amount`, `IsCredit` (deposit vs withdrawal), `Status` (Uncoded/Coded/Hidden), `Reference`. Compute a running balance client-side by accumulating signed amounts (`IsCredit` → add, else subtract) in date order, seeded from the account's opening position if available — if not available, start the running column at the first transaction's own signed amount and disclose that it's a running total *from the start of the selected range*, not a true account balance, unless a starting balance is independently confirmed.

## Interactivity

* Declare `account` (enum, from `list_accounts` type=Bank) mapped to `account_uid` — required, since this report is always scoped to one account.
* Declare `from_date`/`to_date` inputs.
* `persona` input per the foundation skill; hide `Status`/`Reference` columns in summary mode, keep the running-balance column visible always.

## Sources & limitations

Tool used: `list_bank_statement_lines`. The `Account/UID`/`Status` server-side filter syntax on `Banking/Statement` is not documented with a worked example in MYOB's docs (flagged in the connector code) — if filtering misbehaves, fall back to client-side filtering of the full page the way `list_journal_transactions` already does for its account scoping.
