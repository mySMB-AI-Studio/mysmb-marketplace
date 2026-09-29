---
name: xero-report-pack
description: Assemble a combined Xero report pack from already-built report skills (Profit and Loss, Balance Sheet, Aged Receivables, Aged Payables by default) into one document. Use for "report pack", "monthly pack", "board pack", "combine these reports", "full set of reports".
---
# Report Pack

This skill has no data of its own and declares no `dataBindings` of its own — it composes OTHER report skills, each already live per its own skill and `xero-report-foundation`. Ask which sections the user wants; default to Profit and Loss (P06), Balance Sheet (P07), Aged Receivables and Aged Payables for the same organisation and equivalent period/as-at date. Load and follow each selected report skill (and the foundation) in turn — every section keeps its own live `dataBindings`, controls and validation banner; this skill only decides which sections appear, in what order, and keeps the organisation and period/as-at consistent across sections where each individual skill's own inputs allow it.

Build one HTML document with a cover/contents section (organisation, pack period, sections included) followed by each selected report's assembled output, in order, each keeping its own header, controls and validation banner — never merge, recompute, or re-derive a figure across sections. `artifact_save` takes the UNION of every included section's `dataBindings` manifest (inputs and bindings from each section, de-duplicated by id — e.g. one shared `org` / `connections` binding instead of one per section) so the whole pack stays live within the platform's 8-input/12-binding cap; if the requested sections would exceed that cap, say so and ask the user to drop a section rather than silently truncating one.

Validate that every included section reports its own checks (the pack shows a combined summary counting each section's x/y passed, never inventing a cross-section tie the individual skills don't already perform) and that the organisation and period named on the cover match what every section actually queried.
## Interactivity

No new inputs beyond the merge itself: reuse `organisation` as one shared binding/input across every section, and each section's own period/as-at inputs — rename an input only if two selected sections would otherwise declare the same name for a different purpose, and state the rename. Section order and which sections are shown or collapsed is client-side. If the merged input/binding count would exceed the platform's 8/12 cap, drop sections starting from the one most recently added to the request, in agreement with the user, rather than silently dropping bindings.
