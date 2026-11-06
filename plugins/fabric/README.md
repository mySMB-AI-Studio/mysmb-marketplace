# Microsoft Fabric

Read-only access to a Microsoft Fabric Warehouse or Lakehouse SQL analytics
endpoint. Connects over the same TDS/SQL protocol as SQL Server, using a
shared Entra ID service principal -- no per-user Fabric account or OAuth
flow is required.

## Tools

| Tool | Description |
| ---- | ----------- |
| `fabric_list_tables` | Connect to a Fabric Warehouse or Lakehouse SQL analytics endpoint and list its tables and views (up to 100). Takes `server` (the SQL connection host, e.g. `<guid>.datawarehouse.fabric.microsoft.com`) and `database` (the Warehouse/Lakehouse item name) as arguments. |

**This is a deliberately temporary tool.** It exists to verify the
service-principal connection actually works once a real Fabric workspace is
available -- it is not the intended long-term tool surface. Once the real
table schema and the questions this needs to answer are known, this should
be replaced with purpose-built read tools (one verb, one resource) rather
than grown into a generic "run any SQL" tool.

## Configuration

The plugin has **no configuration** (`authType: "none"`). It is a thin
pointer at the myHub-hosted `fabric` MCP server, which authenticates to
Fabric with a shared service principal held server-side.

The credential is a Microsoft Entra ID app registration (`fabric-pronto-reader`)
in mySMB.com's own tenant, with client-credentials access to a specific
Fabric workspace. It is a **platform-level** secret, not a per-user one, so
it lives in the `myhub-mcp-servers` deployment environment
(`FABRIC_CLIENT_ID` / `FABRIC_CLIENT_SECRET`) and never in this repository.

`server` and `database` are supplied per tool call, not fixed configuration
-- no Fabric workspace is baked in yet.
