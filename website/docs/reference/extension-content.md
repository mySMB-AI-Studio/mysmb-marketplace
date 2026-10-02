---
id: extension-content
title: Custom tables and setup
sidebar_position: 5
---

# Custom tables and setup

Workspace extensions may add portable schemas and installation configuration:

```json
{
  "content": {
    "recordTypes": ["content/record-types/<originKey>.json"],
    "setups": ["content/setups/<originKey>.json"]
  }
}
```

Each file has a stable UUID `originKey`, `name`, SHA-256 `contentHash`, and
`definition`. Table files use `kind: "record_type"` and the Records Engine
`ProposalType` contract (slug, labels, fields, optional settings). Setup files
use `kind: "setup"`, optional `description`, and a version 1 definition with
ordered steps. AI Studio generates these payloads. The hash covers the entire
payload except `contentHash`, sorts object keys recursively using JavaScript's
default key order and preserves array order. Each payload is at most 1 MB;
an extension lists at most 20 table schemas and 30 setup components. Installation
also respects the Records Engine's existing tenant capacity of 20 live types.

Tables install empty and draft. A designer explicitly reviews and publishes
them; no records or grants travel in the bundle. Optional
`settings.portalAccess` defaults to deny and names the visible/editable fields
and allowed operations. Workspace validates relations, feature availability,
schema changes, access and publication again during installation.

A setup definition uses `version: 1` and `steps` with an `id`, `title`, optional
`description`, `fields` and `connectors`. Fields declare `key`, `label`, `type`
(string, number, boolean or select), optional `required`, nonsecret `default`,
`helpText`, and select `options` (value/label pairs). Connector slots declare
`key`, `server`, `label`, optional `required`, and `scope` (personal, service or
either). Keys must be unique across all setup components in the extension.

Account IDs and answers are selected per user in Workspace; credentials stay
in Connections. Setup files must not contain accounts, tokens, passwords or
tenant-specific answers. Incomplete setup stays pending. Finish reviews the
current definition hash. Upgrades preserve compatible answers and require a new
review. Installation does not publish automations or grant connector/customer
access. Workspace automations use their owner's completed answers through
`api.extension.settings()` and recheck selected account grants at runtime.

Claude Code ignores these Workspace-specific content sections. Existing plugins
without them retain their current validation and installation behaviour.

Validator development and regression tests use Node 20.19+ on the 20.x line,
22.12+ on the 22.x line, or Node 24 and newer:
`npm ci`, `npm test`, then `npm run validate`. CI runs these commands on each
branch tier. Full CLI tests use temporary synthetic catalogues and leave the
published plugin directories untouched.
