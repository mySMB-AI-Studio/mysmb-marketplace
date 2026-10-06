// node mk-libraries.js — writes libraries.json: every report template the three platform reporting studios ship
// (plugins/<platform>-reporting-studio/reports/<slug>/report.json), for CRA-16. The catalogue lists them under
// "Platform reports" for the selected client's platform, and the platform-reports skill routes to them with
// artifact_from_template. `client` is the template input that selects the client (LIB-002): Xero `org`
// (xero_tenant_id), MYOB `company_file` (myob_company_file_id); QuickBooks has none (one company per connection).
const fs = require('fs'), path = require('path');
const PLUGINS = path.join(__dirname, '..', '..', 'plugins');
const STUDIO = { xero: 'xero-reporting-studio', myob: 'myob-reporting-studio', quickbooks: 'quickbooks-reporting-studio' };
const CLIENT = { xero: 'org', myob: 'company_file', quickbooks: null };
const out = {};
for (const [p, plugin] of Object.entries(STUDIO)) {
  const dir = path.join(PLUGINS, plugin, 'reports');
  const list = fs.readdirSync(dir).filter((s) => fs.existsSync(path.join(dir, s, 'report.json'))).map((slug) => {
    const j = JSON.parse(fs.readFileSync(path.join(dir, slug, 'report.json'), 'utf8'));
    const inputs = ((j.dataBindings && j.dataBindings.inputs) || []).map((i) => i.name);
    const client = CLIENT[p] && inputs.includes(CLIENT[p]) ? CLIENT[p] : null;
    if (CLIENT[p] && !client) throw new Error(plugin + '/' + slug + ' has no ' + CLIENT[p] + ' input: the client could not be passed');
    const d = String(j.description || '');
    const code = ((j.tags || []).find((t) => /^[PMQ]\d{2}[a-z]?$/i.test(t)) || (d.match(/\(([PMQ]\d{2}[a-z]?)\)/i) || [])[1] || '').toUpperCase();
    // the part after "<name> (code):" or "<name> —", i.e. what the report shows, first sentence, ≤ 160 characters
    const rest = d.replace(/^[^:—]*?(?:\([PMQ]\d{2}[a-z]?\))?\s*(?::|—)\s*/i, '');
    const blurb = (rest === d ? '' : rest).split(/(?<=\.)\s/)[0].replace(/\.$/, '').slice(0, 160);
    return { slug, title: j.title, code, blurb, client };
  }).sort((a, b) => a.title.localeCompare(b.title));
  out[p] = { plugin, client: CLIENT[p], reports: list };
  console.log(p, list.length, 'templates');
}
fs.writeFileSync(path.join(__dirname, 'libraries.json'), JSON.stringify(out, null, 1) + '\n');
