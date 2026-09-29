---
name: xero-activity-statement
description: Build a live GST summary for a period from Xero sales invoices and bills — GST collected, GST paid, net GST and a per-tax-rate drill-down — clearly marked as not a lodgeable BAS. Use for "activity statement", "BAS", "GST summary", "GST owed", "GST collected and paid".
---
# Activity Statement (BAS) — GST summary

Load `xero-report-foundation` first. There is no Activity Statement / BAS endpoint on the `xero-accounting` connector — G-fields (G1, G2, G3, G10, G11) and PAYG fields (W1–W4, PAYG instalments) are N/A — not in source. Never ask the user to type these in and never infer them from other figures. Build a **GST summary, not a BAS**: an unmissable banner above everything else reads "This is not your Activity Statement — lodge from Xero → Tax → Activity statements. Not tax advice." It never scrolls out of view above the fold on load.

## Why this is not built on `XK.app` (the kit engine)

P06/P07 assemble `XK.app(cfg)`: one binding per Xero report, refetched whenever a declared input changes. A GST summary needs the opposite shape: `list_invoices` has no `fromDate`/`toDate` param (see foundation *Connector facts*), so the requested period can only be applied by (a) filtering rows client-side on `DateString`, after (b) paging through `list_invoices` results ordered `Date DESC` until a page's rows predate the window or a bounded cap is hit. `XK.app` refetches exactly one page per binding per input change — it has no built-in multi-page accumulation loop. Capping at page 1 only is **not safe** here: for any period older than the organisation's most recent ~100 sales invoices, page 1 (the newest rows) would return zero rows inside the requested window and the report would silently show $0 GST collected as if it were real — exactly the "never render $0 … as if it were real data" rule this foundation forbids. So this skill is a **hand-authored live report**: real `dataBindings` (never baked-in figures), the shared `{{CSS}}` and the pure helpers exported by `{{KIT}}` (`XK.money`, `XK.pct`, `XK.grid`, `XK.kpis`, `XK.companyOf`, `XK.fiscalStart`, `XK.preset`, `XK.PRESETS`, `XK.periodLine`, `XK.footerStamp`, `XK.readDisplay`/`writeDisplay`, `XK.xlsx`/`sheetFromLines`, `XK.h`/`num`/`sum`/`near`) — but its own small bootstrap in place of `XK.app(cfg)`, so it can page and window-filter correctly. Copy `{{KIT}}` and `{{CSS}}` verbatim regardless (never edit them); only the assembly step differs from *Build a kit report*.

**A deliberate, disclosed exception to the mapping law:** `from_date` and `to_date` stay declared inputs (so `MyHubReport.setInputs` can capture the selected period for downloads and share links, the same as every other report in this library), but **no binding consumes them** — `list_invoices` has no date-range param, so the period is applied entirely client-side, by filtering the paged rows on `DateString`. The foundation's mapping law names `basis` as the one exception to "every declared input must be consumed by a binding"; in practice `persona` and `display` are unconsumed in the shipped P06/P07 skills too. `from_date`/`to_date` here join that same category for a different, equally real reason: the foundation's own carve-out for "controls that only change the view … are client-side state, not inputs" describes this filtering exactly, and the only reason they are declared inputs at all (rather than pure JS state) is to keep the selected period in snapshots and share links, consistent with every other report.

## Discovery call

Call `get_organisation` once, `list_connections` once, and `list_invoices` once each for `where: 'Type=="ACCREC"'` and `where: 'Type=="ACCPAY"'` with `statuses: "AUTHORISED,PAID"`, `order: "Date DESC"`, `summaryOnly: false`, `page: 1`. Expect `{ Invoices: [{ InvoiceID, Type, Contact, Date, DateString, Status, SubTotal, TotalTax, Total, LineItems? }] }`. `LineItems[].TaxType` / `.TaxAmount` may or may not be present on a list response depending on the organisation and connector version — check the discovery response before assuming a per-line breakdown is available. Also call `list_tax_rates` once (`ReportTaxType`, `Name`, `EffectiveRate`) to label whatever `TaxType` codes appear. A failed call is an error, not data: report its message and stop for that section only.

## Date defaults

`from_date` = start of the statement period asked for (default: start of this quarter); `to_date` = end of the period (default `"today"`). Set the preset picker to the nearest of `this_month`, `this_quarter` (default), `this_fy_td`, `last_month`, `last_quarter`, `last_fy`, or `custom` — BAS periods are usually monthly or quarterly, so default to `this_quarter`. There is no `basis` control: GST here is accrual (invoice date), always; cash-basis GST is N/A — not in source, and the report says so once, plainly, rather than offering a Cash toggle that would silently do nothing.

## Members

| Member / view | How |
|---|---|
| GST summary for the period | Default view |
| Change the period | Period preset (Month / Quarter / FY to date / Custom) + From / To |
| Another organisation | Organisation picker (every organisation on this Xero connection) |
| Per-tax-rate breakdown | Shown when line-item tax detail was returned; otherwise a total-only row with a stated reason |
| Cash-basis GST | N/A in this version — say so; do not offer a control that has no effect |
| BAS boxes (G1, G2, G3, G10, G11, 1A, 1B, W1–W4) | N/A — not in source; the banner names the real place to lodge |

## Validation checks (shown in the banner)

- GST collected = Σ `TotalTax` on in-window `ACCREC` invoices minus in-window `ACCRECCREDIT` credit notes
- GST paid = Σ `TotalTax` on in-window `ACCPAY` invoices minus in-window `ACCPAYCREDIT` credit notes
- Net GST = GST collected − GST paid (recomputed from the two totals above, not re-displayed as a third fetched number)
- Per-tax-rate breakdown sums to the invoice totals it was drawn from (N/A when no organisation in the discovery call returned line-item tax detail)
- Coverage: every matching invoice was retrieved (pass when paging stopped because a page's rows predated the window or returned fewer than 100 rows; **N/A, not pass**, when the page cap was hit — the totals may then be incomplete, and the banner says so)
- This is a reporting summary, not tax advice (always shown, always informational)

## Save as

`fileName`: `xero-activity-statement.html` · `tags`: ["xero","activity-statement","gst","bas","not-lodgeable"]

## QA test script (procedure only — no live access to run this)

1. On a QA organisation, ask for this report at the default period (this quarter); confirm the discovery call succeeds, the report saves, and the "not your Activity Statement" banner is the first thing visible with no scroll.
2. Cross-check GST collected / GST paid against Xero → Business → Invoices (and Bills) filtered to the same period and statuses, summing `Tax Amount` by hand for a small sample; confirm the report's totals match.
3. Force the coverage check to trip: pick an organisation/period with more than ~100 authorised + paid sales invoices (or temporarily lower the page cap while testing) and confirm the banner shows "may be incomplete" rather than a false Pass, and that Net GST is not asserted as complete.
4. Pick a period far enough in the past that page 1 (ordered `Date DESC`) would not contain it, and confirm paging walks back to the correct window rather than showing $0 for a period that actually had sales — this is the specific bug this design exists to avoid.
5. Confirm the per-tax-rate table either renders from real `LineItems` data or is replaced by a total-only row with the stated reason — never a fabricated split.
6. Switch organisation (LIB-002): confirm every figure, the header and the exports carry only that organisation's data.
7. Download PDF and Download Excel; confirm the Excel file has a Validation sheet and a Parameters sheet, and that the workbook's figures match the screen.
8. Toggle dark theme and confirm the banner, KPI cards and table remain legible.

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
      "name": "page",
      "label": "Page (internal — used for bounded pagination, not shown as a control)",
      "type": "number",
      "default": 1,
      "min": 1
    },
    {
      "name": "org",
      "label": "Organisation",
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
      "default": "{\"cents\":1,\"k\":0,\"zeros\":1,\"neg\":\"paren\",\"red\":1,\"hdr\":1,\"ftr\":1,\"style\":\"xero\",\"dens\":\"100\",\"p\":\"this_quarter\",\"a\":\"custom\",\"c\":\"none\",\"v\":\"\"}"
    }
  ],
  "bindings": [
    {
      "id": "sales_invoices",
      "tool": {
        "mcp": "xero-accounting",
        "name": "list_invoices"
      },
      "params": {
        "where": {
          "kind": "static",
          "value": "Type==\"ACCREC\""
        },
        "statuses": {
          "kind": "static",
          "value": "AUTHORISED,PAID"
        },
        "order": {
          "kind": "static",
          "value": "Date DESC"
        },
        "summaryOnly": {
          "kind": "static",
          "value": false
        },
        "page": {
          "kind": "input",
          "input": "page"
        },
        "xero_tenant_id": {
          "kind": "input",
          "input": "org"
        }
      }
    },
    {
      "id": "bills",
      "tool": {
        "mcp": "xero-accounting",
        "name": "list_invoices"
      },
      "params": {
        "where": {
          "kind": "static",
          "value": "Type==\"ACCPAY\""
        },
        "statuses": {
          "kind": "static",
          "value": "AUTHORISED,PAID"
        },
        "order": {
          "kind": "static",
          "value": "Date DESC"
        },
        "summaryOnly": {
          "kind": "static",
          "value": false
        },
        "page": {
          "kind": "input",
          "input": "page"
        },
        "xero_tenant_id": {
          "kind": "input",
          "input": "org"
        }
      }
    },
    {
      "id": "credit_notes",
      "tool": {
        "mcp": "xero-accounting",
        "name": "list_credit_notes"
      },
      "params": {
        "where": {
          "kind": "static",
          "value": "Type==\"ACCRECCREDIT\" OR Type==\"ACCPAYCREDIT\""
        },
        "order": {
          "kind": "static",
          "value": "Date DESC"
        },
        "page": {
          "kind": "input",
          "input": "page"
        },
        "xero_tenant_id": {
          "kind": "input",
          "input": "org"
        }
      }
    },
    {
      "id": "tax_rates",
      "tool": {
        "mcp": "xero-accounting",
        "name": "list_tax_rates"
      },
      "params": {
        "xero_tenant_id": {
          "kind": "input",
          "input": "org"
        }
      }
    },
    {
      "id": "org",
      "tool": {
        "mcp": "xero-accounting",
        "name": "get_organisation"
      },
      "params": {
        "xero_tenant_id": {
          "kind": "input",
          "input": "org"
        }
      }
    },
    {
      "id": "connections",
      "tool": {
        "mcp": "xero-accounting",
        "name": "list_connections"
      },
      "params": {}
    }
  ]
}
```

## Report config ({{CFG}}) — hand-authored bootstrap, not `XK.app`

```js
(function () {
  'use strict';
  var MH = window.MyHubReport, live = !!(MH && MH.mode !== 'snapshot');
  var $ = function (id) { return document.getElementById(id); };
  var PAGE_CAP = 10; // 10 pages = up to 1,000 rows per list; stated in Sources & limitations
  var DEFAULTS = { from_date: '2026-07-01', to_date: '2026-09-25', org: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":1,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"xero","dens":"100","p":"this_quarter","a":"custom","c":"none","v":""}' };
  var S = { inputs: Object.assign({}, DEFAULTS), data: {}, errors: {}, fetchedAt: null, pages: { sales_invoices: [], bills: [], credit_notes: [] }, capped: {} };

  function disp() { return XK.readDisplay(S.inputs.display); }
  function setDisp(patch) { var d = disp(), k; for (k in patch) d[k] = patch[k]; S.inputs.display = XK.writeDisplay(d); }
  function status(t) { var el = $('xk-status'); if (el) el.textContent = t || ''; }
  var errorOf = XK.errorOf;
  var FRIENDLY = { needs_connection: 'Connect Xero (Settings → Connections) to see this data.', connection_unavailable: 'Xero is temporarily unavailable — press Refresh to try again.', tool_not_found: 'This Xero report is not available on the connected connector.', tool_error: 'Xero returned an error for this section.', invalid_inputs: 'One of the report controls has an invalid value.' };
  function err(id) { var e = S.errors[id]; return e ? (FRIENDLY[e.code] || e.message || 'Unavailable') : null; }
  function rowsOf(v, key) { return v && Array.isArray(v[key]) ? v[key] : []; }
  function dateOf(r) { return r.DateString ? String(r.DateString).slice(0, 10) : XK.isoDate(r.Date); }
  function inWindow(d) { return d && d >= S.inputs.from_date && d <= S.inputs.to_date; }

  // Bounded, early-stopping pagination: list_invoices/list_credit_notes are ordered Date DESC with no date
  // range param, so we page until a page's rows predate the window, a short page ends the list, or PAGE_CAP is hit.
  function fetchAll(id, key) {
    var acc = [], page = 1;
    function step() {
      return MH.getData(id, Object.assign({}, S.inputs, { page: page })).then(function (v) {
        var e = errorOf(v);
        if (e) { S.errors[id] = { code: 'tool_error', message: e }; return; }
        delete S.errors[id];
        var rows = rowsOf(v, key);
        acc = acc.concat(rows);
        var oldestOnPage = rows.length ? dateOf(rows[rows.length - 1]) : null;
        var stopShort = rows.length < 100, stopOld = oldestOnPage && oldestOnPage < S.inputs.from_date;
        if (stopShort || stopOld) { S.capped[id] = false; return; }
        if (page >= PAGE_CAP) { S.capped[id] = true; return; }
        page++; return step();
      }, function (e) { S.errors[id] = { code: (e && e.code) || 'tool_error', message: (e && e.message) || String(e) }; });
    }
    return step().then(function () { S.pages[id] = acc; });
  }

  function co() { return XK.companyOf(S.data.org, S.data.connections, S.inputs.org, null); }
  function fy() { return XK.fiscalStart(co().org, null); }

  function loadAll() {
    status('Loading Xero invoices, bills and credit notes…');
    return Promise.all([
      fetchAll('sales_invoices', 'Invoices'),
      fetchAll('bills', 'Invoices'),
      fetchAll('credit_notes', 'CreditNotes'),
      MH.getData('tax_rates', S.inputs).then(function (v) { var e = errorOf(v); if (e) S.errors.tax_rates = { code: 'tool_error', message: e }; else { delete S.errors.tax_rates; S.data.tax_rates = v; } }),
      MH.getData('org', S.inputs).then(function (v) { var e = errorOf(v); if (e) S.errors.org = { code: 'tool_error', message: e }; else { delete S.errors.org; S.data.org = v; } }),
      MH.getData('connections', S.inputs).then(function (v) { var e = errorOf(v); if (e) S.errors.connections = { code: 'tool_error', message: e }; else { delete S.errors.connections; S.data.connections = v; } })
    ]).then(function () { S.fetchedAt = new Date().toISOString(); status(''); render(); });
  }

  function change(patch, dispPatch) {
    var k; for (k in patch) S.inputs[k] = patch[k];
    if (dispPatch) setDisp(dispPatch);
    if (MH.setInputs) MH.setInputs(Object.assign({}, S.inputs, { page: 1 }));
    if (!live) { render(); return; }
    loadAll();
  }

  function taxLabel(taxType, rates) {
    var r = (rates || []).filter(function (x) { return x.TaxType === taxType; })[0];
    return r ? (r.Name || r.ReportTaxType || taxType) : (taxType || 'Unlabelled');
  }

  function breakdown(rows, rates) {
    var byRate = {}, any = false;
    rows.forEach(function (r) {
      if (!Array.isArray(r.LineItems) || !r.LineItems.length) return;
      any = true;
      r.LineItems.forEach(function (li) {
        var t = li.TaxType || 'UNSPECIFIED', amt = XK.num(li.TaxAmount) || 0;
        byRate[t] = (byRate[t] || 0) + amt;
      });
    });
    if (!any) return null;
    return Object.keys(byRate).map(function (t) { return { rate: taxLabel(t, rates), taxType: t, amount: Math.round(byRate[t] * 100) / 100 }; });
  }

  function controls() {
    var el = $('xk-controls'); if (!el) return; var c0 = co(), d = disp(), dis = live ? '' : ' disabled';
    var opt = function (list, cur) { return list.map(function (o) { return '<option value="' + XK.h(o[0]) + '"' + (String(o[0]) === String(cur) ? ' selected' : '') + '>' + XK.h(o[1]) + '</option>'; }).join(''); };
    var x = '';
    if (c0.orgs.length > 1) x += '<label class="ctl">Organisation<select id="ga-org"' + dis + '>' + opt(c0.orgs.map(function (o) { return [o.id, o.name || o.id]; }), S.inputs.org || c0.active || '') + '</select></label>';
    else x += '<label class="ctl">Organisation<select disabled><option>' + XK.h(c0.name || 'Connected Xero organisation') + '</option></select></label>';
    x += '<label class="ctl">Period<select id="ga-preset"' + dis + '>' + opt(XK.PRESETS, d.p) + '</select></label>';
    x += '<label class="ctl">From<input type="date" id="ga-from" value="' + XK.h(S.inputs.from_date) + '"' + dis + '></label>';
    x += '<label class="ctl">To<input type="date" id="ga-to" value="' + XK.h(S.inputs.to_date) + '"' + dis + '></label>';
    x += '<div class="ctl btns"><button type="button" id="ga-pdf">Download PDF</button><button type="button" id="ga-xlsx">Download Excel</button></div>';
    el.innerHTML = x;
    var on = function (id, ev, fn) { var e = $(id); if (e) e.addEventListener(ev, fn); };
    on('ga-org', 'change', function () { change({ org: this.value }); });
    on('ga-preset', 'change', function () { var r = XK.preset(this.value, fy().month); if (r) change({ from_date: r.start, to_date: r.end }, { p: this.value }); });
    on('ga-from', 'change', function () { change({ from_date: this.value }, { p: 'custom' }); });
    on('ga-to', 'change', function () { change({ to_date: this.value }, { p: 'custom' }); });
    on('ga-pdf', 'click', function () { window.print(); });
    on('ga-xlsx', 'click', function () { exportXlsx(); });
  }

  var last = { checks: [], na: [], notes: [] };
  function render() {
    var c0 = co(), d = disp(), cur = XK.homeCurrency(c0.org), root = document.documentElement;
    root.classList.toggle('style-mysmb', d.style === 'mysmb'); root.classList.toggle('dens-compact', d.dens === 'compact');
    document.body.classList.toggle('persona-summary', S.inputs.persona === 'Client' || S.inputs.persona === 'Executive');
    document.body.classList.toggle('persona-detail', !(S.inputs.persona === 'Client' || S.inputs.persona === 'Executive'));
    controls();
    var body = $('xk-body');
    var salesErr = err('sales_invoices'), billsErr = err('bills'), ccErr = err('credit_notes');
    if (salesErr && billsErr) { body.innerHTML = '<p class="xk-err">' + XK.h(salesErr) + '</p>'; last = { checks: [{ name: 'Sales invoices loaded', pass: false, detail: salesErr }, { name: 'Bills loaded', pass: false, detail: billsErr }], na: [], notes: [] }; banner(); sources(cur); return; }

    var sales = (S.pages.sales_invoices || []).filter(function (r) { return inWindow(dateOf(r)); });
    var bills = (S.pages.bills || []).filter(function (r) { return inWindow(dateOf(r)); });
    var cn = (S.pages.credit_notes || []).filter(function (r) { return inWindow(dateOf(r)); });
    var accCreditTax = cn.filter(function (r) { return r.Type === 'ACCRECCREDIT'; }).reduce(function (s, r) { return s + (XK.num(r.TotalTax) || 0); }, 0);
    var apCreditTax = cn.filter(function (r) { return r.Type === 'ACCPAYCREDIT'; }).reduce(function (s, r) { return s + (XK.num(r.TotalTax) || 0); }, 0);
    var salesTax = sales.reduce(function (s, r) { return s + (XK.num(r.TotalTax) || 0); }, 0);
    var billsTax = bills.reduce(function (s, r) { return s + (XK.num(r.TotalTax) || 0); }, 0);
    var gstCollected = Math.round((salesTax - accCreditTax) * 100) / 100;
    var gstPaid = Math.round((billsTax - apCreditTax) * 100) / 100;
    var netGst = Math.round((gstCollected - gstPaid) * 100) / 100;
    var rates = rowsOf(S.data.tax_rates, 'TaxRates');
    var salesBreak = breakdown(sales, rates), billsBreak = breakdown(bills, rates);
    var money = function (v) { return XK.money(v, cur, d); };
    S.summary = { gstCollected: gstCollected, gstPaid: gstPaid, netGst: netGst, currency: cur, salesBreak: salesBreak, billsBreak: billsBreak };

    body.innerHTML =
      '<div class="xk-banner fail" role="alert" style="margin-bottom:14px"><strong>This is not your Activity Statement.</strong> Lodge your real BAS from Xero → Tax → Activity statements. This page is a GST summary computed from invoice and bill line items for decision support only — not tax advice, and it does not compute BAS boxes (G1, G2, G3, G10, G11, 1A, 1B) or PAYG (W1–W4).</div>' +
      XK.kpis([{ label: 'GST collected', value: gstCollected }, { label: 'GST paid', value: gstPaid }, { label: 'Net GST', value: netGst },
        { label: 'Sales invoices in period', value: sales.length, money: false }, { label: 'Bills in period', value: bills.length, money: false }], { currency: cur, display: d }) +
      '<h3>Per-tax-rate breakdown — GST collected (sales)</h3>' + rateTable(salesBreak, cur, d) +
      '<h3>Per-tax-rate breakdown — GST paid (bills)</h3>' + rateTable(billsBreak, cur, d) +
      '<h3 class="detail-block">Sales invoices in period</h3><div class="detail-block" id="ga-sales-grid"></div>' +
      '<h3 class="detail-block">Bills in period</h3><div class="detail-block" id="ga-bills-grid"></div>';
    invoiceGrid($('ga-sales-grid'), sales, cur, d);
    invoiceGrid($('ga-bills-grid'), bills, cur, d);

    var checks = [
      { name: 'GST collected = Σ TotalTax on in-window ACCREC invoices − ACCRECCREDIT credit notes', pass: salesErr ? false : true, detail: salesErr || (money(gstCollected) + ' from ' + sales.length + ' invoice(s), ' + money(accCreditTax) + ' credited') },
      { name: 'GST paid = Σ TotalTax on in-window ACCPAY invoices − ACCPAYCREDIT credit notes', pass: billsErr ? false : true, detail: billsErr || (money(gstPaid) + ' from ' + bills.length + ' bill(s), ' + money(apCreditTax) + ' credited') },
      { name: 'Net GST = GST collected − GST paid', pass: salesErr || billsErr ? null : XK.near(netGst, gstCollected - gstPaid), detail: money(netGst) },
      salesBreak || billsBreak
        ? { name: 'Per-tax-rate breakdown sums to the invoice totals', pass: (function () { var a = (salesBreak || []).reduce(function (s, r) { return s + r.amount; }, 0), b = (billsBreak || []).reduce(function (s, r) { return s + r.amount; }, 0); return (!salesBreak || XK.near(a, salesTax - accCreditTax, 0.05)) && (!billsBreak || XK.near(b, billsTax - apCreditTax, 0.05)); })(), detail: 'Compared against the same rows\' TotalTax' }
        : { name: 'Per-tax-rate breakdown (information)', pass: null, info: true, detail: 'This organisation\'s invoice list did not return line-item tax detail — showing total tax only, not a per-rate split.' },
      { name: 'Coverage: every matching invoice retrieved', pass: (S.capped.sales_invoices || S.capped.bills || S.capped.credit_notes) ? null : true, detail: (S.capped.sales_invoices || S.capped.bills || S.capped.credit_notes) ? 'Paging stopped at ' + PAGE_CAP + ' pages (up to ' + (PAGE_CAP * 100) + ' rows) per list — totals may be incomplete for this period' : 'All matching rows retrieved (paging stopped on a short page or rows older than the period)' },
      { name: 'This is a reporting summary, not tax advice', pass: null, info: true, detail: 'Lodge the real Activity Statement from Xero → Tax → Activity statements.' }
    ];
    if (ccErr) checks.unshift({ name: 'Credit notes loaded', pass: false, detail: ccErr });
    last = { checks: checks, na: ['BAS boxes G1, G2, G3, G10, G11, 1A, 1B (no Activity Statement / BAS endpoint on this connector)', 'PAYG W1–W4 and PAYG instalments (no Activity Statement / BAS endpoint on this connector)', 'Cash-basis GST (this summary is accrual / invoice-date only)'], notes: [] };

    var hd = $('xk-head');
    if (hd) hd.innerHTML = '<div class="co">' + XK.h(co().name || 'N/A — not in source') + '</div><div class="ti">GST Summary (not a lodgeable BAS)</div><div class="pe">' + XK.h(XK.periodLine(S.inputs.from_date, S.inputs.to_date)) + '</div>';
    var ft = $('xk-foot'); if (ft) ft.textContent = XK.footerStamp('Accrual', S.fetchedAt, cur);
    banner(); sources(cur);
  }

  function rateTable(rows, cur, d) {
    if (!rows) return '<p class="muted">Line-item tax detail was not returned for this organisation — see Validation for the reason. Showing total tax only.</p>';
    if (!rows.length) return '<p class="muted">No taxable lines in this period.</p>';
    var body = ''; rows.forEach(function (r) { body += '<tr><td>' + XK.h(r.rate) + '</td><td class="num">' + XK.money(r.amount, cur, d) + '</td></tr>'; });
    return '<table class="xk-grid"><thead><tr><th>Tax rate</th><th class="num">GST</th></tr></thead><tbody>' + body + '</tbody></table>';
  }

  function invoiceGrid(el, rows, cur, d) {
    if (!el) return;
    var mapped = rows.map(function (r) { return { date: dateOf(r), contact: (r.Contact || {}).Name || '', number: r.InvoiceNumber || '', subtotal: XK.num(r.SubTotal), tax: XK.num(r.TotalTax), total: XK.num(r.Total) }; });
    XK.grid(el, {
      columns: [
        { key: 'date', title: 'Date' }, { key: 'contact', title: 'Contact' }, { key: 'number', title: 'Number' },
        { key: 'subtotal', title: 'Subtotal', money: true }, { key: 'tax', title: 'GST', money: true }, { key: 'total', title: 'Total', money: true }
      ],
      rows: mapped, filter: true, empty: 'No rows in this period.'
    }, { currency: cur, display: d });
  }

  function banner() {
    var el = $('xk-banner'); if (!el) return; var ch = last.checks, fails = ch.filter(function (k) { return k.pass === false; }), done = ch.filter(function (k) { return k.pass === true; });
    el.className = 'xk-banner ' + (fails.length ? 'fail' : 'pass');
    el.innerHTML = '<strong>' + (fails.length ? '⚠ Validation: ' + fails.length + ' check(s) failed' + (done.length ? ' · ' + done.length + ' passed' : '') : '✓ Validation: ' + done.length + '/' + done.length + ' checks passed') + '</strong>' +
      ' · Data as of ' + XK.h(S.fetchedAt ? new Date(S.fetchedAt).toLocaleString('en-AU') : '—') + (live ? '' : ' · Snapshot: figures frozen at capture time') +
      '<ul>' + ch.map(function (k) { return '<li class="' + (k.pass === false ? 'bad' : k.pass === true ? 'ok' : k.info ? 'na info' : 'na') + '">' + (k.pass === false ? '✗ ' : k.pass === true ? '✓ ' : k.info ? 'ℹ ' : '– ') + XK.h(k.name) + (k.detail ? ' — ' + XK.h(k.detail) : '') + '</li>'; }).join('') + '</ul>';
  }

  function sources(cur) {
    var el = $('xk-sources'); if (!el) return;
    el.innerHTML = '<h2>Sources &amp; limitations</h2><ul>' +
      '<li>Mechanism: xero-accounting connector — mySMB custom MCP on the Xero Accounting API (AGT-001)</li>' +
      '<li>Tool calls: list_invoices (ACCREC, paged) · list_invoices (ACCPAY, paged) · list_credit_notes (paged) · list_tax_rates · get_organisation · list_connections</li>' +
      '<li>Basis: Accrual (invoice date) only · Currency: ' + XK.h(cur) + ' · Organisation: ' + XK.h(co().name || 'N/A — not in source') + ' (one Xero organisation per report)</li>' +
      last.na.map(function (n) { return '<li>N/A — not in source: ' + XK.h(n) + '</li>'; }).join('') +
      '<li>Decision support only — not audit, tax or legal advice.</li></ul>';
  }

  function exportXlsx() {
    var c0 = co(), cur = XK.homeCurrency(c0.org), sum = S.summary || { gstCollected: null, gstPaid: null, netGst: null, salesBreak: null, billsBreak: null };
    var sheets = [{ name: 'GST Summary', rows: [[{ v: c0.name || 'N/A — not in source', s: 'title' }], [{ v: 'GST Summary (not a lodgeable BAS)', s: 'bold' }], [XK.periodLine(S.inputs.from_date, S.inputs.to_date)], [], ['Metric', 'Amount'].map(function (v) { return { v: v, s: 'bold' }; })]
      .concat([['GST collected', sum.gstCollected], ['GST paid', sum.gstPaid], ['Net GST', sum.netGst]].map(function (r) { return [r[0], r[1] == null ? 'N/A' : { v: r[1], s: 'money' }]; }))
      .concat([[], [{ v: 'Not a lodgeable Activity Statement — lodge from Xero → Tax → Activity statements. Not tax advice.', s: 'muted' }]]) }];
    if (sum.salesBreak) sheets.push(XK.sheetFromLines('GST collected by rate', c0.name, XK.periodLine(S.inputs.from_date, S.inputs.to_date), ['Tax rate', 'GST'], sum.salesBreak.map(function (r) { return { kind: 'row', depth: 0, label: r.rate, values: [r.amount] }; }), null, ['money']));
    if (sum.billsBreak) sheets.push(XK.sheetFromLines('GST paid by rate', c0.name, XK.periodLine(S.inputs.from_date, S.inputs.to_date), ['Tax rate', 'GST'], sum.billsBreak.map(function (r) { return { kind: 'row', depth: 0, label: r.rate, values: [r.amount] }; }), null, ['money']));
    sheets.push({ name: 'Validation', rows: [[{ v: 'Check', s: 'bold' }, { v: 'Result', s: 'bold' }, { v: 'Detail', s: 'bold' }]].concat(last.checks.map(function (k) { return [k.name, k.pass === true ? 'Pass' : k.pass === false ? 'FAIL' : 'N/A', k.detail || '']; })), widths: [60, 10, 60] });
    sheets.push({ name: 'Parameters', rows: [['Parameter', 'Value'].map(function (v) { return { v: v, s: 'bold' }; })].concat([['from_date', S.inputs.from_date], ['to_date', S.inputs.to_date], ['organisation', c0.name || ''], ['Data as of', S.fetchedAt || '']]), widths: [28, 60] });
    XK.download(XK.xlsx(sheets, cur), (c0.name || 'Xero') + ' - GST Summary - ' + S.inputs.from_date + ' to ' + S.inputs.to_date + '.xlsx');
  }

  function boot(bundle) {
    S.errors = Object.assign({}, bundle.errors || {}); S.data = {};
    S.pages.sales_invoices = rowsOf((bundle.data || {}).sales_invoices, 'Invoices');
    S.pages.bills = rowsOf((bundle.data || {}).bills, 'Invoices');
    S.pages.credit_notes = rowsOf((bundle.data || {}).credit_notes, 'CreditNotes');
    ['tax_rates', 'org', 'connections'].forEach(function (id) { if (!S.errors[id] && bundle.data) S.data[id] = bundle.data[id]; });
    S.fetchedAt = bundle.fetchedAt || null; status('');
    // The first bundle only carries page 1 (per the platform's default hydration). Page onward now, in the
    // background, before the first render, so the on-screen totals are never a silently-truncated page 1.
    loadAll();
  }

  if (!MH) { status('Open this report in mySMB to load Xero data.'); return; }
  MH.onData(boot);
  if (MH.onRefresh) MH.onRefresh(function () { status('Refreshing…'); loadAll(); });
  if (MH.onThemeChange) MH.onThemeChange(function () { render(); });
})();
```
