// Check the installed package, not just source metadata: no deferred discovery path may survive generation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { families, deferredFamilies } = require('./release-families.js');
const plugin = path.resolve(__dirname, '../../plugins/quickbooks-reporting-studio');
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const templates = fs.readdirSync(path.join(plugin, 'reports'));
assert.equal(templates.length, 30);
assert(templates.includes('quickbooks-employees-and-time'), 'Q31 remains available');
// No agent since 2026-11-12: mySidekick loads the skills, and the foundation carries the routing list.
assert(!fs.existsSync(path.join(plugin, 'agents')) && !fs.existsSync(path.join(plugin, 'content/agents')), 'plain extension: no agent');
const foundation = fs.readFileSync(path.join(plugin, 'skills/quickbooks-report-foundation.md'), 'utf8');
for (const f of families) assert(foundation.includes('→ `quickbooks-reporting-studio:' + f.skill + '`'), 'the foundation routes ' + f.skill);
for (const s of ['quickbooks-schedule-report', 'quickbooks-report-to-workq']) assert(fs.existsSync(path.join(plugin, 'skills', s + '.md')), s + ' ships (LIB-003, LIB-006)');
for (const f of deferredFamilies) {
  assert(!templates.includes(f.skill), f.skill + ' template must not be discoverable');
  assert(!fs.existsSync(path.join(plugin, 'skills', f.skill + '.md')), f.skill + ' skill must not be discoverable');
  assert(!foundation.includes('→ `quickbooks-reporting-studio:' + f.skill + '`'), f.skill + ' must not be routed');
  for (const suffix of ['.manifest.json', '.cfg.js']) {
    assert(fs.existsSync(path.join(__dirname, 'reports', f.id + suffix)), 'deferred source must be retained');
  }
}
for (const slug of templates) {
  const report = readJson(path.join(plugin, 'reports', slug, 'report.json'));
  assert(report.dataBindings.bindings.every((b) => b.tool.mcp === 'quickbooks-accounting'), slug + ' has an unsupported connector');
}
const catalogue = readJson(path.join(__dirname, 'reports/catalogue.data.json'));
assert.equal(catalogue.length, 37); // 35 families/guides plus Q38/Q39 delivery contracts.
assert(!catalogue.some((r) => ['Q32', 'Q33', 'Q34'].includes(r.q)));
assert.equal(readJson(path.join(__dirname, 'catalogue-index.json')).length, 40, 'full source index retained');
console.log('PASS release package: 30 templates, no agent, foundation routes every family, 37 catalogue cards, deferred source retained');
