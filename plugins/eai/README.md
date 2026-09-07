# Enterprise AI (EAI) plugin

Read and write tenant resources on the Enterprise AI platform from Workspace.

**Connection:** app identity (client id + secret) plus the EAI tenant id. No user
sign-in. Credentials are validated at Connect: the server exchanges them for an
app token and checks it can read the tenant's schema.

**Tools (server `eai`):** `list_object_types`, `describe_object_type`,
`list_resources`, `get_resource`, `query_resources`, `create_resource`,
`update_resource`, `delete_resource`, `execute_resource_action`.

Object Types are tenant-defined — automations should call `describe_object_type`
before writing so property names and select values are correct.

Server source: `myhub-mcp-servers/src/integrations/eai/`.
