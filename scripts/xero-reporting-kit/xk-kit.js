var XK = (function () {
  'use strict';
  // ---------- numbers & labels ----------
  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = Number(String(v).replace(/,/g, ''));
    return isFinite(n) ? n : null;
  }
  function totalFor(label) { return /^Total\s+(?!for\s)/i.test(label) ? label.replace(/^Total\s+/i, 'Total for ') : label; }
  function near(a, b, tol) { return a != null && b != null && Math.abs(a - b) <= (tol == null ? 0.01 : tol); }
  function sum(arr) { var s = 0; arr.forEach(function (v) { if (v != null) s += v; }); return Math.round(s * 100) / 100; }

  // ---------- Xero responses ----------
  // Tool results are Xero's own JSON, passed through unchanged by the xero-accounting connector. A failed call arrives as a
  // binding error (the connector throws an MCP error); an {"__error"} object is still absorbed in case a proxy returns one.
  function errorOf(v) { return v && typeof v === 'object' && !Array.isArray(v) && v.__error != null ? String(v.__error) : null; }
  // Xero dates: '/Date(1519593468971+0000)/' (API JSON) or ISO 'YYYY-MM-DDThh:mm:ss' → 'YYYY-MM-DD'.
  function isoDate(v) {
    if (v == null || v === '') return null;
    var m = /\/Date\((-?\d+)/.exec(String(v)); if (m) { var d = new Date(+m[1]); return iso(D(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())); }
    return String(v).slice(0, 10);
  }
  // Reports (get_profit_and_loss, get_balance_sheet, …): {Reports:[{ReportName, ReportTitles:[title, organisation, period],
  // ReportDate, Rows:[…]}]}. Every amount is a string ("1234.56", "-50.00", "" for blank).
  function reportOf(v) { return !v || errorOf(v) ? null : Array.isArray(v.Reports) ? v.Reports[0] || null : Array.isArray(v.Rows) ? v : null; }
  function attr(cell, id) { var a = ((cell && cell.Attributes) || []).filter(function (x) { return x && (x.Id === id || (id === 'account' && /^accountid$/i.test(x.Id || ''))); })[0]; return a ? a.Value : null; }
  function isDeduction(title) { return /^less\b/i.test(title || '') || /cost of sales|expense/i.test(title || ''); }
  // Walk Xero's Rows in Xero's own order and wording. RowType Header = column titles; Section {Title, Rows}; Row; SummaryRow.
  // A titled section with no rows is a parent group (Balance Sheet 'Assets', 'Liabilities'); an untitled section holds a
  // computed line (Gross Profit, Net Profit, Total Assets, Net Assets). 'Total <parent>' closes the parent group.
  // Lines: {kind:'header'|'row'|'total', depth, label, id (AccountID), group (section title as Xero sent it), parent, calc, closes, values[]}.
  function walk(v) {
    var rep = reportOf(v), out = { lines: [], columns: [], titles: [], date: null, name: null, sections: [] };
    if (!rep) return out;
    out.titles = rep.ReportTitles || []; out.date = rep.ReportDate || null; out.name = rep.ReportName || null;
    var parent = null, vals = function (c) { return c.slice(1).map(function (x) { return num(x && x.Value); }); }, lbl = function (c) { return String((c[0] || {}).Value || ''); };
    (rep.Rows || []).forEach(function (r) {
      if (!r) return;
      var c = r.Cells || [];
      if (r.RowType === 'Header') { out.columns = c.slice(1).map(function (x) { return (x && x.Value) || ''; }); return; }
      if (r.RowType !== 'Section') { if (c.length) out.lines.push({ kind: 'total', depth: 0, label: lbl(c), group: lbl(c), parent: null, calc: true, fixed: true, values: vals(c), path: [] }); return; }
      var title = String(r.Title || ''), kids = r.Rows || [];
      if (title && !kids.length) { parent = title; out.lines.push({ kind: 'header', depth: 0, label: title, group: title, parent: null, values: [], path: [] }); return; }
      // An untitled section is computed lines (Gross Profit, Net Profit, Total Assets…) unless it holds account rows or a
      // SummaryRow (Bank Summary puts its accounts and Total in one untitled section).
      // (A section holding only a SummaryRow — the Trial Balance's grand Total — stays a computed line.)
      var hasRow = kids.some(function (k) { return k && k.RowType === 'Row'; }), real = kids.some(function (k) { return k && k.RowType === 'Row' && attr((k.Cells || [])[0], 'account'); }) || (hasRow && kids.some(function (k) { return k && k.RowType === 'SummaryRow'; }));
      if (!title && !real) {
        kids.forEach(function (k) {
          var kc = k.Cells || [], label = lbl(kc), closes = parent && label.toLowerCase() === ('total ' + parent).toLowerCase() ? parent : null;
          out.lines.push({ kind: 'total', depth: 0, label: label, group: closes || label, parent: null, calc: !closes, closes: closes, fixed: true, values: vals(kc), path: [] });
          if (closes) parent = null;
        });
        return;
      }
      var d = parent ? 1 : 0, shown = title.replace(/^Less\s+/i, ''), sec = { title: title, label: shown, parent: parent, rows: [], summary: null };
      if (title) out.lines.push({ kind: 'header', depth: d, label: shown, group: title, parent: parent, values: [], path: parent ? [parent] : [] });
      kids.forEach(function (k) {
        var kc = k.Cells || [], label = lbl(kc), line;
        if (k.RowType === 'SummaryRow') { line = { kind: 'total', depth: d, label: label, group: title, parent: parent, fixed: true, values: vals(kc), path: [] }; sec.summary = line; }
        else { line = { kind: 'row', depth: d + 1, label: label, id: attr(kc[0], 'account') || attr(kc[1], 'account'), group: title, parent: parent, values: vals(kc), path: (parent ? [parent] : []).concat([shown]) }; sec.rows.push(line); }
        out.lines.push(line);
      });
      out.sections.push(sec);
    });
    return out;
  }
  // A section's amount: its SummaryRow when Xero sent one, else Σ its rows.
  function sectionTotal(sec, col) { var i = col || 0; return sec.summary ? sec.summary.values[i] : sum(sec.rows.map(function (l) { return l.values[i]; })); }
  // Xero's own section totals re-added from their rows: every SummaryRow = Σ the rows of its section.
  function linesTies(lines, tol) {
    var res = { checked: 0, failed: [] };
    lines.forEach(function (t) {
      if (t.kind !== 'total' || t.calc || t.closes) return;
      var mem = lines.filter(function (l) { return l.kind === 'row' && l.group === t.group; });
      res.checked++;
      t.values.forEach(function (v, i) { if (!near(v, sum(mem.map(function (l) { return l.values[i]; })), tol)) { if (res.failed.indexOf(t.label) < 0) res.failed.push(t.label); } });
    });
    return res;
  }
  // Parent totals (Total Assets, Total Liabilities) = Σ the sections under that parent.
  function parentTies(w, col, tol) {
    var res = { checked: 0, failed: [] }, i = col || 0;
    w.lines.forEach(function (t) {
      if (!t.closes) return;
      var s = sum(w.sections.filter(function (x) { return x.parent === t.closes; }).map(function (x) { return sectionTotal(x, i); }));
      res.checked++; if (!near(t.values[i], s, tol)) res.failed.push(t.label + ' ' + t.values[i] + ' vs Σ sections ' + s);
    });
    return res;
  }
  // Profit and Loss: every computed line (Gross Profit, Net Profit) = the running Σ of the sections above it, with the
  // 'Less …' / cost of sales / expense sections subtracted.
  function runningTies(w, col, tol) {
    var res = { checked: 0, failed: [] }, i = col || 0, run = 0, bySum = {};
    w.sections.forEach(function (s) { bySum[s.title] = s; });
    w.lines.forEach(function (l) {
      if (l.kind === 'header' && bySum[l.group] && l.label === bySum[l.group].label) { var s = bySum[l.group]; run = Math.round((run + (isDeduction(s.title) ? -1 : 1) * (sectionTotal(s, i) || 0)) * 100) / 100; }
      else if (l.kind === 'total' && l.calc) { res.checked++; if (!near(l.values[i], run, tol)) res.failed.push(l.label + ' ' + l.values[i] + ' vs ' + run); }
    });
    return res;
  }
  // Current Year Earnings: Xero's Equity row for this financial year's profit to the balance date.
  var CYE_RE = /^current year('s)? earnings$|^current earnings$/i;
  function currentYearEarnings(bsLines) { var r = bsLines.filter(function (l) { return l.kind === 'row' && /^equity$/i.test(l.group) && CYE_RE.test(l.label); })[0]; return r || null; }
  // Find a statement line by group (section title) first, else by label regex; kind 'total' | 'row' | 'header' (default: total, then row).
  function find(lines, group, labelRe, kind) {
    var kinds = kind ? [kind] : ['total', 'row'], i, j;
    for (j = 0; j < kinds.length; j++) {
      if (group) for (i = 0; i < lines.length; i++) if (lines[i].group === group && lines[i].kind === kinds[j]) return lines[i];
      if (labelRe) for (i = 0; i < lines.length; i++) if (lines[i].kind === kinds[j] && labelRe.test(lines[i].label)) return lines[i];
    }
    return null;
  }
  function val(line, col) { return line ? line.values[col == null ? 0 : col] : null; }
  // Section amount by title pattern (first match), e.g. sectionBy(w, /cost of sales/i).
  function sectionBy(w, re, col) { var s = w.sections.filter(function (x) { return re.test(x.title); })[0]; return s ? sectionTotal(s, col) : null; }
  // Organisation (get_organisation): {Organisations:[{Name, LegalName, BaseCurrency, CountryCode, FinancialYearEndDay, FinancialYearEndMonth, ShortCode, OrganisationID}]}.
  function orgOf(v) {
    var o = v && !errorOf(v) && Array.isArray(v.Organisations) ? v.Organisations[0] : null; if (!o) return null;
    return { name: o.Name || o.LegalName || null, currency: o.BaseCurrency || null, country: o.CountryCode || null, fyEndMonth: Number(o.FinancialYearEndMonth) || null, fyEndDay: Number(o.FinancialYearEndDay) || null, shortCode: o.ShortCode || null, id: o.OrganisationID || null };
  }
  // Connections (list_connections): {activeTenantId, tenants:[{tenantId, tenantName, tenantType}]} — the organisations this Xero
  // connection can access. The organisation input carries a tenantId ('' = the connection's default organisation).
  function connections(v) {
    var t = !v || errorOf(v) ? [] : Array.isArray(v.tenants) ? v.tenants : Array.isArray(v) ? v : [];
    return { active: (v && v.activeTenantId) || null, list: t.map(function (x) { return { id: String(x.tenantId || ''), name: x.tenantName || '', type: x.tenantType || '' }; }).filter(function (x) { return x.id; }) };
  }
  // The organisation this report shows: name from get_organisation (the chosen tenant), else list_connections, else the report title.
  function companyOf(orgResp, connResp, chosenId, titles) {
    var o = orgOf(orgResp), cn = connections(connResp), id = chosenId || cn.active || null, t = cn.list.filter(function (x) { return x.id === id; })[0];
    var fromTitle = titles && titles[1] ? String(titles[1]) : null;
    return { name: (o && o.name) || (t && t.name) || fromTitle, id: id, currency: o ? o.currency : null, country: o ? o.country : null, org: o, orgs: cn.list, active: cn.active,
      source: o ? 'get_organisation' : t ? 'list_connections' : fromTitle ? 'report title' : null };
  }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  // Financial year from the organisation's settings (FinancialYearEndMonth); if get_organisation failed, AU ends 30 June and
  // NZ 31 March (assumed, and said so). A report may override with cfg.fyMonth. Returns {month:1-12, source}.
  function fiscalStart(org, fyMonth) {
    if (fyMonth) return { month: fyMonth, source: 'report setting' };
    if (org && org.fyEndMonth >= 1 && org.fyEndMonth <= 12) return { month: org.fyEndMonth % 12 + 1, source: 'Xero organisation settings — year ends ' + (org.fyEndDay || eom(2026, org.fyEndMonth).getUTCDate()) + ' ' + MONTHS[org.fyEndMonth - 1] };
    if (org && /^nz/i.test(org.country || '')) return { month: 4, source: 'assumed — NZ default; Xero did not return the organisation\'s financial year' };
    return { month: 7, source: 'assumed — AU default; Xero did not return the organisation\'s financial year' };
  }
  function homeCurrency(org) { return (org && org.currency) || (org && /^nz/i.test(org.country || '') ? 'NZD' : 'AUD'); }
  // Dates in a Xero report title ('1 July 2026 to 30 September 2026', 'As at 30 September 2026') → ['YYYY-MM-DD', …].
  function titleDates(s) {
    var out = [], re = /(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/g, m;
    while ((m = re.exec(String(s || '')))) out.push(iso(D(+m[3], MONTHS.indexOf(m[2]) + 1, +m[1])));
    return out;
  }
  var SYM = { AUD: '$', NZD: '$', USD: 'US$', CAD: 'C$', GBP: '£', EUR: '€', PHP: '₱', SGD: 'S$', HKD: 'HK$', JPY: '¥', INR: '₹' };
  function symbol(code) { return SYM[code] || (code ? code + ' ' : ''); }

  // ---------- display preferences (one declared string input "display") ----------
  // o = report options 'key=value;…' (cfg.options), p = period preset key, a = as-at preset key, c = compare mode (none|prev_period|prev_year|ytd), v = report view / member
  // style = 'xero' (default, Xero's look) | 'mysmb' (mySMB Reporting template); b = brand colour (#rrggbb) — empty means Xero blue
  var DISPLAY_DEFAULT = { cents: 1, k: 0, zeros: 1, neg: 'minus', red: 0, hdr: 1, ftr: 1, style: 'xero', dens: '100', p: 'custom', a: 'custom', c: 'none', v: '', x: '', b: '', o: '', pv: '', fy: '' }; // pv = View as (cfg.personaDisplay); fy = financial year end month set in the report ('' = Xero's)
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

  // Money: $1,234.56 / -$1,234.56. neg: 'minus' (-100) | 'paren' ((100)) | 'trail' (100-)
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
  var ASAT = [['today', 'Today'], ['end_this_month', 'End of this month'], ['end_last_month', 'End of last month'], ['end_last_quarter', 'End of last quarter'], ['end_last_fy', 'End of last financial year'], ['custom', 'Custom']];
  function asAt(key, fyMonth, now) {
    var t = now ? parse(now) : today(), y = t.getUTCFullYear(), m = t.getUTCMonth() + 1, qs = Math.floor((m - 1) / 3) * 3 + 1;
    switch (key) {
      case 'today': return iso(t);
      case 'end_this_month': return iso(eom(y, m));
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
  // Xero period line: 'For the month ended 31 August 2026' | 'For the 3 months ended 30 September 2026' |
  // 'For the year ended 30 June 2026' | 'For the period 1 July 2026 to 25 September 2026'
  function shortDate(d) { var x = parse(d); return x ? x.getUTCDate() + ' ' + MON[x.getUTCMonth()].slice(0, 3) + ' ' + x.getUTCFullYear() : ''; }
  function longDate(x) { return x.getUTCDate() + ' ' + MON[x.getUTCMonth()] + ' ' + x.getUTCFullYear(); }
  function periodLine(start, end) {
    var s = parse(start), e = parse(end), ey = e.getUTCFullYear();
    if (s.getUTCDate() === 1 && iso(e) === iso(eom(ey, e.getUTCMonth() + 1))) {
      var months = (ey - s.getUTCFullYear()) * 12 + (e.getUTCMonth() - s.getUTCMonth()) + 1;
      if (months === 1) return 'For the month ended ' + longDate(e);
      if (months === 12) return 'For the year ended ' + longDate(e);
      if (months > 1) return 'For the ' + months + ' months ended ' + longDate(e);
    }
    return 'For the period ' + longDate(s) + ' to ' + longDate(e);
  }
  // Column label: 'Sep 2026' | 'Jul–Sep 2026' | 'Jul 2025–Jun 2026' | '1 Jul 2026–25 Sep 2026'
  function rangeLabel(start, end) {
    var s = parse(start), e = parse(end), m = function (x) { return MON[x.getUTCMonth()].slice(0, 3); }, sy = s.getUTCFullYear(), ey = e.getUTCFullYear();
    if (s.getUTCDate() === 1 && iso(e) === iso(eom(ey, e.getUTCMonth() + 1))) return sy === ey && s.getUTCMonth() === e.getUTCMonth() ? m(e) + ' ' + ey : sy === ey ? m(s) + '–' + m(e) + ' ' + ey : m(s) + ' ' + sy + '–' + m(e) + ' ' + ey;
    return s.getUTCDate() + ' ' + m(s) + ' ' + sy + '–' + e.getUTCDate() + ' ' + m(e) + ' ' + ey;
  }
  function asOfLine(d) { var x = parse(d); return 'As at ' + x.getUTCDate() + ' ' + MON[x.getUTCMonth()] + ' ' + x.getUTCFullYear(); } // Xero wording: 'As at 30 September 2026'
  // Footer: 'Accrual basis · AUD | Thursday, 25 September, 2026 10:52 AM GMT+08:00'
  function footerStamp(basis, fetchedAt, cur) {
    var t = fetchedAt ? new Date(fetchedAt) : new Date();
    var wd = t.toLocaleDateString('en-AU', { weekday: 'long' });
    var dm = t.getDate() + ' ' + MON[t.getMonth()] + ', ' + t.getFullYear();
    var hm = t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    var off = -t.getTimezoneOffset(), sign = off >= 0 ? '+' : '-', a = Math.abs(off);
    var tz = 'GMT' + sign + String(Math.floor(a / 60)).padStart(2, '0') + ':' + String(a % 60).padStart(2, '0');
    return (basis == null ? (cur || '') : (basis === 'Cash' ? 'Cash basis' : 'Accrual basis') + (cur ? ' · ' + cur : '')) + ' | ' + wd + ', ' + dm + ' ' + hm + ' ' + tz;
  }
  function freshest(bundle) {
    var f = bundle && bundle.fetchedAt;
    if (f && typeof f === 'object') { var best = null, k; for (k in f) if (f[k] && (!best || f[k] > best)) best = f[k]; return best; }
    return f || null;
  }

  // ---------- Xero documents (lists) ----------
  // Invoices/bills (list_invoices), credit notes, overpayments, prepayments → one shape in base currency:
  // {kind:'Invoice'|'Credit note'|'Overpayment'|'Prepayment', type (Xero Type), number, contact, cid, date, due, status, total, due$ (amount), cur, fx, id}
  // Credit notes, overpayments and prepayments are negative (they reduce the balance), as in Xero's aged reports.
  function doc(d, kind, base) {
    var cn = kind !== 'Invoice', cur = d.CurrencyCode || base, fx = !!(base && cur !== base), rate = num(d.CurrencyRate) || 1, conv = function (v) { return v == null ? null : Math.round((fx ? v / rate : v) * 100) / 100; };
    var date = isoDate(d.DateString || d.Date), due = cn ? date : isoDate(d.DueDateString || d.DueDate) || date, sg = cn ? -1 : 1;
    return { kind: kind, type: d.Type || '', number: d.InvoiceNumber || d.CreditNoteNumber || d.Reference || '', contact: (d.Contact || {}).Name || '(no contact)', cid: String((d.Contact || {}).ContactID || (d.Contact || {}).Name || ''),
      date: date, due: due, status: d.Status || '', total: conv(sg * (num(d.Total) || 0)), amount: conv(sg * (num(cn ? d.RemainingCredit : d.AmountDue) || 0)), cur: cur, fx: fx, id: d.InvoiceID || d.CreditNoteID || d.OverpaymentID || d.PrepaymentID || '', raw: d };
  }
  // Open documents at an as-at date: approved, dated on or before it, with an amount outstanding.
  function openDocs(sets, base, asAt) {
    var out = [];
    [['invoices', 'Invoice'], ['credit_notes', 'Credit note'], ['overpayments', 'Overpayment'], ['prepayments', 'Prepayment']].forEach(function (k) {
      (sets[k[0]] || []).forEach(function (d) {
        if (!d || (sets.types && sets.types[k[0]] && d.Type !== sets.types[k[0]]) || (d.Status && d.Status !== 'AUTHORISED')) return;
        var x = doc(d, k[1], base); if (!x.amount || (asAt && x.date && x.date > asAt)) return; out.push(x);
      });
    });
    return out;
  }
  // Ageing buckets (Xero's Aged Receivables / Payables Summary): by due date (with Current = not yet due) or invoice date, n periods
  // of calendar months or of L days, then Older. Returns {cols:[{key,title}], bucket(doc)→index}.
  function ageingCols(asAt, by, n, len) {
    var cur0 = by !== 'inv', m = len === 'm' || !len, L = +len, A = parse(asAt), cols = [];
    if (cur0) cols.push({ key: 'b0', title: 'Current' });
    for (var i = 0; i < n; i++) cols.push({ key: 'b' + cols.length, title: m ? (i === 0 ? '< 1 Month' : i + ' Month' + (i > 1 ? 's' : '')) : cur0 ? (i * L + 1) + '–' + ((i + 1) * L) + ' days' : (i * L) + '–' + ((i + 1) * L - 1) + ' days' });
    cols.push({ key: 'b' + cols.length, title: 'Older' });
    return { cols: cols, current: cur0, bucket: function (d) {
      var ref = cur0 ? d.due : d.date; if (!ref) return cols.length - 1; if (cur0 && ref >= asAt) return 0;
      var R = parse(ref), k = m ? (A.getUTCFullYear() - R.getUTCFullYear()) * 12 + (A.getUTCMonth() - R.getUTCMonth()) : Math.floor((Math.round((A - R) / 86400000) - (cur0 ? 1 : 0)) / L);
      return (cur0 ? 1 : 0) + Math.max(0, Math.min(k, n));
    } };
  }
  // Group documents by contact with bucket totals: [{name, cid, b:[…], total, docs:[…]}] sorted by name.
  function byContact(docs, ag) {
    var map = {}, order = [], z = function () { return ag.cols.map(function () { return 0; }); }, r = function (v) { return Math.round(v * 100) / 100; };
    docs.forEach(function (d) { var k = d.cid || d.contact; if (!map[k]) { map[k] = { name: d.contact, cid: k, b: z(), total: 0, docs: [] }; order.push(k); } var x = map[k], j = ag.bucket(d); d.bucket = ag.cols[j].title; x.b[j] = r(x.b[j] + d.amount); x.total = r(x.total + d.amount); x.docs.push(d); });
    return order.map(function (k) { return map[k]; }).filter(function (x) { return Math.abs(x.total) >= 0.005 || x.b.some(function (v) { return Math.abs(v) >= 0.005; }); }).sort(function (a, b) { return a.name.localeCompare(b.name); });
  }
  // Pipeline (Sales / Purchases overview): counts and amounts by status. Awaiting payment = AUTHORISED with an amount due;
  // Overdue = those past their due date. Drafts and awaiting approval use the document total.
  function pipeline(list, asAt, base) {
    var st = { draft: { n: 0, v: 0, docs: [] }, approval: { n: 0, v: 0, docs: [] }, awaiting: { n: 0, v: 0, docs: [] }, overdue: { n: 0, v: 0, docs: [] } }, r = function (v) { return Math.round(v * 100) / 100; };
    (list || []).forEach(function (d) {
      var x = doc(d, 'Invoice', base), k = x.status === 'DRAFT' ? 'draft' : x.status === 'SUBMITTED' ? 'approval' : x.status === 'AUTHORISED' && x.amount ? 'awaiting' : null; if (!k) return;
      var v = k === 'awaiting' ? x.amount : x.total; st[k].n++; st[k].v = r(st[k].v + v); st[k].docs.push(x);
      if (k === 'awaiting' && x.due && x.due < asAt) { st.overdue.n++; st.overdue.v = r(st.overdue.v + v); st.overdue.docs.push(x); }
    });
    return st;
  }
  // ---------- P&L and Balance Sheet parts (by structure, column i) ----------
  // P&L: income = Σ income sections (trading + other), expenses = Σ 'Less …' / cost / expense sections, Xero's own GP / NP lines.
  function plParts(w, col) {
    var i = col || 0, tot = function (re) { var s = w.sections.filter(function (x) { return re.test(x.title); }); return s.length ? sum(s.map(function (x) { return sectionTotal(x, i); })) : null; };
    var calcL = function (re) { var l = find(w.lines, null, re, 'total'); return l ? l.values[i] : null; };
    var inc = sum(w.sections.filter(function (x) { return !isDeduction(x.title); }).map(function (x) { return sectionTotal(x, i); })), exp = sum(w.sections.filter(function (x) { return isDeduction(x.title); }).map(function (x) { return sectionTotal(x, i); }));
    var trading = tot(/^(trading )?income$|^revenue$|^sales$/i);
    return { income: inc, expenses: exp, trading: trading == null ? inc : trading, cos: tot(/cost of sales/i) || 0, otherIncome: tot(/^other income$/i) || 0, opex: tot(/operating expenses|^(less )?expenses$/i) || 0, otherExpenses: tot(/other expenses/i) || 0,
      gp: calcL(/^gross profit$/i), np: calcL(/^net (profit|loss)$/i) };
  }
  // Balance Sheet: bank, current assets (every asset section except fixed / non-current), AR, AP, current liabilities, totals, CYE.
  function bsParts(w, col) {
    var i = col || 0, rowV = function (re, grp) { var l = w.lines.filter(function (x) { return x.kind === 'row' && re.test(x.label) && (!grp || grp.test(x.group)); })[0]; return l ? l.values[i] : null; };
    var secs = function (parent, test) { return sum(w.sections.filter(function (x) { return x.parent && parent.test(x.parent) && test(x.title); }).map(function (x) { return sectionTotal(x, i); })); };
    var tl = function (re) { var l = find(w.lines, null, re, 'total'); return l ? l.values[i] : null; };
    var bank = w.sections.filter(function (x) { return /^bank$/i.test(x.title); })[0];
    return { bank: bank ? sectionTotal(bank, i) : null, bankRows: bank ? bank.rows.map(function (l) { return { label: l.label, value: l.values[i] }; }) : [],
      currentAssets: secs(/^assets$/i, function (t) { return !/fixed|non-current|non current/i.test(t); }), currentLiabilities: secs(/^liabilities$/i, function (t) { return /current/i.test(t) && !/non-current|non current/i.test(t); }),
      ar: rowV(/^accounts receivable$/i), ap: rowV(/^accounts payable$/i), gst: rowV(/^gst$|^gst (payable|liability)|^sales tax/i),
      totalAssets: tl(/^total assets$/i), totalLiabilities: tl(/^total liabilities$/i), netAssets: tl(/^net assets$/i), equity: (function () { var l = find(w.lines, 'Equity', null, 'total'); return l ? l.values[i] : null; })(),
      cye: (function () { var l = currentYearEarnings(w.lines); return l ? l.values[i] : null; })() };
  }
  // ---------- months ----------
  var MS3 = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  // Xero column header → 'YYYY-MM' ('30 Sep 2026', 'Sep 26', 'Sep 2026', 'September 2026'); null if not a month label.
  function monthKey(label) {
    var m = /([A-Za-z]{3})[a-z]*\.?\s+(\d{2,4})\b/.exec(String(label || '')); if (!m) return null;
    var mi = MS3.indexOf(m[1].toLowerCase()); if (mi < 0) return null; var y = +m[2]; if (y < 100) y += 2000;
    return y + '-' + String(mi + 1).padStart(2, '0');
  }
  function monthLabel(key) { var p = String(key).split('-'); return MON[+p[1] - 1].slice(0, 3) + ' ' + p[0]; }
  // The n months ending with the month of endIso, oldest first: [{key, start, end}]
  function monthsEnding(endIso, n) { var e = parse(endIso), out = []; for (var i = n - 1; i >= 0; i--) { var y = e.getUTCFullYear(), m = e.getUTCMonth() + 1 - i, s0 = D(y, m, 1); out.push({ key: s0.getUTCFullYear() + '-' + String(s0.getUTCMonth() + 1).padStart(2, '0'), start: iso(s0), end: iso(eom(s0.getUTCFullYear(), s0.getUTCMonth() + 1)) }); } return out; }
  // Monthly series from a report called with periods / timeframe MONTH (Xero returns the newest column first): columns
  // matched to months by their header label. Returns {keys:[oldest→newest], idx:{key→column}} or null when the columns are not months.
  function monthCols(w) { var keys = w.columns.map(monthKey); if (!keys.length || keys.some(function (k) { return !k; })) return null; var idx = {}; keys.forEach(function (k, i) { idx[k] = i; }); return { keys: keys.slice().sort(), idx: idx }; }
  // Xero where clause for a date window: 'Date>=DateTime(2026,07,01) AND Date<=DateTime(2026,09,30)'
  function dateWhere(field, from, to, extra) { var dt = function (s) { var p = String(s).split('-'); return 'DateTime(' + p[0] + ',' + p[1] + ',' + p[2] + ')'; }; return (extra ? extra + ' AND ' : '') + (from ? field + '>=' + dt(from) : '') + (from && to ? ' AND ' : '') + (to ? field + '<=' + dt(to) : ''); }

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
    var moneyFmt = '#,##0.00;(#,##0.00)'; // the library: #,##0.00 with negatives in brackets; the currency is in the header footnote
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
    var p = { from_date: v.start || null, to_date: v.end || null, as_at: v.asAt || null, accounting_basis: v.basis || null, xero_tenant_id: v.org || null,
      cents: d.cents ? 'shown' : 'hidden', divide_by_1000: d.k ? 'yes' : 'no', zero_rows: d.zeros ? 'shown' : 'hidden', negatives: d.neg, negatives_in_red: d.red ? 'yes' : 'no', header: d.hdr ? 'shown' : 'hidden', footer: d.ftr ? 'shown' : 'hidden' };
    Object.keys(p).forEach(function (k) { if (p[k] == null) delete p[k]; });
    return p;
  }

  // ---------- HTML helpers ----------
  function h(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function negCls(v, d) { return d && d.red && isNeg(v) ? ' neg' : ''; }
  function isZeroLine(l) { return l.kind === 'row' && !(l.values || []).some(function (v) { return v != null && Math.abs(v) >= 0.005; }); }
  // Statement grammar: rows in Xero's order, accounts indented under their section, bold totals and computed lines.
  // extraCols: optional [{title, value:function(line)->number|null, fmt:'money'|'pct'}] appended (e.g. $ change, % change, % of income).
  function statement(lines, colTitles, ctx, extraCols) {
    var d = ctx.display, cur = ctx.currency, ex = extraCols || [];
    var th = colTitles.concat(ex.map(function (e) { return e.title; }));
    var out = '<table class="xk-stmt"><thead><tr>' + th.map(function (t, i) { return '<th' + (i ? ' class="num"' : '') + ' scope="col">' + h(t) + '</th>'; }).join('') + '</tr></thead><tbody>';
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
  // Sortable + filterable list table. spec: {columns:[{key,title,num,money,fmt,html}], rows:[{}], total:{}|null, foot:[{}]|null (several footer rows), filter:bool, empty:string}
  function grid(el, spec, ctx) {
    var st = { key: null, dir: 1, q: '' };
    function draw() {
      var rows = spec.rows.filter(function (r) { if (!st.q) return true; var q = st.q.toLowerCase(); return spec.columns.some(function (c) { return String(r[c.key] == null ? '' : r[c.key]).toLowerCase().indexOf(q) >= 0; }); });
      if (st.key) rows = rows.slice().sort(function (a, b) { var x = a[st.key], y = b[st.key]; if (x == null) return 1; if (y == null) return -1; return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * st.dir; });
      function cell(c, r, tag) {
        var v = r[c.key], txt = c.fmt ? c.fmt(v, r) : c.money ? money(v, ctx.currency, ctx.display) : (v == null ? '' : v);
        return '<' + tag + ' class="' + (c.num || c.money ? 'num' : '') + (c.money ? negCls(v, ctx.display) : '') + '">' + (c.html ? txt : h(txt)) + '</' + tag + '>';
      }
      var html = (spec.filter && spec.rows.length > 8 ? '<input class="xk-filter" type="search" placeholder="Filter…" aria-label="Filter rows" value="' + h(st.q) + '">' : '') +
        '<div class="xk-scroll"><table class="xk-grid"><thead><tr>' + spec.columns.map(function (c) { return '<th scope="col" data-k="' + h(c.key) + '" class="' + (c.num || c.money ? 'num' : '') + '" aria-sort="' + (st.key === c.key ? (st.dir > 0 ? 'ascending' : 'descending') : 'none') + '">' + h(c.title) + (st.key === c.key ? (st.dir > 0 ? ' ▲' : ' ▼') : '') + '</th>'; }).join('') + '</tr></thead><tbody>' +
        (rows.length ? rows.map(function (r) { return '<tr>' + spec.columns.map(function (c) { return cell(c, r, 'td'); }).join('') + '</tr>'; }).join('') : '<tr><td colspan="' + spec.columns.length + '" class="muted">' + h(spec.empty || "Data appears once it's available.") + '</td></tr>') +
        '</tbody>' + ((spec.foot || (spec.total ? [spec.total] : [])).length ? '<tfoot>' + (spec.foot || [spec.total]).map(function (f) { return '<tr class="k-total">' + spec.columns.map(function (c) { return cell(c, f, 'td'); }).join('') + '</tr>'; }).join('') + '</tfoot>' : '') + '</table></div>';
      el.innerHTML = html;
      el.querySelectorAll('th[data-k]').forEach(function (thEl) { thEl.addEventListener('click', function () { var k = thEl.getAttribute('data-k'); st.dir = st.key === k ? -st.dir : 1; st.key = k; draw(); }); });
      var f = el.querySelector('.xk-filter'); if (f) f.addEventListener('input', function () { st.q = f.value; var pos = f.selectionStart; draw(); var g = el.querySelector('.xk-filter'); g.focus(); g.setSelectionRange(pos, pos); });
    }
    draw();
  }
  // ---------- SVG charts (no libraries; colours from CSS custom properties) ----------
  function scale(vals) { var mn = Math.min(0, Math.min.apply(null, vals)), mx = Math.max(0, Math.max.apply(null, vals)); if (mn === mx) mx = mn + 1; return { mn: mn, mx: mx }; }
  function legend(series) { return '<div class="xk-legend">' + series.map(function (s, i) { return '<span><i style="background:' + (s.color || 'var(--c' + (i + 1) + ')') + '"></i>' + h(s.name) + '</span>'; }).join('') + '</div>'; }
  // bars(el, {labels:[], series:[{name, values:[], tips:[]}], title, every, mark:{at, label}, fadeFrom}) — grouped bars, negatives below the
  // zero line; mark = a dashed divider (e.g. Today) whose label is always drawn; bars after fadeFrom are lighter (projected)
  function bars(el, o, ctx) {
    var W = 640, H = 220, P = 28, all = [], fmt = o.fmt || function (v) { return money(v, ctx.currency, ctx.display); };
    if (o.stacked) { o.labels.forEach(function (_, i) { var pos = 0, neg = 0; o.series.forEach(function (s) { var v = s.values[i] || 0; if (v >= 0) pos += v; else neg += v; }); all.push(pos, neg); }); }
    else o.series.forEach(function (s) { all = all.concat(s.values.filter(function (v) { return v != null; })); });
    if (!all.length) { el.innerHTML = '<p class="muted">Data appears once it\'s available.</p>'; return; }
    var sc = scale(all), n = o.labels.length, gw = (W - P * 2) / Math.max(n, 1), bw = Math.max(2, (gw * 0.7) / (o.stacked ? 1 : o.series.length)), stackP = [], stackN = [];
    function y(v) { return P + (H - P * 2) * (1 - (v - sc.mn) / (sc.mx - sc.mn)); }
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + h(o.title || 'Bar chart') + '"><line x1="' + P + '" x2="' + (W - P) + '" y1="' + y(0) + '" y2="' + y(0) + '" class="axis"/>';
    o.labels.forEach(function (lb, i) {
      o.series.forEach(function (s, j) { var v = s.values[i]; if (v == null) return; var base0 = 0; if (o.stacked) { var k = v >= 0 ? stackP : stackN; base0 = k[i] || 0; k[i] = base0 + v; }
        var x = P + gw * i + gw * 0.15 + (o.stacked ? 0 : bw * j), y0 = y(base0), y1 = y(base0 + v), fill = (s.colors && s.colors[i]) || s.color || 'var(--c' + (j + 1) + ')';
        svg += '<rect x="' + x.toFixed(1) + '" y="' + Math.min(y0, y1).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(1, Math.abs(y1 - y0)).toFixed(1) + '" fill="' + fill + '"' + (o.fadeFrom != null && i > o.fadeFrom ? ' fill-opacity="0.45" class="proj"' : '') + '><title>' + h(s.name + ' · ' + lb + ': ' + fmt(v) + (s.tips && s.tips[i] ? '\n' + s.tips[i] : '')) + '</title></rect>'; });
      var nearMark = o.mark && i !== o.mark.at && Math.abs(i - o.mark.at) < (o.every || 1) / 2;
      if (!nearMark && (n <= 16 || (o.every && i % o.every === 0) || (o.mark && i === o.mark.at))) svg += '<text x="' + (P + gw * i + gw / 2).toFixed(1) + '" y="' + (H - 8) + '" class="tick" text-anchor="middle">' + h(lb) + '</text>';
    });
    if (o.mark) { var mx = (P + gw * o.mark.at + gw / 2).toFixed(1); svg += '<line x1="' + mx + '" x2="' + mx + '" y1="' + (P - 6) + '" y2="' + (H - P + 4) + '" class="xk-mark" stroke="var(--ink)" stroke-dasharray="4 3" stroke-width="1"/><text x="' + mx + '" y="' + (P - 10) + '" class="tick" text-anchor="middle" font-weight="600">' + h(o.mark.label || '') + '</text>'; }
    el.innerHTML = svg + '</svg>' + legend(o.series);
  }
  // line(el, {labels, series:[{name, values}], area:bool, band:{low:[], high:[], name}, title})
  function line(el, o, ctx) {
    var W = 640, H = 220, P = 28, all = [], fmt = o.fmt || function (v) { return money(v, ctx.currency, ctx.display); }; o.series.forEach(function (s) { all = all.concat(s.values.filter(function (v) { return v != null; })); });
    if (o.band) all = all.concat(o.band.low.filter(function (v) { return v != null; }), o.band.high.filter(function (v) { return v != null; }));
    if (!all.length) { el.innerHTML = '<p class="muted">Data appears once it\'s available.</p>'; return; }
    var sc = scale(all), n = o.labels.length, step = (W - P * 2) / Math.max(n - 1, 1);
    function y(v) { return P + (H - P * 2) * (1 - (v - sc.mn) / (sc.mx - sc.mn)); }
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + h(o.title || 'Line chart') + '"><line x1="' + P + '" x2="' + (W - P) + '" y1="' + y(0) + '" y2="' + y(0) + '" class="axis"/>';
    o.series.forEach(function (s, j) {
      var pts = s.values.map(function (v, i) { return v == null ? null : (P + step * i).toFixed(1) + ',' + y(v).toFixed(1); }).filter(Boolean);
      if (j === 0 && o.band) { var up = [], dn = []; o.band.high.forEach(function (v, i) { if (v != null && o.band.low[i] != null) { up.push((P + step * i).toFixed(1) + ',' + y(v).toFixed(1)); dn.unshift((P + step * i).toFixed(1) + ',' + y(o.band.low[i]).toFixed(1)); } }); if (up.length) svg += '<polygon points="' + up.concat(dn).join(' ') + '" fill="var(--c2)" opacity=".16"><title>' + h(o.band.name || 'Range') + '</title></polygon>'; }
      if (o.area && j === 0 && pts.length) svg += '<polygon points="' + (P).toFixed(1) + ',' + y(0).toFixed(1) + ' ' + pts.join(' ') + ' ' + (P + step * (n - 1)).toFixed(1) + ',' + y(0).toFixed(1) + '" fill="var(--c1)" opacity=".18"/>';
      svg += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + (s.color || 'var(--c' + (j + 1) + ')') + '" stroke-width="2.5"' + (j ? ' stroke-dasharray="5 4"' : '') + '/>';
      s.values.forEach(function (v, i) { if (v != null) svg += '<circle cx="' + (P + step * i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="3" fill="var(--c' + (j + 1) + ')"><title>' + h(s.name + ' · ' + o.labels[i] + ': ' + fmt(v)) + '</title></circle>'; });
    });
    o.labels.forEach(function (lb, i) { if (n <= 13 || i % Math.ceil(n / 12) === 0) svg += '<text x="' + (P + step * i).toFixed(1) + '" y="' + (H - 8) + '" class="tick" text-anchor="middle">' + h(lb) + '</text>'; });
    el.innerHTML = svg + '</svg>' + legend(o.series) + (o.band ? '<div class="xk-legend"><span><i style="background:var(--c2);opacity:.3"></i>' + h(o.band.name || 'Range') + '</span></div>' : '');
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
    el.innerHTML = '<div class="xk-donut">' + svg + '<text x="100" y="106" text-anchor="middle" class="donut-c">' + h(o.centre || '') + '</text></svg><ul>' +
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
    return '<div class="xk-kpis">' + items.map(function (k) {
      var v = k.text != null ? h(k.text) : k.money === false ? h(k.value == null ? 'N/A' : k.value) : (k.value == null ? 'N/A — not in source' : money(k.value, ctx.currency, ctx.display));
      var chip = k.delta == null || !isFinite(k.delta) ? '' : '<span class="chip ' + (k.delta >= 0 ? 'up' : 'down') + '">' + (k.delta >= 0 ? '▲ ' : '▼ ') + pct(Math.abs(k.delta), 0) + '</span>';
      return '<div class="xk-kpi"><div class="lbl">' + h(k.label) + '</div><div class="val' + (k.red ? ' neg' : negCls(k.value, ctx.display)) + '">' + v + '</div>' + chip + (k.sub ? '<div class="sub">' + h(k.sub) + '</div>' : '') + '</div>';
    }).join('') + '</div>';
  }

  // ---------- the report controller ----------
  // cfg: {title, token, route, kind:'period'|'asat', inputs:{start,end,asAt,basis,columnsBy,cmpStart,cmpEnd,cmpAsAt,org,persona,display}, defaults:{<declared>:value},
  //       uses:{bindingId:[declared input names]}, primary:'bindingId', org:'org' (get_organisation binding), conns:'connections' (list_connections binding), fyMonth, tools:{bindingId:'tool name'},
  //       columnsBy:[[value,label]], compare:true, enums:[{input,label,options:[[v,l]]}], views:[[key,label]], render(ctx)->{checks,na,notes,title,period}, excel(ctx)->[sheets]}
  var FRIENDLY = { needs_connection: 'Connect Xero (Settings → Connections) to see this data.', connection_unavailable: 'Xero is temporarily unavailable — press Refresh to try again.', tool_not_found: 'This Xero report is not available on the connected connector.', tool_error: 'Xero returned an error for this section.', invalid_inputs: 'One of the report controls has an invalid value.' };
  var MECHANISM = 'xero-accounting connector — mySMB custom MCP on the Xero Accounting API (AGT-001)';
  function app(cfg) {
    var MH = window.MyHubReport, live = !!(MH && MH.mode !== 'snapshot');
    var I = cfg.inputs || {}, S = { inputs: Object.assign({}, cfg.defaults), data: {}, errors: {}, fetchedAt: null, first: true, busy: 0, pages: {}, trunc: {} };
    var $ = function (id) { return document.getElementById(id); };
    function disp() { return readDisplay(I.display ? S.inputs[I.display] : ''); }
    function setDisp(patch) { if (!I.display) return; var d = disp(), k; for (k in patch) d[k] = patch[k]; S.inputs[I.display] = writeDisplay(d); }
    function co() { return companyOf(S.data[cfg.org], S.data[cfg.conns], I.org ? S.inputs[I.org] : '', (reportOf(S.data[cfg.primary]) || {}).ReportTitles); }
    function fy() { var e = +disp().fy; if (e >= 1 && e <= 12) return { month: e % 12 + 1, source: 'set in this report — year ends ' + MONTHS[e - 1], set: true }; return fiscalStart(co().org, cfg.fyMonth); }
    // An {__error} object (if a proxy returns one) moves to S.errors so every section and check treats it as a failed source.
    function absorb(id, v) { var e = errorOf(v); S.pages[id] = null; S.trunc[id] = false; if (e) { delete S.data[id]; S.errors[id] = { code: 'tool_error', message: e }; } else { S.data[id] = v; delete S.errors[id]; } }
    function srcOf(id) { return (cfg.sources || {})[id] || null; }
    function quiet(id) { var sc = srcOf(id); return !!(sc && sc.quiet && sc.quiet(Object.assign({}, S.inputs))); }
    function err(id) { var e = S.errors[id], sc = srcOf(id); if (!e) return null; if (e.code === 'needs_connection' && sc) return sc.name + ' is not connected — add the ' + sc.name + ' extension and connect it (Settings → Connections) to include this.'; return (FRIENDLY[e.code] || e.message || 'Unavailable') + (e.code === 'tool_error' && e.message ? ' (' + e.message + ')' : ''); }
    function announce() { if (MH && live) MH.setInputs(Object.assign({}, S.inputs)); }
    function status(t) { var el = $('xk-status'); if (el) el.textContent = t || ''; }
    // Xero allows 5 calls in progress per organisation and the host opens every binding at once, so a report with more
    // bindings can get HTTP 429 on some. Those are re-requested one at a time (3 rounds, backing off) before they count as failed.
    var RATE = /\b429\b|rate.?limit|too many requests/i;
    function limited() { return Object.keys(S.errors).filter(function (id) { var e = S.errors[id]; return e && RATE.test(String(e.message || '')); }); }
    function fetchOne(id, inputs) {
      S.req = S.req || {}; var tok = S.req[id] = (S.req[id] || 0) + 1, latest = function () { return S.req[id] === tok; }; // a slower, older reload never overwrites a newer one
      return MH.getData(id, inputs).then(function (v) { if (latest()) absorb(id, v); }, function (e) { if (latest()) S.errors[id] = { code: (e && e.code) || 'tool_error', message: (e && e.message) || String(e) }; });
    }
    function retryLimited(round) {
      var ids = limited(); if (!MH || !live || !ids.length || round > 3) return Promise.resolve(false);
      S.busy++; status('Xero is busy — loading ' + ids.length + ' more section' + (ids.length > 1 ? 's' : '') + '…');
      var inputs = Object.assign({}, S.inputs), wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
      return ids.reduce(function (p, id) { return p.then(function () { return wait(round * (cfg.retryMs == null ? 700 : cfg.retryMs)); }).then(function () { return fetchOne(id, inputs); }); }, Promise.resolve())
        .then(function () { S.busy--; status(''); S.fetchedAt = new Date().toISOString(); render(); return retryLimited(round + 1); });
    }
    // Xero lists return 100 rows per page. cfg.paged = { bindingId: { input: 'page', key: 'Invoices', max: 20 } }: after the first
    // page arrives, the kit fetches the next pages one at a time (never announced) until a page is short or the cap is hit.
    function pageAll() {
      var P = cfg.paged || {}, ids = Object.keys(P).filter(function (id) { return S.data[id] && !S.pages[id]; });
      if (!MH || !live || !ids.length) return Promise.resolve(false);
      S.busy++;
      return ids.reduce(function (p, id) { return p.then(function () { return more(id); }); }, Promise.resolve())
        .then(function () { S.busy--; status(''); render(); return true; });
    }
    function more(id) {
      var P = cfg.paged[id], size = P.size || 100, max = P.max || 20, got = S.pages[id] = [S.data[id]], first = S.data[id], tries = 0;
      var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
      function step() {
        if (S.data[id] !== first) return Promise.resolve(); // replaced by a newer load
        var rows = (got[got.length - 1] || {})[P.key] || [];
        if (rows.length < size) return Promise.resolve();
        if (got.length >= max) { S.trunc[id] = true; return Promise.resolve(); }
        var inp = Object.assign({}, S.inputs); inp[P.input] = got.length + 1;
        status('Loading ' + ((cfg.tools || {})[id] || id) + ' — page ' + (got.length + 1) + '…');
        return MH.getData(id, inp).then(function (v) {
          if (errorOf(v)) throw new Error(errorOf(v));
          if (S.data[id] === first) { got.push(v); tries = 0; } return step();
        }, function (e) {
          var msg = (e && e.message) || String(e);
          if (RATE.test(msg) && tries++ < 3) return wait(tries * (cfg.retryMs == null ? 700 : cfg.retryMs)).then(step);
          if (S.data[id] === first) { S.trunc[id] = true; S.pageError = S.pageError || {}; S.pageError[id] = msg; }
        });
      }
      return step();
    }
    function fanAll() {
      var F = cfg.fan || {}, ids = Object.keys(F); if (!MH || !live || !ids.length) return Promise.resolve(false);
      S.fan = S.fan || {}; var c = ctx(), jobs = [];
      ids.forEach(function (id) { var list = F[id](Object.assign({}, S.inputs), c) || [], sig = JSON.stringify([S.inputs[I.org] || '', list]); if (S.fan[id] && S.fan[id].sig === sig) return; var st = S.fan[id] = { sig: sig, items: list.map(function (x) { return { key: x.key, value: null, error: null, done: false }; }) }; list.forEach(function (x, i) { jobs.push({ id: id, st: st, i: i, inputs: Object.assign({}, S.inputs, x.inputs) }); }); });
      if (!jobs.length) return Promise.resolve(false);
      var conc = cfg.fanConc || 2, next = 0, wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
      S.busy++; status('Loading ' + jobs.length + ' more figures from Xero…');
      function run(j, tries) { return MH.getData(j.id, j.inputs).then(function (v) { var e = errorOf(v); j.st.items[j.i].value = e ? null : v; j.st.items[j.i].error = e; j.st.items[j.i].done = true; }, function (e) { var msg = (e && e.message) || String(e); if (RATE.test(msg) && tries < 3) return wait((tries + 1) * (cfg.retryMs == null ? 700 : cfg.retryMs)).then(function () { return run(j, tries + 1); }); j.st.items[j.i].error = msg; j.st.items[j.i].done = true; }); }
      function worker() { if (next >= jobs.length) return Promise.resolve(); var j = jobs[next++]; return run(j, 0).then(worker); }
      var ws = []; for (var k = 0; k < conc; k++) ws.push(worker());
      return Promise.all(ws).then(function () { S.busy--; status(''); render(); return true; });
    }
    function fan(id) { var st = (S.fan || {})[id]; if (!st || !live) return null; return st.items.every(function (x) { return x.done; }) ? st.items : null; }
    function rows(id) { var P = (cfg.paged || {})[id] || {}, list = S.pages[id] || (S.data[id] ? [S.data[id]] : []), out = []; list.forEach(function (v) { ((v && v[P.key]) || []).forEach(function (r) { out.push(r); }); }); return out; }
    function truncated(id) { var P = (cfg.paged || {})[id]; if (!P || !S.data[id]) return false; if (S.trunc[id]) return true; return !live && (((S.data[id] || {})[P.key] || []).length >= (P.size || 100)); }
    function requery(changed) {
      if (!MH || !live) { render(); return Promise.resolve(); } // snapshot: display-only inputs still redraw
      var ids = Object.keys(cfg.uses || {}).filter(function (id) { return !changed || (cfg.uses[id] || []).some(function (n) { return changed.indexOf(n) >= 0; }); });
      if (!ids.length) { render(); return Promise.resolve(); }
      S.busy++; status('Loading…'); var inputs = Object.assign({}, S.inputs);
      return Promise.all(ids.map(function (id) { return fetchOne(id, inputs); }))
        .then(function () {
          S.fetchedAt = new Date().toISOString(); S.busy--; status('');
          var roll = rollPresets(); if (roll) return change(roll); // e.g. another organisation's financial year moves 'This financial year to date'
          var hl = heal(); if (hl) return hl; // figures for other dates than the controls show → refetch once at the controls' dates
          render(); return retryLimited(1).then(pageAll).then(fanAll);
        });
    }
    function change(patch, dispPatch) {
      var changed = [], k; S.healed = false;
      for (k in patch) if (k && S.inputs[k] !== patch[k]) { S.inputs[k] = patch[k]; changed.push(k); }
      if (dispPatch) setDisp(dispPatch);
      if (cfg.derive) { var dv = cfg.derive(Object.assign({}, S.inputs), fy().month, disp()) || {}; for (k in dv) if (S.inputs[k] !== dv[k]) { S.inputs[k] = dv[k]; changed.push(k); } }
      var d = disp();
      if (cfg.compare && d.c !== 'none' && d.c !== 'periods') { // keep the comparison window aligned with the main window ('periods' is the report's fan)
        if (I.cmpStart && I.start) { var c = compare(S.inputs[I.start], S.inputs[I.end], d.c, fy().month); if (S.inputs[I.cmpStart] !== c.start || S.inputs[I.cmpEnd] !== c.end) { S.inputs[I.cmpStart] = c.start; S.inputs[I.cmpEnd] = c.end; changed.push(I.cmpStart, I.cmpEnd); } }
        if (I.cmpAsAt && I.asAt) { var ca = compareAsAt(S.inputs[I.asAt], d.c); if (S.inputs[I.cmpAsAt] !== ca) { S.inputs[I.cmpAsAt] = ca; changed.push(I.cmpAsAt); } }
      }
      announce();
      if (changed.length) return requery(changed);
      render(); return fanAll(); // a view change may need figures only that view uses (cfg.fan)
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
    // In snapshot mode the embedded data carries its own period: read it from the primary Xero report's title.
    function adoptHeader() {
      var r = reportOf(S.data[cfg.primary]); if (live || !r) return;
      var ds = titleDates((r.ReportTitles || []).slice(2).join(' '));
      if (I.start && ds.length >= 2) { S.inputs[I.start] = ds[0]; if (I.end && cfg.headerEnd !== false) S.inputs[I.end] = ds[1]; }
      if (I.asAt && ds.length) S.inputs[I.asAt] = ds[ds.length - 1];
    }
    // Bindings whose Xero report title must name the selected dates (cfg.dated, default [cfg.primary]).
    function stale() {
      var want = I.start ? [S.inputs[I.start], S.inputs[I.end]] : I.asAt ? [S.inputs[I.asAt]] : null; if (!want) return [];
      return (cfg.dated || [cfg.primary]).filter(function (id) {
        var r = reportOf(S.data[id]); if (!r) return false;
        var ds = titleDates((r.ReportTitles || []).slice(2).join(' ')); if (!ds.length) return false;
        return want.length === 2 ? (ds.length >= 2 ? !(ds[0] === want[0] && ds[ds.length - 1] === want[1]) : ds[0] !== want[1]) : ds[ds.length - 1] !== want[0]; // a title with one date is compared on the end date
      }).map(function (id) { var r = reportOf(S.data[id]); return { id: id, title: String((r.ReportTitles || []).slice(2).join(' ')) }; });
    }
    function dateKeys() { return Object.keys(S.inputs).filter(function (k) { return k !== I.org && k !== I.persona && k !== I.display && k !== I.basis; }); }
    function heal() { if (!live || S.healed || !stale().length) return null; S.healed = true; return requery(dateKeys()); }
    function optv(id) { var o = (cfg.options || []).filter(function (x) { return x.id === id; })[0], m = new RegExp('(?:^|;)' + id + '=([^;]*)').exec(disp().o || ''); return m ? m[1] : o ? o.def : null; }
    function setOpt(id, v) { var kv = {}; String(disp().o || '').split(';').forEach(function (p) { var i = p.indexOf('='); if (i > 0) kv[p.slice(0, i)] = p.slice(i + 1); }); kv[id] = v; return Object.keys(kv).map(function (k) { return k + '=' + kv[k]; }).join(';'); }
    function opt(list, cur) { return list.map(function (o) { return '<option value="' + h(o[0]) + '"' + (String(o[0]) === String(cur) ? ' selected' : '') + '>' + h(o[1]) + '</option>'; }).join(''); }
    function controls() {
      var el = $('xk-controls'); if (!el) return; var d = disp(), c0 = co(), dis = live ? '' : ' disabled', x = '';
      if (I.org && c0.orgs.length > 1) x += '<label class="ctl">Organisation<select id="xk-client"' + dis + ' title="The Xero organisations this connection can access — one organisation per report.">' + opt(c0.orgs.map(function (f) { return [f.id, f.name || f.id]; }), S.inputs[I.org] || c0.active || '') + '</select></label>';
      else x += '<label class="ctl">Organisation<select id="xk-client" title="The Xero organisation this connection uses."><option>' + h(c0.name || 'Connected Xero organisation') + '</option></select></label>';
      if (I.start) x += '<label class="ctl">Report period<select id="xk-preset"' + dis + '>' + opt(cfg.presets || PRESETS, d.p) + '</select></label><label class="ctl">From<input type="date" id="xk-from" value="' + h(S.inputs[I.start]) + '"' + dis + '></label><label class="ctl">To<input type="date" id="xk-to" value="' + h(S.inputs[I.end]) + '"' + dis + '></label>';
      if (I.asAt) x += '<label class="ctl">As at<select id="xk-asat-preset"' + dis + '>' + opt(cfg.asats || ASAT, d.a) + '</select></label><label class="ctl">Date<input type="date" id="xk-asat" value="' + h(S.inputs[I.asAt]) + '"' + dis + '></label>';
      if (I.basis) x += '<fieldset class="ctl seg"' + dis + '><legend>Accounting method</legend>' + ['Cash', 'Accrual'].map(function (b) { return '<label><input type="radio" name="xk-basis" value="' + b + '"' + (S.inputs[I.basis] === b ? ' checked' : '') + dis + '>' + b + '</label>'; }).join('') + '</fieldset>';
      if (I.columnsBy && cfg.columnsBy) x += '<label class="ctl">Display columns by<select id="xk-cols"' + dis + '>' + opt(cfg.columnsBy, S.inputs[I.columnsBy]) + '</select></label>';
      var xfy = fiscalStart(c0.org, cfg.fyMonth), xend = ((xfy.month + 10) % 12) + 1;
      x += '<label class="ctl">Year end<select id="xk-fy"' + dis + ' title="The month the financial year ends — from the organisation\'s Xero settings unless you change it">' + opt([['', 'Xero (' + MONTHS[xend - 1] + ')']].concat(MONTHS.map(function (m, i) { return [String(i + 1), m]; })), d.fy || '') + '</select></label>';
      if (cfg.compare) x += '<label class="ctl">Compare to<select id="xk-cmp"' + dis + '>' + opt(cfg.compareModes || (I.asAt ? [['none', 'None'], ['prev_period', 'Previous month end'], ['prev_year', 'Previous year']] : [['none', 'None'], ['prev_period', 'Previous period'], ['prev_year', 'Previous year'], ['ytd', 'Year-to-date']]), d.c) + '</select></label>';
      (cfg.enums || []).forEach(function (e, i) { var rq = Object.keys(cfg.uses || {}).some(function (id) { return (cfg.uses[id] || []).indexOf(e.input) >= 0; }); x += '<label class="ctl">' + h(e.label) + '<select id="xk-enum-' + i + '"' + (rq ? dis : '') + '>' + opt(e.options, S.inputs[e.input]) + '</select></label>'; });
      if (cfg.views) x += '<label class="ctl">Report<select id="xk-view">' + opt(cfg.views, d.v || cfg.views[0][0]) + '</select></label>';
      (cfg.options || []).forEach(function (o) { if (o.when && !o.when(d)) return; x += '<label class="ctl">' + h(o.label) + '<select id="xk-opt-' + h(o.id) + '"' + (o.title ? ' title="' + h(o.title) + '"' : '') + '>' + opt(o.options, optv(o.id)) + '</select></label>'; });
      if (I.persona || cfg.personaDisplay) x += '<label class="ctl">View as<select id="xk-persona">' + opt([['Client', 'Client'], ['Bookkeeper', 'Bookkeeper'], ['Practitioner', 'Practitioner'], ['Executive', 'Executive']], I.persona ? S.inputs[I.persona] : d.pv || 'Bookkeeper') + '</select></label>';
      x += '<details class="ctl customise"><summary>Customise</summary><div class="cz">' +
        '<label><input type="checkbox" id="xk-cents"' + (d.cents ? ' checked' : '') + '> Show cents</label><label><input type="checkbox" id="xk-k"' + (d.k ? ' checked' : '') + '> Divide by 1000</label>' +
        '<label><input type="checkbox" id="xk-zeros"' + (d.zeros ? '' : ' checked') + '> Except zero amounts</label><label>Negative numbers<select id="xk-neg">' + opt([['minus', '-100'], ['paren', '(100)'], ['trail', '100-']], d.neg) + '</select></label>' +
        '<label><input type="checkbox" id="xk-red"' + (d.red ? ' checked' : '') + '> Show in red</label><label><input type="checkbox" id="xk-hdr"' + (d.hdr ? ' checked' : '') + '> Header</label><label><input type="checkbox" id="xk-ftr"' + (d.ftr ? ' checked' : '') + '> Footer</label>' +
        '<label>View<select id="xk-dens">' + opt([['compact', 'Compact'], ['100', '100%']], d.dens) + '</select></label>' +
        '<label>Branding<select id="xk-branding" title="Xero branding (default) or the mySMB Reporting template — display only, the data does not change">' + opt([['xero', 'Xero'], ['mysmb', 'mySMB']], d.style === 'mysmb' ? 'mysmb' : 'xero') + '</select></label>' +
        '<label>Brand colour<input type="color" id="xk-brand" value="' + h(HEX.test(d.b) ? d.b : '#13b5ea') + '"></label><label>&nbsp;<button type="button" id="xk-brand-reset"' + (HEX.test(d.b) ? '' : ' disabled') + '>Use Xero branding</button></label></div></details>';
      x += '<div class="ctl btns"><button type="button" id="xk-pdf">Download PDF</button><button type="button" id="xk-xlsx">Download Excel</button>' + '</div>';
      el.innerHTML = x; wire();
    }
    function on(id, ev, fn) { var e = $(id); if (e) e.addEventListener(ev, fn); }
    function wire() {
      on('xk-client', 'change', function () { if (!I.org) return; var p = {}; p[I.org] = this.value; change(p); });
      on('xk-preset', 'change', function () { var k = this.value, r = preset(k, fy().month), p = {}; if (r) { p[I.start] = r.start; p[I.end] = r.end; } change(p, { p: k }); });
      on('xk-from', 'change', function () { var p = {}; p[I.start] = this.value; change(p, { p: 'custom' }); });
      on('xk-to', 'change', function () { var p = {}; p[I.end] = this.value; change(p, { p: 'custom' }); });
      on('xk-asat-preset', 'change', function () { var k = this.value, a = asAt(k, fy().month), p = {}; if (a) p[I.asAt] = a; change(p, { a: k }); });
      on('xk-asat', 'change', function () { var p = {}; p[I.asAt] = this.value; change(p, { a: 'custom' }); });
      document.querySelectorAll('input[name="xk-basis"]').forEach(function (r) { r.addEventListener('change', function () { var p = {}; p[I.basis] = this.value; change(p); }); });
      on('xk-cols', 'change', function () { var p = {}; p[I.columnsBy] = this.value; change(p); });
      on('xk-cmp', 'change', function () { change({}, { c: this.value }); });
      on('xk-fy', 'change', function () { setDisp({ fy: this.value }); change(rollPresets() || {}, {}); }); // financial-year presets follow the new year end
      (cfg.enums || []).forEach(function (e, i) { on('xk-enum-' + i, 'change', function () { var p = {}; p[e.input] = this.value; change(p); }); });
      on('xk-view', 'change', function () { change({}, { v: this.value }); });
      (cfg.options || []).forEach(function (o) { on('xk-opt-' + o.id, 'change', function () { change({}, { o: setOpt(o.id, this.value) }); }); });
      on('xk-persona', 'change', function () { if (!I.persona) return change({}, { pv: this.value }); var p = {}; p[I.persona] = this.value; change(p); });
      [['xk-cents', 'cents'], ['xk-k', 'k'], ['xk-red', 'red'], ['xk-hdr', 'hdr'], ['xk-ftr', 'ftr']].forEach(function (c) { on(c[0], 'change', function () { var p = {}; p[c[1]] = this.checked ? 1 : 0; change({}, p); }); });
      on('xk-zeros', 'change', function () { change({}, { zeros: this.checked ? 0 : 1 }); });
      on('xk-neg', 'change', function () { change({}, { neg: this.value }); });
      on('xk-dens', 'change', function () { change({}, { dens: this.value }); });
      on('xk-branding', 'change', function () { change({}, { style: this.value }); });
      on('xk-brand', 'change', function () { if (HEX.test(this.value)) change({}, { b: this.value.toLowerCase() }); });
      on('xk-brand-reset', 'click', function () { change({}, { b: '' }); });
      on('xk-pdf', 'click', function () { window.print(); });
      on('xk-xlsx', 'click', function () { exportXlsx(); });
    }
    function ctx() {
      var d = disp(), c0 = co(), f = fy();
      return { data: S.data, errors: S.errors, err: err, inputs: S.inputs, I: I, display: d, view: d.v || (cfg.views ? cfg.views[0][0] : ''), compareMode: cfg.compare ? d.c : 'none',
        persona: I.persona ? S.inputs[I.persona] : cfg.personaDisplay ? d.pv || 'Bookkeeper' : 'Bookkeeper', company: c0.name, organisation: c0, fy: f, currency: homeCurrency(c0.org), live: live,
        fetchedAt: S.fetchedAt, source: srcOf, body: $('xk-body'), change: change, disp: disp, today: iso(today()), opt: optv, setOpt: function (id, v) { return change({}, { o: setOpt(id, v) }); }, rows: rows, truncated: truncated, fan: fan, pageError: function (id) { return (S.pageError || {})[id] || null; } };
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
      try { out = cfg.render(c) || {}; } catch (e) { if (c.body) c.body.innerHTML = '<p class="xk-err">This report could not render: ' + h(e.message) + '</p>'; out = { checks: [{ name: 'Report rendered', pass: false, detail: e.message }] }; }
      last = { checks: out.checks || [], na: out.na || [], notes: out.notes || [] };
      stale().forEach(function (x) { last.checks.unshift({ name: 'Xero report dates = the selected dates', pass: false, detail: (cfg.tools || {})[x.id] + ' returned "' + x.title + '" — press Refresh' }); });
      // Not connected: always say so at the top of the report, whichever view is showing.
      var nc = Object.keys(S.errors).some(function (id) { return S.errors[id] && S.errors[id].code === 'needs_connection' && !srcOf(id); });
      if (nc && c.body && c.body.textContent.indexOf(FRIENDLY.needs_connection) < 0) { var dv = document.createElement('div'); dv.className = 'xk-banner fail'; dv.textContent = FRIENDLY.needs_connection; c.body.insertBefore(dv, c.body.firstChild); }
      // A failed data source is never silent: it turns the banner red even when the report's own checks still pass.
      Object.keys(S.errors).forEach(function (id) {
        if (id === cfg.conns && S.data[cfg.org]) return; // the organisation list is only needed for the picker
        if (quiet(id)) return; // an optional source that isn't in use
        var msg = err(id);
        if (last.checks.some(function (k) { return k.pass === false && k.detail === msg; })) return;
        var sc = srcOf(id); last.checks.unshift({ name: 'Data loaded: ' + ((cfg.tools || {})[id] || id), pass: sc && sc.optional ? null : false, detail: msg });
      });
      var hd = $('xk-head');
      if (hd) { hd.hidden = !d.hdr || !!cfg.noHead; var per = out.period || (I.start ? periodLine(S.inputs[I.start], S.inputs[I.end]) : I.asAt ? asOfLine(S.inputs[I.asAt]) : ''); hd.innerHTML = '<div class="ti">' + h(out.title || cfg.title) + '</div><div class="co">' + h(c.company || 'N/A — not in source') + '</div><div class="pe">' + h(per) + '</div><div class="xk-src">' + (d.style === 'mysmb' ? '<span class="xk-badge">mySMB</span>mySMB Reporting · data from Xero' : '<span class="xk-badge">Xero</span>Prepared from Xero') + '</div>'; }
      var ft = $('xk-foot'); if (ft) { ft.hidden = !d.ftr; var stamp = footerStamp(basisOf(), S.fetchedAt, c.currency); ft.textContent = d.style === 'mysmb' ? [c.company || 'Xero organisation', out.title || cfg.title, stamp].join(' | ') : stamp; }
      banner(c); sources(c);
    }
    function banner(c) {
      var el = $('xk-banner'); if (!el) return; var ch = last.checks, isInfo = function (k) { return !!k.info; }, fails = ch.filter(function (k) { return k.pass === false; }), done = ch.filter(function (k) { return k.pass === true; });
      var nInfo = ch.filter(isInfo).length, nNA = ch.filter(function (k) { return k.pass == null && !isInfo(k); }).length, real = ch.length - nInfo;
      var none = !fails.length && !done.length && ch.length > 0; // nothing could be checked: say so, never a green tick
      // information lines and N/A checks are listed but not counted in 'x/y passed', so a clean report never reads as a failure
      var extra = (nNA ? ' · ' + nNA + ' N/A' : '') + (nInfo ? ' · ' + nInfo + ' for information' : '');
      el.className = 'xk-banner ' + (fails.length ? 'fail' : none ? 'na' : 'pass');
      el.innerHTML = '<strong>' + (fails.length ? '⚠ Validation: ' + fails.length + ' check' + (fails.length > 1 ? 's' : '') + ' failed' + (done.length ? ' · ' + done.length + ' passed' : '') + extra :
        none ? (real ? '– Validation: no check could run (' + nNA + ' N/A' + (nInfo ? ' · ' + nInfo + ' for information' : '') + ')' : 'ℹ Validation: ' + nInfo + ' line' + (nInfo > 1 ? 's' : '') + ' for information') :
        '✓ Validation: ' + done.length + '/' + done.length + ' check' + (done.length > 1 ? 's' : '') + ' passed' + extra) + '</strong>' +
        ' · Data as of ' + h(S.fetchedAt ? new Date(S.fetchedAt).toLocaleString('en-AU') : '—') + (live ? '' : ' · Snapshot: figures frozen at capture time') +
        ' · Financial year starts ' + h(MONTHS[c.fy.month - 1]) + ' (' + h(c.fy.source) + ')' +
        '<ul>' + ch.map(function (k) { return '<li class="' + (k.pass === false ? 'bad' : k.pass === true ? 'ok' : isInfo(k) ? 'na info' : 'na') + '">' + (k.pass === false ? '✗ ' : k.pass === true ? '✓ ' : isInfo(k) ? 'ℹ ' : '– ') + h(k.name) + (k.detail ? ' — ' + h(k.detail) : '') + '</li>'; }).join('') + '</ul>';
    }
    function basisOf() { return I.basis ? S.inputs[I.basis] : cfg.basisLabel || (cfg.noBasis ? null : 'Accrual'); }
    function sources(c) {
      var el = $('xk-sources'); if (!el) return; var t = cfg.tools || {};
      var items = Object.keys(t).map(function (id) { var sc = srcOf(id); return h(t[id]) + (S.errors[id] && !quiet(id) ? ' — <span class="' + (sc && sc.optional ? 'muted' : 'xk-err') + '">' + h(err(id)) + '</span>' : ''); });
      var na = last.na.slice(); if (!c.company) na.unshift('Organisation name (Xero returned no organisation details)');
      el.innerHTML = '<h2>Sources &amp; limitations</h2><ul><li>Mechanism: ' + h(cfg.mechanism || MECHANISM) + '</li><li>Tool calls: ' + items.join(' · ') + '</li>' +
        '<li>Basis: ' + h(basisOf() || 'n/a') + ' · Currency: ' + h(c.currency) + ' (the organisation\'s base currency — Xero\'s reports have no other presentation currency) · Organisation: ' + h(c.company || 'N/A — not in source') + ' (one Xero organisation per report)</li>' +
        (/^assumed/.test(c.fy.source) ? '<li>Financial year: ' + h(c.fy.source) + ' (starts ' + h(MONTHS[c.fy.month - 1]) + '). Adjust the dates if this organisation uses a different year.</li>' : '') +
        last.notes.map(function (n) { return '<li>' + h(n) + '</li>'; }).join('') +
        (na.length ? '<li>N/A — not in source: ' + na.map(h).join('; ') + '</li>' : '') + '<li>Decision support only — not audit, tax or legal advice.</li></ul>';
    }
    function exportXlsx() {
      var c = ctx(), sheets = [];
      try { sheets = (cfg.excel && cfg.excel(c)) || []; } catch (e) { sheets = [{ name: 'Error', rows: [['Excel export failed: ' + e.message]] }]; }
      var foot = [basisOf() ? basisOf() + ' basis' : null, c.currency].filter(Boolean).join(' · ');
      sheets.forEach(function (sh) { // report sheets open with [organisation], [report name], [period], [] — reorder to the library's header block
        var r = sh.rows || [], a = r[0] && r[0][0], b = r[1] && r[1][0];
        if (!a || !b || a.s !== 'title' || b.s !== 'bold') return;
        r[0] = [{ v: b.v, s: 'title' }]; r[1] = [{ v: a.v, s: 'bold' }];
        if (r[3] && !r[3].length) r[3] = [{ v: foot, s: 'muted' }];
      });
      sheets.push({ name: 'Validation', rows: [[{ v: 'Check', s: 'bold' }, { v: 'Result', s: 'bold' }, { v: 'Detail', s: 'bold' }]].concat(last.checks.map(function (k) { return [k.name, k.pass === true ? 'Pass' : k.pass === false ? 'FAIL' : 'N/A', k.detail || '']; })), widths: [60, 10, 60] });
      var pr = reportParams({ start: I.start && S.inputs[I.start], end: I.end && S.inputs[I.end], asAt: I.asAt && S.inputs[I.asAt], basis: I.basis && S.inputs[I.basis], org: I.org && (S.inputs[I.org] || c.organisation.active || ''), display: c.display });
      sheets.push({ name: 'Parameters', rows: [[{ v: 'Parameter', s: 'bold' }, { v: 'Value', s: 'bold' }]].concat(Object.keys(pr).map(function (k) { return [k, String(pr[k])]; })).concat([['basis', basisOf() || 'n/a'], ['currency', c.currency], [], ['Data as of', S.fetchedAt || ''], ['Source', cfg.mechanism || MECHANISM]]), widths: [28, 60] });
      var name = [(c.company || 'Xero'), cfg.title, (I.start ? S.inputs[I.start] + ' to ' + S.inputs[I.end] : I.asAt ? 'as at ' + S.inputs[I.asAt] : '')].filter(Boolean).join(' - ').replace(/[\\\/:*?"<>|]+/g, ' ');
      download(xlsx(sheets, c.currency), name + '.xlsx');
    }
    function boot(bundle) {
      S.data = {}; S.errors = Object.assign({}, bundle.errors || {}); S.fetchedAt = bundle.fetchedAt || null;
      Object.keys(bundle.data || {}).forEach(function (id) { if (!S.errors[id]) absorb(id, bundle.data[id]); });
      adoptHeader(); status('');
      if (S.first) { S.first = false; var roll = rollPresets(); if (roll) { change(roll); return; } announce(); if (heal()) return; }
      render(); retryLimited(1).then(pageAll).then(fanAll);
    }
    if (!MH) { status('Open this report in mySMB to load Xero data.'); return { state: S }; }
    MyHubReport.onData(function (bundle) { window.__reportStarted = true; boot(bundle); });
    if (MH.onRefresh) MH.onRefresh(function () { status('Refreshing…'); });
    if (MH.onThemeChange) MH.onThemeChange(function () { render(); });
    return { state: S, change: change, render: render, exportXlsx: exportXlsx, ctx: ctx, retryLimited: retryLimited };
  }

  return { doc: doc, openDocs: openDocs, ageingCols: ageingCols, byContact: byContact, pipeline: pipeline, plParts: plParts, bsParts: bsParts, monthKey: monthKey, monthLabel: monthLabel, shortDate: shortDate, monthsEnding: monthsEnding, monthCols: monthCols, dateWhere: dateWhere, addDaysIso: function (s, k) { return iso(addDays(parse(s), k)); },
    errorOf: errorOf, isoDate: isoDate, reportOf: reportOf, walk: walk, isDeduction: isDeduction, sectionTotal: sectionTotal, sectionBy: sectionBy, parentTies: parentTies, runningTies: runningTies,
    CYE_RE: CYE_RE, currentYearEarnings: currentYearEarnings, linesTies: linesTies, orgOf: orgOf, connections: connections, companyOf: companyOf, fiscalStart: fiscalStart, homeCurrency: homeCurrency, titleDates: titleDates,
    applyBrand: applyBrand, fyStartOf: function (isoDate, m) { return iso(fyStartOf(parse(isoDate), m)); }, compareCols: compareCols, h: h, statement: statement, grid: grid, bars: bars, line: line, donut: donut, waterfall: waterfall, kpis: kpis, app: app,
    MONTHS: MONTHS, iso: iso, parse: parse, eom: eom, addDays: addDays, num: num, find: find, val: val, totalFor: totalFor, near: near, sum: sum, symbol: symbol,
    DISPLAY_DEFAULT: DISPLAY_DEFAULT, readDisplay: readDisplay, writeDisplay: writeDisplay, money: money, pct: pct, isNeg: isNeg,
    PRESETS: PRESETS, preset: preset, ASAT: ASAT, asAt: asAt, compare: compare, periodLine: periodLine, rangeLabel: rangeLabel, asOfLine: asOfLine, footerStamp: footerStamp, freshest: freshest,
    xlsx: xlsx, sheetFromLines: sheetFromLines, download: download, reportParams: reportParams };
})();
if (typeof module !== 'undefined') module.exports = XK;
