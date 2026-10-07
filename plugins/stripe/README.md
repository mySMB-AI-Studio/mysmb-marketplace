# Stripe

Read-only access to Stripe payments, customers, subscriptions, invoices, balance, payouts, products, and prices via the myHub-hosted MCP gateway. No credentials required — authentication is handled server-side.

## Configuration

No environment variables required. The MCP server authenticates with Stripe using server-side credentials (`STRIPE_CLIENT_SECRET` and `STRIPE_CLIENT_ID`). Install the plugin and it is ready to use immediately.

## Available MCP tools

### Payments
- `list_payments` — list PaymentIntents (params: `limit`, `starting_after`, `customer`)
- `get_payment` — get a PaymentIntent by ID

### Customers
- `list_customers` — list customers (params: `limit`, `starting_after`, `email`)
- `get_customer` — get a customer by ID

### Subscriptions
- `list_subscriptions` — list subscriptions (params: `limit`, `starting_after`, `customer`, `status`: active | past_due | unpaid | canceled | incomplete | trialing | all | ended)
- `get_subscription` — get a subscription by ID

### Invoices
- `list_invoices` — list invoices (params: `limit`, `starting_after`, `customer`, `status`: draft | open | paid | uncollectible | void)
- `get_invoice` — get an invoice by ID

### Balance
- `get_balance` — get current account balance (available + pending by currency)

### Payouts
- `list_payouts` — list payouts (params: `limit`, `starting_after`, `status`: canceled | failed | in_transit | paid | pending)

### Products and Prices
- `list_products` — list products (params: `limit`, `starting_after`, `active`)
- `list_prices` — list prices (params: `limit`, `starting_after`, `product`, `active`)

## Widgets

| Widget | Tool | Description |
|---|---|---|
| Stripe Balance | `get_balance` | Available and pending balances per currency |
| Stripe Recent Payments | `list_payments` | Last 20 payments with amount, status badge, customer, and time |
| Stripe MRR | `list_subscriptions` | Active subscription count and per-subscription detail |

## Notes

- All amounts are in the smallest currency unit (cents for USD/AUD/EUR). The widget-elements module converts them for display.
- Timestamps are Unix epoch seconds. `stripe_format_stripe_date` converts them to human-readable dates.
- All tools are read-only. Write operations (create, update, delete) are not available through this gateway.

## See also

- [Stripe API docs](https://docs.stripe.com/api)
- [Stripe Dashboard](https://dashboard.stripe.com)
