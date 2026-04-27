# Zoho Sign

Zoho Sign v1 e-signature workflows via the myHub-hosted OAuth MCP gateway. Browser OAuth — no env vars.

Per-user datacenter routing across `sign.zoho.<tld>/api/v1`.

**~35 tools** covering signature requests, templates, folders, account/users, mass actions, and a passthrough escape hatch.

## Configuration

Scopes requested:

```
ZohoSign.documents.ALL ZohoSign.account.ALL ZohoSign.setup.ALL
AaaServer.profile.READ
```

## Tool categories

### Requests (16)
- `list_requests`, `get_request`, `create_draft`, `submit_request`, `recall_request`, `delete_request`, `remind_request`, `extend_request`, `download_document`, `download_certificate`, `update_request`, `clone_request`, `get_embed_token`, `download_field_data`, `request_audit_trail`, `search_requests`

### Templates (5)
- `list_templates`, `get_template`, `delete_template`, `send_from_template`, `create_template`

### Folders (5)
- `list_folders`, `create_folder`, `get_folder`, `delete_folder`, `move_to_folder`

### Sign-by-link / embed (1)
- `get_signing_link`

### Account / users (4)
- `get_account`, `list_users`, `get_user`, `invite_users`

### Mass actions (3)
- `mass_recall`, `mass_remind`, `mass_delete`

### Reports (1)
- `account_reports`

### Passthrough (2)
- `passthrough_get`, `passthrough_post`

## Two flows

1. **Ad-hoc**: `create_draft` (uploads files + recipients) → review → `submit_request` (sends).
2. **Template**: `list_templates` → `send_from_template` (recipient/field overrides).

## Destructive operations

- `delete_request`, `delete_template`, `delete_folder` — irreversible (Recycle Bin where applicable)
- `mass_delete` — bulk
- `recall_request`, `mass_recall` — pulls signers off an in-flight request; not recoverable
- `submit_request` — sends real emails to recipients
- `invite_users` — sends invitation emails

## See also

- [Zoho Sign API v1](https://www.zoho.com/sign/api/)
