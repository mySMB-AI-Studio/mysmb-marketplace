# Purchases Overview

Use `get_aged_payables` and `get_organisation_info`.

Show bills KPIs for Draft, Awaiting approval, Awaiting payment, and Overdue; a money-going-out timeline; and purchase-order status when the connector exposes it. Mark unsupported datasets unavailable instead of inferring them.

Validate overdue is a subset of awaiting payment and all displayed totals tie to available bill data.
## Interactivity

Period controls follow the foundation date-input pattern. Supplier filter box and sortable tables client-side; recompute visible totals over the filtered view, labelled as filtered.
