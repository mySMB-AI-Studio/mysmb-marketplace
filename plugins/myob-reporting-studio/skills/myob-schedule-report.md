---
name: myob-schedule-report
description: Set up a MYOB Reporting Studio report to be made again on a schedule (daily, weekly, monthly or once) and to tell the user when it's ready. Use when the user asks to "send me the P&L every Monday", "schedule a monthly report pack", "refresh this report each week" or "give me the aged receivables on Fridays".
---
# Schedule a MYOB report

Use when the user wants a MYOB Reporting Studio report made again on a schedule. This works in mySidekick, which has the scheduled-task tools (`schedule_task_create`, `schedule_task_list`, `schedule_task_update`, `schedule_task_delete`). Without them (a reporting agent, or scheduled tasks turned off for the workspace) you can't schedule: say so, and suggest asking mySidekick with the report's name. Never promise a schedule you can't set.

1. **The report:** its template slug in the extension `myob-reporting-studio` is the report skill's name (for example `profit-and-loss`, `unpaid-invoices`, `report-pack`, `myob-pay-run-history`). If unsure, ask, or offer the Reports Catalogue. Never schedule a report the studio doesn't ship.
2. **The client:** the company file: the template's `company_file` input takes its id from `list_company_files`. With one file, leave `company_file` out. One task per client: never mix clients in one task. Ask when more than one could be meant.
3. **When:** daily, weekdays, weekly (which day), monthly (day 1 to 28) or once, at a time of day (24-hour, the user's timezone). If they don't say, use Monday 08:00 for a weekly report and say so.
4. **The period:** keep the template's own rolling period (its defaults, such as last month or this financial year to date), so each run covers the right dates. Set only the inputs the user asked for.
5. Call `schedule_task_create`:
   - `title`: "<report name> — <client>";
   - `preset` and `time`, plus `weekday` (0 = Sunday … 6 = Saturday) or `monthday`;
   - `instruction`: a complete brief, for example: "Create the report with artifact_from_template: plugin myob-reporting-studio, slug profit-and-loss, inputs {"company_file": "<company file id>"}, title '<report name> — <client> — <today's date>'. Then tell me it's ready, with the report's link. If the tool returns an error, tell me the error word for word."
6. Read back what the tool scheduled: the report, the client, when, and the next run.

Each run saves a new copy of the report (the workspace keeps no versions of a report). To change or stop it: `schedule_task_list`, then `schedule_task_update` or `schedule_task_delete`.

Never put passwords, bank details, tax file numbers or anyone's pay in the instruction. Schedule a payroll report only for the payroll officer, at the Summary detail level unless they ask for Detail.

Example: "Send me the aged receivables every Friday at 4pm" → slug `unpaid-invoices`, weekly, weekday 5, 16:00 → `schedule_task_create` → "Scheduled: MYOB Aged Receivables, every Friday at 16:00; the next run is on <date>."
