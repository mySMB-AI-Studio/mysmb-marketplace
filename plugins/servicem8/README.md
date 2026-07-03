# ServiceM8

Field-service management via ServiceM8's hosted OAuth MCP server at `https://go.servicem8.com/mcp`. Manage jobs, clients, staff, and job templates directly from the MyHub workspace.

Browser OAuth — no API keys, no env vars. Each user authorises individually; the MCP server only sees data that user can already access in ServiceM8.

## Configuration

No environment variables required on the client side. On first use, the browser redirects to ServiceM8's OAuth flow — sign in, grant the requested permissions, and subsequent calls flow over the authorised session.

### Prerequisites

- An active ServiceM8 account (any plan that includes API/integration access).
- The user connecting must have sufficient permissions within their ServiceM8 account to perform the operations they intend (e.g., creating jobs, viewing staff).

## Available tools

The following six tools are exposed by ServiceM8's hosted MCP server.

### Search Clients & Jobs

Search your ServiceM8 account for clients and jobs by keyword. Use this to look up a client by name, find jobs for a specific address, or locate a job by reference number.

### List jobs

Retrieve a list of jobs from your ServiceM8 account. Returns job details including job number, status, client name, address, and scheduled dates. Useful for getting a current workload overview or finding jobs to act on.

### List staff members

Retrieve all staff members configured in your ServiceM8 account. Returns names and identifiers needed when assigning jobs or filtering by staff member.

### List Job Templates

Retrieve all job templates configured in your ServiceM8 account. Templates define default job settings (category, checklist, materials, etc.). Use this to discover available templates before creating a new job.

### Create a job using a Job Template

Create a new job in ServiceM8 from an existing job template. Requires specifying the template to use along with any client or site details for the new job. Use `list_job_templates` first to find the correct template identifier.

### Add a job Note

Append a text note to an existing job. Notes are visible to staff in the ServiceM8 mobile app and the office console. Use this to log progress updates, instructions, or client communication records against a job.

## Typical workflows

**Finding and reviewing open jobs**

1. Call `list_jobs` to retrieve the current job list.
2. Filter or sort in the workspace by status, date, or staff member.
3. Use `search_clients_and_jobs` to drill into a specific client or job reference.

**Creating a new job from a template**

1. Call `list_job_templates` to find the appropriate template name/identifier.
2. Call `create_job_using_template` with the template identifier and client/site details.
3. Optionally call `add_job_note` immediately after to attach initial instructions.

**Adding notes to an existing job**

1. Use `search_clients_and_jobs` or `list_jobs` to find the job identifier.
2. Call `add_job_note` with the job identifier and the note text.

## Destructive / mutating operations

Confirm before calling — these operations write to your ServiceM8 account:

- `create_job_using_template` — creates a live job record visible to all staff.
- `add_job_note` — permanently appends a note to the job history; notes cannot be deleted via the MCP API.

## See also

- [How to connect ServiceM8 with MCP](https://support.servicem8.com/help-center/tips-trick-more/more/how-to-connect-servicem8-to-chatgpt-with-mcp)
- [ServiceM8 API documentation](https://developer.servicem8.com/)
- [ServiceM8 Help Centre](https://support.servicem8.com/)
