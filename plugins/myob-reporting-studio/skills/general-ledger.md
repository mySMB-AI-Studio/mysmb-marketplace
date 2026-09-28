---
name: MYOB General Ledger
description: Generate a MYOB General Ledger detail report — journal transaction lines for an account or date range.
---

# General Ledger

Use `list_journal_transactions` with `from_date`/`to_date` (filters on `DateOccurred`, the transaction date — not `DatePosted`), and `account_uid` when the request is scoped to one account (the common case — a full, unscoped GL across every account is rarely what's wanted and can be very large). The tool fetches every page itself (`page_size` up to 5000).

Shape note: each returned transaction has header fields (`DisplayID` = journal number, `DateOccurred`, `Description`) plus a `Lines[]` array, each line carrying `Account.{UID, Name, DisplayID}`, `Job`, `Amount` (always positive), `IsCredit` (`true` = credit, `false` = debit), and `LineDescription`. There is no separate Debit/Credit column — derive it: `IsCredit ? Credit : Debit`. The connector's `account_uid` filter keeps a whole transaction when ANY of its lines touches the account, so when scoped to one account, present only the line(s) touching that account per transaction (filter `Lines[]` client-side on `Account.UID`, with the transaction's date/journal number/description for context) — not every other line in the same journal entry, which belongs to different accounts entirely.

No running balance. This tool has no opening-balance anchor, so a running balance column would require assuming a starting point that can't be verified — don't compute one. If asked for a running balance, say plainly that it isn't reliably derivable from this data source, rather than fabricating a plausible-looking one.

Two genuine validation opportunities this data actually supports:
* **Per-transaction balance:** within a single journal transaction, sum of debit lines should equal sum of credit lines (fundamental double-entry bookkeeping — every real transaction balances internally). Check this for every transaction shown and flag any that doesn't; a mismatch here likely means an unusual/partial transaction, not a tool bug.
* **Displayed total:** sum of all shown debit amounts should equal sum of all shown credit amounts, same identity, at the report level — this only holds for the unscoped view; for a single account, show the period debit/credit subtotal and net movement instead.

Present a chronological table: date, journal number, description, debit, credit — grouped by account when more than one account is shown (unscoped view), otherwise a flat list when scoped to one account. Show a period debit/credit subtotal and, when scoped to a single account, note the account's current balance (from `list_accounts`) as a separate reference figure — clearly labeled as the current balance, not tied to the report's date range, since this tool has no historical as-of-date capability either.

Validate (0.01 tolerance):
* Per-transaction debit = credit for every transaction (flag any that fails)
* Total debits = total credits across the displayed set (unscoped view)
* If the journal source failed, the checks are N/A — never "0 transactions, balanced".

Disclose in Sources & limitations that the account filter is applied by the connector at transaction level and narrowed to the account's own lines client-side, and flag if the transaction count looks suspiciously low or high for the requested range (a possible sign the list-response shape assumption needs a second look).

## Interactivity

* Declare `from_date`/`to_date` inputs mapped to the tool's date range, with a client-side preset picker (this month, last quarter, FY to date).
* Declare `account` as an optional `string` UID input (maxLength 36) mapped to `account_uid`, its dropdown filled client-side from a `list_accounts` binding (excluding `IsHeader` accounts). Default it to a real account UID found during generation. For "All accounts", call a second, unfiltered journal binding (no `account_uid`) — never pass `""`.
* Declare `persona` and `company_file` per the foundation skill.
* Table sortable by date/journal number/amount, filterable by description text.
