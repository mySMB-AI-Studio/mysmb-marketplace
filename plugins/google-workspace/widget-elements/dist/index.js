/**
 * google-workspace — widget-elements module
 *
 * Helpers tailored to Google Workspace API response shapes:
 *
 *  - `list_messages` (Gmail) returns `{ messages: [...], resultSizeEstimate }`.
 *    Each message has `id`, `threadId`, and optional payload headers including
 *    `from`, `subject`, `date`, and `internalDate` (epoch ms string).
 *
 *  - `list_recent_files` (Drive) returns `{ files: [...], nextPageToken? }`.
 *    Each file has `id`, `name`, `mimeType`, `modifiedTime`, `webViewLink`.
 *
 *  - `list_events` (Calendar) returns `{ items: [...], summary, ... }`.
 *    Each event has `id`, `summary`, `start`, `end`, `status`, `location`.
 *
 * Keeping the shape-wrangling here means the widget JSON stays a flat,
 * declarative description of the layout.
 */
// ── shared helpers ───────────────────────────────────────────────────
function str(value) {
    return value == null ? '' : String(value);
}
// ── mime_label ─────────────────────────────────────────────────────────
// Referenced in widget JSON as "google-workspace_mime_label" — the slug
// prefix is added automatically by the platform, not baked in here.
//
// Maps a Google Drive MIME type to a short human-readable label.
//
// Examples:
//   "application/vnd.google-apps.document"     → "Doc"
//   "application/vnd.google-apps.spreadsheet"  → "Sheet"
//   "application/vnd.google-apps.presentation" → "Slide"
//   "application/vnd.google-apps.folder"       → "Folder"
//   "application/pdf"                          → "PDF"
//   anything else → last segment after "/" or "File"
//
// Args: { value: string } — the file's mimeType field
const mime_label = (args) => {
    const mime = str(args.value).toLowerCase();
    if (mime === 'application/vnd.google-apps.document')
        return 'Doc';
    if (mime === 'application/vnd.google-apps.spreadsheet')
        return 'Sheet';
    if (mime === 'application/vnd.google-apps.presentation')
        return 'Slide';
    if (mime === 'application/vnd.google-apps.folder')
        return 'Folder';
    if (mime === 'application/vnd.google-apps.form')
        return 'Form';
    if (mime === 'application/vnd.google-apps.drawing')
        return 'Drawing';
    if (mime === 'application/vnd.google-apps.site')
        return 'Site';
    if (mime === 'application/vnd.google-apps.shortcut')
        return 'Shortcut';
    if (mime === 'application/pdf')
        return 'PDF';
    if (mime === 'image/jpeg' || mime === 'image/png' || mime === 'image/gif' || mime === 'image/webp')
        return 'Image';
    if (mime.startsWith('video/'))
        return 'Video';
    if (mime.startsWith('audio/'))
        return 'Audio';
    if (mime === 'text/plain')
        return 'Text';
    if (mime === 'application/zip' || mime === 'application/x-zip-compressed')
        return 'ZIP';
    // Fall back to the last segment after "/"
    const slash = mime.lastIndexOf('/');
    if (slash !== -1 && slash < mime.length - 1) {
        const seg = mime.slice(slash + 1);
        return seg.charAt(0).toUpperCase() + seg.slice(1);
    }
    return 'File';
};
// ── mime_tone ──────────────────────────────────────────────────────────
//
// Maps a Google Drive MIME type to a badge tone:
//   Docs     → "info"
//   Sheets   → "success"
//   Slides   → "warning"
//   PDF      → "danger"
//   Folder   → "muted"
//   else     → "default"
//
// Args: { value: string } — the file's mimeType field
const mime_tone = (args) => {
    const mime = str(args.value).toLowerCase();
    if (mime === 'application/vnd.google-apps.document')
        return 'info';
    if (mime === 'application/vnd.google-apps.spreadsheet')
        return 'success';
    if (mime === 'application/vnd.google-apps.presentation')
        return 'warning';
    if (mime === 'application/pdf')
        return 'danger';
    if (mime === 'application/vnd.google-apps.folder')
        return 'muted';
    return 'default';
};
// ── sender_name ────────────────────────────────────────────────────────
//
// Extracts the display name from a Gmail "From" header string.
//
// Examples:
//   "Alice Smith <alice@example.com>" → "Alice Smith"
//   "alice@example.com"               → "alice@example.com"
//   "<bob@example.com>"               → "bob@example.com"
//
// Args: { value: string } — the message's `from` field
const sender_name = (args) => {
    const raw = str(args.value).trim();
    if (!raw)
        return '';
    // Match: Display Name <email@example.com>
    const match = raw.match(/^([^<>]+?)\s*<[^>]+>$/);
    if (match) {
        const name = match[1].trim();
        if (name)
            return name;
    }
    // Strip angle brackets if only email present: <email@example.com>
    const bracketOnly = raw.match(/^<([^>]+)>$/);
    if (bracketOnly)
        return bracketOnly[1].trim();
    return raw;
};
// ── module export ────────────────────────────────────────────────────
const elements = {
    slug: 'google-workspace',
    functions: {
        mime_label,
        mime_tone,
        sender_name,
    },
};
export default elements;
