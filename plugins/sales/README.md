# Sales

A reference business agent for sales teams, and the package that exercises every kind of extension
component the Workspace installs. It researches and scores new leads, drafts proposals priced exactly
against your discount policy, and runs a monthly renewal review. A named reviewer decides before
anything reaches a lead or a client.

## What's in the box

| Component | File | Purpose |
|---|---|---|
| Connector | `.mcp.json` | `m365-mail-send` and `m365-mail-read`: the shared team mailbox |
| Agent | `content/agents/…`, `agents/sales.md` | The Sales agent: prepares and explains, cannot send |
| Skills (3) | `skills/` | `qualify-lead`, `draft-proposal`, `prepare-renewal-review` (one per agent step) |
| Processes (3) | `content/processes/` | `lead-qualification`, `proposal-approval`, `renewal-review` |
| Capabilities (2) | `content/capabilities/` | `email.send_reviewed` (send) and `email.read_replies` (read) |
| Evaluations (3) | `content/evaluations/` | One required suite per process |
| Automations (2) | `content/automations/` | Lead score and Proposal pricing check (exact, read only) |
| Forms (2) | `content/forms/` | Closed-won handoff, Renewal check-in |
| Form template | `content/form-templates/` | Discovery call notes |
| Activity template | `content/workq-templates/` | Discovery call checklist |
| Custom table | `content/record-types/` | Deals (`sales_deals`): pipeline stages, value, close and renewal dates |
| Setup | `content/setups/` + `views/setup.json` | People, Connections, Pricing |
| Agent page | `views/overview.json` | Pipeline metrics, stage chart, decisions, proposal summaries, How I work |
| Tile | `widgets/sales-deal-pipeline.json` | Open deals from the Deals table with the pipeline total |
| Widget elements | `widget-elements/` | `sales_deal_value`, `sales_pipeline_total`, `sales_stage_tone`, `sales_close_label` |
| Report | `reports/sales-pipeline-review/` | Pipeline review template for the Reports library |
| Portal widget | `portal-widgets/sales-proposal-status.json` | How a proposal works, for client portals |
| Document template | `templates/proposal-summary.md` | The proposal summary the `summary` output step files |

The processes also use the platform capabilities `records.read:sales_deals`, `knowledge.read`,
`workq.create` and `artifacts.write`, which this package does not define.

## The processes

### Lead qualification (`lead-qualification`)

| Step | Kind | What happens |
|---|---|---|
| `research` | agent | Researches the lead and drafts a follow-up email |
| `score` | automation | Scores fit, need, budget and timeline exactly |
| `qualifyDecision` | decision | Qualify (sends the follow-up), keep warm, disqualify, or ask for more research |
| `discovery` | human | The sales team holds the discovery call (Discovery call checklist) |
| `qualified` / `nurtured` / `disqualified` | gate | The three outcomes, each with the decision as evidence |

### Proposal approval (`proposal-approval`)

| Step | Kind | What happens |
|---|---|---|
| `draft` | agent | Drafts the proposal, the cover email and the client question |
| `pricing` | automation | Prices it to the cent and checks the discount against the policy limit |
| `summary` | output | Files the proposal summary document (`templates/proposal-summary.md`) |
| `approveProposal` | decision | Approve and send, ask for changes, or hold |
| `clientConfirms` | external | The client accepts or declines through a verified email-code link; 14 days |
| `handoff` | human | Sales operations completes the Closed-won handoff form |
| `won` / `lost` | gate | Won with the form and the summary as evidence, or lost with the client's answer |

### Monthly renewal review (`renewal-review`)

Started by a schedule trigger at 08:00 on the first of each month (Australia/Sydney).

| Step | Kind | What happens |
|---|---|---|
| `shortlist` | agent | Lists the renewals due from the Deals table with a check-in plan |
| `planDecision` | decision | Assign the check-ins, nothing to do this month, or ask for a different list |
| `review` | human | Account managers check in and submit the Renewal check-in form |
| `settle` | wait | Five business days for customers to reply |
| `reviewed` / `skipped` | gate | Closed with the form, or with the reviewer's decision |

**Protected rules (never editable):** nothing reaches a lead or client without a decision that still
matches the facts it was made on; only the contact named on the job is messaged; prices are worked out
by the pricing check, never the agent; the agent never contacts renewing customers or changes terms.

**Variation points** (editable by the manager): `minScoreToQualify` (60), `maxDiscountPercent` (15),
`proposalValidDays` (14), `renewalWindowDays` (60) and `reminderDays` (2).

## What you connect

| Capability | Side effect | Server | Tool |
|---|---|---|---|
| `email.send_reviewed` | send | `m365-mail-send` | `send_email` |
| `email.read_replies` | read | `m365-mail-read` | `find_replies_to` |

Connect one shared team mailbox to both slots in the Connections step. Without it, follow-ups and
proposals are prepared as drafts for a person to send. Setup also asks which groups hold discovery calls
and take won deals into delivery, and the default currency for pricing.

## Sample data

The package ships no rows. In local development the Agents Demo sign-in shortcut seeds a handful of
sample deals into the Deals table and starts one sample job per process from each process's
`safeTest.sampleInputs`.

## Configuration

No configuration variables are required. Both servers use the Microsoft 365 sign-in of the mailbox
you connect; nothing secret is stored in this package.

## Package notes for maintainers

- The tile reads the built-in `records` data provider (`records.list_sales_deals`), so it needs no
  connector; it shows nothing until the Deals table is published in the workspace.
- `widget-elements/dist/index.js` is compiled from `widget-elements/src/` with `tsc -p widget-elements`.
- Validate with `npx tsx scripts/validate.ts`. Do not hand-edit `contentHash`: re-publish.
