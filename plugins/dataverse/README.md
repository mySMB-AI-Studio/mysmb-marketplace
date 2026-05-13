# Microsoft Dataverse

Access Microsoft Dataverse (Dynamics 365 Sales / Power Platform) via the myHub-hosted OAuth MCP gateway. Browser OAuth — no API keys, no tenant URL to configure.

Multi-environment per user: at sign-in time, the gateway calls the Microsoft Global Discovery Service to enumerate every Dataverse environment the user can access, persists the list with their tokens, and mints per-org Web API access tokens on demand by swapping scopes on the refresh token. Every tool accepts an optional `org_url` argument; if the user has exactly one environment, it's auto-selected.

**38 tools** across the four primary Sales tables — accounts, contacts, leads, opportunities — plus activities, notes, FetchXML, metadata introspection, and an escape-hatch raw-request tool.

## Configuration

No environment variables required on the client side. On first use, the browser redirects to `login.microsoftonline.com` — sign in to the account that has access to your Dataverse environment(s) and grant the requested permissions.

Scopes requested:

```
https://globaldisco.crm.dynamics.com/user_impersonation
offline_access
openid
```

The single `user_impersonation` delegated permission covers both the Global Discovery Service and every per-org Web API the user can reach.

> **Tenant-admin step**: the Entra app registration backing the gateway needs *Dynamics CRM / user_impersonation* (delegated). Additionally, each Dataverse environment must have an *Application User* created for the app registration with at least the Sales security role — otherwise the first Web API call returns 403 even though sign-in succeeds. See the [server-side docs](https://github.com/mySMB-AI-Studio/myhub-mcp-servers/blob/master/docs/DATAVERSE.md) for full setup.

## Tool categories

### Organizations & identity (2)

- `list_organizations` — enumerate the user's accessible Dataverse environments (no network call; captured at OAuth time)
- `whoami` — WhoAmI Web API function → UserId, BusinessUnitId, OrganizationId

### CRUD per entity — accounts, contacts, leads, opportunities (20 tools)

- `list_<plural>` — OData `$select` / `$filter` / `$orderby` / `$top` / `$expand` with server-side paging
- `get_<singular>` — by GUID, with `$select` / `$expand`
- `create_<singular>` — typed common fields + `lookups` for `@odata.bind` + `extra_fields` passthrough for custom columns
- `update_<singular>` — PATCH with `If-Match: *` (no accidental upsert)
- `delete_<singular>` — idempotent (404 tolerated)

### Sales actions (5)

- `qualify_lead` — `Microsoft.Dynamics.CRM.QualifyLead`. Optionally creates account/contact/opportunity in one call. Pass `opportunity_customer` to attach the new opportunity to an existing customer.
- `win_opportunity` — `WinOpportunity` action. Records an `OpportunityClose` activity. Default `Status=3` (Won).
- `lose_opportunity` — `LoseOpportunity` action. Default `Status=4` (Canceled).
- `merge_records` — `Merge` action. Applies to account, contact, lead, incident. Optional `update_content` field-set applied to the target in the same operation.
- `assign_record` — change owner. Current best practice (legacy `Assign` action is deprecated): PATCH `ownerid@odata.bind` to either a systemuser or a team.

### Activities & notes (6)

- `add_note` — annotation row. Supports plain text and base64 file attachment.
- `add_task`, `add_phone_call` — activity creation with `regardingobjectid_<entity>_<activity>@odata.bind` for the parent record.
- `add_email`, `add_appointment` — recipients/attendees via `email_activity_parties` / `appointment_activity_parties` (NOT the legacy `torecipients` column — that field doesn't drive dispatch).
- `send_email` — `SendEmail` bound action to dispatch a previously-created email.

### Relationships, metadata, escape hatch (5)

- `associate_records`, `disassociate_records` — N:N / collection-valued navigation properties via `$ref`.
- `execute_fetchxml` — run a FetchXML document. Useful for joins / aggregations not expressible in `$filter`.
- `describe_entity` — `EntityDefinitions(LogicalName='...')`, optionally with the full attribute list.
- `describe_picklist` — discover option-set integer → label mappings for `statecode`, `statuscode`, `leadqualitycode`, custom option sets, etc.
- `raw_request` — arbitrary `GET` / `POST` / `PATCH` / `DELETE` against `/api/data/v9.2/...` for cases no purpose-built tool covers.

## Lookups

Single-valued navigation properties bind via the `lookups` object on `create_*` / `update_*` tools. Keys are the nav property name (NOT the underlying `_value` column). Values can be a full path, a short `<entityset>(<guid>)`, or a bare GUID (entity set inferred from suffix). Pass `null` to disassociate.

```jsonc
"lookups": {
  "customerid_account":     "<accountid-guid>",
  "primarycontactid":       "<contactid-guid>",
  "ownerid":                "systemusers(<userid-guid>)"   // polymorphic — must be explicit
}
```

## Sample flow — qualify a lead and win the resulting opportunity

```jsonc
// 1. Create a lead
{ "tool": "create_lead",
  "args": { "fields": {
    "subject": "Wants to discuss Q4 expansion",
    "firstname": "Sean", "lastname": "Baker",
    "companyname": "mySMB",
    "emailaddress1": "sean.baker@mysmb.com",
    "leadqualitycode": 1
  } } }

// 2. Qualify (creates account+contact+opportunity)
{ "tool": "qualify_lead",
  "args": { "lead_id": "<leadid>",
    "create_account": true, "create_contact": true, "create_opportunity": true,
    "status": 3 } }

// 3. Win the opportunity
{ "tool": "win_opportunity",
  "args": { "opportunity_id": "<oppid>", "actual_revenue": 145000 } }
```

## Destructive operations

These are irreversible or affect shared records — confirm before calling:

- `delete_<entity>` — hard delete
- `merge_records` — deactivates the subordinate record; child records reparent to the target
- `lose_opportunity` / `win_opportunity` — flips state to Lost/Won; reversing requires reopen
- `assign_record` — changes record ownership
- `disassociate_records` — removes relationship

## See also

- [Server-side docs (auth, env vars, app reg)](https://github.com/mySMB-AI-Studio/myhub-mcp-servers/blob/master/docs/DATAVERSE.md)
- [Dataverse Web API reference](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/overview)
- [Sales schema](https://learn.microsoft.com/en-us/dynamics365/sales-enterprise/developer/overview)
