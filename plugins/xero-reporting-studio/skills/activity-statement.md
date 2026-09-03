# Activity Statement (BAS)

Ask for the statement period and relevant GST/PAYG basis. Use available Xero accounting data; if BAS fields are not exposed, request the Xero Activity Statement/GST exports required for G1, G2, G3, G10, G11, 1A, 1B, W1W4, and PAYG instalments.

Render statement status/context, GST, PAYG withholding, PAYG instalment, and net amount sections. Do not infer tax fields.

Validate net GST = 1A  1B, withholding relationships where applicable, and statement totals against the GST account movement for the same period. State that this is a reporting reproduction, not tax advice.
## Interactivity

Declare a `period` enum input (statement periods the tool supports). Basis follows the statement rules — do not expose it as a control. All tables sortable client-side.
