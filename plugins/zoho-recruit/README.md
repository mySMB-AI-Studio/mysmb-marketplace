# Zoho Recruit

Zoho Recruit v2 (ATS) via the myHub-hosted OAuth MCP gateway. Browser OAuth — no env vars.

Per-user datacenter routing across `zohoapis.<tld>/recruit/v2`.

**~45 tools** covering candidates, job openings, clients, contacts, departments, interviews, with specialty tools for candidate↔job association, status changes, and resume upload/parse.

## Configuration

Scopes requested:

```
ZohoRecruit.modules.ALL ZohoRecruit.settings.ALL ZohoRecruit.users.ALL
ZohoRecruit.coql.READ AaaServer.profile.READ
```

## Tool categories

### Records CRUD (13)
- `list_records`, `get_record`, `create_records`, `update_records`, `update_record`, `upsert_records`, `delete_record`, `delete_records`, `search_records`, `record_count`, `deleted_records`, `coql_query`, `mass_update_records`

Modules: Candidates, JobOpenings, Clients, Contacts, Departments, Interviews, plus custom modules.

### Candidate-specific (9)
- `associate_candidate_to_job`, `change_candidate_status`, `candidate_history`, `candidate_associated_jobs`, `job_associated_candidates`, `submit_candidate_to_client`, `download_resume`, `upload_resume`, `parse_resume`

### Notes (5)
- `list_notes`, `get_note`, `add_note`, `update_note`, `delete_note`

### Attachments (3)
- `list_attachments`, `upload_attachment`, `delete_attachment`

### Tags (3)
- `list_tags`, `add_tags_to_record`, `remove_tags_from_record`

### Metadata / settings (10)
- `list_modules`, `get_module`, `list_fields`, `list_layouts`, `list_custom_views`, `get_custom_view`, `list_profiles`, `list_roles`, `list_email_templates`

### Users / org (3)
- `list_users`, `get_user`, `get_org`

### Interviews (1)
- `schedule_interview` — bulk-schedule one or more interviews

### Passthrough (2)
- `passthrough_get`, `passthrough_post`

## Destructive operations

- `delete_record`, `delete_records`, `delete_note`, `delete_attachment` — soft-delete to Recycle Bin
- `mass_update_records` — bulk async, applies one patch across many records
- `change_candidate_status` — transitions are audit-logged but cannot be silently reverted
- `submit_candidate_to_client` — sends an email to the client contact

## See also

- [Zoho Recruit v2 API](https://www.zoho.com/recruit/developer-guide/apiv2/)
