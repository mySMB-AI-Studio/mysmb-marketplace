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
// ── sort_by_key ───────────────────────────────────────────────────────────
// Sort an array of objects by a composite key string "field|asc" or "field|desc".
// Args: { value: unknown[], key: string }
// Returns: sorted array
const sort_by_key = (args) => {
    const arr = Array.isArray(args.value) ? [...args.value] : [];
    const keyStr = String(args.key ?? 'name|asc');
    const [field, dir] = keyStr.split('|');
    return arr.sort((a, b) => {
        const aVal = String(a[field] ?? '').toLowerCase();
        const bVal = String(b[field] ?? '').toLowerCase();
        const cmp = aVal.localeCompare(bVal);
        return dir === 'desc' ? -cmp : cmp;
    });
};
// ── cycle_sort ────────────────────────────────────────────────────────────
// Toggle sort direction between name|asc and name|desc.
// Args: { current: string }
// Returns: "name|asc" | "name|desc"
const cycle_sort = (args) => {
    return String(args.current ?? '') === 'name|asc' ? 'name|desc' : 'name|asc';
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
// ── build_customer_url ────────────────────────────────────────────────────────
// Build a Stripe Dashboard URL for a customer. Uses platform→connected URL when
// both account IDs are present; falls back to simple URL otherwise.
// Args: { customer_id: string, livemode: boolean, platform_id: string, connected_id: string }
// Returns: string URL
const build_customer_url = (args) => {
    const customerId = String(args.customer_id ?? '');
    const livemode = Boolean(args.livemode);
    const platformId = String(args.platform_id ?? '');
    const connectedId = String(args.connected_id ?? '');
    const mode = livemode ? '' : '/test';
    if (platformId && connectedId) {
        return `https://dashboard.stripe.com/${platformId}${mode}/connect/accounts/${connectedId}/customers/${customerId}`;
    }
    return `https://dashboard.stripe.com${mode}/customers/${customerId}`;
};
const elements = {
    slug: 'stripe',
    functions: {
        format_currency,
        sort_by_key,
        cycle_sort,
        subscription_status_tone,
        invoice_status_tone,
        payment_intent_status_tone,
        format_stripe_date,
        build_customer_url,
    },
};
export default elements;
