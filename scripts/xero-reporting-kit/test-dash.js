// Tests for the Xero dashboards and list reports (P01–P05, P08–P15) against the ledger fixture (ledger.js), where every
// Xero response is derived from one set of books — so a report's ties must pass, and a tampered source must fail.
const { run, hydrate } = require('./harness.js'); const L = require('./ledger.js'); const fs = require('fs'), path = require('path');
const DIR = process.env.KIT_DIR || __dirname;
const man = (n) => JSON.parse(fs.readFileSync(path.join(DIR, 'reports', n + '.manifest.json'), 'utf8'));
const text = (doc, sel) => (doc.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' ');
let total = 0, fails = 0; const only = process.argv[2];
const ok = (name, cond, info) => { total++; if (cond) console.log('  ✓ ' + name); else { fails++; console.log('  FAIL ' + name + (info !== undefined ? ' ' + (typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 900) : '')); } };
const set = async (t, id, val) => { const el = t.doc.getElementById(id); el.value = val; el.dispatchEvent(new t.w.Event('change')); await t.settle(); await t.settle(); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const banner = (t) => text(t.doc, '#xk-banner'), body = (t) => text(t.doc, '#xk-body');
const green = (t) => t.doc.querySelector('#xk-banner').className.includes('pass'), red = (t) => t.doc.querySelector('#xk-banner').className.includes('fail');
const fmt = (v) => (v < 0 ? '\\(\\$' : '\\$') + Math.abs(v).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\./g, '\\.') + (v < 0 ? '\\)' : '');
const re = (s, v) => new RegExp(s + '\\s*' + fmt(v));
const retryFast = (h) => h.replace('XK.app({\n  title:', 'XK.app({\n  retryMs: 1, title:');
const busy = (fn, n) => { let left = n; return (q) => { if (left-- > 0) throw new Error('Xero API GET https://api.xero.com/api.xro/2.0/x 429: {"Title":"Too Many Requests"}'); return fn(q); }; };
const tamper = (base, fn) => (q) => { const r = base(q); fn(r.Reports[0].Rows, r); return r; };
const cellOf = (rows, label) => { for (const r of rows) { for (const k of r.Rows || [r]) if (k.Cells && k.Cells[0].Value === label) return k.Cells; } return null; };
const E = L.expect;
const xlsxOf = async (t) => { t.doc.getElementById('xk-xlsx').click(); await t.settle(); const b = t.downloads.filter((d) => d.blob).pop(); return b ? Buffer.from(await b.blob.arrayBuffer()).toString('utf8') : ''; };

const AGED = () => ({ paid_after: L.listInvoices, pays_after: L.listPayments, invoices: L.listInvoices, credit_notes: L.listCreditNotes, overpayments: L.listOverpayments, prepayments: L.listPrepayments, tb: L.trialBalance, org: L.organisation, connections: L.connections });

(async () => {
  if (!only || only === 'aged') {
    // ---------------- P08 Aged Receivables Summary ----------------
    const AR = E.balances('2026-09-30')['610'], AP = E.balances('2026-09-30')['800'];
    const a = await run('ar', man('ar'), AGED());
    const ab = body(a), an = banner(a), head = [...a.doc.querySelectorAll('#ag-all thead th')].map((x) => x.textContent.replace(/[▲▼]/g, '').trim());
    ok('ar: as at end of this month by default, Xero wording', /As at 30 September 2026 · Ageing by due date/.test(text(a.doc, '#xk-head')) && a.doc.getElementById('xk-asat').value === '2026-09-30', text(a.doc, '#xk-head'));
    ok('ar: columns Contact | Current | < 1 Month | 1–3 Months | Older | Total (Xero\'s header)', head.join('|') === 'Contact|Current|< 1 Month|1 Month|2 Months|3 Months|Older|Total', head);
    ok('ar: total = Accounts Receivable in the books', re('Total receivable', AR).test(ab), [AR, ab.slice(0, 200)]);
    ok('ar: 5/5 checks pass incl. the Trial Balance tie at the as-at date, green', green(a) && /5\/5 checks passed/.test(an) && new RegExp('✓ Total = Accounts Receivable on the Trial Balance at 2026-09-30 — ' + fmt(AR) + ' vs ' + fmt(AR)).test(an) && a.errs.length === 0, an);
    // live QA, 4 Oct 2026: Xero's Balance Sheet answers a mid-month date with the month's end, so "as at today" used to fail its
    // report-dates check; the tie now reads the Trial Balance, which takes the exact date
    const mt = man('ar'); mt.inputs.find((i) => i.name === 'as_at').default = 'today'; const dt = mt.inputs.find((i) => i.name === 'display'); dt.default = dt.default.replace('"a":"end_this_month"', '"a":"today"');
    const at = await run('ar', mt, AGED(), { bundleInputs: true }); await wait(80);
    ok('ar: as at today (mid-month) → tied to the Trial Balance at today, no "report dates" failure, green', green(at) && !/Xero report dates/.test(banner(at)) && /✓ Total = Accounts Receivable on the Trial Balance at 2026-09-25/.test(banner(at)), banner(at).slice(0, 500));
    const tf = [...a.doc.querySelectorAll('#ag-all tfoot tr')].map((tr) => tr.textContent.replace(/\s+/g, ' ').trim());
    ok('ar: TOTAL row and "Percentage of total" row (sums to 100%)', tf.length === 2 && /^Total/.test(tf[0]) && /^Percentage of total.*100\.00%$/.test(tf[1]), tf);
    ok('ar: overpayment shown negative in its bucket', /Eastside Motors\$[\d,.]+\(\$55\.00\)/.test(text(a.doc, '#ag-all')), text(a.doc, '#ag-all').slice(0, 900));
    const futureNo = L.listInvoices({ where: 'Type=="ACCREC"', statuses: 'AUTHORISED' }).Invoices.find((i) => i.DateString.startsWith('2026-10')).InvoiceNumber;
    // drill-down
    const link = a.doc.querySelector('#ag-all a.xk-drill'); link.dispatchEvent(new a.w.MouseEvent('click', { bubbles: true })); await a.settle();
    const cellLink = [...a.doc.querySelectorAll('#ag-all tbody a.xk-drill[data-b]')].find((x) => x.getAttribute('data-b') && x.getAttribute('data-b') !== 'Current');
    ok('ar: every amount cell is a drill link (contact + bucket)', !!cellLink, a.doc.querySelector('#ag-all tbody tr') && a.doc.querySelector('#ag-all tbody tr').innerHTML.slice(0, 300));
    ok('ar: clicking a customer lists its open documents', /open documents/.test(text(a.doc, '#ag-drill')) && /Invoice/.test(text(a.doc, '#ag-drill')) && !text(a.doc, '#ag-drill').includes(futureNo), text(a.doc, '#ag-drill').slice(0, 300));
    { const bk = cellLink.getAttribute('data-b'); cellLink.dispatchEvent(new a.w.MouseEvent('click', { bubbles: true })); await a.settle();
      const rows = [...a.doc.querySelectorAll('#ag-docs tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent.trim()));
      ok('ar: clicking an amount lists only that contact’s documents in that bucket', text(a.doc, '#ag-drill').includes('open documents · ' + bk) && rows.length > 0 && rows.every((r) => r[5] === bk), [bk, rows.slice(0, 3)]); }
    // options
    const before = a.calls.length;
    await set(a, 'xk-opt-by', 'inv');
    const h2 = [...a.doc.querySelectorAll('#ag-all thead th')].map((x) => x.textContent.replace(/[▲▼]/g, '').trim());
    ok('ar: ageing by invoice date → no Current column, same total, no refetch', h2[1] === '< 1 Month' && re('Total receivable', AR).test(body(a)) && a.calls.length === before && /Ageing by invoice date/.test(text(a.doc, '#xk-head')), h2);
    await set(a, 'xk-opt-by', 'due'); await set(a, 'xk-opt-n', '6'); await set(a, 'xk-opt-len', '30');
    const h3 = [...a.doc.querySelectorAll('#ag-all thead th')].map((x) => x.textContent.replace(/[▲▼]/g, '').trim());
    ok('ar: 6 periods of 30 days → day buckets, total unchanged, still green', h3.join('|') === 'Contact|Current|1–30 days|31–60 days|61–90 days|91–120 days|121–150 days|151–180 days|Older|Total' && re('Total receivable', AR).test(body(a)) && green(a), h3);
    await set(a, 'xk-opt-g', 'type');
    ok('ar: group by document type → invoices, credit notes (Redwood Dental −$165.00), overpayments', /Sales invoices/.test(body(a)) && /Credit notes.*Redwood Dental[^A-Z]*\(\$165\.00\)/.test(body(a)) && /Overpayments/.test(body(a)) && /All documents/.test(body(a)), body(a).slice(0, 900));
    ok('ar: options kept in the display input', /by=due;n=6;len=30;g=type|g=type/.test(JSON.parse(a.setInputsLog[a.setInputsLog.length - 1].display).o), a.setInputsLog.slice(-1));
    // Balance Sheet tie fails on a real difference; foreign currency → information
    const as = await run('ar', man('ar'), Object.assign(AGED(), { tb: tamper(L.trialBalance, (rows) => { const r = rows.find((x) => x.Title === 'Assets').Rows.find((k) => /^Accounts Receivable/.test(k.Cells[0].Value)); r.Cells[3].Value = '1000.00'; }) }));
    ok('ar: total ≠ Balance Sheet AR → Fail with the difference', /✗ Total = Accounts Receivable on the Trial Balance at 2026-09-30 — .* difference/.test(banner(as)) && red(as), banner(as).slice(0, 500));
    const fxInv = (q) => { const r = L.listInvoices(q); if ((q.page || 1) === 1 && /ACCREC/.test(q.where)) r.Invoices.push(Object.assign({}, r.Invoices[0], { InvoiceID: 'fx-1', InvoiceNumber: 'INV-USD', CurrencyCode: 'USD', CurrencyRate: 0.65, AmountDue: 650, Total: 650 })); return r; };
    const ax = await run('ar', man('ar'), Object.assign(AGED(), { invoices: fxInv }));
    ok('ar: foreign-currency invoice converted to AUD (US$650 at 0.65 = $1,000), tie → information', re('Total receivable', AR + 1000).test(body(ax)) && /ℹ Total vs Accounts Receivable on the Trial Balance \(information\) — Difference \$1,000\.00 — 1 foreign-currency document/.test(banner(ax)) && green(ax), banner(ax).slice(0, 500));
    // a past as-at date uses today's balances: said so, never a silent tick
    const ap0 = await run('ar', man('ar'), AGED());
    await set(ap0, 'xk-asat-preset', 'custom'); await set(ap0, 'xk-asat', '2026-06-30');
    ok('ar: past as-at date → balances rebuilt at that date (today\u2019s amounts due + later payments + documents paid since): total = Accounts Receivable on the Trial Balance then', new RegExp('✓ Total = Accounts Receivable on the Trial Balance at 2026-06-30 — ' + fmt(E.balances('2026-06-30')['610']) + ' vs ' + fmt(E.balances('2026-06-30')['610'])).test(banner(ap0)) && /ℹ Balances rebuilt at 2026-06-30/.test(banner(ap0)) && ap0.calls.some((x) => x.requery && x.id === 'pays_after' && /Date>DateTime\(2026,6,30\)/.test(x.params.where)) && ap0.calls.some((x) => x.requery && x.id === 'paid_after' && /FullyPaidOnDate>DateTime\(2026,6,30\)/.test(x.params.where)) && green(ap0), banner(ap0).slice(0, 600));
    { const pp = await run('ap', man('ap'), AGED()); await set(pp, 'xk-asat-preset', 'custom'); await set(pp, 'xk-asat', '2026-08-31'); const AP8 = E.balances('2026-08-31')['800'];
      ok('ap: aged payables at 31 Aug 2026 (the library\u2019s sample date) = Accounts Payable on the Trial Balance at 31 Aug', new RegExp('✓ Total = Accounts Payable on the Trial Balance at 2026-08-31 — ' + fmt(AP8) + ' vs ' + fmt(AP8)).test(banner(pp)) && green(pp), [AP8, banner(pp).slice(0, 400)]); }
    { const pb = await run('ar', man('ar'), Object.assign(AGED(), { pays_after: (q) => { const r = L.listPayments(q); r.Payments = r.Payments.slice(1); return r; } })); await set(pb, 'xk-asat-preset', 'custom'); await set(pb, 'xk-asat', '2026-06-30');
      ok('ar: a later payment missing → the rebuilt total no longer ties to the Balance Sheet → Fail', /✗ Total = Accounts Receivable on the Trial Balance at 2026-06-30/.test(banner(pb)), banner(pb).slice(0, 400)); }
    // paging: more than 100 open invoices → page 2 fetched; an endless list stops at 20 pages and says so
    const many = (q) => { const r = L.listInvoices(q); if (!/ACCREC/.test(q.where)) return r; const base = L.listInvoices(Object.assign({}, q, { page: 1 })).Invoices[0], all = []; for (let i = 0; i < 130; i++) all.push(Object.assign({}, base, { InvoiceID: 'm-' + i, InvoiceNumber: 'M-' + i, AmountDue: 10, Total: 10 })); r.Invoices = all.slice(((q.page || 1) - 1) * 100, (q.page || 1) * 100); return r; };
    const pg = await run('ar', man('ar'), Object.assign(AGED(), { invoices: many })); await wait(30);
    ok('ar: 130 open invoices → page 2 requested and all counted', pg.calls.some((x) => x.id === 'invoices' && x.params.page === 2) && /132 document/.test(banner(pg)) && /✓ All open documents loaded/.test(banner(pg)), [pg.calls.filter((x) => x.id === 'invoices').map((x) => x.params.page), banner(pg).slice(0, 400)]);
    const endless = (q) => { const r = L.listInvoices(q); if (!/ACCREC/.test(q.where)) return r; const base = L.listInvoices(Object.assign({}, q, { page: 1 })).Invoices[0]; r.Invoices = []; for (let i = 0; i < 100; i++) r.Invoices.push(Object.assign({}, base, { InvoiceID: 'e-' + (q.page || 1) + '-' + i, AmountDue: 1, Total: 1 })); return r; };
    const en = await run('ar', man('ar'), Object.assign(AGED(), { invoices: endless })); await wait(60);
    ok('ar: endless list → stops at 20 pages and fails "All open documents loaded" (may be truncated)', en.calls.filter((x) => x.id === 'invoices').length === 20 && /✗ All open documents loaded — May be truncated: invoices/.test(banner(en)), [en.calls.filter((x) => x.id === 'invoices').length, banner(en).slice(0, 300)]);
    const ar4 = await run('ar', man('ar'), Object.assign(AGED(), { credit_notes: busy(L.listCreditNotes, 1), tb: busy(L.trialBalance, 1) }), { htmlPatch: retryFast }); await wait(80);
    ok('ar: HTTP 429 on open → retried, ends green', green(ar4) && /5\/5 checks passed/.test(banner(ar4)), banner(ar4).slice(0, 300));
    const ar5 = await run('ar', man('ar'), Object.assign(AGED(), { invoices: () => { throw new Error('Xero API GET …/Invoices 401: Unauthorized'); } }));
    ok('ar: failed invoice list → error, red, never $0 with a tick', red(ar5) && /401/.test(body(ar5)) && !/✓ Total =/.test(banner(ar5)), banner(ar5).slice(0, 300));
    const axl = await run('ar', man('ar'), AGED()); axl.doc.getElementById('xk-xlsx').click(); await axl.settle();
    ok('ar: Excel download named after the organisation', axl.downloads.some((d) => d.name && /^Northwind Trading Pty Ltd - Aged Receivables - as at 2026-09-30\.xlsx$/.test(d.name)), axl.downloads);
    // ---------------- P09 Aged Payables Summary ----------------
    const p = await run('ap', man('ap'), AGED());
    const ph = [...p.doc.querySelectorAll('#ag-all thead th')].map((x) => x.textContent.replace(/[▲▼]/g, '').trim());
    ok('ap: suppliers as rows, same engine', ph[0] === 'Contact' && /Suppliers you owe/.test(body(p)) && /Aged Payables/.test(text(p.doc, '#xk-head')), ph);
    ok('ap: total = Accounts Payable in the books, tie passes, green', re('Total payable', AP).test(body(p)) && new RegExp('✓ Total = Accounts Payable on the Trial Balance at 2026-09-30 — ' + fmt(AP)).test(banner(p)) && green(p), [AP, banner(p).slice(0, 500)]);
    const apTot = [...p.doc.querySelectorAll('#ag-all tfoot tr')][0].textContent.replace(/\s+/g, ' '), notDue = L.listInvoices({ where: 'Type=="ACCPAY"', statuses: 'AUTHORISED' }).Invoices.filter((d) => d.DueDateString.slice(0, 10) >= '2026-09-30' && d.DateString.slice(0, 10) <= '2026-09-30').reduce((s, d) => s + d.AmountDue, 0);
    ok('ap: bills not yet due are kept in Current, not dropped (live finding #987: AP aged by due date must still equal Balance Sheet AP)', notDue > 0 && apTot.startsWith('Total' + '$' + L.r2(notDue).toLocaleString('en-AU', { minimumFractionDigits: 2 })), [L.r2(notDue), apTot]);
    ok('ap: bills list is ACCPAY; credits are supplier credits', p.calls.some((x) => x.id === 'invoices' && x.params.where === 'Type=="ACCPAY"') && p.calls.some((x) => x.id === 'credit_notes' && /ACCPAYCREDIT/.test(x.params.where)) && p.calls.some((x) => x.id === 'overpayments' && /SPEND-OVERPAYMENT/.test(x.params.where)));
    ok('ap: supplier credit note shown negative', /CloudSoft Subscriptions[^A-Z]*\(\$/.test(text(p.doc, '#ag-all')), text(p.doc, '#ag-all').slice(0, 600));
    await set(p, 'xk-opt-g', 'type');
    ok('ap: group by document type (the library\'s payables default)', /Bills/.test(body(p)) && /Credit notes/.test(body(p)), body(p).slice(0, 300));
  }
  if (!only || only === 'pipe') {
    // ---------------- P02 Sales overview ----------------
    const PIPE = (extra) => Object.assign({ invoices: L.listInvoices, credit_notes: L.listCreditNotes, overpayments: L.listOverpayments, prepayments: L.listPrepayments, linked: L.listLinked, purchase_orders: L.listPurchaseOrders, repeating: L.listRepeating, paid: L.listInvoices, bill: L.getInvoice, tb: L.trialBalance, org: L.organisation, connections: L.connections }, extra || {});
    const all = (type) => L.listInvoices({ where: 'Type=="' + type + '"', statuses: 'DRAFT,SUBMITTED,AUTHORISED' }).Invoices;
    const sumOf = (list, k) => L.r2(list.reduce((a, d) => a + d[k], 0));
    const exp = (type) => { const l = all(type), aw = l.filter((d) => d.Status === 'AUTHORISED' && d.AmountDue > 0), od = aw.filter((d) => d.DueDateString.slice(0, 10) < L.TODAY);
      return { draft: l.filter((d) => d.Status === 'DRAFT'), sub: l.filter((d) => d.Status === 'SUBMITTED'), aw, od }; };
    const S = exp('ACCREC'), s = await run('so', man('so'), PIPE());
    { await wait(60); const links = L.listLinked({ status: 'APPROVED' }).LinkedTransactions, amt = L.r2(links.reduce((a, l) => { const b = L.getInvoice({ invoiceId: l.SourceTransactionID }).Invoices[0]; return a + b.LineItems.find((x) => x.LineItemID === l.SourceLineItemID).LineAmount; }, 0));
      ok('so: billable expenses show the amount to invoice, read from each source bill\u2019s linked line', links.length > 0 && re('', amt).test(text(s.doc, '#xk-body')) && /to invoice/.test(body(s)) && /✓ Billable expense amounts read from their source bills/.test(banner(s)) && s.calls.filter((x) => x.id === 'bill' && x.params.invoiceId).length === new Set(links.map((l) => l.SourceTransactionID)).size, [amt, banner(s).slice(0, 200)]);
      ok('so: the source-bill lookup is quiet before it runs (no error for the empty bill id)', !/Source bill/.test(banner(s)) && green(s), banner(s).slice(0, 300)); }
    { const av = [...s.doc.querySelectorAll('#so-top tbody tr')].map((tr) => tr.querySelector('.xk-av'));
      ok('so: customers owing the most carry avatar initials', av.length > 0 && av.every((a) => a && /^[A-Z0-9]{1,2}$/.test(a.textContent)), av.map((a) => a && a.textContent));
      ok('so: the status strip shows (n) and an amount for every status, never "None"', [...s.doc.querySelectorAll('#xk-body .xk-kpis')[0].querySelectorAll('.xk-kpi')].every((k) => /\(\d+\)/.test(k.textContent) && /\$/.test(k.textContent))); }
    const sk = [...s.doc.querySelectorAll('.xk-kpis')[0].querySelectorAll('.xk-kpi')].map((k) => k.textContent.replace(/\s+/g, ' ').trim());
    const kpi = (lbl, list, k) => lbl + ' (' + list.length + ')' + (list.length ? '$' + sumOf(list, k).toLocaleString('en-AU', { minimumFractionDigits: 2 }) : 'None');
    ok('so: KPI strip Draft / Awaiting approval / Awaiting payment / Overdue — counts and amounts from the invoice list', sk.join('|') === [kpi('Draft', S.draft, 'Total'), kpi('Awaiting approval', S.sub, 'Total'), kpi('Awaiting payment', S.aw, 'AmountDue'), kpi('Overdue', S.od, 'AmountDue')].join('|'), [sk, [kpi('Draft', S.draft, 'Total'), kpi('Awaiting approval', S.sub, 'Total'), kpi('Awaiting payment', S.aw, 'AmountDue'), kpi('Overdue', S.od, 'AmountDue')]]);
    ok('so: every check passes, incl. awaiting payment − credits − future-dated = Trial Balance AR', green(s) && /✓ Awaiting payment − credits = Accounts Receivable on the Trial Balance today — .* future-dated = /.test(banner(s)) && s.errs.length === 0, banner(s));
    const owingTop = text(s.doc, '#so-top');
    const byC = {}; S.aw.forEach((d) => { byC[d.Contact.Name] = L.r2((byC[d.Contact.Name] || 0) + d.AmountDue); }); const topName = Object.keys(byC).sort((a, b) => byC[b] - byC[a])[0];
    ok('so: customers owing the most — largest first', owingTop.indexOf(topName) >= 0 && owingTop.indexOf(topName) < 40, [topName, owingTop.slice(0, 200)]);
    ok('so: billable expenses — 3 customers with items not yet invoiced, each with its amount', /3 customers · 3 item\(s\) not yet invoiced/.test(body(s)) && /item\(s\) · \$[\d,]+\.\d\d/.test(body(s)) && !/Amount owing: N\/A/.test(body(s)), body(s).slice(0, 800));
    ok('so: money coming in — due this week / next week and the by-month chart', /Due this week\$[\d,.]+Due next week\$[\d,.]+/.test(body(s)) && s.doc.querySelector('#so-ch svg'), body(s).slice(0, 400));
    s.doc.querySelector('.xk-tab[data-v="repeating"]').click(); await s.settle();
    ok('so: Repeating invoices tab (no refetch) lists the repeating invoice', /Summit Legal.*Retainer.*monthly.*2026-10-01.*\$880\.00/.test(text(s.doc, '#so-rep')), text(s.doc, '#so-rep'));
    s.doc.querySelector('.xk-tab[data-v="links"]').click(); await s.settle();
    ok('so: Payment links tab says N/A (not in the API) — not a failure', /Payment links: N\/A — not in the Xero Accounting API/.test(body(s)) && green(s), body(s).slice(0, 300));
    const sf = await run('so', man('so'), PIPE({ tb: tamper(L.trialBalance, (rows) => { const r = rows.find((x) => x.Title === 'Assets').Rows.find((k) => /^Accounts Receivable/.test(k.Cells[0].Value)); r.Cells[3].Value = '100.00'; }) }));
    ok('so: Trial Balance AR differs → Fail with the difference', /✗ Awaiting payment − credits = Accounts Receivable on the Trial Balance today — .* difference/.test(banner(sf)) && red(sf), banner(sf).slice(0, 400));
    const sd = await run('so', man('so'), PIPE({ invoices: (q) => { const r = L.listInvoices(q); r.Invoices.push(Object.assign({}, r.Invoices.find((d) => d.Status === 'AUTHORISED'), { InvoiceID: 'dup', Status: 'VOIDED' })); return r; } }));
    ok('so: voided invoices are not counted', green(sd) && sk[2] === [...sd.doc.querySelectorAll('.xk-kpis')[0].querySelectorAll('.xk-kpi')].map((k) => k.textContent.replace(/\s+/g, ' ').trim())[2]);
    // ---------------- P03 Purchases overview ----------------
    const B = exp('ACCPAY'), u = await run('pu', man('pu'), PIPE());
    ok('pu: the Xero actions (New bill, Import bills…) are offered as a read-only "Create new (in Xero)" card', /Create new \(in Xero\)/.test(body(u)) && /New bill/.test(body(u)) && /Import bills/.test(body(u)));
    ok('pu: Excel carries the money-going-out series', /Money going out — next 30 days/.test(await xlsxOf(u)));
    { await set(u, 'xk-view', 'all'); const rowsOf = () => [...u.doc.querySelectorAll('#pu-all tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent));
      const open = L.listInvoices({ where: 'Type=="ACCPAY"', statuses: 'DRAFT,SUBMITTED,AUTHORISED' }).Invoices;
      ok('pu: All bills tab lists every draft, awaiting-approval and awaiting-payment bill', rowsOf().length === open.length, [rowsOf().length, open.length]);
      await set(u, 'pu-st', 'Overdue'); ok('pu: All bills filtered by status (Overdue)', rowsOf().length > 0 && rowsOf().every((r) => r[5] === 'Overdue'), rowsOf().slice(0, 2));
      await set(u, 'pu-st', '');
      const fi = u.doc.querySelector('#pu-all .xk-filter'); if (fi) { fi.value = rowsOf()[0][2]; fi.dispatchEvent(new u.w.Event('input')); await u.settle(); }
      ok('pu: All bills searchable (number, reference, contact or amount)', !!fi && rowsOf().length > 0 && rowsOf().every((r) => r.join(' ').includes(fi.value)), fi ? fi.value : 'no filter box');
      if (fi) { fi.value = ''; fi.dispatchEvent(new u.w.Event('input')); await u.settle(); }
      await set(u, 'pu-from', '2026-09-01'); ok('pu: All bills filtered by date range', rowsOf().length > 0 && rowsOf().every((r) => r[3] >= '2026-09-01'), rowsOf().slice(0, 2)); await set(u, 'pu-from', ''); }
    { await set(u, 'xk-view', 'paid'); const pr = [...u.doc.querySelectorAll('#pu-paid tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent));
      ok('pu: Paid tab lists recently paid bills with the date Xero marked them paid', pr.length > 0 && pr.every((r) => /^\d{4}-\d\d-\d\d$/.test(r[4])) && u.calls.some((x) => x.id === 'paid' && x.params.statuses === 'PAID'), pr.slice(0, 2)); await set(u, 'xk-view', 'docs'); }
    const uk = [...u.doc.querySelectorAll('.xk-kpis')[0].querySelectorAll('.xk-kpi')].map((k) => k.textContent.replace(/\s+/g, ' ').trim());
    ok('pu: bills strip from the bill list', uk.join('|') === [kpi('Draft', B.draft, 'Total'), kpi('Awaiting approval', B.sub, 'Total'), kpi('Awaiting payment', B.aw, 'AmountDue'), kpi('Overdue', B.od, 'AmountDue')].join('|'), uk);
    ok('pu: every check passes incl. AP tie and money going out = awaiting payment', green(u) && /✓ Money going out \(overdue \+ next 30 days \+ later\) = awaiting payment/.test(banner(u)) && /✓ Awaiting payment − credits = Accounts Payable on the Trial Balance today/.test(banner(u)), banner(u));
    const pk = [...u.doc.querySelectorAll('.xk-kpis')[1].querySelectorAll('.xk-kpi')].map((k) => k.textContent.replace(/s+/g, ' ').trim()).join('|');
    ok('pu: purchase orders strip Draft / Awaiting approval / Approved / Billed', pk === 'Draft (1)$900.00|Awaiting approval (1)$1,450.00|Approved (2)$3,080.00|Billed (1)$1,990.00', pk);
    await set(u, 'xk-opt-r', '90');
    ok('pu: money going out over 90 days — still reconciles', /Money going out — next 90 days/.test(body(u)) && /✓ Money going out \(overdue \+ next 90 days \+ later\)/.test(banner(u)));
    u.doc.querySelector('.xk-tab[data-v="orders"]').click(); await u.settle();
    ok('pu: Purchase orders tab lists the orders', /PO-0002.*Metro Wholesale.*Draft.*\$900\.00/.test(text(u.doc, '#pu-po')), text(u.doc, '#pu-po').slice(0, 300));
  }
  if (!only || only === 'bo') {
    // ---------------- P01 Business overview ----------------
    const BO = (extra) => Object.assign({ bank: L.bankSummary, invoices: L.listInvoices, bills: L.listInvoices, payments: L.listPayments, pnl_ytd: L.pnl, pnl_prior: L.pnl, pnl_month: L.pnl, accounts: L.listAccounts, tb: L.trialBalance, org: L.organisation, connections: L.connections }, extra || {});
    const o = await run('bo', man('bo'), BO()); await wait(40);
    ok('bo: bank cards say Statement balance and Balance difference are N/A (bank-feed data is not in the API)', /Balance difference: N\/A/.test(body(o)));
    { const dates = [...o.doc.querySelectorAll('#bo-pay tbody tr')].map((tr) => tr.children[2].textContent);
      ok('bo: recent payments use Xero\u2019s date format (25 Sep 2026)', dates.length > 0 && dates.every((d) => /^\d{1,2} [A-Z][a-z]{2} \d{4}$/.test(d)), dates.slice(0, 3)); }
    { const x = await xlsxOf(o); ok('bo: Excel carries ageing, counts, recent payments and the watchlist', /Ageing \(awaiting payment\)/.test(x) && /name="Recent payments"/.test(x) && /name="Watchlist"/.test(x)); }
    const np = E.netProfit('2026-07-01', L.TODAY), npPrior = E.netProfit('2025-07-01', '2025-09-25'), bank = L.r2(E.bankBalance('090', L.TODAY) + E.bankBalance('091', L.TODAY));
    const ob = body(o), on = banner(o);
    ok('bo: YTD net profit from one P&L (1 Jul – today) = the books', re('1 Jul 2026–25 Sep 2026', np).test(ob), [np, ob.slice(0, 1500)]);
    ok('bo: % vs same period last year', new RegExp('[▲▼] ' + Math.round(Math.abs((np - npPrior) / npPrior) * 100) + '% vs same period last year').test(ob), [np, npPrior]);
    ok('bo: bank cards = books, "Balance in Xero", statement balance N/A', re('Business Cheque Account', E.bankBalance('090', L.TODAY)).test(ob) && /Balance in Xero · Statement balance: N\/A — not in source/.test(ob), ob.slice(0, 400));
    // the ledger has bank transactions dated after "today" in the month, and Xero's Balance Sheet is at the month end — the ties read the
    // Trial Balance at today's exact date (live QA, 4 Oct 2026: the Balance Sheet ties failed on Irvine Jackson)
    ok('bo: every check passes (bank and YTD profit = the Trial Balance today, exact date), green', green(o) && new RegExp('✓ Bank accounts = the same accounts on the Trial Balance today \\(a separate Xero report\\) — ' + fmt(bank) + ' vs ' + fmt(bank)).test(on) && new RegExp('✓ YTD net profit = income − expenses for the year on the Trial Balance today — ' + fmt(np) + ' vs ' + fmt(np)).test(on) && /✓ YTD net profit = income − expenses/.test(on) && o.errs.length === 0, on);
    const bankCalls = o.calls.filter((x) => x.id === 'bank' && x.requery).map((x) => x.params.fromDate + '..' + x.params.toDate);
    ok('bo: cash in/out — 6 Bank Summary calls, one per month (Apr–Sep 2026)', bankCalls.join(' ') === '2026-04-01..2026-04-30 2026-05-01..2026-05-31 2026-06-01..2026-06-30 2026-07-01..2026-07-31 2026-08-01..2026-08-31 2026-09-01..2026-09-25', bankCalls);
    const cin = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'].reduce((a, m) => { const s0 = m + '-01', e0 = m === '2026-09' ? L.TODAY : L.eom(+m.slice(0, 4), +m.slice(5)); return a + E.flows('090', s0, e0).rin + E.flows('091', s0, e0).rin; }, 0);
    ok('bo: cash in over 6 months = the books; months chain (close = next open)', re('Cash in', L.r2(cin)).test(ob) && /✓ Cash difference = cash in − cash out; each month closes where the next opens/.test(on), [L.r2(cin), ob.slice(ob.indexOf('Cash in and out'), ob.indexOf('Cash in and out') + 200)]);
    const lastPay = L.listPayments({ where: 'PaymentType=="ACCRECPAYMENT"', order: 'Date DESC' }).Payments[0];
    ok('bo: recent invoice payments — newest first, up to 9', text(o.doc, '#bo-pay').includes(lastPay.Invoice.InvoiceNumber) && o.doc.querySelectorAll('#bo-pay tbody tr').length === 9, text(o.doc, '#bo-pay').slice(0, 200));
    ok('bo: tasks — chase overdue invoices / pay overdue bills', /Chase \d+ overdue invoices?/.test(ob) && /Pay \d+ overdue bills?/.test(ob));
    ok('bo: watchlist defaults to the 4 largest expense accounts with codes, this month and YTD', o.doc.querySelectorAll('#bo-watch tbody tr').length === 4 && [...o.doc.querySelector('#bo-watch tbody tr').querySelectorAll('td')].map((td) => td.textContent.trim()).join('|') === '477|Wages and Salaries|$0.00|' + '$' + E.plByAccount('2026-07-01', L.TODAY, false)['477'].toLocaleString('en-AU', { minimumFractionDigits: 2 }), text(o.doc, '#bo-watch'));
    const before = o.calls.length; const add = o.doc.getElementById('bo-add'); add.value = '200'; add.dispatchEvent(new o.w.Event('change')); await o.settle();
    ok('bo: adding an account to the watchlist (display only, no refetch)', o.doc.querySelectorAll('#bo-watch tbody tr').length === 5 && /Sales/.test(text(o.doc, '#bo-watch')) && o.calls.length === before, text(o.doc, '#bo-watch'));
    const of = await run('bo', man('bo'), BO({ tb: (q) => { const r = L.trialBalance(q), c = r.Reports[0].Rows.find((x) => x.Title === 'Revenue').Rows[0].Cells; c[4].Value = (+c[4].Value + 1).toFixed(2); return r; } })); await wait(40);
    ok('bo: the Trial Balance\'s year differs by $1 → Fail', /✗ YTD net profit = income − expenses for the year on the Trial Balance/.test(banner(of)) && red(of), banner(of).slice(0, 400));
    const ofn = await run('bo', man('bo'), BO({ pnl_ytd: tamper(L.pnl, (rows) => { cellOf(rows, 'Net Profit')[1].Value = '-838.31'; }) })); await wait(40);
    ok('bo: the live bug (net profit not equal to income − expenses) → Fail, never silent', /✗ YTD net profit = income − expenses — \(\$838\.31\)/.test(banner(ofn)) && red(ofn), banner(ofn).slice(0, 400));
    const ofb = await run('bo', man('bo'), BO({ bank: (q) => { if (q.fromDate === '2026-06-01') throw new Error('Xero API GET …/BankSummary 500: oops'); return L.bankSummary(q); } })); await wait(60);
    ok('bo: a month of the Bank Summary fails → that section says which month, check fails', /Some months could not be loaded: Jun 2026/.test(body(ofb)) && /✗ Cash difference/.test(banner(ofb)), body(ofb).slice(0, 300));
    const os = await run('bo', man('bo'), BO(), { mode: 'snapshot', bundle: hydrate(man('bo'), BO(), {}, []) });
    ok('bo snapshot: 6-month cash is N/A (live only); the rest renders', /N\/A in a snapshot — open the live report/.test(body(os)) && /Invoices owed to you/.test(body(os)), body(os).slice(0, 300));
  }
  if (!only || only === 'pf') {
    // ---------------- P11 Performance overview ----------------
    const PF = (extra) => Object.assign({ bs_12: L.bs, bs_p12: L.bs, pnl_12: L.pnl, pnl_p12: L.pnl, pnl_total: L.pnl, pnl_12_cash: L.pnl, pnl_p12_cash: L.pnl, pnl_total_cash: L.pnl, bs: L.bs, org: L.organisation, connections: L.connections }, extra || {});
    const f = await run('pf', man('pf'), PF());
    ok('pf: insight lines are labelled as computed, not as Xero\u2019s AI insights', f.doc.querySelectorAll('.insight').length > 0 && [...f.doc.querySelectorAll('.insight')].every((i) => /^Insight \(computed\):/.test(i.textContent)) && !/AI insight/.test(body(f)));
    ok('pf: the bank widget shows last year\u2019s balance and the change', /Bank accounts balance.*Prior: \(?\$[\d,.]+\)? · a year earlier/.test(body(f)), body(f).slice(body(f).indexOf('Bank accounts balance'), body(f).indexOf('Bank accounts balance') + 200));
    const np = E.netProfit('2025-09-01', '2026-08-31'), npp = E.netProfit('2024-09-01', '2025-08-31');
    const inc = (a, b) => { const p = E.plByAccount(a, b, false); return L.r2(Object.keys(p).filter((k) => /REVENUE|OTHERINCOME/.test(L.ACC[k].Type)).reduce((s, k) => s + p[k], 0)); };
    const I = inc('2025-09-01', '2026-08-31'), ar = E.balances('2026-08-31')['610'];
    const m0 = (v) => '\\$' + Math.round(Math.abs(v)).toLocaleString('en-AU');
    ok('pf: 12 months ending Aug 2026 (end of last month), vs the same months a year earlier', /Monthly · 12 months ending Aug 2026/.test(body(f)) && f.calls.some((x) => x.id === 'pnl_12' && x.params.fromDate === '2026-08-01' && x.params.toDate === '2026-08-31' && x.params.periods === 11 && x.params.timeframe === 'MONTH'), body(f).slice(0, 200));
    const wg = [...f.doc.querySelectorAll('.xk-widget')].find((x) => x.querySelector('h3').textContent === 'Net profit or loss'), md = (v) => (v < 0 ? '(' : '') + '$' + Math.round(Math.abs(v)).toLocaleString('en-AU') + (v < 0 ? ')' : '');
    ok('pf: net profit widget = the books (current and prior 12 months)', wg.querySelector('.cur').textContent === md(np) && wg.querySelectorAll('.pri')[1].textContent === 'Prior: ' + md(npp) + ' · Total Sep 2024 to Aug 2025', [md(np), md(npp), wg.textContent.slice(0, 200)]);
    ok('pf: every check passes (12 columns, Σ months = 12-month P&L, margins, debtor days, BS balances), green', green(f) && /6\/6 checks passed/.test(banner(f)) && f.errs.length === 0, banner(f));
    const dd = Math.round(ar / I * 365);
    ok('pf: debtors days = AR ÷ 12-month income × 365', new RegExp('Debtors days' + dd + ' days').test(body(f).replace(/\s+/g, ' ').replace(/Debtors days /, 'Debtors days')), [dd, body(f).slice(body(f).indexOf('Debtors days'), body(f).indexOf('Debtors days') + 60)]);
    ok('pf: 9 widgets, each with an AI insight line', f.doc.querySelectorAll('.xk-widget').length === 9 && f.doc.querySelectorAll('.xk-widget .insight').length === 9);
    const f3 = await run('pf', man('pf'), PF({ pnl_12: (q) => L.pnl(Object.assign({}, q, { periods: 5 })) }));
    ok('pf: Xero returns only 6 monthly columns → the column check fails (no silent gaps)', /✗ Xero returned 12 monthly columns/.test(banner(f3)) && red(f3), banner(f3).slice(0, 300));
    const f4 = await run('pf', man('pf'), PF({ pnl_total: tamper(L.pnl, (rows) => { cellOf(rows, 'Net Profit')[1].Value = '1.00'; }) }));
    ok('pf: 12-month P&L disagrees with the monthly columns → Fail', /✗ Σ monthly net profit = the 12-month Profit and Loss/.test(banner(f4)), banner(f4).slice(0, 300));
    await set(f, 'xk-asat-preset', 'end_last_fy');
    { const fc = await run('pf', man('pf'), PF()); await wait(30); const a = fc.doc.querySelector('input[name="xk-basis"][value="Cash"]'); a.checked = true; a.dispatchEvent(new fc.w.Event('change')); await fc.settle(); await wait(30);
      const npC = (() => { const r = L.pnl({ fromDate: '2025-09-01', toDate: '2026-08-31', paymentsOnly: true }); return +r.Reports[0].Rows.find((y) => y.Title === '' && y.Rows[0].Cells[0].Value === 'Net Profit').Rows[0].Cells[1].Value; })();
      ok('pf: Accounting method Cash → the cash-basis P&L (no refetch), checks still pass, footer and Sources say Cash', fc.calls.some((x) => x.id === 'pnl_12_cash' && x.params.paymentsOnly === true) && /Cash basis/.test(text(fc.doc, '#xk-foot')) && /Basis: Cash/.test(text(fc.doc, '#xk-sources')) && green(fc) && body(fc).includes('$' + Math.round(npC).toLocaleString('en-AU')), [text(fc.doc, '#xk-foot'), banner(fc).slice(0, 200)]); }
    { const f = await run('pf', man('pf'), PF()); await wait(40); const pts = (id) => [...f.doc.querySelectorAll('#' + id + ' svg polyline')].map((p) => p.getAttribute('points').split(' ').length);
      const ar = L.bs({ date: '2026-08-31' }).Reports[0].Rows, inc8 = (() => { const r = L.pnl({ fromDate: '2026-08-01', toDate: '2026-08-31' }).Reports[0].Rows; return r.filter((x) => x.RowType === 'Section' && !/^Less /.test(x.Title) && x.Title).reduce((a, x) => a + +x.Rows.find((y) => y.RowType === 'SummaryRow').Cells[1].Value, 0); })();
      const AR8 = E.balances('2026-08-31')['610'], want = Math.round(AR8 / inc8 * 31), tip = [...f.doc.querySelectorAll('#pf-dd svg circle title')].map((t) => t.textContent).find((t) => /^Current · Aug/.test(t));
      ok('pf: debtors and creditors days are monthly (12 points, this year and a year earlier)', pts('pf-dd').join(',') === '12,12' && pts('pf-cd').join(',') === '12,12' && f.calls.some((x) => x.id === 'bs_12' && x.params.periods === 11) && f.calls.some((x) => x.id === 'bs_p12' && x.params.date === '2025-08-31'), [pts('pf-dd'), pts('pf-cd')]);
      ok('pf: August debtors days = August month-end receivables ÷ August income × 31', tip === 'Current · Aug: ' + want + ' days', [tip, want]);
      ok('pf: the margin check rests on Xero\u2019s own profit lines, and the two Balance Sheets agree (checks that can fail)', /✓ Every month: Xero's Gross Profit and Net Profit lines = the sections above them/.test(banner(f)) && /✓ Receivables and payables at 2026-08-31 agree between Xero's two Balance Sheet reports/.test(banner(f)) && /ℹ Debtors \/ creditors days formula/.test(banner(f)), banner(f).slice(0, 600)); }
    { const fb = await run('pf', man('pf'), PF({ bs_12: tamper(L.bs, (rows) => { const r = cellOf(rows, 'Accounts Receivable'); r[1].Value = '1.00'; }) })); await wait(30);
      ok('pf: month-end receivables differing between the two Balance Sheets → Fail', /✗ Receivables and payables at 2026-08-31 agree/.test(banner(fb)), banner(fb).slice(0, 400)); }
    ok('pf: end month = end of last financial year → refetch Jul 2025–Jun 2026', f.calls.some((x) => x.requery && /^pnl_12/.test(x.id) && x.params.fromDate === '2026-06-01' && x.params.toDate === '2026-06-30') && f.calls.some((x) => x.requery && x.id === 'pnl_total' && x.params.fromDate === '2025-07-01') && green(f), f.calls.filter((x) => x.requery).map((x) => x.id + ':' + x.params.fromDate));
  }
  if (!only || only === 'cp') {
    // ---------------- P12 Cash position ----------------
    const CP = (extra) => Object.assign({ bs_12: L.bs, bank: L.bankSummary, bank_total: L.bankSummary, bank_prior: L.bankSummary, receivables: L.listInvoices, payables: L.listInvoices, org: L.organisation, connections: L.connections }, extra || {});
    { const q = await run('cp', man('cp'), CP()); await wait(80);
      const pr = L.bankSummary({ fromDate: '2024-09-01', toDate: '2025-08-31' }).Reports[0].Rows[1].Rows.find((r) => r.RowType === 'SummaryRow').Cells.map((c) => +c.Value || 0);
      const card = [...q.doc.querySelectorAll('.xk-widget')].find((w) => /Cash in vs cash out/.test(w.textContent)), md = (v) => '$' + Math.round(Math.abs(v)).toLocaleString('en-AU');
      ok('cp: Cash in vs cash out shows the same 12 months a year earlier and the change (prior-year Bank Summary)', q.calls.some((x) => x.id === 'bank_prior' && x.params.fromDate === '2024-09-01' && x.params.toDate === '2025-08-31') && card && card.textContent.includes('Prior year: in ' + md(pr[2])) && card.querySelectorAll('.chip').length === 2 && /✓ Prior-year Bank Summary loaded/.test(banner(q)), [card && card.textContent.slice(0, 160), pr[2]]);
      ok('cp: Net cash flow card shows last year\u2019s net and the change', [...q.doc.querySelectorAll('.xk-widget')].some((w) => /Net cash flow/.test(w.textContent) && /Prior: .* · a year earlier/.test(w.textContent) && w.querySelector('.chip')));
      const pm = q.doc.getElementById('xk-opt-pm'); pm.value = 'y'; pm.dispatchEvent(new q.w.Event('change')); await q.settle(); await wait(150);
      ok('cp: Prior year on the chart → the same months a year earlier are fetched and drawn', q.calls.filter((x) => x.id === 'bank' && x.params.fromDate >= '2024-09-01' && x.params.toDate <= '2025-08-31').length === 12 && /Cash in \(prior year\)/.test(text(q.doc, '#cp-io')) && green(q), [q.calls.filter((x) => x.id === 'bank').length, banner(q).slice(0, 200)]); }
    const p = await run('cp', man('cp'), CP()); await wait(80);
    const cash = L.r2(E.bankBalance('090', '2026-08-31') + E.bankBalance('091', '2026-08-31'));
    const md = (v) => (v < 0 ? '(' : '') + '$' + Math.round(Math.abs(v)).toLocaleString('en-AU') + (v < 0 ? ')' : '');
    const wd = (t) => [...p.doc.querySelectorAll('.xk-widget')].find((x) => x.querySelector('h3').textContent === t);
    ok('cp: cash balance at the end of last month = the books', wd('Cash balance').querySelector('.cur').textContent === md(cash), [md(cash), wd('Cash balance').textContent.slice(0, 120)]);
    ok('cp: 12 Bank Summary calls, one per month (Sep 2025–Aug 2026)', p.calls.filter((x) => x.id === 'bank' && x.requery).length === 12 && p.calls.some((x) => x.id === 'bank' && x.requery && x.params.fromDate === '2025-09-01' && x.params.toDate === '2025-09-30'), p.calls.filter((x) => x.id === 'bank').map((x) => x.params.fromDate));
    ok('cp: every check passes (Σ months = 12-month Bank Summary, BS cash = Bank Summary closing, doughnuts, prior year), green', green(p) && /7\/7 checks passed/.test(banner(p)) && p.errs.length === 0, banner(p));
    ok('cp: receivables and payables ageing doughnuts drawn', p.doc.querySelector('#cp-rec svg') && p.doc.querySelector('#cp-pay svg'));
    const p2 = await run('cp', man('cp'), CP({ bank_total: tamper(L.bankSummary, (rows) => { rows[1].Rows[rows[1].Rows.length - 1].Cells[2].Value = '1.00'; }) })); await wait(80);
    ok('cp: 12-month Bank Summary disagrees with the months → Fail', /✗ Monthly cash in \/ out = the Bank Summary for the 12 months/.test(banner(p2)) && red(p2), banner(p2).slice(0, 300));
    const p3 = await run('cp', man('cp'), CP({ bs_12: (q) => L.bs(Object.assign({}, q, { periods: 2 })) })); await wait(80);
    ok('cp: fewer month-end columns → check fails', /✗ Xero returned 12 month-end balances/.test(banner(p3)), banner(p3).slice(0, 300));
  }
  if (!only || only === 'hs') {
    // ---------------- P14 Business health scorecard ----------------
    const HS = (extra) => Object.assign({ pnl: L.pnl, pnl_prev: L.pnl, pnl_cash: L.pnl, pnl_prev_cash: L.pnl, bs: L.bs, org: L.organisation, connections: L.connections }, extra || {});
    { const ht = await run('hs', man('hs'), HS()); await wait(30); const rowOf = (name) => [...ht.doc.querySelectorAll('.xk-grid tbody tr')].find((tr) => tr.children[0] && tr.children[0].textContent === name);
      const cr = ht.doc.querySelector('.hs-tv[data-id="cr"]'); cr.value = '99'; cr.dispatchEvent(new ht.w.Event('change')); await ht.settle(); await wait(20);
      ok('hs: a target typed in the report is saved (targets input) and scored — current ratio ≥ 99 is missed', JSON.parse(ht.setInputsLog[ht.setInputsLog.length - 1].targets).cr === 99 && /≥ 99\.00/.test(rowOf('Current ratio').textContent) && /✗/.test(rowOf('Current ratio').textContent), rowOf('Current ratio') && rowOf('Current ratio').textContent);
      const add = ht.doc.getElementById('hs-add'); add.value = 'roa'; add.dispatchEvent(new ht.w.Event('change')); await ht.settle(); await wait(20);
      ok('hs: Add a metric → Return on assets joins the scorecard and the score', !!rowOf('Return on assets') && /of 13 targets/.test(body(ht)), body(ht).slice(0, 160));
      ht.doc.querySelector('button[data-off="cd"]').click(); await ht.settle(); await wait(20);
      ok('hs: Off leaves a metric out of the scorecard and the score', !rowOf('Creditor days') && /of 12 targets/.test(body(ht)), body(ht).slice(0, 160));
      const sec = ht.doc.getElementById('xk-opt-sec'); sec.value = 'Liquidity'; sec.dispatchEvent(new ht.w.Event('change')); await ht.settle(); await wait(20);
      ok('hs: Section filter shows only that section (score unchanged)', !!rowOf('Current ratio') && !rowOf('Net profit') && /of 12 targets/.test(body(ht)), body(ht).slice(0, 160)); }
    { const hc = await run('hs', man('hs'), HS()); await wait(30); { const a = hc.doc.querySelector('input[name="xk-basis"][value="Cash"]'); a.checked = true; a.dispatchEvent(new hc.w.Event('change')); await hc.settle(); await wait(30); }
      ok('hs: Accounting method Cash → the cash-basis month; the Balance Sheet tie becomes information (accrual only); still green', hc.calls.some((x) => x.id === 'pnl_cash' && x.params.paymentsOnly === true) && /ℹ Net profit vs the movement in Current Year Earnings \(information\)/.test(banner(hc)) && green(hc) && /Cash basis/.test(text(hc.doc, '#xk-foot')), banner(hc).slice(0, 300)); }
    const h = await run('hs', man('hs'), HS());
    const npA = E.netProfit('2026-08-01', '2026-08-31'), npJ = E.netProfit('2026-07-01', '2026-07-31');
    const md = (v) => (v < 0 ? '(' : '') + '$' + Math.round(Math.abs(v)).toLocaleString('en-AU') + (v < 0 ? ')' : '');
    const rowOf = (name) => [...h.doc.querySelectorAll('.xk-grid tbody tr')].find((tr) => tr.children[0] && tr.children[0].textContent === name);
    ok('hs: August 2026 vs July 2026 (end of last month)', /Scorecard — Aug 2026/.test(body(h)) && h.calls.some((x) => x.id === 'pnl_prev' && x.params.fromDate === '2026-07-01' && x.params.toDate === '2026-07-31'), body(h).slice(0, 200));
    ok('hs: net profit row = the books, with its equation and status', rowOf('Net profit').children[3].textContent === md(npA) && rowOf('Net profit').children[2].textContent === md(npJ) && rowOf('Net profit').children[1].textContent === 'Total income − Total expenses' && new RegExp(npA >= npJ ? '^✓' : '^✗').test(rowOf('Net profit').children[5].textContent), [md(npA), md(npJ), rowOf('Net profit').textContent]);
    const b = E.balances('2026-08-31'), cr = (b['090'] + b['091'] + b['610'] + b['620']) / (b['800'] + b['820'] + b['850']);
    ok('hs: current ratio = current assets ÷ current liabilities', rowOf('Current ratio').children[3].textContent === cr.toFixed(2), [cr.toFixed(2), rowOf('Current ratio').textContent]);
    const achieved = [...h.doc.querySelectorAll('.xk-grid tbody tr')].filter((tr) => tr.children[5] && /^✓/.test(tr.children[5].textContent)).length;
    ok('hs: score = achieved ÷ 12 and every check passes (incl. NP = CYE movement), green', new RegExp(achieved + ' of 12 targets achieved').test(body(h)) && green(h) && /4\/4 checks passed · 1 for information/.test(banner(h)) && h.errs.length === 0, [achieved, banner(h)]);
    h.doc.querySelector('.xk-chip[data-chip="explain"]').click(); await h.settle();
    ok('hs: "Explain my health score" answers from the computed figures', /Your score is \d+ of 12 targets/.test(text(h.doc, '#hs-ins')), text(h.doc, '#hs-ins'));
    const h2b = await run('hs', Object.assign(man('hs'), { inputs: man('hs').inputs.map((i) => i.name === 'targets' ? Object.assign({}, i, { default: '{"cr":100,"cd":"off"}' }) : i) }), HS(), { htmlPatch: (x) => x.replace("targets: '{}'", "targets: '{\"cr\":100,\"cd\":\"off\"}'") });
    ok('hs: numeric target (current ratio ≥ 100) → missed; "off" removes a metric (11 targets)', /of 11 targets achieved/.test(body(h2b)) && /✗/.test([...h2b.doc.querySelectorAll('.xk-grid tbody tr')].find((tr) => tr.children[0] && tr.children[0].textContent === 'Current ratio').children[5].textContent) && !/Creditor days/.test(text(h2b.doc, '.xk-grid')), body(h2b).slice(0, 300));
    const h3 = await run('hs', man('hs'), HS({ bs: tamper(L.bs, (rows) => { cellOf(rows, 'Current Year Earnings')[1].Value = '1.00'; }) }));
    ok('hs: Current Year Earnings movement disagrees → Fail', /✗ Net profit for Aug 2026 = the movement in Current Year Earnings/.test(banner(h3)), banner(h3).slice(0, 300));
    await set(h, 'xk-view', 'actuals');
    ok('hs: Actuals mode hides targets and status', !/Importance/.test(text(h.doc, '.xk-grid thead')) && /Aug 2026/.test(text(h.doc, '.xk-grid thead')));
  }
  if (!only || only === 'vz') {
    // ---------------- P15 Visualise ----------------
    const VZ = (extra) => Object.assign({ pnl_12: L.pnl, bs_12: L.bs, bank: L.bankSummary, transfers: L.listBankTransfers, pnl_total: L.pnl, pnl_12_cash: L.pnl, pnl_total_cash: L.pnl, org: L.organisation, connections: L.connections }, extra || {});
    { const vc = await run('vz', man('vz'), VZ()); await wait(30); { const a = vc.doc.querySelector('input[name="xk-basis"][value="Cash"]'); a.checked = true; a.dispatchEvent(new vc.w.Event('change')); await vc.settle(); await wait(30); }
      ok('vz: Accounting method Cash → the cash-basis 12 months; months still re-add to the 12-month P&L; green', vc.calls.some((x) => x.id === 'pnl_12_cash' && x.params.paymentsOnly === true) && /✓ .*re-add/.test(banner(vc)) && green(vc) && /Cash basis/.test(text(vc.doc, '#xk-foot')), banner(vc).slice(0, 300)); }
    const v = await run('vz', man('vz'), VZ());
    ok('vz: Profitability tab — "Income vs Expenses · Monthly ending 31 August 2026", 12 months', /Income vs Expenses · Monthly ending 31 August 2026/.test(body(v)) && v.doc.querySelectorAll('#vz-ch rect').length === 24, body(v).slice(0, 200));
    ok('vz: checks pass (12 columns, months re-add to the 12-month P&L), green', green(v) && /2\/2 checks passed/.test(banner(v)), banner(v));
    ok('vz: no Bank Summary calls until the Cash tab is opened', !v.calls.some((x) => x.id === 'bank' && x.requery));
    const g = v.doc.getElementById('vz-g'); g.value = 'np'; g.dispatchEvent(new v.w.Event('change')); await v.settle();
    ok('vz: graph picker → Net profit (display only)', /Net profit · Monthly ending/.test(body(v)) && /(^|;)g=np/.test(JSON.parse(v.setInputsLog[v.setInputsLog.length - 1].display).o), body(v).slice(0, 120));
    v.doc.querySelector('.xk-chip[data-chip="perf"]').click(); await v.settle();
    ok('vz: insight chip answers from the numbers', text(v.doc, '#vz-ins').includes('net profit was $' + Math.round(E.netProfit('2025-09-01', '2026-08-31')).toLocaleString('en-AU') + ' on income of'), text(v.doc, '#vz-ins'));
    v.doc.querySelector('.xk-tab[data-v="cash"]').click(); await v.settle(); await wait(80);
    ok('vz: Cash tab → 12 monthly Bank Summary calls, cash in / out / net chart', v.calls.filter((x) => x.id === 'bank' && x.requery).length === 12 && v.doc.querySelector('#vz-ch svg') && /✓ Every month of the Bank Summary loaded/.test(banner(v)), [v.calls.filter((x) => x.id === 'bank').length, banner(v).slice(0, 300)]);
    { const tr = L.listBankTransfers({}).BankTransfers.filter((t) => t.DateString.slice(0, 7) === '2026-08').reduce((a, t) => a + t.Amount, 0), bs = L.bankSummary({ fromDate: '2026-08-01', toDate: '2026-08-31' }).Reports[0].Rows[1].Rows.find((r) => r.RowType === 'SummaryRow').Cells.map((c) => +c.Value || 0);
      const tips = [...v.doc.querySelectorAll('#vz-ch svg rect title')].map((t) => t.textContent), aug = tips.find((t) => /^Cash in · Aug/.test(t));
      ok('vz: Cash — transfers between your own accounts are taken out of cash in (Aug = Bank Summary received − transfers)', tr > 0 && !!aug && aug.endsWith('$' + Math.round(bs[2] - tr).toLocaleString('en-AU')) && /✓ Transfers between your accounts loaded/.test(banner(v)), [aug, bs[2], tr]); }
    const ac = v.doc.getElementById('vz-acct'); ac.value = 'Business Savings Account'; ac.dispatchEvent(new v.w.Event('change')); await v.settle();
    ok('vz: bank account subset (no refetch)', /Business Savings Account/.test(v.doc.getElementById('vz-acct').selectedOptions[0].textContent) && v.calls.filter((x) => x.id === 'bank' && x.requery).length === 12);
    v.doc.querySelector('.xk-tab[data-v="accounts"]').click(); await v.settle();
    const ct = v.doc.getElementById('vz-ct'); ct.value = 'stacked'; ct.dispatchEvent(new v.w.Event('change')); await v.settle();
    { const pickv = async (id, val) => { const el = v.doc.getElementById(id); el.value = val; el.dispatchEvent(new v.w.Event('change')); await v.settle(); await v.settle(); };
      await pickv('vz-src', 'bs'); ok('vz: Accounts — Balance Sheet totals (Total Assets, Total Liabilities, Net Assets, Bank)', /Balance Sheet totals · Monthly ending/.test(body(v)) && ['Total Assets', 'Total Liabilities', 'Net Assets', 'Bank'].every((n) => text(v.doc, '#vz-ch').includes(n)), text(v.doc, '#vz-ch').slice(0, 200));
      await pickv('vz-acc', 'Business Cheque Account'); await pickv('vz-acc2', 'Accounts Receivable');
      ok('vz: Accounts — up to three accounts together (Balance Sheet accounts)', /Business Cheque Account, Accounts Receivable · Monthly ending/.test(body(v)) && !!v.doc.getElementById('vz-acc3'), body(v).slice(0, 200));
      await pickv('vz-ct', 'bar'); ok('vz: Accounts — Bar chart (horizontal, a row per month)', v.doc.querySelectorAll('#vz-ch svg rect').length >= 12 && /Sep/.test(text(v.doc, '#vz-ch svg')));
      await pickv('vz-ct', 'area'); ok('vz: Accounts — Area chart', !!v.doc.querySelector('#vz-ch svg polygon'));
      await pickv('vz-acc', ''); await pickv('vz-acc2', ''); await pickv('vz-src', 'pl'); await pickv('vz-ct', 'stacked'); }
    ok('vz: Accounts tab — stacked P&L totals, chart-type toggle', /Profit and Loss totals · Monthly ending/.test(body(v)) && v.doc.querySelector('#vz-ch svg') && v.doc.getElementById('vz-ct').value === 'stacked');
    v.doc.querySelector('.xk-tab[data-v="kpis"]').click(); await v.settle();
    { const pickv = async (id, val) => { const el = v.doc.getElementById(id); el.value = val; el.dispatchEvent(new v.w.Event('change')); await v.settle(); await v.settle(); };
      for (const [id, name] of [['roa', 'Return on assets'], ['roe', 'Return on equity'], ['debt', 'Debt ratio']]) { await pickv('vz-k', id); ok('vz: KPIs — ' + name + ' with its formula', new RegExp(name + ' · Monthly ending').test(body(v)) && !!v.doc.querySelector('#vz-ch svg polyline'), body(v).slice(0, 200)); }
      await pickv('vz-k', 'dcd'); ok('vz: KPIs — debtors days and creditors days on one graph', v.doc.querySelectorAll('#vz-ch svg polyline').length === 2, v.doc.querySelectorAll('#vz-ch svg polyline').length);
      await pickv('vz-k', 'dd'); }
    ok('vz: KPIs tab — debtors days with its formula', /Formula: Debtors days = Accounts receivable ÷ total income × days in month/.test(body(v)) && /ℹ The ratio shows its formula \(information\)/.test(banner(v)));
    v.doc.querySelector('.xk-tab[data-v="benchmarks"]').click(); await v.settle();
    ok('vz: Industry benchmarks without a benchmark → N/A with how to add one (not a failure)', /N\/A — industry benchmarks are not in the Xero API/.test(body(v)) && green(v) && /– Benchmark comparison states its source — No benchmark provided/.test(banner(v)), banner(v).slice(0, 400));
    const vb = await run('vz', Object.assign(man('vz'), { inputs: man('vz').inputs.map((i) => i.name === 'bench' ? Object.assign({}, i, { default: '{"gpm":{"low":0.3,"high":0.4,"source":"ATO small business benchmarks 2024"}}' }) : i) }), VZ(), { htmlPatch: (x) => x.replace("bench: '{}'", "bench: '{\"gpm\":{\"low\":0.3,\"high\":0.4,\"source\":\"ATO small business benchmarks 2024\"}}'").replace('\\"v\\":\\"profitability\\"', '\\"v\\":\\"benchmarks\\"').replace('"v":"profitability"', '"v":"benchmarks"') });
    ok('vz: benchmark band with its source', /Benchmark: 30\.0% – 40\.0% · source: ATO small business benchmarks 2024/.test(body(vb)) && /✓ Benchmark comparison states its source/.test(banner(vb)), body(vb).slice(0, 400));
    v.doc.querySelector('.xk-tab[data-v="external"]').click(); await v.settle();
    ok('vz: External data without figures → N/A with how to add them', /N\/A — no external data yet/.test(body(v)));
    const vx = await run('vz', man('vz'), VZ(), { htmlPatch: (x) => x.replace("ext: '{}'", "ext: '{\"Staff employed\":{\"2026-07\":12,\"2026-08\":13}}'").replace('"v":"profitability"', '"v":"external"') });
    ok('vz: External data series plotted beside income', /Metric:/.test(body(vx)) && vx.doc.querySelector('#vz-ch svg') && vx.doc.querySelector('#vz-ch2 svg'), body(vx).slice(0, 200));
  }
  if (!only || only === 'cs') {
    // ---------------- P10 Cash Summary ----------------
    const CS = (extra) => Object.assign({ pnl_cash: L.pnl, bank: L.bankSummary, bs_start: L.bs, bs_end: L.bs, bs_m: L.bs, org: L.organisation, connections: L.connections }, extra || {});
    { const q = await run('cs', man('cs'), CS()); await wait(120); const stm = text(q.doc, '.xk-stmt');
      ok('cs: Xero\u2019s Cash Summary sections — Plus Fixed Assets / Current Assets / Current Liabilities / Non-current Liabilities / Equity, then Net Cash Movement', ['Plus Current Liabilities', 'Net Cash Movement'].every((x) => stm.includes(x)) && q.calls.some((x) => x.id === 'bs_m' && x.params.paymentsOnly === true && x.params.date === '2026-08-31') && q.calls.some((x) => x.id === 'bs_start' && x.params.date === '2026-06-30'), stm.slice(0, 600));
      ok('cs: net cash flows + balance-sheet movements = the movement in bank (three separate Xero reports), green', /✓ Net cash flows \+ balance-sheet movements = the movement in bank/.test(banner(q)) && green(q), banner(q).slice(0, 500)); }
    { const qt = await run('cs', man('cs'), CS({ bs_end: tamper(L.bs, (rows) => { const r = cellOf(rows, 'Loan - Westpac'); if (r) r[1].Value = String(+r[1].Value + 5000); }) })); await wait(120);
      ok('cs: a balance-sheet movement that does not reach the bank shows as Other (information, never a silent tie)', /Other \(not explained by the Balance Sheet/.test(text(qt.doc, '.xk-stmt')) && /ℹ Net cash flows \+ balance-sheet movements vs the movement in bank \(information\)/.test(banner(qt)), banner(qt).slice(0, 400)); }
    const s = await run('cs', man('cs'), CS()); await wait(80);
    const st = text(s.doc, '.xk-stmt'), head = [...s.doc.querySelectorAll('.xk-stmt thead th')].map((x) => x.textContent);
    ok('cs: header Cash Summary / organisation / period · Cash basis', /^Cash Summary\s*Northwind Trading Pty Ltd\s*For the period 1 July 2026 to 25 September 2026 · Cash basis/.test(text(s.doc, '#xk-head')), text(s.doc, '#xk-head'));
    ok('cs: month columns Jul | Aug | Sep + Total', head.join('|') === '|Jul 2026|Aug 2026|Sep 2026|Total', head);
    ok('cs: sections in order — Cash Received, Cash Spent, Net Cash Flows, Plus balance-sheet lines, Net Cash Movement, bank balances', ['Cash Received', 'Total Cash Received', 'Cash Spent', 'Total Cash Spent', 'Net Cash Flows', 'Plus Current Liabilities', 'Net Cash Movement', 'Net Movement in Bank', 'Opening bank balance', 'Closing bank balance'].every((x, i, a) => st.indexOf(x) >= 0 && (i === 0 || st.indexOf(x) > st.indexOf(a[i - 1]))), st.slice(0, 400));
    const cashNp = E.netProfit('2026-07-01', L.TODAY, true);
    const netRow = [...s.doc.querySelectorAll('.xk-stmt tr')].find((tr) => tr.children[0].textContent === 'Net Cash Flows');
    ok('cs: Net Cash Flows (total) = the books\' cash-basis profit', netRow.lastElementChild.textContent === fmt(cashNp).replace(/\\/g, ''), [fmt(cashNp), netRow.textContent]);
    const closeRow = [...s.doc.querySelectorAll('.xk-stmt tr')].find((tr) => tr.children[0].textContent === 'Closing bank balance'), close = L.r2(E.bankBalance('090', L.TODAY) + E.bankBalance('091', L.TODAY));
    ok('cs: closing bank balance = the books', closeRow.lastElementChild.textContent === fmt(close).replace(/\\/g, ''), closeRow.textContent);
    ok('cs: every check passes (net = received − spent, Xero NP, bank, months add up, months chain, bank movement tie), green', green(s) && /6\/6 checks passed/.test(banner(s)) && s.errs.length === 0, banner(s));
    await set(s, 'xk-view', 'total');
    ok('cs: Total only view — no month fan-out, still green', [...s.doc.querySelectorAll('.xk-stmt thead th')].map((x) => x.textContent).join('|') === '|Total' && green(s));
    const s2 = await run('cs', man('cs'), CS({ pnl_cash: (q) => { const r = L.pnl(q); if (q.fromDate === '2026-08-01') { const c2 = cellOf(r.Reports[0].Rows, 'Sales'); c2[1].Value = (+c2[1].Value + 500).toFixed(2); } return r; } })); await wait(80);
    ok('cs: a month disagrees with the period total → Fail', /✗ Month columns add up to the period total/.test(banner(s2)), banner(s2).slice(0, 400));
  }
  if (!only || only === 'cf') {
    // ---------------- P13 Cash flow manager ----------------
    const CF = (extra) => Object.assign({ bank: L.bankSummary, bank_past: L.bankSummary, receivables: L.listInvoices, payables: L.listInvoices, bank_tx: L.listBankTransactions, payments: L.listPayments, tb: L.trialBalance, org: L.organisation, connections: L.connections }, extra || {});
    const f = await run('cf', man('cf'), CF()); await wait(40);
    const bal = L.r2(E.bankBalance('090', L.TODAY) + E.bankBalance('091', L.TODAY)), md = (v) => (v < 0 ? '(' : '') + '$' + Math.round(Math.abs(v)).toLocaleString('en-AU') + (v < 0 ? ')' : '');
    const kp = [...f.doc.querySelectorAll('.xk-kpis')[0].querySelectorAll('.xk-kpi')].map((k) => k.textContent.replace(/\s+/g, ' ').trim());
    ok('cf: today\'s bank balance = the books', kp[0].startsWith("Today's bank balance" + md(bal)), [md(bal), kp[0]]);
    const recv = L.listInvoices({ where: 'Type=="ACCREC"', statuses: 'AUTHORISED' }).Invoices, bills = L.listInvoices({ where: 'Type=="ACCPAY"', statuses: 'AUTHORISED' }).Invoices;
    const due = (list, a, b) => list.filter((d) => { const k = d.DueDateString.slice(0, 10); return k >= L.addDays(L.TODAY, a) && k <= L.addDays(L.TODAY, b); }).reduce((s, d) => s + d.AmountDue, 0);
    const k17 = L.r2(due(recv, 1, 7) - due(bills, 1, 7));
    ok('cf: next 1–7 days = invoices − bills due in that window', kp[2] === 'Next 1–7 days cash movement' + md(k17), [md(k17), kp[2]]);
    ok('cf: every check passes (projection identity, KPIs = daily series, Trial Balance bank, 30-day actuals = Bank Summary), green', green(f) && /4\/4 checks passed · 2 for information/.test(banner(f)) && /✓ Every invoice and bill awaiting payment is projected, overdue or due later/.test(banner(f)) && f.errs.length === 0, banner(f));
    ok('cf: bank transactions and payments filtered to the last 30 days (where from the dates)', f.calls.some((x) => x.id === 'bank_tx' && x.params.where === 'Date>=DateTime(2026,08,26) AND Date<=DateTime(2026,09,25)') && f.calls.some((x) => x.id === 'payments' && /DateTime\(2026,08,26\)/.test(x.params.where)), f.calls.filter((x) => x.id === 'bank_tx').map((x) => x.params.where));
    const pb = [...f.doc.querySelectorAll('.xk-kpis')[1].querySelectorAll('.xk-kpi')].map((k) => k.textContent.replace(/\s+/g, ' ').trim());
    { const svg = f.doc.querySelector('#cf-ch svg'), mk = svg && svg.querySelector('line.xk-mark'), labels = svg ? [...svg.querySelectorAll('text')].map((t) => t.textContent) : [];
      const proj = svg ? svg.querySelectorAll('rect.proj').length : 0, act = svg ? svg.querySelectorAll('rect:not(.proj)').length : 0;
      ok('cf: a dashed Today divider with its label; projected bars lighter than actuals', !!mk && labels.includes('Today') && proj > 0 && act > 0, { mk: !!mk, labels: labels.slice(0, 12), proj, act });
      const tipped = svg ? [...svg.querySelectorAll('rect.proj title')].map((t) => t.textContent).find((t) => t.includes('\n')) : null;
      ok('cf: hovering a projected bar names its largest invoices or bills', !!tipped && /: \(?\$/.test(tipped.split('\n')[1] || ''), tipped);
      ok('cf: Overview / Manage cash in / Manage cash out as tabs', [...f.doc.querySelectorAll('#xk-body .xk-tab')].map((b) => b.textContent).join('|') === 'Overview|Manage cash in|Manage cash out'); }
    ok('cf: summary row — today, 30 days projected balance, cash runway', /^30 days projected balance/.test(pb[1]) && /^Cash runway/.test(pb[2]), pb);
    await set(f, 'xk-opt-d', '90');
    ok('cf: graph days 90 → "Next 8–90 days", still reconciles', /Next 8–90 days cash movement/.test(body(f)) && green(f));
    await set(f, 'xk-opt-od', 'today');
    ok('cf: overdue expected today → projection includes them, still reconciles', /Overdue, expected today/.test(body(f)) && green(f), body(f).slice(0, 200));
    const sel = f.doc.getElementById('cf-acct'); sel.value = sel.options[2].value; sel.dispatchEvent(new f.w.Event('change')); await f.settle();
    ok('cf: one bank account → its balance, tied to that account on the Trial Balance; actuals still tie',kp[0] !== [...f.doc.querySelectorAll('.xk-kpis')[0].querySelectorAll('.xk-kpi')][0].textContent.replace(/\s+/g, ' ').trim() && /✓ Today's bank balance = the same accounts on the Trial Balance today/.test(banner(f)) && /✓ Last 30 days/.test(banner(f)), banner(f).slice(0, 600));
    f.doc.querySelector('.xk-tab') ; await set(f, 'xk-view', 'in');
    ok('cf: Manage cash in lists invoices due (and overdue)', /Cash in — invoices due/.test(body(f)) && f.doc.querySelectorAll('#cf-list tbody tr').length > 0);
    const f2 = await run('cf', man('cf'), CF({ bank_tx: (q) => { const r = L.listBankTransactions(q); r.BankTransactions = r.BankTransactions.slice(1); return r; } })); await wait(40);
    { const fp = await run('cf', man('cf'), CF()); await wait(40); await set(fp, 'xk-view', 'out'); fp.doc.getElementById('cf-pd').value = '2026-10-05'; fp.doc.getElementById('cf-pa').value = '5000'; fp.doc.getElementById('cf-pn').value = 'Tax payment'; fp.doc.getElementById('cf-padd').click(); await fp.settle(); await wait(40);
      const saved = JSON.parse(fp.setInputsLog[fp.setInputsLog.length - 1].planned || '[]');
      ok('cf: a planned payment added in Manage cash out is kept with the report (planned input) and listed', saved.length === 1 && saved[0].a === -5000 && saved[0].d === '2026-10-05' && /Tax payment/.test(body(fp)), [saved, body(fp).slice(0, 200)]);
      await set(fp, 'xk-view', 'overview'); await wait(30); const tip = [...fp.doc.querySelectorAll('#cf-ch svg rect title')].map((t) => t.textContent).find((t) => /Tax payment \(planned\)/.test(t));
      ok('cf: the planned payment is in the projection on its date (and the documents check still passes)', !!tip && /05\/10/.test(tip) && green(fp), [tip, banner(fp).slice(0, 200)]); }
    { const fd = await run('cf', man('cf'), CF(), { htmlPatch: (h) => h.split('later[k] = r2(later[k] + d.amount); return;').join('return;') }); await wait(40);
      ok('cf: a projection that drops documents (simulated bug: due-later items lost) → the documents check fails', /✗ Every invoice and bill awaiting payment is projected/.test(banner(fd)), banner(fd).slice(0, 300)); }
    ok('cf: a missing transaction → the 30-day actuals no longer match the Bank Summary → Fail', /✗ Last 30 days: bank transactions \+ payments = the Bank Summary/.test(banner(f2)), banner(f2).slice(0, 400));
  }
  if (!only || only === 'gst') {
    // ---------------- P05 GST summary (activity statement) ----------------
    const GS = (extra) => Object.assign({ payments: L.listPayments, paid_inv: L.listInvoices, pay_runs: L.listPayRuns, invoices: L.listInvoices, credit_notes: L.listCreditNotes, bank_tx: L.listBankTransactions, tax_rates: L.listTaxRates, accounts: L.listAccounts, bs_end: L.bs, bs_start: L.bs, org: L.organisation, connections: L.connections }, extra || {});
    const g = await run('gst', man('gst'), GS());
    const B = E.books(L.T1), inQ = (d) => d >= '2026-04-01' && d <= '2026-06-30';
    const lines = [].concat(...B.docs.filter((d) => (d.status === 'AUTHORISED' || d.status === 'PAID') && inQ(d.date)).map((d) => d.LineItems.map((l) => ({ l, sales: d.Type === 'ACCREC' })))).concat(...B.bank.filter((x) => inQ(x.date)).map((x) => x.LineItems.map((l) => ({ l, sales: x.Type === 'RECEIVE' }))));
    const A1 = L.r2(lines.filter((x) => x.sales && x.l.TaxType === 'OUTPUT').reduce((s, x) => s + x.l.TaxAmount, 0)), B1 = L.r2(lines.filter((x) => !x.sales && /^(INPUT|CAPEXINPUT)$/.test(x.l.TaxType)).reduce((s, x) => s + x.l.TaxAmount, 0));
    const G2 = L.r2(lines.filter((x) => x.sales && x.l.TaxType === 'EXEMPTEXPORT').reduce((s, x) => s + x.l.LineAmount, 0));
    const fv = (code) => { const tr = [...g.doc.querySelectorAll('.xk-grid tr')].find((r) => r.children[0] && r.children[0].textContent === code); return tr ? tr.children[2].textContent : null; };
    const $ = (v) => fmt(v).replace(/\\/g, '');
    ok('gst: last quarter (Apr–Jun 2026) by default, "not your Activity Statement" banner', /For the 3 months ended 30 June 2026/.test(text(g.doc, '#xk-head')) && /This is not your Activity Statement/.test(body(g)), text(g.doc, '#xk-head'));
    ok('gst: 1A GST on sales and 1B GST on purchases = the books', fv('1A') === $(A1) && fv('1B') === $(B1), [fv('1A'), $(A1), fv('1B'), $(B1)]);
    ok('gst: net GST = 1A − 1B = the ledger\'s GST for the quarter', new RegExp('Net GST (payable|refundable) \\(1A − 1B\\)' + fmt(Math.abs(E.gst('2026-04-01', '2026-06-30')))).test(body(g)) && L.r2(A1 - B1) === E.gst('2026-04-01', '2026-06-30'), [A1 - B1, E.gst('2026-04-01', '2026-06-30')]);
    ok('gst: G2 export sales from GST-free export lines', fv('G2') === $(G2), [fv('G2'), $(G2)]);
    ok('gst: due 28 July 2026 (quarterly)', /Due 28 July 2026/.test(body(g)), body(g).slice(0, 900));
    ok('gst: every check passes incl. GST account movement = net GST − BAS paid, green', green(g) && /8\/8 checks passed/.test(banner(g)) && /✓ GST account movement on the Balance Sheet = net GST − GST paid to the ATO — .* paid/.test(banner(g)) && g.errs.length === 0, banner(g));
    ok('gst: documents filtered to the period in Xero (where from the dates)', g.calls.some((x) => x.id === 'invoices' && x.params.where === 'Date>=DateTime(2026,04,01) AND Date<=DateTime(2026,06,30)' && x.params.statuses === 'AUTHORISED,PAID'), g.calls.filter((x) => x.id === 'invoices').map((x) => x.params.where));
    ok('gst: every PAYG code the library lists is shown — W4, W3, T1, T2, 5A N/A (not in the Xero APIs)', ['W4', 'W3', 'T1', 'T2', '5A'].every((k) => fv(k) === 'N/A — not in source'), ['W4', 'W3', 'T1', 'T2', '5A'].map(fv));
    { const runs = L.listPayRuns({}).PayRuns.filter((r) => { const d = new Date(+/\d+/.exec(r.PaymentDate)[0]).toISOString().slice(0, 10); return r.PayRunStatus === 'POSTED' && d >= '2026-04-01' && d <= '2026-06-30'; });
      const w1 = L.r2(runs.reduce((a, r) => a + r.Wages, 0)), w2 = L.r2(runs.reduce((a, r) => a + r.Tax, 0));
      ok('gst: W1 / W2 = gross wages and tax withheld on the pay runs paid in the quarter (Xero Payroll AU)', runs.length === 3 && fv('W1') === $(w1) && fv('W2') === $(w2), [runs.length, fv('W1'), $(w1), fv('W2'), $(w2)]);
      ok('gst: W2 consistent with W1 — passes, pay runs fetched for the selected organisation', /✓ W2 consistent with W1/.test(banner(g)) && g.calls.some((x) => x.id === 'pay_runs' && 'xero_tenant_id' in x.params) && green(g), banner(g).slice(0, 300)); }
    { const gn = await run('gst', man('gst'), GS(), { fail: { pay_runs: { code: 'needs_connection', message: 'Connect xero-payroll-au to see this data' } } }); const f2 = (code) => { const tr = [...gn.doc.querySelectorAll('.xk-grid tr')].find((r) => r.children[0] && r.children[0].textContent === code); return tr ? tr.children[2].textContent : null; };
      ok('gst: Xero Payroll (Australia) not connected → W1 / W2 N/A with the reason, banner still green, never red in Sources', f2('W1') === 'N/A — not in source' && /Xero Payroll \(Australia\) is not connected/.test(body(gn)) && green(gn) && !gn.doc.querySelector('#xk-sources .xk-err'), [f2('W1'), banner(gn).slice(0, 200)]); }
    { const gw = await run('gst', man('gst'), GS({ pay_runs: (q) => { const r = L.listPayRuns(q); r.PayRuns.forEach((p) => { p.Tax = p.Wages * 0.6; }); return r; } }));
      ok('gst: tax withheld above 47% of wages → the W2 check fails', /✗ W2 consistent with W1/.test(banner(gw)), banner(gw).slice(0, 300)); }
    { const gm = await run('gst', man('gst'), GS({ org: (q) => { const o = L.organisation(q); o.Organisations[0].SalesTaxPeriod = 'MONTHLY'; return o; } })); await set(gm, 'xk-view', 'list');
      const per = [...gm.doc.querySelectorAll('#xk-body .xk-grid tbody tr')].map((tr) => tr.children[0].textContent);
      ok('gst: a monthly GST filer’s statements list shows the last 6 months, not quarters', /monthly GST/.test(body(gm)) && per.length === 6 && per.every((p) => /^month ended/.test(p)), per); }
    await set(g, 'xk-view', 'lines');
    ok('gst: Tax lines view lists every line with its BAS fields', g.doc.querySelectorAll('#gst-lines tbody tr').length === lines.length && /G1, 1A/.test(text(g.doc, '#gst-lines')), [g.doc.querySelectorAll('#gst-lines tbody tr').length, lines.length]);
    await set(g, 'xk-view', 'list');
    g.doc.querySelectorAll('button[data-q]')[1].click(); await g.settle(); await g.settle();
    ok('gst: Statements list → the Jan–Mar 2026 button refetches that quarter', g.calls.some((x) => x.requery && x.id === 'invoices' && x.params.where === 'Date>=DateTime(2026,01,01) AND Date<=DateTime(2026,03,31)') && /For the 3 months ended 31 March 2026/.test(text(g.doc, '#xk-head')), g.calls.filter((x) => x.requery).map((x) => x.id + ':' + x.params.where));
    const g2 = await run('gst', man('gst'), GS());
    await set(g2, 'xk-preset', 'custom'); await set(g2, 'xk-from', '2025-07-01'); await set(g2, 'xk-to', '2025-09-30');
    ok('gst: a quarter with the capital purchase → G10 filled, still ties', /G10Capital purchases \(including any GST\)\$2,640\.00/.test(text(g2.doc, '.xk-grid')) && green(g2), [text(g2.doc, '.xk-grid').slice(0, 400), banner(g2).slice(0, 300)]);
    const g3 = await run('gst', man('gst'), GS({ bs_end: tamper(L.bs, (rows) => { cellOf(rows, 'GST')[1].Value = '1.00'; }) }));
    ok('gst: GST account on the Balance Sheet disagrees → Fail', /✗ GST account movement/.test(banner(g3)) && red(g3), banner(g3).slice(0, 300));
    const g4 = await run('gst', man('gst'), GS({ invoices: (q) => { const r = L.listInvoices(q); const d = r.Invoices.find((x) => x.Type === 'ACCREC'); if (d) d.LineItems = d.LineItems.map((l, i) => (i === 0 ? Object.assign({}, l, { TaxType: 'TAX002' }) : l)); return r; } }));
    ok('gst: a custom tax rate missing from the tax-rate list → "Every tax rate used maps to a BAS field" fails and names it', /✗ Every tax rate used maps to a BAS field — Not mapped: TAX002/.test(banner(g4)), banner(g4).slice(0, 400));
    const gnz = await run('gst', man('gst'), GS({ org: () => { const o = L.organisation({}); o.Organisations[0].SalesTaxBasis = 'PAYMENTS'; return o; } })); await wait(120);
    { const pays = L.listPayments({ where: 'Date>=DateTime(2026,04,01) AND Date<=DateTime(2026,06,30)' }).Payments.filter((p) => p.PaymentType === 'ACCRECPAYMENT');
      const tax = pays.reduce((a, p) => { const d = L.listInvoices({ ids: p.Invoice.InvoiceID }).Invoices[0]; return a + d.TotalTax * p.Amount / d.Total; }, 0);
      const rec = L.listBankTransactions({ where: 'Date>=DateTime(2026,04,01) AND Date<=DateTime(2026,06,30)' }).BankTransactions.filter((b) => b.Type === 'RECEIVE' && b.Status === 'AUTHORISED').reduce((a, b) => a + b.TotalTax, 0);
      const cr = L.listCreditNotes({ where: 'Date>=DateTime(2026,04,01) AND Date<=DateTime(2026,06,30)' }).CreditNotes.filter((x) => x.Type === 'ACCRECCREDIT' && /AUTHORISED|PAID/.test(x.Status)).reduce((a, x) => a + x.TotalTax, 0);
      const fz = (code) => { const tr = [...gnz.doc.querySelectorAll('.xk-grid tr')].find((r) => r.children[0] && r.children[0].textContent === code); return tr ? tr.children[2].textContent : null; };
      ok('gst: cash-basis GST organisation → 1A = GST on payments received in the period (each payment\u2019s share of its invoice), banner says so', /these figures are the GST on payments received and made in the period/.test(body(gnz)) && fz('1A') === $(L.r2(tax + rec - cr)) && gnz.calls.some((x) => x.id === 'paid_inv' && x.params.ids) && /✓ Cash basis: every payment's invoice loaded/.test(banner(gnz)), [fz('1A'), $(L.r2(tax + rec - cr)), banner(gnz).slice(0, 200)]);
      ok('gst: cash basis — the Balance Sheet GST tie is information, banner green', /ℹ GST account movement on the Balance Sheet vs net GST \(information — cash basis\)/.test(banner(gnz)) && green(gnz), banner(gnz).slice(0, 400)); }
  }
  if (!only || only === 'rc') {
    // ---------------- P04 All reports (catalog) ----------------
    const r = await run('rc', man('rc'), { org: L.organisation, connections: L.connections });
    ok('rc: groups in Xero order with Favourites first', ['Favourites', 'Financial statements', 'Payables and receivables', 'Reconciliations', 'Taxes and balances', 'Dashboards and analytics'].every((x, i, a) => body(r).indexOf(x) >= 0 && (i === 0 || body(r).indexOf(x) > body(r).indexOf(a[i - 1]))), body(r).slice(0, 300));
    ok('rc: live reports carry their prompt ID and what to ask', /Profit and Loss Live P06 ?Ask: "Profit and loss this financial year to date"/.test(body(r)) && /Aged Receivables Summary Live P08/.test(body(r)), body(r).slice(0, 600));
    ok('rc: reports without a prompt are flagged, never implied live', /Journal Report No prompt yet/.test(body(r)) && /Not in this agent yet — open it in Xero → Reporting/.test(body(r)));
    ok('rc: added skills shown, every one Live (all on the kit) — Trial Balance, General Ledger, Month-end task list, Exceptions dashboard; nothing "Built on request"', /Trial Balance Live Added/.test(body(r)) && /General Ledger Live Added/.test(body(r)) && /Month-end task list Live Added/.test(body(r)) && /Exceptions dashboard Live/.test(body(r)) && !/Built on request/.test(body(r)), body(r).slice(0, 1600));
    ok('rc: both checks pass, green', green(r) && /2\/2 checks passed/.test(banner(r)), banner(r));
    const qi = r.doc.getElementById('rc-q'); qi.value = 'aged'; qi.dispatchEvent(new r.w.Event('change')); await r.settle();
    ok('rc: search filters the catalogue (display only)', /Aged Payables Summary/.test(body(r)) && !/Journal Report/.test(body(r)), body(r).slice(0, 300));
    { const r2 = await run('rc', man('rc'), { org: L.organisation, connections: L.connections }); const favs = () => [...r2.doc.querySelectorAll('#xk-body .xk-card')][1].textContent;
      const st = [...r2.doc.querySelectorAll('.rc-star')].find((b) => /Trial Balance/.test(b.parentNode.textContent)); st.click(); await r2.settle(); await r2.settle();
      ok('rc: starring a report adds it to Favourites (saved in the display settings)', /Favourites/.test(favs()) && /Trial Balance/.test(favs()) && /fav=/.test(JSON.parse(r2.setInputsLog[r2.setInputsLog.length - 1].display).o), r2.setInputsLog.slice(-1));
      const un = [...r2.doc.querySelectorAll('.rc-star')].find((b) => /Balance Sheet/.test(b.parentNode.textContent) && b.textContent === '★'); un.click(); await r2.settle(); await r2.settle();
      ok('rc: un-starring removes it', !/^Favourites[\s\S]*★Balance Sheet/.test(favs()), favs().slice(0, 300));
      const x = await xlsxOf(r2); ok('rc: Download Excel carries the catalogue', /Aged Receivables Summary/.test(x) && /No prompt yet/.test(x) && /Prompt ID/.test(x)); }
  }
  if (!only || only === 'pnlx') {
    // ---------------- P06 Profit and Loss: tracking columns, several comparison periods, View as (ledger) ----------------
    const PLX = (extra) => Object.assign({ pnl: L.pnl, pnl_cash: L.pnl, pnl_compare: L.pnl, pnl_compare_cash: L.pnl, tb_end: L.trialBalance, pnl_tracking: L.pnl, pnl_tracking_cash: L.pnl, tracking_cats: L.listTrackingCategories, org: L.organisation, connections: L.connections }, extra || {});
    const npOf = (r, col) => { const x = r.Reports[0].Rows.find((y) => y.Title === '' && y.Rows[0].Cells[0].Value === 'Net Profit'); return +x.Rows[0].Cells[col == null ? 1 : col].Value; };
    const t = await run('pnl', man('pnl'), PLX()); await wait(40);
    const REG = L.TRACKING[0].TrackingCategoryID;
    ok('pnlx: tracking picker lists the organisation\u2019s tracking categories; none chosen → no tracking section, nothing about it in the banner, green', [...t.doc.querySelectorAll('#pl-track option')].map((o) => o.textContent).join('|') === 'None|Region' && !/by Region/.test(body(t)) && !/tracking/i.test(banner(t)) && green(t), [banner(t).slice(0, 300)]);
    await set(t, 'pl-track', REG); await wait(40);
    const heads = [...t.doc.querySelectorAll('#xk-body .xk-card .xk-stmt thead th')].map((x) => x.textContent);
    ok('pnlx: choosing Region refetches the P&L by tracking category and shows North / South / Unassigned / Total', t.calls.some((x) => x.requery && x.id === 'pnl_tracking' && x.params.trackingCategoryID === REG) && /Profit and Loss by Region/.test(body(t)) && heads.join('|') === '|North|South|Unassigned|Total', heads);
    ok('pnlx: tracking checks pass — columns add up to Total, and Total Net Profit = this P&L (separate Xero reports)', /✓ Tracking columns add up to the Total column/.test(banner(t)) && /✓ Tracking Total Net Profit = this Profit and Loss/.test(banner(t)) && green(t), banner(t).slice(0, 500));
    { t.doc.getElementById('xk-xlsx').click(); await t.settle(); const b = t.downloads.filter((d) => d.blob).pop(), x = b ? Buffer.from(await b.blob.arrayBuffer()).toString('utf8') : '';
      ok('pnlx: Excel adds a "By Region" sheet', /name="By Region"/.test(x)); }
    const tt = await run('pnl', man('pnl'), PLX({ pnl_tracking: tamper(L.pnl, (rows) => { const npRow = rows.find((y) => y.Title === '' && y.Rows[0].Cells[0].Value === 'Net Profit').Rows[0]; npRow.Cells[npRow.Cells.length - 1].Value = '1.00'; }) })); await set(tt, 'pl-track', REG); await wait(40);
    ok('pnlx: tracking report disagreeing with the P&L → Fail (and its Total no longer adds up)', /✗ Tracking Total Net Profit = this Profit and Loss/.test(banner(tt)) && red(tt), banner(tt).slice(0, 400));
    // several periods
    const m = await run('pnl', man('pnl'), PLX()); await wait(40);
    await set(m, 'xk-cmp', 'periods'); await set(m, 'xk-opt-np', '3'); await wait(80);
    const W = [['2026-06-01', '2026-08-25'], ['2026-05-01', '2026-07-25'], ['2026-04-01', '2026-06-25']];
    ok('pnlx: Several periods → Periods / Period of controls appear, and the previous 3 months are fetched', !!m.doc.getElementById('xk-opt-np') && !!m.doc.getElementById('xk-opt-tf') && W.every(([a, b]) => m.calls.some((x) => x.id === 'pnl_compare' && x.params.fromDate === a && x.params.toDate === b)), m.calls.filter((x) => x.id === 'pnl_compare').map((x) => x.params.fromDate + '..' + x.params.toDate));
    const npRow = [...m.doc.querySelectorAll('.xk-stmt tbody tr')].find((tr) => /^Net Profit/.test(tr.children[0].textContent));
    const vals = npRow ? [...npRow.children].slice(1).map((td) => td.textContent) : [];
    const exp = [npOf(L.pnl({ fromDate: '2026-07-01', toDate: '2026-09-25' }))].concat(W.map(([a, b]) => npOf(L.pnl({ fromDate: a, toDate: b }))));
    ok('pnlx: one Net Profit column per period, each = the books for that window', vals.length === 4 && exp.every((v, i) => vals[i] === (v < 0 ? '(' : '') + '$' + Math.abs(v).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + (v < 0 ? ')' : '')), [vals, exp]);
    ok('pnlx: "Comparison periods loaded" passes, still green', /✓ Comparison periods loaded — 3 period/.test(banner(m)) && green(m), banner(m).slice(0, 400));
    await set(m, 'xk-opt-tf', 'y'); await wait(80);
    ok('pnlx: Period of Year → the same months in the 3 previous years', [['2025-07-01', '2025-09-25'], ['2024-07-01', '2024-09-25'], ['2023-07-01', '2023-09-25']].every(([a, b]) => m.calls.some((x) => x.id === 'pnl_compare' && x.params.fromDate === a && x.params.toDate === b)));
    { const a = m.doc.querySelector('input[name="xk-basis"][value="Cash"]'); a.checked = true; a.dispatchEvent(new m.w.Event('change')); await m.settle(); await wait(80); }
    ok('pnlx: Cash basis → the comparison periods come from the cash-basis P&L', m.calls.some((x) => x.id === 'pnl_compare_cash' && x.params.paymentsOnly === true && x.params.fromDate === '2025-07-01'));
    // Year end set in the report (the library's editable parameter panel)
    { const y = await run('pnl', man('pnl'), PLX()); await wait(30); const opts = [...y.doc.querySelectorAll('#xk-fy option')].map((o) => o.textContent);
      await set(y, 'xk-fy', '3'); await wait(30);
      ok('pnlx: Year end control (Xero\u2019s by default); choosing March re-rolls This financial year to date to 1 April and refetches', opts[0] === 'Xero (June)' && opts.length === 13 && y.doc.getElementById('xk-from').value === '2026-04-01' && y.calls.some((x) => x.requery && x.id === 'pnl' && x.params.fromDate === '2026-04-01') && /Financial year starts April \(set in this report — year ends March\)/.test(banner(y)), [opts.slice(0, 2), y.doc.getElementById('xk-from').value, banner(y).slice(0, 200)]);
      ok('pnlx: the Year end is saved with the report (display fy)', JSON.parse(y.setInputsLog[y.setInputsLog.length - 1].display).fy === '3'); }
    // View as lives in the display settings now
    await set(m, 'xk-persona', 'Client');
    ok('pnlx: View as Client → summary mode, kept in the display settings (no input slot)', m.doc.body.classList.contains('persona-summary') && JSON.parse(m.setInputsLog[m.setInputsLog.length - 1].display).pv === 'Client' && !('persona' in m.setInputsLog[m.setInputsLog.length - 1]), m.setInputsLog.slice(-1));
  }
  if (!only || only === 'tb') {
    // ---------------- Trial Balance (added skill, not in the library) ----------------
    const TB = (extra) => Object.assign({ tb: L.trialBalance, tb_cash: L.trialBalance, pnl_tie: L.pnl, org: L.organisation, connections: L.connections }, extra || {});
    const t = await run('tb', man('tb'), TB());
    const kp = [...t.doc.querySelectorAll('.xk-kpis .xk-kpi')].map((k) => k.textContent.replace(/\s+/g, ' ').trim());
    // live QA, 4 Oct 2026: Xero's Debit / Credit columns are the month's movement ($0.00 a few days into October) — the tiles read the YTD columns
    ok('tb: the tiles are the YTD columns, with this month\'s movement beside them', kp[0].startsWith('YTD Debits$') && kp[0].slice(10) === kp[1].slice(11) && kp[0].slice(10) !== '$0.00' && /^This month\$[\d,.]+ Dr · \$[\d,.]+ Cr$/.test(kp[2]), kp);
    ok('tb: every check passes (both pairs, Xero Total = Σ accounts, Revenue − Expenses = the P&L to the same date — exact, unlike Xero\'s month-end Balance Sheet), green', green(t) && /3\/3 checks passed · 1 N\/A/.test(banner(t)) && new RegExp('✓ Revenue − Expenses \\(YTD columns\\) = Net Profit on the Profit and Loss 2026-07-01 to 2026-09-25 \\(a separate Xero report\\) — ' + fmt(E.netProfit('2026-07-01', L.TODAY)) + ' vs').test(banner(t)) && t.errs.length === 0, banner(t));
    ok('tb: Xero\'s Revenue / Expenses / Assets / Liabilities / Equity sections and the grand Total in order', ['Revenue', 'Expenses', 'Assets', 'Liabilities', 'Equity', 'Total'].every((x, i, a) => text(t.doc, '.xk-stmt').indexOf(x) >= 0 && (i === 0 || text(t.doc, '.xk-stmt').indexOf(x) > text(t.doc, '.xk-stmt').indexOf(a[i - 1]))));
    const t2 = await run('tb', man('tb'), TB({ tb: tamper(L.trialBalance, (rows) => { const r = rows.find((x) => x.Title === 'Assets').Rows[0]; r.Cells[1].Value = (+r.Cells[1].Value + 100).toFixed(2); }) }));
    ok('tb: an account off by $100 → Debits ≠ Credits and the Total row check fail', /✗ Total Debits = Total Credits/.test(banner(t2)) && /✗ Xero's Total row = Σ the accounts/.test(banner(t2)) && red(t2), banner(t2).slice(0, 400));
    const t3 = await run('tb', man('tb'), TB({ tb: (q) => { const r = L.trialBalance(q); const rows = r.Reports[0].Rows; rows[0].Cells = [{ Value: 'Account' }, { Value: 'Balance' }]; rows.forEach((s) => (s.Rows || []).forEach((k) => { k.Cells = k.Cells.slice(0, 2); })); return r; } }));
    ok('tb: a single balance column → Debit = Credit is N/A with the columns named (never a guessed pass)', /– Total Debits = Total Credits — Xero returned column\(s\) Balance instead of separate Debit \/ Credit columns/.test(banner(t3)), banner(t3).slice(0, 400));
    const t4 = await run('tb', man('tb'), TB({ pnl_tie: tamper(L.pnl, (rows) => { cellOf(rows, 'Net Profit')[1].Value = '1.00'; }) }));
    ok('tb: the P&L\'s Net Profit differs → the independent tie fails', /✗ Revenue − Expenses/.test(banner(t4)), banner(t4).slice(0, 400));
  }
  if (!only || only === 'me') {
    // ---------------- Month-end task list (added skill; xero-accounting + xero-payroll-au + xero-assets) ----------------
    const ME = (extra) => Object.assign({ bank: L.bankSummary, receivables: L.listInvoices, payables: L.listInvoices, journals: L.listManualJournals, bs: L.bs, pay_runs: L.listPayRuns, timesheets: L.listTimesheets, assets: L.listAssets, org: L.organisation, connections: L.connections }, extra || {});
    const m = await run('me', man('me'), ME());
    const taskText = (k) => [...k.children].map((e) => e.textContent.replace(/\s+/g, ' ').trim()).join(' '), tasks = () => [...m.doc.querySelectorAll('#xk-body .xk-card .xk-kpi')].map(taskText);
    const has = (list, cat, re) => list.some((t) => t.startsWith(cat) && re.test(t));
    const tl = tasks();
    ok('me: last month (August 2026) by default', /For the month ended 31 August 2026/.test(text(m.doc, '#xk-head')) && m.calls.some((x) => x.id === 'journals' && x.params.where === 'Date>=DateTime(2026,08,01) AND Date<=DateTime(2026,08,31)'), text(m.doc, '#xk-head'));
    ok('me: draft pay run for the period → Required', has(tl, 'Required', /Pay run not posted: 1 Aug 2026 – 31 Aug 2026 Status DRAFT/), tl);
    ok('me: unapproved timesheets in the period → Review (2 timesheets, 75.5 hours)', has(tl, 'Review', /Timesheets not yet approved 2 timesheet\(s\) · 75\.5 hours/), tl);
    ok('me: draft manual journal → Required; $10,000 posted journal → Review; voided one ignored', has(tl, 'Required', /Draft manual journal: Accrued audit fee 31 Aug 2026/) && has(tl, 'Review', /Large or round journal: Insurance prepaid — funded by loan drawdown .*\$10,000\.00/) && !tl.some((t) => /Duplicate entry/.test(t)), tl);
    ok('me: non-zero Suspense on the Balance Sheet → Required', has(tl, 'Required', /Clear Suspense Balance \$120\.00 at 31 Aug 2026/), tl);
    const recOpen = L.listInvoices({ where: 'Type=="ACCREC"', statuses: 'AUTHORISED' }).Invoices.filter((d) => d.DateString.slice(0, 10) <= '2026-08-31' && d.DueDateString.slice(0, 10) < L.addDays('2026-08-31', -90));
    ok('me: invoices more than 90 days overdue → Required (grouped)', recOpen.length ? has(tl, 'Required', new RegExp('Invoices more than 90 days overdue ' + recOpen.length + ' invoice\\(s\\)')) : !tl.some((t) => /90 days/.test(t)), [recOpen.length, tl]);
    const bills = L.listInvoices({ where: 'Type=="ACCPAY"', statuses: 'AUTHORISED' }).Invoices.filter((d) => d.DateString.slice(0, 10) <= '2026-08-31'), odB = bills.filter((d) => d.DueDateString.slice(0, 10) < '2026-08-31');
    ok('me: bills overdue at the period end → Required (grouped)', odB.length && has(tl, 'Required', new RegExp('Bills overdue at the period end ' + odB.length + ' bill\\(s\\)')), [odB.length, tl]);
    const byS = {}; bills.forEach((d) => { byS[d.Contact.Name] = (byS[d.Contact.Name] || 0) + d.AmountDue; }); const tot = Object.values(byS).reduce((a, b) => a + b, 0), big = Object.keys(byS).filter((k) => byS[k] / tot > 0.25);
    ok('me: supplier over 25% of outstanding bills → Review', big.every((k) => has(tl, 'Review', new RegExp('Supplier concentration: ' + k))) && tl.filter((t) => /Supplier concentration/.test(t)).length === big.length, [big, tl.filter((t) => /Supplier/.test(t))]);
    ok('me: GST balance → Review; depreciation → Information-required (2 registered assets); lock dates → Optional', has(tl, 'Review', /GST balance at the period end/) && has(tl, 'Information-required', /Confirm August 2026 depreciation is posted 2 registered asset\(s\)/) && has(tl, 'Optional', /Lock the period in Xero/), tl);
    ok('me: Required tasks do not turn the banner red — checks pass (bank tie, figures cited, lists loaded), green', green(m) && /✓ Bank closing balances = Total Bank on the Balance Sheet at 2026-08-31/.test(banner(m)) && /✓ Every Required and Review task cites its figure and threshold/.test(banner(m)) && m.errs.length === 0, banner(m));
    ok('me: payroll and assets get the selected organisation (xero_tenant_id)', ['pay_runs', 'timesheets', 'assets'].every((id) => m.calls.some((x) => x.id === id && 'xero_tenant_id' in x.params)) && m.calls.some((x) => x.id === 'assets' && x.params.status === 'Registered'));
    ok('me: sources line names all three connectors', /xero-accounting, xero-payroll-au and xero-assets connectors/.test(text(m.doc, '#xk-sources')));
    const fbtn = m.doc.querySelector('button[data-f="Required"]'); fbtn.click(); await m.settle();
    ok('me: category filter shows only Required tasks (display only)', tasks().length > 0 && tasks().every((t) => t.startsWith('Required')), tasks());
    // an organisation without AU payroll (Xero returns its error) → N/A + Information-required, never red
    const m2 = await run('me', man('me'), ME({ pay_runs: (q) => L.listPayRuns(Object.assign({}, q, { xero_tenant_id: L.T2 })), timesheets: (q) => L.listTimesheets(Object.assign({}, q, { xero_tenant_id: L.T2 })) }));
    ok('me: no AU payroll → Information-required task and an N/A line, banner still green', green(m2) && /– Data loaded: list_pay_runs \(xero-payroll-au\)/.test(banner(m2)) && [...m2.doc.querySelectorAll('#xk-body .xk-card .xk-kpi')].some((k) => /^Information-required Pay runs — confirm directly in Xero/.test(taskText(k))), banner(m2).slice(0, 600));
    ok('me: no AU payroll → the task says "not available for this organisation"', /Rule: Xero Payroll \(Australia\) is not available for this organisation/.test(body(m2)), body(m2).slice(0, 400));
    const m3 = await run('me', man('me'), ME(), { fail: { pay_runs: { code: 'needs_connection', message: 'Connect xero-payroll-au to see this data' }, timesheets: { code: 'needs_connection', message: 'Connect xero-payroll-au to see this data' } } });
    ok('me: payroll not connected → names the Xero Payroll (Australia) extension, no top "Connect Xero" banner', /Xero Payroll \(Australia\) is not connected — add the Xero Payroll \(Australia\) extension and connect it \(Settings → Connections\)/.test(body(m3) + banner(m3)) && !m3.doc.querySelector('#xk-body > .xk-banner.fail') && green(m3), [body(m3).slice(0, 300), banner(m3).slice(0, 300)]);
    ok('me: payroll not connected → the task says "not connected in this workspace" (not "not available for this organisation")', /Rule: Xero Payroll \(Australia\) is not connected in this workspace/.test(body(m3)) && !/Payroll \(Australia\) is not available/.test(body(m3)), body(m3).slice(0, 400));
    ok('me: an optional source that is not connected is never red in Sources & limitations', !m3.doc.querySelector('#xk-sources .xk-err') && /list_pay_runs \(xero-payroll-au\) — Xero Payroll \(Australia\) is not connected/.test(text(m3.doc, '#xk-sources')) && /is not connected/.test(text(m3.doc, '#xk-sources .muted')), m3.doc.querySelector('#xk-sources').innerHTML.slice(0, 600));
    const m4 = await run('me', man('me'), ME(), { fail: { bank: { code: 'needs_connection', message: 'Connect xero-accounting to see this data' } } });
    ok('me: Xero accounting not connected → "Connect Xero" shown and the banner red', /Connect Xero \(Settings → Connections\)/.test(body(m4)) && red(m4) && /✗ Data loaded: get_bank_summary/.test(banner(m4)), body(m4).slice(0, 200));
    ok('me: a failed main Xero source stays red in Sources & limitations', !!m4.doc.querySelector('#xk-sources .xk-err'), m4.doc.querySelector('#xk-sources').innerHTML.slice(0, 400));
    const m5 = await run('me', man('me'), ME({ pay_runs: busy(L.listPayRuns, 1), assets: busy(L.listAssets, 1) }), { htmlPatch: (h) => h.replace("XK.app({\n  title: 'Month-End Task List',", "XK.app({\n  retryMs: 1, title: 'Month-end task list',") }); await wait(80);
    ok('me: HTTP 429 on payroll / assets → retried, tasks filled', m5.calls.some((x) => x.requery && x.id === 'pay_runs') && [...m5.doc.querySelectorAll('#xk-body .xk-kpi')].some((k) => /Pay run not posted/.test(k.textContent)) && green(m5), banner(m5).slice(0, 300));
    await set(m, 'xk-client', L.T2); await wait(30);
    ok('me: switching organisation refetches payroll and assets for it too (no mixing)', ['pay_runs', 'timesheets', 'assets', 'journals'].every((id) => m.calls.some((x) => x.requery && x.id === id && x.params.xero_tenant_id === L.T2)), m.calls.filter((x) => x.requery).map((x) => x.id + ':' + x.params.xero_tenant_id));
  }
  console.log(fails ? `\n${fails}/${total} checks FAILED` : `\nALL ${total} checks passed`);
  process.exit(fails ? 1 : 0);
})();
