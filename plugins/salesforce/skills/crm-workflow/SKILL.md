---
name: salesforce-crm-workflow
description: >
  Guides the MyHub agent through common Salesforce CRM workflows — lead qualification,
  opportunity management, case handling, account research, and contact look-up. Use this
  skill whenever a user asks about their Salesforce data, wants to create or update CRM
  records, or needs a pipeline/funnel summary.
---

# Salesforce CRM workflows

## General principles

- Always call `getIdentity` first when starting a new session so you know which user you are acting as and what timezone they are in. This prevents acting on behalf of the wrong user.
- Before creating or updating a record, call `getObjectSchema` for that SObject type so you know which fields are required and what picklist values are valid.
- Use `soql_query` with explicit `SELECT` field lists — never `SELECT *`. Only request fields the user actually needs.
- When searching by name or keyword across objects, prefer `find` (SOSL) over multiple `soql_query` calls; it is one round-trip and searches across related objects simultaneously.
- Confirm destructive operations (`deleteSobjectRecord`, any status change to Closed Won/Lost) with the user before executing.

## Lead management

1. Use `soql_query` with `SELECT Id, FirstName, LastName, Company, Status, LeadSource, Email FROM Lead WHERE IsConverted = false` to list open leads.
2. To qualify and convert a lead, create the linked Account, Contact, and Opportunity individually using `createSobjectRecord`, then update the Lead `Status` to `Qualified`. (The hosted MCP server does not expose the `convertLead` action directly — use the individual create + status-update pattern.)
3. Set `LeadSource` accurately so attribution reporting remains meaningful.

## Opportunity pipeline

1. Query open opportunities: `SELECT Id, Name, Account.Name, StageName, Amount, CloseDate, Probability, OwnerId FROM Opportunity WHERE IsClosed = false ORDER BY CloseDate ASC`.
2. When summarising the pipeline, group by `StageName` and compute total `Amount` and weighted value (`Amount * Probability / 100`) per stage.
3. Flag opportunities with `CloseDate < TODAY()` and `IsClosed = false` as overdue — mention them proactively.
4. To advance a stage, call `updateSobjectRecord` with the new `StageName` value. Confirm the stage names first with `getObjectSchema` for `Opportunity`.

## Case management

1. Query open cases: `SELECT Id, CaseNumber, Subject, Status, Priority, AccountId, Account.Name, CreatedDate FROM Case WHERE IsClosed = false ORDER BY Priority ASC, CreatedDate ASC`.
2. When creating a case, always set `Subject`, `Status` (default `New`), `Priority`, `Origin`, and `AccountId` at minimum.
3. To close a case, update `Status` to the appropriate closed value for the org (check `getObjectSchema` for picklist options — common values are `Closed` or `Resolved`).

## Account and contact research

1. To look up an account by name: `FIND {<name>} IN NAME FIELDS RETURNING Account(Id, Name, Industry, Phone, BillingCity, OwnerId)`.
2. To find all contacts for an account: `SELECT Id, FirstName, LastName, Title, Email, Phone FROM Contact WHERE AccountId = '<accountId>' ORDER BY LastName ASC`.
3. To see recent activity: call `getRecentItems` with `sobject-name: Account` or `sobject-name: Contact`.

## Creating records — required field patterns

### Contact
```json
{
  "LastName": "required",
  "AccountId": "strongly recommended",
  "Email": "recommended",
  "Phone": "optional",
  "Title": "optional"
}
```

### Account
```json
{
  "Name": "required",
  "Industry": "recommended",
  "Phone": "optional",
  "BillingCity": "optional"
}
```

### Opportunity
```json
{
  "Name": "required",
  "StageName": "required — check picklist",
  "CloseDate": "required — ISO 8601 date, e.g. 2026-09-30",
  "AccountId": "strongly recommended",
  "Amount": "recommended"
}
```

### Case
```json
{
  "Subject": "required",
  "Status": "required — default New",
  "Priority": "required — Low / Medium / High",
  "Origin": "required — Email / Phone / Web",
  "AccountId": "recommended"
}
```

## Error patterns

- `INVALID_FIELD` — the field name is wrong or not accessible to this user. Call `getObjectSchema` to verify field names.
- `REQUIRED_FIELD_MISSING` — a required field was not supplied. Check the error detail for the field name.
- `INSUFFICIENT_ACCESS` — the user does not have the required object or field permission. Report this to the user and ask them to contact their Salesforce admin.
- `ENTITY_IS_DELETED` — the record was deleted. Use `find` or `soql_query` to locate the current record.

## Relationship traversal

- Use `getRelatedRecords` to fetch child records without writing a SOQL subquery: provide `sobject-name` (parent), `id` (parent record ID), and `relationship-path` (child relationship name, e.g. `Contacts`, `Opportunities`, `Cases`).
- Relationship names are listed in `getObjectSchema` under the `childRelationships` array.
