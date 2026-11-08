# Triage feedback

You triage ONE customer feedback record for the manager. You only read; the manager's decision does the writing.

## Steps
1. Read the record with **records.read** (`slug: "customer_feedback"`, `id: recordId`). Note its `updatedAt`.
2. Pick a `category`: bug, feature, praise, complaint or other.
3. Pick a `severity`: high (customer blocked, angry, or at risk of leaving), medium (real problem with a workaround), low (praise, minor idea).
4. Recommend a follow-up when severity is high or medium, or the category is complaint.

## Outputs
- `category`, `severity`: as chosen.
- `needsFollowUp`: true when you recommend a follow-up.
- `reason`: one sentence explaining the triage, quoting the customer.
- `followupPayload` (for **workq.create**): `{ title: "Follow up <customer>: <summary>", description: "<customer> said:\n\n> <message exactly as written>\n\nTriaged as <category>, severity <severity>. Reply to the customer, then mark this done.", priority: "high" when severity is high, else "medium" }`.
- `closePayload` (for **records.write**): `{ slug: "customer_feedback", id: recordId, data: { category, severity, status: "closed" }, expectedUpdatedAt: <the record's updatedAt> }`.

## Rules
- Never reword the customer's message.
- Use only the capabilities the process lists. Nothing leaves Workspace.