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

import type { ComputedFunction, PluginElementsModule } from './types.js';

// ── shared helpers ───────────────────────────────────────────────────

function str(value: unknown): string {
  return value == null ? '' : String(value);
}

// Parse an ISO-ish datetime/date string into epoch ms, treating a string
// with no timezone marker as UTC (matches how most connector APIs emit
// date-only or "naive" timestamps — avoids an off-by-one day depending on
// the viewer's browser offset).
function parseUtcMs(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !value) return null;
  const hasTz = /[Zz]$|[+-]\d{2}:?\d{2}$/.test(value);
  const parsed = Date.parse(hasTz ? value : `${value}Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

const MONTH_ABBREV = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];
const WEEKDAY_ABBREV = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TRANSCRIPT_STATUSES = ['ready', 'processing', 'none'] as const;
type TranscriptStatus = (typeof TRANSCRIPT_STATUSES)[number];

function normalizeStatus(value: unknown): TranscriptStatus {
  const s = str(value).toLowerCase();
  return (TRANSCRIPT_STATUSES as readonly string[]).includes(s) ? (s as TranscriptStatus) : 'none';
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

const mime_label: ComputedFunction = (args) => {
  const mime = str(args.value).toLowerCase();

  if (mime === 'application/vnd.google-apps.document') return 'Doc';
  if (mime === 'application/vnd.google-apps.spreadsheet') return 'Sheet';
  if (mime === 'application/vnd.google-apps.presentation') return 'Slide';
  if (mime === 'application/vnd.google-apps.folder') return 'Folder';
  if (mime === 'application/vnd.google-apps.form') return 'Form';
  if (mime === 'application/vnd.google-apps.drawing') return 'Drawing';
  if (mime === 'application/vnd.google-apps.site') return 'Site';
  if (mime === 'application/vnd.google-apps.shortcut') return 'Shortcut';
  if (mime === 'application/pdf') return 'PDF';
  if (mime === 'image/jpeg' || mime === 'image/png' || mime === 'image/gif' || mime === 'image/webp') return 'Image';
  if (mime.startsWith('video/')) return 'Video';
  if (mime.startsWith('audio/')) return 'Audio';
  if (mime === 'text/plain') return 'Text';
  if (mime === 'application/zip' || mime === 'application/x-zip-compressed') return 'ZIP';

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

const mime_tone: ComputedFunction = (args) => {
  const mime = str(args.value).toLowerCase();

  if (mime === 'application/vnd.google-apps.document') return 'info';
  if (mime === 'application/vnd.google-apps.spreadsheet') return 'success';
  if (mime === 'application/vnd.google-apps.presentation') return 'warning';
  if (mime === 'application/pdf') return 'danger';
  if (mime === 'application/vnd.google-apps.folder') return 'muted';
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

const sender_name: ComputedFunction = (args) => {
  const raw = str(args.value).trim();
  if (!raw) return '';

  // Match: Display Name <email@example.com>
  const match = raw.match(/^([^<>]+?)\s*<[^>]+>$/);
  if (match) {
    const name = match[1].trim();
    if (name) return name;
  }

  // Strip angle brackets if only email present: <email@example.com>
  const bracketOnly = raw.match(/^<([^>]+)>$/);
  if (bracketOnly) return bracketOnly[1].trim();

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

const header_date_label: ComputedFunction = (args) => {
  const ms = parseUtcMs(args.value);
  if (ms == null) return '';
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

const day_number: ComputedFunction = (args) => {
  const ms = parseUtcMs(args.value);
  if (ms == null) return '–';
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

const month_abbrev: ComputedFunction = (args) => {
  const ms = parseUtcMs(args.value);
  if (ms == null) return '';
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

const transcript_status_tone: ComputedFunction = (args) => {
  const status = normalizeStatus(args.value);
  if (status === 'ready') return 'success';
  if (status === 'processing') return 'warning';
  return 'muted';
};

// ── transcript_status_title ──────────────────────────────────────────
//
// Title-Case label for a transcript status, for the recent-meetings list
// pill. Never render the raw enum value.
//   "ready" → "Ready", "processing" → "Processing", "none" → "No transcript"
//
// Args: { value: "ready" | "processing" | "none" }

const transcript_status_title: ComputedFunction = (args) => {
  const status = normalizeStatus(args.value);
  if (status === 'ready') return 'Ready';
  if (status === 'processing') return 'Processing';
  return 'No transcript';
};

// ── transcript_status_icon ───────────────────────────────────────────
//
// Lucide outline icon name for a transcript status badge.
//   "ready" → "CheckCircle2", "processing" → "Clock", "none" → "CircleSlash"
//
// Args: { value: "ready" | "processing" | "none" }

const transcript_status_icon: ComputedFunction = (args) => {
  const status = normalizeStatus(args.value);
  if (status === 'ready') return 'CheckCircle2';
  if (status === 'processing') return 'Clock';
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

const transcript_banner_label: ComputedFunction = (args) => {
  const status = normalizeStatus(args.status);
  if (status === 'ready') {
    const words = Number(args.wordCount);
    const wordsLabel = Number.isFinite(words) ? `${words.toLocaleString('en-US')} words` : 'word count unavailable';
    return `Transcript ready · ${wordsLabel}`;
  }
  if (status === 'processing') return 'Transcript processing…';
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

const speaker_tone: ComputedFunction = (args) => {
  const speaker = str(args.speaker).trim().toLowerCase();
  const talkTime = Array.isArray(args.talkTime) ? args.talkTime : [];
  const idx = talkTime.findIndex(
    (row) => str((row as Record<string, unknown>)?.speaker).trim().toLowerCase() === speaker,
  );
  const safeIdx = idx === -1 ? 0 : idx;
  return SPEAKER_TONES[safeIdx % SPEAKER_TONES.length];
};

// ── count_transcript_matches ─────────────────────────────────────────
//
// Counts transcript entries whose speaker or text contains the query
// (case-insensitive substring). Returns 0 for a blank query.
//
// Args: { entries: { speaker: string, text: string }[], query: string }

const count_transcript_matches: ComputedFunction = (args) => {
  const query = str(args.query).trim().toLowerCase();
  if (!query) return 0;
  const entries = Array.isArray(args.entries) ? args.entries : [];
  return entries.reduce((count, entry) => {
    const row = entry as Record<string, unknown>;
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

const group_transcript_turns: ComputedFunction = (args) => {
  const entries = Array.isArray(args.entries) ? args.entries : [];
  const query = str(args.query).trim().toLowerCase();

  const prevExpandedId = str(args.expandedGroupId);
  const clickedGroupId = args.clickedGroupId !== undefined ? str(args.clickedGroupId) : undefined;
  const expandedGroupId = clickedGroupId !== undefined ? (clickedGroupId === prevExpandedId ? '' : clickedGroupId) : prevExpandedId;

  interface Group {
    id: string;
    speaker: string;
    startTime: string | null;
    endTime: string | null;
    lineCount: number;
    lines: string[];
  }
  const groups: Group[] = [];
  for (const raw of entries) {
    const e = raw as Record<string, unknown>;
    const speaker = str(e?.speaker);
    const text = str(e?.text);
    const startTime = (e?.startTime as string | null | undefined) ?? null;
    const last = groups[groups.length - 1];
    if (last && last.speaker === speaker) {
      last.endTime = startTime;
      last.lineCount += 1;
      if (last.lines.length < MAX_GROUP_LINES) last.lines.push(text);
    } else {
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

// ── module export ────────────────────────────────────────────────────

const elements: PluginElementsModule = {
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
  },
};

export default elements;
