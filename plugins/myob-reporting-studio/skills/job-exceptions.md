---
name: MYOB Job Exceptions
description: Transactions NOT assigned to any job. Declares a transaction_type toggle — Cash (spend/receive money, inventory, general journal lines), Invoice (sales/purchase transactions), or Both. Merges Prompt IDs M57 and M58 into one skill.
---

# Job Exceptions

Prompt ID M57/M58 (merged) · Reporting › Reports › Jobs › Job exceptions (cash transactions) / Job exceptions (invoice transactions). MYOB's own descriptions: "Displays a list of all spend money, receive money, inventory and general journal transactions lines that have not been assigned to a job" (M57) and "Displays a list of all sales and purchase transactions that have not been assigned to a job" (M58).

**Always available — Cash side (`transaction_type` = Cash or Both):** use `list_journal_transactions` with NO `job_uid` filter, fetched broadly across the full `from_date`/`to_date` range, plus a `list_accounts` binding. In the report's own rendering logic (not a new tool call), filter `Lines[]` for entries where `Job` is absent/null **and whose account is a P&L account** — `Classification` `Income`, `CostOfSales`, `Expense`, `OtherIncome` or `OtherExpense`, joined on `Account.UID`. Balancing lines on bank, receivables, payables, GST and other balance-sheet accounts carry no job by design; never list them as exceptions (say so in the section note). Present one row per unassigned line: date, journal number, account, description, debit/credit amount. Do not attempt to split into "spend money/receive money/inventory/general journal" sub-categories unless a real transaction-type field is confirmed present live during generation — if not found, present one flat list rather than fabricating a categorization the data doesn't support.

**Genuinely uncertain — Invoice side (`transaction_type` = Invoice or Both), resolve live before rendering it:** MYOB's docs show no `Job` field anywhere in `Sale/Invoice`'s documented response shape, but this may just be the layout the docs happened to display, not proof no job-costing field exists on a real invoice or bill. Call `get_invoice` on a sample invoice and `get_bill` on a sample bill during generation and inspect for a `Job` field (top-level or per-line):
- **If found:** use `list_invoices`/`list_bills` (status=All, date-ranged, `page_index: 0`), filter client-side for records where `Job` is absent/null. Present one row per unassigned transaction: date, contact, number, total, type (sale/purchase).
- **If not found anywhere:** render the Invoice section with a plain statement that MYOB's Sale/Invoice and Purchase/Bill entities carry no job-assignment field in this connector's real data, so this half of the report can't be built as MYOB describes it — recommend the MYOB export fallback for that side specifically. **This does not block the Cash section from rendering** — the two sides are independent; one being unavailable never hides the other.

When `transaction_type` = Both: render both sections, each following its own rule above — never let an Invoice-side failure suppress the Cash section, and never fabricate Invoice data just to have something to show alongside Cash.

Show a summary count and total value of unassigned lines/transactions per section shown — this is a completion-tracking report, so surface that headline prominently. If a section's source failed, its count is "not checked", never zero.

## Interactivity

* Declare `from_date`/`to_date` with a client-side preset picker.
* Declare `transaction_type` (enum: Cash / Invoice / Both, default Both) — a presentation input.
* Declare `persona` and `company_file` per the foundation skill — Client/Executive show summary counts/totals only, per section shown; Bookkeeper/Practitioner show the full unassigned-line/transaction tables.

## Sources & limitations

Cash section: `list_journal_transactions`, unscoped by job, filtered client-side for P&L-account lines with no `Job` reference (balance-sheet balancing lines excluded by design); `list_accounts` for the classification. Always buildable. Invoice section: `list_invoices`/`list_bills`, filtered client-side for a missing `Job` reference — buildability depends on a live field check done during generation; state the real outcome (found/not found) rather than assuming either way.
