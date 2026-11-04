---
name: myconnect-community-admin
description: Use when a community admin asks to manage their myConnect community — members, roles, deactivation, invitations, the moderation queue, or community numbers. Covers confirmation rules for every change.
---

# Administering a myConnect community

These tools act as the signed-in **admin or owner**; the role is re-checked on every call.

## Scope
- `list_communities` shows only communities the person administers. With several, pass `community` (slug) every time.

## Before any change, confirm
Show the user exactly what will change and get a yes before:
- `update_member` — especially `role` or `status: "deactivated"` (deactivation removes access). `tagIds` REPLACES the whole tag set and fires the tag workflows; read the member first and send the full intended set.
- `invite_member` — confirm the email and role. An existing account joins immediately; otherwise an invitation email is sent.
- `review_moderation_item` — approving publishes the content and notifies the author.

## Guard rails (enforced server-side)
- The owner's role and status can't be changed, and nobody can change their own role or status.
- Already-decided moderation items are left alone (`changed: false`).

## Reporting
- `get_community_summary` for headline numbers; `list_audit_log` to show who changed what (connector changes appear as `mcp.community-admin.<tool>`).
