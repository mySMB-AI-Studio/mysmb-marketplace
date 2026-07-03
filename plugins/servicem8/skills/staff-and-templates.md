---
name: servicem8-staff-and-templates
description: Use this skill when the user wants to view ServiceM8 staff members or job templates — for example, to find a staff member's identifier for filtering or to browse available job templates before creating a job.
---

# Staff Members and Job Templates

## When to use this skill

Load this skill when the user asks to:
- List all staff members in their ServiceM8 account
- Find a specific staff member by name
- Browse available job templates
- Identify the correct template name/identifier before creating a job

## Staff members

Call `list_staff_members` to retrieve all staff configured in the account. The response includes staff names and their identifiers. This is useful for:
- Confirming a staff member's identifier when filtering jobs by assignee
- Verifying who is available or active in the account
- Providing a staff picker when the user wants to assign a new job

Present staff as a list with name and identifier.

## Job templates

Call `list_job_templates` to retrieve all templates. Templates define default settings for a job (category, checklist items, materials, pricing). This call is a prerequisite to `create_job_using_template`.

Present templates as a list with template name and any description available. Ask the user to confirm the desired template before passing it to a job-creation call.

## Error handling

If `list_staff_members` or `list_job_templates` returns an error or an empty result:
- Inform the user that the call failed and suggest they check their ServiceM8 connection (Settings → Connections → ServiceM8).
- Do not proceed to job creation if `list_job_templates` fails — a valid template name is required.

## Combining with job creation

The standard pattern when the user says "create a job" is:

1. Call `list_job_templates` → present options to the user.
2. User picks a template.
3. (Optional) Call `list_staff_members` if the user wants to pre-assign staff.
4. Proceed to the job-creation steps in the `servicem8-manage-jobs` skill.
