/**
 * Map a HubSpot ticket's `hs_ticket_priority` value to a semantic badge tone.
 * "HIGH" → "destructive", "MEDIUM" → "warning", "LOW" (or anything else) → "neutral".
 *
 * Args: { value: string }
 *
 * Spec example:
 *   { "$computed": "hubspot_ticket_priority_tone", "args": { "value": { "$item": "properties/hs_ticket_priority" } } }
 */
const ticket_priority_tone = (args) => {
    const v = String(args.value ?? '').toUpperCase();
    if (v === 'HIGH' || v === 'URGENT')
        return 'destructive';
    if (v === 'MEDIUM')
        return 'warning';
    return 'neutral';
};
const elements = {
    slug: 'hubspot',
    functions: { ticket_priority_tone },
};
export default elements;
