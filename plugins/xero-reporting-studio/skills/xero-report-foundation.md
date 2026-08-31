---
name: xero-report-foundation
description: Apply the shared data, validation, visual, and delivery rules for every Xero report.
---
# Xero report foundation

Load this skill with the specific report skill.

Confirm the Xero organisation, period or as-at date, accounting basis, and presentation currency. Do not ask for an output format: every report is a single self-contained HTML document saved through `artifact_save` with a `.html` filename.

Use the connected Xero tools for live data. Never invent, estimate, silently substitute, or reuse illustrative workbook values. Mark unavailable figures N/A - not in source and include a Sources & limitations section naming tool calls, report dates, basis, currency, missing inputs, and assumptions explicitly approved by the user.

Before saving, perform every tie-out required by the report skill. Show a compact Validation section with each equation and Pass/Fail. If a material check fails, explain the discrepancy prominently.

## Consistent visual system

Build accessible semantic HTML with all CSS and optional lightweight JavaScript inline; do not fetch external libraries. Use a calm Xero-inspired system: #13B5EA accent, navy #172B4D text, #F5F7FA canvas, white cards, #D8E1E8 borders, green #168A52 positive, red #C9362B overdue/negative. Use a responsive 12-column card grid, 8px spacing rhythm, system sans-serif, strong hierarchy, tabular numerals, bracketed negatives, and clear print styles. Prefer SVG/CSS charts with legends and accessible labels. Tables need sticky headers when useful, right-aligned numbers, visible totals, and horizontal overflow on small screens.

The header must show report name, organisation, period, basis, currency, generated timestamp, and data freshness. Add an executive summary, then detail, validation, and sources. Save the final document with `artifact_save`; do not paste HTML into chat.