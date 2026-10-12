---
name: client-report-analytics-catalogue
description: CRA-00 Client catalogue — every client report as a box for the selected client (Financial, Tax & BAS, Sales & purchases, Quality, Activity, Time, Platform reports), with what is live and how to open it. Use when the user asks what client reports exist, for the client catalogue, or "what can you report on for <client>".
---

# CRA-00 Client catalogue

Use when the user asks which reports exist for a client, for the client report catalogue or menu, or is unsure which report they need.

1. If the user named a client, find it with the discovery call for its platform (Xero `list_connections`, MYOB `list_company_files`, QuickBooks `qbo_query` `SELECT * FROM CompanyInfo`) and build the client value `<platform>:<id>` (`xero:<tenantId>`, `myob:<company file Id>`, `quickbooks:<CompanyInfo Id>`).
2. Call `artifact_from_template` with `plugin: "client-report-analytics"`, `slug: "client-report-catalogue"`, `title: "Client Report Catalogue — <client name>"` and, when you have it, `inputs: { "client": "<platform>:<id>" }`. The catalogue lists the user's clients from their own connections; they can switch client in it.
3. Reply with the report button and a short summary: live now for Xero, MYOB and QuickBooks are CRA-01 Financial Overview, CRA-05 Summary of Tax Amounts by Type, CRA-07 BAS Related Transactions and GST, CRA-03 Sales by Tracking Category, CRA-04 Purchases by Tracking Category, CRA-06 Contact Details for BAS Preparation, CRA-11 Activity Count, CRA-15 Workspace User Activity, plus the platform's own report library (CRA-16) and CRA-14 Ledger User Activity (routes to the platform's own audit-log skill for QuickBooks and MYOB; Xero has no org-wide audit log, only per-record history on request). Data Quality, Client Queries, Health Check and GST Check need the checks engine (WL-00); time reports need a time source (Xero Practice Manager practices, Wave 3). Contact Details for BAS Preparation (CRA-06) and Workspace User Activity (CRA-15) are partial builds: no ABR registry match yet, and little or no WorkQ activity until the checks engine ships findings — say so plainly if asked.
4. To open a box, the user presses **Use this report** on that template in Reports → From your plugins, or asks you ("Financial overview for <client>"); then load the matching skill.

The catalogue does not look up the latest saved copy of each report and shows no sparklines yet; Workspace has no "Display in client portal" setting for reports, so the catalogue's portal check is "for information". Say so if asked.
