# Purchases Overview

Use `list_invoices` with `Type=="ACCPAY"` for bill KPIs, `get_organisation` for org context, `list_purchase_orders` for purchase-order status (this connector does expose it — do not hedge as unavailable), and `list_payments` plus the bill `DueDate`s for the money-going-out timeline (actual payments from `list_payments`, upcoming from unpaid bills' `DueDate`/`AmountDue`). There is no single "aged payables" tool for this — status counts come directly from each bill's `Status` field (`DRAFT`, `SUBMITTED`, `AUTHORISED`) and `DueDate`.

Show bills KPIs for Draft (`Status==DRAFT`), Awaiting approval (`Status==SUBMITTED`), Awaiting payment (`Status==AUTHORISED`, `DueDate ≥ today`), and Overdue (`Status==AUTHORISED`, `DueDate < today`); a money-going-out timeline; and purchase-order status from `list_purchase_orders`. Mark any genuinely unsupported dataset unavailable instead of inferring it.

Validate overdue is a subset of awaiting payment and all displayed totals tie to the underlying bill data.