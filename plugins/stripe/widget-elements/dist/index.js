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
    const current = String(args.current ?? '');
    const [field, dir] = current.split('|');
    return `${field}|${dir === 'asc' ? 'desc' : 'asc'}`;
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
// ── flatten_invoices ──────────────────────────────────────────────────────────
// Sort and pre-format raw Stripe invoice objects into display-ready table rows.
// Pre-formats amount via format_currency and due_date via format_stripe_date so
// the Table component receives plain strings and needs no column formatters.
// Args: { value: raw invoice array, key: sort key e.g. "customer_name|asc" }
// Returns: display row array
const flatten_invoices = (args) => {
    const raw = Array.isArray(args.value)
        ? [...args.value]
        : [];
    const keyStr = String(args.key ?? 'customer_name|asc');
    const [field, dir] = keyStr.split('|');
    raw.sort((a, b) => {
        const aVal = String(a[field] ?? '').toLowerCase();
        const bVal = String(b[field] ?? '').toLowerCase();
        const cmp = aVal.localeCompare(bVal);
        return dir === 'desc' ? -cmp : cmp;
    });
    return raw.map(item => ({
        customer_name: String(item.customer_name ?? ''),
        number: String(item.number ?? ''),
        amount: format_currency({ amount: item.amount_due, currency: 'aud' }),
        due_date: format_stripe_date({ value: item.due_date }),
        status: String(item.status ?? ''),
        hosted_invoice_url: String(item.hosted_invoice_url ?? ''),
    }));
};
// ── to_monthly_cents ─────────────────────────────────────────────────────────
// Internal helper: convert a single subscription line-item to its monthly
// equivalent in cents, accounting for interval and quantity.
function toMonthlyCents(item) {
    const price = item.price ?? {};
    const unitAmount = typeof price.unit_amount === 'number' ? price.unit_amount : 0;
    const quantity = typeof item.quantity === 'number' ? item.quantity : 1;
    const recurring = price.recurring ?? {};
    const interval = String(recurring.interval ?? 'month');
    const intervalCount = typeof recurring.interval_count === 'number' ? recurring.interval_count : 1;
    switch (interval) {
        case 'year': return (unitAmount * quantity) / (12 * intervalCount);
        case 'week': return (unitAmount * quantity * 52) / (12 * intervalCount);
        case 'day': return (unitAmount * quantity * 365) / (12 * intervalCount);
        default: return (unitAmount * quantity) / intervalCount; // month
    }
}
// ── calc_mrr ──────────────────────────────────────────────────────────────────
// Sum normalized monthly revenue across all active subscriptions and return a
// formatted AUD currency string.
// Args: { value: raw subscription array (expanded items + price) }
// Returns: string e.g. "A$198.00"
const calc_mrr = (args) => {
    const subs = Array.isArray(args.value) ? args.value : [];
    let totalCents = 0;
    for (const sub of subs) {
        const items = sub.items?.data ?? [];
        for (const item of items)
            totalCents += toMonthlyCents(item);
    }
    return format_currency({ amount: totalCents, currency: 'aud' });
};
// ── flatten_subscriptions ─────────────────────────────────────────────────────
// Pre-process raw expanded Stripe subscription objects into display-ready rows.
// Resolves expanded customer/product objects to plain strings.
// Args: { value: raw subscription array }
// Returns: display row array
const flatten_subscriptions = (args) => {
    const subs = Array.isArray(args.value) ? args.value : [];
    return subs.map(sub => {
        const customer = sub.customer;
        let customerName = '';
        if (customer && typeof customer === 'object') {
            const c = customer;
            customerName = String(c.name ?? c.email ?? '');
        }
        else {
            customerName = String(customer ?? '');
        }
        const items = sub.items?.data ?? [];
        let planName = '';
        if (items.length > 0) {
            const price = items[0].price ?? {};
            const product = price.product ?? {};
            planName = String(product.name ?? price.nickname ?? price.id ?? '');
        }
        let subCents = 0;
        for (const item of items)
            subCents += toMonthlyCents(item);
        return {
            id: String(sub.id ?? ''),
            customer_name: customerName,
            plan_name: planName,
            amount: format_currency({ amount: subCents, currency: 'aud' }),
            current_period_end: typeof sub.current_period_end === 'number' ? sub.current_period_end : 0,
        };
    });
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
        flatten_invoices,
        calc_mrr,
        flatten_subscriptions,
    },
};
export default elements;
