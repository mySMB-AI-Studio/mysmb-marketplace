# Invoice Nudge (E2E test)

A small test agent that chases overdue Xero invoices and follows up on payment promises. Built to exercise every AI Studio component kind end to end: authoring, push, install and use.

Packaged from a MyHub workspace via the /developer Plugins page.

## What's in the box

- **Automations:** Check Xero invoice paid (installed as Draft — publish in the installing workspace)
- **Activity templates:** Call client about a missed promise
- **Form templates:** Payment promise request
- **Forms:** Payment promise
- **Custom tables:** Payment promises (review and publish during extension setup)
- **Setup:** Invoice Nudge setup (each person reviews their configuration and account bindings)
- **Pages:** Invoice Nudge (installed as Draft — publish in the installing workspace)
- **Processes:** Chase overdue invoices, Follow up a payment promise
- **Capabilities:** Add a note to a Xero invoice, Email an invoice reminder from Xero, List overdue Xero invoices, Send a reviewed email to a client
- **Evaluations:** Chase overdue invoices: release gate, Follow up a payment promise: release gate
- **Agent views:** Overview, Setup
- **Widgets:** Invoices to nudge
- **Reports:** Overdue invoice chase (templates — "Use this report" copies one into the workspace)
- **MCP servers:** xero-accounting, m365-mail-send
- **Skills:** 1
- **Agents:** 1

## Configuration

No configuration variables are required.
