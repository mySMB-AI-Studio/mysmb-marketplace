<!-- Target `dev` unless you are promoting a tier (dev→staging→main). -->

## What & why

<!-- Which plugin(s) and what changed. -->

## Checklist

- [ ] `npx tsx scripts/validate.ts` passes
- [ ] `node scripts/normalize-mcp-urls.mjs --check` passes (no non-prod myhub URLs)
- [ ] `.mcp.json` uses the **production** myhub host (or a third-party host)
- [ ] README has a `## Configuration` section documenting every `${VAR}`
- [ ] Plugin is registered in `.claude-plugin/marketplace.json`
- [ ] If a new hosted MCP server was needed, the matching PR in
      `myhub-mcp-servers` is linked below
- [ ] PR targets the correct branch (`dev` for new work)

## Linked PRs / notes
