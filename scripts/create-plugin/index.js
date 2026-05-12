#!/usr/bin/env node
// create-mysmb-plugin
//
// Scaffolds a new mySMB plugin project with:
//   - plugin/         the plugin folder (validates against scripts/validate.ts)
//   - harness/        a Vite + React widget harness with an MCP client
//   - .claude/        skills + agents that teach Claude Code how to build plugins
//   - CLAUDE.md       project orientation for Claude Code
//
// Usage (after publish):
//     npx create-mysmb-plugin <slug>
//
// Usage today (from GitHub):
//     npx github:mySMB-AI-Studio/mysmb-marketplace create-mysmb-plugin <slug>
//
// Usage local:
//     node scripts/create-plugin/index.js <slug> [target-dir]

import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = join(__dirname, 'template');

function usage() {
  console.error('usage: create-mysmb-plugin <slug> [target-dir]');
  console.error('  slug         lowercase, hyphen-separated, e.g. acme-billing');
  console.error('  target-dir   optional. defaults to ./<slug>');
  process.exit(1);
}

const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
if (args.length === 0) usage();

const slug = args[0];
if (!/^[a-z][a-z0-9-]*$/.test(slug)) {
  console.error(`error: slug "${slug}" must match ^[a-z][a-z0-9-]*$`);
  process.exit(1);
}
const targetDir = resolve(process.cwd(), args[1] ?? slug);
const displayName = slug
  .split('-')
  .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
  .join(' ');
const envPrefix = slug.toUpperCase().replace(/-/g, '_');

if (existsSync(targetDir) && readdirSync(targetDir).length > 0) {
  console.error(`error: target directory ${targetDir} exists and is not empty`);
  process.exit(1);
}

const SUBS = {
  __SLUG__: slug,
  __NAME__: displayName,
  __ENV_PREFIX__: envPrefix,
};

function substitute(text) {
  let out = text;
  for (const [k, v] of Object.entries(SUBS)) out = out.split(k).join(v);
  return out;
}

function copyTree(srcDir, destDir) {
  mkdirSync(destDir, { recursive: true });
  for (const entry of readdirSync(srcDir)) {
    const srcPath = join(srcDir, entry);
    // Strip the .tmpl suffix; substitute placeholders in entry names.
    const cleaned = entry.endsWith('.tmpl') ? entry.slice(0, -'.tmpl'.length) : entry;
    // _gitignore -> .gitignore (npm strips .gitignore from published packages).
    const renamed = cleaned === '_gitignore' ? '.gitignore' : substitute(cleaned);
    const destPath = join(destDir, renamed);
    const s = statSync(srcPath);
    if (s.isDirectory()) {
      copyTree(srcPath, destPath);
    } else {
      const buf = readFileSync(srcPath);
      // Substitute only files we recognise as text. .tmpl always gets substituted;
      // others get substituted too (cheap, our placeholders are unique enough).
      const isLikelyText = /\.(md|json|ts|tsx|js|mjs|cjs|html|css|tmpl|txt|yml|yaml)$/.test(entry) || entry === '_gitignore';
      if (isLikelyText) {
        writeFileSync(destPath, substitute(buf.toString('utf8')));
      } else {
        writeFileSync(destPath, buf);
      }
    }
  }
}

console.log(`Scaffolding ${displayName} at ${relative(process.cwd(), targetDir) || '.'}`);
copyTree(TEMPLATE_DIR, targetDir);

console.log('');
console.log('Done.');
console.log('');
console.log('Next steps:');
console.log(`  cd ${relative(process.cwd(), targetDir) || '.'}`);
console.log('  npm install');
console.log('  npm run dev      # starts the widget harness on http://localhost:5173');
console.log('');
console.log('Then, in another terminal:');
console.log('  claude            # launches Claude Code in this folder');
console.log('  > /skills         # see the plugin-authoring skills you have');
console.log('');
console.log(`When you're ready to publish, copy plugin/ into the marketplace repo at`);
console.log(`  mySMB-Plugin-Marketplace/Plugins/plugins/${slug}/`);
console.log(`and add an entry to .claude-plugin/marketplace.json.`);
