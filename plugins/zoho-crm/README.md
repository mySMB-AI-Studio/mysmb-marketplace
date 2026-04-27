# Zoho CRM

Full-coverage access to Zoho CRM v8 via the myHub-hosted OAuth MCP gateway. Browser OAuth — no env vars, no keys.

Per-user datacenter routing: tokens are persisted alongside the user's `zohoapis.<tld>` host (US, EU, IN, AU, JP, CA, CN, SA), so cross-DC calls just work.

**~50 tools** spanning records CRUD, COQL, search, notes, attachments, tags, related lists, mass actions, lead conversion, settings, users, and email send.

## Configuration

No environment variables required on the client side. On first use, the browser redirects to `accounts.zoho.<tld>/oauth/v2/auth` — sign in, grant the requested scopes, and the gateway routes all subsequent calls to your datacenter.

Scopes requested:

```
ZohoCRM.modules.ALL ZohoCRM.users.READ ZohoCRM.org.READ
ZohoCRM.settings.ALL ZohoCRM.coql.READ ZohoCRM.notifications.ALL
AaaServer.profile.READ
```

## Tool categories

### Records (12)
- `list_records`, `get_record`, `create_records`, `update_records`, `update_record`, `upsert_records`, `delete_record`, `delete_records`, `search_records`, `record_count`, `deleted_records`, `coql_query`

Module is a free-string parameter — works with built-in modules (Leads, Contacts, Accounts, Deals, Tasks, Events, Calls, Cases, Solutions, Products, Quotes, Sales_Orders, Purchase_Orders, Invoices, Vendors, Price_Books, Campaigns) and any custom module.

### Related lists (3)
- `list_related_records`, `update_related_record`, `delink_related_record`

### Mass operations (3)
- `mass_update_records`, `mass_delete_records`, `convert_leads`

### Notes (5)
- `list_notes`, `get_note`, `add_note`, `update_note`, `delete_note`

### Attachments (4)
- `list_attachments`, `upload_attachment` (base64), `link_attachment` (URL passthrough), `delete_attachment`

### Tags (4)
- `list_tags`, `add_tags_to_record`, `remove_tags_from_record`, `records_count_by_tag`

### Settings / metadata (12)
- `list_modules`, `get_module`, `list_fields`, `list_layouts`, `list_custom_views`, `get_custom_view`, `list_pipelines`, `list_profiles`, `list_roles`, `list_territories`, `list_email_templates`, `list_currencies`

### Users / org (3)
- `list_users`, `get_user`, `get_org`

### Mail (1)
- `send_mail` — log an email on a record's timeline (template optional)

## Destructive operations

These are irreversible or send-on-behalf-of you — confirm before calling:

- `delete_record`, `delete_records`, `delete_note`, `delete_attachment` — soft-delete to Recycle Bin
- `mass_delete_records`, `mass_update_records` — bulk async; runs across many records
- `convert_leads` — once converted, leads can't be reverted
- `send_mail` — sends real email from your Zoho address

## See also

- [Zoho CRM v8 API docs](https://www.zoho.com/crm/developer/docs/api/v8/)
- [Zoho COQL reference](https://www.zoho.com/crm/developer/docs/api/v8/COQL-Overview.html)
