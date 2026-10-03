var MK = (function () {
  'use strict';
  // ---------- numbers & labels ----------
  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = Number(String(v).replace(/,/g, ''));
    return isFinite(n) ? n : null;
  }
  function cd(node) { return ((node && node.ColData) || []).map(function (c) { return c && c.value != null ? c.value : ''; }); }
  function totalFor(label) { return /^Total\s+(?!for\s)/i.test(label) ? label.replace(/^Total\s+/i, 'Total for ') : label; }
  function near(a, b, tol) { return a != null && b != null && Math.abs(a - b) <= (tol == null ? 0.01 : tol); }
  function sum(arr) { var s = 0; arr.forEach(function (v) { if (v != null) s += v; }); return Math.round(s * 100) / 100; }

  // ---------- MYOB responses ----------
  // Tool results are MYOB's JSON as returned by the myob-accounting connector. A failed call is NOT an error on the binding:
  // the connector catches it and returns { "__error": "<message>" } as normal data, so every source is unwrapped first.
  function errorOf(v) { return v && typeof v === 'object' && !Array.isArray(v) && v.__error != null ? String(v.__error) : null; }
  // List endpoints: { Items, NextPageLink, Count } or a bare array.
  function items(v) { return !v || errorOf(v) ? [] : Array.isArray(v) ? v : Array.isArray(v.Items) ? v.Items : []; }
  // MYOB dates: ISO 'YYYY-MM-DDThh:mm:ss' (documented) or '/Date(ms)/' (seen in older files) → 'YYYY-MM-DD'.
  // A card (customer / supplier) ID: MYOB returns "*None" for a card without one — shown blank, as on MYOB's reports.
  function cardId(v) { return v && v !== '*None' ? String(v) : ''; }
  function isoDate(v) {
    if (v == null || v === '') return null;
    var m = /\/Date\((-?\d+)/.exec(String(v)); if (m) { var d = new Date(+m[1]); return iso(D(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())); }
    return String(v).slice(0, 10);
  }
  // Chart of accounts (list_accounts). Classification: Asset, Liability, Equity, Income, CostOfSales, Expense, OtherIncome, OtherExpense.
  // Type (detail): Bank, AccountReceivable, OtherCurrentAsset, FixedAsset, OtherAsset, CreditCard, AccountsPayable, OtherCurrentLiability,
  // LongTermLiability, OtherLiability, Equity, Income, CostOfSales, Expense, OtherIncome, OtherExpense.
  var CLASS_BY_DIGIT = { 1: 'Asset', 2: 'Liability', 3: 'Equity', 4: 'Income', 5: 'CostOfSales', 6: 'Expense', 8: 'OtherIncome', 9: 'OtherExpense' };
  var PL_CLASSES = ['Income', 'CostOfSales', 'Expense', 'OtherIncome', 'OtherExpense'], BS_CLASSES = ['Asset', 'Liability', 'Equity'];
  function accounts(v) {
    var list = items(v), byUid = {}, byCode = {};
    list.forEach(function (a) { if (!a) return; if (a.UID) byUid[a.UID] = a; if (a.DisplayID) byCode[a.DisplayID] = a; });
    return { list: list, byUid: byUid, byCode: byCode, loaded: list.length > 0 };
  }
  // Classification of a report row: the chart of accounts (by UID, then DisplayID); else the DisplayID's first digit.
  function classOf(acc, idx) {
    var a = idx && ((acc.UID && idx.byUid[acc.UID]) || (acc.DisplayID && idx.byCode[acc.DisplayID]));
    if (a && a.Classification) return { cls: a.Classification, from: 'accounts', header: !!a.IsHeader, type: a.Type || null };
    var m = /^(\d)-/.exec(acc.DisplayID || '');
    return { cls: m ? CLASS_BY_DIGIT[m[1]] || null : null, from: m ? 'code' : null, header: false, type: null };
  }
  // Report summaries (ProfitAndLossSummary, BalanceSheetSummary) carry AccountsBreakdown[{Account{UID,Name,DisplayID}, AccountTotal}]
  // and no totals. breakdown() lays one or more reports (one per value column) out as statement lines per "layout":
  //   {cls, label} → a section (header, one row per account in DisplayID order, total);  {calc, label, f(totals)} → a computed line.
  // MYOB's signs are kept: income, expense, asset, liability and equity accounts come back positive in their normal balance
  // (confirmed live on an AU file); a contra account is negative. Header accounts, if MYOB includes them, are skipped (their
  // totals would double count). Rows whose classification is missing or outside the layout go in "unclassified".
  function breakdown(reps, idx, layout) {
    var n = reps.length, rows = {}, order = [], zero = function () { var z = []; for (var i = 0; i < n; i++) z.push(0); return z; };
    reps.forEach(function (rep, c) {
      ((rep && !errorOf(rep) && rep.AccountsBreakdown) || []).forEach(function (r) {
        var a = r.Account || {}, k = a.UID || a.DisplayID || a.Name;
        if (!rows[k]) { var ci = classOf(a, idx); rows[k] = { uid: a.UID || null, code: a.DisplayID || '', name: a.Name || a.DisplayID || '', cls: ci.cls, from: ci.from, header: ci.header, type: ci.type, values: zero() }; order.push(k); }
        rows[k].values[c] = Math.round(((rows[k].values[c] || 0) + (num(r.AccountTotal) || 0)) * 100) / 100;
      });
    });
    var all = order.map(function (k) { return rows[k]; }).sort(function (a, b) { return String(a.code).localeCompare(String(b.code), undefined, { numeric: true }) || a.name.localeCompare(b.name); });
    var inLayout = {}; layout.forEach(function (s) { if (s.cls) inLayout[s.cls] = 1; });
    var tot = {}, lines = [], calc = {};
    layout.forEach(function (s) { if (s.cls) tot[s.cls] = zero(); });
    var used = all.filter(function (r) { return !r.header && inLayout[r.cls]; });
    used.forEach(function (r) { r.values.forEach(function (v, i) { tot[r.cls][i] = Math.round((tot[r.cls][i] + v) * 100) / 100; }); });
    layout.forEach(function (s) {
      if (s.cls) {
        var mem = used.filter(function (r) { return r.cls === s.cls; });
        if (s.hideEmpty && !mem.some(function (r) { return r.values.some(function (v) { return Math.abs(v) >= 0.005; }); })) return; // no accounts, or all zero
        lines.push({ kind: 'header', depth: 0, label: s.label, group: s.cls, path: [], values: [] });
        mem.forEach(function (r) { lines.push({ kind: 'row', depth: 1, label: r.name, code: r.code, id: r.uid, group: s.cls, type: r.type, path: [s.label], values: r.values.slice() }); });
        lines.push({ kind: 'total', depth: 0, label: 'Total ' + s.label, fixed: true, group: s.cls, path: [], values: tot[s.cls].slice() });
      } else if (s.calc) {
        var v = []; for (var i = 0; i < n; i++) { var t = {}; Object.keys(tot).forEach(function (k) { t[k] = tot[k][i]; }); v.push(Math.round(s.f(t) * 100) / 100); }
        calc[s.calc] = v; lines.push({ kind: 'total', depth: 0, label: s.label, fixed: true, calc: true, group: s.calc, path: [], values: v });
      }
    });
    var unclassified = all.filter(function (r) { return !r.header && !inLayout[r.cls]; });
    if (unclassified.length) {
      lines.push({ kind: 'header', depth: 0, label: 'Unclassified', group: 'Unclassified', path: [], values: [] });
      unclassified.forEach(function (r) { lines.push({ kind: 'row', depth: 1, label: r.name + (r.cls ? ' (' + r.cls + ')' : ''), code: r.code, id: r.uid, group: 'Unclassified', path: ['Unclassified'], values: r.values.slice() }); });
    }
    return { lines: lines, totals: tot, calc: calc, rows: all, unclassified: unclassified, headersSkipped: all.filter(function (r) { return r.header; }), byCode: all.filter(function (r) { return r.from === 'code'; }).length,
      rawTotal: zero().map(function (_, i) { return Math.round(all.filter(function (r) { return !r.header; }).reduce(function (a, r) { return a + r.values[i]; }, 0) * 100) / 100; }) };
  }
  // Profit and loss in MYOB's order and wording.
  var PL_LAYOUT = [
    { cls: 'Income', label: 'Income' },
    { cls: 'CostOfSales', label: 'Cost of Sales', hideEmpty: true },
    { calc: 'GrossProfit', label: 'Gross Profit', f: function (t) { return t.Income - t.CostOfSales; } },
    { cls: 'Expense', label: 'Expenses' },
    { calc: 'OperatingProfit', label: 'Operating Profit', f: function (t) { return t.Income - t.CostOfSales - t.Expense; } },
    { cls: 'OtherIncome', label: 'Other Income', hideEmpty: true },
    { cls: 'OtherExpense', label: 'Other Expenses', hideEmpty: true },
    { calc: 'NetProfit', label: 'Net Profit', f: function (t) { return t.Income - t.CostOfSales - t.Expense + t.OtherIncome - t.OtherExpense; } }];
  var BS_LAYOUT = [
    { cls: 'Asset', label: 'Assets' },
    { cls: 'Liability', label: 'Liabilities' },
    { calc: 'NetAssets', label: 'Net Assets', f: function (t) { return t.Asset - t.Liability; } },
    { cls: 'Equity', label: 'Equity' }];
  // Current-year earnings: MYOB keeps it as an Equity account (commonly 'Current Year Earnings', 3-9000) whose balance is this
  // financial year's net profit to the as-at date.
  var CYE_RE = /^current year('s)? earnings$|^current earnings$/i;
  function currentYearEarnings(bsLines) { var r = bsLines.filter(function (l) { return l.kind === 'row' && l.group === 'Equity' && CYE_RE.test(l.label); })[0]; return r || null; }
  // Find a statement line by group (section/calc key) first, else by label regex; kind 'total' | 'row' | 'header' (default: total, then row).
  function find(lines, group, labelRe, kind) {
    var kinds = kind ? [kind] : ['total', 'row'], i, j;
    for (j = 0; j < kinds.length; j++) {
      if (group) for (i = 0; i < lines.length; i++) if (lines[i].group === group && lines[i].kind === kinds[j]) return lines[i];
      if (labelRe) for (i = 0; i < lines.length; i++) if (lines[i].kind === kinds[j] && labelRe.test(lines[i].label)) return lines[i];
    }
    return null;
  }
  function val(line, col) { return line ? line.values[col == null ? line.values.length - 1 : col] : null; }
  // Sections whose total came back with the opposite of their normal sign (e.g. expenses that are a net credit). MYOB's
  // figures are shown as returned — this only explains them. Returns note strings.
  var SECTION_LABEL = { Asset: 'Total Assets', Liability: 'Total Liabilities', Equity: 'Total Equity', Income: 'Total Income', CostOfSales: 'Total Cost of Sales', Expense: 'Total Expenses', OtherIncome: 'Total Other Income', OtherExpense: 'Total Other Expenses' };
  function signNotes(totals, col) {
    var out = [], i = col || 0, credit = { Income: 1, OtherIncome: 1 }, what = function (k) { return /Income/.test(k) ? 'income' : /Expense|CostOfSales/.test(k) ? 'expense' : 'account'; };
    Object.keys(totals).forEach(function (k) { var v = totals[k][i]; if (v < -0.005) out.push(SECTION_LABEL[k] + ' is negative (' + (credit[k] || k === 'Asset' ? 'a net debit' : k === 'Liability' || k === 'Equity' ? 'a net debit' : 'a net credit') + ') — review the ' + what(k) + ' postings.'); });
    return out;
  }
  // Cash: each balance-sheet account's change between two Balance Sheets (bs2 = breakdown of [the day before the period, its end])
  // as its effect on cash, with the P&L for the period (pl = its breakdown): an asset going up uses cash; a liability or equity going up
  // provides it. Bank accounts (type Bank) are the cash. Current Year Earnings is the P&L itself, so it is not counted again; when the
  // period spans a financial-year start, Retained Earnings moves by last year's profit closing — not cash either (rollAdj ≈ 0 checks it).
  function cashMoves(bs2, pl, from, to, fyMonth) {
    var r2 = function (v) { return Math.round(v * 100) / 100; }, np = pl.calc.NetProfit[0], fyCross = iso(fyStartOf(parse(to), fyMonth || 7)) >= from;
    var CYE = function (r) { return CYE_RE.test(r.name); }, RE = function (r) { return /retained (earnings|profits)/i.test(r.name); };
    var rows = bs2.rows.filter(function (r) { return !r.header && /^(Asset|Liability|Equity)$/.test(r.cls); }).map(function (r) { var d = r2((r.values[1] || 0) - (r.values[0] || 0));
      return { code: r.code, name: r.name, cls: r.cls, type: r.type, open: r.values[0] || 0, close: r.values[1] || 0, effect: r.cls === 'Asset' ? -d : d, bank: r.type === 'Bank', skip: CYE(r) || (fyCross && RE(r)) }; });
    var moves = rows.filter(function (r) { return !r.bank && !r.skip; }), bank = rows.filter(function (r) { return r.bank; }), rolled = rows.filter(function (r) { return fyCross && r.skip; });
    var open = sum(bank.map(function (r) { return r.open; })), close = sum(bank.map(function (r) { return r.close; }));
    return { np: np, moves: moves, bank: bank, open: open, close: close, net: r2(np + sum(moves.map(function (r) { return r.effect; }))), fyCross: fyCross, rollAdj: fyCross ? r2(-(sum(rolled.map(function (r) { return r.close - r.open; })) - np)) : 0 };
  }
  // Totals re-added from the rows (independent of breakdown's own sums): every section total = Σ its rows.
  function linesTies(lines, tol) {
    var res = { checked: 0, failed: [] };
    lines.forEach(function (t) {
      if (t.kind !== 'total' || t.calc || t.group === 'Unclassified') return;
      var mem = lines.filter(function (l) { return l.kind === 'row' && l.group === t.group; });
      res.checked++;
      t.values.forEach(function (v, i) { if (!near(v, sum(mem.map(function (l) { return l.values[i]; })), tol)) { if (res.failed.indexOf(t.label) < 0) res.failed.push(t.label); } });
    });
    return res;
  }
  // Company files (list_company_files): [{Id, Name, Country, Uri, …}] from MYOB's /accountright. It can be empty for newer MYOB
  // API keys even though the connection works (the file then came from the sign-in), so the name may be unknown.
  function companyFiles(v) { return items(v).map(function (f) { return { id: String(f.Id || f.id || ''), name: f.Name || f.name || '', country: f.Country || null }; }).filter(function (f) { return f.id || f.name; }); }
  function companyOf(filesResp, chosenId) {
    var list = companyFiles(filesResp); if (!list.length) return { name: null, id: chosenId || null, country: null, files: [] };
    var f = chosenId ? list.filter(function (x) { return x.id === chosenId; })[0] : list.length === 1 ? list[0] : null;
    return f ? { name: f.name, id: f.id, country: f.country, files: list } : { name: null, id: null, country: list[0].country, files: list, ambiguous: true };
  }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  // The MYOB API does not expose the company file's financial year. AU files end 30 June, NZ files 31 March (the defaults);
  // a report may override with cfg.fyMonth. Returns {month:1-12, source}.
  function fiscalStart(country, fyMonth) {
    if (fyMonth) return { month: fyMonth, source: 'report setting' };
    if (/^nz/i.test(country || '')) return { month: 4, source: 'assumed — NZ default; the MYOB API does not expose it' };
    return { month: 7, source: 'assumed — AU default; the MYOB API does not expose it' };
  }
  function homeCurrency(country) { return /^nz/i.test(country || '') ? 'NZD' : 'AUD'; }
  var SYM = { AUD: '$', NZD: '$', USD: 'US$', CAD: 'C$', GBP: '£', EUR: '€', PHP: '₱', SGD: 'S$', HKD: 'HK$', JPY: '¥', INR: '₹' };
  function symbol(code) { return SYM[code] || (code ? code + ' ' : ''); }

  // ---------- display preferences (one declared string input "display") ----------
  // p = period preset key, a = as-at preset key, c = compare mode (none|prev_period|prev_year|ytd), v = report view / member
  // b = brand colour (#rrggbb) — empty means the connector's own branding (QuickBooks green)
  var DISPLAY_DEFAULT = { cents: 1, k: 0, zeros: 1, neg: 'minus', red: 0, hdr: 1, ftr: 1, style: 'myob', dens: '100', p: 'custom', a: 'custom', c: 'none', v: '', x: '', b: '' };
  var HEX = /^#[0-9a-f]{6}$/i;
  // Brand colour → accent palette (darker shade for buttons, lighter for dark theme), applied as CSS custom properties.
  function shade(hex, f) { var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; var t = function (c) { return Math.max(0, Math.min(255, Math.round(f < 0 ? c * (1 + f) : c + (255 - c) * f))); }; return '#' + [t(r), t(g), t(b)].map(function (x) { return x.toString(16).padStart(2, '0'); }).join(''); }
  function applyBrand(root, hex) {
    var props = ['--accent', '--btn', '--c1', '--d1', '--pos'];
    if (!HEX.test(hex || '')) { props.forEach(function (p) { root.style.removeProperty(p); }); return false; }
    var dark = root.getAttribute('data-myhub-theme') === 'dark', a = dark ? shade(hex, 0.25) : hex;
    root.style.setProperty('--accent', a); root.style.setProperty('--btn', dark ? hex : shade(hex, -0.2)); root.style.setProperty('--c1', a); root.style.setProperty('--d1', a); root.style.setProperty('--pos', a);
    return true;
  }
  function readDisplay(str) {
    var d = {}, k, src = {};
    try { src = JSON.parse(str || '{}') || {}; } catch (e) { src = {}; }
    for (k in DISPLAY_DEFAULT) d[k] = src[k] != null ? src[k] : DISPLAY_DEFAULT[k];
    return d;
  }
  function writeDisplay(d) { var o = {}, k; for (k in DISPLAY_DEFAULT) o[k] = d[k]; return JSON.stringify(o); }

  // QuickBooks money: A$1,234.56 / -A$1,234.56. neg: 'minus' (-100) | 'paren' ((100)) | 'trail' (100-)
  function money(v, cur, d) {
    if (v === null || v === undefined || v === '') return '';
    d = d || DISPLAY_DEFAULT;
    var n = Number(v); if (!isFinite(n)) return String(v);
    if (d.k) n = n / 1000;
    var dp = d.cents && !d.k ? 2 : (d.k ? 1 : 0);
    var abs = Math.abs(n).toLocaleString('en-AU', { minimumFractionDigits: dp, maximumFractionDigits: dp });
    var s = symbol(cur) + abs + (d.k ? 'k' : '');
    if (n < 0 && Number(abs.replace(/,/g, '')) !== 0) s = d.neg === 'paren' ? '(' + s + ')' : d.neg === 'trail' ? s + '-' : '-' + s;
    return s;
  }
  function pct(v, dp) { return v == null || !isFinite(v) ? '' : (v * 100).toFixed(dp == null ? 1 : dp) + '%'; }
  function isNeg(v) { return v != null && Number(v) < 0; }

  // ---------- dates (UTC-safe ISO strings) ----------
  function iso(dt) { return dt.getUTCFullYear() + '-' + String(dt.getUTCMonth() + 1).padStart(2, '0') + '-' + String(dt.getUTCDate()).padStart(2, '0'); }
  function D(y, m, d) { return new Date(Date.UTC(y, m - 1, d)); }
  function parse(s) { var p = String(s).split('-'); return D(+p[0], +p[1], +p[2]); }
  function addDays(dt, n) { return new Date(dt.getTime() + n * 86400000); }
  function eom(y, m) { return D(y, m + 1, 0); }
  function today() { var t = new Date(); return D(t.getFullYear(), t.getMonth() + 1, t.getDate()); }
  function fyStartOf(dt, fyMonth) {
    var y = dt.getUTCFullYear(); if (dt.getUTCMonth() + 1 < fyMonth) y -= 1;
    return D(y, fyMonth, 1);
  }
  // Period presets per the library Controls tab. Returns {start,end} ISO or null for 'custom'.
  var PRESETS = [
    ['today', 'Today'], ['this_week', 'This week'], ['this_week_td', 'This week to date'],
    ['this_month', 'This month'], ['this_month_td', 'This month to date'],
    ['this_quarter', 'This quarter'], ['this_quarter_td', 'This quarter to date'],
    ['this_fy', 'This financial year'], ['this_fy_td', 'This financial year to date'],
    ['last_week', 'Last week'], ['last_month', 'Last month'], ['last_quarter', 'Last quarter'], ['last_fy', 'Last financial year'],
    ['last_30', 'Last 30 days'], ['since_60', 'Since 60 days ago'], ['since_90', 'Since 90 days ago'], ['since_365', 'Since 365 days ago'],
    ['custom', 'Custom']
  ];
  function preset(key, fyMonth, now) {
    var t = now ? parse(now) : today(), y = t.getUTCFullYear(), m = t.getUTCMonth() + 1, dow = (t.getUTCDay() + 6) % 7;
    var qs = Math.floor((m - 1) / 3) * 3 + 1, fs = fyStartOf(t, fyMonth || 7), r;
    switch (key) {
      case 'today': r = [t, t]; break;
      case 'this_week': r = [addDays(t, -dow), addDays(t, 6 - dow)]; break;
      case 'this_week_td': r = [addDays(t, -dow), t]; break;
      case 'this_month': r = [D(y, m, 1), eom(y, m)]; break;
      case 'this_month_td': r = [D(y, m, 1), t]; break;
      case 'this_quarter': r = [D(y, qs, 1), eom(y, qs + 2)]; break;
      case 'this_quarter_td': r = [D(y, qs, 1), t]; break;
      case 'this_fy': r = [fs, addDays(D(fs.getUTCFullYear() + 1, fs.getUTCMonth() + 1, 1), -1)]; break;
      case 'this_fy_td': r = [fs, t]; break;
      case 'last_week': r = [addDays(t, -dow - 7), addDays(t, -dow - 1)]; break;
      case 'last_month': r = [D(y, m - 1, 1), eom(y, m - 1)]; break;
      case 'last_quarter': r = [D(y, qs - 3, 1), eom(y, qs - 1)]; break;
      case 'last_fy': r = [D(fs.getUTCFullYear() - 1, fs.getUTCMonth() + 1, 1), addDays(fs, -1)]; break;
      case 'last_30': r = [addDays(t, -29), t]; break;
      case 'since_60': r = [addDays(t, -60), t]; break;
      case 'since_90': r = [addDays(t, -90), t]; break;
      case 'since_365': r = [addDays(t, -365), t]; break;
      case 'last_12m': r = [D(y, m - 12, 1), eom(y, m - 1)]; break;
      case 'last_24m': r = [D(y, m - 24, 1), eom(y, m - 1)]; break;
      default: return null;
    }
    return { start: iso(r[0]), end: iso(r[1]) };
  }
  var ASAT = [['today', 'Today'], ['end_last_month', 'End of last month'], ['end_last_quarter', 'End of last quarter'], ['end_last_fy', 'End of last financial year'], ['custom', 'Custom']];
  function asAt(key, fyMonth, now) {
    var t = now ? parse(now) : today(), y = t.getUTCFullYear(), m = t.getUTCMonth() + 1, qs = Math.floor((m - 1) / 3) * 3 + 1;
    switch (key) {
      case 'today': return iso(t);
      case 'end_last_month': return iso(eom(y, m - 1));
      case 'end_last_quarter': return iso(eom(y, qs - 1));
      case 'end_last_fy': return iso(addDays(fyStartOf(t, fyMonth || 7), -1));
      default: return null;
    }
  }
  // Compare-to: 'prev_period' (same length, immediately before) | 'prev_year' (same dates -1y) | 'ytd' (FY start -> end)
  function compare(start, end, mode, fyMonth) {
    var s = parse(start), e = parse(end), len;
    if (mode === 'prev_year') return { start: iso(D(s.getUTCFullYear() - 1, s.getUTCMonth() + 1, Math.min(s.getUTCDate(), eom(s.getUTCFullYear() - 1, s.getUTCMonth() + 1).getUTCDate()))), end: iso(D(e.getUTCFullYear() - 1, e.getUTCMonth() + 1, Math.min(e.getUTCDate(), eom(e.getUTCFullYear() - 1, e.getUTCMonth() + 1).getUTCDate()))) };
    if (mode === 'ytd') return { start: iso(fyStartOf(e, fyMonth || 7)), end: end };
    // prev_period: if the range is whole calendar months, step back the same number of whole months
    if (s.getUTCDate() === 1 && iso(e) === iso(eom(e.getUTCFullYear(), e.getUTCMonth() + 1))) {
      var months = (e.getUTCFullYear() - s.getUTCFullYear()) * 12 + (e.getUTCMonth() - s.getUTCMonth()) + 1;
      return { start: iso(D(s.getUTCFullYear(), s.getUTCMonth() + 1 - months, 1)), end: iso(addDays(s, -1)) };
    }
    len = Math.round((e - s) / 86400000);
    return { start: iso(addDays(s, -len - 1)), end: iso(addDays(s, -1)) };
  }
  var MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  // QuickBooks period line: 'August 2026' | 'July - September, 2026' | '1 July 2026 - 17 September 2026' | 'As of August 31, 2026'
  function periodLine(start, end) {
    var s = parse(start), e = parse(end), sy = s.getUTCFullYear(), ey = e.getUTCFullYear();
    var wholeStart = s.getUTCDate() === 1, wholeEnd = iso(e) === iso(eom(ey, e.getUTCMonth() + 1));
    if (wholeStart && wholeEnd) {
      if (sy === ey && s.getUTCMonth() === e.getUTCMonth()) return MON[s.getUTCMonth()] + ' ' + sy;
      if (sy === ey) return MON[s.getUTCMonth()] + ' - ' + MON[e.getUTCMonth()] + ', ' + sy;
      return MON[s.getUTCMonth()] + ' ' + sy + ' - ' + MON[e.getUTCMonth()] + ' ' + ey;
    }
    return s.getUTCDate() + ' ' + MON[s.getUTCMonth()] + ' ' + sy + ' - ' + e.getUTCDate() + ' ' + MON[e.getUTCMonth()] + ' ' + ey;
  }
  function asOfLine(d) { var x = parse(d); return 'As at ' + x.getUTCDate() + ' ' + MON[x.getUTCMonth()] + ' ' + x.getUTCFullYear(); } // MYOB AU wording: 'As at 28 September 2026'
  // Footer: 'Accrual basis | Thursday, 10 September, 2026 10:52 AM GMT+08:00'
  function footerStamp(basis, fetchedAt) {
    var t = fetchedAt ? new Date(fetchedAt) : new Date();
    var wd = t.toLocaleDateString('en-AU', { weekday: 'long' });
    var dm = t.getDate() + ' ' + MON[t.getMonth()] + ', ' + t.getFullYear();
    var hm = t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    var off = -t.getTimezoneOffset(), sign = off >= 0 ? '+' : '-', a = Math.abs(off);
    var tz = 'GMT' + sign + String(Math.floor(a / 60)).padStart(2, '0') + ':' + String(a % 60).padStart(2, '0');
    return (basis === 'Cash' ? 'Cash basis' : 'Accrual basis') + ' | ' + wd + ', ' + dm + ' ' + hm + ' ' + tz;
  }
  function freshest(bundle) {
    var f = bundle && bundle.fetchedAt;
    if (f && typeof f === 'object') { var best = null, k; for (k in f) if (f[k] && (!best || f[k] > best)) best = f[k]; return best; }
    return f || null;
  }

  // ---------- Excel (.xlsx) writer: no external library ----------
  var CRC = (function () { var t = [], c, n, k; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function utf8(s) { return new TextEncoder().encode(s); }
  function zip(files) {
    var parts = [], central = [], off = 0;
    function u16(v) { return [v & 255, (v >>> 8) & 255]; }
    function u32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }
    files.forEach(function (f) {
      var name = utf8(f.name), data = utf8(f.data), crc = crc32(data);
      var head = [].concat([0x50, 0x4b, 0x03, 0x04], u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0));
      parts.push(new Uint8Array(head), name, data);
      central.push(new Uint8Array([].concat([0x50, 0x4b, 0x01, 0x02], u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off))), name);
      off += head.length + name.length + data.length;
    });
    var csize = 0; central.forEach(function (p) { csize += p.length; });
    var end = new Uint8Array([].concat([0x50, 0x4b, 0x05, 0x06], u16(0), u16(0), u16(files.length), u16(files.length), u32(csize), u32(off), u16(0)));
    var all = parts.concat(central, [end]), total = 0; all.forEach(function (p) { total += p.length; });
    var out = new Uint8Array(total), pos = 0; all.forEach(function (p) { out.set(p, pos); pos += p.length; });
    return out;
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function colName(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  // sheets: [{name, rows:[[cell]], widths:[chars]}]; cell = string | number | null | {v, s:'bold'|'money'|'moneyBold'|'title'|'pct'|'muted', f:'SUM(B2:B9)', indent:n}
  // cur = currency code for the money format (A$ for AUD).
  function xlsx(sheets, cur) {
    var sym = esc(symbol(cur || 'AUD').trim()).replace(/"/g, '');
    var moneyFmt = '&quot;' + sym + '&quot;#,##0.00;-&quot;' + sym + '&quot;#,##0.00';
    var STY = { none: 0, bold: 1, money: 2, moneyBold: 3, title: 4, pct: 5, muted: 6 };
    var styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<numFmts count="1"><numFmt numFmtId="164" formatCode="' + moneyFmt + '"/></numFmts>' +
      '<fonts count="4"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><name val="Arial"/></font><font><b/><sz val="12"/><name val="Arial"/></font><font><sz val="9"/><color rgb="FF6B6C72"/><name val="Arial"/></font></fonts>' +
      '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
      '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>' +
      '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
      '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
    var files = [], wbSheets = '', wbRels = '', ct = '';
    var used = {};
    sheets.forEach(function (sh, si) {
      var n = si + 1, rowsXml = '';
      var nm = String(sh.name || ('Sheet' + n)).replace(/[\\\/\?\*\[\]:]/g, ' ').slice(0, 31) || ('Sheet' + n);
      while (used[nm.toLowerCase()]) nm = nm.slice(0, 28) + ' ' + n;
      used[nm.toLowerCase()] = 1;
      (sh.rows || []).forEach(function (row, ri) {
        var cells = '';
        (row || []).forEach(function (c, ci) {
          if (c === null || c === undefined || c === '') return;
          var o = typeof c === 'object' ? c : { v: c }, ref = colName(ci) + (ri + 1), s = STY[o.s || (typeof o.v === 'number' ? 'money' : 'none')] || 0;
          if (o.f) cells += '<c r="' + ref + '" s="' + s + '"><f>' + esc(o.f) + '</f>' + (typeof o.v === 'number' ? '<v>' + o.v + '</v>' : '') + '</c>';
          else if (typeof o.v === 'number' && isFinite(o.v)) cells += '<c r="' + ref + '" s="' + s + '"><v>' + o.v + '</v></c>';
          else cells += '<c r="' + ref + '" s="' + s + '" t="inlineStr"><is><t xml:space="preserve">' + esc(new Array((o.indent || 0) + 1).join('   ') + (o.v == null ? '' : o.v)) + '</t></is></c>';
        });
        rowsXml += '<row r="' + (ri + 1) + '">' + cells + '</row>';
      });
      var colsXml = sh.widths ? '<cols>' + sh.widths.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('') + '</cols>' : '';
      files.push({ name: 'xl/worksheets/sheet' + n + '.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + colsXml + '<sheetData>' + rowsXml + '</sheetData></worksheet>' });
      wbSheets += '<sheet name="' + esc(nm) + '" sheetId="' + n + '" r:id="rId' + n + '"/>';
      wbRels += '<Relationship Id="rId' + n + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + n + '.xml"/>';
      ct += '<Override PartName="/xl/worksheets/sheet' + n + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
    });
    var k = sheets.length + 1;
    wbRels += '<Relationship Id="rId' + k + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>';
    files.unshift(
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + ct + '</Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + wbSheets + '</sheets></workbook>' },
      { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + wbRels + '</Relationships>' },
      { name: 'xl/styles.xml', data: styles }
    );
    return zip(files);
  }
  // Report lines -> Excel rows with QuickBooks header block, indentation, bold 'Total for' rows and money format.
  // fmts: optional per value-column format list ('money' | 'pct'), default money.
  function sheetFromLines(title, company, period, colTitles, lines, footer, fmts) {
    var rows = [[{ v: company || 'N/A — not in source', s: 'title' }], [{ v: title, s: 'bold' }], [period], [], colTitles.map(function (t) { return { v: t, s: 'bold' }; })];
    lines.forEach(function (l) {
      var bold = l.kind === 'total' || l.kind === 'header';
      var r = [{ v: l.label, s: bold ? 'bold' : 'none', indent: l.depth }];
      (l.values || []).forEach(function (v, i) { var f = fmts && fmts[i]; r.push(v == null ? null : { v: v, s: f === 'pct' ? 'pct' : bold ? 'moneyBold' : 'money' }); });
      rows.push(r);
    });
    if (footer) { rows.push([]); rows.push([{ v: footer, s: 'muted' }]); }
    var widths = [48]; colTitles.slice(1).forEach(function () { widths.push(18); });
    return { name: title, rows: rows, widths: widths };
  }
  function download(bytes, name, mime) {
    var blob = new Blob([bytes], { type: mime || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  // ---------- Parameters sheet (what produced the figures) ----------
  function reportParams(v) {
    var d = v.display || DISPLAY_DEFAULT;
    var p = { from_date: v.start || null, to_date: v.end || null, as_at: v.asAt || null, reporting_basis: v.basis || null, company_file: v.companyFile || null,
      cents: d.cents ? 'shown' : 'hidden', divide_by_1000: d.k ? 'yes' : 'no', zero_rows: d.zeros ? 'shown' : 'hidden', negatives: d.neg, negatives_in_red: d.red ? 'yes' : 'no', header: d.hdr ? 'shown' : 'hidden', footer: d.ftr ? 'shown' : 'hidden' };
    Object.keys(p).forEach(function (k) { if (p[k] == null) delete p[k]; });
    return p;
  }

  // ---------- HTML helpers ----------
  function h(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function negCls(v, d) { return d && d.red && isNeg(v) ? ' neg' : ''; }
  function isZeroLine(l) { return l.kind === 'row' && !(l.values || []).some(function (v) { return v != null && Math.abs(v) >= 0.005; }); }
  // QuickBooks statement grammar: row order exactly as returned, sub-accounts indented, bold 'Total for' rows.
  // extraCols: optional [{title, value:function(line)->number|null, fmt:'money'|'pct'}] appended (e.g. $ change, % change, % of income).
  function statement(lines, colTitles, ctx, extraCols) {
    var d = ctx.display, cur = ctx.currency, ex = extraCols || [];
    var th = colTitles.concat(ex.map(function (e) { return e.title; }));
    var out = '<table class="mk-stmt"><thead><tr>' + th.map(function (t, i) { return '<th' + (i ? ' class="num"' : '') + ' scope="col">' + h(t) + '</th>'; }).join('') + '</tr></thead><tbody>';
    lines.forEach(function (l) {
      if (!d.zeros && isZeroLine(l)) return;
      var label = l.kind === 'total' && !l.fixed ? totalFor(l.label) : l.label;
      out += '<tr class="k-' + l.kind + (l.kind === 'row' ? ' detail-block' : '') + '"><td style="padding-left:' + (8 + l.depth * 18) + 'px">' + h(label) + '</td>';
      for (var i = 0; i < colTitles.length - 1; i++) { var v = (l.values || [])[i]; out += '<td class="num' + negCls(v, d) + '">' + (l.kind === 'header' ? '' : money(v, cur, d)) + '</td>'; }
      ex.forEach(function (e) { var v = l.kind === 'header' ? null : e.value(l); out += '<td class="num' + negCls(v, d) + '">' + (v == null ? '' : e.fmt === 'pct' ? pct(v) : money(v, cur, d)) + '</td>'; });
      out += '</tr>';
    });
    return out + '</tbody></table>';
  }
  // Sortable + filterable list table. spec: {columns:[{key,title,num,money,fmt}], rows:[{}], total:{}|null, filter:bool, empty:string}
  function grid(el, spec, ctx) {
    var st = { key: null, dir: 1, q: '' };
    function draw() {
      var rows = spec.rows.filter(function (r) { if (!st.q) return true; var q = st.q.toLowerCase(); return spec.columns.some(function (c) { return String(r[c.key] == null ? '' : r[c.key]).toLowerCase().indexOf(q) >= 0; }); });
      if (st.key) rows = rows.slice().sort(function (a, b) { var x = a[st.key], y = b[st.key]; if (x == null) return 1; if (y == null) return -1; return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * st.dir; });
      function cell(c, r, tag) {
        var v = r[c.key], txt = c.fmt ? c.fmt(v, r) : c.money ? money(v, ctx.currency, ctx.display) : (v == null ? '' : v);
        return '<' + tag + ' class="' + (c.num || c.money ? 'num' : '') + (c.money ? negCls(v, ctx.display) : '') + '">' + (c.html ? txt : h(txt)) + '</' + tag + '>';
      }
      var html = (spec.filter && spec.rows.length > 8 ? '<input class="mk-filter" type="search" placeholder="Filter…" aria-label="Filter rows" value="' + h(st.q) + '">' : '') +
        '<div class="mk-scroll"><table class="mk-grid"><thead><tr>' + spec.columns.map(function (c) { return '<th scope="col" data-k="' + h(c.key) + '" class="' + (c.num || c.money ? 'num' : '') + '" aria-sort="' + (st.key === c.key ? (st.dir > 0 ? 'ascending' : 'descending') : 'none') + '">' + h(c.title) + (st.key === c.key ? (st.dir > 0 ? ' ▲' : ' ▼') : '') + '</th>'; }).join('') + '</tr></thead><tbody>' +
        (rows.length ? rows.map(function (r) { return '<tr>' + spec.columns.map(function (c) { return cell(c, r, 'td'); }).join('') + '</tr>'; }).join('') : '<tr><td colspan="' + spec.columns.length + '" class="muted">' + h(spec.empty || "Data appears once it's available.") + '</td></tr>') +
        '</tbody>' + (spec.total ? '<tfoot><tr class="k-total">' + spec.columns.map(function (c) { return cell(c, spec.total, 'td'); }).join('') + '</tr></tfoot>' : '') + '</table></div>';
      el.innerHTML = html;
      el.querySelectorAll('th[data-k]').forEach(function (thEl) { thEl.addEventListener('click', function () { var k = thEl.getAttribute('data-k'); st.dir = st.key === k ? -st.dir : 1; st.key = k; draw(); }); });
      var f = el.querySelector('.mk-filter'); if (f) f.addEventListener('input', function () { st.q = f.value; var pos = f.selectionStart; draw(); var g = el.querySelector('.mk-filter'); g.focus(); g.setSelectionRange(pos, pos); });
    }
    draw();
  }
  // ---------- SVG charts (no libraries; colours from CSS custom properties) ----------
  function scale(vals) { var mn = Math.min(0, Math.min.apply(null, vals)), mx = Math.max(0, Math.max.apply(null, vals)); if (mn === mx) mx = mn + 1; return { mn: mn, mx: mx }; }
  function legend(series) { return '<div class="mk-legend">' + series.map(function (s, i) { return '<span><i style="background:' + (s.color || 'var(--c' + (i + 1) + ')') + '"></i>' + h(s.name) + '</span>'; }).join('') + '</div>'; }
  // bars(el, {labels:[], series:[{name, values:[]}], title}) — grouped bars, negatives below the zero line
  function bars(el, o, ctx) {
    var W = 640, H = 220, P = 28, all = []; o.series.forEach(function (s) { all = all.concat(s.values.filter(function (v) { return v != null; })); });
    if (!all.length) { el.innerHTML = '<p class="muted">Data appears once it\'s available.</p>'; return; }
    var sc = scale(all), n = o.labels.length, gw = (W - P * 2) / Math.max(n, 1), bw = Math.max(2, (gw * 0.7) / o.series.length);
    function y(v) { return P + (H - P * 2) * (1 - (v - sc.mn) / (sc.mx - sc.mn)); }
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + h(o.title || 'Bar chart') + '"><line x1="' + P + '" x2="' + (W - P) + '" y1="' + y(0) + '" y2="' + y(0) + '" class="axis"/>';
    o.labels.forEach(function (lb, i) {
      o.series.forEach(function (s, j) { var v = s.values[i]; if (v == null) return; var x = P + gw * i + gw * 0.15 + bw * j, y0 = y(0), y1 = y(v);
        svg += '<rect x="' + x.toFixed(1) + '" y="' + Math.min(y0, y1).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(1, Math.abs(y1 - y0)).toFixed(1) + '" fill="var(--c' + (j + 1) + ')"><title>' + h(s.name + ' · ' + lb + ': ' + money(v, ctx.currency, ctx.display)) + '</title></rect>'; });
      if (n <= 16) svg += '<text x="' + (P + gw * i + gw / 2).toFixed(1) + '" y="' + (H - 8) + '" class="tick" text-anchor="middle">' + h(lb) + '</text>';
    });
    el.innerHTML = svg + '</svg>' + legend(o.series);
  }
  // line(el, {labels, series:[{name, values, color}], area:bool, solid:bool (no dashed comparison lines), band:{low:[], high:[], name}, title})
  function line(el, o, ctx) {
    var W = 640, H = 220, P = 28, all = []; o.series.forEach(function (s) { all = all.concat(s.values.filter(function (v) { return v != null; })); });
    if (o.band) all = all.concat(o.band.low.filter(function (v) { return v != null; }), o.band.high.filter(function (v) { return v != null; }));
    if (!all.length) { el.innerHTML = '<p class="muted">Data appears once it\'s available.</p>'; return; }
    var sc = scale(all), n = o.labels.length, step = (W - P * 2) / Math.max(n - 1, 1);
    function y(v) { return P + (H - P * 2) * (1 - (v - sc.mn) / (sc.mx - sc.mn)); }
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + h(o.title || 'Line chart') + '"><line x1="' + P + '" x2="' + (W - P) + '" y1="' + y(0) + '" y2="' + y(0) + '" class="axis"/>';
    o.series.forEach(function (s, j) {
      var pts = s.values.map(function (v, i) { return v == null ? null : (P + step * i).toFixed(1) + ',' + y(v).toFixed(1); }).filter(Boolean);
      if (j === 0 && o.band) { var up = [], dn = []; o.band.high.forEach(function (v, i) { if (v != null && o.band.low[i] != null) { up.push((P + step * i).toFixed(1) + ',' + y(v).toFixed(1)); dn.unshift((P + step * i).toFixed(1) + ',' + y(o.band.low[i]).toFixed(1)); } }); if (up.length) svg += '<polygon points="' + up.concat(dn).join(' ') + '" fill="var(--c2)" opacity=".16"><title>' + h(o.band.name || 'Range') + '</title></polygon>'; }
      if (o.area && j === 0 && pts.length) svg += '<polygon points="' + (P).toFixed(1) + ',' + y(0).toFixed(1) + ' ' + pts.join(' ') + ' ' + (P + step * (n - 1)).toFixed(1) + ',' + y(0).toFixed(1) + '" fill="var(--c1)" opacity=".18"/>';
      var col = s.color || 'var(--c' + (j + 1) + ')';
      svg += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + col + '" stroke-width="2.5"' + (j && !o.solid ? ' stroke-dasharray="5 4"' : '') + '/>';
      s.values.forEach(function (v, i) { if (v != null) svg += '<circle cx="' + (P + step * i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="3" fill="' + col + '"><title>' + h(s.name + ' · ' + o.labels[i] + ': ' + money(v, ctx.currency, ctx.display)) + '</title></circle>'; });
    });
    o.labels.forEach(function (lb, i) { if (n <= 13 || i % Math.ceil(n / 12) === 0) svg += '<text x="' + (P + step * i).toFixed(1) + '" y="' + (H - 8) + '" class="tick" text-anchor="middle">' + h(lb) + '</text>'; });
    el.innerHTML = svg + '</svg>' + legend(o.series) + (o.band ? '<div class="mk-legend"><span><i style="background:var(--c2);opacity:.3"></i>' + h(o.band.name || 'Range') + '</span></div>' : '');
  }
  // donut(el, {items:[{label,value}], centre:'A$72,532', title}) — top 6 + 'Other'
  function donut(el, o, ctx) {
    var items = o.items.filter(function (i) { return i.value > 0; }).sort(function (a, b) { return b.value - a.value; });
    if (!items.length) { el.innerHTML = '<p class="muted">Data appears once it\'s available.</p>'; return; }
    if (items.length > 6) { var rest = items.slice(5); items = items.slice(0, 5).concat([{ label: '+' + rest.length + ' more', value: sum(rest.map(function (r) { return r.value; })) }]); }
    var tot = sum(items.map(function (i) { return i.value; })), a0 = -Math.PI / 2, R = 80, r = 50, cx = 100, cy = 100, svg = '<svg viewBox="0 0 200 200" role="img" aria-label="' + h(o.title || 'Donut chart') + '">';
    items.forEach(function (it, i) {
      if (it.value / tot > 0.9999) { // one slice: a full-circle arc starts and ends at the same point and draws nothing — draw a ring
        svg += '<path fill-rule="evenodd" d="M' + cx + ' ' + (cy - R) + ' A' + R + ' ' + R + ' 0 1 1 ' + cx + ' ' + (cy + R) + ' A' + R + ' ' + R + ' 0 1 1 ' + cx + ' ' + (cy - R) + 'Z M' + cx + ' ' + (cy - r) + ' A' + r + ' ' + r + ' 0 1 0 ' + cx + ' ' + (cy + r) + ' A' + r + ' ' + r + ' 0 1 0 ' + cx + ' ' + (cy - r) + 'Z" fill="var(--d' + (i + 1) + ')"><title>' + h(it.label + ': ' + money(it.value, ctx.currency, ctx.display)) + '</title></path>'; return;
      }
      var a1 = a0 + (it.value / tot) * Math.PI * 2 - 1e-6, lg = a1 - a0 > Math.PI ? 1 : 0;
      var p = [cx + R * Math.cos(a0), cy + R * Math.sin(a0), cx + R * Math.cos(a1), cy + R * Math.sin(a1), cx + r * Math.cos(a1), cy + r * Math.sin(a1), cx + r * Math.cos(a0), cy + r * Math.sin(a0)].map(function (v) { return v.toFixed(2); });
      svg += '<path d="M' + p[0] + ' ' + p[1] + ' A' + R + ' ' + R + ' 0 ' + lg + ' 1 ' + p[2] + ' ' + p[3] + ' L' + p[4] + ' ' + p[5] + ' A' + r + ' ' + r + ' 0 ' + lg + ' 0 ' + p[6] + ' ' + p[7] + 'Z" fill="var(--d' + (i + 1) + ')"><title>' + h(it.label + ': ' + money(it.value, ctx.currency, ctx.display)) + '</title></path>';
      a0 = a1 + 1e-6;
    });
    el.innerHTML = '<div class="mk-donut">' + svg + '<text x="100" y="106" text-anchor="middle" class="donut-c">' + h(o.centre || '') + '</text></svg><ul>' +
      items.map(function (it, i) { return '<li><i style="background:var(--d' + (i + 1) + ')"></i>' + h(it.label) + ': ' + money(it.value, ctx.currency, Object.assign({}, ctx.display, { cents: 0 })) + '</li>'; }).join('') + '</ul></div>';
  }
  // waterfall(el, {steps:[{label, value, total:bool}], title}) — opening -> deltas -> closing
  function waterfall(el, o, ctx) {
    var run = 0, bars2 = o.steps.map(function (s) { var from = s.total ? 0 : run, to = s.total ? s.value : run + s.value; run = to; return { label: s.label, from: from, to: to, total: s.total, v: s.value }; });
    var vals = []; bars2.forEach(function (b) { vals.push(b.from, b.to); });
    if (!vals.length) { el.innerHTML = '<p class="muted">Data appears once it\'s available.</p>'; return; }
    var W = 640, H = 220, P = 28, sc = scale(vals), gw = (W - P * 2) / bars2.length;
    function y(v) { return P + (H - P * 2) * (1 - (v - sc.mn) / (sc.mx - sc.mn)); }
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + h(o.title || 'Waterfall') + '"><line x1="' + P + '" x2="' + (W - P) + '" y1="' + y(0) + '" y2="' + y(0) + '" class="axis"/>';
    bars2.forEach(function (b, i) { var x = P + gw * i + gw * 0.2, y0 = y(b.from), y1 = y(b.to), c = b.total ? (b.v < 0 ? 'var(--neg)' : 'var(--c1)') : b.v < 0 ? 'var(--neg)' : 'var(--c2)';
      svg += '<rect x="' + x.toFixed(1) + '" y="' + Math.min(y0, y1).toFixed(1) + '" width="' + (gw * 0.6).toFixed(1) + '" height="' + Math.max(1, Math.abs(y1 - y0)).toFixed(1) + '" fill="' + c + '"><title>' + h(b.label + ': ' + money(b.v, ctx.currency, ctx.display)) + '</title></rect><text x="' + (x + gw * 0.3).toFixed(1) + '" y="' + (H - 8) + '" class="tick" text-anchor="middle">' + h(b.label) + '</text>'; });
    el.innerHTML = svg + '</svg>';
  }
  function compareCols(title) {
    return [{ title: title || 'Comparison', value: function (l) { return l.cmp; } },
      { title: '$ Change', value: function (l) { return l.cmp == null ? null : Math.round((val(l) - l.cmp) * 100) / 100; } },
      { title: '% Change', fmt: 'pct', value: function (l) { return l.cmp ? (val(l) - l.cmp) / Math.abs(l.cmp) : null; } }];
  }
  function kpis(items, ctx) { // [{label, value, delta:number|null (fraction), money:true|false, text}]
    return '<div class="mk-kpis">' + items.map(function (k) {
      var v = k.text != null ? h(k.text) : k.money === false ? h(k.value == null ? 'N/A' : k.value) : (k.value == null ? 'N/A — not in source' : money(k.value, ctx.currency, ctx.display));
      var chip = k.delta == null || !isFinite(k.delta) ? '' : '<span class="chip ' + (k.delta >= 0 ? 'up' : 'down') + '">' + (k.delta >= 0 ? '▲ ' : '▼ ') + pct(Math.abs(k.delta), 0) + '</span>';
      return '<div class="mk-kpi"><div class="lbl">' + h(k.label) + '</div><div class="val' + negCls(k.value, ctx.display) + '">' + v + '</div>' + chip + (k.sub ? '<div class="sub">' + h(k.sub) + '</div>' : '') + '</div>';
    }).join('') + '</div>';
  }

  // ---------- the report controller ----------
  // cfg: {title, token, route, kind:'period'|'asat', inputs:{start,end,asAt,basis,columnsBy,cmpStart,cmpEnd,cmpAsAt,persona,display}, defaults:{<declared>:value},
  //       uses:{bindingId:[declared input names]}, primary:'bindingId', files:'company_files' (list_company_files binding), fyMonth, tools:{bindingId:'tool name'},
  //       columnsBy:[[value,label]], compare:true, enums:[{input,label,options:[[v,l]]}], views:[[key,label]], optional:[bindingId] (a failed optional source is not a
//       failed check: the report says what it used instead), render(ctx)->{checks,na,notes,title,period}, excel(ctx)->[sheets]}. ctx.rerun() refetches every source.
  var FRIENDLY = { needs_connection: 'Connect MYOB (Settings → Connections) to see this data.', connection_unavailable: 'MYOB is temporarily unavailable — press Refresh to try again.', tool_not_found: 'This MYOB report is not available on the connected connector.', tool_error: 'MYOB returned an error for this section.', invalid_inputs: 'One of the report controls has an invalid value.' };
  var MECHANISM = 'myob-accounting connector — mySMB custom MCP on the MYOB Business (AccountRight) API v2 (AGT-002)';
  function app(cfg) {
    var MH = window.MyHubReport, live = !!(MH && MH.mode !== 'snapshot');
    var I = cfg.inputs || {}, S = { inputs: Object.assign({}, cfg.defaults), data: {}, errors: {}, fetchedAt: null, first: true, busy: 0 };
    var $ = function (id) { return document.getElementById(id); };
    function disp() { return readDisplay(I.display ? S.inputs[I.display] : ''); }
    function setDisp(patch) { if (!I.display) return; var d = disp(), k; for (k in patch) d[k] = patch[k]; S.inputs[I.display] = writeDisplay(d); }
    function co() { return companyOf(S.data[cfg.files], I.companyFile ? S.inputs[I.companyFile] : ''); }
    function fy() { return fiscalStart(co().country, cfg.fyMonth); }
    // MYOB errors arrive as data ({__error}); move them to S.errors so every section and check treats them as failed sources.
    function absorb(id, v) { var e = errorOf(v); if (e) { delete S.data[id]; S.errors[id] = { code: 'tool_error', message: e }; } else { S.data[id] = v; delete S.errors[id]; } }
    function err(id) { var e = S.errors[id]; return e ? (FRIENDLY[e.code] || e.message || 'Unavailable') + (e.code === 'tool_error' && e.message ? ' (' + e.message + ')' : '') : null; }
    function announce() { if (MH && live) MH.setInputs(Object.assign({}, S.inputs)); }
    function status(t) { var el = $('mk-status'); if (el) el.textContent = t || ''; }
    function requery(changed) {
      if (!MH || !live) { render(); return Promise.resolve(); } // snapshot: display-only inputs still redraw
      var ids = Object.keys(cfg.uses || {}).filter(function (id) { return !changed || (cfg.uses[id] || []).some(function (n) { return changed.indexOf(n) >= 0; }); });
      if (!ids.length) { render(); return Promise.resolve(); }
      S.busy++; status('Loading…'); var inputs = Object.assign({}, S.inputs); S.req = S.req || {};
      return Promise.all(ids.map(function (id) {
        var tok = S.req[id] = (S.req[id] || 0) + 1, latest = function () { return S.req[id] === tok; }; // a slower, older reload never overwrites a newer one
        return MH.getData(id, inputs).then(function (v) { if (latest()) absorb(id, v); }, function (e) { if (latest()) S.errors[id] = { code: (e && e.code) || 'tool_error', message: (e && e.message) || String(e) }; });
      })).then(function () { S.fetchedAt = new Date().toISOString(); S.busy--; status(''); render(); });
    }
    function change(patch, dispPatch) {
      var changed = [], k;
      for (k in patch) if (k && S.inputs[k] !== patch[k]) { S.inputs[k] = patch[k]; changed.push(k); }
      if (dispPatch) setDisp(dispPatch);
      if (cfg.derive) { var dv = cfg.derive(Object.assign({}, S.inputs), fy().month, disp()) || {}; for (k in dv) if (S.inputs[k] !== dv[k]) { S.inputs[k] = dv[k]; changed.push(k); } }
      var d = disp();
      if (cfg.compare && d.c !== 'none') { // keep the comparison window aligned with the main window
        if (I.cmpStart && I.start) { var c = compare(S.inputs[I.start], S.inputs[I.end], d.c, fy().month); if (S.inputs[I.cmpStart] !== c.start || S.inputs[I.cmpEnd] !== c.end) { S.inputs[I.cmpStart] = c.start; S.inputs[I.cmpEnd] = c.end; changed.push(I.cmpStart, I.cmpEnd); } }
        if (I.cmpAsAt && I.asAt) { var ca = compareAsAt(S.inputs[I.asAt], d.c); if (S.inputs[I.cmpAsAt] !== ca) { S.inputs[I.cmpAsAt] = ca; changed.push(I.cmpAsAt); } }
      }
      announce();
      if (changed.length) return requery(changed);
      render(); return Promise.resolve();
    }
    function compareAsAt(asAtIso, mode) { var x = parse(asAtIso); return mode === 'prev_year' ? iso(D(x.getUTCFullYear() - 1, x.getUTCMonth() + 1, Math.min(x.getUTCDate(), eom(x.getUTCFullYear() - 1, x.getUTCMonth() + 1).getUTCDate()))) : iso(eom(x.getUTCFullYear(), x.getUTCMonth())); }
    // Rolling presets: a saved 'This financial year to date' report must mean today's FY-to-date when reopened.
    function rollPresets() {
      if (!live) return null; var d = disp(), p = {}, f = fy().month;
      if (I.start && d.p && d.p !== 'custom') { var r = preset(d.p, f); if (r && (r.start !== S.inputs[I.start] || r.end !== S.inputs[I.end])) { p[I.start] = r.start; p[I.end] = r.end; } }
      if (I.asAt && d.a && d.a !== 'custom') { var a = asAt(d.a, f); if (a && a !== S.inputs[I.asAt]) p[I.asAt] = a; }
      if (cfg.roll) { var cr = cfg.roll(Object.assign({}, S.inputs), f, d) || {}, k2; for (k2 in cr) if (cr[k2] !== S.inputs[k2]) p[k2] = cr[k2]; }
      if (cfg.derive) { var dv = cfg.derive(Object.assign({}, S.inputs, p), f, d) || {}, k3; for (k3 in dv) if (dv[k3] !== S.inputs[k3]) p[k3] = dv[k3]; } // derived inputs (e.g. fy_start) are right on first open, not only after a change
      return Object.keys(p).length ? p : null;
    }
    // In snapshot mode the embedded data carries its own period: read it from the primary MYOB report.
    function adoptHeader() {
      var r = S.data[cfg.primary]; if (live || !r || typeof r !== 'object' || Array.isArray(r)) return;
      if (I.start && r.StartDate) S.inputs[I.start] = isoDate(r.StartDate);
      if (I.end && r.EndDate && cfg.headerEnd !== false) S.inputs[I.end] = isoDate(r.EndDate);
      if (I.asAt && r.AsOfDate) S.inputs[I.asAt] = isoDate(r.AsOfDate);
      if (I.basis && (r.ReportingBasis === 'Cash' || r.ReportingBasis === 'Accrual')) S.inputs[I.basis] = r.ReportingBasis;
    }
    function opt(list, cur) { return list.map(function (o) { return '<option value="' + h(o[0]) + '"' + (String(o[0]) === String(cur) ? ' selected' : '') + '>' + h(o[1]) + '</option>'; }).join(''); }
    function controls() {
      var el = $('mk-controls'); if (!el) return; var d = disp(), c0 = co(), dis = live ? '' : ' disabled', x = '';
      if (I.companyFile && c0.files.length > 1) x += '<label class="ctl">Client<select id="mk-client"' + dis + '>' + opt([['', 'Connection\'s default file']].concat(c0.files.map(function (f) { return [f.id, f.name || f.id]; })), S.inputs[I.companyFile] || '') + '</select></label>';
      else x += '<label class="ctl">Client<select id="mk-client" title="The MYOB company file this connection uses."><option>' + h(c0.name || 'Connected MYOB company file') + '</option></select></label>';
      if (I.start) x += '<label class="ctl">Report period<select id="mk-preset"' + dis + '>' + opt(cfg.presets || PRESETS, d.p) + '</select></label><label class="ctl">From<input type="date" id="mk-from" value="' + h(S.inputs[I.start]) + '"' + dis + '></label><label class="ctl">To<input type="date" id="mk-to" value="' + h(S.inputs[I.end]) + '"' + dis + '></label>';
      if (I.asAt) x += '<label class="ctl">As at<select id="mk-asat-preset"' + dis + '>' + opt(ASAT, d.a) + '</select></label><label class="ctl">Date<input type="date" id="mk-asat" value="' + h(S.inputs[I.asAt]) + '"' + dis + '></label>';
      if (I.basis) x += '<fieldset class="ctl seg"' + dis + '><legend>Accounting method</legend>' + ['Cash', 'Accrual'].map(function (b) { return '<label><input type="radio" name="mk-basis" value="' + b + '"' + (S.inputs[I.basis] === b ? ' checked' : '') + dis + '>' + b + '</label>'; }).join('') + '</fieldset>';
      if (I.columnsBy && cfg.columnsBy) x += '<label class="ctl">Display columns by<select id="mk-cols"' + dis + '>' + opt(cfg.columnsBy, S.inputs[I.columnsBy]) + '</select></label>';
      if (cfg.compare) x += '<label class="ctl">Compare to<select id="mk-cmp"' + dis + '>' + opt(I.asAt ? [['none', 'None'], ['prev_period', 'Previous month end'], ['prev_year', 'Previous year']] : [['none', 'None'], ['prev_period', 'Previous period'], ['prev_year', 'Previous year'], ['ytd', 'Year-to-date']], d.c) + '</select></label>';
      (cfg.enums || []).forEach(function (e, i) { var rq = Object.keys(cfg.uses || {}).some(function (id) { return (cfg.uses[id] || []).indexOf(e.input) >= 0; }); x += '<label class="ctl">' + h(e.label) + '<select id="mk-enum-' + i + '"' + (rq ? dis : '') + '>' + opt(e.options, S.inputs[e.input]) + '</select></label>'; });
      if (cfg.views) x += '<label class="ctl">Report<select id="mk-view">' + opt(cfg.views, d.v || cfg.views[0][0]) + '</select></label>';
      if (I.persona) x += '<label class="ctl">View as<select id="mk-persona">' + opt([['Client', 'Client'], ['Bookkeeper', 'Bookkeeper'], ['Practitioner', 'Practitioner'], ['Executive', 'Executive']], S.inputs[I.persona]) + '</select></label>';
      x += '<details class="ctl customise"><summary>Customise</summary><div class="cz">' +
        '<label><input type="checkbox" id="mk-cents"' + (d.cents ? ' checked' : '') + '> Show cents</label><label><input type="checkbox" id="mk-k"' + (d.k ? ' checked' : '') + '> Divide by 1000</label>' +
        '<label><input type="checkbox" id="mk-zeros"' + (d.zeros ? '' : ' checked') + '> Except zero amounts</label><label>Negative numbers<select id="mk-neg">' + opt([['minus', '-100'], ['paren', '(100)'], ['trail', '100-']], d.neg) + '</select></label>' +
        '<label><input type="checkbox" id="mk-red"' + (d.red ? ' checked' : '') + '> Show in red</label><label><input type="checkbox" id="mk-hdr"' + (d.hdr ? ' checked' : '') + '> Header</label><label><input type="checkbox" id="mk-ftr"' + (d.ftr ? ' checked' : '') + '> Footer</label>' +
        '<label>View<select id="mk-dens">' + opt([['compact', 'Compact'], ['100', '100%']], d.dens) + '</select></label>' +
        '<label>Branding<select id="mk-branding" title="MYOB branding (default) or the mySMB Reporting template — display only, the data does not change">' + opt([['myob', 'MYOB'], ['mysmb', 'mySMB']], d.style === 'mysmb' ? 'mysmb' : 'myob') + '</select></label>' +
        '<label>Brand colour<input type="color" id="mk-brand" value="' + h(HEX.test(d.b) ? d.b : '#6f2cba') + '"></label><label>&nbsp;<button type="button" id="mk-brand-reset"' + (HEX.test(d.b) ? '' : ' disabled') + '>Use MYOB branding</button></label></div></details>';
      x += '<div class="ctl btns"><button type="button" id="mk-pdf">Download PDF</button><button type="button" id="mk-xlsx">Download Excel</button>' + '</div>';
      el.innerHTML = x; wire();
    }
    function on(id, ev, fn) { var e = $(id); if (e) e.addEventListener(ev, fn); }
    function wire() {
      on('mk-client', 'change', function () { if (!I.companyFile) return; var p = {}; p[I.companyFile] = this.value; change(p); });
      on('mk-preset', 'change', function () { var k = this.value, r = preset(k, fy().month), p = {}; if (r) { p[I.start] = r.start; p[I.end] = r.end; } change(p, { p: k }); });
      on('mk-from', 'change', function () { var p = {}; p[I.start] = this.value; change(p, { p: 'custom' }); });
      on('mk-to', 'change', function () { var p = {}; p[I.end] = this.value; change(p, { p: 'custom' }); });
      on('mk-asat-preset', 'change', function () { var k = this.value, a = asAt(k, fy().month), p = {}; if (a) p[I.asAt] = a; change(p, { a: k }); });
      on('mk-asat', 'change', function () { var p = {}; p[I.asAt] = this.value; change(p, { a: 'custom' }); });
      document.querySelectorAll('input[name="mk-basis"]').forEach(function (r) { r.addEventListener('change', function () { var p = {}; p[I.basis] = this.value; change(p); }); });
      on('mk-cols', 'change', function () { var p = {}; p[I.columnsBy] = this.value; change(p); });
      on('mk-cmp', 'change', function () { change({}, { c: this.value }); });
      (cfg.enums || []).forEach(function (e, i) { on('mk-enum-' + i, 'change', function () { var p = {}; p[e.input] = this.value; change(p); }); });
      on('mk-view', 'change', function () { change({}, { v: this.value }); });
      on('mk-persona', 'change', function () { var p = {}; p[I.persona] = this.value; change(p); });
      [['mk-cents', 'cents'], ['mk-k', 'k'], ['mk-red', 'red'], ['mk-hdr', 'hdr'], ['mk-ftr', 'ftr']].forEach(function (c) { on(c[0], 'change', function () { var p = {}; p[c[1]] = this.checked ? 1 : 0; change({}, p); }); });
      on('mk-zeros', 'change', function () { change({}, { zeros: this.checked ? 0 : 1 }); });
      on('mk-neg', 'change', function () { change({}, { neg: this.value }); });
      on('mk-dens', 'change', function () { change({}, { dens: this.value }); });
      on('mk-branding', 'change', function () { change({}, { style: this.value }); });
      on('mk-brand', 'change', function () { if (HEX.test(this.value)) change({}, { b: this.value.toLowerCase() }); });
      on('mk-brand-reset', 'click', function () { change({}, { b: '' }); });
      on('mk-pdf', 'click', function () { window.print(); });
      on('mk-xlsx', 'click', function () { exportXlsx(); });
    }
    function ctx() {
      var d = disp(), c0 = co(), f = fy();
      return { data: S.data, errors: S.errors, err: err, inputs: S.inputs, I: I, display: d, view: d.v || (cfg.views ? cfg.views[0][0] : ''), compareMode: cfg.compare ? d.c : 'none',
        persona: I.persona ? S.inputs[I.persona] : 'Bookkeeper', company: c0.name, companyFile: c0, fy: f, currency: homeCurrency(c0.country), live: live,
        fetchedAt: S.fetchedAt, body: $('mk-body'), change: change, disp: disp, today: iso(today()), rerun: function () { return requery(null); } };
    }
    var last = { checks: [], na: [], notes: [] };
    function render() {
      var c = ctx(), d = c.display, root = document.documentElement;
      root.classList.toggle('style-mysmb', d.style === 'mysmb'); root.classList.toggle('dens-compact', d.dens === 'compact');
      root.classList.toggle('brand-custom', applyBrand(root, d.style === 'mysmb' ? '' : d.b));
      document.body.classList.toggle('persona-summary', c.persona === 'Client' || c.persona === 'Executive');
      document.body.classList.toggle('persona-detail', !(c.persona === 'Client' || c.persona === 'Executive'));
      controls();
      var out = {};
      try { out = cfg.render(c) || {}; } catch (e) { if (c.body) c.body.innerHTML = '<p class="mk-err">This report could not render: ' + h(e.message) + '</p>'; out = { checks: [{ name: 'Report rendered', pass: false, detail: e.message }] }; }
      last = { checks: out.checks || [], na: out.na || [], notes: out.notes || [] };
      // Not connected: always say so at the top of the report, whichever view is showing.
      var nc = Object.keys(S.errors).some(function (id) { return S.errors[id] && S.errors[id].code === 'needs_connection'; });
      if (nc && c.body && c.body.textContent.indexOf(FRIENDLY.needs_connection) < 0) { var dv = document.createElement('div'); dv.className = 'mk-banner fail'; dv.textContent = FRIENDLY.needs_connection; c.body.insertBefore(dv, c.body.firstChild); }
      // A failed data source is never silent: it turns the banner red even when the report's own checks still pass.
      Object.keys(S.errors).forEach(function (id) {
        if (id === cfg.files || (cfg.optional || []).indexOf(id) >= 0) return; // the company-file list is optional (newer MYOB keys return none); so are a report's declared optional sources (it says what it fell back to)
        var msg = err(id);
        if (last.checks.some(function (k) { return k.pass === false && k.detail === msg; })) return;
        last.checks.unshift({ name: 'Data loaded: ' + ((cfg.tools || {})[id] || id), pass: false, detail: msg });
      });
      var hd = $('mk-head');
      if (hd) { hd.hidden = !d.hdr || !!cfg.noHead; var per = out.period || (I.start ? periodLine(S.inputs[I.start], S.inputs[I.end]) : I.asAt ? asOfLine(S.inputs[I.asAt]) : ''); hd.innerHTML = '<div class="co">' + h(c.company || 'N/A — not in source') + '</div><div class="ti">' + h(out.title || cfg.title) + '</div><div class="pe">' + h(per) + '</div><div class="mk-src">' + (d.style === 'mysmb' ? '<span class="mk-badge">mySMB</span>mySMB Reporting · data from MYOB Business' : '<span class="mk-badge">MYOB</span>Prepared from MYOB Business') + '</div>'; }
      var ft = $('mk-foot'); if (ft) { ft.hidden = !d.ftr; var stamp = footerStamp(I.basis ? S.inputs[I.basis] : ((S.data[cfg.primary] || {}).ReportingBasis || 'Accrual'), S.fetchedAt); ft.textContent = d.style === 'mysmb' ? [c.company || 'MYOB company file', out.title || cfg.title, stamp].join(' | ') : stamp; }
      banner(c); sources(c);
    }
    function banner(c) {
      var el = $('mk-banner'); if (!el) return; var ch = last.checks, isInfo = function (k) { return !!k.info; }, fails = ch.filter(function (k) { return k.pass === false; }), done = ch.filter(function (k) { return k.pass === true; });
      var nInfo = ch.filter(isInfo).length, nNA = ch.filter(function (k) { return k.pass == null && !isInfo(k); }).length, real = ch.length - nInfo;
      var none = !fails.length && !done.length && ch.length > 0; // nothing could be checked: say so, never a green tick
      // information lines and N/A checks are listed but not counted in 'x/y passed', so a clean report never reads as a failure
      var extra = (nNA ? ' · ' + nNA + ' N/A' : '') + (nInfo ? ' · ' + nInfo + ' for information' : '');
      el.className = 'mk-banner ' + (fails.length ? 'fail' : none ? 'na' : 'pass');
      el.innerHTML = '<strong>' + (fails.length ? '⚠ Validation: ' + fails.length + ' check' + (fails.length > 1 ? 's' : '') + ' failed' + (done.length ? ' · ' + done.length + ' passed' : '') + extra :
        none ? (real ? '– Validation: no check could run (' + nNA + ' N/A' + (nInfo ? ' · ' + nInfo + ' for information' : '') + ')' : 'ℹ Validation: ' + nInfo + ' line' + (nInfo > 1 ? 's' : '') + ' for information') :
        '✓ Validation: ' + done.length + '/' + done.length + ' check' + (done.length > 1 ? 's' : '') + ' passed' + extra) + '</strong>' +
        ' · Data as of ' + h(S.fetchedAt ? new Date(S.fetchedAt).toLocaleString('en-AU') : '—') + (live ? '' : ' · Snapshot: figures frozen at capture time') +
        ' · Financial year starts ' + h(MONTHS[c.fy.month - 1]) + ' (' + h(c.fy.source) + ')' +
        '<ul>' + ch.map(function (k) { return '<li class="' + (k.pass === false ? 'bad' : k.pass === true ? 'ok' : isInfo(k) ? 'na info' : 'na') + '">' + (k.pass === false ? '✗ ' : k.pass === true ? '✓ ' : isInfo(k) ? 'ℹ ' : '– ') + h(k.name) + (k.detail ? ' — ' + h(k.detail) : '') + '</li>'; }).join('') + '</ul>';
    }
    function sources(c) {
      var el = $('mk-sources'); if (!el) return; var t = cfg.tools || {};
      var items = Object.keys(t).map(function (id) { return h(t[id]) + (S.errors[id] ? ' — <span class="mk-err">' + h(err(id)) + '</span>' : ''); });
      var na = last.na.slice(); if (!c.company) na.unshift('Company file name (' + (c.companyFile.ambiguous ? 'several files on this connection' : 'MYOB returned no company-file list') + ')');
      el.innerHTML = '<h2>Sources &amp; limitations</h2><ul><li>Mechanism: ' + h(MECHANISM) + '</li><li>Tool calls: ' + items.join(' · ') + '</li>' +
        '<li>Basis: ' + h(I.basis ? S.inputs[I.basis] : 'n/a') + ' · Currency: ' + h(c.currency) + ' · Client: ' + h(c.company || 'N/A — not in source') + ' (one MYOB company file per report)</li>' +
        (/^assumed/.test(c.fy.source) ? '<li>Financial year: ' + h(c.fy.source) + ' (starts ' + h(MONTHS[c.fy.month - 1]) + '). Adjust the dates if this file uses a different year.</li>' : '') +
        last.notes.map(function (n) { return '<li>' + h(n) + '</li>'; }).join('') +
        (na.length ? '<li>N/A — not in source: ' + na.map(h).join('; ') + '</li>' : '') + '<li>Decision support only — not audit, tax or legal advice.</li></ul>';
    }
    function exportXlsx() {
      var c = ctx(), sheets = [];
      try { sheets = (cfg.excel && cfg.excel(c)) || []; } catch (e) { sheets = [{ name: 'Error', rows: [['Excel export failed: ' + e.message]] }]; }
      sheets.push({ name: 'Validation', rows: [[{ v: 'Check', s: 'bold' }, { v: 'Result', s: 'bold' }, { v: 'Detail', s: 'bold' }]].concat(last.checks.map(function (k) { return [k.name, k.pass === true ? 'Pass' : k.pass === false ? 'FAIL' : 'N/A', k.detail || '']; })), widths: [60, 10, 60] });
      var pr = reportParams({ start: I.start && S.inputs[I.start], end: I.end && S.inputs[I.end], asAt: I.asAt && S.inputs[I.asAt], basis: I.basis && S.inputs[I.basis], companyFile: I.companyFile && S.inputs[I.companyFile], display: c.display });
      sheets.push({ name: 'Parameters', rows: [[{ v: 'Parameter', s: 'bold' }, { v: 'Value', s: 'bold' }]].concat(Object.keys(pr).map(function (k) { return [k, String(pr[k])]; })).concat([[], ['Data as of', S.fetchedAt || ''], ['Source', MECHANISM]]), widths: [28, 60] });
      var name = [(c.company || 'MYOB'), cfg.title, (I.start ? S.inputs[I.start] + ' to ' + S.inputs[I.end] : I.asAt ? 'as at ' + S.inputs[I.asAt] : '')].join(' - ').replace(/[\\\/:*?"<>|]+/g, ' ');
      download(xlsx(sheets, c.currency), name + '.xlsx');
    }
    function boot(bundle) {
      // The platform says which input values this bundle ran at (a template copy whose manifest defaults differ from this
      // config's, a snapshot captured at the reader's inputs): take them, so the controls, header and company file match the figures.
      var bi = bundle.inputs, k0; if (bi && typeof bi === 'object') for (k0 in bi) if (Object.prototype.hasOwnProperty.call(S.inputs, k0)) S.inputs[k0] = bi[k0];
      S.data = {}; S.errors = Object.assign({}, bundle.errors || {}); S.fetchedAt = bundle.fetchedAt || null;
      Object.keys(bundle.data || {}).forEach(function (id) { if (!S.errors[id]) absorb(id, bundle.data[id]); });
      adoptHeader(); status('');
      if (S.first) { S.first = false; var roll = rollPresets(); if (roll) { change(roll); return; } announce(); }
      render();
    }
    if (!MH) { status('Open this report in mySMB to load MYOB data.'); return { state: S }; }
    MyHubReport.onData(boot);
    if (MH.onRefresh) MH.onRefresh(function () { status('Refreshing…'); });
    if (MH.onThemeChange) MH.onThemeChange(function () { render(); });
    return { state: S, change: change, render: render, exportXlsx: exportXlsx, ctx: ctx };
  }

  return { signNotes: signNotes, cashMoves: cashMoves, errorOf: errorOf, items: items, cardId: cardId, isoDate: isoDate, accounts: accounts, classOf: classOf, breakdown: breakdown, PL_LAYOUT: PL_LAYOUT, BS_LAYOUT: BS_LAYOUT, PL_CLASSES: PL_CLASSES, BS_CLASSES: BS_CLASSES,
    CYE_RE: CYE_RE, currentYearEarnings: currentYearEarnings, linesTies: linesTies, companyFiles: companyFiles, companyOf: companyOf, fiscalStart: fiscalStart, homeCurrency: homeCurrency,
    applyBrand: applyBrand, fyStartOf: function (isoDate, m) { return iso(fyStartOf(parse(isoDate), m)); }, compareCols: compareCols, h: h, statement: statement, grid: grid, bars: bars, line: line, donut: donut, waterfall: waterfall, kpis: kpis, app: app,
    MONTHS: MONTHS, iso: iso, parse: parse, eom: eom, addDays: addDays, num: num, find: find, val: val, totalFor: totalFor, near: near, sum: sum, symbol: symbol,
    DISPLAY_DEFAULT: DISPLAY_DEFAULT, readDisplay: readDisplay, writeDisplay: writeDisplay, money: money, pct: pct, isNeg: isNeg,
    PRESETS: PRESETS, preset: preset, ASAT: ASAT, asAt: asAt, compare: compare, periodLine: periodLine, asOfLine: asOfLine, footerStamp: footerStamp, freshest: freshest,
    xlsx: xlsx, sheetFromLines: sheetFromLines, download: download, reportParams: reportParams };
})();
if (typeof module !== 'undefined') module.exports = MK;
