# Stripe

Manage payments, subscriptions, customers, invoices, and billing via the [official Stripe MCP server](https://docs.stripe.com/mcp). Connects directly to `mcp.stripe.com` using a Stripe restricted API key — no proxy required.

## Configuration

| Variable | Required | Description |
|---|---|---|
| `STRIPE_SECRET_KEY` | yes | Stripe restricted API key. Create one at https://dashboard.stripe.com/apikeys — use a restricted key (prefix `rk_live_`) rather than a full secret key for least-privilege access. |

The key is passed as `Authorization: Bearer <key>` on every request. Store it as a secret — never commit it to source control.

## Available MCP tools

### Account
- `get_stripe_account_info` — retrieve details about your connected Stripe account

### Balance
- `retrieve_balance` — get available and pending balances across all currencies

### Coupon
- `create_coupon` — create a percent-off or amount-off coupon
- `list_coupons` — list all coupons

### Customer
- `create_customer` — create a new customer record
- `list_customers` — list customers with optional email/limit filters

### Dispute
- `list_disputes` — list disputes (charge-backs) on your account
- `update_dispute` — respond to or accept a dispute

### Invoice
- `create_invoice` — create a new invoice for a customer
- `create_invoice_item` — add a line item to a draft invoice
- `finalize_invoice` — finalize a draft invoice so it can be paid
- `list_invoices` — list invoices with optional status/customer filters

### Payment Link
- `create_payment_link` — create a hosted payment link for a price

### PaymentIntent
- `list_payment_intents` — list payment intents with optional status/limit filters

### Price
- `create_price` — create a price for a product
- `list_prices` — list prices, optionally scoped to a product

### Product
- `create_product` — create a new product
- `list_products` — list all products

### Refund
- `create_refund` — refund a charge or payment intent (full or partial)

### Subscription
- `cancel_subscription` — cancel a subscription immediately or at period end
- `list_subscriptions` — list subscriptions with optional customer/status filters
- `update_subscription` — modify items, trial dates, or metadata on a subscription

### Utilities
- `search_stripe_resources` — full-text search across Stripe objects (customers, invoices, subscriptions, etc.)
- `fetch_stripe_resources` — fetch any Stripe resource by its ID or URL
- `search_stripe_documentation` — search the Stripe documentation

## Installation

1. In MyHub, go to **Plugins → Browse** and search for "Stripe".
2. Click **Install**.
3. In the Connect modal, paste your `STRIPE_SECRET_KEY` (restricted API key) from the Stripe Dashboard.
4. Click **Connect** — the token is stored securely in your vault.

The plugin is read-write. Use the Stripe assistant or individual skills to interact with your Stripe account.

## Widgets

Five dashboard widgets ship with this plugin:

| Widget | Tool | Description |
|---|---|---|
| Stripe Balance | `retrieve_balance` | Available and pending balance per currency |
| Stripe Customers | `list_customers` | Recent customers — name, email, created date |
| Stripe Invoices | `list_invoices` | Latest 20 invoices with status badges |
| Stripe Payment Intents | `list_payment_intents` | Latest 20 payment intents with amounts and status |
| Stripe Subscriptions | `list_subscriptions` | Latest 20 subscriptions with status badges |
