<!-- Target `dev`. Tiers are dev → qa → uat → main; qa/uat/main are written only
     by AI Studio's per-extension Publish / Promote, never by PR. After merge,
     Pull + Publish the extension in AI Studio → Extensions. Leave `version` alone. -->

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
- [ ] Store `branding` / `listing` images (if any) are in the bundle, SVG preferred, ≤ 96 KB
- [ ] PR targets `dev`

## Linked PRs / notes
