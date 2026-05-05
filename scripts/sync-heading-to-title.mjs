#!/usr/bin/env node
/**
 * Title-case sweep for widget Heading texts. Converts the FIRST Heading
 * with a string `text` in each widget JSON to AP-style Title Case while
 * preserving the original wording. Skips computed/template texts.
 *
 * Rule: capitalize every word EXCEPT short connectors when they're not
 * the first or last word: a, an, and, as, at, but, by, for, in, of, on,
 * or, the, to, vs, with.
 *
 * Run: node scripts/sync-heading-to-title.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLUGINS_DIR = path.join(ROOT, 'plugins');

const SMALL_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'of',
  'on', 'or', 'the', 'to', 'vs', 'with',
]);

function titleCaseWord(word) {
  // Preserve all-caps acronyms (VIP, P&L, AI, etc.)
  if (/^[A-Z0-9&]+$/.test(word)) return word;
  // Preserve mixed-case (OneDrive, McSomething)
  if (/[A-Z]/.test(word.slice(1))) return word;
  // Otherwise: capitalize first char, lowercase rest
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function titleCase(input) {
  // Split on whitespace AND on intra-word boundaries (slashes, hyphens)
  // so each segment is title-cased. The separators are kept verbatim.
  // Apostrophes are NOT split — "Today's" stays one token.
  const tokens = input.split(/(\s+|[/\-])/);
  const wordIndices = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].length > 0 && !/^(\s+|[/\-])$/.test(tokens[i])) wordIndices.push(i);
  }
  const firstIdx = wordIndices[0];
  const lastIdx = wordIndices[wordIndices.length - 1];
  for (const idx of wordIndices) {
    const w = tokens[idx];
    const lower = w.toLowerCase();
    // Treat as small word only when separated by whitespace from
    // neighbours — never lowercase in a hyphenated/slash compound
    // (e.g. "End-of-Day" should stay capped on every segment).
    const prev = tokens[idx - 1] ?? '';
    const next = tokens[idx + 1] ?? '';
    const hasWhitespaceNeighbour = /^\s+$/.test(prev) || /^\s+$/.test(next) || idx === firstIdx || idx === lastIdx;
    const isInCompound = /^[/\-]$/.test(prev) || /^[/\-]$/.test(next);
    if (
      idx !== firstIdx &&
      idx !== lastIdx &&
      hasWhitespaceNeighbour &&
      !isInCompound &&
      SMALL_WORDS.has(lower)
    ) {
      tokens[idx] = lower;
    } else {
      tokens[idx] = titleCaseWord(w);
    }
  }
  return tokens.join('');
}

function walk(obj, visit) {
  if (Array.isArray(obj)) {
    for (const item of obj) walk(item, visit);
    return;
  }
  if (obj && typeof obj === 'object') {
    visit(obj);
    for (const k of Object.keys(obj)) walk(obj[k], visit);
  }
}

let files = 0;
let changed = 0;
const diffs = [];

for (const plugin of fs.readdirSync(PLUGINS_DIR)) {
  const widgetsDir = path.join(PLUGINS_DIR, plugin, 'widgets');
  if (!fs.existsSync(widgetsDir)) continue;
  for (const file of fs.readdirSync(widgetsDir)) {
    if (!file.endsWith('.json')) continue;
    files++;
    const full = path.join(widgetsDir, file);
    const raw = fs.readFileSync(full, 'utf8');
    const spec = JSON.parse(raw);

    let firstHeading = null;
    walk(spec.spec, (node) => {
      if (firstHeading) return;
      if (node.type === 'Heading' && node.props && typeof node.props.text === 'string') {
        firstHeading = node;
      }
    });
    if (!firstHeading) continue;

    const before = firstHeading.props.text;
    const after = titleCase(before);
    if (before !== after) {
      diffs.push(`${plugin}/${file}: "${before}" -> "${after}"`);
      firstHeading.props.text = after;
      fs.writeFileSync(full, JSON.stringify(spec, null, 2) + '\n');
      changed++;
    }
  }
}

console.log(`Scanned ${files} widget JSON files, updated ${changed}.`);
for (const d of diffs) console.log('  ' + d);
