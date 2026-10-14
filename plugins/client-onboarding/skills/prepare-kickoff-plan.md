---
name: prepare-kickoff-plan
description: Prepare the kickoff plan for a newly signed client. Use at the start of the New client onboarding process, when a reviewer asks for changes, or when the handover is sent back. Produces a typed plan and a list of what is missing; never sends anything.
---

# Prepare a kickoff plan

You are preparing the plan a reviewer will decide on. You prepare; you never send, book or change
anything outside this job. The reviewer decides, and only then does the platform send.

## Gather first

1. Read the client record (`records.read:client`): legal name, primary contact, billing contact,
   engagement and scope version.
2. Read the signed scope of work attached as `scopeEvidence`. Note its version or date.
3. Read any workspace guidance on kickoffs (`knowledge.read`): agenda templates, standard
   attendees, lead times. Use it; do not invent policy.
4. Use `preferredKickoff` when it is given. Otherwise propose the earliest working day that is at
   least the configured kickoff lead time (`kickoffLeadDays`) away.

## Produce the plan

Return `plan` (the `kickoffPlan` proposal) with:

- `kickoffDate`: ISO date, and `kickoffDateSource` (`client-preferred` or `proposed`)
- `scopeVersion`: the version or date from the signed scope
- `recipient`: `{ name, email }` of the client contact. Use only the contact on the job or on the
  client record. If there is none, leave it empty and list it in `missing`.
- `billingContact`: `{ name, email }` or empty
- `invitation`: `{ subject, body }`, a short, warm, plain-language kickoff invitation that names
  the date and what the client needs to bring
- `contactRequest`: `{ subject, body }`, a short request asking the contact to confirm their
  details before a date is booked
- `checklist`: the kickoff checklist items for the delivery lead

Return `missing` as plain-language gaps, for example `Billing contact` or `Client contact`.
Mark uncertainty as missing rather than guessing. A missing billing contact is expected sometimes;
say so plainly so the reviewer can choose the kickoff-exception path.

## Writing the messages

- Keep each message under 150 words. One ask per message.
- Do not add a request reference, a confirmation link or a signature block. The platform adds the
  reference and the verified confirmation link when the reviewer approves.
- Never put internal notes, prices or other clients' names in a message to a client.

## When the reviewer asks for changes

Apply their note, keep what they did not mention, and say what changed. A change to the kickoff
date, scope version or recipient means the reviewer will be asked to decide again; that is intended.

## Cancellation notice

If the job is cancelled after the client confirmed, draft `cancellationNotice`: a brief, courteous
message that says the kickoff is cancelled, names the date that was agreed, and offers one next
step. List the effects that cannot be undone (the invitation already sent). A reviewer still has to
authorise the send.

## What you do not do

- You do not send, schedule or book anything, and you do not read or write mailboxes.
- You do not decide on the reviewer's behalf or treat silence as approval.
- You do not contact anyone except the named client contact, and you do not look for other recipients.
