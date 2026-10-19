// Size limit for every generated template as it ships (plugins/client-report-analytics/reports). The agent never writes these
// documents (Use this report, or artifact_from_template), so the 35,000-token limit for documents the agent writes in one turn
// is raised to each platform's cap, as for the live-checks templates: Xero 40,000 (pruned kit), MYOB 47,000 and QuickBooks
// 46,000 (whole kits). The catalogue is a small standalone document and keeps 35,000. Line length is not checked here: it
// matters for skill files the agent reads (gen-ext.js checks those), not for a template the platform copies as it is.
const fs = require('fs'), path = require('path');
const { suite } = require('../harness.js');
const { ok, done } = suite('template-sizes');
const DIR = path.resolve(__dirname, '..', '..', '..', 'plugins', 'client-report-analytics', 'reports');
const CAP = { xero: 40000, myob: 47000, quickbooks: 46000 };
const { countTokens } = require(path.join(__dirname, '../../xero-reporting-kit/node_modules/@anthropic-ai/tokenizer'));
const rd = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

const slugs = fs.readdirSync(DIR).filter((d) => fs.existsSync(path.join(DIR, d, 'report.html'))).sort();
ok('every template folder found (' + slugs.length + ')', slugs.length >= 39, slugs.length);
for (const s of slugs) {
  const html = rd(path.join(DIR, s, 'report.html')), mf = JSON.stringify(JSON.parse(rd(path.join(DIR, s, 'report.json'))).dataBindings || {});
  const plat = (/^client-(xero|myob|quickbooks)-/.exec(s) || [])[1], cap = plat ? CAP[plat] : 35000, tokens = countTokens(html) + countTokens(mf);
  ok(s + ': document + dataBindings ≤ ' + cap.toLocaleString('en-AU') + ' tokens (' + tokens.toLocaleString('en-AU') + ')', tokens <= cap, tokens);
}
done();
