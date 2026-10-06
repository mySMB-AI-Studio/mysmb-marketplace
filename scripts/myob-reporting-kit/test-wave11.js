// Taxable Payments Annual Report (M14), a written specification until now, on fixtures-tpar.js (supplier cards, bills with their own
// reportable flag, supplier payments, spend money and the payments' journals), with tampered sources that must fail.
const { run } = require('./harness.js'); const V = require('./fixtures-tpar.js'); const L = require('./ledger.js'); const fs = require('fs'), path = require('path');
const man = (n) => JSON.parse(fs.readFileSync(path.join(process.env.KIT_DIR || __dirname, 'reports', n + '.manifest.json'), 'utf8'));
const text = (doc, sel) => (doc.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' ');
let total = 0, fails = 0;
const ok = (name, cond, info) => { total++; if (cond) console.log('  ✓ ' + name); else { fails++; console.log('  FAIL ' + name + (info !== undefined ? ' ' + (typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 700) : '')); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const banner = (t) => text(t.doc, '#mk-banner'), green = (t) => t.doc.querySelector('#mk-banner').className.includes('pass'), red = (t) => t.doc.querySelector('#mk-banner').className.includes('fail');
const TOOL = { list_supplier_payments: V.listSupplierPayments, list_bills: V.listBills, list_spend_money: V.listSpendMoney, list_suppliers: V.listSuppliers, list_journal_transactions: V.listJournalTransactions, list_company_files: V.companyFiles };
const calls = [];
const FX = (m, over) => { const f = {}; m.bindings.forEach((b) => { f[b.id] = (p) => { calls.push([b.id, p]); return TOOL[b.tool.name](p); }; }); return Object.assign(f, over || {}); };
const onFile = (m, set) => { const c = JSON.parse(JSON.stringify(m)); c.inputs.find((i) => i.name === 'company_file').default = L.CF1; Object.keys(set || {}).forEach((k) => { c.inputs.find((i) => i.name === k).default = set[k]; }); return c; };
const disp = (patch) => { const d = JSON.parse(man('tp').inputs.find((i) => i.name === 'display').default); return JSON.stringify(Object.assign(d, patch)); };
const go = async (over, set) => { const m = onFile(man('tp'), set); const t = await run('tp', m, FX(m, over), { bundleInputs: true }); await wait(80); return t; };
const kpi = (t, l) => { const k = [...t.doc.querySelectorAll('.mk-kpi')].find((x) => text(x, '.lbl') === l); return k ? text(k, '.val') : null; };
const rowOf = (t, first) => { const r = [...t.doc.querySelectorAll('#tp-grid tbody tr')].find((x) => x.cells[0] && x.cells[0].textContent.trim() === first); return r ? [...r.cells].map((c) => c.textContent.trim()) : null; };
(async () => {
  calls.length = 0; let t = await go();
  ok('TPAR: last financial year, 4/4 checks — the payments match MYOB\'s journals', t.errs.length === 0 && green(t) && /4\/4 checks passed/.test(banner(t)) && /6 supplier payments \(\$7,370\.00\) and 5 spend money \(\$1,955\.00\) — the same in MYOB's journals/.test(banner(t)), [t.errs, banner(t).slice(0, 500)]);
  ok('TPAR: 3 payees, $5,060.00 gross, $460.00 GST, every ABN valid', kpi(t, 'Payees') === '3' && kpi(t, 'Gross paid (incl. GST)') === '$5,060.00' && kpi(t, 'GST') === '$460.00' && kpi(t, 'Payees without a valid ABN') === '0', ['Payees', 'Gross paid (incl. GST)', 'GST'].map((l) => kpi(t, l)));
  ok('TPAR: Sparky — the June 2025 bill paid in July counts, the June 2026 bill paid in July 2026 does not, the unflagged bill does not', (rowOf(t, 'Sparky Electrical Pty Ltd') || []).join('|') === 'Sparky Electrical Pty Ltd|51 824 753 556|$3,300.00|$0.00|$3,300.00|$300.00', rowOf(t, 'Sparky Electrical Pty Ltd'));
  ok('TPAR: Jo Smith (an individual) paid by spend money; Quick Couriers\' bill paid in two parts', (rowOf(t, 'Jo Smith') || []).slice(2).join('|') === '$0.00|$1,320.00|$1,320.00|$120.00' && (rowOf(t, 'Quick Couriers') || []).slice(2).join('|') === '$440.00|$0.00|$440.00|$40.00', [rowOf(t, 'Jo Smith'), rowOf(t, 'Quick Couriers')]);
  ok('TPAR: information — a TPAR supplier\'s bill not marked reportable, and the spend money left out', /Payments to suppliers set up for taxable payments, on bills not marked reportable — 1 payments, \$330\.00/.test(banner(t)) && /Spend money not reported .* — 3 of 5/.test(banner(t)), banner(t).slice(0, 900));
  ok('TPAR: bills are read from a year before the start (bills paid this year can be older)', calls.some(([id, p]) => id === 'bills' && p.from_date === '2024-07-01' && p.to_date === '2026-06-30' && p.status === 'All'), calls.filter((c) => c[0] === 'bills').map((c) => c[1]));
  t = await go(null, { display: disp({ v: 'detail' }) });
  const refs = [...t.doc.querySelectorAll('#tp-grid tbody tr')].map((r) => r.cells[3].textContent.trim());
  ok('TPAR: the payments view lists the 6 reportable payments with their references', refs.join(',') === 'CP1001 → bill B1001,CS2001,CP1002 → bill B1002,CP1005 → bill B1005,CP1006 → bill B1005,CS2002', refs);
  // ---------------- tampered sources
  t = await go({ payments: (p) => { const r = V.listSupplierPayments(p); r.Items = r.Items.filter((x) => x.PaymentNumber !== 'CP1002'); r.Count = r.Items.length; return r; } });
  ok('TPAR: a supplier payment missing from the list (it is in the journals) fails the tie', red(t) && /✗ The supplier payments and spend money read = MYOB's journals/.test(banner(t)) && /supplier payments: journals 6 .* vs read 5/.test(banner(t)), banner(t).slice(0, 400));
  t = await go({ suppliers: (p) => { const r = V.listSuppliers(p); r.Items.find((x) => x.Name === 'Jo Smith').ABN = '53 004 085 617'; return r; } });
  ok('TPAR: an ABN with wrong check digits fails and is named', red(t) && /✗ Every reportable payee has an ABN with valid check digits — Jo Smith \(53 004 085 617 — not valid\)/.test(banner(t)) && kpi(t, 'Payees without a valid ABN') === '1', banner(t).slice(0, 400));
  t = await go({ bills: (p) => { const r = V.listBills(p); r.Items = r.Items.filter((x) => x.Number !== 'B1001'); return r; } });
  ok('TPAR: a payment whose bill is not read is unmatched — fails, never counted', red(t) && /✗ Every bill payment is matched to its bill .*1 unmatched \$1,100\.00/.test(banner(t)) && kpi(t, 'Gross paid (incl. GST)') === '$3,960.00', [banner(t).slice(0, 400), kpi(t, 'Gross paid (incl. GST)')]);
  t = await go({ spend: (p) => { const r = V.listSpendMoney(p); r.Items.find((x) => x.PaymentNumber === 'CS2002').IsReportable = false; return r; } });
  ok('TPAR: MYOB\'s own "not reportable" on a spend money transaction is honoured', (rowOf(t, 'Jo Smith') || [])[3] === '$660.00' && green(t), rowOf(t, 'Jo Smith'));

  console.log(fails ? `\n${fails}/${total} checks FAILED` : `\nALL ${total} checks passed`);
  process.exit(fails ? 1 : 0);
})();
