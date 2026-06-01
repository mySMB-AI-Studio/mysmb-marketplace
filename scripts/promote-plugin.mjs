#!/usr/bin/env node
/**
 * Promote a single plugin from one branch tier to the next (e.g. graduate it
 * from `staging` to `main`). Copies the plugin directory from the source branch
 * into the working tree and upserts its entry in `.claude-plugin/marketplace.json`
 * from the source branch's manifest.
 *
 *   node scripts/promote-plugin.mjs <plugin> [--from staging] [--to main]
 *
 * Workflow:
 *   git checkout <to>            # e.g. main
 *   node scripts/promote-plugin.mjs xero-scheduler --from staging
 *   node scripts/normalize-mcp-urls.mjs            # belt-and-braces
 *   npx tsx scripts/validate.ts
 *   git add -A && git commit -m "feat: promote xero-scheduler staging -> main"
 *
 * This does NOT push or switch branches for you — it only stages file content,
 * so you stay in control of the commit and target branch.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const plugin = args.find((a) => !a.startsWith('--'));
const getFlag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const from = getFlag('from', 'staging');
const to = getFlag('to', 'main');

if (!plugin) {
  console.error('usage: promote-plugin.mjs <plugin> [--from staging] [--to main]');
  process.exit(2);
}

const git = (...a) => execFileSync('git', a, { cwd: repoRoot, encoding: 'utf8' });

console.log(`Promoting "${plugin}": ${from} -> ${to}`);

// 1. Materialise the plugin dir from the source branch into the working tree.
const pluginRel = `plugins/${plugin}`;
rmSync(join(repoRoot, pluginRel), { recursive: true, force: true });
mkdirSync(join(repoRoot, pluginRel), { recursive: true });
// `git checkout <branch> -- <path>` stages + writes the source-branch content.
git('checkout', from, '--', pluginRel);

// 2. Upsert the plugin's marketplace.json entry from the source branch.
const manifestRel = '.claude-plugin/marketplace.json';
const srcManifest = JSON.parse(git('show', `${from}:${manifestRel}`));
const srcEntry = (srcManifest.plugins ?? []).find((p) => p.name === plugin);
if (!srcEntry) {
  console.error(`error: "${plugin}" not found in ${from}:${manifestRel}`);
  process.exit(1);
}
const destPath = join(repoRoot, manifestRel);
const destManifest = JSON.parse(readFileSync(destPath, 'utf8'));
const idx = (destManifest.plugins ?? []).findIndex((p) => p.name === plugin);
if (idx >= 0) destManifest.plugins[idx] = srcEntry;
else destManifest.plugins.push(srcEntry);
writeFileSync(destPath, JSON.stringify(destManifest, null, 2) + '\n');

console.log(`Staged ${pluginRel} and updated ${manifestRel}.`);
console.log('Next: run scripts/normalize-mcp-urls.mjs + scripts/validate.ts, then commit.');
