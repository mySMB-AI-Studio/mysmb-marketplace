# Square

Square commerce platform via Square's hosted OAuth MCP server. Browser OAuth — sign in with your Square account, no API keys required.

**280+ API operations** across payments, customers, orders, invoices, subscriptions, catalog, inventory, loyalty, bookings, gift cards, team, terminal, webhooks, and payment links — via three MCP tools.

## Configuration

No environment variables required. Click Connect to sign in with your Square account via OAuth. Square redirects to squareup.com for authorisation.

## MCP tool architecture

The Square MCP server exposes **three tools** — not one per API endpoint:

| Tool | Purpose |
|---|---|
| `make_api_request` | Execute any Square API operation. Params: `service` (string), `method` (string), `request` (optional object) |
| `get_service_info` | List all available methods for a service. Call this first to discover what a service supports. |
| `get_type_info` | Inspect the request schema for a specific service + method before writing data. |

All 280+ Square API operations are reached via `make_api_request`. Example:

```json
make_api_request({
  "service": "payments",
  "method": "list",
  "request": { "sort_order": "DESC" }
})
```

Service names are case-insensitive (`"payments"` or `"Payments"` both work). Method names are **camelCase** and case-sensitive.

## API service categories

### Payments (`service: "payments"`)

Create, retrieve, complete, cancel, and refund payments. Verified methods: `list`, `create`, `get`, `cancel`, `cancelByIdempotencyKey`, `complete`, `update`.
Refunds use `service: "refunds"` — verified methods: `listPayment`, `payment` (create a refund), `getPayment`.

### Orders (`service: "orders"`)

Build and manage orders across your Square locations. Verified methods: `create`, `batchGet`, `calculate`, `clone`, `search`, `get`, `update`, `pay`.

### Customers (`service: "customers"`)

Full customer directory management. Verified methods: `list`, `create`, `search`, `get`, `update`, `delete`, `addGroupTo`, `removeGroupFrom`, `bulkCreate`, `bulkDelete`, `bulkGet`, `bulkUpdate`.
Customer groups: use `service: "customerGroups"` — call `get_service_info({ service: "customerGroups" })` to list methods.

### Invoices (`service: "invoices"`)

Draft, publish, and track invoices. Verified methods: `list`, `search`, `create`, `get`, `update`, `publish`, `cancel`, `delete`.

### Subscriptions (`service: "subscriptions"`)

Recurring billing management. Verified methods: `create`, `search`, `get`, `update`, `cancel`, `pause`, `resume`, `swapPlan`, `listEvents`.

### Catalog (`service: "catalog"`)

Product and service catalog management. Verified methods: `list`, `getObject`, `upsertObject`, `deleteObject`, `searchObjects`, `searchItems`, `batchGetobjects`, `batchUpsertobjects`, `batchDeleteobjects`, `info`, `createImage`, `updateImage`, `updateItemModifierLists`, `updateItemTaxes`.

### Inventory (`service: "inventory"`)

Stock level management. Verified methods: `getCount`, `batchChange`, `batchGetcounts`.

### Locations (`service: "locations"`)

Business location configuration. Verified methods: `list`, `create`, `get`, `update`.

### Bookings (`service: "bookings"`)

Appointment scheduling. Call `get_service_info({ service: "bookings" })` to list methods.

### Loyalty (`service: "loyalty"`)

Loyalty programme and rewards. Verified methods: `getProgram`, `createAccount`, `searchAccounts`, `getAccount`, `accumulatePoints`, `adjustPoints`, `calculatePoints`, `createReward`, `searchRewards`, `getReward`, `redeemReward`, `deleteReward`, `searchEvents`, `listPromotions`, `createPromotion`, `getPromotion`, `cancelPromotion`.

### Gift Cards (`service: "giftCards"`)

Issue and manage gift cards. Verified methods: `list`, `create`, `get`, `getFromGAN`, `getFromNonce`, `linkCustomerTo`, `unlinkCustomerFrom`.

### Team (`service: "team"`)

Staff management. Verified methods: `createMember`, `getMember`, `updateMember`, `searchMembers`, `bulkCreatemembers`, `bulkUpdatemembers`, `listJobs`, `createJob`, `getJob`, `updateJob`, `getWageSetting`, `updateWageSetting`.

### Labor (`service: "labor"`)

Shift and break management. Verified methods: `createShift`, `searchShifts`, `getShift`, `updateShift`, `deleteShift`, `listBreakTypes`, `createBreakType`, `getBreakType`, `updateBreakType`, `deleteBreakType`, `listTeamMemberWages`, `getTeamMemberWage`, `listWorkweekConfigs`, `updateWorkweekConfig`.

### Terminal (`service: "terminal"`)

In-person terminal checkout. Verified methods: `createCheckout`, `searchCheckouts`, `getCheckout`, `cancelCheckout`, `dismissCheckout`, `createRefund`, `searchRefunds`, `getRefund`, `cancelRefund`, `dismissRefund`, `createAction`, `searchActions`, `getAction`, `cancelAction`, `dismissAction`.

### Webhooks (`service: "webhookSubscriptions"`)

Event subscription management. Verified methods: `list`, `create`, `get`, `update`, `delete`, `test`, `updateSignatureKey`, `listWebhookEventTypes`.

### Payment Links / Checkout (`service: "checkout"`)

Payment links and checkout settings. Verified methods: `createPaymentLink`, `listPaymentLinks`, `getPaymentLink`, `updatePaymentLink`, `deletePaymentLink`, `getLocationSettings`, `updateLocationSettings`, `getMerchantSettings`, `updateMerchantSettings`.

## Notes

**Sandbox vs production:** The hosted MCP server at `mcp.squareup.com` always connects to your production Square account. Sandbox testing requires running Square's MCP server locally with sandbox OAuth credentials — see https://developer.squareup.com/docs/mcp for local setup instructions.

**Token and scope:** The OAuth token is managed by Square's hosted MCP server after you sign in. Access is scoped to the permissions you grant during the OAuth flow. If a tool returns a permission error, re-authenticate and ensure you have granted the required OAuth scope for that API category.

**Amounts:** Square amounts are expressed in the smallest currency unit (e.g., cents for AUD/USD). $10.00 AUD = `{ "amount": 1000, "currency": "AUD" }`.

**Location ID:** Many Square operations require a `location_id`. Call `make_api_request({ service: "locations", method: "list" })` to retrieve your locations if a method prompts for one.

## See also

- Square MCP documentation: https://developer.squareup.com/docs/mcp
- Square API reference: https://developer.squareup.com/reference/square
