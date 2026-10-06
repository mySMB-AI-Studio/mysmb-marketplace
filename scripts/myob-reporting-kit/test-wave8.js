// Inventory reports that were written specifications: Stock on Hand (M48), Reorder (M47), Item List (M51), Inventory Value
// Reconciliation (M52) — one inventory report — and Items Register (M50), on fixtures-inventory.js (consistent items, movements and
// Balance Sheet), with tampered sources that must fail.
const { run } = require('./harness.js'); const V = require('./fixtures-inventory.js'); const L = require('./ledger.js'); const fs = require('fs'), path = require('path');
const man = (n) => JSON.parse(fs.readFileSync(path.join(process.env.KIT_DIR || __dirname, 'reports', n + '.manifest.json'), 'utf8'));
const text = (doc, sel) => (doc.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' ');
let total = 0, fails = 0;
const ok = (name, cond, info) => { total++; if (cond) console.log('  ✓ ' + name); else { fails++; console.log('  FAIL ' + name + (info !== undefined ? ' ' + (typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 700) : '')); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const banner = (t) => text(t.doc, '#mk-banner'), green = (t) => t.doc.querySelector('#mk-banner').className.includes('pass'), red = (t) => t.doc.querySelector('#mk-banner').className.includes('fail');
const TOOL = { list_items: V.listItems, get_balance_sheet: V.balanceSheet, list_accounts: V.listAccounts, list_company_files: V.companyFiles, list_invoice_lines: V.listInvoiceLines, list_bill_lines: V.listBillLines, list_inventory_adjustments: V.listInventoryAdjustments };
const FX = (m, over) => { const f = {}; m.bindings.forEach((b) => { f[b.id] = TOOL[b.tool.name]; }); return Object.assign(f, over || {}); };
const onFile = (m, set) => { const c = JSON.parse(JSON.stringify(m)); c.inputs.find((i) => i.name === 'company_file').default = L.CF1; Object.keys(set || {}).forEach((k) => { c.inputs.find((i) => i.name === k).default = set[k]; }); return c; };
const go = async (r, over, set) => { const m = onFile(man(r), set); const t = await run(r, m, FX(m, over), { bundleInputs: true }); await wait(80); return t; };
const view = async (t, v) => { const el = t.doc.getElementById('mk-view'); el.value = v; el.dispatchEvent(new t.w.Event('change')); await t.settle(); await wait(30); };
const kpi = (t, l) => { const k = [...t.doc.querySelectorAll('.mk-kpi')].find((x) => text(x, '.lbl') === l); return k ? text(k, '.val') : null; };
const rowOf = (t, no) => { const r = [...t.doc.querySelectorAll('#mk-body tr')].find((x) => x.cells[0] && x.cells[0].textContent.trim() === no); return r ? [...r.cells].map((c) => c.textContent.trim()) : null; };
const disp = (r, patch) => { const d = JSON.parse(man(r).inputs.find((i) => i.name === 'display').default); return JSON.stringify(Object.assign(d, patch)); };
(async () => {
  // ---------------- Stock on Hand (M48)
  let t = await go('iv');
  ok('stock on hand: 2/2 checks — items\' value $4,108.00 = the inventory account; available = on hand − committed', t.errs.length === 0 && green(t) && /2\/2 checks passed/.test(banner(t)) && /\$4,108\.00 vs \$4,108\.00/.test(banner(t)), [t.errs, banner(t).slice(0, 400)]);
  ok('stock on hand: active inventoried items only (no service, no inactive)', !!rowOf(t, 'WID-100') && !!rowOf(t, 'GAD-300') && !rowOf(t, 'SVC-900') && !rowOf(t, 'OLD-050'));
  ok('stock on hand: WID-100 on hand 120, committed 10, on order 50, available 110, value $2,640.00', (rowOf(t, 'WID-100') || []).slice(2).join('|') === '120|10|50|110|$22.00|$2,640.00', rowOf(t, 'WID-100'));
  ok('stock on hand: no stock is highlighted', /Gadget mini \(no stock\)/.test(text(t.doc, '#mk-body')) && kpi(t, 'Out of stock') === '1');
  // ---------------- Reorder (M47)
  t = await go('ro');
  ok('reorder: own title, checks pass', text(t.doc, 'header .ti') === 'Reorder' && green(t), banner(t).slice(0, 300));
  const order = [...t.doc.querySelectorAll('#mk-body tbody tr')].map((r) => r.cells[0].textContent.trim());
  ok('reorder: WID-100 (30 below) before WID-200 (2 below); CAB-400 above minimum not listed', order.join(',') === 'WID-100,WID-200', order);
  ok('reorder: order quantity, supplier and estimated cost', (rowOf(t, 'WID-100') || []).slice(2).join('|') === '120|150|30|100|Metro Wholesale|$2,240.00', rowOf(t, 'WID-100'));
  ok('reorder: items without a minimum are counted, not invented', kpi(t, 'Items without a minimum level') === '1' && /GAD-300/.test(text(t.doc, '#mk-body')));
  // ---------------- Item List (M51)
  t = await go('it');
  ok('item list: every item, the service and the inactive one included and muted', text(t.doc, 'header .ti') === 'Item List' && kpi(t, 'Items') === '6' && !!rowOf(t, 'SVC-900') && [...t.doc.querySelectorAll('#mk-body tr.muted')].length === 1);
  const cb = t.doc.getElementById('iv-active'); cb.checked = true; cb.dispatchEvent(new t.w.Event('change')); await t.settle();
  ok('item list: active only hides the inactive item', !rowOf(t, 'OLD-050') && JSON.parse(t.setInputsLog[t.setInputsLog.length - 1].display).x === 'active');
  // ---------------- Inventory Value Reconciliation (M52)
  t = await go('vr');
  ok('inventory value reconciliation: items $4,108.00 vs account $4,108.00, nil difference, 3/3 checks', text(t.doc, 'header .ti') === 'Inventory Value Reconciliation' && kpi(t, 'Difference') === '$0.00' && green(t) && /3\/3 checks passed/.test(banner(t)) === false && /2\/2 checks passed/.test(banner(t)), [kpi(t, 'Difference'), banner(t).slice(0, 300)]);
  t = await go('vr', { bs: (p) => { const r = V.balanceSheet(p); r.AccountsBreakdown.find((x) => x.Account.DisplayID === '1-1300').AccountTotal = 4000; return r; } });
  ok('inventory value reconciliation: a different account balance fails, without guessing why', red(t) && /✗ Items' value = the inventory account/.test(banner(t)) && /cannot tell a manual journal from a costing difference/.test(banner(t)) && kpi(t, 'Difference') === '$108.00', banner(t).slice(0, 300));
  t = await go('vr', null, { as_at: '2026-06-30', display: disp('vr', { a: 'custom' }) });
  ok('inventory value reconciliation: at a past date — banner, the tie N/A, not red', /not for the same day/.test(text(t.doc, '#mk-body')) && /– Items' value = the inventory account/.test(banner(t)) && !red(t), banner(t).slice(0, 300));
  t = await go('vr', { items: () => { const r = V.listItems(); r.Items[0].CurrentValue = 2700; return r; } });
  ok('inventory value reconciliation: an item value that is not on hand × average cost fails', red(t) && /✗ Each item's value = on hand × average cost .*WID-100/.test(banner(t)), banner(t).slice(0, 300));

  // ---------------- Items Register (M50)
  t = await go('ir');
  ok('items register: own title, 2/2 checks, the service lines left out (information)', t.errs.length === 0 && text(t.doc, 'header .ti') === 'Items Register' && green(t) && /2\/2 checks passed/.test(banner(t)) && /2 left out/.test(banner(t)), [t.errs, banner(t).slice(0, 400)]);
  const blk = (no) => [...t.doc.querySelectorAll('#mk-body tbody')].find((b) => b.querySelector('.k-header').textContent.startsWith(no));
  const w1 = blk('WID-100');
  // WID-100: on hand today 120; September: −70 (10th), −30 (22nd) → opening 1 September = 220, closing 120
  ok('items register: WID-100 opens at 220 on 1 September and closes at today\'s 120', w1 && /220/.test(w1.querySelector('.k-header').textContent) && /^Total for Widget standard.*-100.*120$/.test(w1.querySelector('.k-total').textContent.replace(/\s+/g, ' ').trim()), w1 && w1.textContent.slice(0, 300));
  ok('items register: an item with no stock and no movement in the period is left out', !blk('OLD-050') && !!blk('GAD-300'));
  const cells = [...t.doc.querySelectorAll('#mk-body tr')].map((r) => [...r.cells].map((c) => c.textContent.trim()).join(' ')).join(' / ');
  ok('items register: sales and adjustments with references, and the running on hand', /2026-09-15 Adjustment IJ000005 Stocktake count 2 /.test(cells) && /2026-09-10 Sale 00001112 Eastside Motors -70 150/.test(cells), cells.slice(0, 600));
  await view(t, 'summary');
  ok('items register: summary by item', (rowOf(t, 'WID-100') || []).slice(2).join('|') === '220|0|100|0|120', rowOf(t, 'WID-100'));
  t = await go('ir', null, { from_date: '2026-07-01', display: disp('ir', { p: 'custom', v: 'summary' }) });
  ok('items register: from 1 July — purchases included (WID-100 opens at 145)', (rowOf(t, 'WID-100') || []).slice(2).join('|') === '145|180|200|-5|120', rowOf(t, 'WID-100'));
  t = await go('ir', { bill_lines: (p) => { const r = V.listBillLines(p); r.Items = r.Items.concat([Object.assign({}, V.listBillLines({ from_date: '2026-07-12', to_date: '2026-07-12' }).Items[0], { Date: '2026-09-20T00:00:00', Quantity: 20, Number: 'B0599' })]); return r; } });
  ok('items register: an extra purchase makes an opening negative — missing movements flagged', red(t) && /✗ No item has a negative opening quantity .*WID-200/.test(banner(t)), banner(t).slice(0, 300));
  t = await go('ir', { inv_lines: (p) => { const r = V.listInvoiceLines(p); r.Items = r.Items.concat([Object.assign({}, r.Items[0], { Item: { UID: 'zzz', Number: 'ZZZ-1', Name: 'Unknown' } })]); return r; } });
  ok('items register: a line with an item MYOB does not list fails', red(t) && /✗ Every movement names an item/.test(banner(t)), banner(t).slice(0, 300));

  console.log(fails ? `\n${fails}/${total} checks FAILED` : `\nALL ${total} checks passed`);
  process.exit(fails ? 1 : 0);
})();
