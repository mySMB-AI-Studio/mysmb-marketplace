---
name: docusign-manage-workflow
description: Manage DocuSign Workflow Builder instances — trigger, monitor, pause, resume, or cancel workflows. Use when the user says "start a workflow", "trigger the approval workflow", "check workflow status", "pause new submissions", "cancel the workflow instance", or asks about DocuSign automation flows.
---

# Manage a DocuSign workflow

Use the `docusign` MCP server's Workflow Builder tools to orchestrate agreement automation.

## Steps

### Discover available workflows

Call `getWorkflowsList` to list all workflow definitions. Note the `workflowId` for the relevant workflow.

### Trigger a new instance

1. Call `getWorkflowTriggerRequirements` with the `workflowId` to fetch the required input schema.
2. Confirm with the user that all required inputs are available.
3. Call `triggerWorkflow` with the `workflowId` and the trigger data matching the schema.
4. Report the returned `instanceId` — the user will need this to track the instance.

### Monitor a running instance

Call `getWorkflowInstance` with `workflowId` and `instanceId`. Report:
- Current `status`
- Active step / stage name
- Any pending actions or blockers

To see all instances for a workflow, call `getWorkflowInstancesList`.

### Cancel an instance

Call `cancelWorkflowInstance` only when the user explicitly confirms. This is irreversible.

### Pause / resume a workflow

- `pauseNewWorkflowInstances` — stops new instances from being created for this workflow definition (existing instances continue). Use when the user wants to freeze intake.
- `resumeWorkflow` — re-enables new instance creation. Confirm the workflow ID before calling.

## Rules

- Always call `getWorkflowTriggerRequirements` before `triggerWorkflow` — never guess the input shape.
- Never call `cancelWorkflowInstance` without explicit user confirmation.
- `pauseNewWorkflowInstances` affects the entire workflow definition, not just one instance — warn the user of the scope.
- If a tool returns a 4xx error, surface the message verbatim and do not retry.
