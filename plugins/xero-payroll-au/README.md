# Xero Payroll AU

Access Xero Payroll (Australia) via the myHub-hosted OAuth MCP gateway. Manage employees, pay runs, leave applications, superannuation, and timesheets.

**Restriction:** the connected Xero organisation must be based in Australia. Payroll data is not available for other regions via this API.

## Configuration

No configuration variables are required.

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
