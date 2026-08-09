# Ignition

Connect Ignition's proposal and client engagement platform to MyHub via Ignition's hosted MCP server. The plugin surfaces 78 tools across 16 groups covering the full Ignition workflow — from building a service catalogue and managing clients through to creating proposals, sending invoices, and collecting payments.

Ignition MCP is included on every Ignition plan — no additional upgrade required.

## Authentication

Ignition uses browser OAuth. No API keys, no manual token copying, and no OAuth app to create.

**Connect in three steps:**

1. Enter `https://mcp.ignitionapp.com/mcp` as the MCP server URL in your AI app.
2. Sign in and approve access in Ignition.
3. Start using the supported tools.

Access is user-level and scoped to the practice you sign in with. If you have access to multiple practices, sign in with the one you want the AI app to use. Revoke access any time from **Profile → Connected apps** in Ignition.

No environment variables or API keys are required.

## Rate limits

Ignition MCP enforces rate limits across several buckets simultaneously — the first bucket to fill stops the request:

| Bucket | Limit |
|--------|-------|
| MCP service (all users) | 100,000 requests / hour |
| Connected practice | 2,000 requests / hour |
| OAuth client | 1,000 requests / hour |
| Connected user | 600 requests / hour |
| Connected user | 60 requests / minute |

When rate limited, Ignition returns HTTP 429 with error code `RATE_LIMITED`. The response includes a `Retry-After` header (seconds) and a `data.retryAfter` Unix timestamp. Wait until that time before retrying — do not use tight retry loops.

## Progressive tool discovery

By default, `tools/list` returns the full 78-tool catalogue. To reduce token usage on the initial call, append `?discovery=progressive` to the URL:

```
https://mcp.ignitionapp.com/mcp?discovery=progressive
```

In progressive mode, `tools/list` returns only three bootstrap helpers plus `get_practice_info`. All other tools remain callable once you fetch their schema with `describe_tool`.

**Recommended workflow in progressive mode:**
1. `get_practice_info` — confirm which practice you're connected to.
2. `list_tool_categories` — see available categories.
3. `get_category_tools` — list tools in a category.
4. `describe_tool` — fetch the full schema before invoking.
5. Call the tool via `tools/call`.

## Tool groups

The MCP server exposes 78 tools (35 read, 43 write) organised into 16 groups.

### Agreed Services (1 tool)

| Tool | Mode |
|------|------|
| `list_agreed_services` | Read |

### Billing Items (2 tools)

| Tool | Mode |
|------|------|
| `get_billing_item` | Read |
| `list_billing_items` | Read |

### Clients & Contacts (8 tools)

| Tool | Mode |
|------|------|
| `list_clients` | Read |
| `get_client` | Read |
| `create_client` | Write |
| `update_client` | Write |
| `archive_client` | Write |
| `restore_client` | Write |
| `add_contact` | Write |
| `update_contact` | Write |

### Deals (8 tools) — requires Deals feature

| Tool | Mode |
|------|------|
| `list_deals` | Read |
| `get_deal` | Read |
| `list_stages` | Read |
| `create_deal` | Write |
| `move_deal_to_stage` | Write |
| `win_deal` | Write |
| `lose_deal` | Write |
| `add_deal_note` | Write |

### Discovery (3 tools — progressive mode only)

| Tool | Mode |
|------|------|
| `list_tool_categories` | Read |
| `get_category_tools` | Read |
| `describe_tool` | Read |

### Email Templates (3 tools)

| Tool | Mode |
|------|------|
| `list_email_templates` | Read |
| `create_email_template` | Write |
| `update_email_template` | Write |

### Forms (5 tools) — requires Forms feature

| Tool | Mode |
|------|------|
| `list_forms` | Read |
| `list_form_templates` | Read |
| `get_form` | Read |
| `create_form_using_template` | Write |
| `send_form_to_client` | Write |

### Invoices (6 tools)

| Tool | Mode |
|------|------|
| `list_invoices` | Read |
| `get_invoice` | Read |
| `create_invoice_draft` | Write |
| `send_invoice_to_client` | Write |
| `void_invoice` | Write |
| `archive_invoice` | Write |

> `create_invoice_draft` creates a draft for review in the Ignition invoice editor — it does not issue or send a real invoice. The user must open the returned `app_path` in Ignition and click **Create** to finalise it.

### Message Templates (3 tools)

| Tool | Mode |
|------|------|
| `list_message_templates` | Read |
| `create_message_template` | Write |
| `update_message_template` | Write |

### Payments (2 tools)

| Tool | Mode |
|------|------|
| `list_payments` | Read |
| `get_payment` | Read |

### Practice (1 tool)

| Tool | Mode |
|------|------|
| `get_practice_info` | Read |

### Proposals (23 tools)

| Tool | Mode |
|------|------|
| `list_proposals` | Read |
| `get_proposal` | Read |
| `get_proposal_document` | Read |
| `list_proposal_templates` | Read |
| `validate_proposal_document` | Read |
| `create_proposal` | Write |
| `create_proposal_using_template` | Write |
| `update_proposal` | Write |
| `add_proposal_option` | Write |
| `remove_proposal_option` | Write |
| `add_proposal_project` | Write |
| `update_proposal_project` | Write |
| `remove_proposal_project` | Write |
| `add_proposal_service_group` | Write |
| `remove_proposal_service_group` | Write |
| `add_proposed_service` | Write |
| `update_proposed_service` | Write |
| `update_proposed_service_portion` | Write |
| `remove_proposed_service` | Write |
| `increase_proposal_prices` | Write |
| `send_proposal_to_client` | Write |
| `renew_proposal` | Write |
| `archive_proposal` | Write |

### Services (4 tools)

| Tool | Mode |
|------|------|
| `list_services` | Read |
| `get_service` | Read |
| `create_service` | Write |
| `update_service` | Write |

### Tax Rates (2 tools)

| Tool | Mode |
|------|------|
| `list_tax_rates` | Read |
| `get_tax_rate` | Read |

### Terms Templates (5 tools)

| Tool | Mode |
|------|------|
| `list_terms_templates` | Read |
| `get_terms_template` | Read |
| `list_terms_placeholders` | Read |
| `create_terms_template` | Write |
| `update_terms_template` | Write |

### Users (2 tools)

| Tool | Mode |
|------|------|
| `list_users` | Read |
| `get_user` | Read |

## Common workflows

### Create a proposal

1. `list_clients` — search by name or email to confirm the client exists.
2. `create_client` — create the client if they do not exist.
3. `list_services` — find the right service line items.
4. `list_terms_templates` + `list_tax_rates` — pick the applicable terms and tax rate.
5. `create_proposal_using_template` or `create_proposal` — build the draft.
6. `get_proposal_document` — review the full document tree before sending.
7. `send_proposal_to_client` — send the proposal (confirm recipient first).

### Manage clients

- `list_clients` — filter by name, email, state, tag, partner, or manager.
- `get_client` — full detail including contacts, services summary, and invoices summary.
- `create_client` — new client with contacts, optional addresses, and tags.
- `update_client` — partial update; only provided fields change.
- `archive_client` — archive a client with no active engagements.
- `restore_client` — unarchive a previously archived client.

### Invoice and payment workflow

1. `create_invoice_draft` — create a draft; open `app_path` in Ignition and click **Create** to issue it.
2. `send_invoice_to_client` — send the issued invoice by email.
3. `list_payments` — check payment status filtered by invoice or client.
4. `void_invoice` — void an issued invoice (only before any payment is recorded).
5. `archive_invoice` — hide a voided invoice from standard lists.

### Deal pipeline management

- `list_stages` — list available pipeline stages.
- `create_deal` — new deal linked to a client.
- `list_deals` — filter by state, stage, or client.
- `move_deal_to_stage` — move a deal to any stage.
- `win_deal` / `lose_deal` — close the deal as won or lost.
- `add_deal_note` — add activity notes to a deal.

### Renew a proposal

Use `renew_proposal` on an accepted or completed proposal to create a new draft that copies all services at their current agreed prices, sets the start date to the day after the source contract ends, and preserves signatories.

## Troubleshooting

**I connected successfully but do not see every tool listed here.**
Available tools are filtered by your Ignition role and any feature access required for that capability. Tools marked *Admin only* (e.g. `create_service`) will not appear for Member-role users. Tools marked *Requires Deals / Forms / etc.* will not appear if that feature is not enabled on your plan.

**I revoked access and want to reconnect.**
Start the connection again from your AI app and approve access again — the same three-step flow as the initial connection.

## See also

- [Ignition MCP documentation](https://developers.ignitionapp.com/docs/mcp)
- [Ignition Developer Terms](https://developers.ignitionapp.com/docs/terms)
