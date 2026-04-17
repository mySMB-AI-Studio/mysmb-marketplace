# Xero Finance

Read-only access to Xero's Finance API — higher-fidelity views over cash balances, accounts receivable/payable statements, account usage, and bank statement reconciliation. All tools are read-only.

## Configuration

No environment variables required. Browser OAuth — click Connect in MyHub to sign in and pick a Xero org.

Scopes requested:
```
offline_access openid profile email
finance.cashvalidation.read
finance.statements.read
finance.accountingactivity.read
finance.bankstatementsplus.read
```

## Tools (6)

- `get_cash_validation` — Validate cash balances (Xero vs imported bank statement)
- `get_accounts_receivable_statements` — AR statements over a date range
- `get_accounts_payable_statements` — AP statements over a date range
- `get_account_usage` — Monthly account usage totals (anomaly detection)
- `get_lock_history` — Period-lock / end-of-period close events
- `get_bank_statement_accounting` — Line-item view of a bank statement with Xero accounting entries alongside

## See also

- [Xero Finance API docs](https://developer.xero.com/documentation/api/finance/overview)
