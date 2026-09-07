# Enterprise AI (EAI) plugin

Read and write tenant resources on the Enterprise AI platform from Workspace.

**Connection:** sign in once with your EAI account (browser OAuth via Entra
CIAM) in the Connections UI. Calls run as you, against the tenants you can
access. Use `list_tenants` and `eai_tenant_id` if your account has several.

**Tools (server `eai`):** `list_tenants`, `list_object_types`,
`describe_object_type`, `list_resources`, `get_resource`, `query_resources`,
`create_resource`, `update_resource`, `delete_resource`, `execute_resource_action`.

Object Types are tenant-defined — automations should call `describe_object_type`
before writing so property names and select values are correct.

Server source: `myhub-mcp-servers/src/integrations/eai/`.
