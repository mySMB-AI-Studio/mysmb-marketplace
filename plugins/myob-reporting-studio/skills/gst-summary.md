---
name: MYOB GST Summary (BAS)
description: MYOB GST Summary (BAS) (M06) as a live, validated report in MYOB styling. Use when the user asks for a GST report, GST summary, GST return, BAS, activity statement, GST payable or refund, GST by tax code, or BAS labels (G1, 1A, 1B, W1, W2) for a period.
---
# GST Summary (BAS) (M06)

Use when the user asks for a GST report, GST summary, GST return, BAS, activity statement, GST payable or refund, GST by tax code, or BAS labels (G1, 1A, 1B, W1, W2) for a period. Load `myob-report-foundation` first and follow its *Build a kit report* steps. Report title: **MYOB GST Summary (BAS)**. Template: `myob-reporting-studio` / `gst-summary` (for `artifact_from_template`); without that tool, copy the blocks below — do not rewrite them. This skill needs the `myob-accounting` connector (`get_gst_summary`, `list_tax_codes`, `get_payroll_category_summary`, `list_journal_transactions`, `list_accounts`, `list_company_files`).

MYOB location: Reporting → Reports → Business → GST report / GST return; Reporting → BAS. Library: MYOB Reports Prompt Library v1.2 → Prompts → M06. Delivery: Wave 1 (P1) — M06, with M07 GST return and M61 BAS.

## Discovery call

Call `get_gst_summary` once for the period (`reporting_basis` = `Accrual` unless asked for cash), `list_tax_codes` once and `list_company_files` once. Expect `{StartDate, EndDate, ReportingBasis, TaxCodeBreakdown:[{SalesTotal, PurchasesTotal, TaxCollected, TaxPaid, TaxRate, TaxCode{UID,Code}}]}` — GST-inclusive totals per tax code and **no BAS labels** (MYOB's API has no link from codes to labels). `get_payroll_category_summary` gives W1 / W2 (it may be missing on older connectors — then W1 / W2 are N/A). A `{"__error": …}` result is a failed call: report its message.

## Date defaults

`from_date` / `to_date` = the BAS period (default: last quarter — display preset `p` = `last_quarter`; `this_quarter`, `last_month`, `this_month` or `custom`). `basis` = `Accrual` or `Cash` (the client's GST accounting basis). The view is display `v`: `bas` (activity statement, default), `return` (GST return labels and the mapping) or `codes` (GST report by tax code). `bas_map` holds the client's tax code → BAS label mapping (default `G2=EXP;G3=FRE;G4=ITS;G10=CAP;X=N-T`) — change it only when the user gives their mapping.

## Members

| Member / view | How |
|---|---|
| BAS (activity statement) | G1, G2, G3, G10, G11, 1A, 1B; PAYG W1 / W2; summary 8A, 8B and 9 (payable or refund) — marked Draft, check before lodging |
| GST return (BAS labels) | Report = GST return: G1–G12 worksheet with the codes behind each label, and the editable mapping for this client |
| GST report by tax code | Report = GST report by tax code: GST-inclusive sales and purchases, GST collected and paid, net, per code |
| Simpler BAS | G1, 1A and 1B on the BAS view |
| G7 / G18 adjustments, G13–G15, fuel tax credits, PAYG instalments (T7), lodging | N/A — not in MYOB's API (MYOB's AI BAS and lodgement are in its app only) |

## Validation checks (shown in the banner)

- MYOB returned the requested period (the tax code summary echoes the dates)
- Each tax code's GST = its rate on its GST-inclusive amounts (a file whose totals exclude GST is detected and grossed up)
- G1 covers G2 + G3 + G4 (G6 not negative)
- **Independent (information):** 1A − 1B = the GST accounts' movement in the period's journals, BAS payments (journals with only GST and bank lines) left out — accrual basis
- Codes left out of the BAS (N-T, non-GST taxes) listed with their amounts

## Save as

`fileName`: `myob-gst-summary-bas.html` · `tags`: ["myob","gst","bas","M06","M07","M61","tax"]

## QA test script (golden set)

1. On the golden-set file, ask for this report at the library's example period; confirm the discovery call succeeded and the report saved.
2. Compare the headline figures: mySMB.com: the Dashboard's GST line (2-1212 GST Balance) for the same period; MYOB GST return for the quarter.
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
      "default": "2026-09-30"
    },
    {
      "name": "basis",
      "label": "Accounting method",
      "type": "enum",
      "options": [
        "Accrual",
        "Cash"
      ],
      "default": "Accrual"
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
      "default": "{\"cents\":1,\"k\":0,\"zeros\":0,\"neg\":\"paren\",\"red\":0,\"hdr\":1,\"ftr\":1,\"style\":\"myob\",\"dens\":\"100\",\"p\":\"last_quarter\",\"a\":\"custom\",\"c\":\"none\",\"v\":\"bas\"}"
    },
    {
      "name": "bas_map",
      "label": "BAS label mapping (tax codes)",
      "type": "string",
      "maxLength": 160,
      "default": "G2=EXP;G3=FRE;G4=ITS;G10=CAP;X=N-T"
    }
  ],
  "bindings": [
    {
      "id": "gst",
      "tool": {
        "mcp": "myob-accounting",
        "name": "get_gst_summary"
      },
      "params": {
        "from_date": {
          "kind": "input",
          "input": "from_date"
        },
        "to_date": {
          "kind": "input",
          "input": "to_date"
        },
        "reporting_basis": {
          "kind": "input",
          "input": "basis"
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
      "id": "payroll",
      "tool": {
        "mcp": "myob-accounting",
        "name": "get_payroll_category_summary"
      },
      "params": {
        "from_date": {
          "kind": "input",
          "input": "from_date"
        },
        "to_date": {
          "kind": "input",
          "input": "to_date"
        },
        "reporting_basis": {
          "kind": "input",
          "input": "basis"
        },
        "myob_company_file_id": {
          "kind": "input",
          "input": "company_file"
        }
      }
    },
    {
      "id": "journals",
      "tool": {
        "mcp": "myob-accounting",
        "name": "list_journal_transactions"
      },
      "params": {
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
// GST Summary (BAS) — M06 GST report by tax code, M07 GST return, M61 BAS (activity statement).
// MYOB's tax code summary gives GST-inclusive sales / purchases and the tax per code; MYOB's API has no link from codes to BAS labels,
// so the labels come from a default mapping on the ATO's definitions (editable per client, kept in bas_map):
//   G1 = every reportable sale; G2 / G3 / G4 = the export / GST-free / input-taxed codes; G10 = the capital codes; G11 = every other
//   reportable purchase; 1A / 1B = the GST collected / paid; X = codes left out (N-T). W1 / W2 come from MYOB's payroll categories.
var GST_MAP_DEFAULT = 'G2=EXP;G3=FRE;G4=ITS;G10=CAP;X=N-T';
MK.app({
  title: 'GST Summary (BAS)', primary: 'gst', files: 'company_files', optional: ['tax_codes', 'payroll', 'journals', 'accounts'],
  inputs: { start: 'from_date', end: 'to_date', basis: 'basis', companyFile: 'company_file', persona: 'persona', display: 'display' },
  defaults: { from_date: '2026-07-01', to_date: '2026-09-30', basis: 'Accrual', company_file: '', persona: 'Bookkeeper', bas_map: GST_MAP_DEFAULT,
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":0,"hdr":1,"ftr":1,"style":"myob","dens":"100","p":"last_quarter","a":"custom","c":"none","v":"bas"}' },
  uses: { gst: ['from_date', 'to_date', 'basis', 'company_file'], tax_codes: ['company_file'], payroll: ['from_date', 'to_date', 'basis', 'company_file'], journals: ['from_date', 'to_date', 'company_file'], accounts: ['company_file'], company_files: [] },
  tools: { gst: 'get_gst_summary (MYOB tax code summary for the period)', tax_codes: 'list_tax_codes (code types and the GST accounts)', payroll: 'get_payroll_category_summary (W1 wages / W2 tax withheld)', journals: 'list_journal_transactions (the GST accounts’ movement, an independent check)', accounts: 'list_accounts (bank accounts, to leave out BAS payments)', company_files: 'list_company_files' },
  views: [['bas', 'BAS (activity statement)'], ['return', 'GST return (BAS labels)'], ['codes', 'GST report by tax code']],
  render: function (c) {
    var body = c.body, money = function (v) { return MK.money(v, c.currency, c.display); }, r2 = function (v) { return Math.round(v * 100) / 100; }, from = c.inputs.from_date, to = c.inputs.to_date, self = this;
    if (c.errors.gst) { body.innerHTML = '<p class="mk-err">' + MK.h(c.err('gst')) + '</p>'; return { checks: [{ name: 'GST figures loaded (MYOB tax code summary)', pass: false, detail: c.err('gst') }] }; }
    if (!c.data.gst) return {};
    // ---- the mapping (editable per client; saved with the report)
    var parse = function (s) { var m = { G2: [], G3: [], G4: [], G10: [], X: [] }; String(s || GST_MAP_DEFAULT).split(';').forEach(function (p) { var kv = p.split('='), k = (kv[0] || '').trim().toUpperCase(); if (m[k]) m[k] = (kv[1] || '').split(',').map(function (x) { return x.trim().toUpperCase(); }).filter(Boolean); }); return m; };
    var map = parse(c.inputs.bas_map), inL = function (k, code) { return map[k].indexOf(code) >= 0; };
    // ---- tax codes: MYOB's summary rows, typed from the tax code list (non-GST taxes — wine, luxury car, import duty, withholding — stay off the GST labels)
    var types = {}, gstAcc = {}; MK.items(c.data.tax_codes).forEach(function (t) { if (!t || !t.Code) return; types[String(t.Code).toUpperCase()] = t.Type || ''; ['TaxCollectedAccount', 'TaxPaidAccount'].forEach(function (k) { if (t[k] && t[k].UID && /GST|InputTaxed/i.test(t.Type || '')) gstAcc[t[k].UID] = 1; }); });
    var nonGst = function (code) { var t = types[code]; return !!t && !/^(GST_VAT|InputTaxed)$/i.test(t); };
    var raw = (c.data.gst.TaxCodeBreakdown || []).map(function (r) { var code = String((r.TaxCode || {}).Code || '?').toUpperCase(); return { code: code, rate: MK.num(r.TaxRate) || 0, sales: MK.num(r.SalesTotal) || 0, purch: MK.num(r.PurchasesTotal) || 0, tc: MK.num(r.TaxCollected) || 0, tp: MK.num(r.TaxPaid) || 0 }; });
    // MYOB's totals include GST (its sample: total / 11 = tax). If this file's don't, gross them up so G1 / G10 / G11 are GST-inclusive.
    var big = raw.filter(function (r) { return r.rate > 0; }).sort(function (a, b) { return (b.sales + b.purch) - (a.sales + a.purch); })[0];
    var excl = !!big && (big.sales ? MK.near(big.tc, big.sales * big.rate / 100, Math.max(1, big.tc * 0.002)) && !MK.near(big.tc, big.sales * big.rate / (100 + big.rate), Math.max(1, big.tc * 0.002)) : MK.near(big.tp, big.purch * big.rate / 100, Math.max(1, big.tp * 0.002)) && !MK.near(big.tp, big.purch * big.rate / (100 + big.rate), Math.max(1, big.tp * 0.002)));
    var rows = raw.map(function (r) { return Object.assign({}, r, { si: excl ? r2(r.sales + r.tc) : r.sales, pi: excl ? r2(r.purch + r.tp) : r.purch, left: inL('X', r.code) || nonGst(r.code) }); });
    var rep = rows.filter(function (r) { return !r.left; }), S = function (list, k) { return MK.sum(list.map(function (r) { return r[k]; })); };
    var L = { G1: S(rep, 'si'), G2: S(rep.filter(function (r) { return inL('G2', r.code); }), 'si'), G3: S(rep.filter(function (r) { return inL('G3', r.code); }), 'si'), G4: S(rep.filter(function (r) { return inL('G4', r.code); }), 'si'),
      G10: S(rep.filter(function (r) { return inL('G10', r.code); }), 'pi'), G11: S(rep.filter(function (r) { return !inL('G10', r.code); }), 'pi'), A1: S(rows.filter(function (r) { return !nonGst(r.code); }), 'tc'), B1: S(rows.filter(function (r) { return !nonGst(r.code); }), 'tp') };
    L.G5 = r2(L.G2 + L.G3 + L.G4); L.G6 = r2(L.G1 - L.G5); L.G12 = r2(L.G10 + L.G11); L.net = r2(L.A1 - L.B1);
    // ---- PAYG withholding from payroll (optional): W1 = gross wages, W2 = tax withheld
    var pr = c.data.payroll, prRows = pr && Array.isArray(pr.PayrollCategoryBreakdown) ? pr.PayrollCategoryBreakdown : null;
    var W1 = prRows ? (pr.W1_GrossWages != null ? MK.num(pr.W1_GrossWages) : MK.sum(prRows.filter(function (x) { return (x.PayrollCategory || {}).Type === 'Wage'; }).map(function (x) { return MK.num(x.Amount) || 0; }))) : null;
    var W2 = prRows ? (pr.W2_AmountsWithheld != null ? MK.num(pr.W2_AmountsWithheld) : MK.sum(prRows.filter(function (x) { return (x.PayrollCategory || {}).Type === 'Tax'; }).map(function (x) { return MK.num(x.Amount) || 0; }))) : null;
    var wWhy = c.errors.payroll ? 'payroll summary unavailable (' + c.err('payroll') + ')' : prRows && !prRows.length ? 'no pay runs in MYOB for the period' : '';
    var A8 = r2(L.A1 + (W2 || 0)), B8 = L.B1, nine = r2(A8 - B8);
    // ---- render
    var view = c.view || 'bas', lbl = function (code, name, v, note) { return '<tr><td><strong>' + code + '</strong></td><td>' + MK.h(name) + (note ? ' <span class="muted">' + MK.h(note) + '</span>' : '') + '</td><td class="num">' + (v == null ? 'N/A' : money(v)) + '</td></tr>'; };
    var codesOf = function (k) { return map[k].length ? map[k].join(', ') : 'none'; }, mapLine = 'G2 ' + codesOf('G2') + ' · G3 ' + codesOf('G3') + ' · G4 ' + codesOf('G4') + ' · G10 ' + codesOf('G10') + ' · left out ' + codesOf('X');
    var draft = '<div class="mk-banner na" style="margin:12px 0"><strong>Draft — check before lodging.</strong> MYOB’s API has no link from tax codes to BAS labels; the labels use the default mapping below (ATO definitions), which a registered BAS agent should confirm for this client. Mapping: ' + MK.h(mapLine) + '</div>';
    var kp = MK.kpis([{ label: L.net >= 0 ? 'GST payable (1A − 1B)' : 'GST refund (1B − 1A)', value: Math.abs(L.net) }, { label: 'GST on sales (1A)', value: L.A1 }, { label: 'GST on purchases (1B)', value: L.B1 }, { label: nine >= 0 ? 'Amount payable (9)' : 'Refund (9)', value: Math.abs(nine) }], c);
    var tbl = function (inner) { return '<div class="mk-scroll"><table class="mk-grid"><tbody>' + inner + '</tbody></table></div>'; };
    var html = kp + draft;
    if (view === 'bas') {
      html += '<div class="mk-card"><h3>Goods and services tax (GST) — ' + MK.h(MK.periodLine(from, to)) + '</h3>' + tbl(lbl('G1', 'Total sales (including any GST)', L.G1) + lbl('G2', 'Export sales', L.G2) + lbl('G3', 'Other GST-free sales', L.G3) + lbl('G10', 'Capital purchases (including any GST)', L.G10) + lbl('G11', 'Non-capital purchases (including any GST)', L.G11) + lbl('1A', 'GST on sales', L.A1) + lbl('1B', 'GST on purchases', L.B1)) + '</div>' +
        '<div class="mk-card"><h3>PAYG tax withheld</h3>' + tbl(lbl('W1', 'Total salary, wages and other payments', W1, W1 == null ? wWhy : '') + lbl('W2', 'Amounts withheld from payments shown at W1', W2, W2 == null ? wWhy : '') + lbl('T7', 'PAYG income tax instalment', null, 'not in MYOB — enter from the ATO notice')) + '</div>' +
        '<div class="mk-card"><h3>Summary</h3>' + tbl(lbl('8A', 'Amounts you owe the ATO (1A + W2)', A8) + lbl('8B', 'Amounts the ATO owes you (1B)', B8) + '<tr class="k-total"><td><strong>9</strong></td><td>' + (nine >= 0 ? 'Your payment amount' : 'Your refund amount') + '</td><td class="num">' + money(Math.abs(nine)) + '</td></tr>') + '<p class="muted">Simpler BAS (turnover under $10 million) reports only G1, 1A and 1B.</p></div>';
    } else if (view === 'return') {
      html += '<div class="mk-card"><h3>GST return (BAS labels) — ' + MK.h(MK.periodLine(from, to)) + '</h3>' + tbl(lbl('G1', 'Total sales', L.G1, 'every reportable code') + lbl('G2', 'Export sales', L.G2, codesOf('G2')) + lbl('G3', 'Other GST-free sales', L.G3, codesOf('G3')) + lbl('G4', 'Input taxed sales', L.G4, codesOf('G4')) + lbl('G5', 'G2 + G3 + G4', L.G5) + lbl('G6', 'Total sales subject to GST (G1 − G5)', L.G6) +
        lbl('G10', 'Capital purchases', L.G10, codesOf('G10')) + lbl('G11', 'Non-capital purchases', L.G11, 'every other reportable code') + lbl('G12', 'G10 + G11', L.G12) + lbl('1A', 'GST on sales', L.A1) + lbl('1B', 'GST on purchases', L.B1) + '<tr class="k-total"><td></td><td>' + (L.net >= 0 ? 'GST payable' : 'GST refund') + '</td><td class="num">' + money(Math.abs(L.net)) + '</td></tr>') +
        '<p class="muted">G7 / G18 adjustments and G13–G15 (records only) are not in MYOB’s API.</p></div>' +
        '<div class="mk-card"><h3>Mapping for this client</h3><p class="muted">Tax codes per label, comma separated. G1 and G11 take every other reportable code. Saved with the report.</p><div class="mk-grid2">' +
        ['G2', 'G3', 'G4', 'G10', 'X'].map(function (k) { return '<label class="ctl">' + (k === 'X' ? 'Left out' : k) + ' <input id="gst-map-' + k + '" value="' + MK.h(map[k].join(', ')) + '" style="width:9em"></label>'; }).join(' ') +
        ' <button id="gst-map-apply" class="btn">Apply</button> <button id="gst-map-reset" class="btn">Reset to default</button></div></div>';
    } else {
      html += '<div class="mk-card"><h3>GST report by tax code — ' + MK.h(MK.periodLine(from, to)) + '</h3><div id="gst-codes"></div></div>';
    }
    body.innerHTML = html;
    if (view === 'codes') MK.grid(document.getElementById('gst-codes'), { rows: rows.map(function (r) { return { code: r.code + (r.left ? ' (left out)' : ''), rate: r.rate, si: r.si, pi: r.pi, tc: r.tc, tp: r.tp, net: r2(r.tc - r.tp) }; }), filter: true,
      columns: [{ key: 'code', title: 'Tax code' }, { key: 'rate', title: 'Rate %', num: true }, { key: 'si', title: 'Sales (incl. GST)', money: true }, { key: 'pi', title: 'Purchases (incl. GST)', money: true }, { key: 'tc', title: 'GST collected', money: true }, { key: 'tp', title: 'GST paid', money: true }, { key: 'net', title: 'Net GST', money: true }],
      total: { code: 'Total', si: S(rows, 'si'), pi: S(rows, 'pi'), tc: S(rows, 'tc'), tp: S(rows, 'tp'), net: r2(S(rows, 'tc') - S(rows, 'tp')) } }, c);
    if (view === 'return') {
      var val = function (k) { var el = document.getElementById('gst-map-' + k); return el ? el.value.split(',').map(function (x) { return x.trim().toUpperCase(); }).filter(Boolean).join(',') : ''; };
      var ap = document.getElementById('gst-map-apply'), rs = document.getElementById('gst-map-reset');
      if (ap) ap.addEventListener('click', function () { c.change({ bas_map: ['G2', 'G3', 'G4', 'G10', 'X'].map(function (k) { return k + '=' + val(k); }).join(';') }); });
      if (rs) rs.addEventListener('click', function () { c.change({ bas_map: GST_MAP_DEFAULT }); });
    }
    // ---- checks
    var g = c.data.gst, sd = String(g.StartDate || '').slice(0, 10), ed = String(g.EndDate || '').slice(0, 10);
    var badRate = rows.filter(function (r) { if (r.rate > 0) { var ts = r.si * r.rate / (100 + r.rate), tq = r.pi * r.rate / (100 + r.rate); return !MK.near(r.tc, ts, Math.max(1, r.si * 0.0002)) || !MK.near(r.tp, tq, Math.max(1, r.pi * 0.0002)); } return Math.abs(r.tc) > 0.005 || Math.abs(r.tp) > 0.005; });
    var leftOut = rows.filter(function (r) { return r.left && (r.si || r.pi); });
    // Independent: the GST accounts' movement in the period's journals (accrual), leaving out BAS payments — journals with only GST and bank lines
    var tie = null, idx = MK.accounts(c.data.accounts), J = MK.items(c.data.journals);
    if (c.inputs.basis !== 'Cash' && J.length) {
      var isGst = function (a) { var acc = idx.byUid[a.UID] || {}; return gstAcc[a.UID] || (!Object.keys(gstAcc).length && /\bGST\b/i.test(acc.Name || a.Name || '')); };
      var isBank = function (a) { var acc = idx.byUid[a.UID]; return acc ? /^(Bank|CreditCard)$/.test(acc.Type || '') : /^1-1/.test(a.DisplayID || ''); };
      var net = 0, settle = 0; J.forEach(function (j) { var ls = j.Lines || [], gl = ls.filter(function (l) { return l.Account && isGst(l.Account); }); if (!gl.length) return;
        if (ls.every(function (l) { return l.Account && (isGst(l.Account) || isBank(l.Account)); })) { settle++; return; }
        gl.forEach(function (l) { net += (l.IsCredit ? 1 : -1) * (MK.num(l.Amount) || 0); }); });
      tie = { net: r2(net), settle: settle };
    }
    var checks = [
      { name: 'MYOB returned the requested period (tax code summary)', pass: !sd || !ed ? null : sd === from && ed === to, detail: (sd || '?') + ' to ' + (ed || '?') + ', ' + (g.ReportingBasis || c.inputs.basis) + ' basis' },
      { name: 'Each tax code’s GST = its rate on its GST-inclusive amounts', pass: rows.length ? !badRate.length : null, detail: badRate.length ? 'Differs: ' + badRate.map(function (r) { return r.code + ' (collected ' + money(r.tc) + ', paid ' + money(r.tp) + ')'; }).join(', ') : rows.length + ' code(s)' + (excl ? ' — this file’s totals exclude GST; GST was added for G1, G10 and G11' : '') },
      { name: 'G1 covers G2 + G3 + G4 (G6 is not negative)', pass: L.G6 >= -0.005, detail: money(L.G1) + ' vs ' + money(L.G5) },
      tie ? { name: '1A − 1B vs the GST accounts’ movement in the period’s journals (information — a separate MYOB source; BAS payments left out)', pass: null, info: true, detail: money(L.net) + ' vs ' + money(tie.net) + (MK.near(L.net, tie.net, 1) ? ' — the same' : ' — differs by ' + money(r2(L.net - tie.net)) + ': GST adjustments by journal, or a BAS payment through an account other than the bank') + (tie.settle ? '; ' + tie.settle + ' BAS payment(s) left out' : '') }
        : { name: '1A − 1B vs the GST accounts’ movement in the journals (information)', pass: null, info: true, detail: c.inputs.basis === 'Cash' ? 'N/A on the cash basis (journals are accrual)' : c.errors.journals ? 'Journals unavailable (' + c.err('journals') + ')' : 'N/A — no journals for the period' },
      { name: 'Codes left out of the BAS (information)', pass: null, info: true, detail: leftOut.length ? leftOut.map(function (r) { return r.code + ' (sales ' + money(r.si) + ', purchases ' + money(r.pi) + ')'; }).join('; ') : 'none' }
    ];
    if (view === 'bas') checks.push({ name: 'PAYG withholding W1 / W2 (MYOB payroll categories)', pass: null, info: true, detail: W1 == null ? 'N/A — ' + (wWhy || 'payroll summary unavailable') : 'W1 ' + money(W1) + ', W2 ' + money(W2) + ' — check the client’s W1 / W2 links in MYOB' });
    self._x = { L: L, rows: rows, W1: W1, W2: W2, A8: A8, B8: B8, nine: nine, mapLine: mapLine };
    return { checks: checks, title: { bas: 'BAS (activity statement) — draft', 'return': 'GST return — draft', codes: 'GST report by tax code' }[view],
      notes: ['Draft — check before lodging. Labels use the default mapping (' + mapLine + ') on the ATO’s definitions: G1 = all reportable sales including GST-free and input-taxed; G11 = every reportable purchase not at G10. Edit it per client in the GST return view.', 'Amounts are MYOB’s tax code summary totals (GST-inclusive). Codes left out (N-T, and non-GST taxes such as wine equalisation or luxury car tax) are listed under Validation.'],
      na: ['G7 / G18 adjustments, G13–G15 (records only), fuel tax credits (7C / 7D) and PAYG instalments (T7) — not in MYOB’s API', 'Lodging the BAS (MYOB’s AI BAS and ATO lodgement are in MYOB’s app only)'] };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var mv = function (v) { return v == null ? 'N/A' : { v: v, s: 'money' }; }, head = function (t) { return [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: t, s: 'bold' }], [MK.periodLine(c.inputs.from_date, c.inputs.to_date) + ' — draft, check before lodging'], []]; };
    var bas = head('BAS (activity statement)').concat([[{ v: 'Label', s: 'bold' }, { v: 'Description', s: 'bold' }, { v: 'Amount', s: 'bold' }],
      ['G1', 'Total sales', mv(x.L.G1)], ['G2', 'Export sales', mv(x.L.G2)], ['G3', 'Other GST-free sales', mv(x.L.G3)], ['G4', 'Input taxed sales', mv(x.L.G4)], ['G10', 'Capital purchases', mv(x.L.G10)], ['G11', 'Non-capital purchases', mv(x.L.G11)],
      ['1A', 'GST on sales', mv(x.L.A1)], ['1B', 'GST on purchases', mv(x.L.B1)], ['W1', 'Total salary, wages and other payments', mv(x.W1)], ['W2', 'Amounts withheld', mv(x.W2)], ['8A', 'Amounts you owe the ATO', mv(x.A8)], ['8B', 'Amounts the ATO owes you', mv(x.B8)], ['9', x.nine >= 0 ? 'Payment amount' : 'Refund amount', mv(Math.abs(x.nine))], [], ['Mapping', x.mapLine]]);
    var codes = head('GST report by tax code').concat([[{ v: 'Tax code', s: 'bold' }, { v: 'Rate %', s: 'bold' }, { v: 'Sales (incl. GST)', s: 'bold' }, { v: 'Purchases (incl. GST)', s: 'bold' }, { v: 'GST collected', s: 'bold' }, { v: 'GST paid', s: 'bold' }]])
      .concat(x.rows.map(function (r) { return [r.code + (r.left ? ' (left out)' : ''), r.rate, mv(r.si), mv(r.pi), mv(r.tc), mv(r.tp)]; }));
    return [{ name: 'BAS', rows: bas, widths: [8, 44, 18] }, { name: 'By tax code', rows: codes, widths: [18, 10, 18, 18, 16, 16] }];
  }
});
```
