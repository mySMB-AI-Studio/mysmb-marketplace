---
name: requesting-myconnect-changes
description: How to file, track, and approve myConnect change requests through the myConnect Builder WorkQ pipeline. Use when someone asks how to request myConnect changes, check build status, or what the mcb labels and approval commands mean.
---

# Requesting myConnect Changes

myConnect change requests are WorkQ items assigned to **myConnect Builder**. The builder
plans, implements, and deploys each request, reporting on the item itself. Humans stay in
control at two gates: plan approval and release approval.

## Filing a request

1. Create a WorkQ item from the **myConnect Change Request** template (or manually).
2. Fill in Goal / Scope / Acceptance in the description.
3. **Attach the change document** (Word, PDF, or Markdown) to the item.
4. Assign the item to **myConnect Builder**.

The builder acknowledges on the item, downloads the attachments, and produces an
execution plan.

## Stages (shown as labels on the item)

| Label | Meaning |
|---|---|
| `mcb:planning` | Builder is reading the request and writing the execution plan |
| `mcb:plan-review` | Plan posted (comment + attachment) — waiting for `approve plan` |
| `mcb:executing` | Approved plan being implemented, tested, and deployed to QA |
| `mcb:qa-review` | QA build ready — verify it, then `approve release` |
| `mcb:deploying` | Shipping to UAT, then Production |
| `mcb:blocked` | Builder needs an answer — see its latest comment |

Item status `done` + a completion summary comment means the request is fully shipped.

## Approval commands (post as a comment on the item)

- `approve plan` — accept the execution plan and start the build
- `approve release` — after verifying QA, ship to UAT + Production
- `request changes: <notes>` — return the plan or QA build with feedback
- `hold` / `resume` — pause or resume the request

Only listed approvers can advance gates; other comments are treated as discussion and
passed to the builder as context.
