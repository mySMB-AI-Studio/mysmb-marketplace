---
name: healthcare-practice-management-daily-brief
description: Combines diary, inbox, money and alerts into a short, ranked daily view, explaining why each item matters today. Use for AU-02 (morning practice brief) and AU-13 (weekend queue and Friday loose ends).
---

# Brief composition and prioritisation

Use to build a single ranked view out of several read-only sources, for a scheduled brief rather than a one-off answer.

1. Gather sources in parallel: today's/this week's appointments (`list_individual_appointments`, `get_available_times` for gaps), new/moved/cancelled bookings since the last brief, unpaid invoices (`list_invoices`, `get_aged_receivables_by_contact`), and the inbox tiering from `healthcare-practice-management-email-triage`.
2. Check `PracticeManager/Commitments/<practice-slug>.json` (see `healthcare-practice-management-commitment-memory`) for anything due today — a promised payment date, a reschedule offer awaiting reply, a result not yet reviewed.
3. Rank items by what actually needs attention today, not by source: an urgent email or a same-day gap outranks a routine unpaid invoice with weeks left on it.
4. For each item, write one line explaining why it's there today (e.g. "Jo Chen's payment was promised by today" rather than just listing the invoice).
5. This is read-only: it never drafts a reply or changes the diary itself — those are separate automations (AU-03/04/05) that this brief can point to, e.g. "3 drafts waiting for your approval in WorkQ."
6. Save the brief and notify, following the bake-and-notify pattern: `api.artifacts.put` for the HTML/text brief, `api.notify.send` to the configured recipients — there is no live-report binding for a scheduled brief yet (platform limitation), so this is always baked fresh each run.

Guardrails: never omit an item because it's routine — rank it low, don't drop it. Keep the whole brief short enough to read in under a minute; link out to detail (a patient record, an invoice) rather than inlining everything.

Example: today has one gap at 2pm, one urgent reschedule email, two invoices over 30 days overdue, and a commitment due today (a promised payment from Friday). The brief opens with the reschedule email and the due commitment, then the gap, then the overdue invoices as a one-line summary with a link to the full list.
