# ABR Lookup

Look up Australian businesses on the **Australian Business Register** (ABN Lookup): whether an ABN is active or cancelled, when it was registered for GST, whether it's endorsed as a deductible gift recipient (DGR), its ACNC charity registration, its business and trading names, and its main business location (state and postcode).

Useful for bookkeeping checks such as a supplier with a cancelled ABN, GST charged by a business that isn't registered, or a donation to a body that isn't a DGR. It reads public register data only and changes nothing.

## Tools

| Tool | What it does |
|---|---|
| `abr_validate_abn` | Checks an ABN is well formed and passes the ATO checksum. Local only: it doesn't prove the ABN is registered. |
| `abr_get_abn_details` | The full public record for one ABN, optionally with its history (past statuses, GST periods, names). |
| `abr_get_acn_details` | The same record for a company, looked up by its 9-digit ACN. |
| `abr_lookup_abns` | Up to 100 ABNs in one call, one compact row each (status, GST, DGR, ACNC, name, state). |
| `abr_search_by_name` | Finds candidate ABNs from an entity, business or trading name, ranked by match score. |

## Configuration

No environment variables and no sign-in (`authType: none`). Lookups go through mySMB's own ABN Lookup registration, held as a secret on the MCP server; users never enter or see it.

## Notes

- The server is in `myhub-mcp-servers` (`src/integrations/abr`, mounted at `/abr/mcp`) and is deployed to **staging** (QA) only. It isn't on production yet, so this extension isn't ready to promote past QA.
- The server doesn't yet authenticate callers. Access control is planned before production.
- ABN Lookup is free to use under the ABR web services agreement, which permits passing relevant extracts to third parties.
