---
name: MYOB Categories Transactions
description: Use when the user wants ONLY the single debit or credit line touching one selected category/account — not the whole transaction and not a full account ledger. If they want the complete journal entry (all lines together), use MYOB Journal Entries; for a full account-by-account ledger, use MYOB General Ledger.
---

# Categories Transactions

Prompt ID M11 · Reporting › Reports › Business › Categories transactions. MYOB's description: "Displays either the debit or credit side of any transactions attached to the selected categories. It does not display the entire transactions." Use `list_journal_transactions` with `account_uid` set to the selected category, plus `from_date`/`to_date`.

**Critical distinction from General Ledger and Journal Entries:** the connector's `account_uid` filter returns every transaction with ANY line on the account, so render ONLY the line(s) that touch the selected account from each matching transaction (`Lines[]` filtered to `Account.UID === account_uid`) — never the transaction's other lines, which belong to different accounts entirely. This is deliberately narrower than General Ledger's own account-scoped mode; treat this as the single-purpose, category-first version of that same behavior, not a second implementation to maintain independently — if `myob-reporting-studio:general-ledger`'s rendering logic changes, revisit this skill too.

Present one row per matching line: date (`DateOccurred`), journal number (`DisplayID`), description (`LineDescription`, falling back to the transaction's `Description`), and the amount under Debit or Credit per `IsCredit`. Show a period debit/credit subtotal. No running balance — same reasoning as General Ledger: this tool has no opening-balance anchor, so don't fabricate one.

Validate (0.01 tolerance): total debits + total credits shown reconciles to the account's net movement for the period (debit-normal vs credit-normal per the account's classification) — cross-check against the account's `CurrentBalance` (from `list_accounts` or `get_account`) only as a loosely-dated reference figure, clearly labeled as such, never as a period-matched tie-out (no as-of-date capability exists here, consistent with every other MYOB skill in this library).

## Interactivity

* Declare a required `category` `string` UID input (maxLength 36) mapped to `account_uid`, its dropdown filled client-side from a `list_accounts` binding (excluding `IsHeader` accounts) and defaulting to a real account UID found during generation — never an enum, never `""`.
* Declare `from_date`/`to_date` with a client-side preset picker.
* Declare `persona` and `company_file` per the foundation skill.
* Table sortable by date/amount; filterable by description text.

## Sources & limitations

Tools used: `list_journal_transactions` (account-scoped by the connector at transaction level, then narrowed client-side to the account's own lines), `list_accounts` for the category picker.
