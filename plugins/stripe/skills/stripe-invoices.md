---
name: stripe-invoices
description: Create, manage, or list Stripe invoices. Triggers on "create invoice", "send invoice", "add invoice item", "finalize invoice", "list invoices", "unpaid invoices", "overdue invoices", or similar.
---

# Stripe Invoices

Use the `create_invoice`, `create_invoice_item`, `finalize_invoice`, and `list_invoices` tools from the `stripe` MCP server.

## Listing invoices

Call `list_invoices` with optional filters:
- `customer` — Stripe customer ID (e.g. `cus_xxxxx`)
- `status` — `draft`, `open`, `paid`, `uncollectible`, or `void`
- `limit` — number of results (default 10, max 100)

If the user gives a name or email rather than a Stripe ID, resolve it first via `list_customers` or `search_stripe_resources`.

Present each invoice with: invoice number, customer, amount due (÷ 100), status, and due date (Unix timestamp → human-readable).

## Creating an invoice

Full workflow: **create invoice → add line items → finalize**.

### Step 1 — Create the invoice
Call `create_invoice` with:
- `customer` — required; Stripe customer ID
- `collection_method` — `send_invoice` (email to customer) or `charge_automatically` (auto-charge saved card)
- `due_date` — Unix timestamp (required if `send_invoice`)
- `description` — optional note on the invoice

This creates a **draft** invoice. No money is collected yet.

### Step 2 — Add line items
Call `create_invoice_item` for each line item:
- `customer` — same customer ID
- `invoice` — the draft invoice ID from step 1
- `amount` — in smallest currency unit (e.g. `5000` = $50.00 AUD)
- `currency` — ISO code (e.g. `"aud"`)
- `description` — what this line item is for

Repeat for each line item before finalizing.

### Step 3 — Finalize
Call `finalize_invoice` with the `invoice` ID. This moves the invoice from `draft` to `open` and (if `send_invoice`) emails it to the customer.

**Do not finalize until all line items are added** — items cannot be added to a finalized invoice.

## How to use

1. Resolve the customer ID if needed.
2. Clarify what should be on the invoice (items, amounts, due date).
3. Create the draft, add all line items, then finalize.
4. Echo back the invoice number, total, and status.
