# Customer Transactions

Prompt ID M37 · MYOB menu: Reporting › Reports › Sales › Customer transactions. MYOB's own description: "All invoices, payments and credits within the specified date range."

Use `list_invoices` with `status: "All"` and a `from_date`/`to_date` range (charges), plus `list_payments` with the same date range (receipts) — both are confirmed tools. Merge into one chronological transaction list per customer: each invoice is a charge (`Date`, `Number`, `TotalAmount`), each payment is a receipt against that customer.

**Disclose plainly, don't invent:** MYOB "credits" (customer credit notes/adjustments) have no confirmed tool in this connector — only `Sale/Invoice` and `Sale/ReceivePayment` are wired up. State in Sources & limitations that credit notes are not included, rather than fabricating a credits field or a tool call that doesn't exist.

Group by customer, showing a running balance per customer across the merged, date-sorted transaction list, plus a grand total row.

Validate: each customer's ending balance (sum of invoices minus sum of payments in the period) should be directionally consistent with their open-invoice data from `list_invoices` (status=Open) — mention this as a sanity cross-check in Sources & limitations rather than a hard-enforced equation, since the two aren't necessarily for the same period.

## Interactivity

* Declare `from_date`/`to_date` inputs mapped 1:1 to both tools' date params, with the standard preset picker.
* Declare `customer` as an optional enum input mapped to `customer_uid` on both bindings.
* Declare `persona` per the foundation skill — per-transaction line detail is a `detail-block`, hidden for Client/Executive; totals and running balance always show.
* Table sortable by date, customer, or amount; text filter on customer name.

## Sources & limitations

Tools used: `list_invoices` (status=All, date-ranged) and `list_payments` (date-ranged), merged client-side. Credit notes/adjustments are not shown — no confirmed tool exists for that MYOB entity in this connector.
