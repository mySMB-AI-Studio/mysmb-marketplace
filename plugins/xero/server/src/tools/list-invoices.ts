import { z } from "zod";
import { XeroApiClient } from "../client.js";

export const listInvoicesInput = z.object({
  status: z
    .enum(["DRAFT", "SUBMITTED", "AUTHORISED", "PAID", "VOIDED", "DELETED"])
    .optional()
    .describe("Filter by Xero invoice status. Omit to return all statuses."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Maximum number of invoices to return. Defaults to 25."),
});

export type ListInvoicesInput = z.infer<typeof listInvoicesInput>;

export async function listInvoices(
  client: XeroApiClient,
  input: ListInvoicesInput,
) {
  const limit = input.limit ?? 25;
  const api = await client.accounting();

  // TODO(xero): double-check the exact where-clause syntax the xero-node
  // SDK expects for status filtering; the API accepts e.g. Status=="PAID"
  // but the SDK may take it via a dedicated argument.
  const where = input.status ? `Status=="${input.status}"` : undefined;

  const res = await api.getInvoices(
    client.tenantId,
    undefined, // ifModifiedSince
    where,
    "UpdatedDateUTC DESC", // order
    undefined, // iDs
    undefined, // invoiceNumbers
    undefined, // contactIDs
    undefined, // statuses
    1, // page
    undefined, // includeArchived
    undefined, // createdByMyApp
    undefined, // unitdp
    undefined, // summaryOnly
    limit, // pageSize
  );

  const invoices = (res.body.invoices ?? []).slice(0, limit).map((inv) => ({
    invoice_id: inv.invoiceID,
    invoice_number: inv.invoiceNumber,
    status: inv.status,
    contact: inv.contact
      ? { contact_id: inv.contact.contactID, name: inv.contact.name }
      : null,
    date: inv.date,
    due_date: inv.dueDate,
    total: inv.total,
    amount_due: inv.amountDue,
    amount_paid: inv.amountPaid,
    currency_code: inv.currencyCode,
  }));

  return { count: invoices.length, invoices };
}
