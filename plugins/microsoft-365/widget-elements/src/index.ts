/**
 * microsoft-365 — widget-elements module
 * ──────────────────────────────────────────────────────────────────
 * Connector-specific `$computed` helpers contributed to the host's
 * widgets-system at runtime. The host prepends the slug `microsoft-365_`
 * to every name in `functions`, so e.g. the spec-side reference is
 * `microsoft-365_smart_day_label`.
 */

import type { ComputedFunction, PluginElementsModule } from './types';

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
  },
};

export default elements;
