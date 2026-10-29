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

Both automations below install as drafts; an admin reviews the scopes and publishes each one.

**Payroll: Email intake (Outlook)** needs the `m365-mail-read` connector (Microsoft 365 extension) connected by the automation's owner.

**Rate Step-up & Birthday Reminders** needs the `m365-mail-send` connector (Microsoft 365 extension) connected by the automation's owner, to send its reminder emails. Its recipient email address ships with a placeholder (`payroll-admin@example.com`) — edit the automation's `reminder_email` param after installing to point it at your real payroll/HR admin.

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

## Automations (2)

- **Payroll: Email intake (Outlook)**: every 15 minutes, 6am to 8pm on weekdays (Sydney time), reads new emails in the owner's Outlook mailbox. Nothing in the mailbox is changed. It uses AI to pick out the payroll emails: timesheets ready, pay changes, new starters, leavers, expenses and approvals. Each one is filed under its client's pay run WorkQ item. If there's no open item for that pay run, it opens one; otherwise it adds the email to the open item as a comment. Emails it can't match to exactly one client become a "Payroll email needs a client" item. WorkQ text never includes TFNs, bank details, pay rates or dollar amounts, and the run history never holds email text: other emails are dropped in the step that reads them, and payroll emails appear there only as subject, sender and the one-line summary. If Outlook can't be read (for example, the Microsoft 365 sign-in has expired), it opens one "Payroll email intake can't read Outlook" item; no emails are missed, because the next good run picks up from where it stopped. Clients are matched by sender address or domain first, then by AI from the client names; it never guesses.
- **Rate Step-up & Birthday Reminders**: daily at 8am (Sydney time), checks every active employee for three milestones landing that day: a probation step-up (6 months after `StartDate`), a recurring review (every 6 months after that), and a junior birthday (turning 18, 19, 20 or 21, from `DateOfBirth`). None of these are fields Xero tracks natively — all three are computed from `StartDate`/`DateOfBirth` against a fixed 6-month policy. For each milestone found, creates an org-visible WorkQ reminder and sends an email; it never writes anything back to Xero, and never knows or sets an actual new pay rate.

## Destructive / irreversible operations

- `update_pay_run` with `PayRunStatus=POSTED` cannot be reversed without Xero support intervention.

## See also

- [Xero Payroll AU API docs](https://developer.xero.com/documentation/api/payrollau/overview)
