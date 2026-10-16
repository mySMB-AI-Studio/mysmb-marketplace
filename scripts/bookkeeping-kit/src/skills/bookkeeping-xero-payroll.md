---
name: bookkeeping-xero-payroll
description: How the Bookkeeping Payroll for Xero extension stores payroll settings, pay runs and pay guides, and how to answer pay run status and check questions safely. Use before any pay run, payroll check, payroll review or client payroll approval task.
---

# Bookkeeping Payroll for Xero: how it works

Use when someone asks about a client's pay run, what the payroll check found, a payroll review or a client's payroll approval. The practice and client settings come from Bookkeeping for Xero (`Bookkeeping/settings.json`, `Bookkeeping/Clients/<client>.json`, which holds the client's `xero_tenant_id`).

## Where things live (Knowledge, org level)

| Path | What it is |
|---|---|
| `Bookkeeping/Payroll/<client>.json` | Payroll settings: `calendar` (Xero pay calendar name), `prep_day`, `prep_time`, `timesheets` (`deputy`, `xero`, `emailed`, `none`), `ts_owner`, `ts_email`, `officer_id`, `reviewer_id`, `approvers`, `who_posts` (`client` or `practice`) |
| `Bookkeeping/PayRuns/<client>-<period start>.json` | One record per pay run: `status` (`open`, `checked`, `in_review`, `changes`, `client_approval`, `approved`, `done`, `cancelled`), `period_start`, `period_end`, `payment_date`, `item_id`, `last_check` (`open_items`, `summary`, `changes`, `url`), `notes`, `pack_url`. A file named after a WorkQ item id holds only `link` |
| `Bookkeeping Payroll/<client>/` | The client's `pay-guide.xlsx` (rates, employees, rules, holidays, pay_items) and each period's reimbursement spreadsheet |

## WorkQ labels

Every item has `bookkeeping` plus one of: `payroll` (a pay run), `payroll-review` (internal review of a pay run), `payroll-approval` (record the client's approval), `setup` (with `payroll`: a Client payroll settings item). The client's slug is also a label.

## Answering questions

1. **Find the client**: list `Bookkeeping/Payroll/` and match the name. If two match or none does, ask.
2. **Pay run status**: read the latest `Bookkeeping/PayRuns/<client>-<period start>.json`. Explain its `status` and, from `last_check`, how many things are open and the report link.
3. **Xero Payroll calls**: always pass `xero_tenant_id` from the client's file in `Bookkeeping/Clients/`.
4. **Check findings**: quote the report (`last_check.url`). Each finding is something for the payroll officer to fix or confirm in Xero Payroll, then run the checks again from the Pay run form.

## Never

- Change anything in Xero Payroll: employees, timesheets, pay runs or leave. The payroll officer makes every change.
- Send an email. Client emails are drafts for a person to send.
- Share one client's employees, pay rates or pay run figures with another client, or quote pay details outside the people working on that pay run.
