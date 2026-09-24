# Sales Overview

Use `list_invoices` with `Type=="ACCREC"` for invoice status KPIs and the customers-owing-most ranking, `get_organisation` for org context, and `list_linked_transactions` (`status=="APPROVED"`) for billable expenses not yet invoiced. There is no all-customers aged-receivables tool and no top-customers-by-revenue tool — both are derived from the same `list_invoices` pull.

Show KPI cards for Draft (`Status==DRAFT`), Awaiting approval (`Status==SUBMITTED`), Awaiting payment (`Status==AUTHORISED`, `DueDate ≥ today`), and Overdue (`Status==AUTHORISED`, `DueDate < today`); money due this week and next week bucketed by `DueDate`; customers owing the most sorted by outstanding `AmountDue` with overdue highlighted; and billable expenses from `list_linked_transactions`.

Validate KPI amounts against available invoice detail, Due = Overdue + not-yet-due for each customer, and top-customer totals ≤ total receivables.