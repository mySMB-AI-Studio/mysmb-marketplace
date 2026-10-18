---
name: MYOB Exceptions Dashboard
description: MYOB Exceptions Dashboard (M59) as a live, validated report in MYOB styling. Use when the user asks for the exceptions dashboard, a review before BAS or month-end, data-quality checks, whether receivables or payables reconcile, future-dated or prepaid transactions, or tax code exceptions.
---
# Exceptions Dashboard (M59)

Use when the user asks for the exceptions dashboard, a review before BAS or month-end, data-quality checks, whether receivables or payables reconcile, future-dated or prepaid transactions, or tax code exceptions. Load `myob-report-foundation` first and follow its *Build a kit report* steps. Report title: **MYOB Exceptions Dashboard**. Template: `myob-reporting-studio` / `exceptions-dashboard` (for `artifact_from_template`); without that tool, copy the blocks below — do not rewrite them. This skill needs the `myob-accounting` connector (`list_invoices`, `list_bills`, `get_balance_sheet`, `list_accounts`, `list_journal_transactions`, `list_tax_codes`, `list_company_files`).

MYOB location: Reporting → Exceptions dashboard. Library: MYOB Reports Prompt Library v1.2 → Prompts → M59. Delivery: Wave 1 (P1, delivery order 9).

## Discovery call

Call `list_invoices` once with `status` = `Open`, and `list_company_files` once. A `{"__error": …}` result is a failed call: report its message.

## Date defaults

`from_date` / `to_date` = the review period (default: the financial year to date; display preset `p` = `this_fy_td`, `this_month`, `last_month`, `this_quarter`, `last_quarter`, `last_fy` or `custom`). `as_at` and `day_after` are set by the kit — leave them (the reconciliations use today's open balances; future dated means dated after today).

## Members

| Member / view | How |
|---|---|
| Transaction review | Receivables and Payables reconciliation exceptions (open documents today vs the control accounts), Future dated transactions (dated after today), Prepaid transactions (paid before their own date) |
| Tax review | Tax amount variance: line tax codes when MYOB returns invoice lines, otherwise tax above the GST rate or totals that don't add up |
| Tax code exceptions (invoice transactions) | Lines whose tax code is not the account's default — when MYOB returns invoice lines; otherwise N/A |
| Tax code exceptions (cash transactions) | N/A — the connector has no spend money / receive money list |
| Readiness and dollarised risk | Checks passed ÷ 7, and Σ the exception amounts |

## Validation checks (shown in the banner)

- **Independent tie:** receivables — open invoices today = the receivables account on the Balance Sheet
- **Independent tie:** payables — open bills today = the payables account on the Balance Sheet
- Future dated, prepaid and tax checks each list their exceptions with amounts
- A check whose data the connector does not have shows N/A with the reason, never a pass

## Save as

`fileName`: `myob-exceptions-dashboard.html` · `tags`: ["myob","exceptions-dashboard","M59","review"]

## QA test script (golden set)

1. On the golden-set file, ask for this report at the library's example period; confirm the discovery call succeeded and the report saved.
2. Compare the headline figures: mySMB.com, 1 Jul – 9 Sep 2026: Receivables reconciliation exceptions ✓ · Payables reconciliation exceptions ✓ · Future dated / Prepaid / Tax amount variance / Tax code exceptions — no exceptions flagged.
3. Validation banner: every check passes (the independent tie included), or shows N/A with a stated reason.
4. Change every control and confirm the report refetches and still validates; switch View as to Client, then Bookkeeper; toggle Style and the dark theme.
5. Download PDF and Download Excel and confirm they match the screen (the Excel file has Validation and Parameters sheets).
6. Download or Share from the report window: the snapshot keeps the period and figures and disables the refetching controls.
7. Cross-client isolation (LIB-002): the saved report and every export carry only this company file's figures and name.

## dataBindings

```json
{
  "inputs": [
    {
      "name": "from_date",
      "label": "From",
      "type": "date",
      "default": "2026-07-01"
    },
    {
      "name": "to_date",
      "label": "To",
      "type": "date",
      "default": "today"
    },
    {
      "name": "as_at",
      "label": "Today",
      "type": "date",
      "default": "today"
    },
    {
      "name": "day_after",
      "label": "The day after today",
      "type": "date",
      "default": "2026-09-29"
    },
    {
      "name": "company_file",
      "label": "Company file",
      "type": "string",
      "maxLength": 64,
      "default": ""
    },
    {
      "name": "persona",
      "label": "View as",
      "type": "enum",
      "options": [
        "Client",
        "Bookkeeper",
        "Practitioner",
        "Executive"
      ],
      "default": "Bookkeeper"
    },
    {
      "name": "display",
      "label": "Display settings",
      "type": "string",
      "maxLength": 300,
      "default": "{\"cents\":1,\"k\":0,\"zeros\":0,\"neg\":\"paren\",\"red\":1,\"hdr\":1,\"ftr\":1,\"style\":\"myob\",\"dens\":\"100\",\"p\":\"this_fy_td\",\"a\":\"today\",\"c\":\"none\",\"v\":\"\"}"
    }
  ],
  "bindings": [
    {
      "id": "inv_open",
      "tool": {
        "mcp": "myob-accounting",
        "name": "list_invoices"
      },
      "params": {
        "status": {
          "kind": "static",
          "value": "Open"
        },
        "myob_company_file_id": {
          "kind": "input",
          "input": "company_file"
        }
      }
    },
    {
      "id": "bills_open",
      "tool": {
        "mcp": "myob-accounting",
        "name": "list_bills"
      },
      "params": {
        "status": {
          "kind": "static",
          "value": "Open"
        },
        "myob_company_file_id": {
          "kind": "input",
          "input": "company_file"
        }
      }
    },
    {
      "id": "bs",
      "tool": {
        "mcp": "myob-accounting",
        "name": "get_balance_sheet"
      },
      "params": {
        "date": {
          "kind": "input",
          "input": "as_at"
        },
        "reporting_basis": {
          "kind": "static",
          "value": "Accrual"
        },
        "myob_company_file_id": {
          "kind": "input",
          "input": "company_file"
        }
      }
    },
    {
      "id": "accounts",
      "tool": {
        "mcp": "myob-accounting",
        "name": "list_accounts"
      },
      "params": {
        "myob_company_file_id": {
          "kind": "input",
          "input": "company_file"
        }
      }
    },
    {
      "id": "inv_period",
      "tool": {
        "mcp": "myob-accounting",
        "name": "list_invoices"
      },
      "params": {
        "status": {
          "kind": "static",
          "value": "All"
        },
        "from_date": {
          "kind": "input",
          "input": "from_date"
        },
        "to_date": {
          "kind": "input",
          "input": "to_date"
        },
        "myob_company_file_id": {
          "kind": "input",
          "input": "company_file"
        }
      }
    },
    {
      "id": "bills_period",
      "tool": {
        "mcp": "myob-accounting",
        "name": "list_bills"
      },
      "params": {
        "status": {
          "kind": "static",
          "value": "All"
        },
        "from_date": {
          "kind": "input",
          "input": "from_date"
        },
        "to_date": {
          "kind": "input",
          "input": "to_date"
        },
        "myob_company_file_id": {
          "kind": "input",
          "input": "company_file"
        }
      }
    },
    {
      "id": "journals_after",
      "tool": {
        "mcp": "myob-accounting",
        "name": "list_journal_transactions"
      },
      "params": {
        "from_date": {
          "kind": "input",
          "input": "day_after"
        },
        "to_date": {
          "kind": "static",
          "value": "2099-12-31"
        },
        "myob_company_file_id": {
          "kind": "input",
          "input": "company_file"
        }
      }
    },
    {
      "id": "tax_codes",
      "tool": {
        "mcp": "myob-accounting",
        "name": "list_tax_codes"
      },
      "params": {
        "myob_company_file_id": {
          "kind": "input",
          "input": "company_file"
        }
      }
    },
    {
      "id": "company_files",
      "tool": {
        "mcp": "myob-accounting",
        "name": "list_company_files"
      },
      "params": {}
    }
  ]
}
```

## Report config ({{CFG}})

```js
MK.app({
  title: 'Exceptions Dashboard', primary: 'bs', files: 'company_files', optional: ['tax_codes'],
  inputs: { start: 'from_date', end: 'to_date', companyFile: 'company_file', persona: 'persona', display: 'display' },
  defaults: { from_date: '2026-07-01', to_date: '2026-09-28', as_at: '2026-09-28', day_after: '2026-09-29', company_file: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"myob","dens":"100","p":"this_fy_td","a":"today","c":"none","v":""}' },
  uses: { inv_open: ['company_file'], bills_open: ['company_file'], bs: ['as_at', 'company_file'], accounts: ['company_file'], inv_period: ['from_date', 'to_date', 'company_file'], bills_period: ['from_date', 'to_date', 'company_file'], journals_after: ['day_after', 'company_file'], tax_codes: ['company_file'], company_files: [] },
  tools: { inv_open: 'list_invoices (open sales invoices today — every page)', bills_open: 'list_bills (open purchase bills today — every page)', bs: 'get_balance_sheet (the receivables and payables accounts today)', accounts: 'list_accounts (account types and default tax codes)', inv_period: 'list_invoices (sales invoices dated in the period)', bills_period: 'list_bills (purchase bills dated in the period)', journals_after: 'list_journal_transactions (transactions dated after today)', tax_codes: 'list_tax_codes (tax rates)', company_files: 'list_company_files' },
  // the reconciliations use today's open balances (MYOB's API has no earlier ones); future dated = dated after today
  roll: function () { return { as_at: MK.asAt('today') }; },
  derive: function (inp) { return { day_after: MK.iso(MK.addDays(MK.parse(inp.as_at), 1)) }; },
  render: function (c) {
    var body = c.body, money = function (v) { return MK.money(v, c.currency, c.display); }, r2 = function (v) { return Math.round(v * 100) / 100; }, h = MK.h, from = c.inputs.from_date, to = c.inputs.to_date, asAt = c.inputs.as_at;
    if (['inv_open', 'bills_open', 'bs', 'inv_period', 'bills_period', 'journals_after'].some(function (id) { return !c.data[id] && !c.errors[id]; })) return {};
    var idx = MK.accounts(c.data.accounts), num = function (v) { return MK.num(v) || 0; }, bsb = c.data.bs ? MK.breakdown([c.data.bs], idx, MK.BS_LAYOUT) : null;
    var ctl = function (type, re) { var l = bsb ? bsb.rows.filter(function (r) { return !r.header && (r.type === type || (!idx.loaded && re.test(r.name))); }) : []; return { rows: l, total: l.length ? MK.sum(l.map(function (r) { return r.values[0]; })) : null }; };
    var rates = {}; MK.items(c.data.tax_codes).forEach(function (t) { if (t && t.Code) rates[t.Code] = { rate: (MK.num(t.Rate) || 0) / 100, uid: t.UID }; if (t && t.UID) rates[t.UID] = rates[t.Code]; });
    var gstRate = Math.max.apply(null, [0.1].concat(Object.keys(rates).map(function (k) { return rates[k].rate; }).filter(function (r) { return r <= 0.15; })));
    var src = function (id) { return c.errors[id] ? { na: c.err(id) } : null; };
    // 1, 2: open documents today vs the control account(s) on the Balance Sheet today — two MYOB sources
    var recon = function (id, type, re, party) {
      var bad = src(id) || (c.errors.bs ? { na: c.err('bs') } : null); if (bad) return bad;
      var docs = MK.items(c.data[id]), open = MK.sum(docs.map(function (x) { return num(x.BalanceDueAmount); })), cl = ctl(type, re);
      if (cl.total == null) return { na: 'N/A — no ' + (type === 'AccountReceivable' ? 'receivables' : 'payables') + ' account in the chart of accounts' };
      var oob = r2(open - cl.total); return { n: MK.near(oob, 0) ? 0 : 1, amt: Math.abs(oob), items: MK.near(oob, 0) ? [] : [{ what: 'Open ' + party + ' ' + money(open) + ' − ' + cl.rows.map(function (r) { return (r.code ? r.code + ' ' : '') + r.name; }).join(', ') + ' ' + money(cl.total), amount: oob }], note: money(open) + ' vs ' + money(cl.total) };
    };
    var R = { rec: recon('inv_open', 'AccountReceivable', /receivable|debtors/i, 'invoices'), pay: recon('bills_open', 'AccountsPayable', /payable|creditors/i, 'bills') };
    // 3: transactions dated after today
    R.fut = src('journals_after') || (function () { var l = MK.items(c.data.journals_after).map(function (t) { return { what: (MK.isoDate(t.DateOccurred) || '') + ' · ' + (t.DisplayID || '') + ' · ' + (t.JournalType || '') + ' · ' + (t.Description || ''), amount: MK.sum((t.Lines || []).filter(function (x) { return !x.IsCredit; }).map(function (x) { return Math.abs(num(x.Amount)); })) }; }); return { n: l.length, amt: MK.sum(l.map(function (x) { return x.amount; })), items: l }; })();
    // the period's documents (sales invoices and purchase bills dated in the period)
    var docs = [], dsrc = [['inv_period', 'Invoice', 'Customer'], ['bills_period', 'Bill', 'Supplier']].filter(function (s) { return !c.errors[s[0]]; });
    dsrc.forEach(function (s) { MK.items(c.data[s[0]]).forEach(function (x) { var dt = MK.isoDate(x.Date); if (!dt || dt < from || dt > to) return; docs.push({ kind: s[1], number: x.Number || '', who: (x[s[2]] || {}).Name || '', date: dt, x: x }); }); });
    var docErr = c.errors.inv_period || c.errors.bills_period ? c.err(c.errors.inv_period ? 'inv_period' : 'bills_period') : null, label = function (dc) { return dc.kind + ' ' + dc.number + ' · ' + dc.date + ' · ' + dc.who; };
    // 4: prepaid — paid (in part or full) by a payment dated before the document's own date
    var paid = docs.filter(function (dc) { return num(dc.x.TotalAmount) - num(dc.x.BalanceDueAmount) > 0.004; }), haveDates = paid.some(function (dc) { return dc.x.LastPaymentDate !== undefined; });
    R.pre = docErr ? { na: docErr } : paid.length && !haveDates ? { na: 'N/A — MYOB returned no payment dates on the invoices and bills' } : (function () { var l = paid.filter(function (dc) { var lp = MK.isoDate(dc.x.LastPaymentDate); return lp && lp < dc.date; }).map(function (dc) { return { what: label(dc) + ' · paid ' + MK.isoDate(dc.x.LastPaymentDate), amount: r2(num(dc.x.TotalAmount) - num(dc.x.BalanceDueAmount)) }; }); return { n: l.length, amt: MK.sum(l.map(function (x) { return x.amount; })), items: l }; })();
    // 5: tax amount variance — line level when MYOB returns lines with tax codes, else document level (more tax than GST allows, or totals that don't add up)
    var withLines = docs.filter(function (dc) { return (dc.x.Lines || []).some(function (l) { return l && l.TaxCode && (l.TaxCode.Code || l.TaxCode.UID); }); });
    R.tav = docErr ? { na: docErr } : (function () { var l = [];
      docs.forEach(function (dc) { var x = dc.x, incl = !!x.IsTaxInclusive, base = num(x.Subtotal) + num(x.Freight), tax = num(x.TotalTax), exp, why;
        var lines = (x.Lines || []).filter(function (y) { return y && y.TaxCode && rates[y.TaxCode.Code || y.TaxCode.UID]; });
        if (lines.length) { exp = r2(MK.sum(lines.map(function (y) { var rt = rates[y.TaxCode.Code || y.TaxCode.UID].rate, t = num(y.Total); return incl ? t * rt / (1 + rt) : t * rt; }))); if (Math.abs(tax - exp) > 0.01 * (lines.length + 1)) why = 'tax ' + money(tax) + ' vs ' + money(exp) + ' from its lines\' tax codes'; }
        else { var max = r2(incl ? base * gstRate / (1 + gstRate) : base * gstRate); if (tax > max + 0.02) why = 'tax ' + money(tax) + ' is more than GST on ' + money(base) + ' (' + money(max) + ')'; exp = max; }
        if (!why && Math.abs(base + (incl ? 0 : tax) - num(x.TotalAmount)) > 0.01) why = 'subtotal ' + (incl ? '' : '+ tax ') + '≠ total (' + money(num(x.TotalAmount)) + ')';
        if (why) l.push({ what: label(dc) + ' · ' + why, amount: r2(Math.abs(tax - (exp == null ? tax : exp))) }); });
      return { n: l.length, amt: MK.sum(l.map(function (x) { return x.amount; })), items: l, note: withLines.length ? 'line tax codes on ' + withLines.length + ' document(s)' : 'document level (the invoice list has no lines)' }; })();
    // 6: no spend / receive money list in the connector
    R.tcc = { na: 'N/A — the MYOB connector has no list of spend money and receive money transactions' };
    // 7: invoice and bill lines whose tax code is not their account's default tax code
    R.tci = docErr ? { na: docErr } : !withLines.length ? { na: 'N/A — the connector\'s invoice and bill lists carry no lines with tax codes' } : (function () { var l = [];
      withLines.forEach(function (dc) { (dc.x.Lines || []).forEach(function (y) { if (!y || !y.TaxCode || !y.Account) return; var a = (y.Account.UID && idx.byUid[y.Account.UID]) || (y.Account.DisplayID && idx.byCode[y.Account.DisplayID]), def = a && a.TaxCode ? (a.TaxCode.Code || a.TaxCode.UID) : null, used = y.TaxCode.Code || y.TaxCode.UID;
        if (def && used !== def) l.push({ what: label(dc) + ' · ' + (y.Account.DisplayID || y.Account.Name || '') + ' uses ' + used + ' (account default ' + def + ')', amount: Math.abs(num(y.Total)) }); }); });
      return { n: l.length, amt: MK.sum(l.map(function (x) { return x.amount; })), items: l }; })();
    var DEF = [['Transaction review', [['rec', 'Receivables reconciliation exceptions', 'Open invoices today vs the receivables account on the Balance Sheet'], ['pay', 'Payables reconciliation exceptions', 'Open bills today vs the payables account on the Balance Sheet'], ['fut', 'Future dated transactions', 'Transactions dated after today'], ['pre', 'Prepaid transactions', 'Invoices and bills in the period paid before their own date']]],
      ['Tax review', [['tav', 'Tax amount variance', 'Invoices and bills in the period whose tax differs from their tax codes'], ['tcc', 'Tax code exceptions (cash transactions)', 'Spend and receive money with a tax code other than the account\'s default'], ['tci', 'Tax code exceptions (invoice transactions)', 'Invoice and bill lines with a tax code other than the account\'s default']]]];
    var all = []; DEF.forEach(function (g) { g[1].forEach(function (k) { all.push({ key: k[0], name: k[1], desc: k[2], r: R[k[0]] }); }); });
    var passed = all.filter(function (k) { return !k.r.na && !k.r.n; }).length, avail = all.filter(function (k) { return !k.r.na; }).length, risk = MK.sum(all.map(function (k) { return k.r.na ? 0 : k.r.amt || 0; }));
    var cell = function (k) { return k.r.na ? '<span class="muted">' + h(k.r.na) + '</span>' : !k.r.n ? '<span class="chip up">✓</span>' : '<a href="#ex-' + k.key + '"><span class="chip down">' + k.r.n + '</span> ' + money(k.r.amt) + '</a>'; };
    var ring = function (p, n) { var R0 = 34, C = 2 * Math.PI * R0, f = n ? p / n : 0; return '<svg viewBox="0 0 90 90" style="width:110px;height:110px" role="img" aria-label="' + p + ' of ' + n + ' checks passed"><circle cx="45" cy="45" r="' + R0 + '" fill="none" stroke="var(--line)" stroke-width="10"/><circle cx="45" cy="45" r="' + R0 + '" fill="none" stroke="var(--pos)" stroke-width="10" stroke-dasharray="' + (C * f).toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 45 45)"/><text x="45" y="50" text-anchor="middle" class="donut-c">' + p + '/' + n + '</text></svg>'; };
    var run = c.fetchedAt ? new Date(c.fetchedAt) : null, ranAt = run ? run.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }).replace(/\s/g, '').toLowerCase() + ' ' + run.getDate() + ' ' + MK.MONTHS[run.getMonth()].slice(0, 3) + ' ' + run.getFullYear() : '—';
    body.innerHTML = '<div class="mk-dash"><div class="mk-card"><h3>Readiness</h3>' + ring(passed, all.length) + '<p class="muted">' + passed + ' of ' + all.length + ' checks passed' + (all.length - avail ? ' · ' + (all.length - avail) + ' not available' : '') + '</p></div>' +
      '<div class="mk-card"><h3>Dollarised risk</h3><div class="mk-big' + (risk ? ' neg' : '') + '">' + money(risk) + '</div><p class="muted">Σ the exception amounts</p></div>' +
      '<div class="mk-card"><h3>Review</h3><p>' + h(MK.periodLine(from, to)) + '</p><p class="muted">Last review run at ' + h(ranAt) + '</p><p class="btns"><button type="button" id="ex-run"' + (c.live ? '' : ' disabled') + '>Run review</button></p></div></div>' +
      DEF.map(function (g) { return '<div class="mk-card" style="margin-top:12px"><h3>' + h(g[0]) + '</h3><div class="mk-scroll"><table class="mk-grid"><thead><tr><th scope="col">Check</th><th scope="col">Exceptions</th><th scope="col">Description</th></tr></thead><tbody>' +
        g[1].map(function (k) { var x = all.filter(function (y) { return y.key === k[0]; })[0]; return '<tr><td>' + (x.r.n ? '<a href="#ex-' + x.key + '">' + h(x.name) + '</a>' : h(x.name)) + '</td><td>' + cell(x) + '</td><td class="muted">' + h(x.desc) + (x.r.note ? ' · ' + h(x.r.note) : '') + '</td></tr>'; }).join('') + '</tbody></table></div></div>'; }).join('') +
      all.filter(function (k) { return k.r.n; }).map(function (k) { return '<div class="mk-card detail-block" id="ex-' + k.key + '" style="margin-top:12px"><h3>' + h(k.name) + ' (' + k.r.n + ')</h3><div id="ex-g-' + k.key + '"></div></div>'; }).join('');
    all.filter(function (k) { return k.r.n; }).forEach(function (k) { MK.grid(document.getElementById('ex-g-' + k.key), { rows: k.r.items.slice(0, 2000), filter: true, columns: [{ key: 'what', title: 'Exception' }, { key: 'amount', title: 'Amount ($)', money: true }], total: { what: 'Total', amount: k.r.amt } }, c); });
    var rb = document.getElementById('ex-run'); if (rb) rb.addEventListener('click', function () { c.rerun(); });
    var checks = all.map(function (k) { return k.r.na ? { name: k.name, pass: null, detail: k.r.na } : { name: k.name + (k.key === 'rec' || k.key === 'pay' ? ' (open documents vs the Balance Sheet — two MYOB sources)' : ''), pass: !k.r.n, detail: k.r.n ? k.r.n + ' exception' + (k.r.n > 1 ? 's' : '') + ', ' + money(k.r.amt) : (k.r.note || 'none') }; });
    this._x = { all: all, passed: passed, risk: risk };
    return { checks: checks, notes: ['Receivables and payables are reconciled on today\'s open balances (MYOB\'s API has no earlier ones); future dated means dated after today; the other checks cover invoices and bills dated in the period.', 'Readiness = checks passed ÷ 7; dollarised risk = Σ the exception amounts.'],
      na: ['Tax code exceptions on spend and receive money (not in the connector)'].concat(withLines.length ? [] : ['Line-level tax codes on invoices and bills (not in the connector\'s lists)']) };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var rows = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Exceptions dashboard', s: 'bold' }], [MK.periodLine(c.inputs.from_date, c.inputs.to_date)], [], ['Check', 'Exceptions', 'Amount ($)', 'Result'].map(function (t) { return { v: t, s: 'bold' }; })]
      .concat(x.all.map(function (k) { return [k.name, k.r.na ? 'N/A' : k.r.n, k.r.na ? '' : { v: k.r.amt || 0, s: 'money' }, k.r.na ? k.r.na : k.r.n ? 'Exceptions' : 'Pass']; }))
      .concat([[], [{ v: 'Readiness', s: 'bold' }, x.passed + ' of ' + x.all.length], [{ v: 'Dollarised risk', s: 'bold' }, '', { v: x.risk, s: 'moneyBold' }]]);
    var det = [['Check', 'Exception', 'Amount ($)'].map(function (t) { return { v: t, s: 'bold' }; })]; x.all.forEach(function (k) { (k.r.items || []).forEach(function (i) { det.push([k.name, i.what, { v: i.amount, s: 'money' }]); }); });
    return [{ name: 'Exceptions dashboard', rows: rows, widths: [44, 12, 16, 60] }, { name: 'Exceptions', rows: det, widths: [40, 80, 16] }];
  }
});
```
