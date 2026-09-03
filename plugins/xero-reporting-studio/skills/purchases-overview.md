# Purchases Overview

Use `get_aged_payables` and `get_organisation_info`.

Show bills KPIs for Draft, Awaiting approval, Awaiting payment, and Overdue; a money-going-out timeline; and purchase-order status when the connector exposes it. Mark unsupported datasets unavailable instead of inferring them.

Validate overdue is a subset of awaiting payment and all displayed totals tie to available bill data.
## Interactivity

Declare a `period` enum input. Add a client-side supplier filter box and sortable tables; recompute visible totals over the filtered view, labelled as filtered.
