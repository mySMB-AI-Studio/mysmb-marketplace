---
name: stripe-disputes
description: List or respond to Stripe disputes (chargebacks). Triggers on "show disputes", "list chargebacks", "respond to dispute", "submit evidence", "accept dispute", or similar.
---

# Stripe Disputes

Use the `list_disputes` and `update_dispute` tools from the `stripe` MCP server.

## Listing disputes

Call `list_disputes` with optional filters:
- `limit` — number of results (default 10, max 100)

Present each dispute with:
- Dispute ID
- Amount (÷ 100 for standard currencies) and currency
- Status: `warning_needs_response`, `needs_response`, `under_review`, `charge_refunded`, `won`, `lost`
- Reason (e.g. `fraudulent`, `product_not_received`, `unrecognized`)
- Evidence due date (`evidence_details.due_by` — Unix timestamp, convert to human-readable)

Flag any dispute with status `needs_response` as requiring attention, especially if the due date is approaching.

## Updating a dispute

Call `update_dispute` with the `dispute` ID and an `evidence` object.

Common evidence fields:
- `customer_name`, `customer_email_address`
- `product_description`
- `receipt` — text description of the receipt
- `shipping_documentation`, `customer_communication`
- `uncategorized_text` — freeform additional context

To accept a dispute without contesting it, set `submit: false` and include a note in `uncategorized_text`.

## How to use

1. Call `list_disputes` to show open disputes.
2. For each `needs_response` dispute, summarise the reason and evidence due date.
3. If the user wants to respond, collect the relevant evidence fields.
4. Call `update_dispute` with the dispute ID and evidence.
5. Echo back the updated dispute status.

**Note:** Dispute responses are time-sensitive. Always show the evidence due date prominently.
