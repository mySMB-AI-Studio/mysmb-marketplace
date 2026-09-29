# Airwallex

Global business banking & payments via [Airwallex](https://www.airwallex.com) — account balances, the financial transaction ledger, outbound transfers (payouts), and payment intents (payment acceptance), through the myHub-hosted `airwallex` MCP gateway (`myhub-mcp-servers`). All operations are read-only.

## Configuration

No configuration variables are required.

## Tools

All tools carry `readOnlyHint: true`. This is a deliberately read-only first cut — Airwallex's write endpoints (create a transfer, confirm/capture/cancel a payment intent, create a beneficiary, etc.) move real money or create real payment obligations, so they are out of scope until the read path has been exercised against a live account and the team has decided how a workspace tile should gate an action that moves money.

| Tool | Description |
|---|---|
| `get_airwallex_balances` | Current account balance for every currency held, optionally filtered to one `account_type` (cash/yield/credit). Returns available/pending/reserved/total amounts per currency. Not paginated. |
| `list_airwallex_financial_transactions` | Financial transactions that contributed to the account balance (deposits, transfers, fees, conversions, etc.), optionally filtered by currency, status (`PENDING`/`SETTLED`), batch/source ID, or a `created_at` date range. Paginates with `pageNum`/`pageSize`; response includes `has_more`. |
| `get_airwallex_financial_transaction` | Full details for a single financial transaction by ID. |
| `list_airwallex_transfers` | Outbound transfers (payouts to beneficiaries), optionally filtered by status, `transferCurrency`, `beneficiaryId`, `batchTransferId`, `requestId`, `shortReferenceId`, or a `created_at` date range. Without an explicit date range or page cursor, Airwallex defaults to the last 30 days. Paginates with a cursor (`page_after`/`page_before`) rather than page numbers — pass the previous response's `page_after` or `page_before` straight back in `page`. |
| `get_airwallex_transfer` | Full details for a single transfer (payout) by ID. |
| `list_airwallex_payment_intents` | Payment intents (incoming payments / payment acceptance), optionally filtered by currency, status, `merchantOrderId`, `paymentConsentId`, `connectedAccountId`, or a `created_at` date range. Paginates with `pageNum`/`pageSize`; response includes `has_more`. |
| `get_airwallex_payment_intent` | Full details for a single payment intent by ID. |

## See also
- [Airwallex API reference](https://www.airwallex.com/docs/api/introduction)
