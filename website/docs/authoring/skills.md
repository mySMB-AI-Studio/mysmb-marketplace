---
id: skills
title: Skills
sidebar_position: 3
---

# Skills

A skill is a single Markdown file that teaches the model how to perform **one well-scoped task**. Skills become available as slash commands.

## Anatomy

```markdown title="plugins/acme-billing/skills/acme-billing-create-invoice.md"
---
name: acme-billing-create-invoice
description: Draft a new invoice in Acme. Use when the user says "invoice X for $Y", "bill the customer", or asks to create a new invoice line.
---

# Create an invoice

Use the `create_invoice` tool. The tool returns the new invoice with its server-assigned `id` and `number`.

## Required fields

- `customerId` — resolve from name with `find_customer` first; if more than one match, ask which.
- `lineItems` — array of `{ description, quantity, unitPrice }`. Never invent prices; ask if missing.

## Working style

1. Resolve the customer before creating.
2. Confirm totals out loud before calling the tool.
3. After success, echo the invoice number and total.
4. On 4xx errors, surface the message verbatim — do not retry.
```

## Rules

- One skill per file. Filename = skill name = the `name:` in frontmatter.
- **Slug-prefix the name** so skills don't collide across plugins (`acme-billing-create-invoice`, not `create-invoice`).
- Frontmatter requires `name` and `description`. The description is what the LLM matches against the user's prompt to decide whether to load the skill — be specific about trigger phrases.
- Body: short, imperative, second person. Tell the model what to do, in what order, and what *not* to do.

## Good vs. bad descriptions

```yaml
# bad — too generic, won't trigger reliably
description: Helps with invoices.

# good — specific verbs, real phrases users say
description: Draft a new invoice in Acme. Use when the user says
  "invoice X for $Y", "bill the customer", or asks to create a
  new invoice line.
```

## Up next

→ [Agents](./agents)
