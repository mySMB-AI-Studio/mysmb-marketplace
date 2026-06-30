/**
 * stripe — widget-elements module
 * ──────────────────────────────────────────────────────────────────────────
 * Connector-specific `$computed` helpers contributed to the host's
 * widgets-system at runtime. The host prepends the slug `stripe_` to every
 * name in `functions`, so the spec-side reference is e.g.
 * `stripe_format_currency`.
 *
 * No external imports — only the local types contract.
 */
// ── format_currency ───────────────────────────────────────────────────────
// Stripe stores amounts in the smallest currency unit (cents for USD/AUD/EUR,
// pence for GBP, etc.). This divides by 100 and formats as a human-readable
// currency string.
//
// Args: { amount: number, currency: string }
// Returns: string e.g. "$1,234.56"
const format_currency = (args) => {
    const raw = args.amount;
    const currency = String(args.currency ?? 'usd').toUpperCase();
    // Zero-decimal currencies (Stripe's official list).
    const zeroDecimal = new Set([
        'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG',
        'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
    ]);
    const amount = typeof raw === 'number' ? raw : Number(raw ?? 0);
    if (!Number.isFinite(amount))
        return '';
    const value = zeroDecimal.has(currency) ? amount : amount / 100;
    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency,
            minimumFractionDigits: zeroDecimal.has(currency) ? 0 : 2,
            maximumFractionDigits: zeroDecimal.has(currency) ? 0 : 2,
        }).format(value);
    }
    catch {
        // Fallback for unknown currency codes
        const formatted = value.toFixed(zeroDecimal.has(currency) ? 0 : 2);
        return `${currency} ${formatted}`;
    }
};
// ── subscription_status_tone ──────────────────────────────────────────────
// Map Stripe subscription status strings to semantic tone palette.
// Args: { status: string }
// Returns: 'success' | 'info' | 'warning' | 'destructive' | 'muted'
const subscription_status_tone = (args) => {
    const s = String(args.status ?? '').toLowerCase();
    if (s === 'active')
        return 'success';
    if (s === 'trialing')
        return 'info';
    if (s === 'past_due')
        return 'warning';
    if (s === 'canceled' || s === 'unpaid')
        return 'destructive';
    // incomplete, incomplete_expired, paused, etc.
    return 'muted';
};
// ── invoice_status_tone ───────────────────────────────────────────────────
// Map Stripe invoice status strings to semantic tone palette.
// Args: { status: string }
// Returns: 'success' | 'info' | 'warning' | 'destructive' | 'muted'
const invoice_status_tone = (args) => {
    const s = String(args.status ?? '').toLowerCase();
    if (s === 'paid')
        return 'success';
    if (s === 'open')
        return 'info';
    if (s === 'draft')
        return 'muted';
    if (s === 'void')
        return 'muted';
    if (s === 'uncollectible')
        return 'destructive';
    return 'muted';
};
// ── payment_intent_status_tone ────────────────────────────────────────────
// Map Stripe PaymentIntent status strings to semantic tone palette.
// Args: { status: string }
// Returns: 'success' | 'info' | 'warning' | 'destructive' | 'muted'
const payment_intent_status_tone = (args) => {
    const s = String(args.status ?? '').toLowerCase();
    if (s === 'succeeded')
        return 'success';
    if (s === 'processing')
        return 'info';
    if (s === 'requires_action' || s === 'requires_confirmation')
        return 'warning';
    if (s === 'requires_payment_method')
        return 'warning';
    if (s === 'canceled')
        return 'destructive';
    // requires_capture, etc.
    return 'muted';
};
// ── format_stripe_date ────────────────────────────────────────────────────
// Convert a Unix timestamp (seconds since epoch, as returned by Stripe) to a
// human-readable date string.
//
// Args: { value: number }
// Returns: string e.g. "15 Jun 2026"
const format_stripe_date = (args) => {
    const raw = args.value;
    if (raw == null || raw === '')
        return '';
    const ts = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(ts) || ts === 0)
        return '';
    // Stripe timestamps are seconds; JS Date expects milliseconds.
    const d = new Date(ts * 1000);
    return d.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
};
const elements = {
    slug: 'stripe',
    functions: {
        format_currency,
        subscription_status_tone,
        invoice_status_tone,
        payment_intent_status_tone,
        format_stripe_date,
    },
};
export default elements;
