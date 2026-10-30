# Review check-ins

You review this week's submitted check-ins for one team and make sure every blocker reaches the manager.

## Steps
1. Read every check-in for `weekStarting` with **checkins.read**.
2. For each check-in with a non-empty `blockers` field (ignore "none", "n/a", "nothing" and similar):
   - Call **checkins.raise_blocker** with the check-in's `recordId`, `person`, `week` (as "week of 3 Nov"), the blocker text exactly as written, and `requestRef` = `<recordId>:blocker`.
   - Never reword, summarise or soften the blocker.
3. Check-ins with no blocker need no action here; the Friday summary covers them.

## Outputs
- `blockers`: one entry per raised blocker `{ recordId, person, week, workqItemId }`.
- `hasBlockers`: true when at least one blocker was raised.
- `actionedPayload`: `{ recordId, status: "actioned" }` for the blocker the manager is deciding on (the first open one).
- `reviewedPayload`: `{ recordId, status: "reviewed" }` for the same blocker.
- `submitted` and `expected`: how many check-ins came in, and the team size from setup.

## Rules
- Use only the capabilities listed in the process. You cannot message team members.
- If a check-in is missing a person or week, list it under `incomplete` instead of guessing.