---
name: ignition-quick-ref
description: Quick reference for common Ignition MCP operations. Use when you need a fast reminder of which tool to call for clients, proposals, invoices, payments, deals, or services in Ignition.
---

# Ignition MCP — Quick Reference

## Clients & Contacts (8 tools)

| Task | Tool |
|------|------|
| Search clients by name or email | `list_clients` (name partial match, email filter) |
| Get full client record | `get_client` |
| Create a new client | `create_client` |
| Update client details | `update_client` (PATCH — only provided fields change) |
| Archive a client | `archive_client` (no active engagements required) |
| Restore an archived client | `restore_client` |
| Add a contact to a client | `add_contact` |
| Update a contact | `update_contact` (PATCH) |

**Always search before creating** — call `list_clients` before `create_client`.

## Proposals (23 tools)

| Task | Tool |
|------|------|
| List proposals | `list_proposals` (filter by state, client, PROP-####) |
| Get top-level proposal info | `get_proposal` (slug or PROP-####) |
| Get full document tree | `get_proposal_document` |
| List proposal templates | `list_proposal_templates` |
| Create from a template | `create_proposal_using_template` |
| Create from scratch | `create_proposal` |
| Validate before saving | `validate_proposal_document` |
| Update proposal settings | `update_proposal` (PATCH) |
| Add an option | `add_proposal_option` |
| Remove an option | `remove_proposal_option` |
| Add a project | `add_proposal_project` |
| Update a project | `update_proposal_project` |
| Remove a project | `remove_proposal_project` |
| Add a service group | `add_proposal_service_group` |
| Remove a service group | `remove_proposal_service_group` |
| Add a service line | `add_proposed_service` |
| Update a service line | `update_proposed_service` |
| Update a billing portion | `update_proposed_service_portion` |
| Remove a service line | `remove_proposed_service` |
| Bulk price increase | `increase_proposal_prices` (one-shot; use `preview: true` first) |
| Send to client | `send_proposal_to_client` (confirm recipient first) |
| Renew an accepted proposal | `renew_proposal` |
| Archive a draft or lost proposal | `archive_proposal` |

**Send is externally visible** — always confirm the client email and proposal content before calling `send_proposal_to_client`.

## Invoices (6 tools)

| Task | Tool |
|------|------|
| List invoices | `list_invoices` (rich filters: state, client, date, overdue, amount) |
| Get invoice detail | `get_invoice` (slug, INV-####, or ledger number) |
| Create an invoice draft | `create_invoice_draft` → user opens `app_path` in Ignition and clicks **Create** |
| Send an issued invoice | `send_invoice_to_client` (confirm recipient first) |
| Void an invoice | `void_invoice` (only before any payment is recorded) |
| Archive a voided invoice | `archive_invoice` |

> `create_invoice_draft` does **not** issue a real invoice — it is a draft only.

## Payments (2 tools)

| Task | Tool |
|------|------|
| Check payment status | `list_payments` (filter by invoice, client, state, date, amount) |
| Get payment detail | `get_payment` |

## Deals (8 tools — requires Deals feature)

| Task | Tool |
|------|------|
| List the pipeline | `list_deals` (filter by state, stage, client) |
| Get deal detail | `get_deal` |
| List pipeline stages | `list_stages` |
| Create a new deal | `create_deal` |
| Move to a stage | `move_deal_to_stage` |
| Close as won | `win_deal` |
| Close as lost | `lose_deal` |
| Add a note | `add_deal_note` |

## Services (4 tools)

| Task | Tool |
|------|------|
| List services | `list_services` |
| Get service detail | `get_service` |
| Create a service | `create_service` (Admin only) |
| Update a service | `update_service` (Admin only) |

## Supporting reference data

| Data needed | Tools |
|-------------|-------|
| Tax rates | `list_tax_rates`, `get_tax_rate` |
| Terms templates | `list_terms_templates`, `get_terms_template`, `list_terms_placeholders`, `create_terms_template`, `update_terms_template` |
| Email templates | `list_email_templates`, `create_email_template`, `update_email_template` |
| Message templates | `list_message_templates`, `create_message_template`, `update_message_template` |
| Forms | `list_forms`, `list_form_templates`, `get_form`, `create_form_using_template`, `send_form_to_client` |
| Billing items | `list_billing_items`, `get_billing_item` |
| Agreed services | `list_agreed_services` |
| Practice info | `get_practice_info` |
| Users | `list_users`, `get_user` |

## Progressive discovery (optional)

Append `?discovery=progressive` to the MCP URL to get a smaller initial tool list. Three extra tools are available in this mode only:

| Tool | Purpose |
|------|---------|
| `list_tool_categories` | List all tool categories |
| `get_category_tools` | List tools in a category |
| `describe_tool` | Fetch full schema for a specific tool |

## Key rules

- **Search before create** — `list_clients` before `create_client`; `list_services` before `create_service`.
- **Confirm before send** — `send_proposal_to_client` and `send_invoice_to_client` trigger real email deliveries.
- **Invoice drafts need manual action** — user must open `app_path` in Ignition and click **Create**.
- **Close deals with the right tool** — use `win_deal` or `lose_deal`, not a generic update.
- **Rate limits** — on HTTP 429, wait for `Retry-After` before retrying; do not loop immediately.
