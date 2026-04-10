import { z } from "zod";
export const getContactInput = z.object({
    contact_id: z
        .string()
        .min(1)
        .describe("Xero contact id (GUID) to fetch."),
});
export async function getContact(client, input) {
    const api = await client.accounting();
    const res = await api.getContact(client.tenantId, input.contact_id);
    const contact = res.body.contacts?.[0];
    if (!contact) {
        return { contact: null };
    }
    return {
        contact: {
            contact_id: contact.contactID,
            name: contact.name,
            email: contact.emailAddress,
            first_name: contact.firstName,
            last_name: contact.lastName,
            is_customer: contact.isCustomer,
            is_supplier: contact.isSupplier,
            default_currency: contact.defaultCurrency,
            updated_date_utc: contact.updatedDateUTC,
        },
    };
}
