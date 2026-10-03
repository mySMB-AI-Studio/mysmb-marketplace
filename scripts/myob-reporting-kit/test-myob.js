// Targeted tests for the MYOB kit reports (jsdom + mock SDK). Fixtures mirror the live mySMB.com file.
const { run } = require('./harness.js'); const F = require('./fixtures.js'); const fs = require('fs'), path = require('path');
const man = (n) => JSON.parse(fs.readFileSync(path.join(process.env.KIT_DIR || __dirname, 'reports', n + '.manifest.json'), 'utf8'));
const text = (doc, sel) => (doc.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' ');
let total = 0, fails = 0;
const ok = (name, cond, info) => { total++; if (cond) console.log('  ✓ ' + name); else { fails++; console.log('  FAIL ' + name + (info !== undefined ? ' ' + (typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 600) : '')); } };
const set = async (t, id, val) => { const el = t.doc.getElementById(id); el.value = val; el.dispatchEvent(new t.w.Event('change')); await t.settle(); };
const PL = () => ({ pnl: F.pnl, pnl_compare: F.pnl, bs_end: F.bs, accounts: F.accounts, company_files: F.companyFiles });

(async () => {
  // ---- P&L
  const p = await run('pnl', man('pnl'), PL());
  const pb = text(p.doc, '#mk-body'), pn = text(p.doc, '#mk-banner');
  ok('pnl: figures match the live file', /Total Income\s*\$4,317\.25/.test(pb) && /Total Expenses\s*\$2,134\.49/.test(pb) && /Net Profit\s*\$2,182\.76/.test(pb), pb.slice(0, 300));
  ok('pnl: MYOB order and wording', ['Income', 'Total Income', 'Gross Profit', 'Expenses', 'Total Expenses', 'Operating Profit', 'Net Profit'].every((s) => pb.includes(s)) && !pb.includes('Total for'), pb.slice(0, 600));
  ok('pnl: zero rows hidden by default (Professional Fees 0.00)', !pb.includes('Professional Fees'), pb.slice(0, 600));
  ok('pnl: empty sections hidden (no Cost of Sales / Other Income)', !/Cost of Sales\s*Total Cost of Sales/.test(pb) && !pb.includes('Total Other Income'), pb.slice(0, 600));
  ok('pnl: Net Profit = Current Year Earnings (independent tie) passes', /✓ Net Profit = Current Year Earnings on the Balance Sheet at 2026-09-28 — \$2,182\.76 vs \$2,182\.76/.test(pn), pn.slice(0, 700));
  ok('pnl: all checks pass, banner green', p.doc.querySelector('#mk-banner').className.includes('pass') && /4\/4 checks passed/.test(pn) && p.errs.length === 0, pn.slice(0, 300));
  ok('pnl: company name from list_company_files', text(p.doc, '#mk-head').includes('mySMB.com') && text(p.doc, '#mk-head').includes('Prepared from MYOB Business'), text(p.doc, '#mk-head'));
  ok('pnl: date inputs are filled (not blank)', p.doc.getElementById('mk-from').value === '2026-07-01' && p.doc.getElementById('mk-to').value === '2026-09-28', [p.doc.getElementById('mk-from').value, p.doc.getElementById('mk-to').value]);
  ok('pnl: financial year labelled as assumed', /Financial year starts July \(assumed/.test(pn), pn.slice(0, 400));
  ok('pnl: every binding passes the company file', p.calls.filter((x) => x.id !== 'company_files').every((x) => 'myob_company_file_id' in x.params), p.calls.map((x) => x.id + ':' + Object.keys(x.params)));
  ok('pnl: uses the cross-FY-safe P&L tool', p.calls.filter((x) => x.id === 'pnl').every((x) => x.tool === 'get_profit_and_loss_3m'));
  // MYOB errors arrive as data
  const pe = await run('pnl', man('pnl'), Object.assign(PL(), { pnl: F.err('MYOB session expired') }));
  ok('pnl: {__error} is an error, never $0 with a tick', /MYOB session expired/.test(text(pe.doc, '#mk-body')) && pe.doc.querySelector('#mk-banner').className.includes('fail') && !/Net Profit\s*\$0/.test(text(pe.doc, '#mk-body')), text(pe.doc, '#mk-banner').slice(0, 300));
  const pbe = await run('pnl', man('pnl'), Object.assign(PL(), { bs_end: F.err('boom') }));
  ok('pnl: failed Balance Sheet → tie N/A and banner red (never Pass)', !/✓ Net Profit = Current Year Earnings/.test(text(pbe.doc, '#mk-banner')) && pbe.doc.querySelector('#mk-banner').className.includes('fail'), text(pbe.doc, '#mk-banner').slice(0, 400));
  // wrong Current Year Earnings → Fail
  const badBs = (q) => { const r = F.bs(q); r.AccountsBreakdown.forEach((x) => { if (x.Account.DisplayID === '3-9000') x.AccountTotal = 2000; }); return r; };
  const pf = await run('pnl', man('pnl'), Object.assign(PL(), { bs_end: badBs }));
  ok('pnl: Net Profit ≠ Current Year Earnings → Fail', /✗ Net Profit = Current Year Earnings/.test(text(pf.doc, '#mk-banner')), text(pf.doc, '#mk-banner').slice(0, 400));
  // chart of accounts unavailable → classified by number, noted
  const pa = await run('pnl', man('pnl'), Object.assign(PL(), { accounts: F.err('no accounts') }));
  ok('pnl: no chart of accounts → still classified by account number', /Net Profit\s*\$2,182\.76/.test(text(pa.doc, '#mk-body')) && /classified by account number/.test(text(pa.doc, '#mk-sources')), text(pa.doc, '#mk-sources').slice(0, 400));
  // non-FY range → tie is information
  await set(p, 'mk-from', '2026-08-01');
  ok('pnl: custom range → Balance Sheet tie becomes information', /Net Profit vs Balance Sheet Current Year Earnings \(information\)/.test(text(p.doc, '#mk-banner')), text(p.doc, '#mk-banner').slice(0, 400));
  // compare
  const pc = await run('pnl', man('pnl'), PL());
  await set(pc, 'mk-cmp', 'prev_year');
  ok('pnl: compare to previous year adds comparison columns', /Previous year/.test(text(pc.doc, '#mk-body')) && /% Change/.test(text(pc.doc, '#mk-body')), text(pc.doc, '#mk-body').slice(0, 300));
  // company file picker when several files
  const pm = await run('pnl', man('pnl'), Object.assign(PL(), { company_files: F.companyFilesMulti }));
  const opts = [...pm.doc.querySelectorAll('#mk-client option')].map((o) => o.textContent);
  ok('pnl: several company files → a real picker', opts.includes('mySMB.com') && opts.includes('Demo Pty Ltd'), opts);
  await set(pm, 'mk-client', 'cf-demo');
  ok('pnl: choosing a file re-queries with myob_company_file_id', pm.calls.some((x) => x.requery && x.params.myob_company_file_id === 'cf-demo'), pm.calls.filter((x) => x.requery).map((x) => x.id + ':' + x.params.myob_company_file_id));

  // ---- Balance Sheet
  const BS = () => ({ bs: F.bs, bs_compare: F.bs, pnl_ytd: F.pnl, pnl_since_prev: F.pnl, accounts: F.accounts, company_files: F.companyFiles });
  const s = await run('bs', man('bs'), BS());
  const sb = text(s.doc, '#mk-body'), sn = text(s.doc, '#mk-banner');
  ok('bs: totals match the live file', /Total Assets\s*\$3,896\.01/.test(sb) && /Total Liabilities\s*\$1,713\.25/.test(sb) && /Total Equity\s*\$2,182\.76/.test(sb) && /Net Assets\s*\$2,182\.76/.test(sb), sb.slice(0, 400));
  ok('bs: header account (1-0000 Assets 3,896.01) not counted twice', !/Total Assets\s*\$7,792/.test(sb) && /1 header account\(s\) returned by MYOB were left out/.test(text(s.doc, '#mk-sources')), text(s.doc, '#mk-sources').slice(0, 500));
  ok('bs: overdrawn bank shown negative and noted', /Business Bank Account #1\s*\(\$432\.95\)/.test(sb) && /Overdrawn bank account\(s\): Business Bank Account #1/.test(text(s.doc, '#mk-sources')), sb.slice(0, 500));
  ok('bs: A = L + E and Current Year Earnings = P&L YTD (independent) pass', /✓ Total Assets = Total Liabilities \+ Total Equity/.test(sn) && /✓ Current Year Earnings = P&L Net Profit 2026-07-01 to 2026-09-28 — \$2,182\.76 vs \$2,182\.76/.test(sn) && s.doc.querySelector('#mk-banner').className.includes('pass'), sn.slice(0, 700));
  ok('bs: fy_start derived and passed to the P&L', s.calls.some((x) => x.id === 'pnl_ytd' && x.params.from_date === '2026-07-01'), s.calls.filter((x) => x.id === 'pnl_ytd').map((x) => x.params));
  ok('bs: as-at date box filled', s.doc.getElementById('mk-asat').value === '2026-09-28', s.doc.getElementById('mk-asat').value);
  // an as-at date in the previous FY derives that FY's start on first open
  const oldAsAt = await run('bs', man('bs'), BS(), { htmlPatch: (h) => h.replace("as_at: '2026-09-28'", "as_at: '2026-05-31'").replace(`"a":"today","c":"none","v":"bs"}' },`, `"a":"custom","c":"none","v":"bs"}' },`) });
  ok('bs: custom as-at in last FY → P&L from 2025-07-01 (derived on open)', oldAsAt.calls.some((x) => x.id === 'pnl_ytd' && x.requery && x.params.from_date === '2025-07-01'), oldAsAt.calls.filter((x) => x.id === 'pnl_ytd').map((x) => x.params.from_date + (x.requery ? ' (requery)' : '')));
  const badPl = (q) => { const r = F.pnl(q); r.AccountsBreakdown.forEach((x) => { if (x.Account.DisplayID === '4-1400') x.AccountTotal = 4000; }); return r; };
  const sf = await run('bs', man('bs'), Object.assign(BS(), { pnl_ytd: badPl }));
  ok('bs: Current Year Earnings ≠ P&L → Fail', /✗ Current Year Earnings = P&L Net Profit/.test(text(sf.doc, '#mk-banner')), text(sf.doc, '#mk-banner').slice(0, 400));
  const se = await run('bs', man('bs'), Object.assign(BS(), { bs: F.err('OAuth token not valid') }));
  ok('bs: {__error} shown as an error, red banner', /OAuth token not valid/.test(text(se.doc, '#mk-body')) && se.doc.querySelector('#mk-banner').className.includes('fail'), text(se.doc, '#mk-banner').slice(0, 300));
  await set(s, 'mk-view', 'summary');
  ok('bs: summary view shows totals only', !text(s.doc, '#mk-body').includes('Trade Debtors') && /Total Assets/.test(text(s.doc, '#mk-body')), text(s.doc, '#mk-body').slice(0, 300));
  const sc = await run('bs', man('bs'), BS());
  await set(sc, 'mk-cmp', 'prev_year');
  ok('bs: compare previous year uses 2025-09-28 and shows the column', sc.calls.some((x) => x.id === 'bs_compare' && x.params.date === '2025-09-28') && /Previous year/.test(text(sc.doc, '#mk-body')), sc.calls.filter((x) => x.id === 'bs_compare').map((x) => x.params.date));

  // ---- Irvine Jackson case: last FY's profit not closed into Retained Earnings → A − (L + E) = that profit
  const PRIOR = 68986.50, withPrior = (q) => { const r = F.pnl(q); if (q.from_date <= '2025-07-01') r.AccountsBreakdown = r.AccountsBreakdown.map((x) => x.Account.DisplayID === '4-1400' ? Object.assign({}, x, { AccountTotal: Math.round((x.AccountTotal + PRIOR) * 100) / 100 }) : x); return r; };
  const bsGap = (q) => { const r = F.bs(q); r.AccountsBreakdown.forEach((x) => { if (x.Account.DisplayID === '1-1200') x.AccountTotal = Math.round((x.AccountTotal + PRIOR) * 100) / 100; }); return r; };
  const BSG = () => Object.assign(BS(), { bs: bsGap, bs_compare: bsGap, pnl_since_prev: withPrior });
  const sg = await run('bs', man('bs'), BSG());
  const sgb = text(sg.doc, '#mk-body'), sgn = text(sg.doc, '#mk-banner');
  ok('bs gap: last FY profit explains the gap → computed equity line, A = L + E passes', /Prior year earnings not yet closed to Retained Earnings\s*\$68,986\.50/.test(sgb) && /✓ Total Assets = Total Liabilities \+ Total Equity/.test(sgn) && /Total Equity\s*\$2,251,74|Total Equity\s*\$71,169\.26/.test(sgb), sgn.slice(0, 500) + ' | ' + sgb.slice(0, 200));
  ok('bs gap: information line tells the user to roll over the financial year', /ℹ Last financial year's profit not yet closed to Retained Earnings \(information\) — \$68,986\.50/.test(sgn) && /roll over the financial year/.test(sgn), sgn.slice(0, 700));
  ok('bs gap: P&L from last FY start is requested', sg.calls.some((x) => x.id === 'pnl_since_prev' && x.params.from_date === '2025-07-01'), sg.calls.filter((x) => x.id === 'pnl_since_prev').map((x) => x.params));
  const sg2 = await run('bs', man('bs'), Object.assign(BSG(), { pnl_since_prev: F.pnl }));
  ok('bs gap: unexplained gap still fails and shows last FY profit for diagnosis', /✗ Total Assets = Total Liabilities \+ Total Equity — .* difference \$68,986\.50; last financial year's net profit is \$0\.00/.test(text(sg2.doc, '#mk-banner')) && !/Prior year earnings/.test(text(sg2.doc, '#mk-body')), text(sg2.doc, '#mk-banner').slice(0, 500));
  // ---- sign notes: expenses that are a net credit
  const negExp = (q) => { const r = F.pnl(q); r.AccountsBreakdown.forEach((x) => { if (x.Account.DisplayID === '6-1430') x.AccountTotal = -3000; }); return r; };
  const pn2 = await run('pnl', man('pnl'), Object.assign(PL(), { pnl: negExp }));
  ok('pnl: negative Total Expenses is shown as returned and noted', /Total Expenses\s*\(\$1,965\.51\)/.test(text(pn2.doc, '#mk-body')) && /Total Expenses is negative \(a net credit\) — review the expense postings/.test(text(pn2.doc, '#mk-sources')), text(pn2.doc, '#mk-sources').slice(0, 400));

  // ---- Branding: MYOB (default) | mySMB — display only
  const g = await run('pnl', man('pnl'), PL());
  const root = g.doc.documentElement;
  ok('branding: MYOB is the default (badge, source line, no mySMB class)', !root.classList.contains('style-mysmb') && /MYOB\s*Prepared from MYOB Business/.test(text(g.doc, '#mk-head')) && g.doc.getElementById('mk-branding').value === 'myob', text(g.doc, '#mk-head'));
  ok('branding: the switch is inside Customise (not the main row)', !!g.doc.querySelector('#mk-controls details.customise #mk-branding') && !g.doc.querySelector('#mk-controls > label.ctl #mk-branding') && !g.doc.getElementById('mk-style'));
  const before = g.calls.length;
  await set(g, 'mk-branding', 'mysmb');
  ok('branding: mySMB applies the template (class, badge, source line)', root.classList.contains('style-mysmb') && /mySMB\s*mySMB Reporting · data from MYOB Business/.test(text(g.doc, '#mk-head')), text(g.doc, '#mk-head'));
  ok('branding: switching does not refetch data', g.calls.length === before, g.calls.slice(before).map((x) => x.id));
  ok('branding: mySMB footer = Business | Report | Generated', /^mySMB\.com \| Profit and Loss \| Accrual basis \| /.test(g.doc.getElementById('mk-foot').textContent), g.doc.getElementById('mk-foot').textContent);
  ok('branding: choice kept in the display input (downloads keep it)', JSON.parse(g.setInputsLog[g.setInputsLog.length - 1].display).style === 'mysmb', g.setInputsLog.slice(-1));
  await set(g, 'mk-branding', 'myob');
  ok('branding: back to MYOB', !root.classList.contains('style-mysmb') && /Prepared from MYOB Business/.test(text(g.doc, '#mk-head')) && g.doc.getElementById('mk-foot').textContent.indexOf('|') === g.doc.getElementById('mk-foot').textContent.indexOf('basis') + 6, g.doc.getElementById('mk-foot').textContent);

  console.log(fails ? `\n${fails}/${total} checks FAILED` : `\nALL ${total} checks passed`);
  process.exit(fails ? 1 : 0);
})();
