import { z } from "zod";
import { Invoice, LineAmountTypes } from "xero-node";
export const createInvoiceInput = z.object({
    contact_id: z
        .string()
        .min(1)
        .describe("Xero contact id (GUID) to bill."),
    line_items: z
        .array(z.object({
        description: z.string().min(1),
        quantity: z.number().positive(),
        unit_amount: z.number().nonnegative(),
        account_code: z
            .string()
            .optional()
            .describe("Xero account code, e.g. '200'. Required by Xero when posting a real invoice."),
        tax_type: z.string().optional(),
    }))
        .min(1),
});
export async function createInvoice(client, input) {
    const api = await client.accounting();
    const invoice = {
        type: Invoice.TypeEnum.ACCREC,
        contact: { contactID: input.contact_id },
        lineItems: input.line_items.map((li) => ({
            description: li.description,
            quantity: li.quantity,
            unitAmount: li.unit_amount,
            accountCode: li.account_code,
            taxType: li.tax_type,
        })),
        status: Invoice.StatusEnum.DRAFT,
        lineAmountTypes: LineAmountTypes.Exclusive,
    };
    const payload = { invoices: [invoice] };
    const res = await api.createInvoices(client.tenantId, payload);
    const created = res.body.invoices?.[0];
    if (!created) {
        throw new Error("xero create_invoice: response contained no invoice");
    }
    return {
        invoice_id: created.invoiceID,
        invoice_number: created.invoiceNumber,
        status: created.status,
        total: created.total,
        currency_code: created.currencyCode,
    };
}
