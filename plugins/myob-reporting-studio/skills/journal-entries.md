# Journal Entries

Prompt ID M09 · Reporting › Reports › Business › Journal entries. MYOB's description: "All the transactions within a specified date range in the form of journal entries." Use `list_journal_transactions` with `from_date`/`to_date` and no `account_uid` — a full, unscoped range.

**This is transaction-centric, not account-centric — the key difference from General Ledger.** General Ledger presents individual lines grouped/filtered by account. Here, render one journal-entry block per transaction showing ALL of that transaction's `Lines[]` together, in original entry order, with the transaction's `DisplayID` (journal number), `DateOccurred`, and `Description` as the block header. Each line shows `Account.{Name, DisplayID}`, `LineDescription`, and the amount under Debit or Credit per `IsCredit` (`true` = credit, `false` = debit) — there is no separate Debit/Credit field, derive it.

Validate, per transaction: debit lines sum to credit lines (fundamental double-entry — every real transaction balances internally). Flag any transaction that doesn't balance prominently; this is a genuine anomaly worth surfacing, not a tool bug to hide. Also show a report-level total: sum of all debits = sum of all credits across every transaction shown.

The transaction object's exact field set beyond `DisplayID`/`DateOccurred`/`Description`/`Lines[]` isn't fully confirmed by docs — discover the real response shape during generation (call the tool once before writing the render code) rather than assuming a source/type field exists; if a transaction-type or source-module field is present, show it, but don't invent one if it isn't.

## Interactivity

* Declare `from_date`/`to_date` inputs with a client-side preset picker (this month, last quarter, YTD).
* Journal entries sortable by date/journal number; filterable by description or account name (client-side, over already-hydrated data).
* No `account` input — this report is deliberately unscoped. (For a single-account view, that's Categories Transactions or General Ledger.)

## Sources & limitations

Tool used: `list_journal_transactions`, full date range, no account filter. Confirm the live response shape for transaction-level fields during generation; note in Sources if any expected field (description, journal number) isn't present as expected.
