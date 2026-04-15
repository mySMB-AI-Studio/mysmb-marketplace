---
name: deskcrm-manage-account
description: Create, update, or delete an account in the deskcrm Accounts sheet. Use when the user says "add a new account", "mark X as a customer", "update Y's ARR", or "remove Z".
---

# Manage an account

Covers the write side of the Accounts sheet: `create_account`, `update_account`, `delete_account`.

## Create

Required: `name`. Everything else is optional and defaults to empty/zero.

Typical fields to set when creating:

- `industry` — free-form string (e.g. `"SaaS"`, `"Home Services"`)
- `stage` — `prospect` (default), `qualified`, `customer`, `churned`
- `owner` — the sales rep's name
- `arr` — annual recurring revenue in USD, as a number
- `renewalDate` — ISO date `YYYY-MM-DD` (customers only)
- `website`, `phone`, `billingCity`, `billingCountry`, `employees`, `notes`

Before creating, call `list_accounts` with `query: "<name>"` to check for a duplicate. If one exists, update the existing row instead.

## Update

1. Resolve the account id by name with `list_accounts` + `query`, disambiguating if needed.
2. Build a minimal `patch`. Only include changing fields.
3. Call `update_account`. Confirm the change back to the user.

### Stage transitions

- `prospect` → `qualified`: when there is a real opportunity in play. Leave `arr` and `renewalDate` empty until they close.
- `qualified` → `customer`: set `arr` and `renewalDate` at the same time.
- `customer` → `churned`: zero out `arr`, clear `renewalDate`, and add a `notes` entry with the reason.

## Delete

Use `delete_account` only when the user explicitly says "delete" or "remove". Churn is **not** a delete — it's an update to `stage: "churned"`. If the user seems to mean churn rather than deletion, ask before calling `delete_account`.

After a successful delete, echo back the removed row's name and id so the user can confirm.
