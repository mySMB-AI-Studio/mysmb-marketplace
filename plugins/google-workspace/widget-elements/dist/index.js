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
 *  - `get_meeting_dashboard` (Meet) returns `{ latestMeeting, recentMeetings }`.
 *    `latestMeeting.transcriptStatus` / `recentMeetings[].status` are one of
 *    `"ready" | "processing" | "none"`. `latestMeeting.talkTime` is an array
 *    of `{ speaker, words, percent }` sorted desc by percent.
 *    `latestMeeting.entries` is the full transcript as `{ speaker, text, startTime }`.
 *
 * Keeping the shape-wrangling here means the widget JSON stays a flat,
 * declarative description of the layout.
 */
// ── shared helpers ───────────────────────────────────────────────────
function str(value) {
    return value == null ? '' : String(value);
}
// Parse an ISO-ish datetime/date string into epoch ms, treating a string
// with no timezone marker as UTC (matches how most connector APIs emit
// date-only or "naive" timestamps — avoids an off-by-one day depending on
// the viewer's browser offset).
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
const MONTH_ABBREV = [
    'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
    'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];
const WEEKDAY_ABBREV = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TRANSCRIPT_STATUSES = ['ready', 'processing', 'none'];
function normalizeStatus(value) {
    const s = str(value).toLowerCase();
    return TRANSCRIPT_STATUSES.includes(s) ? s : 'none';
}
// Non-semantic tone cycle for distinguishing speakers — deliberately
// excludes success/warning/destructive, which are reserved for transcript
// status (ready/processing/none) elsewhere in the same tile.
// "accent"/"brand" render near-invisible on the dark theme without a tile
// brand colour set (confirmed live: the highest-talk-time speaker, index 0,
// got "accent" and both their talk-time bar and avatar were unreadable).
const SPEAKER_TONES = ['info', 'success', 'warning', 'destructive'];
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
// ── header_date_label ────────────────────────────────────────────────
//
// Short weekday + day + month, in the VIEWER'S LOCAL calendar day — for a
// Meet dashboard header subtitle. Meeting timestamps are real UTC instants
// (not naive date-only strings), and format_time already renders the
// time-of-day in local time; extracting the day/month in UTC here would
// disagree with that local time for any meeting that crosses midnight UTC
// (e.g. a 10am AEDT meeting is 11pm UTC the PREVIOUS day) — confirmed live:
// a meeting at 2026-10-07T23:30 UTC (10:36am AEDT on the 8th) showed "7 Oct".
//
// Examples (viewer in UTC+11):
//   "2026-10-07T23:30:00Z" → "Thu 8 Oct"
//   null                   → ""
//
// Args: { value: string | null } — an ISO datetime, e.g. latestMeeting.startTime
const header_date_label = (args) => {
    const ms = parseUtcMs(args.value);
    if (ms == null)
        return '';
    const d = new Date(ms);
    const weekday = WEEKDAY_ABBREV[d.getDay()];
    const day = d.getDate();
    const month = MONTH_ABBREV[d.getMonth()];
    const monthTitle = month.charAt(0) + month.slice(1).toLowerCase();
    return `${weekday} ${day} ${monthTitle}`;
};
// ── day_number ────────────────────────────────────────────────────────
//
// Local calendar day-of-month, no leading zero — the top half of a
// two-line date badge (day over month abbreviation). Local, not UTC — see
// header_date_label for why.
//
// Examples (viewer in UTC+11): "2026-10-07T23:30:00Z" → "8"
//
// Args: { value: string | null }
const day_number = (args) => {
    const ms = parseUtcMs(args.value);
    if (ms == null)
        return '–';
    return String(new Date(ms).getDate());
};
// ── month_abbrev ─────────────────────────────────────────────────────
//
// Upper-case 3-letter local-calendar month abbreviation — the bottom half
// of a two-line date badge. Local, not UTC — see header_date_label for why.
//
// Examples (viewer in UTC+11): "2026-10-07T23:30:00Z" → "OCT"
//
// Args: { value: string | null }
const month_abbrev = (args) => {
    const ms = parseUtcMs(args.value);
    if (ms == null)
        return '';
    return MONTH_ABBREV[new Date(ms).getMonth()];
};
// ── transcript_status_tone ──────────────────────────────────────────
//
// Maps a transcript status to a token tone for a Badge/Dot/Icon.
//   "ready"      → "success"
//   "processing" → "warning"
//   "none"       → "muted"
//
// Args: { value: "ready" | "processing" | "none" }
const transcript_status_tone = (args) => {
    const status = normalizeStatus(args.value);
    if (status === 'ready')
        return 'success';
    if (status === 'processing')
        return 'warning';
    return 'muted';
};
// ── transcript_status_title ──────────────────────────────────────────
//
// Title-Case label for a transcript status, for the recent-meetings list
// pill. Never render the raw enum value.
//   "ready" → "Ready", "processing" → "Processing", "none" → "No transcript"
//
// Args: { value: "ready" | "processing" | "none" }
const transcript_status_title = (args) => {
    const status = normalizeStatus(args.value);
    if (status === 'ready')
        return 'Ready';
    if (status === 'processing')
        return 'Processing';
    return 'No transcript';
};
// ── transcript_status_icon ───────────────────────────────────────────
//
// Lucide outline icon name for a transcript status badge.
//   "ready" → "CheckCircle2", "processing" → "Clock", "none" → "CircleSlash"
//
// Args: { value: "ready" | "processing" | "none" }
const transcript_status_icon = (args) => {
    const status = normalizeStatus(args.value);
    if (status === 'ready')
        return 'CheckCircle2';
    if (status === 'processing')
        return 'Clock';
    return 'CircleSlash';
};
// ── transcript_banner_label ──────────────────────────────────────────
//
// Full status line for the meeting header pill, e.g.
//   ("ready", 6240)      → "Transcript ready · 6,240 words"
//   ("processing", null) → "Transcript processing…"
//   ("none", null)       → "No transcript available"
//
// Args: { status: "ready" | "processing" | "none", wordCount: number | null }
const transcript_banner_label = (args) => {
    const status = normalizeStatus(args.status);
    if (status === 'ready') {
        const words = Number(args.wordCount);
        const wordsLabel = Number.isFinite(words) ? `${words.toLocaleString('en-US')} words` : 'word count unavailable';
        return `Transcript ready · ${wordsLabel}`;
    }
    if (status === 'processing')
        return 'Transcript processing…';
    return 'No transcript available';
};
// ── speaker_tone ─────────────────────────────────────────────────────
//
// Assigns a stable tone to a speaker by their rank in the talk-time list
// (sorted desc by percent), so the same speaker's talk-time bar and their
// transcript-search result dot always match colors.
//
// Args:
//   speaker:  string — the current row's speaker name
//   talkTime: { speaker: string }[] — the full talk-time list for the meeting
const speaker_tone = (args) => {
    const speaker = str(args.speaker).trim().toLowerCase();
    const talkTime = Array.isArray(args.talkTime) ? args.talkTime : [];
    const idx = talkTime.findIndex((row) => str(row?.speaker).trim().toLowerCase() === speaker);
    const safeIdx = idx === -1 ? 0 : idx;
    return SPEAKER_TONES[safeIdx % SPEAKER_TONES.length];
};
// ── count_transcript_matches ─────────────────────────────────────────
//
// Counts transcript entries whose speaker or text contains the query
// (case-insensitive substring). Returns 0 for a blank query.
//
// Args: { entries: { speaker: string, text: string }[], query: string }
const count_transcript_matches = (args) => {
    const query = str(args.query).trim().toLowerCase();
    if (!query)
        return 0;
    const entries = Array.isArray(args.entries) ? args.entries : [];
    return entries.reduce((count, entry) => {
        const row = entry;
        const haystack = `${str(row?.speaker)} ${str(row?.text)}`.toLowerCase();
        return haystack.includes(query) ? count + 1 : count;
    }, 0);
};
// ── group_transcript_turns ─────────────────────────────────────────────
//
// Merges consecutive same-speaker transcript entries into one "turn" block
// (so 3 back-to-back utterances from one person read as one card, not
// three identical name+avatar rows in a row), in original chronological
// order. Each group carries up to 6 of its original lines in fixed slots
// (line1..line6) plus lineCount, since `repeat` can't iterate a nested
// array pulled from `$item` — a block with more than 6 lines just shows
// its first 6 (no indicator; this is a rare, soft limit for very long
// uninterrupted turns, not expected in normal meeting chatter).
//
// `matches` is true for every group when `query` is blank (the full
// transcript shows by default), or when any of the group's own lines
// contain `query` (case-insensitive substring) once the user types.
//
// Collapsed groups don't show their first few raw entries — a single long
// rambling utterance already wraps to several visual lines on its own, so
// capping by entry COUNT doesn't actually cap the height. Instead, collapsed
// groups show ONE preview line: all entries joined and truncated to
// COLLAPSE_CHAR_LIMIT characters. A "Show more"/"Show less" control toggles
// exactly one group open at a time (reveals every original entry in its own
// line1..line6 slot), following the same expandedId-toggle pattern as
// myob-accounting_classify_bill_queue: the caller re-invokes this function
// on click with `clickedGroupId` set to the clicked group's id and
// `expandedGroupId` set to the PREVIOUS value read back from state; clicking
// the already-expanded group's id collapses it.
//
// Args: {
//   entries: { speaker: string, text: string, startTime: string|null }[],
//   query?: string,
//   expandedGroupId?: string,
//   clickedGroupId?: string,
// }
// Returns: { items: Group[], expandedGroupId: string }
const MAX_GROUP_LINES = 6;
const COLLAPSE_CHAR_LIMIT = 140;
const group_transcript_turns = (args) => {
    const entries = Array.isArray(args.entries) ? args.entries : [];
    const query = str(args.query).trim().toLowerCase();
    const prevExpandedId = str(args.expandedGroupId);
    const clickedGroupId = args.clickedGroupId !== undefined ? str(args.clickedGroupId) : undefined;
    const expandedGroupId = clickedGroupId !== undefined ? (clickedGroupId === prevExpandedId ? '' : clickedGroupId) : prevExpandedId;
    const groups = [];
    for (const raw of entries) {
        const e = raw;
        const speaker = str(e?.speaker);
        const text = str(e?.text);
        const startTime = e?.startTime ?? null;
        const last = groups[groups.length - 1];
        if (last && last.speaker === speaker) {
            last.endTime = startTime;
            last.lineCount += 1;
            if (last.lines.length < MAX_GROUP_LINES)
                last.lines.push(text);
        }
        else {
            groups.push({ id: startTime ?? `g${groups.length}`, speaker, startTime, endTime: startTime, lineCount: 1, lines: [text] });
        }
    }
    const items = groups.map((g) => {
        const matches = !query || g.lines.some((l) => l.toLowerCase().includes(query)) || g.speaker.toLowerCase().includes(query);
        const expanded = g.id === expandedGroupId;
        const fullText = g.lines.join(' ').trim();
        const isLong = fullText.length > COLLAPSE_CHAR_LIMIT;
        const preview = isLong ? fullText.slice(0, COLLAPSE_CHAR_LIMIT).trimEnd() + '…' : fullText;
        const visibleLines = expanded ? g.lines : [preview];
        return {
            id: g.id,
            speaker: g.speaker,
            startTime: g.startTime,
            endTime: g.endTime,
            lineCount: g.lineCount,
            line1: visibleLines[0] ?? '',
            line2: visibleLines[1] ?? '',
            line3: visibleLines[2] ?? '',
            line4: visibleLines[3] ?? '',
            line5: visibleLines[4] ?? '',
            line6: visibleLines[5] ?? '',
            matches,
            expanded,
            hasMore: isLong,
            showMoreLabel: expanded ? 'Show less' : 'Show more',
        };
    });
    return { items, expandedGroupId };
};
// ── sender_tone ─────────────────────────────────────────────────────────
//
// Assigns a stable tone to a Gmail sender by hashing their identity (not
// rank, since an inbox has arbitrarily many senders, unlike the Meet
// tile's small fixed speaker list) — the same sender always gets the same
// avatar colour across the whole inbox. Reuses the same non-semantic,
// dark-theme-safe tone cycle as speaker_tone (see its comment for why
// accent/brand/muted/default are excluded).
//
// Args: { value: string } — sender display name or email
function toneFromKey(key) {
    let hash = 0;
    const k = key.trim().toLowerCase();
    for (let i = 0; i < k.length; i++)
        hash = (hash * 31 + k.charCodeAt(i)) >>> 0;
    return SPEAKER_TONES[hash % SPEAKER_TONES.length];
}
const sender_tone = (args) => toneFromKey(str(args.value));
// ── decode_entities ─────────────────────────────────────────────────────
//
// Decodes the handful of HTML entities that actually show up in Gmail
// snippets (which are plain text from Google except for these) — not a
// full HTML decoder, since snippets never contain markup, only escaped
// punctuation.
//
// Examples: "didn&#39;t" → "didn't", "Tom &amp; Jerry" → "Tom & Jerry"
//
// Args: { value: string }
const ENTITY_MAP = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#38': '&',
};
const decode_entities = (args) => {
    const raw = str(args.value);
    if (!raw.includes('&'))
        return raw;
    return raw.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, code) => {
        const lower = code.toLowerCase();
        if (lower in ENTITY_MAP)
            return ENTITY_MAP[lower];
        if (lower.startsWith('#x')) {
            const n = parseInt(lower.slice(2), 16);
            return Number.isFinite(n) ? String.fromCodePoint(n) : match;
        }
        if (lower.startsWith('#')) {
            const n = parseInt(lower.slice(1), 10);
            return Number.isFinite(n) ? String.fromCodePoint(n) : match;
        }
        return match;
    });
};
// ── build_inbox_rows ──────────────────────────────────────────────────
//
// Turns the raw Gmail message list into the rows an enhanced inbox tile
// renders: cleaned snippets, a stable per-sender colour, a "Today /
// Yesterday / Earlier" section header on the first row of each day
// (viewer's LOCAL calendar day — see the Meet tile's header_date_label
// comment for why UTC would disagree with a relative "2h ago" timestamp),
// and repeat notifications from the same sender collapsed into one row
// with a count (e.g. 4 same-day "Security alert" emails from Google become
// one row showing the latest snippet and "4").
//
// Grouping key: sender + subject + local calendar day — tight enough that
// two unrelated emails from the same sender on the same day never merge,
// while still catching the repeat-notification case the mockup shows.
//
// "Alert" is a soft content classification (Gmail has no such label) — the
// subject literally contains "security alert", a narrow deliberately-tight
// match. A broader net (verification codes, OAuth emails, "action needed")
// was tried and rejected: those are routine one-off emails, not alerts, and
// tagging them produced false positives the reference design doesn't show.
//
// Tab counts and `all`/`unread`/`attachments`/`alerts` filtering are
// counted over the GROUPED rows, not the raw messages — a 4-message group
// is one row and counts once, matching the mockup (12 raw messages, 8
// grouped rows, "All 8").
//
// Args: {
//   messages: { id, threadId, from, subject, snippet, internalDate,
//               isUnread, isStarred, hasAttachments }[],
//   tab?: "all" | "unread" | "attachments" | "alerts",
// }
// Returns: { rows: Row[], counts: { all, unread, attachments, alerts } }
const ALERT_RE = /security alert/i;
function dayBucket(ms, now) {
    const d = new Date(ms);
    const n = new Date(now);
    const startOfDay = (dt) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
    const diffDays = Math.round((startOfDay(n) - startOfDay(d)) / 86_400_000);
    if (diffDays <= 0)
        return 'TODAY';
    if (diffDays === 1)
        return 'YESTERDAY';
    return 'EARLIER';
}
const build_inbox_rows = (args) => {
    const messages = Array.isArray(args.messages) ? args.messages : [];
    const tab = str(args.tab) || 'all';
    const now = Date.now();
    const groups = new Map();
    for (const raw of messages) {
        const m = raw;
        const sender = sender_name({ value: m.from });
        const subject = str(m.subject) || '(no subject)';
        const ms = parseUtcMs(m.internalDate) ?? now;
        const bucket = dayBucket(ms, now);
        const tag = ALERT_RE.test(`${subject} ${sender}`) ? 'Security' : '';
        const key = `${sender.toLowerCase()}|${subject.toLowerCase()}|${bucket}`;
        const existing = groups.get(key);
        if (existing && ms >= existing.latestMs) {
            existing.ids.push(str(m.id));
            existing.threadId = str(m.threadId) || existing.threadId;
            existing.latestSnippet = decode_entities({ value: m.snippet });
            existing.latestMs = ms;
            existing.isUnread = existing.isUnread || !!m.isUnread;
            existing.isStarred = existing.isStarred || !!m.isStarred;
            existing.hasAttachments = existing.hasAttachments || !!m.hasAttachments;
        }
        else if (existing) {
            existing.ids.push(str(m.id));
            existing.isUnread = existing.isUnread || !!m.isUnread;
            existing.isStarred = existing.isStarred || !!m.isStarred;
            existing.hasAttachments = existing.hasAttachments || !!m.hasAttachments;
        }
        else {
            groups.set(key, {
                key,
                ids: [str(m.id)],
                threadId: str(m.threadId),
                sender,
                subject,
                latestSnippet: decode_entities({ value: m.snippet }),
                latestMs: ms,
                bucket,
                isUnread: !!m.isUnread,
                isStarred: !!m.isStarred,
                hasAttachments: !!m.hasAttachments,
                tag,
            });
        }
    }
    const sorted = [...groups.values()].sort((a, b) => b.latestMs - a.latestMs);
    const counts = { all: sorted.length, unread: 0, attachments: 0, alerts: 0 };
    for (const g of sorted) {
        if (g.isUnread)
            counts.unread += 1;
        if (g.hasAttachments)
            counts.attachments += 1;
        if (g.tag)
            counts.alerts += 1;
    }
    let lastBucket = '';
    const rows = sorted
        .filter((g) => {
        if (tab === 'unread')
            return g.isUnread;
        if (tab === 'attachments')
            return g.hasAttachments;
        if (tab === 'alerts')
            return !!g.tag;
        return true;
    })
        .map((g) => {
        const showDayHeader = g.bucket !== lastBucket;
        lastBucket = g.bucket;
        return {
            id: g.key,
            threadId: g.threadId,
            sender: g.sender,
            subject: g.subject,
            snippet: g.latestSnippet,
            count: g.ids.length,
            isGroup: g.ids.length > 1,
            tag: g.tag,
            isUnread: g.isUnread,
            isStarred: g.isStarred,
            hasAttachments: g.hasAttachments,
            dayLabel: g.bucket.charAt(0) + g.bucket.slice(1).toLowerCase(),
            showDayHeader,
            internalDate: new Date(g.latestMs).toISOString(),
        };
    });
    return { rows, counts };
};
// ── file_type_label / file_type_tone ────────────────────────────────────
//
// A short type abbreviation + a platform tone for a Drive file, used as an
// Avatar's initials+tone (a colored rounded-square badge) replacing the old
// generic grey Icon + separate Badge combo. Extension-aware, not just
// mimeType-aware — uploaded Office files (ready-to-pay.xlsx,
// myhub-tiles.pptx) are just as common as native Google Docs/Sheets/Slides
// in a real recent-files list, and they carry Office mimeTypes, not
// Google's application/vnd.google-apps.* ones.
//
// Reuses mime_label's Google-native mapping, but routes PDF to
// "destructive" instead of mime_tone's "danger" — "danger" isn't a real
// platform tone (confirmed earlier this session), it silently fails to
// resolve any color.
//
// Args: { mimeType: string, name?: string }
function extOf(name) {
    const dot = name.lastIndexOf('.');
    return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}
const file_type_label = (args) => {
    const mime = str(args.mimeType).toLowerCase();
    const ext = extOf(str(args.name));
    if (mime === 'application/vnd.google-apps.document' || ext === 'doc' || ext === 'docx')
        return 'DOC';
    if (mime === 'application/vnd.google-apps.spreadsheet' || ext === 'xls' || ext === 'xlsx' || ext === 'csv')
        return 'XLS';
    if (mime === 'application/vnd.google-apps.presentation' || ext === 'ppt' || ext === 'pptx')
        return 'PPT';
    if (mime === 'application/pdf' || ext === 'pdf')
        return 'PDF';
    if (mime === 'application/vnd.google-apps.form')
        return 'FORM';
    if (mime === 'application/vnd.google-apps.drawing')
        return 'DRAW';
    if (mime.startsWith('image/'))
        return 'IMG';
    if (mime.startsWith('video/'))
        return 'VID';
    if (mime.startsWith('audio/'))
        return 'AUD';
    if (mime === 'application/zip' || ext === 'zip')
        return 'ZIP';
    return ext ? ext.slice(0, 4).toUpperCase() : 'FILE';
};
const file_type_tone = (args) => {
    const mime = str(args.mimeType).toLowerCase();
    const ext = extOf(str(args.name));
    if (mime === 'application/vnd.google-apps.document' || ext === 'doc' || ext === 'docx')
        return 'info';
    if (mime === 'application/vnd.google-apps.spreadsheet' || ext === 'xls' || ext === 'xlsx' || ext === 'csv')
        return 'success';
    if (mime === 'application/vnd.google-apps.presentation' || ext === 'ppt' || ext === 'pptx')
        return 'warning';
    if (mime === 'application/pdf' || ext === 'pdf')
        return 'destructive';
    return 'muted';
};
// ── tidy_file_name ──────────────────────────────────────────────────────
//
// Google Meet names a call's transcript doc after the raw conference
// identity, not something a human would want to scan in a recent-files
// list — e.g. "goj-ncgy-mnt - Transcript" or "Weekly Ops Sync (2026-10-08
// 09:30 GMT+8) - Transcript". Reformats any name ending in "- Transcript"
// or "-Transcript" into "{meeting part} — transcript · {day} {month}" when
// a parseable date is present in the name; otherwise just strips the
// "- Transcript" suffix and leaves the rest alone. Every other file's name
// passes through completely unchanged.
//
// Examples:
//   "Weekly Ops Sync (2026-10-08 09:30 GMT+8) - Transcript" → "Weekly Ops Sync — transcript · 8 Oct"
//   "Meeting Transcript Test - Transcript" → "Meeting Transcript Test — transcript"
//   "Q3 Budget.xlsx" → "Q3 Budget.xlsx" (unchanged)
//
// Args: { value: string }
const TRANSCRIPT_SUFFIX_RE = /\s*-\s*Transcript\s*$/i;
const DATE_PAREN_RE = /\((\d{4})-(\d{2})-(\d{2})[^)]*\)/;
const tidy_file_name = (args) => {
    const raw = str(args.value);
    if (!TRANSCRIPT_SUFFIX_RE.test(raw))
        return raw;
    const withoutSuffix = raw.replace(TRANSCRIPT_SUFFIX_RE, '').trim();
    const dateMatch = withoutSuffix.match(DATE_PAREN_RE);
    if (!dateMatch)
        return `${withoutSuffix} — transcript`;
    const [, , month, day] = dateMatch;
    const meetingPart = withoutSuffix.replace(DATE_PAREN_RE, '').trim();
    const monthLabel = MONTH_ABBREV[Number(month) - 1];
    const monthTitle = monthLabel ? monthLabel.charAt(0) + monthLabel.slice(1).toLowerCase() : '';
    return `${meetingPart} — transcript · ${Number(day)} ${monthTitle}`;
};
// ── build_recent_files_view ──────────────────────────────────────────────
//
// Takes get_recent_files_dashboard's output (folders already excluded,
// folder names and a recency reason already resolved) and builds
// everything the tile renders: the 2 most-recent files as "quick access"
// cards, the rest day-bucketed with headers, and All/Docs/Sheets/PDFs/
// Shared-with-me tab counts and filtering. Tabs are independent dimensions
// (a shared PDF counts toward both "PDFs" and "Shared with me"), not
// mutually exclusive buckets.
//
// Args: { files: DashboardFile[], tab?: string, now?: number }
// Returns: { quickAccess: Row[], agendaRows: Row[], counts: {...} }
function fileCategory(f) {
    const label = file_type_label({ mimeType: f.mimeType, name: f.name });
    if (label === 'DOC')
        return 'docs';
    if (label === 'XLS')
        return 'sheets';
    if (label === 'PDF')
        return 'pdfs';
    return 'other';
}
const build_recent_files_view = (args) => {
    const files = Array.isArray(args.files) ? args.files : [];
    const tab = str(args.tab) || 'all';
    const now = typeof args.now === 'number' ? args.now : Date.now();
    const decorated = files.map((f) => {
        const category = fileCategory(f);
        return {
            ...f,
            typeLabel: file_type_label({ mimeType: f.mimeType, name: f.name }),
            typeTone: file_type_tone({ mimeType: f.mimeType, name: f.name }),
            tidiedName: tidy_file_name({ value: f.name }),
            category,
            isShared: !!f.shared,
            bucket: dayBucket(parseUtcMs(f.modifiedTime) ?? now, now),
        };
    });
    const counts = {
        all: decorated.length,
        docs: decorated.filter(f => f.category === 'docs').length,
        sheets: decorated.filter(f => f.category === 'sheets').length,
        pdfs: decorated.filter(f => f.category === 'pdfs').length,
        shared: decorated.filter(f => f.isShared).length,
    };
    const filtered = decorated.filter((f) => {
        if (tab === 'docs')
            return f.category === 'docs';
        if (tab === 'sheets')
            return f.category === 'sheets';
        if (tab === 'pdfs')
            return f.category === 'pdfs';
        if (tab === 'shared')
            return f.isShared;
        return true;
    });
    // Quick-access cards only show on the "All" tab's top 2 — once a tab
    // filters the list, a dedicated 2-card header stops making sense (e.g.
    // "Docs" with 1 total file shouldn't still show a 2-up card row).
    const quickAccess = tab === 'all' ? filtered.slice(0, 2) : [];
    const rest = tab === 'all' ? filtered.slice(2) : filtered;
    const contextLabel = (f) => {
        const folder = f.folderName;
        return folder ? `${folder} · ${f.reason}` : f.reason;
    };
    let lastBucket = '';
    const agendaRows = rest.map((f) => {
        const showDayHeader = f.bucket !== lastBucket;
        lastBucket = f.bucket;
        return {
            id: f.id,
            name: f.name,
            tidiedName: f.tidiedName,
            typeLabel: f.typeLabel,
            typeTone: f.typeTone,
            folderName: f.folderName,
            reason: f.reason,
            contextLabel: contextLabel(f),
            webViewLink: f.webViewLink,
            isShared: f.isShared,
            modifiedTime: f.modifiedTime,
            dayLabel: f.bucket,
            showDayHeader,
        };
    });
    const quickAccessCards = quickAccess.map((f) => ({
        id: f.id,
        name: f.name,
        tidiedName: f.tidiedName,
        typeLabel: f.typeLabel,
        typeTone: f.typeTone,
        reason: f.reason,
        contextLabel: contextLabel(f),
        webViewLink: f.webViewLink,
        modifiedTime: f.modifiedTime,
    }));
    return { quickAccess: quickAccessCards, agendaRows, counts };
};
// ── module export ────────────────────────────────────────────────────
// ── countdown_label ─────────────────────────────────────────────────────
//
// "in 19h 20m" / "in 45m" / "Starting now" / "In progress" for an event's
// start/end instants relative to now. Not a live-ticking timer — this
// system has no interval primitive exposed to widget JSON — it recomputes
// on each render/data refresh, which is good enough for a dashboard tile.
//
// Args: { start: string, end?: string, now?: number }
const countdown_label = (args) => {
    const startMs = parseUtcMs(args.start);
    if (startMs == null)
        return '';
    const now = typeof args.now === 'number' ? args.now : Date.now();
    const endMs = parseUtcMs(args.end);
    if (endMs != null && now >= startMs && now < endMs)
        return 'In progress';
    const diffMs = startMs - now;
    if (diffMs <= 0)
        return 'Starting now';
    const totalMin = Math.round(diffMs / 60_000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h === 0)
        return `in ${m}m`;
    if (m === 0)
        return `in ${h}h`;
    return `in ${h}h ${m}m`;
};
// ── rsvp_label ────────────────────────────────────────────────────────
//
// Maps a Calendar attendee responseStatus to the short badge label the
// mockup shows — only for the two states worth flagging; "accepted" (the
// default/your-own-event case) and "declined" get no badge at all.
//
// Args: { value: string }
const rsvp_label = (args) => {
    const s = str(args.value);
    if (s === 'needsAction')
        return 'Needs reply';
    if (s === 'tentative')
        return 'Maybe';
    return '';
};
// ── ymdInTz (local helper, not exported) ───────────────────────────────
//
// Mirrors the backend's own ymdInTz exactly (myhub-mcp-servers
// api/calendar.ts) so client-side day-bucketing for the agenda list agrees
// with the server-computed weekDays strip — both must bucket by the SAME
// calendar's timeZone, not the viewer's browser offset, since this tile is
// showing someone else's-ish shared calendars too, not just "my" timezone.
function ymdInTz(ms, timeZone) {
    try {
        const fmt = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
        return fmt.format(new Date(ms));
    }
    catch {
        return new Date(ms).toISOString().slice(0, 10);
    }
}
// ── build_events_view ───────────────────────────────────────────────────
//
// Takes get_upcoming_events_dashboard's raw output (already merged across
// calendars, already clash/RSVP-tagged) and builds everything the tile
// renders: the week strip (with per-day selection state), the agenda rows
// (day-bucketed with header flags, filtered by range AND an optional
// single selected day from the strip), a "nothing else today" style status
// line, and per-range event counts for the tab labels.
//
// `range`: "today" | "week" | "month" — "week"/"month" are both INCLUSIVE
// of today's remaining events, not just future days.
// `selectedDay`: a YYYY-MM-DD from weekDays, or "" — narrows the agenda to
// just that one day, overriding `range`, until cleared (click the same day
// again). This is what "click a day to jump to it" means here — there's no
// scroll-into-view primitive, so it's a filter instead.
//
// Args: {
//   events: DashboardEvent[], weekDays: {date,count}[], nextUpEventId: string|null,
//   timeZone: string, range: string, selectedDay?: string, now?: number,
// }
const build_events_view = (args) => {
    const events = Array.isArray(args.events) ? args.events : [];
    const weekDays = Array.isArray(args.weekDays) ? args.weekDays : [];
    const timeZone = str(args.timeZone) || 'UTC';
    const range = str(args.range) || 'week';
    const selectedDay = str(args.selectedDay);
    const now = typeof args.now === 'number' ? args.now : Date.now();
    const today = ymdInTz(now, timeZone);
    // Don't assume the caller's `events` is already start-time sorted (the real
    // backend does sort it, but `overallNext`/`todayRemaining` below both rely
    // on the FIRST qualifying match being the chronologically earliest one).
    const withBucket = events.map((e) => ({ ...e, __day: ymdInTz(parseUtcMs(e.start) ?? now, timeZone) }));
    withBucket.sort((a, b) => (parseUtcMs(a.start) ?? 0) - (parseUtcMs(b.start) ?? 0));
    // -- counts (per range window, cumulative from today) --------------------
    const next7Cutoff = weekDays[6]?.date ?? today;
    const counts = {
        today: withBucket.filter(e => e.__day === today).length,
        week: withBucket.filter(e => e.__day >= today && e.__day <= next7Cutoff).length,
        // No upper bound here — the backend already caps the whole fetch at 30 days.
        month: withBucket.filter(e => e.__day >= today).length,
    };
    // -- week strip ------------------------------------------------------------
    const weekChips = weekDays.map((d) => {
        const dt = new Date(`${d.date}T00:00:00Z`);
        return {
            date: d.date,
            dayAbbrev: WEEKDAY_ABBREV[dt.getUTCDay()].toUpperCase(),
            dayNumber: dt.getUTCDate(),
            count: d.count,
            // A non-breaking space (not an empty string) when there are no
            // events — it renders no visible dot, but still reserves the same
            // line height as a chip with dots, so every chip stays the same
            // height (a truly empty string collapsed that line and made chips
            // sit at inconsistent vertical baselines).
            dots: d.count > 0 ? '●'.repeat(Math.min(d.count, 3)) : ' ',
            dotsTone: 'brand',
            isToday: d.date === today,
            isSelected: d.date === selectedDay,
            // Exactly one chip highlighted at a time: the picked day once one is
            // picked, otherwise today — not "today OR picked" (that let both show
            // highlighted at once when you picked a day other than today).
            highlighted: selectedDay ? d.date === selectedDay : d.date === today,
        };
    });
    // -- today status line -----------------------------------------------------
    const todayRemaining = withBucket.filter(e => e.__day === today && (parseUtcMs(e.start) ?? 0) >= now);
    const overallNext = withBucket.find(e => (e.__day > today) || (e.__day === today && (parseUtcMs(e.start) ?? 0) >= now));
    let statusHeadline = '';
    let statusDetail = '';
    if (todayRemaining.length > 0) {
        statusHeadline = todayRemaining.length === 1 ? '1 more today' : `${todayRemaining.length} more today`;
        statusDetail = str(todayRemaining[0].summary);
    }
    else {
        statusHeadline = 'Nothing else today';
        if (overallNext) {
            const dayLabel = overallNext.__day === today ? 'Today' : overallNext.__day === weekChips[1]?.date ? 'Tomorrow' : overallNext.__day;
            statusDetail = overallNext.isAllDay
                ? `Next: ${dayLabel} · All day — ${str(overallNext.summary)}`
                : `Next: ${dayLabel} — ${str(overallNext.summary)}`;
        }
        else {
            statusDetail = 'Nothing else on your calendar for the next 30 days.';
        }
    }
    // -- agenda rows -------------------------------------------------------------
    let scoped = withBucket;
    if (selectedDay) {
        scoped = scoped.filter(e => e.__day === selectedDay);
    }
    else if (range === 'today') {
        scoped = scoped.filter(e => e.__day === today);
    }
    else if (range === 'week') {
        scoped = scoped.filter(e => e.__day >= today && e.__day <= next7Cutoff);
    }
    else {
        scoped = scoped.filter(e => e.__day >= today);
    }
    scoped.sort((a, b) => (parseUtcMs(a.start) ?? 0) - (parseUtcMs(b.start) ?? 0));
    const dayGroups = new Map();
    for (const e of scoped) {
        const arr = dayGroups.get(e.__day) ?? [];
        arr.push(e);
        dayGroups.set(e.__day, arr);
    }
    const agendaRows = [];
    for (const [day, dayEvents] of dayGroups) {
        const dt = new Date(`${day}T00:00:00Z`);
        const relative = day === today ? 'Today' : day === weekChips[1]?.date ? 'Tomorrow' : '';
        const weekdayDate = `${WEEKDAY_ABBREV[dt.getUTCDay()]}, ${dt.getUTCDate()} ${MONTH_ABBREV[dt.getUTCMonth()].charAt(0)}${MONTH_ABBREV[dt.getUTCMonth()].slice(1).toLowerCase()}`;
        const dayLabel = relative ? `${relative.toUpperCase()} · ${weekdayDate}` : weekdayDate.toUpperCase();
        dayEvents.forEach((e, idx) => {
            agendaRows.push({
                id: str(e.id),
                showDayHeader: idx === 0,
                dayLabel,
                dayEventCount: dayEvents.length,
                summary: str(e.summary),
                isAllDay: !!e.isAllDay,
                start: str(e.start),
                end: str(e.end),
                location: e.location ?? null,
                hangoutLink: e.hangoutLink ?? null,
                htmlLink: e.htmlLink ?? null,
                calendarTone: toneFromKey(str(e.calendarName) || str(e.calendarColor)),
                calendarName: str(e.calendarName),
                rsvp: rsvp_label({ value: e.selfResponseStatus }),
                clash: !!e.clash,
            });
        });
    }
    const nextUpId = str(args.nextUpEventId);
    const nextUpEvent = nextUpId ? withBucket.find(e => str(e.id) === nextUpId) : undefined;
    const nextUp = nextUpEvent
        ? {
            id: str(nextUpEvent.id),
            summary: str(nextUpEvent.summary),
            start: str(nextUpEvent.start),
            end: str(nextUpEvent.end),
            location: nextUpEvent.location ?? null,
            hangoutLink: nextUpEvent.hangoutLink ?? null,
            htmlLink: nextUpEvent.htmlLink ?? null,
            calendarTone: toneFromKey(str(nextUpEvent.calendarName) || str(nextUpEvent.calendarColor)),
            dayLabel: nextUpEvent.__day === today ? 'Today' : nextUpEvent.__day === weekChips[1]?.date ? 'Tomorrow' : str(nextUpEvent.__day),
            countdown: countdown_label({ start: nextUpEvent.start, end: nextUpEvent.end, now }),
        }
        : null;
    return {
        nextUp,
        weekChips,
        counts,
        statusHeadline,
        statusDetail,
        agendaRows,
    };
};
// ── module export ────────────────────────────────────────────────────
const elements = {
    slug: 'google-workspace',
    functions: {
        mime_label,
        mime_tone,
        sender_name,
        header_date_label,
        day_number,
        month_abbrev,
        transcript_status_tone,
        transcript_status_title,
        transcript_status_icon,
        transcript_banner_label,
        speaker_tone,
        count_transcript_matches,
        group_transcript_turns,
        sender_tone,
        decode_entities,
        build_inbox_rows,
        file_type_label,
        file_type_tone,
        tidy_file_name,
        build_recent_files_view,
    },
};
export default elements;
