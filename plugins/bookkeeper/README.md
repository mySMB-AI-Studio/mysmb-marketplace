# Bookkeeper

A business agent that reconciles a customer payment against its invoice in your ledger, shows a named
reviewer the facts, and posts an adjustment only after that reviewer has decided.

**Outcome:** every payment ends either reconciled, with the balance on file, or as a documented
exception with the reviewer's decision and an exception note. Nothing reaches the ledger without a
recorded decision that still matches the amount and the invoice version.

## What's in the box

- **Process (1):** `invoice-reconciliation`: match, check the difference, decide, follow up, close.
- **Capabilities (2):** `accounting.read_invoices` and `accounting.post_adjustment`, bound to the
  `xero-accounting` server. The process also uses the platform capability `workq.create`, which this
  package does not define.
- **Evaluation suite (1):** six scenarios that gate release (see below).
- **Form (1):** Reconciliation outcome.
- **Activity template (1):** Reconciliation follow-up.
- **Automation (1):** Invoice and payment difference check (reads only).
- **Setup (1):** People, Connections, Preferences.
- **Skill (1):** `match-invoice-and-payment`.
- **Agent (1):** Bookkeeper, which reads and explains but is told never to post.

## The process

| Step | Kind | What happens |
|---|---|---|
| `match` | agent | Finds the invoice and the payment and reports both exactly as recorded |
| `checkDifference` | automation | Works out the difference in whole cents; applies the write-off threshold; builds the credit note only when a shortfall is within it |
| `treatment` | decision | A reviewer chooses how to treat a difference |
| `followUp` | human | The account owner completes the checklist and the Reconciliation outcome form |
| `reconciled` | gate | Outcome `reconciled`; evidence is the ledger extract and the difference |
| `documentedException` | gate | Outcome `documentedException`; evidence is the exception note and the decision record |

A payment that matches exactly goes straight to `reconciled` with no decision. Otherwise the
reviewer chooses one of four options:

| Option | What it does | Posts to the ledger? |
|---|---|---|
| `keep-open-investigate` | Leaves the invoice open; follow-up for the account owner | No |
| `credit-note-review` | Follow-up to review a possible credit note with the customer | No |
| `revise` | Sends the match back to the agent | No |
| `post-approved-adjustment` | Posts a credit note for the shortfall (financial) | Yes |

`post-approved-adjustment` is the only option carrying an intent, and it is offered only when the
shortfall is positive and within the write-off threshold. The contract has no per-option "financial"
flag; the option is financial because its capability, `accounting.post_adjustment`, has side-effect
class `financial`.

**Protected rules (never editable):** no adjustment without a decision that still matches the amount
and the invoice version; the agent only reads the ledger. **Variation point** (editable by the
manager): `writeOffThreshold`, default 50.00. **Exception:** `paymentNotInLedger` allows the
decision and follow-up but blocks the `reconciled` gate. **Rework:** the reviewer can send a
follow-up back to `match`.

## What you connect

| Capability | Side effect | Server | Tools |
|---|---|---|---|
| `accounting.read_invoices` | read | `xero-accounting` | `list_invoices`, `get_invoice`, `list_payments`, `get_payment` |
| `accounting.post_adjustment` | financial | `xero-accounting` | `create_credit_note` |

The Xero server does not expose an idempotency key on `create_credit_note`, so
`accounting.post_adjustment` declares `idempotency.supported: false`. The platform instead stamps a
deterministic reference (`RECON-<invoice number>-<payment reference>`) in the credit note's
`Reference` and, after any uncertain outcome, looks for it with `list_credit_notes` before
retrying (`reconcile.by: externalRef`).

**Limits to know about**

- The connector creates the credit note (status `AUTHORISED`, tax type `NoTax`) but has no tool to
  allocate it to the invoice. The follow-up checklist asks the account owner to allocate it and
  review its tax treatment.
- Posted credit notes are not reversed by this package. Voiding one is a manual step in the ledger.
- `xero-accounting` is one server that also exposes write tools, so the agent's connector ceiling
  cannot be read only. The agent's instructions forbid writes; the enforced control is that
  postings happen only through the capability, after a decision.

## Evaluation

`invoice-reconciliation-core` is a required suite (pass rate 1.0, rubric 0.7). Scenarios:
`exactMatch`, `shortPaymentAboveThreshold`, `noWriteOffWithoutDecision` (a within-threshold
shortfall with no decision never posts: `intentsNotAllowed: accounting.post_adjustment`),
`approvedAdjustmentWithinThreshold`, `invoiceChangedAfterApproval` and `ledgerAccessDenied`. Fixture
keys (`settings`, `ledger`, `responses`, `changes`, `connections`, `elapsedBusinessDays`) describe
scripted responders for the dry-run harness; intents are recorded, never executed. The follow-up form
answers are `q_balanced` (maps to `balanceMatches`) and `q_note` (maps to `exceptionNote`).

## Configuration

No configuration variables are required. The accounting connection signs in with Xero when you
connect it in the Connections step; nothing secret is stored in this package. The write-off policy
and account code are collected by the Preferences step (`write_off_threshold`,
`write_off_account_code`). Setup keys are lower snake case by contract, so they mirror the process
policy `writeOffThreshold` and the process refers to the account-owner group as
`{{settings.account_owner_group}}`.

## Package notes for maintainers

- `argMap` maps capability input name to provider tool argument name.
- One capability may list several tools of the same server (the read capability lists four); the
  tools are alternatives the gate may call, not a sequence.
- Validate with `npx tsx scripts/validate.ts`. Do not hand-edit `contentHash`: re-publish.
