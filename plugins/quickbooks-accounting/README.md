# QuickBooks Accounting

Full-coverage access to the QuickBooks Online Accounting v3 API via the myHub-hosted OAuth MCP gateway. Browser OAuth flow — no env vars, no keys, just click Connect.

**~190 tools** spanning every Accounting v3 entity (CRUD + void/send/PDF where supported), all 30 standard reports, attachments, raw query, batch, and change-data-capture.

## Configuration

No environment variables required. On first use, the browser redirects to `appcenter.intuit.com` — sign in, pick a QuickBooks company, and MyHub remembers the realm for the rest of the session. Reconnect to switch companies.

Scopes requested:

```
com.intuit.quickbooks.accounting
```

The realm (company) is fixed at OAuth time and read from the bearer token's `qboRealmId`. Re-authorize to switch companies.

## Tool categories

### Transaction entities (16)
CRUD via `list_*`, `get_*`, `create_*`, `update_*`, `delete_*`. Many also support `void_*`, `send_*`, `pdf_*` (see per-entity notes).

- **Invoice** — CRUD + void + send + PDF
- **Bill** — CRUD
- **BillPayment** — CRUD + void
- **Payment** — CRUD + void + send + PDF
- **SalesReceipt** — CRUD + void + send + PDF
- **CreditMemo** — CRUD + void + send + PDF
- **RefundReceipt** — CRUD + void + send + PDF
- **Estimate** — CRUD + send + PDF
- **Purchase** — CRUD (cash/check/credit-card expense)
- **PurchaseOrder** — CRUD + send + PDF
- **JournalEntry** — CRUD
- **Transfer** — CRUD (bank-to-bank)
- **Deposit** — CRUD
- **VendorCredit** — CRUD
- **TimeActivity** — CRUD
- **ReimburseCharge** — read-only (`list`, `get`)

### Name-list / master entities (15)
- **Account** — CRUD (chart of accounts)
- **Customer** — CRUD
- **Vendor** — CRUD
- **Employee** — CRUD
- **Item** — CRUD (products & services)
- **Class** — CRUD (segmentation)
- **Department** — CRUD (locations)
- **PaymentMethod** — CRUD
- **TaxCode** — read-only
- **TaxRate** — read-only
- **TaxAgency** — `list`, `get`, `create`
- **Term** — CRUD (payment terms)
- **Budget** — read-only
- **CompanyCurrency** — CRUD
- **ExchangeRate** — `list` only

### Singletons (3)
- `get_company_info` — CompanyInfo metadata, address, fiscal year start
- `get_preferences` — accounting, sales-form, time-tracking settings
- `update_preferences` — pass `sparse=true` to merge

### Attachments (3)
- `list_attachables`, `get_attachable`, `create_attachable`, `update_attachable`, `delete_attachable` — metadata CRUD
- `upload_attachment` — upload a file (base64) and optionally link to an entity via `AttachableRef`
- `download_attachment` — get a pre-signed URL (~15 min TTL) for the file bytes

### Reports (30)
One tool per report: `get_report_<snake_name>`. Most params optional; Intuit ignores params a report doesn't use.

- `get_report_profit_and_loss`, `get_report_profit_and_loss_detail`
- `get_report_balance_sheet`, `get_report_trial_balance`, `get_report_general_ledger`, `get_report_general_ledger_detail`
- `get_report_cash_flow`
- `get_report_aged_receivables`, `get_report_aged_receivable_detail`
- `get_report_aged_payables`, `get_report_aged_payable_detail`
- `get_report_customer_balance`, `get_report_customer_balance_detail`, `get_report_customer_income`, `get_report_customer_sales`
- `get_report_vendor_balance`, `get_report_vendor_balance_detail`, `get_report_vendor_expenses`
- `get_report_sales_by_customer`, `get_report_sales_by_product`, `get_report_sales_by_class_summary`, `get_report_sales_by_department`
- `get_report_class_sales`, `get_report_department_sales`, `get_report_item_sales`
- `get_report_inventory_valuation_summary`
- `get_report_account_list`, `get_report_journal_report`, `get_report_transaction_list`, `get_report_tax_summary`

### Query, batch, change-data-capture (3)
- `qbo_query` — run an arbitrary QBO SQL-like query (`SELECT * FROM Invoice WHERE Balance > '0' ...`). MAXRESULTS capped at 1000.
- `qbo_batch` — up to 30 operations in a single request
- `qbo_cdc` — change-data-capture: all listed entity types updated since an ISO timestamp (max 10 entities). Cheaper than polling.

## Update semantics

QuickBooks updates require both `Id` and `SyncToken` (an optimistic-concurrency version). Two modes:

- **Full update** (default) — body fully replaces the entity. Omitted fields are cleared.
- **Sparse update** (`sparse=true`) — body merges into the existing entity. Use this unless you mean to wipe fields.

Always read the entity first to pick up the latest `SyncToken`. A stale token returns a 5010 error.

## Destructive operations

These are irreversible or semi-irreversible — the agent will warn you, but confirm before calling:

- `delete_*` on most entities — hard DELETE
- `void_invoice`, `void_payment`, `void_credit_memo`, `void_sales_receipt`, `void_refund_receipt`, `void_bill_payment` — sets the txn to voided/zero amount; the record remains for audit but the financial impact is reversed

## See also

- [QuickBooks Online Accounting API docs](https://developer.intuit.com/app/developer/qbo/docs/api/accounting/most-commonly-used/account)
- [QBO query reference](https://developer.intuit.com/app/developer/qbo/docs/learn/explore-the-quickbooks-online-api/data-queries)
