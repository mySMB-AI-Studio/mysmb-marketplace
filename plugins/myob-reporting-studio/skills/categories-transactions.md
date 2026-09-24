# Categories Transactions

Prompt ID M11 · Reporting › Reports › Business › Categories transactions. MYOB's description: "Displays either the debit or credit side of any transactions attached to the selected categories. It does not display the entire transactions." Use `list_journal_transactions` with `account_uid` set to the selected category, plus `from_date`/`to_date`.

**Critical distinction from General Ledger and Journal Entries:** render ONLY the single line that touches the selected account from each matching transaction (`Lines[]` filtered to `Account.UID === account_uid`) — never the transaction's other lines, which belong to different accounts entirely. This is deliberately narrower than General Ledger's own account-scoped mode; treat this as the single-purpose, category-first version of that same behavior, not a second implementation to maintain independently — if General Ledger's rendering logic changes, revisit this skill too.

Present one row per matching line: date (`DateOccurred`), journal number (`DisplayID`), description (`LineDescription`, falling back to the transaction's `Description`), and the amount under Debit or Credit per `IsCredit`. Show a period debit/credit subtotal. No running balance — same reasoning as General Ledger: this tool has no opening-balance anchor, so don't fabricate one.

Validate: total debits + total credits shown reconciles to the account's net movement for the period (debit-normal vs credit-normal per the account's classification) — cross-check against `get_account`'s `CurrentBalance` only as a loosely-dated reference figure, clearly labeled as such, never as a period-matched tie-out (no as-of-date capability exists here, consistent with every other MYOB skill in this library).

## Interactivity

* Declare a required `category` enum input mapped to `account_uid`, populated from `list_accounts`.
* Declare `from_date`/`to_date` with a client-side preset picker.
* Table sortable by date/amount; filterable by description text.

## Sources & limitations

Tools used: `list_journal_transactions` (account-scoped, client-side line filtering — same caveat as General Ledger: MYOB's nested account filter for this endpoint isn't documented, so this list is fetched broad and filtered locally), `list_accounts` for the category picker.
