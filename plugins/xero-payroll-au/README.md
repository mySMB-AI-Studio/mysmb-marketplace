# Xero Payroll AU

Access Xero Payroll (Australia) via the myHub-hosted OAuth MCP gateway. Manage employees, pay runs, leave applications, superannuation, and timesheets.

**Restriction:** the connected Xero organisation must be based in Australia. Payroll data is not available for other regions via this API.

## Configuration

No environment variables required. Browser OAuth — click Connect in MyHub to sign in and pick an AU Xero org.

The Fortnightly Payroll tile also uses the Xero Accounting connection (`xero-accounting`) to follow the organisation picked in the Xero connector dock.

Scopes requested:
```
offline_access openid profile email
payroll.employees payroll.timesheets payroll.payruns payroll.payslip payroll.settings
```

### Payroll automations (connector requirements)

All automations below install as drafts; an admin reviews the scopes and publishes each one.

**Payroll: Email intake (Outlook)** needs the `m365-mail-read` connector (Microsoft 365 extension) connected by the automation's owner.

**Rate Step-up & Birthday Reminders** needs the `m365-mail-send` connector (Microsoft 365 extension) connected by the automation's owner, to send its reminder emails. Its recipient email address ships with a placeholder (`payroll-admin@example.com`) — edit the automation's `reminder_email` param after installing to point it at your real payroll/HR admin.

**Payroll: Cut-off reminders & SLA timers** needs the `m365-mail-send` connector (Microsoft 365 extension, admin consent) connected by the automation's owner, to save reminder and follow-up drafts in the owner's Outlook Drafts. It never sends email. It reads what the email intake has filed, so publish **Payroll: Email intake (Outlook)** too.

**Corrections Workflow: Propose** and **Corrections Workflow: Execute** need no connector beyond `xero-payroll-au` itself (Propose) — Execute reads/writes WorkQ only. Both must be published for the pair to work: Propose opens the correction item, Execute fires when someone marks it Done.

Settings for the email intake automation live in organisation Knowledge:

- `Payroll/clients.json` (required): the payroll clients and where their emails come from. Until it exists, the automation reads no mail and opens one "Set up payroll email intake" WorkQ item.
  ```json
  {
    "clients": [
      { "name": "Acme Plumbing", "senders": ["@acme.com.au", "boss@gmail.com"], "other_names": ["Acme"], "assignee_email": "processor@yourpractice.com.au" }
    ]
  }
  ```
- `Payroll/settings.json` (optional): `owner_email` (who gets emails that need a person), `folders` (Outlook folders to read besides the Inbox), `timezone` (default `Australia/Sydney`).
- `Payroll/Mail/outlook.json` is written by the automation (where it has read up to, and the pay run items it opened). Don't edit it.

Settings for the cut-off reminders & SLA timers automation are an optional `"timers"` list on each client in `Payroll/clients.json`:

```json
{ "name": "Acme Plumbing", "senders": ["@acme.com.au"], "assignee_email": "processor@yourpractice.com.au",
  "timezone": "Australia/Perth",
  "timers": [
    { "name": "Timesheets", "every": "week", "day": "Mon", "remind_at": "07:30", "due": "08:00", "cutoff": "11:00",
      "contacts": ["boss@acme.com.au"] },
    { "name": "Manager approvals", "every": "fortnight", "first_date": "2026-11-04", "day": "Wed", "due": "10:30",
      "cutoff": "11:00", "done_when": "workq" }
  ] }
```

- `every`: `week`, `fortnight` (needs `first_date`, one date it falls on) or `month` (`day` is 1 to 28 or `last`). Weekly and fortnightly days are Mon to Fri.
- `due` (required), `remind_at` and `cutoff` are 24-hour times in the client's `timezone` (default: `timezone` in `Payroll/settings.json`, else `Australia/Sydney`).
- `follow_up_after` / `escalate_after`: minutes after `due` (default 30 and 60; `escalate_after: 0` turns escalation off).
- `done_when`: `email` (default) when the client's payroll email of one of `kinds` (default `["timesheets"]`; also `pay changes`, `new starter`, `leaver`, `expenses`, `approval`, `other payroll`) has been filed by the email intake since the previous due time; `workq` when someone marks the cut-off item done.
- `contacts`: who the reminder and follow-up drafts are addressed to. Without contacts, the WorkQ item says to contact them directly.
- A timer with anything unclear is switched off and listed in one "Payroll cut-off timers need fixing" WorkQ item; it's never guessed.
- `Payroll/Mail/timers.json` is written by the automation (what it has done for each due date). Don't edit it.

Settings for the Corrections Workflow pair live in organisation Knowledge:

- `Payroll/correction-policy.json` (optional): which correction policy applies by default, and per-employee overrides. Without it, every variance defaults to `next_pay_run`.
  ```json
  {
    "default_policy": "next_pay_run",
    "employee_overrides": {
      "<EmployeeID>": "unscheduled_pay_run"
    }
  }
  ```
  Valid policy values: `revert`, `next_pay_run`, `unscheduled_pay_run`.

## Tools (24)

### Employees (4)
- `list_employees`, `get_employee`, `create_employee`, `update_employee`

### Leave Applications (3)
- `list_leave_applications`, `get_leave_application`, `create_leave_application`

### Pay Items (1)
- `list_pay_items`

### Payroll Calendars (2)
- `list_payroll_calendars`, `get_payroll_calendar`

### Pay Runs (4)
- `list_pay_runs`, `get_pay_run`, `create_pay_run`, `update_pay_run`

### Payslips (1)
- `get_payslip`

### Settings (1)
- `get_payroll_settings`

### Super Funds (4)
- `list_super_funds`, `get_super_fund`, `create_super_fund`, `list_super_fund_products`

### Timesheets (4)
- `list_timesheets`, `get_timesheet`, `create_timesheet`, `update_timesheet`

## Automations (5)

- **Payroll: Email intake (Outlook)**: every 15 minutes, 6am to 8pm on weekdays (Sydney time), reads new emails in the owner's Outlook mailbox. Nothing in the mailbox is changed. It uses AI to pick out the payroll emails: timesheets ready, pay changes, new starters, leavers, expenses and approvals. Each one is filed under its client's pay run WorkQ item. If there's no open item for that pay run, it opens one; otherwise it adds the email to the open item as a comment. Emails it can't match to exactly one client become a "Payroll email needs a client" item. WorkQ text never includes TFNs, bank details, pay rates or dollar amounts, and the run history never holds email text: other emails are dropped in the step that reads them, and payroll emails appear there only as subject, sender and the one-line summary. If Outlook can't be read (for example, the Microsoft 365 sign-in has expired), it opens one "Payroll email intake can't read Outlook" item; no emails are missed, because the next good run picks up from where it stopped. Clients are matched by sender address or domain first, then by AI from the client names; it never guesses.
- **Payroll: Cut-off reminders & SLA timers**: every 5 minutes, 6am to 8pm on weekdays (Sydney time), checks each client's timers in the client's own time zone. At `remind_at` it saves a reminder email in the owner's Outlook Drafts and opens a "Payroll cut-off" WorkQ item for the client's processor. If nothing has arrived by the follow-up time it saves a follow-up draft and raises the item to High; at the escalation time it adds the payroll owner (`owner_email`); at the hard `cutoff` it notes that anything later goes into the next pay run. When the client's payroll email arrives (as filed by the email intake) or the item is marked done, it records the time and how late it was, and closes the item. Something that arrives after the cut-off is recorded on the item and left open for the processor to roll to the next pay run. If it arrives before the reminder time, no item or draft is made. Each step happens once; nothing is retried, and email is only ever drafted, never sent.
- **Rate Step-up & Birthday Reminders**: daily at 8am (Sydney time), checks every active employee for three milestones landing that day: a probation step-up (6 months after `StartDate`), a recurring review (every 6 months after that), and a junior birthday (turning 18, 19, 20 or 21, from `DateOfBirth`). None of these are fields Xero tracks natively — all three are computed from `StartDate`/`DateOfBirth` against a fixed 6-month policy. For each milestone found, creates an org-visible WorkQ reminder and sends an email; it never writes anything back to Xero, and never knows or sets an actual new pay rate.
- **Corrections Workflow: Propose**: daily at 7am (Sydney time), calls `get_hours_reconciliation` and flags every employee whose payroll hours don't match their approved timesheet. For each one, looks up that client's correction policy (`revert`, `next_pay_run`, or `unscheduled_pay_run` — from `Payroll/correction-policy.json`, defaulting to `next_pay_run`) and opens a WorkQ item with the full evidence and the policy that applies. Marking the item Done is the approval. Makes no changes to Xero — it only proposes.
- **Corrections Workflow: Execute**: event-triggered whenever a WorkQ item is marked Done; ignores anything that isn't one of Propose's own items. For a `revert`-policy item it just confirms there's nothing further it can do (Xero has no API to unpost a posted pay run — that step is always manual). For `next_pay_run`/`unscheduled_pay_run` it posts the exact hours adjustment to make, by earnings rate, as a comment — it does **not** write to Xero itself, since adjusting a specific payslip's earnings lines needs a Xero Payslip-write tool (`update_payslip`) that doesn't exist in this plugin yet. Confirms and instructs; never guesses at a write it can't safely make.

## Destructive / irreversible operations

- `update_pay_run` with `PayRunStatus=POSTED` cannot be reversed without Xero support intervention.

## See also

- [Xero Payroll AU API docs](https://developer.xero.com/documentation/api/payrollau/overview)
