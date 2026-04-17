# Xero (hosted)

Full-coverage access to the Xero Accounting API via the myHub-hosted OAuth MCP gateway. Unlike the stdio `xero` plugin (which needs Custom-Connection API keys), this one uses a browser OAuth flow — no env vars, no keys, just click Connect.

95 tools spanning sales, purchases, banking, payroll-adjacent, and all 8 standard financial reports.

## Configuration

No environment variables required. On first use, the browser redirects to `identity.xero.com` — sign in, pick a Xero org, and MyHub remembers the selection for the rest of the session. Reconnect to switch orgs.

Scopes requested: `offline_access openid profile email accounting.transactions accounting.contacts accounting.settings accounting.reports.read accounting.journals.read`.

## Tool categories

### Sales (27 tools)
- **Invoices (6)** — `list_invoices`, `get_invoice`, `create_invoice`, `update_invoice`, `email_invoice`, `get_invoice_pdf`
- **Credit Notes (4)** — `list_credit_notes`, `get_credit_note`, `create_credit_note`, `update_credit_note`
- **Quotes (4)** — `list_quotes`, `get_quote`, `create_quote`, `update_quote`
- **Contacts (5)** — `list_contacts`, `get_contact`, `create_contact`, `update_contact`, `archive_contact`
- **Contact Groups (6)** — `list_contact_groups`, `get_contact_group`, `create_contact_group`, `update_contact_group`, `add_contacts_to_group`, `remove_contact_from_group`
- **Repeating Invoices (2)** — `list_repeating_invoices`, `get_repeating_invoice`

### Purchases & banking (26 tools)
- **Purchase Orders (5)** — `list_purchase_orders`, `get_purchase_order`, `create_purchase_order`, `update_purchase_order`, `get_purchase_order_pdf`
- **Bank Transactions (4)** — `list_bank_transactions`, `get_bank_transaction`, `create_bank_transaction`, `update_bank_transaction`
- **Bank Transfers (3)** — `list_bank_transfers`, `get_bank_transfer`, `create_bank_transfer`
- **Payments (4)** — `list_payments`, `get_payment`, `create_payment`, `delete_payment` (soft-delete)
- **Overpayments (3)** — `list_overpayments`, `get_overpayment`, `allocate_overpayment`
- **Prepayments (3)** — `list_prepayments`, `get_prepayment`, `allocate_prepayment`
- **Manual Journals (4)** — `list_manual_journals`, `get_manual_journal`, `create_manual_journal`, `update_manual_journal`

### Core & reference (31 tools)
- **Accounts (5)** — `list_accounts`, `get_account`, `create_account`, `update_account`, `archive_account`
- **Items (5)** — `list_items`, `get_item`, `create_item`, `update_item`, `delete_item`
- **Employees (4)** — `list_employees`, `get_employee`, `create_employee`, `update_employee`
- **Tax Rates (3)** — `list_tax_rates`, `create_tax_rate`, `update_tax_rate`
- **Tracking Categories (8)** — `list_tracking_categories`, `get_tracking_category`, `create_tracking_category`, `update_tracking_category`, `delete_tracking_category`, `create_tracking_option`, `update_tracking_option`, `delete_tracking_option`
- **Users (2)** — `list_users`, `get_user`
- **Journals (1)** — `list_journals`
- **Misc (3)** — `list_currencies`, `list_branding_themes`, `list_budgets` / `get_budget` (2)

### Reports (8)
- `get_profit_and_loss`
- `get_balance_sheet`
- `get_trial_balance`
- `get_bank_summary`
- `get_aged_receivables_by_contact`
- `get_aged_payables_by_contact`
- `get_budget_summary`
- `get_executive_summary`

### Organisation (2)
- `get_organisation`
- `get_organisation_actions`

## Destructive operations

These are irreversible or semi-irreversible in Xero — the agent will warn you, but confirm before calling:

- `delete_item` — hard DELETE
- `delete_tracking_category`, `delete_tracking_option` — hard DELETE
- `archive_contact`, `archive_account` — soft archive, un-archiveable from the Xero UI
- `delete_payment` — soft-delete (Status=DELETED); Xero treats the amount as reversed but the record remains for audit
