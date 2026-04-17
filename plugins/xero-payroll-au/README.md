# Xero Payroll AU

Access Xero Payroll (Australia) via the myHub-hosted OAuth MCP gateway. Manage employees, pay runs, leave applications, superannuation, and timesheets.

**Restriction:** the connected Xero organisation must be based in Australia. Payroll data is not available for other regions via this API.

## Configuration

No environment variables required. Browser OAuth — click Connect in MyHub to sign in and pick an AU Xero org.

Scopes requested:
```
offline_access openid profile email
payroll.employees payroll.timesheets payroll.payruns payroll.payslip payroll.settings
```

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

## Destructive / irreversible operations

- `update_pay_run` with `PayRunStatus=POSTED` cannot be reversed without Xero support intervention.

## See also

- [Xero Payroll AU API docs](https://developer.xero.com/documentation/api/payrollau/overview)
