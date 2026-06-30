# Cliniko Billing

Manage Cliniko invoices, payments, and products. This plugin connects to the myHub-hosted Cliniko MCP server and surfaces the billing side of the Cliniko API — invoicing patients, recording payments, and maintaining the catalogue of billable items.

The server talks to Cliniko on your behalf using your personal API key, so it only ever sees data and performs actions your own Cliniko login is allowed to.

## Tools & resources

### Invoices
- List, search, and view invoices (by patient, status, or date range)
- Create a new invoice for a patient
- Add and update invoice line items
- Update invoice status (e.g. mark issued)
- Delete a draft invoice

### Payments
- List and view payments
- Record a payment against an invoice
- View payment allocations (how a payment is split across invoices)
- Delete / refund-adjust a payment

### Products
- List and view products (the catalogue of sellable goods and services)
- Create and update a product, including its price and tax

### Billable items
- List and view billable items (the priced services used as invoice line items)
- Create and update a billable item

## Configuration

This plugin connects to Cliniko with your personal API key.

| Variable | Required | Description |
|----------|----------|-------------|
| `CLINIKO_API_KEY` | Yes | Your personal Cliniko API key. In Cliniko: **My Info → Manage API keys → Add a key**. The key inherits your own permissions; its region suffix (e.g. `-au4`) selects your data centre automatically. |

One Cliniko API key connects every Cliniko plugin (scheduling, patients, clinical, billing, practice).

## Destructive operations

Confirm before calling — these mutate financial records:
- Deleting an invoice or payment
- Changing invoice status or line items on an issued invoice

## See also
- [Find your Cliniko API key](https://help.cliniko.com/en/articles/1023957-find-your-api-key)
- [Cliniko API documentation](https://github.com/redguava/cliniko-api)
