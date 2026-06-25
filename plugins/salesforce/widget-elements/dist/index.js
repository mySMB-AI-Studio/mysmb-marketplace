/**
 * Map a Salesforce Opportunity Probability (0–100) to a semantic tone.
 * >= 70 → "success", >= 40 → "accent", < 40 → "warning".
 *
 * Args: { value: number }
 *
 * Spec example:
 *   { "$computed": "salesforce_probability_tone", "args": { "value": { "$item": "Probability" } } }
 */
const probability_tone = (args) => {
    const v = Number(args.value ?? 0);
    if (v >= 70)
        return 'success';
    if (v >= 40)
        return 'accent';
    return 'warning';
};
/**
 * Map a Salesforce Account Type string to a semantic tone.
 * "Customer" → "success", "Partner" → "info", anything else → "warning".
 *
 * Args: { value: string }
 *
 * Spec example:
 *   { "$computed": "salesforce_account_type_tone", "args": { "value": { "$item": "Type" } } }
 */
const account_type_tone = (args) => {
    const v = String(args.value ?? '');
    if (v === 'Customer')
        return 'success';
    if (v === 'Partner')
        return 'info';
    return 'warning';
};
const elements = {
    slug: 'salesforce',
    functions: { probability_tone, account_type_tone },
};
export default elements;
