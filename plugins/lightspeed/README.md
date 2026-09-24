# Lightspeed

Manage your **Lightspeed Retail (X-Series)** store via the myHub-hosted Lightspeed MCP gateway — a self-hosted connector (`myhub-mcp-servers/src/integrations/lightspeed`) that talks to Lightspeed's own X-Series REST API on your behalf. Covers products, variants, inventory, sales, customers, registers, outlets, promotions, price books, gift cards, loyalty, suppliers, stock orders, service orders, and webhooks, all through a single OAuth-authenticated endpoint.

Lightspeed Retail (X-Series) is the same product formerly known as **Vend** — if your store still refers to itself that way, this is the right connector.

Browser OAuth through myHub — no API keys, no env vars. Click Connect, sign in to your Lightspeed account, authorize access, and you're done.

## Configuration

No environment variables are required on the client side — this plugin's `.mcp.json` points at myHub's own hosted MCP gateway, and myHub injects the OAuth bearer token automatically once you connect.

On first use, Connect redirects to Lightspeed's OAuth 2.0 authorization page (`https://secure.retail.lightspeed.app/connect`) — sign in, choose the retailer/store to authorize if you have more than one, and you're returned to myHub. Lightspeed's OAuth flow returns a `domain_prefix` specific to your store as part of the token exchange, which the server stores alongside your token so it can construct the correct per-retailer API base URL on every subsequent call without asking again.

### Prerequisites

- A Lightspeed Retail (X-Series) account with an active store.
- The account you connect with needs whatever Lightspeed staff permissions cover the actions you intend to use this connector for (e.g. a staff role with catalogue/inventory access to manage products, or sales access to read/create sales) — Lightspeed enforces this on its own side per staff account, independent of the OAuth scopes this connector requests.

## Tools & resources

This connector exposes the following MCP tools, backed directly by Lightspeed's X-Series REST API.

### Products

| Tool | Description |
|------|-------------|
| `list_products` | List products in the catalogue. Cursor-based pagination; filter by handle, SKU, or active status. |
| `get_product` | Get a single product by UUID, including variants, pricing, and inventory summary. |
| `create_product` | Create a new product. Only `name` is required. |
| `update_product` | Partially update an existing product — only send the fields you want to change. |
| `create_composite_product` | Create a composite (bundle) product made of existing component products. |
| `update_composite_product` | Update a composite product's details, or replace its full component list. |

### Variants

| Tool | Description |
|------|-------------|
| `list_product_variants` | List a product's variants (size, colour, etc.). Cursor-based pagination. |
| `create_variant` | Add a new variant to an existing product with its own SKU, pricing, and attributes. |
| `update_variant` | Update an existing variant's SKU, pricing, or active status. |

### Inventory

| Tool | Description |
|------|-------------|
| `list_inventory` | List current stock levels across outlets. |
| `update_inventory` | Adjust the stock level for a product/variant at a specific outlet. |
| `create_inventory_count` | Record a stock count/reconciliation. |
| `create_stock_order` | Create a new stock order (incoming inventory from a supplier). |

### Sales

| Tool | Description |
|------|-------------|
| `list_sales` | List sales (transactions). Cursor-based pagination. |
| `get_sale` | Get a single sale by UUID, including line items and payments. |
| `create_sale` | Create a new sale. |
| `update_sale` | Update an existing sale (e.g. add a payment, change status). |
| `list_sale_returns` | List returns/refunds recorded against sales. |
| `create_return` | Record a new return against a sale. |

### Customers

| Tool | Description |
|------|-------------|
| `list_customers` | List customers. Cursor-based pagination. |
| `get_customer` | Get a single customer by UUID, including loyalty balance and group memberships. |
| `create_customer` | Create a new customer record. |
| `update_customer` | Update an existing customer's details. |

### Registers

| Tool | Description |
|------|-------------|
| `list_registers` | List point-of-sale registers configured across outlets. |
| `get_register` | Get a single register's details, including its current open/closed state. |
| `close_register` | Close out a register's current session (end-of-day reconciliation). |

### Outlets

| Tool | Description |
|------|-------------|
| `list_outlets` | List store outlets/locations configured on the account. |
| `get_outlet` | Get a single outlet's details. |

### Promotions

| Tool | Description |
|------|-------------|
| `list_promotions` | List discount/promotion rules. |
| `get_promotion` | Get a single promotion's details. |
| `create_promotion` | Create a new promotion. |

### Price Books

| Tool | Description |
|------|-------------|
| `list_pricebooks` | List price books (customer/channel-specific pricing sets). |
| `get_pricebook` | Get a single price book's details and its product price overrides. |

### Gift Cards

| Tool | Description |
|------|-------------|
| `list_gift_cards` | List gift cards issued on the account. |
| `get_gift_card` | Get a single gift card by UUID, including its current balance. |
| `get_gift_card_by_number` | Look up a gift card by its printed/physical card number instead of its UUID. |

### Loyalty

| Tool | Description |
|------|-------------|
| `get_loyalty` | Get the loyalty program's configuration and a customer's earned/available balance. |

### Suppliers

| Tool | Description |
|------|-------------|
| `list_suppliers` | List suppliers configured on the account. |
| `get_supplier` | Get a single supplier's details. |

### Stock Orders

| Tool | Description |
|------|-------------|
| `list_stock_orders` | List stock orders (incoming inventory orders from suppliers). |
| `get_stock_order` | Get a single stock order's details, including line items. |

### Service Orders

| Tool | Description |
|------|-------------|
| `list_service_orders` | List service/repair orders (Lightspeed's workshop/repair tracking). |
| `get_service_order` | Get a single service order's details. |
| `create_service_order` | Create a new service/repair order. |

### Webhooks

| Tool | Description |
|------|-------------|
| `list_webhooks` | List webhook subscriptions currently registered on the account. |
| `create_webhook` | Register a new webhook subscription for a Lightspeed event type. |
| `delete_webhook` | Remove an existing webhook subscription. |
