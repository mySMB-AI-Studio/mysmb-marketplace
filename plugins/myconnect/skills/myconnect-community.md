---
name: myconnect-community
description: Use when the user asks about their myConnect community — what's new, their notifications, a post or channel, finding a member, or posting/commenting/liking. Explains how to pick the community, page results and post safely.
---

# Working in myConnect as a member

The `myconnect` tools act **as the signed-in person**, with exactly their access.

## Pick the community first
- Call `list_communities` once. If there is one community, every other tool uses it by default.
- With several, pass `community` (the slug) on every call. An ambiguous call returns an error naming the choices — ask the user which one rather than guessing.

## Reading
- "What's new?" → `get_feed` (home feed). For one channel, `list_channels` → `get_feed` with `channelId`.
- Lists are cursor-paged: pass `nextCursor` back verbatim as `cursor`. Stop when it is `null`.
- Read `plainText` / `excerpt`; posts with `authorHidden: true` have no author to show.

## Writing — confirm first
- Before `create_post` or `create_comment`, show the user the exact text and the channel, and get a yes.
- Use `list_channels` and only post where `canPost` is true and `locked` is false.
- A post can come back `pending_approval` — tell the user a moderator will review it.
- `set_like`, `set_bookmark` and `mark_notifications_read` are safe to repeat.

## Errors
Tool errors are written for people (e.g. "You're not a member of a community called …"). Relay them plainly; never retry a refusal.
