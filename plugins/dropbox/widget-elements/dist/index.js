/**
 * dropbox — widget-elements module
 *
 * `get_bills_drop_folder_dashboard` returns `{ rows, newFilesToday,
 * activityByDay, totalExtracted, totalToCheck, counts, excludedFolderNames }`.
 * Each row has `status: "extracted"|"check"|"needsOcr"|"skipped"`,
 * `statusLabel` (already a display string — "Extracted"/"Check"/"Needs
 * OCR"/"Too large"/"Skipped"), `reason` (a second-line explanation, or
 * null), `sizeBytes`, `modifiedTime` (ISO), `fileKind`
 * ("pdf"|"image"|"other"), `supplierName`, `invoiceNumber`, and
 * `extractedTotal` (number or null — never fabricated for images/scanned
 * PDFs, see the backend's own doc comment).
 */
function str(value) {
    return value == null ? '' : String(value);
}
function parseUtcMs(value) {
    if (value == null)
        return null;
    if (typeof value === 'number')
        return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string' || !value)
        return null;
    const hasTz = /[Zz]$|[+-]\d{2}:?\d{2}$/.test(value);
    const parsed = Date.parse(hasTz ? value : `${value}Z`);
    return Number.isFinite(parsed) ? parsed : null;
}
// ── file_type_label / file_type_tone ────────────────────────────────────
//
// A short type badge for a file, from its extension — the backend already
// classifies "pdf"/"image"/"other" for extraction purposes, but the badge
// itself wants the specific extension (JPG vs PNG, XLS vs DOCX, etc).
//
// Args: { name: string }
function extOf(name) {
    const dot = name.lastIndexOf('.');
    return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}
const file_type_label = (args) => {
    const ext = extOf(str(args.name));
    if (ext === 'jpeg')
        return 'JPG';
    if (ext === 'xlsx' || ext === 'xls' || ext === 'csv')
        return 'XLS';
    if (ext === 'docx' || ext === 'doc')
        return 'DOC';
    return ext ? ext.slice(0, 4).toUpperCase() : 'FILE';
};
const file_type_tone = (args) => {
    const ext = extOf(str(args.name));
    if (ext === 'pdf')
        return 'destructive';
    if (['jpg', 'jpeg', 'png', 'heic', 'gif', 'webp'].includes(ext))
        return 'warning';
    if (['xls', 'xlsx', 'csv'].includes(ext))
        return 'success';
    if (['doc', 'docx'].includes(ext))
        return 'info';
    return 'muted';
};
// ── status_tone ──────────────────────────────────────────────────────
//
// Maps a row's status bucket to a Badge tone. "skipped" covers both the
// "Too large" and plain "Skipped" row labels — both read as neutral/muted,
// the backend's distinct `reason` text is what tells them apart.
//
// Args: { value: "extracted"|"check"|"needsOcr"|"skipped" }
const status_tone = (args) => {
    const status = str(args.value);
    if (status === 'extracted')
        return 'success';
    if (status === 'check')
        return 'warning';
    if (status === 'needsOcr')
        return 'info';
    return 'muted';
};
// ── status_badge_label ──────────────────────────────────────────────────
//
// Prefixes the row's status badge with the same glyphs already used on the
// stat-row labels ("✓ Extracted", "! Check") for visual consistency between
// the summary counts and the per-row badges.
//
// Args: { statusLabel: string, status: "extracted"|"check"|"needsOcr"|"skipped" }
const status_badge_label = (args) => {
    const status = str(args.status);
    const label = str(args.statusLabel);
    if (status === 'extracted')
        return `✓ ${label}`;
    if (status === 'check')
        return `! ${label}`;
    return label;
};
// ── build_bills_view ───────────────────────────────────────────────────
//
// Takes get_bills_drop_folder_dashboard's raw output and builds everything
// the tile renders: a human file size and 12-hour clock time per row, a
// single meta line (supplier/invoice/time when extraction succeeded, just
// size/time otherwise), a formatted dollar amount string (or an em dash —
// never blank, and never fabricated for rows with no real total), and a
// footer line naming which subfolder(s) were left out of this listing.
//
// Args: { dashboard: BillsDashboard, now?: number }
function humanSize(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function formatClockTime(ms) {
    try {
        return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(ms));
    }
    catch {
        return '';
    }
}
function formatMoney(value) {
    try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
    }
    catch {
        return `$${value.toFixed(2)}`;
    }
}
const build_bills_view = (args) => {
    const dashboard = args.dashboard ?? {};
    const now = typeof args.now === 'number' ? args.now : Date.now();
    const rawRows = Array.isArray(dashboard.rows) ? dashboard.rows : [];
    const rows = rawRows.map((r) => {
        const sizeLabel = humanSize(Number(r.sizeBytes ?? 0));
        const ms = parseUtcMs(r.modifiedTime);
        const timeLabel = ms != null ? formatClockTime(ms) : '';
        const supplierName = str(r.supplierName);
        const invoiceNumber = str(r.invoiceNumber);
        const extractedTotal = typeof r.extractedTotal === 'number' ? r.extractedTotal : null;
        const metaLine = supplierName
            ? [supplierName, invoiceNumber, timeLabel].filter(Boolean).join(' · ')
            : [sizeLabel, timeLabel].filter(Boolean).join(' · ');
        const reason = r.reason ? str(r.reason) : null;
        // One line, always — appending the reason onto metaLine instead of
        // giving it its own line avoids uneven row heights (a long combined
        // string wrapping mid-row looks worse than a single truncated line).
        const subtitleLine = reason ? `${metaLine} · ${reason}` : metaLine;
        return {
            id: str(r.id),
            name: str(r.name),
            fileKind: str(r.fileKind),
            status: str(r.status),
            statusLabel: str(r.statusLabel),
            hasReason: !!reason,
            subtitleLine,
            amountLabel: extractedTotal != null ? formatMoney(extractedTotal) : '—',
            hasAmount: extractedTotal != null,
        };
    });
    const excludedFolderNames = Array.isArray(dashboard.excludedFolderNames) ? dashboard.excludedFolderNames : [];
    const footerLabel = excludedFolderNames.length > 0
        ? `${excludedFolderNames.map(n => `/${n}`).join(', ')} excluded · last checked ${formatClockTime(now)}`
        : `last checked ${formatClockTime(now)}`;
    const activityByDay = Array.isArray(dashboard.activityByDay) ? dashboard.activityByDay : [];
    const activitySeries = smoothSeries(activityByDay);
    return { rows, footerLabel, activitySeries };
};
// Sparkline always auto-scales from the series' own min/max and draws
// straight segments between points — a day of real activity surrounded by
// mostly-zero days (the common case for a low-traffic watched folder) draws
// as a flat line that jumps in a single sharp segment at the very end. A
// trailing 3-point moving average turns that into a gradual ramp instead,
// for display only — the exact daily count is still shown as the Stat
// number next to the sparkline.
function smoothSeries(values) {
    return values.map((_, i) => {
        const window = values.slice(Math.max(0, i - 1), i + 2);
        return window.reduce((sum, v) => sum + v, 0) / window.length;
    });
}
// ── module export ────────────────────────────────────────────────────
const elements = {
    slug: 'dropbox',
    functions: {
        file_type_label,
        file_type_tone,
        status_tone,
        status_badge_label,
        build_bills_view,
    },
};
export default elements;
