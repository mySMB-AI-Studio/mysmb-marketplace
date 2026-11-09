# Zoho Desk

Zoho Desk help desk access via the myHub-hosted OAuth MCP gateway. Browser OAuth — no env vars.

Per-user datacenter routing across `desk.zoho.<tld>`. Calls go to the user's Desk portal (the one marked default, else the first); every tool also takes an optional `orgId` to pick another portal (`list_organizations`).

**23 read-only tools** covering tickets, ticket threads/conversations/comments, ticket counts, contacts, accounts, agents, departments, views and search.

## Configuration

No environment variables required on the client side. First use redirects to `accounts.zoho.<tld>/oauth/v2/auth`.

Scopes requested (read-only):

```
Desk.tickets.READ Desk.contacts.READ Desk.basic.READ
Desk.settings.READ Desk.search.READ AaaServer.profile.READ
```

## Tool categories

### Organization (2)
- `list_organizations`, `my_agent_info`

### Tickets (3)
- `list_tickets` (filter by department, view, assignee, status, priority, channel, age), `get_ticket`, `search_tickets`

### Ticket detail (4)
- `list_ticket_threads`, `get_ticket_thread`, `list_ticket_conversations`, `list_ticket_comments`

### Ticket counts (2)
- `tickets_count`, `tickets_count_by_field` (status, priority, channel, spam, escalated, overDue, statusType)

### Contacts & accounts (6)
- `list_contacts`, `get_contact`, `list_contact_tickets`, `list_accounts`, `get_account`, `list_account_tickets`

### Agents, departments, views (4)
- `list_agents`, `get_agent`, `list_departments`, `list_views` (ticket views default to the default department)

### Search (1)
- `search` — across tickets, contacts, accounts, tasks, products, calls and events, or one module

### Passthrough (1)
- `passthrough_get` — escape hatch for any `/api/v1` GET endpoint not covered above.

List tools page with `from` (0-based) and `limit`.

## Destructive operations

None — every tool is read-only.

## See also

- [Zoho Desk REST API](https://desk.zoho.com/DeskAPIDocument)
