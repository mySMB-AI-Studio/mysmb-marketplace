---
name: docusign-agreements
description: View and search agreements across DocuSign products using Agreement Manager. Use when the user asks "show me all agreements", "find the NDA", "what agreements are active?", "get agreement details", "list my contracts", or wants a cross-product view of DocuSign agreements.
---

# Browse DocuSign agreements

Use the `docusign` MCP server's Agreement Manager tools to view agreements across all DocuSign products from a single place.

## Steps

### List all agreements

Call `getAllAgreements`. This returns agreements across eSignature, CLM, and other DocuSign products in a unified view.

Present results as a summary table with:
- Agreement name / subject
- Type (eSignature envelope, CLM contract, etc.)
- Status
- Creation / last modified date
- Parties involved

Offer to filter by status or date if the list is long.

### Get agreement details

1. Identify the `agreementId` from the list, or ask the user to provide it.
2. Call `getAgreementDetails` with the `agreementId`.
3. Report full details: parties, status history, document list, and any workflow steps.

## Rules

- `getAllAgreements` may return a large result set — summarise counts by status before listing individual items.
- Do not call `getAgreementDetails` for every item in the list unprompted — retrieve details only when the user asks about a specific agreement.
- If no agreements are returned, tell the user their account may not have Agreement Manager enabled or there are no agreements in the selected scope.
- If any tool returns a 4xx/5xx error, surface the error message verbatim — do not retry silently.
