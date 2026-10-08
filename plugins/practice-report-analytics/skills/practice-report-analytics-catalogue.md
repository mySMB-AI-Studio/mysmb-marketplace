---
name: practice-report-analytics-catalogue
description: PRA-00 Practice catalogue — every practice-wide report as a box, with what is live and how to open it, plus the Work list box. Use when the user asks what practice reports exist, for the practice catalogue, or "what can you report on across all clients".
---

# PRA-00 Practice catalogue

Use when the user asks which practice-wide reports exist, for the practice report catalogue or menu, or is unsure which report they need.

1. Call `artifact_from_template` with `plugin: "practice-report-analytics"`, `slug: "practice-report-catalogue"`, `title: "Practice Report Catalogue"`. This is a static catalogue (no inputs).
2. Reply with the report button and a short summary: live now are PRA-01, PRA-02, PRA-03, PRA-04, PRA-05, PRA-06 (Client Summary, Sales, Purchases, Bank Reconciliation, Banking, Financial Overview). Data Quality and other quality/activity reports need the checks engine (step 3); time reports need a time source; Quadrant/Activity Count/Work Items are a later wave.
3. To open a box, the user presses **Use this report** on that template in Reports → From your plugins, or asks you; then load the matching skill.
