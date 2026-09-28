---
name: MYOB Unpaid Invoices
description: Generate a MYOB Unpaid Invoices report — outstanding sales invoices, sorted by urgency.
---

# Unpaid Invoices

Use `list_invoices` with `status: "Open"` (the tool's statuses are `Open`, `Closed`, `All`) and `page_index: 0`, which fetches every page. This is a listing endpoint, not a report endpoint — no date-range parameter mismatch risk here.

**Ageing uses today's open items.** `status: "Open"` returns invoices open *right now*, with today's `BalanceDueAmount`; there is no "open as at a past date" in MYOB. If the reader picks a past as-at date for bucketing, it only re-buckets today's open items — say so in a visible banner.

Present one row per invoice: invoice number, customer, invoice date, due date, amount outstanding (`BalanceDueAmount` — not `TotalAmount`, which overstates part-paid invoices), and days overdue (or days until due, for invoices not yet due) — computed as (today − due date). Sort by most overdue first by default. Group or visually separate into Overdue vs. Not Yet Due, and show a count and subtotal for each group plus a grand total.

Optionally scope to a single customer when the request asks for one customer's outstanding invoices specifically, rather than the whole ledger.

Verify internal consistency before finalizing: the sum of all listed invoice amounts must equal the displayed grand total. If the fetched count looks short of what MYOB reports (e.g. a returned total count), say so explicitly rather than silently reporting a partial total as if it were complete.

Validate (0.01 tolerance):
* Sum of invoice rows = grand total shown
* Overdue subtotal + not-yet-due subtotal = grand total
* If `list_invoices` failed, both checks are N/A — never render $0 outstanding.

Show any discrepancy prominently.

## Interactivity

* Declare a `customer` optional `string` UID input (maxLength 36), a presentation filter over the unfiltered open-invoice binding — fill its dropdown from the customers in the returned rows and filter client-side. The binding omits `customer_uid`; never pass `""`.
* Declare a `min_days_overdue` presentation input for a client-side severity filter (e.g. "90+ days only") — this is client-side filtering over already-hydrated data, not a new tool call, since the full open-invoice list is already retrieved.
* Declare `persona` and `company_file` per the foundation skill.
* Table is sortable by any column and filterable by customer name/invoice number, per the shared foundation skill's rules.
