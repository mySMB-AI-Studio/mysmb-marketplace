# FileMaker

Read-only access to a hosted FileMaker database via the [Claris Data API](https://help.claris.com/en/data-api-guide/content/index.html), through the myHub-hosted FileMaker MCP gateway. Search layout metadata, fetch records by ID, browse or filter records, and pull related/portal data.

FileMaker is a generic, customer-defined app platform — unlike a fixed-schema SaaS vendor, there's no universal layout or field naming across customers. The widgets below use illustrative layout/field names (`Customers`, `CreatedDate`, `Status`, and similar) as stand-ins; after connecting, edit each widget's `dataProvider.params.layout` and its column/field bindings to match your own FileMaker solution's actual layout and field names.

## Authentication — two hosting modes

FileMaker can be hosted two different ways, with genuinely different auth:

- **FileMaker Server (self-hosted):** direct username/password login. Fill in Host, Database, Username, and Password; leave the two Cognito fields blank.
- **FileMaker Cloud (Claris-managed):** a Cognito SRP handshake first, then an exchange for a Data API session token. Fill in all six fields.

Your FileMaker account needs the `fmrest` extended privilege enabled (**File → Manage → Security** in FileMaker Pro), and the file must have the Data API enabled for its host.

> FileMaker Cloud's Cognito step was not verified against a live account when this connector was built — no trial was available. If Cloud-mode connections fail at the session-exchange step, that's the most likely place to check first.

## Configuration

| Variable | Required | Description |
|---|---|---|
| `FILEMAKER_HOST` | ✅ | Your FileMaker Server or FileMaker Cloud host URL, no trailing slash (e.g. `https://myfmserver.example.com`). |
| `FILEMAKER_DATABASE` | ✅ | The FileMaker file/database name, exactly as hosted (no `.fmp12` extension). |
| `FILEMAKER_USERNAME` | ✅ | A FileMaker account with the `fmrest` extended privilege enabled. |
| `FILEMAKER_PASSWORD` | ✅ | Password for the account above. Stored encrypted. |
| `FILEMAKER_COGNITO_USER_POOL_ID` | Cloud only | Claris ID Cognito User Pool ID. Leave blank for FileMaker Server. |
| `FILEMAKER_COGNITO_CLIENT_ID` | Cloud only | Claris ID Cognito Client ID, paired with the User Pool ID above. Leave blank for FileMaker Server. |

## Tools

- `get_layout_metadata` — field and portal (related-table) metadata for a layout; use this first to discover what's queryable
- `get_record` — a single record by ID, optionally embedding named portals' related rows
- `get_records` — browse/list records on a layout, with sort and pagination
- `find_records` — filter records using FileMaker's own find-request syntax

No create/update/delete/run-script tools are exposed — this connector is read-only by design.

## Widgets

Each widget below ships as a live tile (wired to your real FileMaker data, once you edit its field bindings to match your schema) and a `-demo` companion (static illustrative data, no connection required, useful for previewing layout before you connect):

- **Recent Records** (`filemaker-recent-records`) — most recently created records on a layout, in a table
- **Record Detail** (`filemaker-record-detail`) — a single record's key fields by ID
- **Open Invoices** (`filemaker-open-invoices`) — a filtered result set via `find_records`
- **Project Tasks** (`filemaker-project-tasks`) — a parent record's related child rows via embedded portal data
- **Layout Field Snapshot** (`filemaker-layout-snapshot`) — a schema-facing admin/dev view of what's queryable on a layout
- **Record Count** (`filemaker-record-count`) — total record count on a layout, live and schema-agnostic (no field-name editing needed)

## See also

- [Claris Data API Guide](https://help.claris.com/en/data-api-guide/content/index.html)
