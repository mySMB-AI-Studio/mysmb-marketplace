# Nookal

Access [Nookal](https://www.nookal.com) — Australian allied-health practice management software (physio, chiro, podiatry, psych, etc.) — through the myHub-hosted MCP gateway (`myhub-mcp-servers/src/integrations/nookal`). Nookal is a direct competitor to Cliniko and Zanda, which already have their own connectors in this repo.

## Authentication

Nookal's API authenticates with a single static API key, sent as the `api_key` query parameter (GET) or form field (POST) on every request — there is no OAuth flow and no per-tenant credential. mySMB holds one API key shared across every tenant with this plugin installed.

## Configuration

No environment variables are required in this plugin — the API key lives server-side in the myHub-hosted MCP gateway (`NOOKAL_API_KEY`), not here.

| Variable | Required | Description |
|---|---|---|
| *(none)* | — | Server-side static key — nothing to configure in this plugin. |

## Tools

### `nookal-verification`

| Tool | Description |
|---|---|
| `verify_api_key` | Confirms the configured API key is valid. The cheapest possible connectivity check — use this first if any other tool fails unexpectedly. |

### `nookal-clinic`

| Tool | Description |
|---|---|
| `list_locations` | List the practice's locations/clinics. |
| `list_practitioners` | List practitioners. |
| `list_appointment_types` | List configured appointment types. |

### `nookal-patients`

| Tool | Description |
|---|---|
| `list_patients` | List patients, optionally filtered by search term or `last_modified` date for incremental sync. |
| `get_patient` | Get a single patient by ID. |
| `create_patient` | Create a new patient record. |
| `update_patient` | Update an existing patient record. |
| `list_patient_cases` | List patient cases, optionally filtered by `patient_id`. |
| `get_patient_case` | Get a single patient case by ID. |
| `list_treatment_notes` | List treatment notes, optionally filtered by `patient_id` or `case_id`. |
| `get_treatment_note` | Get a single treatment note by ID. |

### `nookal-scheduling`

| Tool | Description |
|---|---|
| `list_appointments` | List appointments. |
| `get_appointment` | Get a single appointment by ID. |
| `create_appointment` | Create a new appointment. |
| `update_appointment` | Update an existing appointment. |
| `cancel_appointment` | Cancel an appointment. |
| `list_availabilities` | List open appointment slots. |

### `nookal-billing`

| Tool | Description |
|---|---|
| `list_invoices` | List invoices. |
| `get_invoice` | Get a single invoice by ID. |
| `create_invoice` | Create a new invoice. |
| `list_payments` | List payments. |

## A note on what's verified

No live Nookal account was available while building this integration. Only `verify`, `getLocations`, and `getPatients` are confirmed real Nookal operation names, from a third-party API profile of Nookal's public documentation — not live-tested end-to-end. Everything else above (exact endpoint behavior for cases, treatment notes, appointments, availabilities, invoices, payments; exact field names returned by any tool; the incremental-sync `last_modified` filter) is modeled from Nookal's documented structure and is clearly flagged "unverified" in each tool's own description on the server side (`myhub-mcp-servers/src/integrations/nookal`). Treat field names in any response as provisional until checked against a real account — see `myhub-mcp-servers/docs/NOOKAL.md` for the full verification-status breakdown.

## Destructive operations

`create_patient`, `update_patient`, `create_appointment`, `update_appointment`, `cancel_appointment`, and `create_invoice` all write to the connected Nookal account — and since the API key is a single credential shared across every tenant with this plugin installed, a write from one tenant's automation reaches the same underlying Nookal account as every other tenant's. Confirm with mySMB ops which Nookal account is actually configured (`NOOKAL_API_KEY`) before relying on any write tool in a live workflow.

## See also

- [Generating API Keys in Nookal](https://support.nookal.com/hc/en-us/articles/9191502612239-Generating-API-Keys)
- [Cliniko connectors](../cliniko-scheduling/README.md) — the closest equivalent connector in this repo, for a direct-competitor comparison.
