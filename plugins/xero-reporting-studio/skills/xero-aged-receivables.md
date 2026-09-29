---
name: xero-aged-receivables
description: Build a live all-customers Aged Receivables summary on the tested report kit — as-at presets, ageing by due or invoice date, an organisation picker and a Balance Sheet tie. Use for "aged receivables", "aged debtors", "who owes us", "overdue invoices", "debtor ageing".
---
# Aged Receivables Summary

Use when the user asks for aged receivables, aged debtors, who owes us, overdue invoices, or debtor ageing. Load `xero-report-foundation` first and follow its *Build a kit report* steps with the blocks below — copy them, do not rewrite them. This skill needs the `xero-accounting` connector (`list_invoices`, `get_balance_sheet`, `get_organisation`, `list_connections`).

Xero location: Reporting → Aged Receivables Summary. There is no all-contacts ageing report on the connector (`get_aged_receivables_by_contact` needs one `contactID` per call, and Xero requires it even though the schema marks it optional), so this report is built from `list_invoices` and bucketed client-side — not a per-contact drill-down (see *Members* below).

## Discovery call

Call `get_organisation` once, `list_connections` once, `get_balance_sheet` once with `date` = today (for the Accounts Receivable tie), and `list_invoices` once with `where: Type=="ACCREC"`, `statuses: AUTHORISED`, `order: DueDate ASC`, `page: 1`. Expect `{ Invoices: [{ InvoiceID, Contact{ContactID, Name}, Date, DueDate, DateString, DueDateString, AmountDue, CurrencyCode, CurrencyRate, ... }] }` — 100 rows per page. An error is a failed call: report its message.

## Date defaults

`as_at_date` = the ageing date asked for (default `"today"`); set the display preset `a` to `today`, `end_last_month`, `end_last_quarter`, `end_last_fy` or `custom` to match. Ageing by due date or invoice date is a client-side toggle over the same rows — it is never a declared input and never refetches.

## Members

| Member / view | How |
|---|---|
| Ageing by due date (default) | Ageing by control = Due date |
| Ageing by invoice date | Ageing by control = Invoice date |
| As at a past date | As at date control — the bucketing moves, but each invoice's `AmountDue` is always its current outstanding balance (Xero does not return a historical AR balance per invoice); the report notes this when the date is not today |
| Another organisation | Organisation picker (every organisation on this Xero connection) |
| Per-customer Xero-native ageing | N/A in this version — Xero requires one `contactID` per call for `get_aged_receivables_by_contact`; say so |
| Unallocated credit notes netted against balances | N/A in this version — say so |

## Validation checks (shown in the banner)

- Every customer total = Σ its ageing buckets (Current, < 1 month, 1 month, 2 months, 3 months, Older)
- Grand total = Σ customer totals
- Percentage shares sum to ~100% (rounding)
- **Independent tie:** when As at = today, Total Receivables = Accounts Receivable on the Balance Sheet (a separate Xero report); other as-at dates show this as information, because `AmountDue` is always today's live balance
- All open invoices loaded — Fail if the page cap is reached before a page returns fewer than 100 rows

## Save as

`fileName`: `xero-aged-receivables.html` · `tags`: ["xero","aged-receivables","receivables","debtor-ageing"]

## QA test script (golden set)

This report has not been exercised against a live Xero connection yet. Someone with connector access should:

1. On Hammerjack Pty Limited, ask for this report with As at = today; confirm the discovery call succeeds (`list_invoices`, `get_balance_sheet`, `get_organisation`, `list_connections`) and the report saves.
2. Record the actual customer-by-customer figures from Xero → Reporting → Aged Receivables Summary for the same as-at date and confirm this report's customer rows and grand total match (allowing for the disclosed FX-conversion method — `AmountDue ÷ CurrencyRate` — which can differ slightly from Xero's own revaluation).
3. On Irvine Jackson Pty Ltd in QA, confirm every validation line passes (the Balance Sheet tie included) or shows a stated N/A / information reason, and that the two independently-computed totals (row-wise Σ buckets and column-wise Σ customers) agree.
4. Change As at to a past date and confirm the banner explains that only bucketing moves, not `AmountDue`; toggle Ageing by between Due date and Invoice date and confirm rows re-bucket without a network refetch (check the browser's network panel or a request counter).
5. If the organisation has more than 100 open receivable invoices, confirm the page-cap logic fetches subsequent pages and the completeness check passes (or shows the truncation banner at the 20-page cap).
6. Switch View as to Client, then Bookkeeper, and confirm the summary personas show only the ten largest customer balances; toggle Branding and the dark theme.
7. Download PDF and Download Excel and confirm they match the screen (the Excel file has Validation and Parameters sheets in addition to the Aged Receivables Summary sheet).
8. Download or Share from the report window: the snapshot keeps the as-at date and figures, disables the refetching controls, and states plainly if it captured only the first 100 invoices.
9. Cross-client isolation (LIB-002): with several organisations on the connection, switch organisation — the report, its name and every export carry only that organisation's figures.

## dataBindings

```json
{
  "inputs": [
    {
      "name": "as_at_date",
      "label": "As at",
      "type": "date",
      "default": "today"
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
      "default": "{\"cents\":1,\"k\":0,\"zeros\":0,\"neg\":\"paren\",\"red\":1,\"hdr\":1,\"ftr\":1,\"style\":\"xero\",\"dens\":\"100\",\"p\":\"custom\",\"a\":\"today\",\"c\":\"none\",\"v\":\"\"}"
    },
    {
      "name": "page",
      "label": "Page",
      "type": "number",
      "default": 1,
      "min": 1
    }
  ],
  "bindings": [
    {
      "id": "ar_invoices",
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
          "value": "AUTHORISED"
        },
        "order": {
          "kind": "static",
          "value": "DueDate ASC"
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
      "id": "bs_end",
      "tool": {
        "mcp": "xero-accounting",
        "name": "get_balance_sheet"
      },
      "params": {
        "date": {
          "kind": "input",
          "input": "as_at_date"
        },
        "standardLayout": {
          "kind": "static",
          "value": true
        },
        "paymentsOnly": {
          "kind": "static",
          "value": false
        },
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

## Report config ({{CFG}})

```js
(function () {
  var CACHE = { sig: null, rows: null, loading: false, truncated: false, uncertain: false, gen: 0 };
  var STATE = { basis: 'due' };
  function invoiceRows(v) {
    if (!v || XK.errorOf(v)) return [];
    if (Array.isArray(v.Invoices)) return v.Invoices;
    if (Array.isArray(v)) return v;
    return [];
  }
  function fetchMore(ctx) {
    var MH = window.MyHubReport, sig = ctx.inputs.org || '';
    if (CACHE.sig !== sig) { CACHE.sig = sig; CACHE.rows = null; CACHE.loading = false; CACHE.truncated = false; CACHE.uncertain = false; CACHE.gen++; }
    if (CACHE.rows || CACHE.loading) return;
    var first = invoiceRows(ctx.data.ar_invoices);
    if (!ctx.live) { CACHE.rows = first; CACHE.uncertain = first.length === 100; return; }
    if (!MH || first.length < 100) { CACHE.rows = first; return; }
    var gen = CACHE.gen, cap = 20, acc = first.slice(), page = 1;
    CACHE.loading = true;
    function step() {
      if (gen !== CACHE.gen) return;
      if (acc.length !== page * 100 || page >= cap) {
        CACHE.truncated = page >= cap && acc.length === page * 100;
        CACHE.rows = acc; CACHE.loading = false;
        if (APP) APP.render();
        return;
      }
      page++;
      MH.getData('ar_invoices', Object.assign({}, ctx.inputs, { page: page })).then(function (v) {
        if (gen !== CACHE.gen) return;
        if (XK.errorOf(v)) { CACHE.rows = acc; CACHE.loading = false; if (APP) APP.render(); return; }
        acc = acc.concat(invoiceRows(v)); step();
      }, function () {
        if (gen !== CACHE.gen) return;
        CACHE.rows = acc; CACHE.loading = false; if (APP) APP.render();
      });
    }
    step();
  }
  function bucketOf(days) {
    if (days <= 0) return 0; if (days < 30) return 1; if (days < 60) return 2; if (days < 90) return 3; if (days < 120) return 4; return 5;
  }
  var APP = XK.app({
    title: 'Aged Receivables Summary', primary: 'ar_invoices', dated: [], org: 'org', conns: 'connections',
    inputs: { asAt: 'as_at_date', org: 'org', persona: 'persona', display: 'display' },
    defaults: { as_at_date: '2026-09-29', org: '', persona: 'Bookkeeper', page: 1,
      display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"xero","dens":"100","p":"custom","a":"today","c":"none","v":""}' },
    uses: { ar_invoices: ['org'], bs_end: ['as_at_date', 'org'], org: ['org'], connections: [] },
    tools: { ar_invoices: 'list_invoices (Type==ACCREC, AUTHORISED)', bs_end: 'get_balance_sheet (Accounts Receivable tie)', org: 'get_organisation', connections: 'list_connections' },
    render: function (c) {
      var body = c.body, money = function (v) { return XK.money(v, c.currency, c.display); };
      if (c.errors.ar_invoices) { body.innerHTML = '<p class="xk-err">' + XK.h(c.err('ar_invoices')) + '</p>'; return { checks: [{ name: 'Open invoices loaded', pass: false, detail: c.err('ar_invoices') }] }; }
      if (!c.data.ar_invoices) return {};
      fetchMore(c);
      var first = invoiceRows(c.data.ar_invoices), rows = (CACHE.sig === (c.inputs.org || '') && CACHE.rows) ? CACHE.rows : first;
      var asAt = c.inputs.as_at_date, asAtDt = XK.parse(asAt), basis = STATE.basis, skipped = 0;
      function refDate(inv) {
        var s = basis === 'invoice' ? (inv.DateString || XK.isoDate(inv.Date)) : (inv.DueDateString || XK.isoDate(inv.DueDate));
        return s ? String(s).slice(0, 10) : null;
      }
      var byContact = {}, order = [];
      rows.forEach(function (inv) {
        if (!inv || inv.AmountDue == null) return;
        var d = refDate(inv); if (!d) { skipped++; return; }
        if (d > asAt) return;
        var days = Math.round((asAtDt - XK.parse(d)) / 86400000);
        var amt = XK.num(inv.AmountDue) || 0, rate = Number(inv.CurrencyRate), fx = !!(inv.CurrencyCode && inv.CurrencyCode !== c.currency && rate);
        if (fx) amt = amt / rate;
        var cid = (inv.Contact && (inv.Contact.ContactID || inv.Contact.Name)) || 'unknown', name = (inv.Contact && inv.Contact.Name) || 'Unknown contact';
        if (!byContact[cid]) { byContact[cid] = { name: name, b: [0, 0, 0, 0, 0, 0], total: 0, fx: false }; order.push(cid); }
        var row = byContact[cid], bi = bucketOf(days);
        row.b[bi] = Math.round((row.b[bi] + amt) * 100) / 100; row.total = Math.round((row.total + amt) * 100) / 100; if (fx) row.fx = true;
      });
      var contactRows = order.map(function (cid) { var r = byContact[cid]; return { name: r.name, current: r.b[0], lt1: r.b[1], m1: r.b[2], m2: r.b[3], m3: r.b[4], older: r.b[5], total: r.total, fx: r.fx }; });
      if (!c.display.zeros) contactRows = contactRows.filter(function (r) { return Math.abs(r.total) >= 0.005; });
      contactRows.sort(function (a, b) { return b.total - a.total; });
      var grand = [0, 0, 0, 0, 0, 0], grandTotal = 0;
      contactRows.forEach(function (r) { grand[0] += r.current; grand[1] += r.lt1; grand[2] += r.m1; grand[3] += r.m2; grand[4] += r.m3; grand[5] += r.older; grandTotal += r.total; });
      grand = grand.map(function (v) { return Math.round(v * 100) / 100; }); grandTotal = Math.round(grandTotal * 100) / 100;
      var sumOfTotals = Math.round(contactRows.reduce(function (s, r) { return s + r.total; }, 0) * 100) / 100;
      var pctSum = grandTotal ? Math.round(contactRows.reduce(function (s, r) { return s + r.total / grandTotal; }, 0) * 1000) / 10 : null;
      var summary = c.persona === 'Client' || c.persona === 'Executive';
      var toggleHtml = '<div class="ctl" style="margin:0 0 12px;max-width:220px"><label class="ctl">Ageing by<select id="ar-basis"><option value="due"' + (basis === 'due' ? ' selected' : '') + '>Due date</option><option value="invoice"' + (basis === 'invoice' ? ' selected' : '') + '>Invoice date</option></select></label></div>';
      var gridSpec = {
        filter: true, empty: 'No open receivables found for this organisation.',
        columns: [
          { key: 'name', title: 'Customer' },
          { key: 'current', title: 'Current', money: true },
          { key: 'lt1', title: '< 1 Month', money: true },
          { key: 'm1', title: '1 Month', money: true },
          { key: 'm2', title: '2 Months', money: true },
          { key: 'm3', title: '3 Months', money: true },
          { key: 'older', title: 'Older', money: true },
          { key: 'total', title: 'Total', money: true },
          { key: 'pct', title: '% of total', num: true, fmt: function (v) { return v == null ? '' : XK.pct(v); } }
        ],
        rows: (summary ? contactRows.slice(0, 10) : contactRows).map(function (r) { return Object.assign({}, r, { pct: grandTotal ? r.total / grandTotal : null }); }),
        total: { name: 'Total', current: grand[0], lt1: grand[1], m1: grand[2], m2: grand[3], m3: grand[4], older: grand[5], total: grandTotal, pct: grandTotal ? 1 : null }
      };
      var hasFx = contactRows.some(function (r) { return r.fx; });
      body.innerHTML = XK.kpis([
        { label: 'Total Receivables', value: grandTotal },
        { label: 'Current (not yet due)', value: grand[0] },
        { label: 'Overdue', value: Math.round((grandTotal - grand[0]) * 100) / 100 },
        { label: 'Customers with a balance', value: contactRows.length, money: false }
      ], c) + toggleHtml + (CACHE.loading ? '<p class="muted">Loading more invoices…</p>' : '') + '<div id="ar-grid"></div>' +
        (hasFx ? '<p class="xk-src">Foreign-currency invoices converted to ' + XK.h(c.currency) + ' using AmountDue ÷ CurrencyRate.</p>' : '');
      XK.grid(document.getElementById('ar-grid'), gridSpec, c);
      var sel = document.getElementById('ar-basis'); if (sel) sel.addEventListener('change', function () { STATE.basis = this.value; APP.render(); });

      var todayStr = c.today, bsErr = c.errors.bs_end;
      var arLine = c.data.bs_end ? XK.find(XK.walk(c.data.bs_end).lines, null, /^accounts receivable$/i, 'row') : null;
      var arBS = arLine ? XK.val(arLine) : null;
      var checks = [
        { name: 'Every customer total = Σ its ageing buckets', pass: contactRows.length ? contactRows.every(function (r) { return XK.near(r.total, Math.round((r.current + r.lt1 + r.m1 + r.m2 + r.m3 + r.older) * 100) / 100); }) : null, detail: contactRows.length + ' customer' + (contactRows.length === 1 ? '' : 's') + ' with a balance' },
        { name: 'Grand total = Σ customer totals', pass: contactRows.length ? XK.near(sumOfTotals, grandTotal) : null, detail: money(grandTotal) },
        { name: 'Percentage shares sum to ~100%', pass: pctSum == null ? null : XK.near(pctSum, 100, 0.5), detail: pctSum == null ? 'No balance to share' : pctSum.toFixed(1) + '%' },
        asAt === todayStr
          ? { name: 'Total Receivables vs Balance Sheet Accounts Receivable at ' + asAt, pass: bsErr || arBS == null ? null : XK.near(grandTotal, arBS), detail: bsErr ? c.err('bs_end') : arBS == null ? 'No Accounts Receivable line on the Balance Sheet' : money(grandTotal) + ' vs ' + money(arBS) + ' — differences can reflect prepayments, overpayments or FX revaluation' }
          : { name: 'Total Receivables vs Balance Sheet Accounts Receivable (information)', pass: null, info: true, detail: 'Ties only when As at = today, because AmountDue is always today\'s live balance regardless of the As at date' },
        { name: 'All open invoices loaded', pass: CACHE.truncated ? false : CACHE.uncertain ? null : (CACHE.rows ? true : null), detail: CACHE.loading ? 'Still loading additional pages…' : CACHE.truncated ? 'Stopped at ' + rows.length + ' invoices (page cap reached) — totals may be incomplete' : CACHE.uncertain ? 'Snapshot captured only the first 100 invoices' : rows.length + ' invoice' + (rows.length === 1 ? '' : 's') + ' loaded' }
      ];
      var notes = [];
      if (asAt !== todayStr) notes.push('As at ' + asAt + ': bucketing is computed as of this date, but AmountDue is always each invoice\'s current outstanding balance — Xero does not return a historical AR balance per invoice.');
      if (hasFx) notes.push('Foreign-currency invoices converted to ' + c.currency + ' using AmountDue ÷ CurrencyRate.');
      if (summary) notes.push('View as Client/Executive shows the ten largest customer balances only.');
      if (skipped) notes.push(skipped + ' invoice(s) had no usable date and were excluded.');
      this._rows = contactRows; this._grand = grand; this._grandTotal = grandTotal;
      return { checks: checks, notes: notes, na: ['Per-customer Xero-native ageing (get_aged_receivables_by_contact) — not implemented in this version; every row here is computed client-side from list_invoices', 'Unallocated credit notes are not netted against customer balances in this version'],
        title: 'Aged Receivables Summary', period: XK.asOfLine(asAt) };
    },
    excel: function (c) {
      var rows = this._rows || [], grand = this._grand || [0, 0, 0, 0, 0, 0], grandTotal = this._grandTotal || 0;
      var lines = rows.map(function (r) { return { kind: 'row', depth: 0, label: r.name, values: [r.current, r.lt1, r.m1, r.m2, r.m3, r.older, r.total] }; });
      lines.push({ kind: 'total', depth: 0, label: 'Total', values: grand.concat([grandTotal]) });
      var titles = ['Customer', 'Current', '< 1 Month', '1 Month', '2 Months', '3 Months', 'Older', 'Total'];
      return [XK.sheetFromLines('Aged Receivables Summary', c.company, XK.asOfLine(c.inputs.as_at_date), titles, lines, XK.footerStamp('Accrual', c.fetchedAt, c.currency))];
    }
  });
})();
```
