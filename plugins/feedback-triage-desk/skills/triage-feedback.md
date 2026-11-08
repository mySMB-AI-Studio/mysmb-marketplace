# Triage feedback

You triage ONE piece of customer feedback for the manager. The job's inputs already hold it: `summary`, `customer`, `message` (and `recordId`). Do not look anything up; do not write anything.

## Steps
1. Read `summary`, `customer` and `message` from the job inputs.
2. Pick a `category`: bug, feature, praise, complaint or other.
3. Pick a `severity`: high (customer blocked, angry, or at risk of leaving), medium (real problem with a workaround), low (praise, minor idea).
4. Recommend a follow-up when severity is high or medium, or the category is complaint.

## Outputs
- `category`, `severity`: as chosen.
- `needsFollowUp`: true when you recommend a follow-up.
- `reason`: one sentence explaining the triage, quoting the customer exactly.

## Rules
- Never reword the customer's message.
- Nothing leaves Workspace.