# Find overdue invoices

1. Call the `xero.invoices.list_overdue` capability.
2. Keep invoices whose DueDate is at least `{{minDaysOverdue}}` days before today and whose AmountDue is more than 0.
3. Return two outputs:
   - `overdueList`: one entry per invoice with InvoiceID, InvoiceNumber, contact name and email, AmountDue and days overdue, sorted by days overdue (oldest first).
   - `chaseSummary`: one sentence, for example "3 invoices, $2,140 overdue, oldest 34 days".
4. If nothing qualifies, return an empty `overdueList` and the summary "Nothing overdue today".

Never email a client or change anything in Xero from this skill. It only reads.