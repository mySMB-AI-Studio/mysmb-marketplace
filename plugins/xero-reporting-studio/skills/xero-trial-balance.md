---
name: xero-trial-balance
description: Build a live, validated Xero Trial Balance on the tested report kit — every account's debit and credit (and year to date) as at a date, accrual or cash basis, with debits = credits and a tie to Current Year Earnings. Use for "trial balance", "TB", "debits and credits", "account balances as at".
---
# Trial Balance (TB)

Use when the user asks for a trial balance, TB, debits and credits by account, or account balances as at a date. Load `xero-report-foundation` first and follow its *Build a kit report* steps with the blocks below — copy them, do not rewrite them. This skill needs the `xero-accounting` connector (`get_trial_balance`, `get_balance_sheet`, `get_organisation`, `list_connections`).

Xero location: Reporting → Trial Balance. Library: Xero Reports Prompt Library v1.2 → Prompts → TB. Delivery: Added skill (not in the P01–P15 library).

## Discovery call

Call `get_organisation` and `list_connections` once, and `get_trial_balance` once with `date` = today. Xero's layout is Account | Debit | Credit | YTD Debit | YTD Credit with Revenue / Expenses / Assets / Liabilities / Equity sections and a final Total row — the kit reads the columns from the Header row by label, so a different layout shows as N/A rather than a wrong check. An error is a failed call: report its message.

## Date defaults

`as_at` = the balance date (default `"today"`; display preset `a` = `today`, `end_last_month`, `end_last_quarter`, `end_last_fy` or `custom`). For a cash-basis request set the `basis` default to `Cash`.

## Members

| Member / view | How |
|---|---|
| Trial Balance | The one view |
| Cash basis | Accounting method = Cash (Xero payments only) |
| Comparison / tracking columns | N/A — get_trial_balance has no periods or tracking parameter |

## Validation checks (shown in the banner)

- Total Debits = Total Credits (each Debit / Credit pair, detected from the header)
- Xero's Total row = Σ the accounts
- Every section total = Σ its account rows (N/A when Xero sends no section totals)
- **Independent tie:** Revenue − Expenses (YTD columns) = Current Year Earnings on the Balance Sheet at the same date (accrual basis)

## Save as

`fileName`: `xero-trial-balance.html` · `tags`: ["xero","trial-balance","financial-statement"]

## QA test script (golden set)

1. On the golden-set organisation, ask for this report at the library's example period; confirm the discovery call succeeded and the report saved.
2. Compare the headline figures: Not in the library, so no golden-set figures. On Irvine Jackson Pty Ltd in QA, the totals equal Xero → Reporting → Trial Balance for the same date, and the column layout the report shows matches Xero's screen.
3. Validation banner: every check passes (the independent tie included), or shows N/A / information with a stated reason.
4. Change every control and confirm the report refetches and still validates; switch Accounting method; switch View as to Client, then Bookkeeper; toggle Branding and the dark theme.
5. Download PDF and Download Excel and confirm they match the screen (the Excel file has Validation and Parameters sheets).
6. Download or Share from the report window: the snapshot keeps the period and figures and disables the refetching controls.
7. Cross-client isolation (LIB-002): with several organisations on the connection, switch organisation — the report, its name and every export carry only that organisation's figures.

## dataBindings

```json
{
  "inputs": [
    {
      "name": "as_at",
      "label": "As at",
      "type": "date",
      "default": "today"
    },
    {
      "name": "basis",
      "label": "Accounting basis",
      "type": "enum",
      "options": [
        "Accrual",
        "Cash"
      ],
      "default": "Accrual"
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
      "default": "{\"cents\":1,\"k\":0,\"zeros\":0,\"neg\":\"paren\",\"red\":1,\"hdr\":1,\"ftr\":1,\"style\":\"xero\",\"dens\":\"100\",\"p\":\"custom\",\"a\":\"today\",\"c\":\"none\",\"v\":\"tb\"}"
    }
  ],
  "bindings": [
    {
      "id": "tb",
      "tool": {
        "mcp": "xero-accounting",
        "name": "get_trial_balance"
      },
      "params": {
        "date": {
          "kind": "input",
          "input": "as_at"
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
      "id": "tb_cash",
      "tool": {
        "mcp": "xero-accounting",
        "name": "get_trial_balance"
      },
      "params": {
        "date": {
          "kind": "input",
          "input": "as_at"
        },
        "paymentsOnly": {
          "kind": "static",
          "value": true
        },
        "xero_tenant_id": {
          "kind": "input",
          "input": "org"
        }
      }
    },
    {
      "id": "bs_tie",
      "tool": {
        "mcp": "xero-accounting",
        "name": "get_balance_sheet"
      },
      "params": {
        "date": {
          "kind": "input",
          "input": "as_at"
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

## Report document (copy verbatim — change only the config's `defaults`)

```html
<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Trial Balance</title>
<style>:root{--accent:#13B5EA;--btn:#0078C8;--btn-ink:#FFFFFF;--ink:#393A3D;--muted:#6B6C72;--line:#E3E5E8;--canvas:#F4F5F8;--card:#FFFFFF;--th:#6B6C72;--zebra:transparent;--neg:#D52B1E;--pos:#1B7F4B;--pass-bg:#EAF6E8;--fail-bg:#FDECEA;--band:#FFFFFF;--band-ink:#393A3D;--cover:#1B2A4A;--cover-ink:#FFFFFF;--c1:#13B5EA;--c2:#9E9E9E;--c3:#172B4D;--c4:#00B0A0;--c5:#E0457B;--c6:#6F2CBA;--d1:#13B5EA;--d2:#172B4D;--d3:#00B0A0;--d4:#E0457B;--d5:#6F2CBA;--d6:#9E9E9E}
:root[data-myhub-theme='dark']{--accent:#3CC4F0;--btn:#1590D4;--btn-ink:#FFFFFF;--ink:#E6E8EB;--muted:#A3A7AE;--line:#33363C;--canvas:#16181B;--card:#1F2226;--th:#A3A7AE;--neg:#FF6B5E;--pos:#4CC38A;--pass-bg:#18301A;--fail-bg:#3A1B19;--band:#1F2226;--band-ink:#E6E8EB;--cover:#22324F;--cover-ink:#FFFFFF;--c1:#3CC4F0;--c2:#80858D;--c3:#9FB3D1;--c4:#2BC4B3;--c5:#F06A96;--c6:#A77BE8;--d1:#3CC4F0;--d2:#9FB3D1;--d3:#2BC4B3;--d4:#F06A96;--d5:#A77BE8;--d6:#80858D}
:root.style-mysmb{--accent:#00B0A0;--btn:#007A6E;--zebra:#E6F7F5;--band:#007A6E;--band-ink:#FFFFFF;--cover:#007A6E;--th-bg:#007A6E;--th-ink:#FFFFFF;--c1:#007A6E;--c2:#00B0A0;--c3:#6F2CBA;--c4:#9E9E9E;--c5:#1B7F4B;--c6:#C8102E;--d1:#007A6E;--d2:#00B0A0;--d3:#6F2CBA;--d4:#9E9E9E;--d5:#1B7F4B;--d6:#C8102E;--pos:#1B7F4B;--neg:#C8102E}
:root[data-myhub-theme='dark'].style-mysmb{--accent:#2BC4B3;--btn:#138A7D;--zebra:#15302D;--band:#0E5A52;--band-ink:#FFFFFF;--cover:#0E5A52;--th-bg:#0E5A52;--th-ink:#FFFFFF;--c1:#2BB3A3;--c2:#3CCFBF;--c3:#A77BE8;--c4:#80858D;--c5:#4CC38A;--c6:#FF6B5E;--d1:#2BB3A3;--d2:#3CCFBF;--d3:#A77BE8;--d4:#80858D;--d5:#4CC38A;--d6:#FF6B5E;--pos:#4CC38A;--neg:#FF6B5E}
*{box-sizing:border-box}
body{margin:0;padding:16px;background:var(--canvas);color:var(--ink);font:14px/1.45 "Avenir Next","Segoe UI",system-ui,-apple-system,sans-serif;font-variant-numeric:tabular-nums}
a{color:var(--accent)}
#xk-controls{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:flex-end;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px 16px;margin-bottom:12px}
.ctl{display:flex;flex-direction:column;font-size:12px;color:var(--muted);gap:4px}
.ctl select,.ctl input[type=date],.xk-filter{font:inherit;font-size:13px;color:var(--ink);background:var(--card);border:1px solid var(--line);border-radius:4px;padding:6px 8px}
.ctl select:disabled,.ctl input:disabled{opacity:.6}
.seg{border:0;padding:0;margin:0;flex-direction:row;gap:0}
.seg legend{font-size:12px;color:var(--muted);padding:0 0 4px}
.seg label{border:1px solid var(--line);padding:6px 12px;color:var(--ink);cursor:pointer;font-size:13px}
.seg label:first-of-type{border-radius:4px 0 0 4px}.seg label:last-of-type{border-radius:0 4px 4px 0;border-left:0}
.seg input{position:absolute;opacity:0;pointer-events:none}
.seg label:has(input:checked){background:var(--card);box-shadow:inset 0 0 0 2px var(--accent);font-weight:600}
.customise summary{cursor:pointer;color:var(--ink);border:1px solid var(--line);border-radius:4px;padding:6px 10px;font-size:13px}
.cz{display:grid;grid-template-columns:repeat(2,minmax(160px,1fr));gap:6px 16px;padding:8px 0;font-size:13px;color:var(--ink)}
.btns{flex-direction:row;gap:8px;margin-left:auto}
.btns button,.btns a{font:inherit;font-size:13px;font-weight:600;border-radius:4px;padding:7px 14px;cursor:pointer;text-decoration:none;border:1px solid var(--btn);background:var(--card);color:var(--btn)}
.btns button#xk-xlsx{background:var(--btn);color:var(--btn-ink)}
#xk-status{font-size:12px;color:var(--muted);min-height:16px;margin:0 0 6px}
.xk-banner{border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:13px;border:1px solid var(--line)}
.xk-banner.pass{background:var(--pass-bg)}.xk-banner.na{border-color:var(--muted)}.xk-banner.fail{background:var(--fail-bg);border-color:var(--neg)}
.xk-banner ul{margin:6px 0 0;padding-left:18px}.xk-banner li.bad{color:var(--neg);font-weight:600}.xk-banner li.na{color:var(--muted)}
.xk-card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:20px 24px;margin-bottom:12px}
#xk-head{text-align:center;padding:8px 0 16px;background:var(--band);color:var(--band-ink);border-radius:6px}
:root.style-mysmb #xk-head{text-align:left;padding:14px 18px;margin-bottom:12px}
#xk-head .ti{font-size:18px;font-weight:700}#xk-head .co{font-size:14px}#xk-head .pe{font-size:14px;font-weight:600}
table{border-collapse:collapse;width:100%}
th{font-size:11px;font-variant:small-caps;letter-spacing:.04em;text-transform:lowercase;color:var(--th);font-weight:600;text-align:left;padding:8px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--card)}
.xk-grid th{cursor:pointer;user-select:none}
td{padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top}
tbody tr:nth-child(even) td{background:var(--zebra)}
.num{text-align:right;white-space:nowrap}
.k-header td{font-weight:600;border-bottom:0}.k-total td{font-weight:700;border-top:1px solid var(--ink)}
.neg{color:var(--neg)}
.muted{color:var(--muted)}.xk-err{color:var(--neg)}
.xk-scroll{overflow-x:auto}
.xk-filter{margin:0 0 8px;min-width:220px}
:root.dens-compact td{padding:3px 8px}:root.dens-compact body{font-size:12.5px}
.xk-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:0 0 16px}
.xk-kpi{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px 14px}
.xk-kpi .lbl{font-size:11px;font-variant:small-caps;text-transform:lowercase;letter-spacing:.04em;color:var(--muted);font-weight:600}
.xk-kpi .val{font-size:22px;font-weight:700;margin-top:2px}.xk-kpi .sub{font-size:12px;color:var(--muted)}
.chip{display:inline-block;font-size:11px;font-weight:700;border-radius:10px;padding:1px 8px;margin-top:4px}
.chip.up{background:var(--pass-bg);color:var(--pos)}.chip.down{background:var(--fail-bg);color:var(--neg)}
.xk-grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}
.xk-card h2,.xk-card h3{font-size:15px;margin:0 0 10px}
svg{width:100%;height:auto;max-height:300px;display:block;margin:0 auto}svg .axis{stroke:var(--line);stroke-width:1}svg .tick{fill:var(--muted);font-size:11px}
svg .donut-c{fill:var(--ink);font-size:15px;font-weight:700}
.xk-legend{display:flex;flex-wrap:wrap;gap:12px;font-size:12px;color:var(--muted);margin-top:6px}
.xk-legend i,.xk-donut li i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;vertical-align:middle}
.xk-donut{display:flex;gap:16px;align-items:center}.xk-donut svg{max-width:180px}.xk-donut ul{list-style:none;padding:0;margin:0;font-size:13px}.xk-donut li{margin:3px 0}
#xk-foot{color:var(--muted);font-size:12px;text-align:center;padding:12px 0 4px}
#xk-sources{font-size:12.5px;color:var(--muted)}#xk-sources h2{font-size:13px;color:var(--ink)}
.persona-summary .detail-block{display:none}
.persona-summary .keep-detail tr.detail-block{display:table-row}
.skel{height:14px;border-radius:4px;background:var(--line);margin:8px 0;opacity:.6}
.page{break-after:page}
@media (max-width:720px){.btns{margin-left:0}.cz{grid-template-columns:1fr}}
.xk-av{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:var(--accent);color:#fff;font-size:10px;font-weight:700;margin-right:6px;vertical-align:middle}
.xk-tabs{display:flex;gap:4px;flex-wrap:wrap;margin:0 0 12px;border-bottom:1px solid var(--line)}
.xk-tab{background:none;border:0;border-bottom:3px solid transparent;padding:8px 12px;font:inherit;color:var(--muted);cursor:pointer}
.xk-tab.on{color:var(--ink);border-bottom-color:var(--accent);font-weight:600}
.xk-link{background:none;border:0;padding:6px 0;color:var(--btn);cursor:pointer;font:inherit;text-decoration:underline}
.xk-grid3{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
.xk-widget .cur{font-size:22px;font-weight:700}.xk-widget .pri{color:var(--muted);font-size:12px}.xk-widget .insight{font-size:12px;color:var(--muted);margin-top:8px;border-top:1px dashed var(--line);padding-top:6px}
.xk-chip{display:inline-block;border:1px solid var(--line);border-radius:14px;padding:3px 10px;margin:2px;font-size:12px;background:var(--card);cursor:pointer}
.xk-chip.on{border-color:var(--accent);color:var(--ink);font-weight:600}
.xk-ok{color:var(--pos)}.xk-bad{color:var(--neg)}
.print-only{display:none}
@media print{.print-only{display:inline!important}body{background:var(--card);padding:0}#xk-controls,#xk-status,.no-print,.xk-filter{display:none!important}.xk-card{border:0;padding:0 0 12px}th{position:static}@page{size:A4 landscape;margin:12mm}}
/* QuickBooks branding accents (the accent follows the house-style toggle and the optional brand colour) */
#xk-controls{border-top:3px solid var(--accent)}
main.xk-card{border-top:4px solid var(--accent)}
.xk-kpi{border-left:4px solid var(--accent)}
.xk-stmt thead th,.xk-grid thead th{border-bottom:2px solid var(--accent)}
.xk-stmt tr.k-row td:first-child{color:var(--btn)}:root.style-mysmb .xk-stmt tr.k-row td:first-child{color:inherit}
.xk-src{font-size:12px;color:var(--muted);margin-top:4px}.xk-src i{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--accent);margin-right:6px;vertical-align:middle}
:root.style-mysmb #xk-head .xk-src{color:var(--band-ink);opacity:.85}:root.style-mysmb #xk-head .xk-src i{background:var(--band-ink)}
/* keep the right-hand amounts clear of the workspace's floating chat button */
@media (min-width:900px){body{padding-right:64px}}
@media print{body{padding-right:0}}
.xk-badge{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.06em;border-radius:10px;padding:1px 8px;margin-right:6px;vertical-align:middle;background:var(--accent);color:#FFFFFF}.xk-src .xk-badge+*{vertical-align:middle}
:root.style-mysmb .xk-stmt thead th,:root.style-mysmb .xk-grid thead th{background:var(--th-bg);color:var(--th-ink);border-bottom:0}
:root.style-mysmb #xk-head .ti{font-size:18px;font-weight:700}:root.style-mysmb #xk-head .co{font-size:14px}:root.style-mysmb .xk-badge{background:var(--band-ink);color:var(--band)}:root.style-mysmb .xk-kpi{border-left-color:var(--band)}</style>
</head>
<body class="persona-detail">
<div id="xk-controls" aria-label="Report controls"></div>
<div id="xk-status" role="status" aria-live="polite">Loading Xero data…</div>
<div id="xk-banner" class="xk-banner" role="region" aria-label="Validation"></div>
<main class="xk-card">
<header id="xk-head"></header>
<div id="xk-body"><div class="skel"></div><div class="skel"></div><div class="skel"></div></div>
<footer id="xk-foot"></footer>
</main>
<section id="xk-sources" class="xk-card" aria-label="Sources and limitations"></section>
<script>setTimeout(function () { if (!window.__reportStarted) { var s = document.getElementById("xk-status"); if (s) s.textContent = "This report failed to start. Press Refresh; if it keeps happening, ask for the report to be regenerated."; } }, 20000);</script>
<script>"use strict";(()=>{function num(v){if(v==null||v==="")return null;var n=Number(String(v).replace(/,/g,""));return isFinite(n)?n:null}function totalFor(label){return/^Total\s+(?!for\s)/i.test(label)?label.replace(/^Total\s+/i,"Total for "):label}function near(a,b,tol){return a!=null&&b!=null&&Math.abs(a-b)<=(tol==null?
.01:tol)}function sum(arr){var s=0;return arr.forEach(function(v){v!=null&&(s+=v)}),Math.round(s*100)/100}function errorOf(v){return v&&typeof v=="object"&&!Array.isArray(v)&&v.__error!=null?String(v.__error):null}function reportOf(v){return!v||errorOf(v)?null:Array.isArray(v.Reports)?v.Reports[0]||null:Array.isArray(v.Rows)?v:null}function attr(cell,id){var a=(cell&&cell.Attributes||[]).filter(function(x){return x&&(x.Id===id||id==="account"&&/^accountid$/i.test(x.Id||""))})[0];return a?a.Value:null}function walk(v){var rep=reportOf(v),out={lines:[],columns:[],titles:[],date:null,name:null,sections:[]};if(!rep)return out;out.titles=rep.ReportTitles||[],out.date=rep.ReportDate||null,out.name=rep.ReportName||null;var parent=null,vals=function(c){return c.slice(1).map(function(x){return num(x&&x.Value)})},
lbl=function(c){return String((c[0]||{}).Value||"")};return(rep.Rows||[]).forEach(function(r){if(r){var c=r.Cells||[];if(r.RowType==="Header"){out.columns=c.slice(1).map(function(x){return x&&x.Value||""});return}if(r.RowType!=="Section"){c.length&&out.lines.push({kind:"total",depth:0,label:lbl(c),group:lbl(
c),parent:null,calc:!0,fixed:!0,values:vals(c),path:[]});return}var title=String(r.Title||""),kids=r.Rows||[];if(title&&!kids.length){parent=title,out.lines.push({kind:"header",depth:0,label:title,group:title,parent:null,values:[],path:[]});return}var hasRow=kids.some(function(k){return k&&k.RowType===
"Row"}),real=kids.some(function(k){return k&&k.RowType==="Row"&&attr((k.Cells||[])[0],"account")})||hasRow&&kids.some(function(k){return k&&k.RowType==="SummaryRow"});if(!title&&!real){kids.forEach(function(k){var kc=k.Cells||[],label=lbl(kc),closes=parent&&label.toLowerCase()===("total "+parent).toLowerCase()?
parent:null;out.lines.push({kind:"total",depth:0,label,group:closes||label,parent:null,calc:!closes,closes,fixed:!0,values:vals(kc),path:[]}),closes&&(parent=null)});return}var d=parent?1:0,shown=title.replace(/^Less\s+/i,""),sec={title,label:shown,parent,rows:[],summary:null};title&&out.lines.push(
{kind:"header",depth:d,label:shown,group:title,parent,values:[],path:parent?[parent]:[]}),kids.forEach(function(k){var kc=k.Cells||[],label=lbl(kc),line;k.RowType==="SummaryRow"?(line={kind:"total",depth:d,label,group:title,parent,fixed:!0,values:vals(kc),path:[]},sec.summary=line):(line={kind:"row",
depth:d+1,label,id:attr(kc[0],"account")||attr(kc[1],"account"),group:title,parent,values:vals(kc),path:(parent?[parent]:[]).concat([shown])},sec.rows.push(line)),out.lines.push(line)}),out.sections.push(sec)}}),out}function linesTies(lines,tol){var res={checked:0,failed:[]};return lines.forEach(function(t){if(!(t.kind!=="total"||t.calc||t.closes)){var mem=lines.filter(function(l){return l.kind==="row"&&l.group===t.group});res.checked++,t.values.forEach(function(v,i){near(v,sum(mem.map(function(l){return l.values[i]})),
tol)||res.failed.indexOf(t.label)<0&&res.failed.push(t.label)})}}),res}var CYE_RE=/^current year('s)? earnings$|^current earnings$/i;function currentYearEarnings(bsLines){var r=bsLines.filter(function(l){return l.kind==="row"&&/^equity$/i.test(l.group)&&CYE_RE.test(l.label)})[0];return r||null}function find(lines,group,labelRe,kind){var kinds=kind?[kind]:["total","row"],
i,j;for(j=0;j<kinds.length;j++){if(group){for(i=0;i<lines.length;i++)if(lines[i].group===group&&lines[i].kind===kinds[j])return lines[i]}if(labelRe){for(i=0;i<lines.length;i++)if(lines[i].kind===kinds[j]&&labelRe.test(lines[i].label))return lines[i]}}return null}function val(line,col){return line?line.
values[col==null?0:col]:null}function orgOf(v){var o=v&&!errorOf(v)&&Array.isArray(v.Organisations)?v.Organisations[0]:null;return o?{name:o.Name||o.LegalName||null,currency:o.BaseCurrency||null,country:o.CountryCode||null,fyEndMonth:Number(o.FinancialYearEndMonth)||null,fyEndDay:Number(o.FinancialYearEndDay)||null,shortCode:o.
ShortCode||null,id:o.OrganisationID||null}:null}function connections(v){var t=!v||errorOf(v)?[]:Array.isArray(v.tenants)?v.tenants:Array.isArray(v)?v:[];return{active:v&&v.activeTenantId||null,list:t.map(function(x){return{id:String(x.tenantId||""),name:x.tenantName||"",type:x.tenantType||""}}).filter(
function(x){return x.id})}}function companyOf(orgResp,connResp,chosenId,titles){var o=orgOf(orgResp),cn=connections(connResp),id=chosenId||cn.active||null,t=cn.list.filter(function(x){return x.id===id})[0],fromTitle=titles&&titles[1]?String(titles[1]):null;return{name:o&&o.name||t&&t.name||fromTitle,
id,currency:o?o.currency:null,country:o?o.country:null,org:o,orgs:cn.list,active:cn.active,source:o?"get_organisation":t?"list_connections":fromTitle?"report title":null}}var MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];function fiscalStart(org,fyMonth){
return fyMonth?{month:fyMonth,source:"report setting"}:org&&org.fyEndMonth>=1&&org.fyEndMonth<=12?{month:org.fyEndMonth%12+1,source:"Xero organisation settings \u2014 year ends "+(org.fyEndDay||eom(2026,org.fyEndMonth).getUTCDate())+" "+MONTHS[org.fyEndMonth-1]}:org&&/^nz/i.test(org.country||"")?{month:4,
source:"assumed \u2014 NZ default; Xero did not return the organisation's financial year"}:{month:7,source:"assumed \u2014 AU default; Xero did not return the organisation's financial year"}}function homeCurrency(org){return org&&org.currency||(org&&/^nz/i.test(org.country||"")?"NZD":"AUD")}function titleDates(s){
for(var out=[],re=/(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/g,m;m=re.exec(String(s||""));)out.push(iso(D(+m[3],MONTHS.indexOf(m[2])+1,+m[1])));return out}var SYM={AUD:"$",NZD:"$",USD:"US$",CAD:"C$",GBP:"\xA3",EUR:"\u20AC",PHP:"\u20B1",
SGD:"S$",HKD:"HK$",JPY:"\xA5",INR:"\u20B9"};function symbol(code){return SYM[code]||(code?code+" ":"")}var DISPLAY_DEFAULT={cents:1,k:0,zeros:1,neg:"minus",red:0,hdr:1,ftr:1,style:"xero",dens:"100",p:"custom",a:"custom",c:"none",v:"",x:"",b:"",o:"",pv:"",fy:""},HEX=/^#[0-9a-f]{6}$/i;function shade(hex,f){
var n=parseInt(hex.slice(1),16),r=n>>16,g=n>>8&255,b=n&255,t=function(c){return Math.max(0,Math.min(255,Math.round(f<0?c*(1+f):c+(255-c)*f)))};return"#"+[t(r),t(g),t(b)].map(function(x){return x.toString(16).padStart(2,"0")}).join("")}function applyBrand(root,hex){var props=["--accent","--btn","--c1",
"--d1","--pos"];if(!HEX.test(hex||""))return props.forEach(function(p){root.style.removeProperty(p)}),!1;var dark=root.getAttribute("data-myhub-theme")==="dark",a=dark?shade(hex,.25):hex;return root.style.setProperty("--accent",a),root.style.setProperty("--btn",dark?hex:shade(hex,-.2)),root.style.setProperty(
"--c1",a),root.style.setProperty("--d1",a),root.style.setProperty("--pos",a),!0}function readDisplay(str){var d={},k,src={};try{src=JSON.parse(str||"{}")||{}}catch(e){src={}}for(k in DISPLAY_DEFAULT)d[k]=src[k]!=null?src[k]:DISPLAY_DEFAULT[k];return d}function writeDisplay(d){var o={},k;for(k in DISPLAY_DEFAULT)
o[k]=d[k];return JSON.stringify(o)}function money(v,cur,d){if(v==null||v==="")return"";d=d||DISPLAY_DEFAULT;var n=Number(v);if(!isFinite(n))return String(v);d.k&&(n=n/1e3);var dp=d.cents&&!d.k?2:d.k?1:0,abs=Math.abs(n).toLocaleString("en-AU",{minimumFractionDigits:dp,maximumFractionDigits:dp}),s=symbol(
cur)+abs+(d.k?"k":"");return n<0&&Number(abs.replace(/,/g,""))!==0&&(s=d.neg==="paren"?"("+s+")":d.neg==="trail"?s+"-":"-"+s),s}function pct(v,dp){return v==null||!isFinite(v)?"":(v*100).toFixed(dp==null?1:dp)+"%"}function isNeg(v){return v!=null&&Number(v)<0}function iso(dt){return dt.getUTCFullYear()+
"-"+String(dt.getUTCMonth()+1).padStart(2,"0")+"-"+String(dt.getUTCDate()).padStart(2,"0")}function D(y,m,d){return new Date(Date.UTC(y,m-1,d))}function parse(s){var p=String(s).split("-");return D(+p[0],+p[1],+p[2])}function addDays(dt,n){return new Date(dt.getTime()+n*864e5)}function eom(y,m){return D(
y,m+1,0)}function today(){var t=new Date;return D(t.getFullYear(),t.getMonth()+1,t.getDate())}function fyStartOf(dt,fyMonth){var y=dt.getUTCFullYear();return dt.getUTCMonth()+1<fyMonth&&(y-=1),D(y,fyMonth,1)}var PRESETS=[["today","Today"],["this_week","This week"],["this_week_td","This week to date"],
["this_month","This month"],["this_month_td","This month to date"],["this_quarter","This quarter"],["this_quarter_td","This quarter to date"],["this_fy","This financial year"],["this_fy_td","This financial year to date"],["last_week","Last week"],["last_month","Last month"],["last_quarter","Last qua\
rter"],["last_fy","Last financial year"],["last_30","Last 30 days"],["since_60","Since 60 days ago"],["since_90","Since 90 days ago"],["since_365","Since 365 days ago"],["custom","Custom"]];function preset(key,fyMonth,now){var t=now?parse(now):today(),y=t.getUTCFullYear(),m=t.getUTCMonth()+1,dow=(t.
getUTCDay()+6)%7,qs=Math.floor((m-1)/3)*3+1,fs=fyStartOf(t,fyMonth||7),r;switch(key){case"today":r=[t,t];break;case"this_week":r=[addDays(t,-dow),addDays(t,6-dow)];break;case"this_week_td":r=[addDays(t,-dow),t];break;case"this_month":r=[D(y,m,1),eom(y,m)];break;case"this_month_td":r=[D(y,m,1),t];break;case"\
this_quarter":r=[D(y,qs,1),eom(y,qs+2)];break;case"this_quarter_td":r=[D(y,qs,1),t];break;case"this_fy":r=[fs,addDays(D(fs.getUTCFullYear()+1,fs.getUTCMonth()+1,1),-1)];break;case"this_fy_td":r=[fs,t];break;case"last_week":r=[addDays(t,-dow-7),addDays(t,-dow-1)];break;case"last_month":r=[D(y,m-1,1),
eom(y,m-1)];break;case"last_quarter":r=[D(y,qs-3,1),eom(y,qs-1)];break;case"last_fy":r=[D(fs.getUTCFullYear()-1,fs.getUTCMonth()+1,1),addDays(fs,-1)];break;case"last_30":r=[addDays(t,-29),t];break;case"since_60":r=[addDays(t,-60),t];break;case"since_90":r=[addDays(t,-90),t];break;case"since_365":r=[
addDays(t,-365),t];break;case"last_12m":r=[D(y,m-12,1),eom(y,m-1)];break;case"last_24m":r=[D(y,m-24,1),eom(y,m-1)];break;default:return null}return{start:iso(r[0]),end:iso(r[1])}}var ASAT=[["today","Today"],["end_this_month","End of this month"],["end_last_month","End of last month"],["end_last_quar\
ter","End of last quarter"],["end_last_fy","End of last financial year"],["custom","Custom"]];function asAt(key,fyMonth,now){var t=now?parse(now):today(),y=t.getUTCFullYear(),m=t.getUTCMonth()+1,qs=Math.floor((m-1)/3)*3+1;switch(key){case"today":return iso(t);case"end_this_month":return iso(eom(y,m));case"\
end_last_month":return iso(eom(y,m-1));case"end_last_quarter":return iso(eom(y,qs-1));case"end_last_fy":return iso(addDays(fyStartOf(t,fyMonth||7),-1));default:return null}}function compare(start,end,mode,fyMonth){var s=parse(start),e=parse(end),len;if(mode==="prev_year")return{start:iso(D(s.getUTCFullYear()-
1,s.getUTCMonth()+1,Math.min(s.getUTCDate(),eom(s.getUTCFullYear()-1,s.getUTCMonth()+1).getUTCDate()))),end:iso(D(e.getUTCFullYear()-1,e.getUTCMonth()+1,Math.min(e.getUTCDate(),eom(e.getUTCFullYear()-1,e.getUTCMonth()+1).getUTCDate())))};if(mode==="ytd")return{start:iso(fyStartOf(e,fyMonth||7)),end};
if(s.getUTCDate()===1&&iso(e)===iso(eom(e.getUTCFullYear(),e.getUTCMonth()+1))){var months=(e.getUTCFullYear()-s.getUTCFullYear())*12+(e.getUTCMonth()-s.getUTCMonth())+1;return{start:iso(D(s.getUTCFullYear(),s.getUTCMonth()+1-months,1)),end:iso(addDays(s,-1))}}return len=Math.round((e-s)/864e5),{start:iso(
addDays(s,-len-1)),end:iso(addDays(s,-1))}}var MON=["January","February","March","April","May","June","July","August","September","October","November","December"];function longDate(x){return x.getUTCDate()+" "+MON[x.getUTCMonth()]+" "+x.getUTCFullYear()}function periodLine(start,end){var s=parse(start),e=parse(end),ey=e.getUTCFullYear();if(s.getUTCDate()===1&&iso(e)===iso(eom(ey,e.getUTCMonth()+1))){var months=(ey-s.getUTCFullYear())*12+(e.getUTCMonth()-s.getUTCMonth())+
1;if(months===1)return"For the month ended "+longDate(e);if(months===12)return"For the year ended "+longDate(e);if(months>1)return"For the "+months+" months ended "+longDate(e)}return"For the period "+longDate(s)+" to "+longDate(e)}function asOfLine(d){var x=parse(d);return"As at "+x.getUTCDate()+" "+MON[x.getUTCMonth()]+" "+x.getUTCFullYear()}function footerStamp(basis,fetchedAt,cur){var t=fetchedAt?new Date(fetchedAt):new Date,wd=t.toLocaleDateString("en-AU",{weekday:"long"}),dm=t.getDate()+" "+MON[t.getMonth()]+", "+t.getFullYear(),
hm=t.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",hour12:!0}),off=-t.getTimezoneOffset(),sign=off>=0?"+":"-",a=Math.abs(off),tz="GMT"+sign+String(Math.floor(a/60)).padStart(2,"0")+":"+String(a%60).padStart(2,"0");return(basis==null?cur||"":(basis==="Cash"?"Cash basis":"Accrual basis")+
(cur?" \xB7 "+cur:""))+" | "+wd+", "+dm+" "+hm+" "+tz}var CRC=(function(){var t=[],c,n,k;for(n=0;n<256;n++){for(c=n,k=0;k<8;k++)c=c&1?3988292384^c>>>1:c>>>1;t[n]=c>>>0}return t})();function crc32(b){for(var c=4294967295,i=0;i<b.length;i++)c=CRC[(c^b[i])&255]^c>>>8;return(c^4294967295)>>>0}function utf8(s){return new TextEncoder().encode(s)}function zip(files){
var parts=[],central=[],off=0;function u16(v){return[v&255,v>>>8&255]}function u32(v){return[v&255,v>>>8&255,v>>>16&255,v>>>24&255]}files.forEach(function(f){var name=utf8(f.name),data=utf8(f.data),crc=crc32(data),head=[].concat([80,75,3,4],u16(20),u16(2048),u16(0),u16(0),u16(33),u32(crc),u32(data.length),
u32(data.length),u16(name.length),u16(0));parts.push(new Uint8Array(head),name,data),central.push(new Uint8Array([].concat([80,75,1,2],u16(20),u16(20),u16(2048),u16(0),u16(0),u16(33),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(off))),name),off+=
head.length+name.length+data.length});var csize=0;central.forEach(function(p){csize+=p.length});var end=new Uint8Array([].concat([80,75,5,6],u16(0),u16(0),u16(files.length),u16(files.length),u32(csize),u32(off),u16(0))),all=parts.concat(central,[end]),total=0;all.forEach(function(p){total+=p.length});
var out=new Uint8Array(total),pos=0;return all.forEach(function(p){out.set(p,pos),pos+=p.length}),out}function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function colName(i){var s="";for(i++;i>0;){var m=(i-1)%26;s=String.fromCharCode(
65+m)+s,i=Math.floor((i-1)/26)}return s}function xlsx(sheets,cur){var sym=esc(symbol(cur||"AUD").trim()).replace(/"/g,""),moneyFmt="#,##0.00;(#,##0.00)",STY={none:0,bold:1,money:2,moneyBold:3,title:4,pct:5,muted:6},styles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="htt\
p://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="'+moneyFmt+'"/></numFmts><fonts count="4"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><name val="Arial"/></font><font><b/><sz val="12"/><name val="Arial"/></font><f\
ont><sz val="9"/><color rgb="FF6B6C72"/><name val="Arial"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count\
="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNu\
mberFormat="1"/><xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId\
="3" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>',files=[],wbSheets="",wbRels="",ct="",used={};sheets.forEach(function(sh,si){for(var n=si+1,rowsXml="",nm=String(sh.name||"Sheet"+n).replace(
/[\\\/\?\*\[\]:]/g," ").slice(0,31)||"Sheet"+n;used[nm.toLowerCase()];)nm=nm.slice(0,28)+" "+n;used[nm.toLowerCase()]=1,(sh.rows||[]).forEach(function(row,ri){var cells="";(row||[]).forEach(function(c,ci){if(!(c==null||c==="")){var o=typeof c=="object"?c:{v:c},ref=colName(ci)+(ri+1),s=STY[o.s||(typeof o.
v=="number"?"money":"none")]||0;o.f?cells+='<c r="'+ref+'" s="'+s+'"><f>'+esc(o.f)+"</f>"+(typeof o.v=="number"?"<v>"+o.v+"</v>":"")+"</c>":typeof o.v=="number"&&isFinite(o.v)?cells+='<c r="'+ref+'" s="'+s+'"><v>'+o.v+"</v></c>":cells+='<c r="'+ref+'" s="'+s+'" t="inlineStr"><is><t xml:space="preser\
ve">'+esc(new Array((o.indent||0)+1).join("   ")+(o.v==null?"":o.v))+"</t></is></c>"}}),rowsXml+='<row r="'+(ri+1)+'">'+cells+"</row>"});var colsXml=sh.widths?"<cols>"+sh.widths.map(function(w,i){return'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+w+'" customWidth="1"/>'}).join("")+"</cols>":"";files.
push({name:"xl/worksheets/sheet"+n+".xml",data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+colsXml+"<sheetData>"+rowsXml+"</sheetData></worksheet>"}),wbSheets+='<sheet name="'+esc(nm)+'" sheetId="'+n+'" r:id="\
rId'+n+'"/>',wbRels+='<Relationship Id="rId'+n+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+n+'.xml"/>',ct+='<Override PartName="/xl/worksheets/sheet'+n+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetm\
l.worksheet+xml"/>'});var k=sheets.length+1;return wbRels+='<Relationship Id="rId'+k+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',files.unshift({name:"[Content_Types].xml",data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Typ\
es xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxml\
formats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+ct+"</Types>"},{name:"_rels/.rels",data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http\
://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},{name:"xl/workbook.xml",data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"\
?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+wbSheets+"</sheets></workbook>"},{name:"xl/_rels/workbook.xml.rels",data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Rela\
tionships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+wbRels+"</Relationships>"},{name:"xl/styles.xml",data:styles}),zip(files)}function sheetFromLines(title,company,period,colTitles,lines,footer,fmts){var rows=[[{v:company||"N/A \u2014 not in source",s:"title"}],[{v:title,
s:"bold"}],[period],[],colTitles.map(function(t){return{v:t,s:"bold"}})];lines.forEach(function(l){var bold=l.kind==="total"||l.kind==="header",r=[{v:l.label,s:bold?"bold":"none",indent:l.depth}];(l.values||[]).forEach(function(v,i){var f=fmts&&fmts[i];r.push(v==null?null:{v,s:f==="pct"?"pct":bold?"\
moneyBold":"money"})}),rows.push(r)}),footer&&(rows.push([]),rows.push([{v:footer,s:"muted"}]));var widths=[48];return colTitles.slice(1).forEach(function(){widths.push(18)}),{name:title,rows,widths}}function download(bytes,name,mime){var blob=new Blob([bytes],{type:mime||"application/vnd.openxmlfor\
mats-officedocument.spreadsheetml.sheet"}),a=document.createElement("a");a.href=URL.createObjectURL(blob),a.download=name,document.body.appendChild(a),a.click(),setTimeout(function(){URL.revokeObjectURL(a.href),a.remove()},1500)}function reportParams(v){var d=v.display||DISPLAY_DEFAULT,p={from_date:v.
start||null,to_date:v.end||null,as_at:v.asAt||null,accounting_basis:v.basis||null,xero_tenant_id:v.org||null,cents:d.cents?"shown":"hidden",divide_by_1000:d.k?"yes":"no",zero_rows:d.zeros?"shown":"hidden",negatives:d.neg,negatives_in_red:d.red?"yes":"no",header:d.hdr?"shown":"hidden",footer:d.ftr?"s\
hown":"hidden"};return Object.keys(p).forEach(function(k){p[k]==null&&delete p[k]}),p}function h(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function negCls(v,d){return d&&d.red&&isNeg(v)?" neg":""}function isZeroLine(l){return l.
kind==="row"&&!(l.values||[]).some(function(v){return v!=null&&Math.abs(v)>=.005})}function statement(lines,colTitles,ctx,extraCols){var d=ctx.display,cur=ctx.currency,ex=extraCols||[],th=colTitles.concat(ex.map(function(e){return e.title})),out='<table class="xk-stmt"><thead><tr>'+th.map(function(t,i){
return"<th"+(i?' class="num"':"")+' scope="col">'+h(t)+"</th>"}).join("")+"</tr></thead><tbody>";return lines.forEach(function(l){if(!(!d.zeros&&isZeroLine(l))){var label=l.kind==="total"&&!l.fixed?totalFor(l.label):l.label;out+='<tr class="k-'+l.kind+(l.kind==="row"?" detail-block":"")+'"><td style\
="padding-left:'+(8+l.depth*18)+'px">'+h(label)+"</td>";for(var i=0;i<colTitles.length-1;i++){var v=(l.values||[])[i];out+='<td class="num'+negCls(v,d)+'">'+(l.kind==="header"?"":money(v,cur,d))+"</td>"}ex.forEach(function(e){var v2=l.kind==="header"?null:e.value(l);out+='<td class="num'+negCls(v2,d)+
'">'+(v2==null?"":e.fmt==="pct"?pct(v2):money(v2,cur,d))+"</td>"}),out+="</tr>"}}),out+"</tbody></table>"}function kpis(items,ctx){return'<div class="xk-kpis">'+items.map(function(k){var v=k.text!=null?h(k.text):k.money===!1?h(k.value==null?"N/A":k.value):k.value==null?"N/A \u2014 not in source":money(k.value,ctx.currency,ctx.display),chip=k.delta==null||!isFinite(k.delta)?"":'<span class="chip '+(k.delta>=
0?"up":"down")+'">'+(k.delta>=0?"\u25B2 ":"\u25BC ")+pct(Math.abs(k.delta),0)+"</span>";return'<div class="xk-kpi"><div class="lbl">'+h(k.label)+'</div><div class="val'+(k.red?" neg":negCls(k.value,ctx.display))+'">'+v+"</div>"+chip+(k.sub?'<div class="sub">'+h(k.sub)+"</div>":"")+"</div>"}).join("")+
"</div>"}var FRIENDLY={needs_connection:"Connect Xero (Settings \u2192 Connections) to see this data.",connection_unavailable:"Xero is temporarily unavailable \u2014 press Refresh to try again.",tool_not_found:"This Xero report is not available on the connected connector.",tool_error:"Xero returned \
an error for this section.",invalid_inputs:"One of the report controls has an invalid value."},MECHANISM="xero-accounting connector \u2014 mySMB custom MCP on the Xero Accounting API (AGT-001)";function app(cfg){var MH=window.MyHubReport,live=!!(MH&&MH.mode!=="snapshot"),I=cfg.inputs||{},S={inputs:Object.
assign({},cfg.defaults),data:{},errors:{},fetchedAt:null,first:!0,busy:0,pages:{},trunc:{}},$=function(id){return document.getElementById(id)};function disp(){return readDisplay(I.display?S.inputs[I.display]:"")}function setDisp(patch){if(I.display){var d=disp(),k;for(k in patch)d[k]=patch[k];S.inputs[I.
display]=writeDisplay(d)}}function co(){return companyOf(S.data[cfg.org],S.data[cfg.conns],I.org?S.inputs[I.org]:"",(reportOf(S.data[cfg.primary])||{}).ReportTitles)}function fy(){var e=+disp().fy;return e>=1&&e<=12?{month:e%12+1,source:"set in this report \u2014 year ends "+MONTHS[e-1],set:!0}:fiscalStart(
co().org,cfg.fyMonth)}function absorb(id,v){var e=errorOf(v);S.pages[id]=null,S.trunc[id]=!1,e?(delete S.data[id],S.errors[id]={code:"tool_error",message:e}):(S.data[id]=v,delete S.errors[id])}function srcOf(id){return(cfg.sources||{})[id]||null}function quiet(id){var sc=srcOf(id);return!!(sc&&sc.quiet&&
sc.quiet(Object.assign({},S.inputs)))}function err(id){var e=S.errors[id],sc=srcOf(id);return e?e.code==="needs_connection"&&sc?sc.name+" is not connected \u2014 add the "+sc.name+" extension and connect it (Settings \u2192 Connections) to include this.":(FRIENDLY[e.code]||e.message||"Unavailable")+
(e.code==="tool_error"&&e.message?" ("+e.message+")":""):null}function announce(){MH&&live&&MH.setInputs(Object.assign({},S.inputs))}function status(t){var el=$("xk-status");el&&(el.textContent=t||"")}var RATE=/\b429\b|rate.?limit|too many requests/i;function limited(){return Object.keys(S.errors).filter(
function(id){var e=S.errors[id];return e&&RATE.test(String(e.message||""))})}function fetchOne(id,inputs){S.req=S.req||{};var tok=S.req[id]=(S.req[id]||0)+1,latest=function(){return S.req[id]===tok};return MH.getData(id,inputs).then(function(v){latest()&&absorb(id,v)},function(e){latest()&&(S.errors[id]=
{code:e&&e.code||"tool_error",message:e&&e.message||String(e)})})}function retryLimited(round){var ids=limited();if(!MH||!live||!ids.length||round>3)return Promise.resolve(!1);S.busy++,status("Xero is busy \u2014 loading "+ids.length+" more section"+(ids.length>1?"s":"")+"\u2026");var inputs=Object.
assign({},S.inputs),wait=function(ms){return new Promise(function(r){setTimeout(r,ms)})};return ids.reduce(function(p,id){return p.then(function(){return wait(round*(cfg.retryMs==null?700:cfg.retryMs))}).then(function(){return fetchOne(id,inputs)})},Promise.resolve()).then(function(){return S.busy--,
status(""),S.fetchedAt=new Date().toISOString(),render(),retryLimited(round+1)})}function pageAll(){var P=cfg.paged||{},ids=Object.keys(P).filter(function(id){return S.data[id]&&!S.pages[id]});return!MH||!live||!ids.length?Promise.resolve(!1):(S.busy++,ids.reduce(function(p,id){return p.then(function(){
return more(id)})},Promise.resolve()).then(function(){return S.busy--,status(""),render(),!0}))}function more(id){var P=cfg.paged[id],size=P.size||100,max=P.max||20,got=S.pages[id]=[S.data[id]],first=S.data[id],tries=0,wait=function(ms){return new Promise(function(r){setTimeout(r,ms)})};function step(){
if(S.data[id]!==first)return Promise.resolve();var rows2=(got[got.length-1]||{})[P.key]||[];if(rows2.length<size)return Promise.resolve();if(got.length>=max)return S.trunc[id]=!0,Promise.resolve();var inp=Object.assign({},S.inputs);return inp[P.input]=got.length+1,status("Loading "+((cfg.tools||{})[id]||
id)+" \u2014 page "+(got.length+1)+"\u2026"),MH.getData(id,inp).then(function(v){if(errorOf(v))throw new Error(errorOf(v));return S.data[id]===first&&(got.push(v),tries=0),step()},function(e){var msg=e&&e.message||String(e);if(RATE.test(msg)&&tries++<3)return wait(tries*(cfg.retryMs==null?700:cfg.retryMs)).
then(step);S.data[id]===first&&(S.trunc[id]=!0,S.pageError=S.pageError||{},S.pageError[id]=msg)})}return step()}function fanAll(){var F=cfg.fan||{},ids=Object.keys(F);if(!MH||!live||!ids.length)return Promise.resolve(!1);S.fan=S.fan||{};var c=ctx(),jobs=[];if(ids.forEach(function(id){var list=F[id](
Object.assign({},S.inputs),c)||[],sig=JSON.stringify([S.inputs[I.org]||"",list]);if(!(S.fan[id]&&S.fan[id].sig===sig)){var st=S.fan[id]={sig,items:list.map(function(x){return{key:x.key,value:null,error:null,done:!1}})};list.forEach(function(x,i){jobs.push({id,st,i,inputs:Object.assign({},S.inputs,x.
inputs)})})}}),!jobs.length)return Promise.resolve(!1);var conc=cfg.fanConc||2,next=0,wait=function(ms){return new Promise(function(r){setTimeout(r,ms)})};S.busy++,status("Loading "+jobs.length+" more figures from Xero\u2026");function run(j,tries){return MH.getData(j.id,j.inputs).then(function(v){var e=errorOf(
v);j.st.items[j.i].value=e?null:v,j.st.items[j.i].error=e,j.st.items[j.i].done=!0},function(e){var msg=e&&e.message||String(e);if(RATE.test(msg)&&tries<3)return wait((tries+1)*(cfg.retryMs==null?700:cfg.retryMs)).then(function(){return run(j,tries+1)});j.st.items[j.i].error=msg,j.st.items[j.i].done=
!0})}function worker(){if(next>=jobs.length)return Promise.resolve();var j=jobs[next++];return run(j,0).then(worker)}for(var ws=[],k=0;k<conc;k++)ws.push(worker());return Promise.all(ws).then(function(){return S.busy--,status(""),render(),!0})}function fan(id){var st=(S.fan||{})[id];return!st||!live?
null:st.items.every(function(x){return x.done})?st.items:null}function rows(id){var P=(cfg.paged||{})[id]||{},list=S.pages[id]||(S.data[id]?[S.data[id]]:[]),out=[];return list.forEach(function(v){(v&&v[P.key]||[]).forEach(function(r){out.push(r)})}),out}function truncated(id){var P=(cfg.paged||{})[id];
return!P||!S.data[id]?!1:S.trunc[id]?!0:!live&&((S.data[id]||{})[P.key]||[]).length>=(P.size||100)}function requery(changed){if(!MH||!live)return render(),Promise.resolve();var ids=Object.keys(cfg.uses||{}).filter(function(id){return!changed||(cfg.uses[id]||[]).some(function(n){return changed.indexOf(
n)>=0})});if(!ids.length)return render(),Promise.resolve();S.busy++,status("Loading\u2026");var inputs=Object.assign({},S.inputs);return Promise.all(ids.map(function(id){return fetchOne(id,inputs)})).then(function(){S.fetchedAt=new Date().toISOString(),S.busy--,status("");var roll=rollPresets();if(roll)
return change(roll);var hl=heal();return hl||(render(),retryLimited(1).then(pageAll).then(fanAll))})}function change(patch,dispPatch){var changed=[],k;S.healed=!1;for(k in patch)k&&S.inputs[k]!==patch[k]&&(S.inputs[k]=patch[k],changed.push(k));if(dispPatch&&setDisp(dispPatch),cfg.derive){var dv=cfg.
derive(Object.assign({},S.inputs),fy().month,disp())||{};for(k in dv)S.inputs[k]!==dv[k]&&(S.inputs[k]=dv[k],changed.push(k))}var d=disp();if(cfg.compare&&d.c!=="none"&&d.c!=="periods"){if(I.cmpStart&&I.start){var c=compare(S.inputs[I.start],S.inputs[I.end],d.c,fy().month);(S.inputs[I.cmpStart]!==c.
start||S.inputs[I.cmpEnd]!==c.end)&&(S.inputs[I.cmpStart]=c.start,S.inputs[I.cmpEnd]=c.end,changed.push(I.cmpStart,I.cmpEnd))}if(I.cmpAsAt&&I.asAt){var ca=compareAsAt(S.inputs[I.asAt],d.c);S.inputs[I.cmpAsAt]!==ca&&(S.inputs[I.cmpAsAt]=ca,changed.push(I.cmpAsAt))}}return announce(),changed.length?requery(
changed):(render(),fanAll())}function compareAsAt(asAtIso,mode){var x=parse(asAtIso);return iso(mode==="prev_year"?D(x.getUTCFullYear()-1,x.getUTCMonth()+1,Math.min(x.getUTCDate(),eom(x.getUTCFullYear()-1,x.getUTCMonth()+1).getUTCDate())):eom(x.getUTCFullYear(),x.getUTCMonth()))}function rollPresets(){
if(!live)return null;var d=disp(),p={},f=fy().month;if(I.start&&d.p&&d.p!=="custom"){var r=preset(d.p,f);r&&(r.start!==S.inputs[I.start]||r.end!==S.inputs[I.end])&&(p[I.start]=r.start,p[I.end]=r.end)}if(I.asAt&&d.a&&d.a!=="custom"){var a=asAt(d.a,f);a&&a!==S.inputs[I.asAt]&&(p[I.asAt]=a)}if(cfg.roll){
var cr=cfg.roll(Object.assign({},S.inputs),f,d)||{},k2;for(k2 in cr)cr[k2]!==S.inputs[k2]&&(p[k2]=cr[k2])}if(cfg.derive){var dv=cfg.derive(Object.assign({},S.inputs,p),f,d)||{},k3;for(k3 in dv)dv[k3]!==S.inputs[k3]&&(p[k3]=dv[k3])}return Object.keys(p).length?p:null}function adoptHeader(){var r=reportOf(
S.data[cfg.primary]);if(!(live||!r)){var ds=titleDates((r.ReportTitles||[]).slice(2).join(" "));I.start&&ds.length>=2&&(S.inputs[I.start]=ds[0],I.end&&cfg.headerEnd!==!1&&(S.inputs[I.end]=ds[1])),I.asAt&&ds.length&&(S.inputs[I.asAt]=ds[ds.length-1])}}function stale(){var want=I.start?[S.inputs[I.start],
S.inputs[I.end]]:I.asAt?[S.inputs[I.asAt]]:null;return want?(cfg.dated||[cfg.primary]).filter(function(id){var r=reportOf(S.data[id]);if(!r)return!1;var ds=titleDates((r.ReportTitles||[]).slice(2).join(" "));return ds.length?want.length===2?ds.length>=2?!(ds[0]===want[0]&&ds[ds.length-1]===want[1]):
ds[0]!==want[1]:ds[ds.length-1]!==want[0]:!1}).map(function(id){var r=reportOf(S.data[id]);return{id,title:String((r.ReportTitles||[]).slice(2).join(" "))}}):[]}function dateKeys(){return Object.keys(S.inputs).filter(function(k){return k!==I.org&&k!==I.persona&&k!==I.display&&k!==I.basis})}function heal(){
return!live||S.healed||!stale().length?null:(S.healed=!0,requery(dateKeys()))}function optv(id){var o=(cfg.options||[]).filter(function(x){return x.id===id})[0],m=new RegExp("(?:^|;)"+id+"=([^;]*)").exec(disp().o||"");return m?m[1]:o?o.def:null}function setOpt(id,v){var kv={};return String(disp().o||
"").split(";").forEach(function(p){var i=p.indexOf("=");i>0&&(kv[p.slice(0,i)]=p.slice(i+1))}),kv[id]=v,Object.keys(kv).map(function(k){return k+"="+kv[k]}).join(";")}function opt(list,cur){return list.map(function(o){return'<option value="'+h(o[0])+'"'+(String(o[0])===String(cur)?" selected":"")+">"+
h(o[1])+"</option>"}).join("")}function controls(){var el=$("xk-controls");if(el){var d=disp(),c0=co(),dis=live?"":" disabled",x="";I.org&&c0.orgs.length>1?x+='<label class="ctl">Organisation<select id="xk-client"'+dis+' title="The Xero organisations this connection can access \u2014 one organisation per\
 report.">'+opt(c0.orgs.map(function(f){return[f.id,f.name||f.id]}),S.inputs[I.org]||c0.active||"")+"</select></label>":x+='<label class="ctl">Organisation<select id="xk-client" title="The Xero organisation this connection uses."><option>'+h(c0.name||"Connected Xero organisation")+"</option></select\
></label>",I.start&&(x+='<label class="ctl">Report period<select id="xk-preset"'+dis+">"+opt(cfg.presets||PRESETS,d.p)+'</select></label><label class="ctl">From<input type="date" id="xk-from" value="'+h(S.inputs[I.start])+'"'+dis+'></label><label class="ctl">To<input type="date" id="xk-to" value="'+
h(S.inputs[I.end])+'"'+dis+"></label>"),I.asAt&&(x+='<label class="ctl">As at<select id="xk-asat-preset"'+dis+">"+opt(cfg.asats||ASAT,d.a)+'</select></label><label class="ctl">Date<input type="date" id="xk-asat" value="'+h(S.inputs[I.asAt])+'"'+dis+"></label>"),I.basis&&(x+='<fieldset class="ctl seg\
"'+dis+"><legend>Accounting method</legend>"+["Cash","Accrual"].map(function(b){return'<label><input type="radio" name="xk-basis" value="'+b+'"'+(S.inputs[I.basis]===b?" checked":"")+dis+">"+b+"</label>"}).join("")+"</fieldset>"),I.columnsBy&&cfg.columnsBy&&(x+='<label class="ctl">Display columns by\
<select id="xk-cols"'+dis+">"+opt(cfg.columnsBy,S.inputs[I.columnsBy])+"</select></label>");var xfy=fiscalStart(c0.org,cfg.fyMonth),xend=(xfy.month+10)%12+1;x+='<label class="ctl">Year end<select id="xk-fy"'+dis+` title="The month the financial year ends \u2014 from the organisation's Xero settings unles\
s you change it">`+opt([["","Xero ("+MONTHS[xend-1]+")"]].concat(MONTHS.map(function(m,i){return[String(i+1),m]})),d.fy||"")+"</select></label>",cfg.compare&&(x+='<label class="ctl">Compare to<select id="xk-cmp"'+dis+">"+opt(cfg.compareModes||(I.asAt?[["none","None"],["prev_period","Previous month e\
nd"],["prev_year","Previous year"]]:[["none","None"],["prev_period","Previous period"],["prev_year","Previous year"],["ytd","Year-to-date"]]),d.c)+"</select></label>"),(cfg.enums||[]).forEach(function(e,i){var rq=Object.keys(cfg.uses||{}).some(function(id){return(cfg.uses[id]||[]).indexOf(e.input)>=
0});x+='<label class="ctl">'+h(e.label)+'<select id="xk-enum-'+i+'"'+(rq?dis:"")+">"+opt(e.options,S.inputs[e.input])+"</select></label>"}),cfg.views&&(x+='<label class="ctl">Report<select id="xk-view">'+opt(cfg.views,d.v||cfg.views[0][0])+"</select></label>"),(cfg.options||[]).forEach(function(o){o.
when&&!o.when(d)||(x+='<label class="ctl">'+h(o.label)+'<select id="xk-opt-'+h(o.id)+'"'+(o.title?' title="'+h(o.title)+'"':"")+">"+opt(o.options,optv(o.id))+"</select></label>")}),(I.persona||cfg.personaDisplay)&&(x+='<label class="ctl">View as<select id="xk-persona">'+opt([["Client","Client"],["Bo\
okkeeper","Bookkeeper"],["Practitioner","Practitioner"],["Executive","Executive"]],I.persona?S.inputs[I.persona]:d.pv||"Bookkeeper")+"</select></label>"),x+='<details class="ctl customise"><summary>Customise</summary><div class="cz"><label><input type="checkbox" id="xk-cents"'+(d.cents?" checked":"")+
'> Show cents</label><label><input type="checkbox" id="xk-k"'+(d.k?" checked":"")+'> Divide by 1000</label><label><input type="checkbox" id="xk-zeros"'+(d.zeros?"":" checked")+'> Except zero amounts</label><label>Negative numbers<select id="xk-neg">'+opt([["minus","-100"],["paren","(100)"],["trail",
"100-"]],d.neg)+'</select></label><label><input type="checkbox" id="xk-red"'+(d.red?" checked":"")+'> Show in red</label><label><input type="checkbox" id="xk-hdr"'+(d.hdr?" checked":"")+'> Header</label><label><input type="checkbox" id="xk-ftr"'+(d.ftr?" checked":"")+'> Footer</label><label>View<sel\
ect id="xk-dens">'+opt([["compact","Compact"],["100","100%"]],d.dens)+'</select></label><label>Branding<select id="xk-branding" title="Xero branding (default) or the mySMB Reporting template \u2014 display only, the data does not change">'+opt([["xero","Xero"],["mysmb","mySMB"]],d.style==="mysmb"?"m\
ysmb":"xero")+'</select></label><label>Brand colour<input type="color" id="xk-brand" value="'+h(HEX.test(d.b)?d.b:"#13b5ea")+'"></label><label>&nbsp;<button type="button" id="xk-brand-reset"'+(HEX.test(d.b)?"":" disabled")+">Use Xero branding</button></label></div></details>",x+='<div class="ctl btn\
s"><button type="button" id="xk-pdf">Download PDF</button><button type="button" id="xk-xlsx">Download Excel</button></div>',el.innerHTML=x,wire()}}function on(id,ev,fn){var e=$(id);e&&e.addEventListener(ev,fn)}function wire(){on("xk-client","change",function(){if(I.org){var p={};p[I.org]=this.value,
change(p)}}),on("xk-preset","change",function(){var k=this.value,r=preset(k,fy().month),p={};r&&(p[I.start]=r.start,p[I.end]=r.end),change(p,{p:k})}),on("xk-from","change",function(){var p={};p[I.start]=this.value,change(p,{p:"custom"})}),on("xk-to","change",function(){var p={};p[I.end]=this.value,change(
p,{p:"custom"})}),on("xk-asat-preset","change",function(){var k=this.value,a=asAt(k,fy().month),p={};a&&(p[I.asAt]=a),change(p,{a:k})}),on("xk-asat","change",function(){var p={};p[I.asAt]=this.value,change(p,{a:"custom"})}),document.querySelectorAll('input[name="xk-basis"]').forEach(function(r){r.addEventListener(
"change",function(){var p={};p[I.basis]=this.value,change(p)})}),on("xk-cols","change",function(){var p={};p[I.columnsBy]=this.value,change(p)}),on("xk-cmp","change",function(){change({},{c:this.value})}),on("xk-fy","change",function(){setDisp({fy:this.value}),change(rollPresets()||{},{})}),(cfg.enums||
[]).forEach(function(e,i){on("xk-enum-"+i,"change",function(){var p={};p[e.input]=this.value,change(p)})}),on("xk-view","change",function(){change({},{v:this.value})}),(cfg.options||[]).forEach(function(o){on("xk-opt-"+o.id,"change",function(){change({},{o:setOpt(o.id,this.value)})})}),on("xk-person\
a","change",function(){if(!I.persona)return change({},{pv:this.value});var p={};p[I.persona]=this.value,change(p)}),[["xk-cents","cents"],["xk-k","k"],["xk-red","red"],["xk-hdr","hdr"],["xk-ftr","ftr"]].forEach(function(c){on(c[0],"change",function(){var p={};p[c[1]]=this.checked?1:0,change({},p)})}),
on("xk-zeros","change",function(){change({},{zeros:this.checked?0:1})}),on("xk-neg","change",function(){change({},{neg:this.value})}),on("xk-dens","change",function(){change({},{dens:this.value})}),on("xk-branding","change",function(){change({},{style:this.value})}),on("xk-brand","change",function(){
HEX.test(this.value)&&change({},{b:this.value.toLowerCase()})}),on("xk-brand-reset","click",function(){change({},{b:""})}),on("xk-pdf","click",function(){window.print()}),on("xk-xlsx","click",function(){exportXlsx()})}function ctx(){var d=disp(),c0=co(),f=fy();return{data:S.data,errors:S.errors,err,
inputs:S.inputs,I,display:d,view:d.v||(cfg.views?cfg.views[0][0]:""),compareMode:cfg.compare?d.c:"none",persona:I.persona?S.inputs[I.persona]:cfg.personaDisplay&&d.pv||"Bookkeeper",company:c0.name,organisation:c0,fy:f,currency:homeCurrency(c0.org),live,fetchedAt:S.fetchedAt,source:srcOf,body:$("xk-b\
ody"),change,disp,today:iso(today()),opt:optv,setOpt:function(id,v){return change({},{o:setOpt(id,v)})},rows,truncated,fan,pageError:function(id){return(S.pageError||{})[id]||null}}}var last={checks:[],na:[],notes:[]};function render(){var c=ctx(),d=c.display,root=document.documentElement;root.classList.
toggle("style-mysmb",d.style==="mysmb"),root.classList.toggle("dens-compact",d.dens==="compact"),root.classList.toggle("brand-custom",applyBrand(root,d.style==="mysmb"?"":d.b)),document.body.classList.toggle("persona-summary",c.persona==="Client"||c.persona==="Executive"),document.body.classList.toggle(
"persona-detail",!(c.persona==="Client"||c.persona==="Executive")),controls();var out={};try{out=cfg.render(c)||{}}catch(e){c.body&&(c.body.innerHTML='<p class="xk-err">This report could not render: '+h(e.message)+"</p>"),out={checks:[{name:"Report rendered",pass:!1,detail:e.message}]}}last={checks:out.
checks||[],na:out.na||[],notes:out.notes||[]},window.__xkIntegrity&&!window.__xkIntegrity.ok&&last.checks.unshift({name:"Report code = the tested version",pass:!1,detail:"This copy was damaged when it was created \u2014 ask the agent to create the report again"}),stale().forEach(function(x){last.checks.
unshift({name:"Xero report dates = the selected dates",pass:!1,detail:(cfg.tools||{})[x.id]+' returned "'+x.title+'" \u2014 press Refresh'})});var nc=Object.keys(S.errors).some(function(id){return S.errors[id]&&S.errors[id].code==="needs_connection"&&!srcOf(id)});if(nc&&c.body&&c.body.textContent.indexOf(
FRIENDLY.needs_connection)<0){var dv=document.createElement("div");dv.className="xk-banner fail",dv.textContent=FRIENDLY.needs_connection,c.body.insertBefore(dv,c.body.firstChild)}Object.keys(S.errors).forEach(function(id){if(!(id===cfg.conns&&S.data[cfg.org])&&!quiet(id)){var msg=err(id);if(!last.checks.
some(function(k){return k.pass===!1&&k.detail===msg})){var sc=srcOf(id);last.checks.unshift({name:"Data loaded: "+((cfg.tools||{})[id]||id),pass:sc&&sc.optional?null:!1,detail:msg})}}});var hd=$("xk-head");if(hd){hd.hidden=!d.hdr||!!cfg.noHead;var per=out.period||(I.start?periodLine(S.inputs[I.start],
S.inputs[I.end]):I.asAt?asOfLine(S.inputs[I.asAt]):"");hd.innerHTML='<div class="ti">'+h(out.title||cfg.title)+'</div><div class="co">'+h(c.company||"N/A \u2014 not in source")+'</div><div class="pe">'+h(per)+'</div><div class="xk-src">'+(d.style==="mysmb"?'<span class="xk-badge">mySMB</span>mySMB R\
eporting \xB7 data from Xero':'<span class="xk-badge">Xero</span>Prepared from Xero')+"</div>"}var ft=$("xk-foot");if(ft){ft.hidden=!d.ftr;var stamp=footerStamp(basisOf(),S.fetchedAt,c.currency);ft.textContent=d.style==="mysmb"?[c.company||"Xero organisation",out.title||cfg.title,stamp].join(" | "):
stamp}banner(c),sources(c)}function banner(c){var el=$("xk-banner");if(el){var ch=last.checks,isInfo=function(k){return!!k.info},fails=ch.filter(function(k){return k.pass===!1}),done=ch.filter(function(k){return k.pass===!0}),nInfo=ch.filter(isInfo).length,nNA=ch.filter(function(k){return k.pass==null&&
!isInfo(k)}).length,real=ch.length-nInfo,none=!fails.length&&!done.length&&ch.length>0,extra=(nNA?" \xB7 "+nNA+" N/A":"")+(nInfo?" \xB7 "+nInfo+" for information":"");el.className="xk-banner "+(fails.length?"fail":none?"na":"pass"),el.innerHTML="<strong>"+(fails.length?"\u26A0 Validation: "+fails.length+
" check"+(fails.length>1?"s":"")+" failed"+(done.length?" \xB7 "+done.length+" passed":"")+extra:none?real?"\u2013 Validation: no check could run ("+nNA+" N/A"+(nInfo?" \xB7 "+nInfo+" for information":"")+")":"\u2139 Validation: "+nInfo+" line"+(nInfo>1?"s":"")+" for information":"\u2713 Validation: "+
done.length+"/"+done.length+" check"+(done.length>1?"s":"")+" passed"+extra)+"</strong> \xB7 Data as of "+h(S.fetchedAt?new Date(S.fetchedAt).toLocaleString("en-AU"):"\u2014")+(live?"":" \xB7 Snapshot: figures frozen at capture time")+" \xB7 Financial year starts "+h(MONTHS[c.fy.month-1])+" ("+h(c.fy.
source)+")<ul>"+ch.map(function(k){return'<li class="'+(k.pass===!1?"bad":k.pass===!0?"ok":isInfo(k)?"na info":"na")+'">'+(k.pass===!1?"\u2717 ":k.pass===!0?"\u2713 ":isInfo(k)?"\u2139 ":"\u2013 ")+h(k.name)+(k.detail?" \u2014 "+h(k.detail):"")+"</li>"}).join("")+"</ul>"}}function basisOf(){return I.
basis?S.inputs[I.basis]:cfg.basisLabel||(cfg.noBasis?null:"Accrual")}function sources(c){var el=$("xk-sources");if(el){var t=cfg.tools||{},items=Object.keys(t).map(function(id){var sc=srcOf(id);return h(t[id])+(S.errors[id]&&!quiet(id)?' \u2014 <span class="'+(sc&&sc.optional?"muted":"xk-err")+'">'+
h(err(id))+"</span>":"")}),na=last.na.slice();c.company||na.unshift("Organisation name (Xero returned no organisation details)"),el.innerHTML="<h2>Sources &amp; limitations</h2><ul><li>Mechanism: "+h(cfg.mechanism||MECHANISM)+"</li><li>Tool calls: "+items.join(" \xB7 ")+"</li><li>Basis: "+h(basisOf()||
"n/a")+" \xB7 Currency: "+h(c.currency)+" (the organisation's base currency \u2014 Xero's reports have no other presentation currency) \xB7 Organisation: "+h(c.company||"N/A \u2014 not in source")+" (one Xero organisation per report)</li>"+(/^assumed/.test(c.fy.source)?"<li>Financial year: "+h(c.fy.
source)+" (starts "+h(MONTHS[c.fy.month-1])+"). Adjust the dates if this organisation uses a different year.</li>":"")+last.notes.map(function(n){return"<li>"+h(n)+"</li>"}).join("")+(na.length?"<li>N/A \u2014 not in source: "+na.map(h).join("; ")+"</li>":"")+"<li>Decision support only \u2014 not audit, \
tax or legal advice.</li></ul>"}}function exportXlsx(){var c=ctx(),sheets=[];try{sheets=cfg.excel&&cfg.excel(c)||[]}catch(e){sheets=[{name:"Error",rows:[["Excel export failed: "+e.message]]}]}var foot=[basisOf()?basisOf()+" basis":null,c.currency].filter(Boolean).join(" \xB7 ");sheets.forEach(function(sh){
var r=sh.rows||[],a=r[0]&&r[0][0],b=r[1]&&r[1][0];!a||!b||a.s!=="title"||b.s!=="bold"||(r[0]=[{v:b.v,s:"title"}],r[1]=[{v:a.v,s:"bold"}],r[3]&&!r[3].length&&(r[3]=[{v:foot,s:"muted"}]))}),sheets.push({name:"Validation",rows:[[{v:"Check",s:"bold"},{v:"Result",s:"bold"},{v:"Detail",s:"bold"}]].concat(
last.checks.map(function(k){return[k.name,k.pass===!0?"Pass":k.pass===!1?"FAIL":"N/A",k.detail||""]})),widths:[60,10,60]});var pr=reportParams({start:I.start&&S.inputs[I.start],end:I.end&&S.inputs[I.end],asAt:I.asAt&&S.inputs[I.asAt],basis:I.basis&&S.inputs[I.basis],org:I.org&&(S.inputs[I.org]||c.organisation.
active||""),display:c.display});sheets.push({name:"Parameters",rows:[[{v:"Parameter",s:"bold"},{v:"Value",s:"bold"}]].concat(Object.keys(pr).map(function(k){return[k,String(pr[k])]})).concat([["basis",basisOf()||"n/a"],["currency",c.currency],[],["Data as of",S.fetchedAt||""],["Source",cfg.mechanism||
MECHANISM]]),widths:[28,60]});var name=[c.company||"Xero",cfg.title,I.start?S.inputs[I.start]+" to "+S.inputs[I.end]:I.asAt?"as at "+S.inputs[I.asAt]:""].filter(Boolean).join(" - ").replace(/[\\\/:*?"<>|]+/g," ");download(xlsx(sheets,c.currency),name+".xlsx")}function boot(bundle){if(S.data={},S.errors=
Object.assign({},bundle.errors||{}),S.fetchedAt=bundle.fetchedAt||null,Object.keys(bundle.data||{}).forEach(function(id){S.errors[id]||absorb(id,bundle.data[id])}),adoptHeader(),status(""),S.first){S.first=!1;var roll=rollPresets();if(roll){change(roll);return}if(announce(),heal())return}render(),retryLimited(
1).then(pageAll).then(fanAll)}return MH?(MyHubReport.onData(function(bundle){window.__reportStarted=!0,boot(bundle)}),MH.onRefresh&&MH.onRefresh(function(){status("Refreshing\u2026")}),MH.onThemeChange&&MH.onThemeChange(function(){render()}),{state:S,change,render,exportXlsx,ctx,retryLimited}):(status(
"Open this report in mySMB to load Xero data."),{state:S})}window.XK={app,asOfLine,currentYearEarnings,find,footerStamp,h,kpis,linesTies,money,near,sheetFromLines,statement,sum,val,walk};})();</script>
<script>XK.app({
  title: 'Trial Balance', primary: 'tb', dated: ['tb', 'tb_cash'], org: 'org', conns: 'connections',
  inputs: { asAt: 'as_at', basis: 'basis', org: 'org', persona: 'persona', display: 'display' },
  defaults: { as_at: '2026-09-25', basis: 'Accrual', org: '', persona: 'Bookkeeper',
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"xero","dens":"100","p":"custom","a":"today","c":"none","v":"tb"}' },
  uses: { tb: ['as_at', 'org'], tb_cash: ['as_at', 'org'], bs_tie: ['as_at', 'org'], org: ['org'], connections: [] },
  tools: { tb: 'get_trial_balance', tb_cash: 'get_trial_balance (cash basis)', bs_tie: 'get_balance_sheet (Current Year Earnings at the same date — tie)', org: 'get_organisation', connections: 'list_connections' },
  render: function (c) {
    var body = c.body, money = function (v) { return XK.money(v, c.currency, c.display); }, cash = c.inputs.basis === 'Cash', r2 = function (v) { return Math.round(v * 100) / 100; };
    var id = cash ? 'tb_cash' : 'tb';
    if (c.errors[id]) { body.innerHTML = '<p class="xk-err">' + XK.h(c.err(id)) + '</p>'; return { checks: [{ name: 'Trial Balance loaded', pass: false, detail: c.err(id) }] }; }
    if (!c.data[id]) return {};
    var w = XK.walk(c.data[id]), cols = w.columns || [];
    // Debit / Credit column pairs, read from the Header row by label (Debit | Credit | YTD Debit | YTD Credit in Xero's layout).
    var deb = [], cre = []; cols.forEach(function (h, i) { var s = String(h || '').toLowerCase(); if (/debit/.test(s)) deb.push(i); else if (/credit/.test(s)) cre.push(i); });
    var pairs = deb.map(function (d, k) { return cre[k] == null ? null : { d: d, c: cre[k], ytd: /ytd|year/i.test(cols[d]) }; }).filter(Boolean), main = pairs.filter(function (p) { return !p.ytd; })[0] || pairs[0], ytd = pairs.filter(function (p) { return p.ytd; })[0] || main;
    var rows = w.lines.filter(function (l) { return l.kind === 'row'; }), colSum = function (i) { return XK.sum(rows.map(function (l) { return l.values[i]; })); };
    var grand = XK.find(w.lines, null, /^total$/i, 'total');
    var kp = main ? [{ label: 'Total Debits', value: colSum(main.d) }, { label: 'Total Credits', value: colSum(main.c) }] : [];
    kp.push({ label: 'Accounts', text: String(rows.length) });
    body.innerHTML = XK.kpis(kp, c) + '<div class="xk-scroll">' + XK.statement(w.lines, [''].concat(cols.length ? cols : ['Value']), c, []) + '</div>';
    // Checks: debits = credits (each pair); Xero's grand Total = Σ the accounts; section ties; and the independent tie —
    // Revenue − Expenses (year to date) = Current Year Earnings on a separate Balance Sheet call for the same date.
    var ties = XK.linesTies(w.lines), net = function (re, p) { var s = w.sections.filter(function (x) { return re.test(x.title); }); return s.length ? XK.sum([].concat.apply([], s.map(function (x) { return x.rows; })).map(function (l) { return (l.values[p.c] || 0) - (l.values[p.d] || 0); })) : null; };
    var revN = ytd ? net(/revenue|income/i, ytd) : null, expN = ytd ? net(/expense|cost/i, ytd) : null, plNet = revN == null || expN == null ? null : r2(revN + expN);
    var bsW = c.data.bs_tie ? XK.walk(c.data.bs_tie) : null, bsCye = bsW ? (function () { var l = XK.currentYearEarnings(bsW.lines); return l ? XK.val(l) : null; })() : null;
    var checks = [
      { name: 'Total Debits = Total Credits', pass: main ? pairs.every(function (p) { return XK.near(colSum(p.d), colSum(p.c)); }) : null, detail: main ? pairs.map(function (p) { return cols[p.d] + ' ' + money(colSum(p.d)) + ' = ' + cols[p.c] + ' ' + money(colSum(p.c)); }).join(' · ') : 'Xero returned column(s) ' + (cols.join(', ') || '(none)') + ' instead of separate Debit / Credit columns' },
      { name: 'Xero\'s Total row = Σ the accounts', pass: grand && main ? pairs.every(function (p) { return XK.near(grand.values[p.d], colSum(p.d)) && XK.near(grand.values[p.c], colSum(p.c)); }) : null, detail: grand ? rows.length + ' accounts' : 'No Total row in this Trial Balance' },
      { name: 'Every section total = Σ its account rows', pass: ties.checked ? ties.failed.length === 0 : null, detail: ties.checked ? (ties.failed.length ? 'Mismatch: ' + ties.failed.join(', ') : ties.checked + ' sections') : 'Xero sends no section totals on the Trial Balance' },
      cash ? { name: 'Revenue − Expenses vs Current Year Earnings (information)', pass: null, info: true, detail: 'The tie is checked on the accrual basis' }
        : { name: 'Revenue − Expenses (' + (ytd && ytd.ytd ? 'YTD columns' : 'Debit / Credit') + ') = Current Year Earnings on the Balance Sheet at ' + c.inputs.as_at, pass: c.errors.bs_tie || plNet == null || bsCye == null ? null : XK.near(plNet, bsCye), detail: c.errors.bs_tie ? c.err('bs_tie') : plNet == null ? 'No Revenue / Expenses sections found' : bsCye == null ? 'No Current Year Earnings line on the Balance Sheet' : money(plNet) + ' vs ' + money(bsCye) }
    ];
    var notes = [];
    if (!main) notes.push('This call returned column(s) ' + (cols.join(', ') || '(none)') + ' rather than separate Debit / Credit columns — shown as Xero returned it; the Debit = Credit check is N/A rather than guessed.');
    if (cash) notes.push('Cash basis: Xero\'s Trial Balance with payments only (paymentsOnly = true).');
    this._lines = w.lines; this._cols = [''].concat(cols.length ? cols : ['Value']);
    return { checks: checks, notes: notes, na: ['Comparison and tracking columns (get_trial_balance has no periods or tracking parameter)'], title: 'Trial Balance' };
  },
  excel: function (c) {
    var lines = this._lines || [], titles = this._cols || ['', 'Value'];
    return [XK.sheetFromLines('Trial Balance', c.company, XK.asOfLine(c.inputs.as_at), titles, lines.map(function (l) { return { kind: l.kind, depth: l.depth, label: l.label, values: l.values }; }), XK.footerStamp(c.inputs.basis, c.fetchedAt, c.currency), titles.slice(1).map(function () { return 'money'; }))];
  }
});</script>
<script data-xk-check>(function(){var s=document.scripts,k="",f="",i,t;for(i=0;i<s.length;i++){t=s[i].text;if(s[i].type||s[i].hasAttribute("data-xk-check"))continue;if(!k&&t.indexOf("window.XK")>=0)k=t;else if(t.indexOf("XK.app(")>=0)f=t}var r=f.indexOf("render: function"),x=(k+(r<0?f:f.slice(r))).replace(/\s+/g,""),h=2166136261;for(i=0;i<x.length;i++)h=Math.imul(h^x.charCodeAt(i),16777619)>>>0;window.__xkIntegrity={ok:h.toString(16)=="113e0eed"};if(!window.__xkIntegrity.ok){var d=document.createElement("div");d.className="xk-banner fail";d.setAttribute("role","alert");d.textContent="This copy of the report is damaged (its code differs from the tested version), so its figures can't be trusted. Ask the agent to create it again.";document.body.prepend(d)}})()</script>
</body>
</html>
```
