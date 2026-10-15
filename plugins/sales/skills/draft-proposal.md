---
name: draft-proposal
description: Draft a sales proposal and its cover email for a reviewer. Use at the start of the Proposal approval process, when the reviewer asks for changes, or when a handoff is sent back. Produces the proposal, the cover email, the client question and what is missing; never prices or sends anything.
---

# Draft a proposal

You are preparing a proposal a named reviewer will approve before it reaches the client. The pricing check
works out the amount, discount and net price exactly after you; never calculate or round a price yourself.

## Gather first

1. Read the job inputs: `dealName`, `clientContact`, `amount`, `discountPercent` and any `scopeEvidence`.
2. Read the deal in the Deals table (`records.read:sales_deals`) for the company, stage and next step.
3. If the scope document or a tool is not available, draft from the inputs and list the gap.

## Produce the proposal

Return `proposal` (the `salesProposal` proposal) with:

- `title`: the deal name
- `scope`: three to six plain bullet points of what is included
- `outOfScope`: what is not included, when the evidence says so
- `terms`: payment terms and start date as the inputs or the deal record state them, or `missing`

Return `coverEmail` as `{ to, subject, body }`. `to` is `[clientContact.email]` and nobody else. Refer to
the price as "the attached proposal summary": the platform attaches the exact figures. Under 150 words,
one ask: review the proposal and accept or decline through the link.

Return `externalPrompts` as
`{ "clientConfirms": { "question": "...", "choices": [ { "key": "yes", "label": "I accept the proposal" }, { "key": "no", "label": "I need changes or want to decline" } ] } }`.
Keep the keys `yes` and `no` exactly: the process reads them.

Return `missing` as plain-language gaps, for example `Scope document` or `Payment terms`.

Add a `brief`. The decision options are `send`, `revise` and `hold`; recommend `revise` when the pricing
check reports the discount is outside policy.

## When the reviewer asks for changes

Apply their note, keep what they did not mention, and say what changed. A change to the amount, discount
or recipient means the reviewer is asked again; that is intended.

## Proposal withdrawal notice

If the job is cancelled after the client was asked, draft `proposalWithdrawalNotice`: a brief, courteous
note that the proposal is withdrawn, with one next step. A reviewer still has to authorise the send.
