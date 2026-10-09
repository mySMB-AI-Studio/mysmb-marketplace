/**
 * reckon-accounting — widget-elements module
 * ──────────────────────────────────────────────────────────────────
 * Connector-specific `$computed` helpers contributed to the host's
 * widgets-system at runtime. The host prepends the slug
 * `reckon-accounting_` to every name in `functions`, so e.g. the spec-side
 * reference is `reckon-accounting_company_name`.
 *
 * Reckon's public API docs (developer.reckon.com / help.reckon.com) confirm
 * the endpoint list and OAuth flow, but not the exact JSON field names each
 * endpoint returns. Both functions below parse defensively — trying several
 * plausible key spellings — rather than assuming one, and are written to
 * degrade to an empty/zero result instead of throwing when the shape
 * doesn't match what was guessed. Tighten these once a real cashbook's
 * responses have been inspected.
 */
// ── company_name ──────────────────────────────────────────────────────
// Extracts a display name from a GET /company response, trying the common
// REST spellings a company/profile resource tends to use.
// Args: { value: object }
const company_name = (args) => {
    const r = args.value;
    if (!r || typeof r !== 'object')
        return '';
    const candidates = [
        r.name, r.companyName, r.businessName, r.tradingName,
        r.Name, r.CompanyName, r.BusinessName, r.TradingName,
    ];
    const hit = candidates.find((v) => typeof v === 'string' && v.length > 0);
    return typeof hit === 'string' ? hit : '';
};
// ── account_summary ────────────────────────────────────────────────────
// Summarizes a GET /accounts response into a guaranteed-shape object so the
// widget spec never has to bind directly to an unconfirmed raw field name.
// Handles the response arriving as a bare array or wrapped under a common
// list-container key (accounts / items / data).
// Returns { totalAccounts: number, byType: [{ type: string, count: number }] }
// (byType sorted by count desc; entries with no recognizable type key are
// grouped under "Other")
// Args: { value: object | array }
const account_summary = (args) => {
    const raw = args.value;
    const list = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.accounts)
            ? raw.accounts
            : Array.isArray(raw?.items)
                ? raw.items
                : Array.isArray(raw?.data)
                    ? raw.data
                    : [];
    const counts = new Map();
    for (const account of list) {
        const type = account.type ?? account.accountType ?? account.Type ?? account.AccountType ?? account.classification;
        const key = typeof type === 'string' && type.length > 0 ? type : 'Other';
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const byType = Array.from(counts.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count);
    return { totalAccounts: list.length, byType };
};
// ── days_ago ─────────────────────────────────────────────────────────
// Today (local midnight), shifted by `days` days — a real resolved ISO
// instant usable as a `filter_date_range` start/end boundary. Negative
// `days` shifts into the future (e.g. -3650 for "no practical upper
// bound"). Needed because the system's `$days_ago_30`-style magic tokens
// only resolve inside tool-call params (list_invoices' own dataProvider
// params, an action's params), never inside a $computed expression
// evaluated client-side — there is no other way to get a real "N days
// from today" date boundary for aging-bucket math.
// Args: { days: number }
const days_ago = (args) => {
    const n = Number(args.days);
    const days = Number.isFinite(n) ? n : 0;
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - days);
    return d.toISOString();
};
const elements = {
    slug: 'reckon-accounting',
    functions: { company_name, account_summary, days_ago },
};
export default elements;
