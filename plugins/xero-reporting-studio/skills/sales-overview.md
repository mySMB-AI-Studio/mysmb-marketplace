# Sales Overview

Use `get_aged_receivables`, `get_top_customers_by_revenue`, and `get_organisation_info`.

Show KPI cards for Draft, Awaiting approval, Awaiting payment, and Overdue; money due this week and next week with ageing/time buckets; customers owing the most sorted by due amount with overdue highlighted; and billable expenses when sourced.

Validate KPI amounts against available invoice detail, Due  Overdue for each customer, and top-customer totals  total receivables.
## Interactivity

Declare a `period` enum input. Add a client-side customer filter box and sortable tables; recompute visible totals over the filtered view, labelled as filtered.
