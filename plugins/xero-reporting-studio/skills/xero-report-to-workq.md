---
name: xero-report-to-workq
description: Turn what a Xero report flags (overdue invoices, unpaid bills, unreconciled transactions, failed checks, exceptions) into WorkQ items. Use when the user says "make tasks from this report", "add these to WorkQ", "create follow-ups for the overdue ones" or "put the exceptions on my list".
---
# Report exceptions to WorkQ (Xero)

Use when the user wants follow-up work from a Xero report in WorkQ. A report can't create items itself; you do it with `todo_list` and `todo_create`. If you don't have those tools, say so.

1. **The report:** the one you just made, or the saved report the user names (`artifact_list`, then `artifact_get` for its title, its inputs, such as the client and the period, and its link).
2. **The figures:** call the same Xero tools the report's skill names, for the organisation (`xero_tenant_id`) and the period the report used. Never copy figures out of the report page.
3. **Propose the items:** one line per follow-up (what to do, who or what it's about, the amount, why), at most 20. Ask the user to confirm the list and a due date. Combine many small items into one item with a checklist in its description.
4. **No duplicates:** `todo_list` with `labels: ["report:<template slug>"]`; skip anything already open for the same client and subject, and say so.
5. **Create** each with `todo_create`:
   - `title`: "<client>: <action>", for example "Northside Plumbing: chase INV-1042, $4,180, 45 days overdue";
   - `description`: the figures, the period, what to do, and the report's link;
   - `labels`: ["reporting", "xero", "report:<template slug>", "<client>"];
   - `priority`: "high" for anything the report shows in red, otherwise "medium"; `dueDate` (YYYY-MM-DD) when given.
   The items are the asking user's (the default). You can't look up other people, so for someone else's items tell the user to reassign them in WorkQ.
6. Reply with each item created, and anything skipped.

Never create items before the user agrees to the list. One client per item. For payroll reports, never put an employee's pay, tax file number, bank details or address in WorkQ: use counts and the report's link.

Example: "Make follow-ups for the invoices more than 60 days overdue" → the aged receivables data for that client → propose 4 items → the user agrees, due Friday → `todo_list` (none open) → 4 × `todo_create` → the list with their links.
