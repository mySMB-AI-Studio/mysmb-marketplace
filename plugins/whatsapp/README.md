# WhatsApp Business

Message customers on WhatsApp from your Workspace, through the WhatsApp Business Platform (Meta Cloud API). The plugin fronts the myHub-hosted `/whatsapp` gateway; message storage, notifications and the chat panel live in the Workspace itself.

## Tools

| Tool | What it does |
|---|---|
| `list_phone_numbers` | Lists the WhatsApp Business numbers on the connected account (read) |
| `get_business_profile` | Reads a number's business profile: about, address, description, email, websites (read) |
| `list_templates` | Lists message templates with status, category, language and components (read) |
| `send_text` | Sends a free-text message. Only valid within 24 hours of the customer's last message. **Customer-visible** |
| `send_template` | Sends an approved template message. **Billable by Meta and customer-visible** |
| `mark_read` | Marks an inbound message as read |
| `download_media` | Downloads an inbound image, document or audio file (up to 25 MB) |

`to` must be digits only with the country code (for example `61400000999`); local `04...` numbers are rejected. Text is limited to 4096 characters. Every tool defaults to the number chosen at connect time; pass `phone_number_id` when the account has several numbers.

## Configuration

- **Connected once by a tenant admin through Meta's sign-in.** There are no API keys and no per-user setup; the connection is a shared service connection for the whole workspace.
- **Your own Meta account pays Meta's per-message fees.** Template messages outside the 24-hour window are billed by Meta to the business, not by mySMB.
- **The number must not be registered with another WhatsApp provider** unless it has been migrated to this connection first.
- **Numbers can keep the WhatsApp Business phone app** (coexistence), so staff can still reply from the phone.
- **The 24-hour rule.** Free-text messages can only be sent within 24 hours of the customer's last message. Outside that window only an approved template can be sent (billed by Meta).
- Send tools (`send_text`, `send_template`) are billable and customer-visible. They should never be called without the user's confirmation.
- If Meta revokes the token, tools return `needsReconnect` and an admin must reconnect.

## Skills

- `whatsapp-messaging` - the 24-hour rule, template selection, confirm-before-send, and never retrying an uncertain send.

## Widgets

None in v1.
