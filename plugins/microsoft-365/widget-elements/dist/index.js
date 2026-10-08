/** Bytes → `1.2 MB` / `340 KB` / `512 B`. Graph drive items report size in raw bytes. */
const format_bytes = (args) => {
    const bytes = Number(args.value);
    if (!Number.isFinite(bytes) || bytes < 0)
        return '';
    if (bytes < 1024)
        return `${bytes} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let value = bytes / 1024;
    let i = 0;
    while (value >= 1024 && i < units.length - 1) {
        value /= 1024;
        i++;
    }
    return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
};
/**
 * Tone for a OneDrive drive item row — amber for folders, blue for files.
 * Deliberately "warning"/"info", not "accent"/"brand" — both of those
 * collapse to a near-neutral color in this design system (confirmed while
 * building the Zoom tiles), so they wouldn't actually look colorful.
 */
const item_tone = (args) => (args.isFolder ? 'warning' : 'info');
/** Icon name for a OneDrive drive item row. */
const item_icon = (args) => (args.isFolder ? 'Folder' : 'FileText');
/**
 * Deterministic per-sender avatar color, not a status tone (nothing here
 * represents state) — per TILE-DISPLAY-STANDARDS.md §7's "Categorical
 * (multi-color, non-status) breakdowns" guidance, this is exactly the
 * chart-1..5 use case: coloring several arbitrary category labels (here,
 * senders) distinctly, where no single accent or status tone fits any one of
 * them. Hashing the sender's name (not initials) keeps two different people
 * who happen to share initials from also sharing a color. 'muted' if empty.
 * Mirrors asana's flatten_recent_activity avatar_tone exactly.
 */
const sender_tone = (args) => {
    const name = String(args.value ?? '').trim();
    if (!name)
        return 'muted';
    const CHART_TONES = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'];
    let hash = 0;
    for (let i = 0; i < name.length; i++)
        hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return CHART_TONES[hash % CHART_TONES.length];
};
/** `/ui/activeTab` starts unset until a tab is clicked — treat that as "inbox" everywhere a tab comparison needs a concrete value. */
const default_tab = (args) => String(args.value ?? '').trim() || 'inbox';
/** Tab button variant: filled when active, ghost otherwise. Mirrors the Zoom Recordings tile's tab_variant exactly. */
const tab_variant = (args) => (String(args.active ?? '') === String(args.match ?? '') ? 'primary' : 'ghost');
/** Tab button tone: accent when active, muted otherwise. Mirrors the Zoom Recordings tile's tab_tone exactly. */
const tab_tone = (args) => (String(args.active ?? '') === String(args.match ?? '') ? 'info' : 'muted');
/** Empty-state copy for the Hotmail Inbox tile's mail folder tabs. */
const mail_folder_empty_message = (args) => {
    const tab = String(args.tab ?? '').trim() || 'inbox';
    if (tab === 'sent')
        return 'No sent messages yet.';
    if (tab === 'drafts')
        return 'No drafts saved.';
    return 'Inbox zero — enjoy it while it lasts.';
};
/** Builds the Quick Share picker's options from a list of drive items (recent files). */
const file_options = (args) => {
    const items = Array.isArray(args.items) ? args.items : [];
    return items
        .filter((it) => !it.folder) // folders aren't shareable via this tile — files only
        .map((it) => ({ value: String(it.id ?? ''), label: String(it.name ?? 'Untitled') }))
        .filter((o) => o.value);
};
/** Finds the selected file's full record (name, webUrl) by id, for display after picking. */
const selected_file = (args) => {
    const items = Array.isArray(args.items) ? args.items : [];
    const id = String(args.fileId ?? '').trim();
    if (!id)
        return null;
    return items.find((it) => String(it.id ?? '') === id) ?? null;
};
/**
 * Splits a list_files/search_files result into folders vs files — rendered
 * as two separate lists (folders first) since each needs different click
 * behavior (drill in vs open in browser), which a single repeat block over
 * mixed item types can't branch on per-row.
 */
const folder_items = (args) => {
    const items = Array.isArray(args.items) ? args.items : [];
    return items.filter((it) => Boolean(it.folder));
};
const file_items = (args) => {
    const items = Array.isArray(args.items) ? args.items : [];
    return items.filter((it) => !it.folder);
};
/**
 * list_recent_files is activity-tracked (Graph's /me/drive/recent) — only
 * files someone has actually opened recently, which can be very sparse (a
 * real account was confirmed live to return just 1 item even at limit=15).
 * When it's thin, fills the remainder from the root file listing, sorted by
 * lastModifiedDateTime descending, deduped against what's already shown —
 * so the tile always has something useful instead of looking broken.
 */
const merge_recent_files = (args) => {
    const recent = Array.isArray(args.recent) ? args.recent : [];
    const allFiles = Array.isArray(args.files) ? args.files : [];
    const limit = Number(args.limit) || 10;
    if (recent.length >= limit)
        return recent.slice(0, limit);
    const seenIds = new Set(recent.map((it) => String(it.id ?? '')));
    const fallback = allFiles
        .filter((it) => !it.folder && !seenIds.has(String(it.id ?? '')))
        .sort((a, b) => {
        const aDate = Date.parse(String(a.lastModifiedDateTime ?? a.createdDateTime ?? '')) || 0;
        const bDate = Date.parse(String(b.lastModifiedDateTime ?? b.createdDateTime ?? '')) || 0;
        return bDate - aDate;
    });
    return [...recent, ...fallback].slice(0, limit);
};
const elements = {
    slug: 'microsoft-365',
    functions: {
        format_bytes,
        item_tone,
        item_icon,
        sender_tone,
        default_tab,
        tab_variant,
        tab_tone,
        mail_folder_empty_message,
        file_options,
        selected_file,
        folder_items,
        file_items,
        merge_recent_files,
    },
};
export default elements;
