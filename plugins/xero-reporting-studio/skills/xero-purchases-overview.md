---
name: xero-purchases-overview
description: Build a live Xero purchases overview — bills by status, money going out, and purchase-order status. Use for "purchases overview", "bills", "bills to pay", "money going out", "purchase orders".
---
# Purchases Overview

Bills are `list_invoices` with `where: Type=="ACCPAY"` (there is no separate bills tool), `statuses: DRAFT,SUBMITTED,AUTHORISED`, `order: DueDate ASC`, paged per the foundation. Use `get_organisation` for context, `list_payments` (`where: PaymentType=="ACCPAYPAYMENT"`, `order: Date DESC`) for money already paid out, and `list_purchase_orders` for purchase-order status.

Show bills KPIs for Draft (`Status` DRAFT), Awaiting approval (SUBMITTED), Awaiting payment (AUTHORISED), and Overdue (AUTHORISED with `DueDate` before today); a money-going-out timeline (paid from `list_payments`, upcoming from unpaid bills' `DueDate` / `AmountDue`); and purchase-order status from `list_purchase_orders`. Mark unsupported datasets unavailable instead of inferring them.

Validate overdue is a subset of awaiting payment and all displayed totals tie to available bill data.
## Interactivity

Period controls follow the foundation date-input pattern (for purchase orders, `from_date` / `to_date` → `dateFrom` / `dateTo`; bill and payment windows filter client-side), plus `organisation` and `page` per the foundation. Supplier filter box and sortable tables client-side; recompute visible totals over the filtered view, labelled as filtered.
