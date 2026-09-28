---
name: MYOB Customer Transactions
description: Generate a MYOB Customer Transactions report — invoices and payments merged into one chronological ledger per customer.
---

# Customer Transactions

Prompt ID M37 · MYOB menu: Reporting › Reports › Sales › Customer transactions. MYOB's own description: "All invoices, payments and credits within the specified date range."

Use `list_invoices` with `status: "All"`, `page_index: 0` (all pages) and a `from_date`/`to_date` range (charges), plus `list_payments` with the same date range and `page_size: 1000` (receipts) — both are confirmed tools. `list_payments` returns a single page only: if exactly 1000 payments come back, show a visible "payments may be truncated at 1000" warning, mark the sanity check N/A, and suggest a narrower date range. Merge into one chronological transaction list per customer: each invoice is a charge (`Date`, `Number`, `TotalAmount`), each payment is a receipt against that customer.

**Disclose plainly, don't invent:** customer credit notes appear in `list_invoices` as sales with status `Credit` (negative amounts) — show them as credits when present. Credit applications, refunds and adjustments have no confirmed tool in this connector — only `Sale/Invoice` and `Sale/ReceivePayment` are wired up. State in Sources & limitations what is not included, rather than fabricating a credits field or a tool call that doesn't exist.

Group by customer, showing a running balance per customer across the merged, date-sorted transaction list, plus a grand total row.

Validate: each customer's ending balance (sum of invoices minus sum of payments in the period) should be directionally consistent with their open-invoice data from `list_invoices` (status=Open, `BalanceDueAmount`) — mention this as a sanity cross-check in Sources & limitations rather than a hard-enforced equation, since the two aren't necessarily for the same period.

## Interactivity

* Declare `from_date`/`to_date` inputs mapped 1:1 to both tools' date params, with the standard preset picker.
* Declare `customer` as an optional `string` UID input (maxLength 36), a presentation filter over the unfiltered bindings — fill its dropdown from the customers in the returned rows and filter client-side. For "all", the bindings omit the customer param; never pass `""`. If payments were truncated at 1000, you may add filtered bindings (`list_invoices` `customer_uid`, `list_payments` **`contact_uid`** — not `customer_uid`) and call them with `getData` only once a real customer UID is chosen.
* Declare `persona` and `company_file` per the foundation skill — per-transaction line detail is a `detail-block`, hidden for Client/Executive; totals and running balance always show.
* Table sortable by date, customer, or amount; text filter on customer name.

## Sources & limitations

Tools used: `list_invoices` (status=All, date-ranged, all pages) and `list_payments` (date-ranged, single page of up to 1000), merged client-side. Credit notes show only as status-`Credit` sales; credit applications, refunds and adjustments are not shown — no confirmed tool exists for those MYOB entities in this connector.
