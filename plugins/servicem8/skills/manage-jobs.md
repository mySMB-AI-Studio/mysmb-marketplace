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

Call `list_jobs` to retrieve current jobs. The response is a wrapped, paginated object — `{ jobs: [...], next_cursor }`, not a bare array — read from `jobs`. Each job includes `generated_job_id`, `status` (`Quote`/`Work Order`/`Unsuccessful`/`Completed`), `job_address`, `job_description`, `date`, `active`, and `company_uuid` (a foreign-key id, **not** a resolved client name — there is no tool to look up the name behind it). Present results in a table sorted by scheduled date unless the user requests otherwise, and do not include a client-name column since the data isn't available. If `next_cursor` is non-null and the user wants more, call again passing it as `cursor`.

### Searching for a specific job or client

Call `search_clients_and_jobs` with the user's search term. This hits ServiceM8's combined search endpoint — it matches against jobs, companies (clients), and materials together, with no way to filter to one object type. If multiple results are returned, ask the user to confirm which record they want before proceeding.

### Creating a new job

1. Call `list_job_templates` to retrieve all available templates. Present the template names to the user and ask which one to use if they haven't already specified.
2. Confirm the client (`company_uuid` if known, or `company_name` to create/match by name — provide exactly one, never both), site address, and any other required details with the user before creating.
3. Call `create_job_using_template` with the confirmed template and client/site details.
4. Confirm the job was created by reporting back whatever identifier came back in the response (`uuid`). Note: this endpoint's exact response shape has a documented uncertainty in the connector (ServiceM8's own docs disagree on whether the new job's id comes back in a header or a JSON body) — report what you actually got rather than assuming a fixed shape.
5. Optionally offer to add an initial note to the job via `add_job_note`.

### Adding a note to a job

1. If the job identifier is not already known, call `search_clients_and_jobs` or `list_jobs` to locate the correct job first.
2. Confirm the note text with the user — once added, notes cannot be removed via the API.
3. Call `add_job_note` with the job identifier (`job_uuid`) and the confirmed note text (`note`). These field names are an educated guess by the connector, not confirmed against a published ServiceM8 reference — if the call fails unexpectedly, flag that this may be the cause rather than assuming user error.
4. Confirm success to the user.

## Safety rules

- Never call `create_job_using_template` without confirming the template name, client, and site with the user first.
- Always confirm the note text before calling `add_job_note` — notes are permanent.
- When multiple jobs match a search, always clarify which one the user intends before mutating.

## Data freshness

ServiceM8 data is live — results reflect the current state of the account at the time of the call. There is no caching layer.
