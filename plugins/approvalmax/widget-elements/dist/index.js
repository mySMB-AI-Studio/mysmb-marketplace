/**
 * approvalmax — widget-elements module
 * ──────────────────────────────────────────────────────────────────
 * Connector-specific `$computed` helpers for the "ApprovalMax — Pending
 * Approvals" tile. The host prepends the slug `approvalmax_` to every name
 * in `functions`, so e.g. the spec-side reference is
 * `approvalmax_pending_rows`.
 *
 * FIELD-NAME PROVENANCE — read before touching this file:
 * Every field read below (`requestId`, `documentNumber`, `contact`, `total`,
 * `dueDate`, `deliveryDate`, `requestStatus.name`, `externalUrl`, `companyId`,
 * ...) was confirmed against the LIVE OpenAPI document at
 * https://public-api.approvalmax.com/swagger/v1/swagger.json (fetched
 * 2026-09-30), specifically the response schemas backing:
 *   - GET /api/v1/companies                                 → PublicApiApplicationCompaniesCompany
 *   - GET /api/v1/companies/{id}/xero/bills                 → PublicApiApplicationRequestsXeroXeroBill
 *   - GET /api/v1/companies/{id}/xero/purchase-orders       → PublicApiApplicationRequestsXeroXeroPurchaseOrder
 * NOT guessed by analogy to the request-side schemas in
 * myhub-mcp-servers/src/integrations/approvalmax/api/schemas.ts.
 *
 * ONE CONFIRMED GAP, flagged rather than guessed: `requestStatus` is typed
 * in the spec as `{ name: string|null, value: string|null }` — an object,
 * not a real string enum — and neither the schema nor its parameter
 * descriptions anywhere enumerate the actual `name` strings the live API
 * returns. The vendor's own developer docs prose doesn't render concrete
 * enum values either. This module reads `requestStatus.name` and treats it
 * as free text: `pending_rows` below excludes only the 3 values it can
 * name with reasonable confidence as "decided" (approved/rejected/deleted,
 * matched case-insensitively and with punctuation/spacing stripped, e.g.
 * "On Approval" and "onApproval" both normalize the same way) and keeps
 * everything else (draft, on-approval, anything unrecognized) as
 * "pending" — see that function's own header comment for the full
 * reasoning. NOT LIVE-DATA-VERIFIED: no ApprovalMax sandbox account has
 * completed OAuth against this connector yet (per the MCP server's own
 * build report), so this filter's real-world behavior is unconfirmed
 * against a live company. Sanity-check it against a real connected account
 * before trusting the "pending" set is complete or correctly excludes
 * decided items.
 *
 * A second, platform-level gap (not this connector's fault): the
 * widgets-system `Table` component's badge `toneFormat` only resolves
 * system-registered formatter names — a plugin cannot register its own in
 * v1 (see TILE-DISPLAY-STANDARDS.md §3, "When there is no fixed enum to
 * map at all"). Since ApprovalMax's status vocabulary isn't even confirmed,
 * let alone registrable, the Status column in this tile's widget JSON is
 * plain text (Title Case via `status_label` below), not a colored badge —
 * matching that section's explicit guidance rather than shipping an
 * always-gray badge dot.
 */
// ── internal helpers (not exported as $computed) ─────────────────────
// ApprovalMax dates are plain ISO strings (`date` or `date-time` per the
// spec) — no Xero-style `/Date(...)/ ` wrapper to unwrap.
function toEpochMs(raw) {
    if (raw == null || raw === '')
        return null;
    if (typeof raw === 'number')
        return raw;
    if (typeof raw !== 'string')
        return null;
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : null;
}
function daysOverdue(raw) {
    const ms = toEpochMs(raw);
    if (ms == null)
        return null;
    const day = 24 * 60 * 60 * 1000;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(ms);
    due.setHours(0, 0, 0, 0);
    return Math.round((today.getTime() - due.getTime()) / day);
}
// "12d overdue" / "due today" / "due in 5d" / "—" (no due date at all —
// true for every Purchase Order row, since ApprovalMax's Xero PO schema
// has no `dueDate` field, only `deliveryDate` — see pending_rows below for
// why deliveryDate is NOT silently substituted here).
function dueDateLabel(raw) {
    const n = daysOverdue(raw);
    if (n == null)
        return '—';
    if (n === 0)
        return 'due today';
    if (n > 0)
        return `${n}d overdue`;
    return `due in ${-n}d`;
}
// Normalize a requestStatus.name string for matching: lowercase, strip
// everything but letters/digits. Turns "On Approval" / "onApproval" /
// "ON_APPROVAL" all into the same "onapproval" key, since the exact casing
// ApprovalMax's live API uses is unconfirmed (see this file's header
// comment).
function normalizeStatus(name) {
    return String(name ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
// Insert spaces before capital letters in a PascalCase/camelCase word
// ("OnApproval" -> "On Approval"), then Title-Case each resulting word.
// Safe no-op on a string that's already spaced or already a single word.
const status_label = (args) => {
    const raw = String(args.value ?? '');
    if (!raw)
        return '';
    const spaced = raw.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
    return spaced
        .trim()
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
};
// A$1,234.56-style formatted amount. Mirrors the system `format_currency`
// $computed's own Intl.NumberFormat call exactly (same locale/options), but
// implemented locally: `Table` cell formatters only ever see one column's
// own raw value with no way to pass a per-row `currency` argument (each
// row here can carry a different Xero org currency), so the display string
// must be pre-computed per row before handing rows to `Table` — see
// TILE-DISPLAY-STANDARDS.md §2 and §6's "real limitation" note.
function formatAmount(value, currency) {
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num))
        return '';
    const code = typeof currency === 'string' && currency ? currency : 'AUD';
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: code,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(num);
    }
    catch {
        return `${code} ${num.toFixed(2)}`;
    }
}
// Friendly label for where a row's link actually goes, derived from the
// FINAL externalUrl's hostname (after the myDecisionRequired fallback is
// applied) — not guessed from which field it came from, so it stays
// accurate even if ApprovalMax starts returning a different host. Falls
// back to the bare hostname (still informative) for anything unrecognized,
// and to '—' for a row with no link at all.
function linkDestination(url) {
    if (!url)
        return '—';
    let host;
    try {
        host = new URL(url).hostname;
    }
    catch {
        return '—';
    }
    if (host.endsWith('approvalmax.com'))
        return 'ApprovalMax';
    if (host.endsWith('xero.com'))
        return 'Xero';
    // Generic fallback: strip a leading "www." and show the registrable-ish
    // domain label, Title Cased (e.g. "quickbooks.com" -> "Quickbooks").
    const bare = host.replace(/^www\./, '').split('.')[0];
    return bare.charAt(0).toUpperCase() + bare.slice(1);
}
// ── pending_rows ───────────────────────────────────────────────────────
/**
 * Merges `list_bills` + `list_purchase_orders` results (each the MCP tool's
 * pass-through of ApprovalMax's own `{ payload: [...], continuationToken }`
 * paged-result envelope) into one row set for the Pending Approvals table,
 * tagging each row with its document type and filtering to documents not
 * yet decided.
 *
 * FILTER — "pending" heuristic (UNCONFIRMED, see this file's header
 * comment): a row is EXCLUDED only when its normalized requestStatus.name
 * matches "approved", "rejected", or "deleted" — the 3 outcomes namable
 * with reasonable confidence from ApprovalMax's own product vocabulary
 * (its UI genuinely has an Approve/Reject/Delete action set). Everything
 * else — "Draft", "OnApproval", a blank/null status, or any name this
 * heuristic doesn't recognize — is treated as still-pending and KEPT,
 * deliberately erring toward showing a row rather than silently hiding one
 * whose real status this code can't confidently classify.
 *
 * FIELDS PER ROW:
 *   - Document/reference number: `documentNumber` (nullable) → `reference`
 *     (nullable) → `friendlyName` (a REQUIRED field on both Bill and PO
 *     schemas — always present) — in that order, so a row is never blank.
 *   - Supplier: `contact` (nullable string on both schemas) → 'Unknown
 *     supplier'.
 *   - Amount: `total` (required, non-nullable on both schemas — unlike
 *     `amountDue`, which is bill-only and nullable) + `currencyCode`
 *     (required on both), pre-formatted via formatAmount() above.
 *   - Due date: ONLY bills have a `dueDate` field in ApprovalMax's Xero
 *     schema. Purchase orders have `deliveryDate` instead — a delivery
 *     estimate, not a payment-due concept — so it is deliberately NOT
 *     substituted in as a fake "due date"; a PO row's dueDateRaw is always
 *     null and its dueDateLabel reads "—". This is an honest schema gap,
 *     not an oversight.
 *   - `externalUrl` (nullable string, both schemas) — a confirmed
 *     deep-link, but empirically NOT always to ApprovalMax's own app: for
 *     at least one live Xero-sourced bill it pointed straight at the Xero
 *     page for that document instead. When `externalUrl` is null (some
 *     documents apparently don't get one — confirmed on a live account,
 *     2026-09-30), falls back to constructing ApprovalMax's own request-
 *     detail URL from `companyId` + `requestId` (both required, non-
 *     nullable fields — unlike `externalUrl`):
 *     `https://app.approvalmax.com/requests/myDecisionRequired/{companyId}?requestId={requestId}`
 *     — confirmed as a REAL, working URL by navigating ApprovalMax's own
 *     app UI to that exact document on a live account (not guessed from
 *     docs). NOT independently confirmed whether "myDecisionRequired" only
 *     resolves for the assigned approver's own account, or works for any
 *     viewer — best-effort fallback given ApprovalMax's API leaves no
 *     other option when `externalUrl` is absent.
 *
 * Args: { bills?: XeroBill[], purchaseOrders?: XeroPurchaseOrder[] }
 * Returns: row[] — see inline shape below. Sorted by dueDateRaw ascending
 * (documents with no due date — every PO — sort last), then by modifiedAt
 * descending as a tiebreak.
 */
const pending_rows = (args) => {
    const bills = Array.isArray(args.bills) ? args.bills : [];
    const purchaseOrders = Array.isArray(args.purchaseOrders)
        ? args.purchaseOrders
        : [];
    const companyId = typeof args.companyId === 'string' ? args.companyId : '';
    const DECIDED = new Set(['approved', 'rejected', 'deleted']);
    // `dueDate` only exists on the Bill schema — reading it off a Purchase
    // Order (which has no such field, only `deliveryDate`) naturally resolves
    // to null rather than needing a separate code path per doc type.
    const shape = (doc, docType) => {
        const statusObj = doc.requestStatus;
        const statusRaw = statusObj?.name ?? '';
        if (DECIDED.has(normalizeStatus(statusRaw)))
            return null; // decided — not "pending"
        const dueDateRaw = doc.dueDate ?? null;
        const requestId = String(doc.requestId ?? '');
        const resolvedUrl = doc.externalUrl ||
            (companyId && requestId
                ? `https://app.approvalmax.com/requests/myDecisionRequired/${companyId}?requestId=${requestId}`
                : '');
        return {
            id: `${docType === 'Bill' ? 'bill' : 'po'}-${requestId}`,
            docType,
            docNumber: doc.documentNumber ||
                doc.reference ||
                doc.friendlyName ||
                '—',
            supplier: doc.contact || 'Unknown supplier',
            amountDisplay: formatAmount(doc.total, doc.currencyCode),
            dueDateRaw,
            dueDateLabel: dueDateLabel(dueDateRaw),
            statusLabel: String(status_label({ value: statusRaw })),
            statusRaw: String(statusRaw),
            externalUrl: resolvedUrl,
            linkDestination: linkDestination(resolvedUrl),
            modifiedAtMs: toEpochMs(doc.modifiedAt) ?? 0,
        };
    };
    const rows = [
        ...bills.map((b) => shape(b, 'Bill')).filter((r) => r != null),
        ...purchaseOrders.map((po) => shape(po, 'Purchase Order')).filter((r) => r != null),
    ];
    rows.sort((a, b) => {
        const aKey = a.dueDateRaw ? (toEpochMs(a.dueDateRaw) ?? Infinity) : Infinity;
        const bKey = b.dueDateRaw ? (toEpochMs(b.dueDateRaw) ?? Infinity) : Infinity;
        if (aKey !== bKey)
            return aKey - bKey;
        return b.modifiedAtMs - a.modifiedAtMs;
    });
    return rows;
};
// ── pending_breakdown ────────────────────────────────────────────────
/**
 * Aging breakdown for the tile's summary bar/legend — same thresholds and
 * tone/label vocabulary as xero-accounting's own `awaiting_payment_breakdown`
 * (muted while not yet due, warning within 30 days overdue, destructive
 * beyond that), plus a 4th "No Due Date" bucket (muted) for every Purchase
 * Order row, since POs never carry a real due date in ApprovalMax's Xero
 * schema (see pending_rows' header comment) — without this bucket the bar's
 * segments would silently under-count the tile's real total.
 *
 * Args: { rows: ReturnType<typeof pending_rows> }
 * Returns: { total, segments: [{ status, count, tone }], template }
 */
const pending_breakdown = (args) => {
    const rows = Array.isArray(args.rows) ? args.rows : [];
    let notYetDue = 0;
    let overdue = 0;
    let wellOverdue = 0;
    let noDueDate = 0;
    for (const row of rows) {
        if (!row.dueDateRaw) {
            noDueDate += 1;
            continue;
        }
        const n = daysOverdue(row.dueDateRaw);
        if (n == null || n <= 0)
            notYetDue += 1;
        else if (n <= 30)
            overdue += 1;
        else
            wellOverdue += 1;
    }
    const segments = [
        { status: 'Not yet due', count: notYetDue, tone: 'muted' },
        { status: 'Overdue', count: overdue, tone: 'warning' },
        { status: 'Well overdue', count: wellOverdue, tone: 'destructive' },
        { status: 'No due date', count: noDueDate, tone: 'muted' },
    ].filter((s) => s.count > 0);
    // Worst tone present, for coloring the header's "{n} pending" count —
    // destructive if anything is well overdue, warning if anything's overdue
    // (but nothing worse), muted otherwise. Lets the count itself carry real
    // urgency signal instead of always reading as flat muted text.
    const worstTone = wellOverdue > 0 ? 'destructive' : overdue > 0 ? 'warning' : 'muted';
    return {
        total: rows.length,
        segments,
        template: segments.length ? segments.map((s) => `${s.count}fr`).join(' ') : '1fr',
        worstTone,
    };
};
const elements = {
    slug: 'approvalmax',
    functions: {
        status_label,
        pending_rows,
        pending_breakdown,
    },
};
export default elements;
