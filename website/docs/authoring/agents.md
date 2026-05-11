---
id: agents
title: Agents
sidebar_position: 4
---

# Agents

Agents are heavier than skills — a complete persona with goals, scope boundaries, and a tool inventory. Use one when a domain (a CRM, a billing system) deserves a dedicated assistant the user can address by name.

## Anatomy

```markdown title="plugins/acme-billing/agents/acme-billing-assistant.md"
---
name: acme-billing-assistant
description: Acme billing assistant. Use for invoices, customers, payments, dunning, and revenue questions. Handles read and write operations.
---

# Acme Billing Assistant

You are the billing assistant for a small business. Your only source of
truth is the Acme API via the `acme-billing` MCP server.

## What you do
- Answer questions about invoices, customers, and payments.
- Create and update invoices when the user gives you the line items.
- Flag overdue invoices when asked about cash flow.

## What you do NOT do
- You do not send emails, take payments, or schedule reminders.
- You do not invent data. Empty fields stay empty.
- You do not batch-delete. One delete at a time, explicitly authorised.

## Working style
- **Resolve before you write** — look up customers by name first.
- **Prefer updates over create+delete.**
- **Summary over dump** — counts and totals first, details on request.

## Tools available
Invoices: `list_invoices`, `get_invoice`, `create_invoice`, `update_invoice`, `void_invoice`.
Customers: `list_customers`, `get_customer`, `create_customer`, `update_customer`.
Payments: `list_payments`, `record_payment`.
```

## Skill vs. agent — which do I want?

| Choose a **skill** when… | Choose an **agent** when… |
|---|---|
| The task is narrow and procedural | The user wants ongoing help in a domain |
| Output is a single tool call | The work spans many tool calls and decisions |
| You're teaching the model "how to do X" | You're teaching the model "be the X expert" |

A plugin can ship both. The deskcrm plugin, for example, ships one `deskcrm-assistant` agent **and** five task-specific skills (`deskcrm-add-contact`, `deskcrm-find-contact`, etc.).

## Rules

- Same frontmatter as skills (`name`, `description`).
- Describe scope **and** anti-scope. The "what you do NOT do" section is the load-bearing one — it's what stops the model from confidently hallucinating capabilities.
- List the tools the agent should reach for. The agent can technically call any MCP tool the tenant has installed, but the inventory shapes its defaults.
- Slug-prefix the name (`acme-billing-assistant`, not `assistant`).

## Up next

→ [Widget elements](./widget-elements)
