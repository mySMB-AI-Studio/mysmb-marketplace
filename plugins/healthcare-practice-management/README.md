# Healthcare Practice Management

A Practice Manager Agent for sole-practitioner clinics on Cliniko. It plugs into Cliniko, the practitioner's email and Xero to act as a virtual practice manager: the inbox, the diary, patient admin and money follow-ups, with approval in WorkQ before anything a patient sees or anything that changes the diary.

This is the foundation step of a larger build (agent + connectors). Automations and reports (AU-01 to AU-20, RP-01 to RP-11) ship in later extension updates and reuse the skills and Knowledge files this step sets up.

## What's in the box

- **Connectors reused, not re-registered:** `cliniko-scheduling`, `cliniko-patients`, `cliniko-clinical`, `cliniko-billing`, `cliniko-practice` (the Cliniko extensions), `microsoft-365` (`m365-mail-read`, `m365-mail-send`, `m365-calendar`) and/or `google-workspace` (`google-workspace-gmail`, `google-workspace-gmail-write`), and `xero-accounting`. This extension does not add its own Connect flow for any of these — it reuses whichever of these extensions are already installed and connected on the workspace, matching the practice's actual platforms.
- **Agent (1):** Practice Manager Agent. Answers status questions, explains a draft or a guardrail decision, drafts replies and reports for approval. It never sends an email, changes a Cliniko booking, or updates an invoice itself — those are approve-then-apply automations, built in a later step. It is also **read-only against this extension's own Knowledge files** — see the platform gap below — so it routes anything needing approval through a real WorkQ item (`todo_create`) rather than a Knowledge write it architecturally cannot make.
- **Skills (15):** `healthcare-practice-management-foundation` (the Knowledge folder layout every other skill depends on, and the read/write split between the agent and automations) plus the 14 MVP skills (SK-01 to SK-13, SK-18 in the scope spec): email triage, practitioner-voice drafting, patient/payer resolution, scheduling reasoning, practice policy, document extraction, clinical summarisation (summaries only, never clinical interpretation), payment matching, debtor follow-up, daily brief composition, practice data Q&A, commitment memory (read-only for the agent), guardrail enforcement and audit (read-only for the agent; approval routing is a real WorkQ item), and report narration.
- **Form (1) + automations (2):** **Practice setup** form, with **Healthcare Practice Management: Start practice setup** (manual trigger — creates the WorkQ item with the form attached) and **Healthcare Practice Management: Apply practice setup** (runs on form submission — writes `PracticeManager/Practices/<slug>.json`). This pair exists because a chat agent cannot write organisation-scoped Knowledge at all (see below) — an automation is the only way this file can ever be created or updated, the same reason `bookkeeping-xero` uses a Start setup/Apply setup pair instead of having its own agent write `Bookkeeping/settings.json` directly.

## Configuration

No configuration variables are set by this extension itself.

**Requires**, already installed and connected on the workspace:
- The five Cliniko extensions (`cliniko-scheduling`, `cliniko-patients`, `cliniko-clinical`, `cliniko-billing`, `cliniko-practice`), connected with the practice's `CLINIKO_API_KEY` (one personal API key per Cliniko user — a clinic-owned Cliniko account needs the owner's approval and its own dedicated key, per Cliniko's one-key-per-user model).
- The **Microsoft 365** extension (Outlook) and/or the **Google Workspace** extension (Gmail), matching the practice's actual email platform. Gmail send is production-only today — see the note below.
- The **Xero Accounting** extension, connected as the person who owns invoice and payment data for this practice.

## Known platform gaps that shape later steps

- **Gmail send-on-dev gap.** Gmail's `send_message` tool exists only in production; the development/QA environment used to build and test this extension has draft-only Gmail tools (`create_draft`). A Gmail-based practice's "send after approval" step can be built and tested as a draft on dev/QA, but the live send can only be proven once an automation reaches production. Outlook has no such gap — `send_email`/`reply_to_email`/`forward_email` exist on every environment.
- **No connector-level events.** There is no `cliniko.*`, `gmail.*` or `xero.*` event in the platform's event catalog — every "new email" / "new appointment" / "new result" trigger in a later automation is a scheduled poll, not a webhook.
- **Cliniko invoices are read-only.** No tool in any Cliniko connector can create, update or close an invoice, and there is no invoice-PDF tool. Anything that needs to mark an invoice Sent or Paid, or attach a PDF, works through Xero or an inline-HTML workaround instead — never by writing to Cliniko.
- **A chat agent cannot write organisation-scoped Knowledge.** Found live in QA testing: the agent's `knowledge_upload`/`knowledge_create_folder` tools are hard-locked to a private scope tied to the agent's own identity — invisible to any human and to any automation, and structurally incapable of reaching the `org` scope that `bookkeeping-xero`'s `Bookkeeping/` folder (and this extension's own `PracticeManager/` files) live in. Only an automation, with `api.files.put` locked to its declared `org` level, can write there. This is why `PracticeManager/Practices/<slug>.json` is created by the **Apply practice setup** automation, not by the agent — and why `PracticeManager/Commitments/*` and `PracticeManager/AuditLog/*` stay empty or absent until a domain automation (step 2 onward) writes to them for real. The agent reads all three paths (`knowledge_read`/`knowledge_list` with `scope: "org"`), it just can never create or update them.

## Knowledge files this extension uses

See the `healthcare-practice-management-foundation` skill for the full schema. In short:

- `PracticeManager/Practices/<practice-slug>.json` — one file per practice: which Cliniko business, which email provider, which Xero organisation, and the practice's own policy (cancellation window, tone, email tiers, approval rules, a never-do list).
- `PracticeManager/Commitments/<practice-slug>.json` — open loops: promised payments, reschedule offers awaiting reply, results not yet reviewed.
- `PracticeManager/AuditLog/<practice-slug>-<YYYY-MM-DD>.jsonl` — an append-only audit trail of every read, draft, approval, send, rejection, edit or guardrail block. This is the data source the later "Agent activity and approvals log" report reads — its JSON-lines schema is fixed now so that report doesn't need a migration later.

## After installing

1. Install and connect the five Cliniko extensions, Microsoft 365 and/or Google Workspace, and Xero Accounting, as the person who will own this agent's and automations' connections.
2. Turn on Automations for the workspace if it isn't already (`features.automations`), then publish both **Healthcare Practice Management: Start practice setup** and **Apply practice setup** (they install as drafts).
3. Run **Start practice setup** once per practice. It creates a WorkQ item with the **Practice setup** form attached — fill it in (practice name, Cliniko business ID, email platform, Xero organisation name exactly as it appears in Xero, timezone, cancellation window, reviewer) and submit it.
4. **Apply practice setup** runs automatically on submission and writes `PracticeManager/Practices/<slug>.json`, matching the Xero organisation name to its tenant id the same way `bookkeeping-xero` does. Sensible defaults are applied for tone, email tiers, approval rules and the never-do list — edit the file directly in Knowledge to change them.
5. Chat with the Practice Manager Agent to confirm it can read Cliniko, email and Xero for that practice, and that anything needing approval produces a real WorkQ item (`todo_create`), not just a sentence saying it would.
