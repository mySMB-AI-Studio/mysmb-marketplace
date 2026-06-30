---
name: servicem8-manage-jobs
description: Use this skill when the user wants to create, search, review, or update ServiceM8 jobs — listing open jobs, finding jobs for a client, creating a new job from a template, or adding notes to an existing job.
---

# Managing ServiceM8 Jobs

## When to use this skill

Load this skill whenever the user asks to:
- View, list, or review jobs in ServiceM8
- Find a specific job by client name, address, or job number
- Create a new job from a template
- Add a note or update to an existing job
- Check the current workload or job schedule

## Step-by-step guidance

### Listing jobs

Call `list_jobs` to retrieve current jobs. The response includes job number, status, client, address, and scheduled dates. Present results in a table sorted by scheduled date unless the user requests otherwise.

### Searching for a specific job or client

Call `search_clients_and_jobs` with the user's search term. This matches against client names, job addresses, and job reference numbers. If multiple results are returned, ask the user to confirm which record they want before proceeding.

### Creating a new job

1. Call `list_job_templates` to retrieve all available templates. Present the template names to the user and ask which one to use if they haven't already specified.
2. Confirm the client name, site address, and any other required details with the user before creating.
3. Call `create_job_using_template` with the confirmed template and client/site details.
4. Confirm the job was created by reporting back the new job number or identifier from the response.
5. Optionally offer to add an initial note to the job via `add_job_note`.

### Adding a note to a job

1. If the job identifier is not already known, call `search_clients_and_jobs` or `list_jobs` to locate the correct job first.
2. Confirm the note text with the user — once added, notes cannot be removed via the API.
3. Call `add_job_note` with the job identifier and the confirmed note text.
4. Confirm success to the user.

## Safety rules

- Never call `create_job_using_template` without confirming the template name, client, and site with the user first.
- Always confirm the note text before calling `add_job_note` — notes are permanent.
- When multiple jobs match a search, always clarify which one the user intends before mutating.

## Data freshness

ServiceM8 data is live — results reflect the current state of the account at the time of the call. There is no caching layer.
