# Employment Hero Payroll

Read-only payroll reporting from **Employment Hero Payroll** (formerly KeyPay, Australia) through the myHub-hosted MCP server `employment-hero-payroll`: pay runs and their totals, gross to net, PAYG withholding (BAS W1 / W2), superannuation contributions, pay categories, leave balances, payment summaries and employee details.

Australian QuickBooks Online payroll is powered by Employment Hero, so QuickBooks Reporting Studio uses this connector for its payroll, employee and ATO reports (library Q32–Q34).

Employment Hero **Payroll** is a separate product from the Employment Hero **HR** platform (the `employment-hero` extension): it has its own login and its own API key.

## Configuration

| Variable | Required | Description |
|---|---|---|
| `EH_PAYROLL_API_KEY` | Yes | Your Employment Hero Payroll API key: in Employment Hero Payroll, open **My Account → API key** (Generate API key). The key has your own payroll access; the connector only reads. |

Every tool takes an optional `business_id` (the number in the payroll URL, e.g. `…/business/123456/…`). Without it, the first business the key can see is used; `list_businesses` shows them all.

## Tools

Every tool is read-only.

| Tool | Description |
|---|---|
| `list_businesses` | The payroll businesses the API key can see (id, name, ABN, employees, pay frequency). |
| `list_pay_runs` | Pay runs by date paid (finalised only by default): pay period, date paid, finalised. |
| `get_pay_run_totals` | One pay run's gross, PAYG / HELP / SFSS withheld, net, super and employer liabilities — overall and by employee. |
| `get_report_gross_to_net` | Gross to net for a date range or one pay run, per employee, with totals. |
| `get_report_payg` | PAYG withholding by month, with the BAS figures W1 (gross wages) and W2 (PAYG withheld). |
| `get_report_super_contributions` | Super contributions by employee or by super fund. |
| `get_report_pay_categories` | Amounts by pay category, pay run and employee. |
| `get_report_leave_balances` | Leave balances and leave value by employee and leave category. |
| `list_payment_summaries` | PAYG payment summaries for a financial year (employers on Single Touch Payroll get ATO income statements instead). |
| `get_report_employee_details` | Employee details report. |
| `get_stp_registration` | Single Touch Payroll registration status. |

## Privacy

Pay figures are returned. Tax file numbers, bank details, dates of birth, home addresses and personal contact details are removed from every response by the server.

## Limits

- Single Touch Payroll lodgement history is not available from Employment Hero's API.
- One payroll business per report (choose it with `business_id`).
- Standard Employment Hero Payroll (`api.yourpayroll.com.au`) only; white-label payroll sites are not offered on the Connect form yet.
