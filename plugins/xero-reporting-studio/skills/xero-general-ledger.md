---
name: xero-general-ledger
description: Build a live Xero General Ledger / journal listing from list_journals, filtered to a period client-side — flagged prominently when the connection lacks the journals scope. Use for "general ledger", "GL", "journal listing", "all journals", "transaction journal".
---
# General Ledger

`list_journals` (`offset` only — no date-range parameter) **may fail as unauthorised: the connector does not hold the journals scope on every connection.** Call it once at build time. If it errors, show a prominent banner stating the General Ledger is not available on this Xero connection (the journals scope is not granted) and stop there — do not fall back to any other tool or approximate a general ledger from invoices or bank transactions; a general ledger built from anything but the journal feed is not a general ledger. If it succeeds, `offset` is an incrementing feed cursor (the highest `JournalNumber` already fetched), not a page number — keep paging with `offset` set to the last `JournalNumber` seen until a bounded call cap is hit (state the cap, e.g. 20 calls) or a page returns no rows, then filter the accumulated journals to the requested period client-side on `JournalDate`.

Show journal date, journal number, reference/narration, source type, and per-line account, debit and credit (from `JournalLines[]`), grouped by journal, with a running total per account when an account filter is applied.

Validate that every journal's lines sum to zero (Σ debits − Σ credits = 0 per journal) and disclose that there is no separate Xero report to independently tie the whole ledger against, so a period total shown elsewhere (e.g. the Trial Balance) can only be compared informationally, never Pass/Fail. Completeness is N/A whenever the call cap truncates the feed.
## Interactivity

`list_journals` takes no date parameter, so the period filter (from/to date) is a pure client-side control over the accumulated feed — not a declared input. Declare `offset` (number, default `0`) mapped 1:1 to `list_journals`'s `offset`, and `organisation` per the foundation; the report internally advances `offset` to the highest `JournalNumber` seen and refetches with `getData` up to the stated call cap — never expose `offset` as something the reader sets directly, and never pass it to `setInputs`. Account filter box and sortable columns are client-side; recompute the per-account running total over the filtered view, labelled as filtered. When the discovery call errors, render only the unauthorised banner and skip every other control — there is nothing to interact with.
