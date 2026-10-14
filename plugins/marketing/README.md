# Marketing

A business agent that turns a campaign idea (audience, offer, budget cap) into a checked draft and
schedules it only after a named reviewer has approved that exact version for a date.

**Outcome:** every published campaign has a reviewer's decision that still matches the budget cap,
audience, copy version and publish time, and a publication receipt on file.

## What's in the box

- **Process (1):** `campaign-approval`: draft, check, decide, publish.
- **Capability (1):** `campaign.publish`, bound to the Mailchimp `mailchimp-campaigns` server. The
  process also uses the platform capability `artifacts.write`, which this package does not define.
- **Evaluation suite (1):** six scenarios that gate release (see below).
- **Automation (1):** Campaign claims and spend check (reads only).
- **Setup (1):** Connections, Preferences.
- **Skill (1):** `draft-campaign-brief`.
- **Agent (1):** Marketing, which drafts and explains but is told never to schedule.

## The process

| Step | Kind | What happens |
|---|---|---|
| `brief` | agent | Reads the audience, drafts the copy, creates the draft campaign, estimates the cost and proposes a time |
| `checkClaims` | automation | Exact checks: banned phrases, offer terms, unsubscribe link, sender address, spend against the cap, valid quarter-hour publish time; prepares the publish request |
| `approveCampaign` | decision | A reviewer chooses `approve-v2`, `request-changes` or `hold` |
| `published` | gate | Outcome `publishedWithReceipt`; evidence is the action receipt |

Only `approve-v2` carries an intent (`campaign.publish`). A failed check returns the draft to `brief`
without involving the reviewer. **Protected rules (never editable):** nothing is published without
approval of a decision that still matches budget cap, audience, copy version and publish time; every
campaign carries an unsubscribe link and the sender's address. **Variation points** (editable by the
manager): `bannedPhrases` and `minReviewLeadDays`. **Exception:** `claimEvidenceMissing` allows only
a return to `brief` and blocks the decision and the gate.

## What you connect

| Capability | Side effect | Server | Tool |
|---|---|---|---|
| `campaign.publish` | publish | `mailchimp-campaigns` | `schedule_campaign` |

The agent also reads audiences through `mailchimp-lists`. Both servers use your Mailchimp API key
(see Configuration). `schedule_campaign` takes `campaign_id` and a UTC `schedule_time`; Mailchimp
schedules on quarter hours only, which the check enforces.

**Limits to know about**

- The Mailchimp tools can create, update and schedule a draft but cannot read or write its body. The
  brief carries the copy and a link to the draft, and the reviewer is asked to confirm the draft's
  content matches the copy version before approving. The approval is bound to the copy version, not
  to the bytes inside Mailchimp.
- `schedule_campaign` has no idempotency key and returns only `{ "success": true }`. The capability
  declares `idempotency.supported: false` and reconciles on the campaign id with `get_campaign`
  (`reconcile.by: externalRef`) after any uncertain outcome.
- Once scheduled, a campaign can be changed or cancelled only in Mailchimp; the package declares no
  compensation.
- The agent's connector ceiling includes `mailchimp-campaigns`, which also exposes `send_campaign`,
  `schedule_campaign` and `delete_campaign`. The agent's instructions forbid using them; the enforced
  control is that publishing happens only through the capability, after a decision.

## Evaluation

`campaign-approval-core` is a required suite (pass rate 1.0, rubric 0.7). Scenarios: `happyPath`,
`claimsFlaggedThenFixed`, `overBudgetNeverReachesDecision`, `holdDoesNotPublish`,
`audienceChangedAfterApproval` and `campaignToolAccessDenied`. Fixture keys (`settings`, `brief`,
`drafts`, `estimatedCost`, `responses`, `changes`, `connections`) describe scripted responders for the
dry-run harness; intents are recorded, never executed.

## Configuration

| Variable | Description |
|---|---|
| `MAILCHIMP_API_KEY` | Your Mailchimp API key, from Mailchimp under Profile, Extras, API keys. It ends in a data-centre suffix such as `-us21`. Sent as the `X-Mailchimp-Api-Key` header to both Mailchimp servers. |

The claim policy is collected by the Preferences step (`banned_phrases`, `min_review_lead_days`).
Setup keys are lower snake case by contract, so they mirror the process policies `bannedPhrases` and
`minReviewLeadDays`.

## Package notes for maintainers

- `argMap` maps capability input name to provider tool argument name.
- The Mailchimp servers are hosted by the myHub MCP gateway (`mailchimp-marketing` integration). No
  other plugin in this registry bundles them yet.
- Validate with `npx tsx scripts/validate.ts`. Do not hand-edit `contentHash`: re-publish.
