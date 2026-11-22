# Xero Bookkeeper

A business agent that runs accounts payable and receivable bookkeeping across one or many client Xero organisations. It files emailed and dropped supplier bills, reads and codes them, runs duplicate, ABN and rate checks, and raises every posting as a reviewer decision; it drafts requested sales invoices, reconciles supplier statements and runs nightly and weekly ledger checks with findings owned by a named person. Nothing is authorised in Xero or emailed to a client without a recorded decision. Setup is connections only: connect Xero (and optionally a mailbox); people are named at activation and clients are onboarded one by one through the agent.

Packaged from a MyHub workspace via the /developer Plugins page.

## What's in the box

- **Setup:** Xero Bookkeeper setup (each person reviews their configuration and account bindings)
- **Processes:** Client onboarding (Xero), Ledger checks (Xero), Requested sales invoice (Xero), Supplier bill intake (Xero), Supplier statement check (Xero)
- **Capabilities:** Approve a bill in Xero, Attach the source document to a Xero bill or invoice, Create a draft bill in Xero, Create a draft sales invoice in Xero, Create a Xero contact, Find Xero contacts, Read the chart of accounts and tax rates, Read the connected Xero organisation, Read the intake mailbox, Read Xero bills and sales invoices, Send a reviewed email to a client
- **Evaluations:** Bill intake: controls, Invoice request: controls
- **MCP servers:** xero-accounting, m365-mail-read, m365-mail-send
- **Skills:** 4
- **Agents:** 1

## Configuration

No configuration variables are required.
