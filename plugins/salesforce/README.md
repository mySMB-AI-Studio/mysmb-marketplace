# Salesforce

Access Salesforce CRM via Salesforce's official hosted MCP servers. Full CRUD on any SObject — contacts, accounts, leads, opportunities, cases, and any custom object — plus SOQL queries, SOSL text search, schema introspection, recent items, and relationship traversal.

Authentication is **per-user OAuth 2.0 with PKCE** backed by a Salesforce External Client App. Every tool call runs within the signed-in user's permissions — field-level security, object-level access, and sharing rules all apply exactly as they do in the Salesforce UI.

## How the MCP server works

This plugin connects to Salesforce's official **SObject All** hosted MCP server at `https://api.salesforce.com/platform/mcp/v1/platform/sobject-all`. Salesforce hosts and operates this endpoint — myHub does not proxy it.

The workspace runtime automatically injects the OAuth Bearer token into every request to the server. This is handled by the `oauth_client` connection type declared in `plugin.json` — no `Authorization` header needs to be configured in `.mcp.json`. After the user completes the browser OAuth flow, the runtime manages token storage, refresh, and injection transparently.

If your org only needs read access (no create/update/delete), Salesforce also offers a **SObject Reads** server (`/sobject-reads`) and a **SObject Mutations** server (`/sobject-mutations`). The `.mcp.json` in this plugin points at **sobject-all**, which exposes the full tool set.

## Widgets

| Widget | Tool | What it shows |
|--------|------|---------------|
| **Open Opportunities** | `soql_query` | Open opportunities sorted by close date — name, account, stage, amount, and close date. |
| **Recent Accounts** | `getRecentItems` | Accounts the signed-in user recently viewed or modified. |

The **Recent Accounts** widget expects `getRecentItems` to return `{ "recentItems": [...] }`, matching the Salesforce REST API documented response shape for that tool. If the widget shows an empty state when accounts exist, confirm the top-level response key matches — update the state paths in `salesforce-recent-accounts.json` from `/salesforce/getRecentItems/recentItems` to the correct key if they differ.

## Configuration

**No environment variables are stored in `.mcp.json`** for this plugin. Authentication uses browser OAuth; credentials are captured through the Connect dialog and stored encrypted in the per-user vault. The Connect dialog collects three fields:

| Field | `name` | Where to get it |
|-------|--------|-----------------|
| Consumer Key (Client ID) | `SALESFORCE_CLIENT_ID` | Salesforce Setup → External Client Apps → your app → OAuth Settings → Consumer Key |
| Consumer Secret | `SALESFORCE_CLIENT_SECRET` | Same page → Consumer Secret (generate if not shown) |
| Instance URL | `SALESFORCE_INSTANCE_URL` | Salesforce Setup → My Domain — your org's `https://yourorg.my.salesforce.com` URL |

`SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET`, and `SALESFORCE_INSTANCE_URL` are stored encrypted in the **per-user** credentials vault. They are never committed to this repo and never shared between users.

### One-time Salesforce admin setup

Salesforce's hosted MCP servers require an administrator to complete two one-time steps before any user can connect:

#### 1. Enable Hosted MCP Servers in your org

1. In Salesforce Setup, search for **Hosted MCP Servers**.
2. Enable the servers your users need. The **SObject (All Operations)** server covers everything this plugin uses.
3. Disabling unused servers (Mutations-only, Deletes-only, Data 360, Tableau Next) follows the principle of least privilege.

#### 2. Create an External Client App

> **Important:** Salesforce requires an **External Client App** for MCP authentication. Standard Connected Apps do **not** work with the hosted MCP servers.

1. In Setup, search for **External Client Apps** and click **New External Client App**.
2. Give it a name (e.g. "myHub MCP Client") and set **Distribution State** to *Local*.
3. Under **OAuth Settings**:
   - Enable OAuth.
   - Set **Callback URL** to the value shown in the myHub Connect dialog (ends in `/api/user/connections/oauth/callback`). A mismatch causes `redirect_uri_mismatch`.
   - Add the following **OAuth Scopes**: `Access and manage your data (api)`, `Perform requests at any time (refresh_token, offline_access)`.
   - Enable **Require Proof Key for Code Exchange (PKCE)**.
   - Enable **Enable Authorization Code and Credentials Flow**.
4. Save, then copy the **Consumer Key** (Client ID) and generate a **Consumer Secret**.
5. Distribute the Consumer Key and Consumer Secret to your users (or enter them yourself as the admin).

#### OAuth scopes explained

| Scope | Why it's needed |
|-------|-----------------|
| `api` | Allows tools to read and write Salesforce records on behalf of the user |
| `refresh_token` / `offline_access` | Allows myHub to silently refresh the access token so users don't need to re-authenticate on every session |

## Tools

The **SObject All** server exposes eleven tools:

| Tool | Description |
|------|-------------|
| `getObjectSchema` | Returns schema information for a Salesforce object type, or an index of all queryable objects if called without arguments |
| `soql_query` | Executes a SOQL SELECT query — supports `WHERE`, `ORDER BY`, `LIMIT`, subqueries, and relationship traversal |
| `find` | Executes a SOSL text search across multiple objects simultaneously (useful when the target object is unknown) |
| `getIdentity` | Returns the signed-in user's identity, role, profile, and timezone |
| `getRecentItems` | Returns records of a given object type that the user recently viewed or modified |
| `getRelatedRecords` | Retrieves child records via a named relationship path on a parent record |
| `createSobjectRecord` | Creates a new Salesforce record, with field-level validation |
| `updateSobjectRecord` | Updates an existing record by ID |
| `updateRelatedRecord` | Updates a child record via a parent–child relationship (no child ID required) |
| `deleteSobjectRecord` | Permanently deletes a record (15-day Recycle Bin window) |
| `deleteRelatedRecord` | Deletes a child record via a parent–child relationship |

## Sample workflows

### Find and update a contact

```jsonc
// 1. Search for a contact by name
{ "tool": "find", "args": { "search": "FIND {Jane Smith} IN NAME FIELDS RETURNING Contact(Id, Name, Email, AccountId)" } }

// 2. Update the contact's phone number
{ "tool": "updateSobjectRecord", "args": { "sobject-name": "Contact", "id": "<contactId>", "body": { "Phone": "+61 400 123 456" } } }
```

### Query open opportunities closing this quarter

```jsonc
{ "tool": "soql_query", "args": {
  "query": "SELECT Id, Name, Account.Name, StageName, Amount, CloseDate FROM Opportunity WHERE IsClosed = false AND CloseDate = THIS_QUARTER ORDER BY CloseDate ASC LIMIT 50"
} }
```

### Create a lead

```jsonc
{ "tool": "createSobjectRecord", "args": {
  "sobject-name": "Lead",
  "body": {
    "FirstName": "Alex",
    "LastName": "Rivera",
    "Company": "Acme Corp",
    "Email": "alex.rivera@acmecorp.example",
    "LeadSource": "Web"
  }
} }
```

### Log a case for an account

```jsonc
{ "tool": "createSobjectRecord", "args": {
  "sobject-name": "Case",
  "body": {
    "Subject": "Cannot access portal after password reset",
    "Status": "New",
    "Priority": "High",
    "Origin": "Email",
    "AccountId": "<accountId>"
  }
} }
```

## Destructive operations

Confirm before calling — these cannot be undone without admin intervention:

- `deleteSobjectRecord` / `deleteRelatedRecord` — moves the record to the Recycle Bin for 15 days, then permanently removes it
- `updateSobjectRecord` — field changes are tracked in audit history but are not automatically reversible

## Sandbox and scratch orgs

Salesforce also hosts MCP servers for non-production orgs at a different endpoint path (`/sandbox/platform/sobject-all`). Sandbox support requires a **separate plugin entry** targeting that endpoint — do not modify `.mcp.json` directly, as that file is managed by the runtime and any manual edits will be overwritten. Contact your platform team to configure a sandbox-specific plugin.

## See also

- [Salesforce Hosted MCP Servers overview](https://developer.salesforce.com/docs/platform/hosted-mcp-servers/guide/hosted-mcp-servers-overview.html)
- [Client connection overview](https://developer.salesforce.com/docs/platform/hosted-mcp-servers/guide/client-connection-overview.html)
- [Servers reference](https://developer.salesforce.com/docs/platform/hosted-mcp-servers/references/reference/servers-reference.html)
- [SObject All server reference](https://developer.salesforce.com/docs/platform/hosted-mcp-servers/references/reference/sobject-all.html)
- [SOQL reference](https://developer.salesforce.com/docs/atlas.en-us.soql_sosl.meta/soql_sosl/sforce_api_calls_soql.htm)
- [Salesforce REST API — SObject resources](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_sobject_basic_info.htm)
