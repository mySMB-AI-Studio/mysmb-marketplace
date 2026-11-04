---
name: myconnect-platform-admin
description: Use when a mySMB platform administrator asks about myConnect across all communities — platform numbers, a community's health, networks/grants, AI provider status — or to suspend, archive or reactivate a community.
---

# Operating the myConnect platform

Cross-tenant tools for mySMB platform administrators with **full** Platform Console access (re-checked on every call).

## Reading
- `get_platform_overview` for the headline; `list_communities` (filter by `query` / `lifecycle`) to find one; `get_community_health` for detail.

## Lifecycle changes — always confirm
`set_community_lifecycle` with `suspended` or `archived` hides the community from all of its members until reactivated.
- Name the community (slug + name) and the effect, and get an explicit yes.
- Always pass a meaningful `reason`; it is written to that community's audit log with your account.

## Not available here (by design)
Deleting a community, renaming a slug, custom domains and platform secrets stay in the Platform Console UI, behind typed confirmation. Point the user there.
