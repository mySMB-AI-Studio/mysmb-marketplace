# MYOB Accounting

Access MYOB AccountRight & Business via the myHub-hosted OAuth MCP gateway. Browser OAuth flow — no env vars, no keys, just click Connect.

**28 tools** covering sales invoices, purchase bills, contacts, chart of accounts, tax codes, payments, and financial reports. AU/NZ organisations only.

## Configuration

No environment variables required. On first use, the browser redirects to `secure.myob.com` — sign in and authorise the app. MyHub binds to the first available company file automatically. Re-authorise to switch companies.

Scopes requested:

```
CompanyFile
```

## Tool categories

### Company files (1)
- `list_company_files` — list all company files available to the signed-in user

### Sales invoices (6)
- `list_invoices` — list open/closed invoices; filter by customer, date range, status
- `get_invoice` — full invoice with line items, applied payments, tax breakdown
- `create_invoice` — create a new sales invoice
- `update_invoice` — edit an existing draft or open invoice
- `delete_invoice` — delete a draft invoice (irreversible)
- `email_invoice` — email the invoice PDF to the customer

### Purchase bills (4)
- `list_bills` — list bills; filter by supplier, date range, status
- `get_bill` — full bill with line items
- `create_bill` — record a new supplier bill
- `delete_bill` — delete a draft bill (irreversible)

### Contacts (5)
- `list_contacts` — list customers, suppliers, or all; searchable by name
- `get_contact` — single contact with addresses and payment terms
- `create_contact` — create a new customer or supplier
- `update_contact` — edit an existing contact
- `delete_contact` — delete a contact (irreversible if transactions exist)

### Chart of accounts (2)
- `list_accounts` — list accounts; filter by type (Income, Expense, Asset, Liability, Equity)
- `get_account` — single account including opening balance

### Tax codes (2)
- `list_tax_codes` — list all configured tax codes (GST, BAS, FRE, etc.)
- `get_tax_code` — single tax code and its rate

### Payments (4)
- `list_payments` — list payments received against sales invoices
- `get_payment` — single payment record
- `create_payment` — record a payment against a sales invoice
- `delete_payment` — reverse a payment (invoice returns to Open)

### Financial reports (4)
- `get_profit_and_loss` — P&L for a date range; Accrual or Cash basis
- `get_balance_sheet` — balance sheet as of a given date
- `get_aged_receivables` — AR ageing; optionally for a specific customer
- `get_aged_payables` — AP ageing; optionally for a specific supplier

## Notes

- MYOB access tokens expire in ~20 minutes. The gateway refreshes them transparently using the refresh token — sessions stay alive for up to 10 days without re-authorising.
- The company file is auto-discovered on the first API call and cached for the session. To switch company files, re-authorise.
- All amounts are in the organisation's local currency (AUD or NZD).

## See also

- [MYOB AccountRight API docs](https://developer.myob.com/api/accountright/v2/)
- [MYOB Developer portal](https://developer.myob.com/)
