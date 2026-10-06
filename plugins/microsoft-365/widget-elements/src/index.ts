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

const elements: PluginElementsModule = {
  slug: 'microsoft-365',
  functions: {
    format_bytes,
    item_tone,
    item_icon,
    file_options,
    selected_file,
    folder_items,
    file_items,
    merge_recent_files,
  },
};

export default elements;
