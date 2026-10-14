# Client Onboarding

A business agent that takes a newly signed client from "scope signed" to "handover accepted" without
anything reaching the client before a named reviewer has decided.

**Outcome:** the kickoff is booked only after a reviewer approves the date, scope version and
recipient; the client confirms through a verified link; the delivery team accepts a written handover;
and the evidence is kept with the job.

## What's in the box

- **Process (1):** `new-client-onboarding`: prepare, check, decide, confirm, hand over, close.
- **Capabilities (2):** `email.send_reviewed` and `email.read_replies`, bound to the Microsoft 365
  mail servers. The process also uses the platform capabilities `records.read:client`,
  `workq.create` and `knowledge.read`, which this package does not define.
- **Evaluation suite (1):** six scenarios that gate release (see below).
- **Form (1):** Handover acceptance.
- **Activity template (1):** Client kickoff checklist.
- **Automation (1):** Kickoff plan completeness check (reads only).
- **Setup (1):** People, Connections, Preferences.
- **Skill (1):** `prepare-kickoff-plan`.
- **Agent (1):** Client Onboarding, which prepares and explains but cannot send.

## The process

| Step | Kind | What happens |
|---|---|---|
| `gather` | agent | Prepares the kickoff plan and lists what is missing |
| `check` | automation | Checks the plan is complete (exact work, no AI) |
| `kickoffDecision` | decision | A reviewer chooses: book kickoff, wait for the contact, or ask for changes |
| `confirm` | external | The client contact confirms by email or portal; email code required; 7 days |
| `handover` | human | The delivery lead completes the Handover acceptance form and kickoff checklist |
| `done` | gate | Outcome `handoverAccepted`; evidence is the form response |

**Protected rules (never editable):** no invitation without a decision that still matches the
kickoff date, scope version and recipient; only the named contact is ever messaged. Changing any of
those three facts after approval invalidates the decision and asks again.

**Exception:** `missingBillingContact` lets the kickoff be booked but blocks handover until a
billing contact is on file. **Rework:** the reviewer can send a handover back to preparation.
**Cancellation:** after the client has confirmed, a cancellation notice is drafted and still needs a
reviewer's authority.

**Variation points** (editable by the manager): `reminderDays` (default 2) and `kickoffLeadDays`
(default 5).

## What you connect

| Capability | Side effect | Server | Tool |
|---|---|---|---|
| `email.send_reviewed` | send | `m365-mail-send` | `send_email` |
| `email.read_replies` | read | `m365-mail-read` | `find_replies_to` |

`email.send_reviewed` stamps a short `requestRef` on the message. Microsoft Graph has no idempotency
key, so a send with an unknown outcome is never retried blind: the platform first looks for the
reference with `find_sent_by_reference` on `m365-mail-read`. Connect one shared team mailbox to both
slots in the Connections step. `m365-mail-send` needs admin consent in Microsoft Entra;
`m365-mail-read` does not.

The Setup steps also ask which group receives the handover (`delivery_group`) and how many business
days pass before the reviewer is reminded (`reminder_days`). Setup keys are lower snake case by
contract, so the process refers to the group as `{{settings.delivery_group}}`.

## Evaluation

`new-client-onboarding-core` is a required suite (pass rate 1.0, rubric 0.7). Scenarios:
`happyPath`, `missingBillingContact`, `kickoffDateChangedAfterApproval`, `mailboxAccessDenied` (no
send intent), `nobodyDecides` (never sends on timeout) and `cancelAfterConfirm`. The fixture keys
(`clientRecord`, `responses`, `connections`, `changes`, `elapsedBusinessDays`, `cancelAfter`)
describe scripted responders for the dry-run harness; intents are recorded, never executed.

## Configuration

No configuration variables are required. Both servers use the Microsoft 365 sign-in of the mailbox
you connect; nothing secret is stored in this package. Preferences are collected by the Setup steps.

## Package notes for maintainers

- `argMap` maps capability input name to provider tool argument name.
- The servers are bundled here (same URLs as the `microsoft-365` plugin) rather than declared as a
  dependency: the in-app bundle validator requires every server a setup slot or agent names to be in
  this plugin's `.mcp.json`.
- The agent's connector ceiling is read only (`m365-mail-read`). Sending happens only through the
  `email.send_reviewed` capability after a recorded decision.
- Validate with `npx tsx scripts/validate.ts`. Do not hand-edit `contentHash`: re-publish.
