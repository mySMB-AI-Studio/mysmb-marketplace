/**
 * microsoft-365 — widget-elements module
 * ──────────────────────────────────────────────────────────────────
 * Connector-specific `$computed` helpers contributed to the host's
 * widgets-system at runtime. The host prepends the slug `microsoft-365_`
 * to every name in `functions`, so e.g. the spec-side reference is
 * `microsoft-365_smart_day_label`.
 */

import type { ComputedFunction, PluginElementsModule } from './types.js';

/** Bytes → `1.2 MB` / `340 KB` / `512 B`. Graph drive items report size in raw bytes. */
const format_bytes: ComputedFunction = (args) => {
  const bytes = Number(args.value);
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
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
const item_tone: ComputedFunction = (args) => (args.isFolder ? 'warning' : 'info');

/** Icon name for a OneDrive drive item row. */
const item_icon: ComputedFunction = (args) => (args.isFolder ? 'Folder' : 'FileText');

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
const sender_tone: ComputedFunction = (args) => {
  const name = String(args.value ?? '').trim();
  if (!name) return 'muted';
  const CHART_TONES = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'] as const;
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return CHART_TONES[hash % CHART_TONES.length];
};

/** `/ui/activeTab` starts unset until a tab is clicked — treat that as "inbox" everywhere a tab comparison needs a concrete value. */
const default_tab: ComputedFunction = (args) => String(args.value ?? '').trim() || 'inbox';

/** Tab button variant: filled when active, ghost otherwise. Mirrors the Zoom Recordings tile's tab_variant exactly. */
const tab_variant: ComputedFunction = (args) => (String(args.active ?? '') === String(args.match ?? '') ? 'primary' : 'ghost');

/** Tab button tone: accent when active, muted otherwise. Mirrors the Zoom Recordings tile's tab_tone exactly. */
const tab_tone: ComputedFunction = (args) => (String(args.active ?? '') === String(args.match ?? '') ? 'info' : 'muted');

/** Empty-state copy for the Hotmail Inbox tile's mail folder tabs. */
const mail_folder_empty_message: ComputedFunction = (args) => {
  const tab = String(args.tab ?? '').trim() || 'inbox';
  if (tab === 'sent') return 'No sent messages yet.';
  if (tab === 'drafts') return 'No drafts saved.';
  return 'Inbox zero — enjoy it while it lasts.';
};

/** Builds the Quick Share picker's options from a list of drive items (recent files). */
const file_options: ComputedFunction = (args) => {
  const items = Array.isArray(args.items) ? (args.items as Record<string, unknown>[]) : [];
  return items
    .filter((it) => !it.folder) // folders aren't shareable via this tile — files only
    .map((it) => ({ value: String(it.id ?? ''), label: String(it.name ?? 'Untitled') }))
    .filter((o) => o.value);
};

/** Finds the selected file's full record (name, webUrl) by id, for display after picking. */
const selected_file: ComputedFunction = (args) => {
  const items = Array.isArray(args.items) ? (args.items as Record<string, unknown>[]) : [];
  const id = String(args.fileId ?? '').trim();
  if (!id) return null;
  return items.find((it) => String(it.id ?? '') === id) ?? null;
};

/**
 * Splits a list_files/search_files result into folders vs files — rendered
 * as two separate lists (folders first) since each needs different click
 * behavior (drill in vs open in browser), which a single repeat block over
 * mixed item types can't branch on per-row.
 */
const folder_items: ComputedFunction = (args) => {
  const items = Array.isArray(args.items) ? (args.items as Record<string, unknown>[]) : [];
  return items.filter((it) => Boolean(it.folder));
};

const file_items: ComputedFunction = (args) => {
  const items = Array.isArray(args.items) ? (args.items as Record<string, unknown>[]) : [];
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
const merge_recent_files: ComputedFunction = (args) => {
  const recent = Array.isArray(args.recent) ? (args.recent as Record<string, unknown>[]) : [];
  const allFiles = Array.isArray(args.files) ? (args.files as Record<string, unknown>[]) : [];
  const limit = Number(args.limit) || 10;

  if (recent.length >= limit) return recent.slice(0, limit);

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

// Graph returns dateTime strings without a timezone suffix on some fields
// (e.g. `2026-10-07T04:30:00.0000000`), which JS `Date()` would otherwise
// parse as local time. Append Z when no offset is present, matching the
// parsing convention used elsewhere in this codebase for Graph instants.
function toEpochMs(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') return raw;
  if (typeof raw !== 'string') return null;
  const hasOffset = /[Zz]$|[+-]\d{2}:?\d{2}$/.test(raw);
  const parsed = Date.parse(hasOffset ? raw : raw + 'Z');
  return Number.isFinite(parsed) ? parsed : null;
}

function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// ── smart_day_label ───────────────────────────────────────────────────
// "10:02 AM" for today, "Yesterday" for yesterday, a short weekday name
// ("Mon") for the rest of the past week, and a short date ("5 Jan") for
// anything older — the common "recent activity" day-bucketing pattern
// (seen in Teams/Outlook itself), which no system $computed provides.
// Args: { value: string | number }
const smart_day_label: ComputedFunction = (args) => {
  const ms = toEpochMs(args.value);
  if (ms == null) return '';

  const dayMs = 24 * 60 * 60 * 1000;
  const today = startOfLocalDay(Date.now());
  const day = startOfLocalDay(ms);
  const diffDays = Math.round((today - day) / dayMs);

  if (diffDays === 0) {
    return new Date(ms).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) {
    return new Date(ms).toLocaleDateString('en-AU', { weekday: 'short' });
  }
  // Future-dated (diffDays < 0) or older than a week — short absolute date.
  return new Date(ms).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
};

// ── name_tone ─────────────────────────────────────────────────────────
// Deterministic per-name color for an avatar chip, so the same person
// always gets the same color across rows. Uses the real `chart-1..5`
// decorative-color tokens (TILE-DISPLAY-STANDARDS.md §7) — 5 genuinely
// distinct hues — rather than the system's built-in avatar tint hash
// (ActivityItem's tintForInitials), which cycles through a 5-tone set
// where 3 of the 5 (info/muted/default) render as plain gray/foreground
// text, not a real color. Explicitly passing `tone` to Avatar bypasses
// that built-in hash entirely.
// Args: { value: string }
const name_tone: ComputedFunction = (args) => {
  const raw = String(args.value ?? '').trim();
  const CHART_TONES = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'];
  if (!raw) return CHART_TONES[0];
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  }
  return CHART_TONES[hash % CHART_TONES.length];
};

function emailDomain(address: unknown): string {
  const s = String(address ?? '').trim().toLowerCase();
  const at = s.lastIndexOf('@');
  return at >= 0 ? s.slice(at + 1) : '';
}

// ── meeting_type ──────────────────────────────────────────────────────
// "Internal" if every attendee shares the organizer's email domain,
// "External" if at least one attendee is on a different domain — the
// standard domain-comparison heuristic (Graph's calendar event resource
// has no dedicated internal/external field). Returns '' (unknown, not a
// guess) when the organizer's own address is missing, so callers can hide
// the indicator rather than show a wrong one.
// Args: { organizerEmail: string, attendees: { emailAddress: { address: string } }[] }
const meeting_type: ComputedFunction = (args) => {
  const organizerDomain = emailDomain(args.organizerEmail);
  if (!organizerDomain) return '';
  const attendees = Array.isArray(args.attendees) ? (args.attendees as Record<string, unknown>[]) : [];
  const isExternal = attendees.some((a) => {
    const addr = (a.emailAddress as Record<string, unknown> | undefined)?.address;
    const domain = emailDomain(addr);
    return domain !== '' && domain !== organizerDomain;
  });
  return isExternal ? 'External' : 'Internal';
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Local "today" as "YYYY-MM-DD" — the format DateInput both expects and emits. */
function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

/**
 * `/ui/selectedDate` starts unset until the user picks a date — seed it to
 * today once (idempotent: once `current` is truthy, this just echoes it back
 * unchanged, so it's safe to re-run every time the watched list re-fetches,
 * including after the user has picked a different date). Mirrors
 * zoom_seed_default_tab's exact current-or-fallback shape.
 * Args: { current: string }
 */
const seed_default_date: ComputedFunction = (args) => {
  const current = String(args.current ?? '').trim();
  return current || todayDateString();
};

function parseDateParts(raw: unknown): { y: number; mo: number; d: number } | null {
  const m = String(raw ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return { y: Number(m[1]), mo: Number(m[2]) - 1, d: Number(m[3]) };
}

/** "YYYY-MM-DD" → local midnight of that day, as a UTC ISO string. Args: { value: string } */
const day_start_iso: ComputedFunction = (args) => {
  const p = parseDateParts(args.value);
  return p ? new Date(p.y, p.mo, p.d, 0, 0, 0, 0).toISOString() : '';
};

/** "YYYY-MM-DD" → local 23:59:59.999 of that day, as a UTC ISO string. Args: { value: string } */
const day_end_iso: ComputedFunction = (args) => {
  const p = parseDateParts(args.value);
  return p ? new Date(p.y, p.mo, p.d, 23, 59, 59, 999).toISOString() : '';
};

/**
 * "Today's Schedule" when `value` is today's date, otherwise "Schedule for
 * <weekday>, <day> <month>" — the heading needs to track whichever date is
 * actually selected once the date picker can show a day other than today.
 * Args: { value: string } — "YYYY-MM-DD"
 */
const schedule_title: ComputedFunction = (args) => {
  const raw = String(args.value ?? '').trim();
  if (!raw || raw === todayDateString()) return "Today's Schedule";
  const p = parseDateParts(raw);
  if (!p) return "Today's Schedule";
  const d = new Date(p.y, p.mo, p.d);
  return `Schedule for ${d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}`;
};

const elements: PluginElementsModule = {
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
    smart_day_label,
    name_tone,
    meeting_type,
    seed_default_date,
    day_start_iso,
    day_end_iso,
    schedule_title,
  },
};

export default elements;
