// Shared helpers for the QuickBooks CRA tests: a second company built from any fixture set (LIB-002 isolation), Excel text
// extraction (the kit's .xlsx is a stored, uncompressed zip, so its XML is readable as is), and the template-copy conformance run.
const { run, suite } = require('../harness.js');
const F = require('../../quickbooks-reporting-kit/fixtures.js');

// Company 2: every named row (accounts, contacts: cells carrying an id) and every entity name is renamed, and every amount doubled,
// so no label or figure of company 1 survives. CompanyInfo names the other company.
const CO2 = 'Harbour Bakery Pty Ltd';
function rename(s, id) { return 'HB ' + (id || 'x') + ' ' + String(s).length; }
function toCo2(resp) {
  const o = JSON.parse(JSON.stringify(resp));
  (function walk(n) {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== 'object') return;
    if (n.ColData) n.ColData.forEach((c, i) => {
      if (i === 0 && c.id) c.value = rename(c.value, c.id);
      else if (i > 0 && c.value !== '' && /^-?\d+(\.\d+)?$/.test(String(c.value))) c.value = (Number(c.value) * 2).toFixed(2);
      else if (i > 0 && c.value && !/^\d{4}-\d\d-\d\d$/.test(c.value) && !/%$/.test(c.value)) c.value = rename(c.value, 'v');
    });
    for (const k of Object.keys(n)) {
      if (k === 'CompanyName' || k === 'LegalName') n[k] = CO2;
      else if ((k === 'Name' || k === 'DisplayName' || k === 'name') && typeof n[k] === 'string' && !n.ColTitle) n[k] = rename(n[k], n.Id || n.value);
      else if (/^(TotalAmt|Balance|CurrentBalance|Amount|NetAmountTaxable|TotalTax|TaxAmount|TaxInclusiveAmt)$/.test(k) && typeof n[k] === 'number') n[k] = Math.round(n[k] * 200) / 100;
      else if (k === 'DocNumber' && n[k]) n[k] = 'HB-' + n[k];
      else walk(n[k]);
    }
  })(o);
  return o;
}
const co2fx = (fx) => { const o = {}; for (const k of Object.keys(fx)) { const f = fx[k]; o[k] = (p) => toCo2(f(p)); } return o; };

async function xlsxText(t) {
  t.doc.getElementById('qb-xlsx').click(); await t.settle(20);
  const d = t.downloads.filter((x) => x.blob).pop(); if (!d) return '';
  return Buffer.from(await d.blob.arrayBuffer()).toString('utf8');
}
const text = (d, sel) => (d.querySelector(sel) || {}).textContent || '';
const banner = (t) => text(t.doc, '#qb-banner');
const red = (t) => t.doc.querySelector('#qb-banner').className.includes('fail');
async function set(t, id, val) { const el = t.doc.getElementById(id); el.value = val; el.dispatchEvent(new t.w.Event('change')); await t.settle(); }
async function radio(t, name, val) { const el = [...t.doc.querySelectorAll('input[name="' + name + '"]')].find((r) => r.value === val); el.checked = true; el.dispatchEvent(new t.w.Event('change')); await t.settle(); }

// Template copy (artifact_from_template / "Use this report" after a change): the manifest defaults carry the copy's inputs, the
// document keeps the template's own defaults, and the kit must adopt bundle.inputs.
async function conformance(ok, ref, manifest, fx, changedInputs, expectPeriod) {
  const persona = manifest.inputs.find((i) => i.name === 'persona'), display = manifest.inputs.find((i) => i.name === 'display');
  const d = JSON.parse(display.default); d.p = 'custom'; d.cents = d.cents ? 0 : 1;
  const changed = Object.assign({}, changedInputs, { persona: persona.options.find((o) => o !== persona.default), display: JSON.stringify(d) });
  const copy = JSON.parse(JSON.stringify(manifest)); copy.inputs.forEach((i) => { if (i.name in changed) i.default = changed[i.name]; });
  const t = await run(ref, copy, fx, { bundleInputs: true });
  ok('copy: no script errors', t.errs.length === 0, t.errs);
  ok('copy: View as shows the copy\'s value', (t.doc.getElementById('qb-persona') || {}).value === changed.persona);
  const said = t.setInputsLog[0] || {};
  Object.keys(changedInputs).forEach((k) => ok('copy: announces the copy\'s ' + k, said[k] === changed[k], [said[k], changed[k]]));
  ok('copy: header shows the copy\'s period', text(t.doc, '#qb-head .pe').startsWith(expectPeriod), text(t.doc, '#qb-head .pe'));
  const dated = manifest.inputs.filter((i) => i.type === 'date' && i.name in changedInputs);
  const stray = t.calls.filter((c) => c.requery && dated.some((i) => Object.values(c.params).includes(i.default)));
  ok('copy: no request at the template\'s own dates', stray.length === 0, stray);
  ok('copy: banner not failing', !red(t), banner(t).slice(0, 300));
  return t;
}
module.exports = { run, suite, F, toCo2, co2fx, CO2, xlsxText, text, banner, red, set, radio, conformance };
