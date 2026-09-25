# QuickBooks Reporting Studio

Live, validated QuickBooks Online reports in QuickBooks styling — statements, ageing, GST/BAS, dashboards and management packs — with a specialist reporting agent.

Reporting Library: QuickBooks Reports Prompt Library v1.1 (Q00–Q39). This version delivers **Waves 1 and 2** (22 families).

## What's in the box

- **Agent:** QuickBooks Reporting Specialist (AGT-003), on Sonnet, with the `quickbooks-accounting` connector.
- **Skills:** 1 foundation (build recipe, controls contract, validation rules, the tested report kit and stylesheet) + 22 family skills:
  - Q17 Profit and Loss family — `quickbooks-profit-and-loss`
  - Q18 Balance Sheet family — `quickbooks-balance-sheet`
  - Q19 Statement of Cash Flows — `quickbooks-statement-of-cash-flows`
  - Q24 Accounts receivable family — `quickbooks-aged-receivables`
  - Q26 Accounts payable family — `quickbooks-aged-payables`
  - Q22 Trial Balance family — `quickbooks-trial-balance`
  - Q28 GST and PAYG family (BAS) — `quickbooks-gst-bas`
  - Q15 GST overview (BAS centre) — `quickbooks-gst-overview`
  - Q20 Business Snapshot — `quickbooks-business-snapshot`
  - Q00 Homepage — Business at a glance — `quickbooks-homepage`
  - Q07 Cash flow overview — `quickbooks-cash-flow-overview`
  - Q06 Performance centre (KPI charts) — `quickbooks-performance-centre`
  - Q04 Management reports (report packs) — `quickbooks-management-reports`
  - Q16 Client overview (accountant-only) — `quickbooks-client-overview`
  - Q23 General Ledger and transaction-list family — `quickbooks-general-ledger`
  - Q25 Sales and customers family — `quickbooks-sales-and-customers`
  - Q27 Expenses and suppliers family — `quickbooks-expenses-and-suppliers`
  - Q01 Business feed — `quickbooks-business-feed`
  - Q08 Budgets (Budget vs Actuals) — `quickbooks-budgets`
  - Q10 Expenses & Pay Bills overview — `quickbooks-expenses-overview`
  - Q11 Sales & Get Paid overview — `quickbooks-sales-overview`
  - Q02 Standard reports catalogue — `quickbooks-reports-catalogue`
- **Every report:** live data, client selector (one company per connection), period presets that roll forward, Cash/Accrual, Display columns by, Compare to, Customise (cents, divide by 1000, zero rows, negatives, header/footer), persona modes, QuickBooks look with a mySMB house-style toggle, light and dark themes, a validation banner, Download PDF and Download Excel (.xlsx), and Open in QuickBooks where a deep link exists.

Connect QuickBooks under Settings → Connections (OAuth) before asking for a report.

## Connector limits (stated in the reports)

- One QuickBooks company per connection.
- Ageing reports age as of today: `report_date`, `aging_period`, `num_periods`, `aging_method` and `past_due` are not passed by the connector yet.
- `get_report_tax_summary` has returned no rows on a live company; the GST reports then say "unavailable — not zero".
- PAYG, payroll, employee and ATO reports live in Employment Hero.
- `get_company_info` looks CompanyInfo up by realm id and returns "not found". The reports read CompanyInfo through `qbo_query` instead.

## Maintenance

The skills embed a report kit that is tested as one unit, with each family's `dataBindings` and config. Change a report by changing its skill here in code, not by hand-editing a copy in the Developer Instance.

## Configuration

No configuration variables are required.
