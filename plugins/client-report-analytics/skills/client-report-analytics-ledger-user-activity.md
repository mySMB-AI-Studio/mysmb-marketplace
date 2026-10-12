---
name: client-report-analytics-ledger-user-activity
description: CRA-14 Ledger User Activity — what people have been doing in a client's accounting file. Routes to the QuickBooks Audit Log (Q21) and MYOB Journal Security Audit (M13) skills; Xero has no organisation-wide audit log. Use when the user asks who changed, added or deleted a transaction, for an audit trail, or for ledger user activity for a client.
---

# CRA-14 Ledger User Activity

Use when the user asks what people have been doing in a client's Xero, MYOB or QuickBooks file: who added, changed or deleted which transactions, and when. This skill does not build a report itself — it routes to the right place for each platform, because the three platforms expose this very differently.

1. Confirm the client and find its platform with the discovery call (Xero `list_connections`, MYOB `list_company_files`, QuickBooks `qbo_query` `SELECT * FROM CompanyInfo`).
2. **QuickBooks** → load and use the `quickbooks-reporting-studio:quickbooks-audit-log` skill (Q21 Audit Log). It is export-based: the QuickBooks Accounting API has no audit-log endpoint, so the user attaches the Audit Log export from QuickBooks (Reports → Audit Log) and the skill builds a static page from it. If that extension is not installed, say "Ask your admin to install QuickBooks Reporting Studio" and stop.
3. **MYOB** → load and use the `myob-reporting-studio:myob-journal-security-audit` skill (M13 Journal Security Audit). It is also export-based: MYOB's Business API has no change-history endpoint, so the user attaches the MYOB export and the skill builds the page from it. If that extension is not installed, say "Ask your admin to install MYOB Reporting Studio" and stop.
4. **Xero** → say plainly that Xero has **no organisation-wide audit log** in its Accounting API. What Xero does expose is **per-record history** (who created or changed one specific invoice, bill, contact, etc.) on request, one record at a time. Offer to pull the history of a specific record if the user names one (an invoice number, a contact); do not claim to cover every transaction in a period, and never fabricate an organisation-wide activity list for Xero.
5. Never build this report by hand-writing a page yourself outside the two export-based skills above: if the relevant Reporting Studio extension is missing, say so rather than approximating the data.

## Honest limitations (state these if asked, never paper over them)

- QuickBooks and MYOB: both are **export-based**, not live — the user must attach a file each time; neither is a refreshing live report.
- Xero: **no organisation-wide audit log exists in the API at all** — this is a genuine platform gap, not a build gap. Per-record history is the only thing Xero offers, and only one record at a time.
