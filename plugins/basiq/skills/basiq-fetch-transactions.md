---
name: basiq-fetch-transactions
description: Fetch and analyse bank transactions for a Basiq user. Use when the user asks about transactions, spending, account activity, or wants to retrieve financial records for a specific user or account.
---

# Fetch bank transactions

Retrieve live bank transaction data via the Basiq API using the `execute-request` tool.

## Inputs needed

- **User ID** — the Basiq user identifier (UUID). Required for all data retrieval calls.
- **Account ID** (optional) — narrow to a specific bank account; omit to get all accounts.
- **Date range** (optional) — from/to date filters in ISO 8601 format (YYYY-MM-DD).
- **Limit** (optional) — number of records; default is typically 100.

## How to proceed

1. If you do not have the user ID, call `search-endpoints` with "users" to find the list-users endpoint, then use `execute-request` to retrieve or confirm the user.

2. Call `get-endpoint` for the transactions endpoint (search for "transactions" if the exact path is unclear) to confirm the required parameters and response schema.

3. Call `execute-request` with:
   - The transactions endpoint path (e.g. `/users/{userId}/transactions`)
   - The `userId` path parameter filled in
   - Any date or account filters the user requested

4. Parse and present the response:
   - Show transaction date, description, amount, and account name
   - Group by date or category if the user asked for a summary
   - Flag large or unusual transactions if the user asked for anomaly detection

## Constraints

- Never invent a user ID — always retrieve or confirm it first.
- Basiq transaction data reflects what was last synced from the bank; if data looks stale, suggest the user trigger a refresh job.
- Transactions are read-only; you cannot create, update, or delete transaction records.
- Respect the response pagination (`nextLink` / cursor) if the result set is large — do not claim to have all transactions if you only retrieved one page.
