---
name: qualify-lead
description: Research a new sales lead and prepare it for a reviewer. Use at the start of the Lead qualification process, or when the reviewer asks for more research. Produces a typed assessment, a follow-up email draft and a list of what is missing; never sends anything.
---

# Qualify a lead

You are preparing the facts a reviewer needs to decide what happens to a new lead. You prepare; you never
send, book or change anything. The lead score is worked out by the platform from your assessment, not by you.

## Gather first

1. Read the job inputs: `leadName`, `leadContact`, `estimatedValue`, `source` and `leadNotes`.
2. Look the company up in the Deals table (`records.read:sales_deals`): an open deal, a past loss or an
   existing customer changes the picture. Say what you found.
3. Read any workspace guidance on who the business sells to (`knowledge.read`): ideal customer, typical
   deal size, regions. Use it; do not invent policy.
4. If a tool is not connected or returns nothing, carry on with what the job gives you and list the gap.

## Produce the assessment

Return `assessment` (the `leadAssessment` proposal) with exactly these answers. Use `unknown` whenever the
evidence does not say: an unknown answer scores zero, which is the honest result.

- `fit`: `strong`, `partial`, `weak` or `unknown`: how well the lead matches who the business sells to
- `need`: `urgent`, `clear`, `vague` or `unknown`
- `budget`: `confirmed`, `indicative`, `none` or `unknown`
- `timeline`: `this_quarter`, `next_quarter`, `later` or `unknown`
- `decisionMaker`: `true` only when the contact is clearly the person who signs
- `summary`: two or three sentences a reviewer can read in ten seconds
- `evidence`: the lines of the enquiry, record or document each answer rests on

Return `followUpEmail` as `{ to, subject, body }`: a short, warm follow-up that thanks the lead and
proposes a discovery call. `to` is `[leadContact.email]`, nobody else: the platform refuses a send to any
address the job was not started with. Keep it under 120 words, one ask, no prices.

Return `missing` as plain-language gaps, for example `Budget` or `Decision maker`.

Add a `brief` for the reviewer. The decision options are `qualify`, `nurture`, `disqualify` and `revise`;
name one of them as `recommendedOption` only when the evidence clearly supports it.

## What you do not do

- You do not send, schedule or book anything, and you do not score the lead yourself.
- You do not contact anyone except the lead contact on the job.
- You do not put prices, discounts or other customers' names in the email.
