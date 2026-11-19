---
name: client-report-analytics-agent-foundation
description: Which Client Report Analytics template to use for which ask, and how to set its client, period and display inputs, for the Client Report Analytics Agent (Xero). Load before creating any client report.
---

# Client reports: which template, which inputs

Use before you create any client report: it maps the ask to a Client Report Analytics template and tells you exactly which inputs to set. Phase 1 covers **Xero clients only**. For MYOB or QuickBooks, say the agent doesn't cover them yet and that mySidekick's Client Report Analytics reports do.

## The templates (extension `client-report-analytics`)

You never copy or write a report. Every report is `artifact_from_template` with `plugin: "client-report-analytics"` and one of these slugs.

| Ask | Report | Slug | Period default |
|---|---|---|---|
| "what reports are there", client menu | CRA-00 Client catalogue | `client-report-catalogue` | none |
| revenue, profit, bank, ageing, client dashboard | CRA-01 Financial Overview | `client-xero-financial-overview` | this financial year to date |
| what the checks found, data quality | CRA-02 Data Quality | `client-xero-data-quality` | this financial year to date |
| sales by tracking category / class / job | CRA-03 Sales by Tracking Category | `client-xero-sales-by-tracking` | this financial year to date |
| purchases by tracking category | CRA-04 Purchases by Tracking Category | `client-xero-purchases-by-tracking` | this financial year to date |
| GST by tax type by month, BAS preparation review | CRA-05 Summary of Tax Amounts by Type | `client-xero-tax-by-type` | last quarter |
| contacts / ABNs for the BAS | CRA-06 Contact Details for BAS Preparation | `client-xero-contacts-bas` | last quarter |
| BAS transactions, the lines behind the GST | CRA-07 BAS Related Transactions and GST | `client-xero-bas-transactions` | last quarter |
| what to ask the client, missing receipts or ABNs | CRA-08 Client Queries | `client-xero-client-queries` | this financial year to date |
| health check, one-page summary | CRA-09 Health Check | `client-xero-health-check` | this financial year to date |
| GST check, GST risk, is the GST coding right | CRA-10 GST Check | `client-xero-gst-check` | this financial year to date |
| how active the file is, transaction counts | CRA-11 Activity Count | `client-xero-activity-count` | this financial year to date |
| hours in the client's Xero Projects | CRA-12 Actual Time | `client-xero-actual-time` | this financial year to date |
| estimate vs actual (Xero Projects) | CRA-13 Estimate Accuracy | `client-xero-estimate-accuracy` | none (all projects) |

Not a template: a standard Xero report (Profit and Loss, Balance Sheet, aged receivables …) is in the Xero Reporting Studio extension; Workspace User Activity is the built-in Reports → Workspace Activity; Xero has no organisation-wide audit log. Say so rather than approximating.

If the ask matches no row, ask one question to narrow it down, offering the two or three closest reports. Never pick a report the requester didn't ask for.

## Inputs

Set **only** these inputs. Every other input keeps the template's default, and the report fixes its own derived inputs when it opens.

1. **Client (`org`)**: the Xero organisation id. Call `list_connections` (xero-accounting) once and match the client's name to a `tenantName`. Use its `tenantId`. If no connection matches, or two do, say so, list the names you can see and ask. Never guess, and never put another client's id in a report. For the catalogue the input is `client` = `xero:<tenantId>`, not `org`.
2. **Period** (every template except the catalogue and Estimate Accuracy): it is controlled by the `display` input's `p` key **and** `from_date` / `to_date`. When the report opens, it re-sets the dates from `p` unless `p` is `custom`.
   - For a named period, set only `display` with `p` set to the preset: `this_month`, `last_month`, `this_quarter`, `last_quarter`, `this_fy`, `this_fy_td` (this financial year to date), `last_fy`, `last_12m`. Leave the dates alone.
   - For explicit dates, set `from_date` and `to_date` (`YYYY-MM-DD`) **and** `display` with `p` set to `custom`.
   - For `display`, take the template's default string from the table below, change only `p` and pass it back as a string. Keep every other key exactly as it is.
   - Australian financial year: 1 July – 30 June. "Last quarter" is the last complete calendar quarter, which is a BAS quarter.
3. **Basis** (Financial Overview, Sales/Purchases by Tracking only): `basis` = `Accrual` (default) or `Cash`. Ask only if the requester mentions cash.
4. **Title**: "<Report> — <client name> — <period in words>", for example "Health Check — Irvine Jackson Pty Ltd — Jul–Sep 2026".

Default `display` strings (as shipped; `p` is the part you change):

| Slug | Default `display` |
|---|---|
| `client-xero-financial-overview` | `{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"mysmb","dens":"100","p":"this_fy_td","a":"custom","c":"none","v":""}` |
| `client-xero-data-quality`, `client-xero-client-queries`, `client-xero-health-check`, `client-xero-gst-check` | `{"cents":1,"k":0,"zeros":1,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"mysmb","dens":"100","p":"this_fy_td","a":"custom","c":"none","v":""}` |
| `client-xero-sales-by-tracking`, `client-xero-purchases-by-tracking` | `{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"xero","dens":"100","p":"this_fy_td","a":"custom","c":"none","v":"","o":"opt="}` |
| `client-xero-tax-by-type` | `{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"mysmb","dens":"100","p":"last_quarter","a":"custom","c":"none","v":"gst","o":"b=org"}` |
| `client-xero-bas-transactions` | `{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"mysmb","dens":"100","p":"last_quarter","a":"custom","c":"none","v":"tax","o":"b=org"}` |
| `client-xero-contacts-bas` | `{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"mysmb","dens":"100","p":"last_quarter","a":"custom","c":"none","v":""}` |
| `client-xero-activity-count` | `{"cents":0,"k":0,"zeros":1,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"mysmb","dens":"100","p":"this_fy_td","a":"custom","c":"none","v":""}` |
| `client-xero-actual-time` | `{"cents":0,"k":0,"zeros":1,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"mysmb","dens":"100","p":"this_fy_td","a":"custom","c":"none","v":""}` |

If the period is the template's default, don't set `display` at all.

## What the person opening the report needs

A report fetches its data live **as the person who opens it**, from their own connections. It is not a snapshot taken by you.
- Every Xero report needs Xero connected, with access to that client.
- Contact Details for BAS also uses ABR Lookup for the register column (otherwise it reads "N/A — connect ABR Lookup").
- Actual Time and Estimate Accuracy need the Xero Projects extension connected.

Say this in one line when you hand over a report that needs more than Xero.

## Rules

- One client per report. Never invent or estimate a figure, and never quote a figure you didn't read from a tool result. The report validates itself; its banner shows the checks.
- Checks that a report shows as N/A or "runs overnight" are never "passed".
- `template_not_found` or "no report template": say the Client Report Analytics extension isn't installed or up to date in this workspace. Never hand-write a report instead.
- `needs_connection`: "Connect Xero (Settings → Connections)". Show any other tool error word for word, and retry at most once.
- Read-only: you never change anything in Xero.

Example: "Health check for Irvine Jackson, last quarter" → `list_connections` → `tenantId` for "Irvine Jackson Pty Ltd" → `artifact_from_template` { plugin `client-report-analytics`, slug `client-xero-health-check`, title "Health Check — Irvine Jackson Pty Ltd — Jul–Sep 2026", inputs { `org`: "<tenantId>", `display`: the health-check default string with `"p":"last_quarter"` } }.
