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
const agent = readJson(path.join(plugin, 'content/agents/a5cac7e0-9ba5-4a87-966c-ae85fcba1585.json'));
// workspace:workq and the report-to-WorkQ skill: Reporting Library LIB-006 (scripts/reporting-shared/agent-skills.cjs)
assert.deepEqual(agent.connectors, ['quickbooks-accounting', 'workspace:workq']);
assert.deepEqual(agent.skills, ['quickbooks-report-foundation', ...families.map((f) => f.skill), 'quickbooks-report-to-workq'].map((s) => 'quickbooks-reporting-studio:' + s));
for (const f of deferredFamilies) {
  assert(!templates.includes(f.skill), f.skill + ' template must not be discoverable');
  assert(!fs.existsSync(path.join(plugin, 'skills', f.skill + '.md')), f.skill + ' skill must not be discoverable');
  assert(!agent.rolePrompt.includes('→ quickbooks-reporting-studio:' + f.skill));
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
console.log('PASS release package: 30 templates, supported agent routes/connectors, 37 catalogue cards, deferred source retained');
