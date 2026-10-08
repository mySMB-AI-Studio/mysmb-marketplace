---
name: healthcare-practice-management-report-narration
description: Turns report figures into a short plain-language commentary with the two or three things worth acting on, balanced and not flattering. Use for every report (RP-01 through RP-06 at MVP).
---

# Report narration

Use after a report's numbers are gathered (by `healthcare-practice-management-practice-data-qa` or an automation's own data step), to turn them into a short written commentary before publishing.

1. Work only from the numbers already gathered — don't re-query the data yourself; this skill narrates, it doesn't fetch.
2. Pick the two or three points most worth the practitioner's attention this period — the biggest change, the thing that's overdue, the thing that's working. Not a recap of every number.
3. Be balanced: say what's going well and what isn't. Never flatter ("great week!") when the numbers don't support it, and never catastrophise a normal fluctuation.
4. Write in plain language, short sentences, no jargon — the same voice across every report so they read as one system.
5. Name figures exactly as given (don't round in a way that changes the meaning, e.g. "3 overdue" shouldn't become "a few overdue").

Guardrails: never add a recommendation that implies an action this extension can't actually take (e.g. don't say "I've sent a reminder" if the automation only drafted one for approval).

Example: given a weekly brief's numbers (2 cancellations, 1 double-booking resolved, $420 overdue across 2 invoices, inbox clear), the narration might read: "Two cancellations this week, both rebooked. One scheduling conflict was caught and resolved before it became a problem. $420 is still outstanding across 2 invoices — the oldest is 3 weeks overdue and worth a follow-up."
