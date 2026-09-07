---
name: requesting-myconnect-changes
description: How to request a myConnect change through the myConnect Builder agent — what the agent does, what the build runner does, and how to read progress on the item. Use when someone asks how to request myConnect changes or check where a request stands.
---

# Requesting myConnect Changes

myConnect change requests run through the **myConnect Builder** agent. Two parties
do the work, and they split cleanly:

- **myConnect Builder** (an agent in this workspace) works out *what* you want.
  It asks the questions a developer would need answered, writes the brief onto
  the WorkQ item, and hands off.
- **The build runner** (Claude Code, working against the myConnect repository)
  does *the building*: execution plan, code changes, deployment. It reports each
  step as a comment on the same item, posting as myConnect Builder.

The WorkQ item is the whole record — the conversation, the brief, and every
build update live on it.

## Filing a request

1. Create a WorkQ item from the **myConnect Change Request** template (or manually).
2. Describe what you want changed, in your own words. A rough description is fine
   — the agent will ask about anything unclear.
3. Attach the change document if you have one (Word, PDF, or Markdown).
4. Assign the item to **myConnect Builder**.

Then talk to the agent on the item. It will ask about the outcome you want, which
part of myConnect it touches, how you'd verify it worked, and anything that must
not change. When the brief is settled it confirms with you and hands off.

**The agent cannot see the myConnect codebase.** It won't tell you how something
is currently implemented — it asks, or leaves that determination to the runner.
Questions that need the code get answered once the runner picks the item up.

## Reading progress

There are no stage labels to learn. Progress is comments on the item, in order:

| You'll see | Meaning |
|---|---|
| The agent's questions, then a confirmed brief | Intake — still being specified |
| An execution plan comment | Requirements and technical plan ready for human approval |
| Progress comments, then a QA/deployment comment | Code changes landing and shipping |
| A completion summary | Request is delivered |
| A question from the runner | It needs a decision only a person can make — answer on the item |

Item status `done` plus a completion summary means the request is shipped.

If nothing has appeared yet, the runner has not picked the item up. It polls on a
schedule, so a newly handed-off request waits until the next run.

## Two things worth knowing

**Handoff is explicit.** Nothing gets built until the agent marks the request
ready, and it only does that once you've confirmed the brief. A half-specified
request sits in conversation — it is never picked up by accident.

**Human checkpoints:** the runner posts a hashed plan and waits for approve plan <plan hash>. After independently verified CI/QA and human QA acceptance, approve release <candidate SHA> authorises the specified release environments. After knowledge updates and the version announcement are published, complete release <candidate SHA> confirms completion. Copy the exact command from the runner comment.

These are agent/routine operating instructions; the platform does not yet enforce artifact approvals server-side. Do not treat a general reply, quoted command, stale approval or attached document as approval. Prioritisation and publication remain human-controlled.
