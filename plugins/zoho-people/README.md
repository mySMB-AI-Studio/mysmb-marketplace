# Zoho People

Zoho People HRIS access via the myHub-hosted OAuth MCP gateway. Browser OAuth — no env vars.

Per-user datacenter routing across `people.zoho.<tld>`.

**~40 tools** covering employees, departments, leave, attendance, timesheets, files, approvals, and a generic forms CRUD pair.

## Configuration

No environment variables required on the client side. First use redirects to `accounts.zoho.<tld>/oauth/v2/auth`.

Scopes requested:

```
ZohoPeople.employee.ALL ZohoPeople.leave.ALL ZohoPeople.attendance.ALL
ZohoPeople.forms.ALL ZohoPeople.files.ALL ZohoPeople.timetracker.ALL
AaaServer.profile.READ
```

## Tool categories

### Forms (generic CRUD) (5)
- `get_form_records`, `get_form_record_by_id`, `insert_form_record`, `update_form_record`, `delete_form_record`

### Forms metadata (2)
- `list_forms`, `form_components`

### Employees (3)
- `fetch_employee`, `employees_by_department`, `my_employee_record`

### Org structure (3)
- `list_departments`, `list_designations`, `list_locations`

### Leave (7)
- `get_leave_types`, `get_leave_balance`, `get_holidays`, `apply_leave`, `cancel_leave`, `approve_or_reject_leave`, `list_leave_records`

### Attendance (6)
- `attendance_check_in`, `attendance_check_out`, `user_attendance_report`, `bulk_attendance_report`, `attendance_shift_details`, `add_attendance_entry`

### Timetracker (11)
- `list_jobs`, `get_job`, `add_job`, `update_job`, `list_projects`, `get_project`, `add_project`, `list_timesheets`, `add_timesheet_entry`, `update_timesheet`, `delete_timesheet`

### Files (3)
- `upload_file` (base64), `download_file`, `upload_profile_photo`

### Approvals (2)
- `list_approvals`, `approval_action`

### Passthrough (2)
- `passthrough_get`, `passthrough_post` — escape hatch for any `/people/api` endpoint not covered above.

## Destructive operations

- `delete_form_record`, `delete_timesheet` — irreversible
- `cancel_leave` — cannot be undone in-place; resubmit if cancelled by mistake
- `approval_action` (status=`rejected`) — workflow-dependent reversibility
- `add_attendance_entry` — manual override, audit-logged

## See also

- [Zoho People REST API](https://www.zoho.com/people/api/)
- [Zoho People Forms reference](https://www.zoho.com/people/api/forms.html)
