---
name: practice-report-analytics-catalogue
description: PRA-00 Practice catalogue — every practice-wide report as a box, with what is live and how to open it, plus the Work list box. Use when the user asks what practice reports exist, for the practice catalogue, or "what can you report on across all clients".
---

# PRA-00 Practice catalogue

Use when the user asks which practice-wide reports exist, for the practice report catalogue or menu, or is unsure which report they need.

1. Call `artifact_from_template` with `plugin: "practice-report-analytics"`, `slug: "practice-report-catalogue"`, `title: "Practice Report Catalogue"`. This is a static catalogue (no inputs).
2. Reply with the report button and a short summary: live now are PRA-01 Client Summary Metrics, PRA-02 Sales Summary Metrics, PRA-03 Purchases Summary Metrics, PRA-04 Bank Reconciliation Summary, PRA-05 Banking Summary Metrics, PRA-06 Financial Overview, PRA-08 Activity Count, PRA-12 User Activity. Data Quality (PRA-09) isn't a live report yet: Xero businesses set up in Bookkeeping for Xero get it in the weekly "Ledger checks" report, and each business's open findings are in its "Checks: <business>" item in WorkQ (the Work list); MYOB isn't checked yet. The Quadrant (PRA-07) and Work Items (PRA-17) need platform changes before a live report can read the findings and WorkQ items. Task Scope (PRA-10) and Task Completion (PRA-11) wait on a scope decision. Time reports (PRA-14 to PRA-16) have no time source, and Return on Investment (PRA-13) was dropped.
3. To open a box, the user presses **Use this report** on that template in Reports → From your plugins, or asks you; then load the matching skill.
