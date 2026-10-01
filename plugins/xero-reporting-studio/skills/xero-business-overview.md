---
name: xero-business-overview
description: Build a live, validated Xero Business overview dashboard (P01) on the tested report kit — bank accounts, invoices owed and bills to pay with due-date charts, tasks, recent payments, 6 months of cash in and out, net profit year to date vs last year, and an account watchlist. Use for "business overview", "dashboard", "how is the business going", "snapshot of the business".
---
# Business overview (P01)

Use when the user asks for a business overview, a dashboard, a snapshot of the business, or how the business is going. Load `xero-report-foundation` first and follow its *Build a kit report* steps with the blocks below — copy them, do not rewrite them. This skill needs the `xero-accounting` connector (`get_bank_summary`, `list_invoices`, `list_payments`, `get_profit_and_loss`, `list_accounts`, `get_balance_sheet`, `get_organisation`, `list_connections`).

Xero location: Home → Business overview. Library: Xero Reports Prompt Library v1.2 → Prompts → P01. Delivery: Wave 1 (delivery order 5).

## Discovery call

Call `get_organisation` and `list_connections` once, and `get_profit_and_loss` once for the financial year to date (`standardLayout` = `true`). An error is a failed call: report its message.

## Date defaults

A dashboard is always "now": leave every date default as it is — the kit sets today, the financial-year start (from the organisation), the same period last year and this month on open.

## Members

| Member / view | How |
|---|---|
| Business overview | The one view: bank accounts, invoices owed, bills to pay, tasks, recent invoice payments, cash in and out (6 months), net profit YTD, watchlist |
| Watchlist accounts | Add account (kept in the display input `o` as `w=code,code`; defaults to the four largest expense accounts) |
| Bank statement balances / reconcile counts | N/A — bank-feed data is not in the Xero API (said on each bank card) |

## Validation checks (shown in the banner)

- Invoices owed = Σ ageing buckets; Bills to pay = Σ ageing buckets
- Each bank account: opening + cash in − cash out = balance
- Cash difference = cash in − cash out; each month closes where the next opens (6 months)
- YTD net profit = income − expenses (from one Profit and Loss)
- **Independent ties:** bank accounts = Total Bank on the Balance Sheet; YTD net profit = Current Year Earnings on the Balance Sheet
- Invoices owed vs Accounts Receivable (information)
- All invoices and bills loaded

## Save as

`fileName`: `xero-business-overview.html` · `tags`: ["xero","business-overview","P01","dashboard"]

## QA test script (golden set)

1. On the golden-set organisation, ask for this report at the library's example period; confirm the discovery call succeeded and the report saved.
2. Compare the headline figures: Hammerjack Pty Limited: Invoices owed 2,321,268.48 (170 awaiting; 142 overdue = 2,076,292.77) · Bills to pay 1,453,271.98 (17; 16 overdue = 1,450,631.98) · Cash in 12,946,131.40 / out −10,676,522.80 / diff 2,269,608.60 · Net profit YTD 2,129,901.37 (Income 4,316,164 − Expenses 2,186,263, up 6% YoY). On Irvine Jackson Pty Ltd in QA, every check passes and the YTD net profit equals the Profit and Loss report's.
3. Validation banner: every check passes (the independent tie included), or shows N/A / information with a stated reason.
4. Change every control and confirm the report refetches and still validates; toggle Branding and the dark theme.
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
      "name": "fy_start",
      "label": "Financial year start",
      "type": "date",
      "default": "2026-07-01"
    },
    {
      "name": "prior_from",
      "label": "Last year from",
      "type": "date",
      "default": "2025-07-01"
    },
    {
      "name": "prior_to",
      "label": "Last year to",
      "type": "date",
      "default": "2025-09-25"
    },
    {
      "name": "month_from",
      "label": "This month from",
      "type": "date",
      "default": "2026-09-01"
    },
    {
      "name": "org",
      "label": "Organisation",
      "type": "string",
      "maxLength": 64,
      "default": ""
    },
    {
      "name": "page",
      "label": "Page",
      "type": "number",
      "min": 1,
      "max": 20,
      "default": 1
    },
    {
      "name": "display",
      "label": "Display settings",
      "type": "string",
      "maxLength": 300,
      "default": "{\"cents\":1,\"k\":0,\"zeros\":0,\"neg\":\"paren\",\"red\":1,\"hdr\":1,\"ftr\":1,\"style\":\"xero\",\"dens\":\"100\",\"p\":\"custom\",\"a\":\"today\",\"c\":\"none\",\"v\":\"\",\"o\":\"w=\"}"
    }
  ],
  "bindings": [
    {
      "id": "bank",
      "tool": {
        "mcp": "xero-accounting",
        "name": "get_bank_summary"
      },
      "params": {
        "fromDate": {
          "kind": "input",
          "input": "month_from"
        },
        "toDate": {
          "kind": "input",
          "input": "as_at"
        },
        "xero_tenant_id": {
          "kind": "input",
          "input": "org"
        }
      }
    },
    {
      "id": "invoices",
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
          "value": "DRAFT,SUBMITTED,AUTHORISED"
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
          "value": "DRAFT,SUBMITTED,AUTHORISED"
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
      "id": "payments",
      "tool": {
        "mcp": "xero-accounting",
        "name": "list_payments"
      },
      "params": {
        "where": {
          "kind": "static",
          "value": "PaymentType==\"ACCRECPAYMENT\""
        },
        "order": {
          "kind": "static",
          "value": "Date DESC"
        },
        "page": {
          "kind": "static",
          "value": 1
        },
        "xero_tenant_id": {
          "kind": "input",
          "input": "org"
        }
      }
    },
    {
      "id": "pnl_ytd",
      "tool": {
        "mcp": "xero-accounting",
        "name": "get_profit_and_loss"
      },
      "params": {
        "fromDate": {
          "kind": "input",
          "input": "fy_start"
        },
        "toDate": {
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
      "id": "pnl_prior",
      "tool": {
        "mcp": "xero-accounting",
        "name": "get_profit_and_loss"
      },
      "params": {
        "fromDate": {
          "kind": "input",
          "input": "prior_from"
        },
        "toDate": {
          "kind": "input",
          "input": "prior_to"
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
      "id": "pnl_month",
      "tool": {
        "mcp": "xero-accounting",
        "name": "get_profit_and_loss"
      },
      "params": {
        "fromDate": {
          "kind": "input",
          "input": "month_from"
        },
        "toDate": {
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
      "id": "accounts",
      "tool": {
        "mcp": "xero-accounting",
        "name": "list_accounts"
      },
      "params": {
        "xero_tenant_id": {
          "kind": "input",
          "input": "org"
        }
      }
    },
    {
      "id": "bs",
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
<title>Business overview</title>
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
@media print{body{background:var(--card);padding:0}#xk-controls,#xk-status,.no-print,.xk-filter{display:none!important}.xk-card{border:0;padding:0 0 12px}th{position:static}@page{size:A4 landscape;margin:12mm}}
/* QuickBooks branding accents (the accent follows the house-style toggle and the optional brand colour) */
#xk-controls{border-top:3px solid var(--accent)}
main.xk-card{border-top:4px solid var(--accent)}
.xk-kpi{border-left:4px solid var(--accent)}
.xk-stmt thead th,.xk-grid thead th{border-bottom:2px solid var(--accent)}
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
<script>"use strict";(()=>{function num(v){if(v==null||v==="")return null;var n=Number(String(v).replace(/,/g,""));return isFinite(n)?n:null}function near(a,b,tol){return a!=null&&b!=null&&Math.abs(a-b)<=(tol==null?.01:tol)}function sum(arr){var s=0;return arr.forEach(function(v){v!=null&&(s+=v)}),Math.round(s*100)/100}function errorOf(v){return v&&typeof v=="object"&&!Array.isArray(v)&&v.__error!=null?String(v.__error):null}function isoDate(v){
if(v==null||v==="")return null;var m=/\/Date\((-?\d+)/.exec(String(v));if(m){var d=new Date(+m[1]);return iso(D(d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate()))}return String(v).slice(0,10)}function reportOf(v){return!v||errorOf(v)?null:Array.isArray(v.Reports)?v.Reports[0]||null:Array.isArray(
v.Rows)?v:null}function attr(cell,id){var a=(cell&&cell.Attributes||[]).filter(function(x){return x&&(x.Id===id||id==="account"&&/^accountid$/i.test(x.Id||""))})[0];return a?a.Value:null}function isDeduction(title){return/^less\b/i.test(title||"")||/cost of sales|expense/i.test(title||"")}function walk(v){
var rep=reportOf(v),out={lines:[],columns:[],titles:[],date:null,name:null,sections:[]};if(!rep)return out;out.titles=rep.ReportTitles||[],out.date=rep.ReportDate||null,out.name=rep.ReportName||null;var parent=null,vals=function(c){return c.slice(1).map(function(x){return num(x&&x.Value)})},lbl=function(c){
return String((c[0]||{}).Value||"")};return(rep.Rows||[]).forEach(function(r){if(r){var c=r.Cells||[];if(r.RowType==="Header"){out.columns=c.slice(1).map(function(x){return x&&x.Value||""});return}if(r.RowType!=="Section"){c.length&&out.lines.push({kind:"total",depth:0,label:lbl(c),group:lbl(c),parent:null,
calc:!0,fixed:!0,values:vals(c),path:[]});return}var title=String(r.Title||""),kids=r.Rows||[];if(title&&!kids.length){parent=title,out.lines.push({kind:"header",depth:0,label:title,group:title,parent:null,values:[],path:[]});return}var hasRow=kids.some(function(k){return k&&k.RowType==="Row"}),real=kids.
some(function(k){return k&&k.RowType==="Row"&&attr((k.Cells||[])[0],"account")})||hasRow&&kids.some(function(k){return k&&k.RowType==="SummaryRow"});if(!title&&!real){kids.forEach(function(k){var kc=k.Cells||[],label=lbl(kc),closes=parent&&label.toLowerCase()===("total "+parent).toLowerCase()?parent:
null;out.lines.push({kind:"total",depth:0,label,group:closes||label,parent:null,calc:!closes,closes,fixed:!0,values:vals(kc),path:[]}),closes&&(parent=null)});return}var d=parent?1:0,shown=title.replace(/^Less\s+/i,""),sec={title,label:shown,parent,rows:[],summary:null};title&&out.lines.push({kind:"\
header",depth:d,label:shown,group:title,parent,values:[],path:parent?[parent]:[]}),kids.forEach(function(k){var kc=k.Cells||[],label=lbl(kc),line;k.RowType==="SummaryRow"?(line={kind:"total",depth:d,label,group:title,parent,fixed:!0,values:vals(kc),path:[]},sec.summary=line):(line={kind:"row",depth:d+
1,label,id:attr(kc[0],"account")||attr(kc[1],"account"),group:title,parent,values:vals(kc),path:(parent?[parent]:[]).concat([shown])},sec.rows.push(line)),out.lines.push(line)}),out.sections.push(sec)}}),out}function sectionTotal(sec,col){var i=col||0;return sec.summary?sec.summary.values[i]:sum(sec.
rows.map(function(l){return l.values[i]}))}var CYE_RE=/^current year('s)? earnings$|^current earnings$/i;function currentYearEarnings(bsLines){var r=bsLines.filter(function(l){return l.kind==="row"&&/^equity$/i.test(l.group)&&CYE_RE.test(l.label)})[0];return r||null}function find(lines,group,labelRe,kind){var kinds=kind?[kind]:["total","row"],
i,j;for(j=0;j<kinds.length;j++){if(group){for(i=0;i<lines.length;i++)if(lines[i].group===group&&lines[i].kind===kinds[j])return lines[i]}if(labelRe){for(i=0;i<lines.length;i++)if(lines[i].kind===kinds[j]&&labelRe.test(lines[i].label))return lines[i]}}return null}function orgOf(v){var o=v&&!errorOf(v)&&Array.isArray(v.Organisations)?v.Organisations[0]:null;return o?{name:o.Name||o.LegalName||null,currency:o.BaseCurrency||null,country:o.CountryCode||null,fyEndMonth:Number(o.FinancialYearEndMonth)||null,fyEndDay:Number(o.FinancialYearEndDay)||null,shortCode:o.
ShortCode||null,id:o.OrganisationID||null}:null}function connections(v){var t=!v||errorOf(v)?[]:Array.isArray(v.tenants)?v.tenants:Array.isArray(v)?v:[];return{active:v&&v.activeTenantId||null,list:t.map(function(x){return{id:String(x.tenantId||""),name:x.tenantName||"",type:x.tenantType||""}}).filter(
function(x){return x.id})}}function companyOf(orgResp,connResp,chosenId,titles){var o=orgOf(orgResp),cn=connections(connResp),id=chosenId||cn.active||null,t=cn.list.filter(function(x){return x.id===id})[0],fromTitle=titles&&titles[1]?String(titles[1]):null;return{name:o&&o.name||t&&t.name||fromTitle,
id,currency:o?o.currency:null,country:o?o.country:null,org:o,orgs:cn.list,active:cn.active,source:o?"get_organisation":t?"list_connections":fromTitle?"report title":null}}var MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];function fiscalStart(org,fyMonth){
return fyMonth?{month:fyMonth,source:"report setting"}:org&&org.fyEndMonth>=1&&org.fyEndMonth<=12?{month:org.fyEndMonth%12+1,source:"Xero organisation settings \u2014 year ends "+(org.fyEndDay||eom(2026,org.fyEndMonth).getUTCDate())+" "+MONTHS[org.fyEndMonth-1]}:org&&/^nz/i.test(org.country||"")?{month:4,
source:"assumed \u2014 NZ default; Xero did not return the organisation's financial year"}:{month:7,source:"assumed \u2014 AU default; Xero did not return the organisation's financial year"}}function homeCurrency(org){return org&&org.currency||(org&&/^nz/i.test(org.country||"")?"NZD":"AUD")}function titleDates(s){
for(var out=[],re=/(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/g,m;m=re.exec(String(s||""));)out.push(iso(D(+m[3],MONTHS.indexOf(m[2])+1,+m[1])));return out}var SYM={AUD:"$",NZD:"$",USD:"US$",CAD:"C$",GBP:"\xA3",EUR:"\u20AC",PHP:"\u20B1",
SGD:"S$",HKD:"HK$",JPY:"\xA5",INR:"\u20B9"};function symbol(code){return SYM[code]||(code?code+" ":"")}var DISPLAY_DEFAULT={cents:1,k:0,zeros:1,neg:"minus",red:0,hdr:1,ftr:1,style:"xero",dens:"100",p:"custom",a:"custom",c:"none",v:"",x:"",b:"",o:"",pv:""},HEX=/^#[0-9a-f]{6}$/i;function shade(hex,f){
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
addDays(s,-len-1)),end:iso(addDays(s,-1))}}var MON=["January","February","March","April","May","June","July","August","September","October","November","December"];function shortDate(d){var x=parse(d);return x?x.getUTCDate()+" "+MON[x.getUTCMonth()].slice(0,3)+" "+x.getUTCFullYear():""}function longDate(x){
return x.getUTCDate()+" "+MON[x.getUTCMonth()]+" "+x.getUTCFullYear()}function periodLine(start,end){var s=parse(start),e=parse(end),ey=e.getUTCFullYear();if(s.getUTCDate()===1&&iso(e)===iso(eom(ey,e.getUTCMonth()+1))){var months=(ey-s.getUTCFullYear())*12+(e.getUTCMonth()-s.getUTCMonth())+1;if(months===
1)return"For the month ended "+longDate(e);if(months===12)return"For the year ended "+longDate(e);if(months>1)return"For the "+months+" months ended "+longDate(e)}return"For the period "+longDate(s)+" to "+longDate(e)}function rangeLabel(start,end){var s=parse(start),e=parse(end),m=function(x){return MON[x.
getUTCMonth()].slice(0,3)},sy=s.getUTCFullYear(),ey=e.getUTCFullYear();return s.getUTCDate()===1&&iso(e)===iso(eom(ey,e.getUTCMonth()+1))?sy===ey&&s.getUTCMonth()===e.getUTCMonth()?m(e)+" "+ey:sy===ey?m(s)+"\u2013"+m(e)+" "+ey:m(s)+" "+sy+"\u2013"+m(e)+" "+ey:s.getUTCDate()+" "+m(s)+" "+sy+"\u2013"+
e.getUTCDate()+" "+m(e)+" "+ey}function asOfLine(d){var x=parse(d);return"As at "+x.getUTCDate()+" "+MON[x.getUTCMonth()]+" "+x.getUTCFullYear()}function footerStamp(basis,fetchedAt,cur){var t=fetchedAt?new Date(fetchedAt):new Date,wd=t.toLocaleDateString("en-AU",{weekday:"long"}),dm=t.getDate()+" "+
MON[t.getMonth()]+", "+t.getFullYear(),hm=t.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",hour12:!0}),off=-t.getTimezoneOffset(),sign=off>=0?"+":"-",a=Math.abs(off),tz="GMT"+sign+String(Math.floor(a/60)).padStart(2,"0")+":"+String(a%60).padStart(2,"0");return(basis==null?cur||"":(basis===
"Cash"?"Cash basis":"Accrual basis")+(cur?" \xB7 "+cur:""))+" | "+wd+", "+dm+" "+hm+" "+tz}function doc(d,kind,base){var cn=kind!=="Invoice",cur=d.CurrencyCode||base,fx=!!(base&&cur!==base),rate=num(d.CurrencyRate)||1,conv=function(v){return v==null?null:Math.round((fx?v/rate:v)*100)/100},date=isoDate(d.DateString||d.Date),due=cn?date:isoDate(d.DueDateString||d.DueDate)||date,sg=cn?-1:1;return{
kind,type:d.Type||"",number:d.InvoiceNumber||d.CreditNoteNumber||d.Reference||"",contact:(d.Contact||{}).Name||"(no contact)",cid:String((d.Contact||{}).ContactID||(d.Contact||{}).Name||""),date,due,status:d.Status||"",total:conv(sg*(num(d.Total)||0)),amount:conv(sg*(num(cn?d.RemainingCredit:d.AmountDue)||
0)),cur,fx,id:d.InvoiceID||d.CreditNoteID||d.OverpaymentID||d.PrepaymentID||"",raw:d}}function pipeline(list,asAt2,base){var st={draft:{n:0,v:0,docs:[]},approval:{n:0,v:0,docs:[]},awaiting:{n:0,v:0,docs:[]},overdue:{n:0,v:0,docs:[]}},r=function(v){return Math.round(v*100)/100};return(list||[]).forEach(function(d){var x=doc(d,"Invoice",base),k=x.status==="DRAFT"?"draft":x.status==="SU\
BMITTED"?"approval":x.status==="AUTHORISED"&&x.amount?"awaiting":null;if(k){var v=k==="awaiting"?x.amount:x.total;st[k].n++,st[k].v=r(st[k].v+v),st[k].docs.push(x),k==="awaiting"&&x.due&&x.due<asAt2&&(st.overdue.n++,st.overdue.v=r(st.overdue.v+v),st.overdue.docs.push(x))}}),st}function plParts(w,col){
var i=col||0,tot=function(re){var s=w.sections.filter(function(x){return re.test(x.title)});return s.length?sum(s.map(function(x){return sectionTotal(x,i)})):null},calcL=function(re){var l=find(w.lines,null,re,"total");return l?l.values[i]:null},inc=sum(w.sections.filter(function(x){return!isDeduction(
x.title)}).map(function(x){return sectionTotal(x,i)})),exp=sum(w.sections.filter(function(x){return isDeduction(x.title)}).map(function(x){return sectionTotal(x,i)})),trading=tot(/^(trading )?income$|^revenue$|^sales$/i);return{income:inc,expenses:exp,trading:trading==null?inc:trading,cos:tot(/cost of sales/i)||
0,otherIncome:tot(/^other income$/i)||0,opex:tot(/operating expenses|^(less )?expenses$/i)||0,otherExpenses:tot(/other expenses/i)||0,gp:calcL(/^gross profit$/i),np:calcL(/^net (profit|loss)$/i)}}function bsParts(w,col){var i=col||0,rowV=function(re,grp){var l=w.lines.filter(function(x){return x.kind===
"row"&&re.test(x.label)&&(!grp||grp.test(x.group))})[0];return l?l.values[i]:null},secs=function(parent,test){return sum(w.sections.filter(function(x){return x.parent&&parent.test(x.parent)&&test(x.title)}).map(function(x){return sectionTotal(x,i)}))},tl=function(re){var l=find(w.lines,null,re,"tota\
l");return l?l.values[i]:null},bank=w.sections.filter(function(x){return/^bank$/i.test(x.title)})[0];return{bank:bank?sectionTotal(bank,i):null,bankRows:bank?bank.rows.map(function(l){return{label:l.label,value:l.values[i]}}):[],currentAssets:secs(/^assets$/i,function(t){return!/fixed|non-current|non current/i.
test(t)}),currentLiabilities:secs(/^liabilities$/i,function(t){return/current/i.test(t)&&!/non-current|non current/i.test(t)}),ar:rowV(/^accounts receivable$/i),ap:rowV(/^accounts payable$/i),gst:rowV(/^gst$|^gst (payable|liability)|^sales tax/i),totalAssets:tl(/^total assets$/i),totalLiabilities:tl(
/^total liabilities$/i),netAssets:tl(/^net assets$/i),equity:(function(){var l=find(w.lines,"Equity",null,"total");return l?l.values[i]:null})(),cye:(function(){var l=currentYearEarnings(w.lines);return l?l.values[i]:null})()}}function monthLabel(key){var p=String(key).split("-");return MON[+p[1]-1].slice(0,3)+" "+p[0]}function monthsEnding(endIso,n){for(var e=parse(endIso),out=[],i=n-1;i>=0;i--){var y=e.getUTCFullYear(),m=e.getUTCMonth()+1-i,s0=D(y,m,1);out.push({key:s0.getUTCFullYear()+"-"+String(s0.getUTCMonth()+1).padStart(
2,"0"),start:iso(s0),end:iso(eom(s0.getUTCFullYear(),s0.getUTCMonth()+1))})}return out}var CRC=(function(){var t=[],c,n,k;for(n=0;n<256;n++){for(c=n,k=0;k<8;k++)c=c&1?3988292384^c>>>1:c>>>1;t[n]=c>>>0}return t})();function crc32(b){for(var c=4294967295,i=0;i<b.length;i++)c=CRC[(c^b[i])&255]^c>>>8;return(c^4294967295)>>>0}function utf8(s){return new TextEncoder().encode(s)}function zip(files){
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
tionships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+wbRels+"</Relationships>"},{name:"xl/styles.xml",data:styles}),zip(files)}function download(bytes,name,mime){var blob=new Blob([bytes],{type:mime||"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),a=document.createElement("a");a.href=URL.createObjectURL(blob),a.download=name,document.body.appendChild(a),a.click(),setTimeout(function(){URL.revokeObjectURL(
a.href),a.remove()},1500)}function reportParams(v){var d=v.display||DISPLAY_DEFAULT,p={from_date:v.start||null,to_date:v.end||null,as_at:v.asAt||null,accounting_basis:v.basis||null,xero_tenant_id:v.org||null,cents:d.cents?"shown":"hidden",divide_by_1000:d.k?"yes":"no",zero_rows:d.zeros?"shown":"hidd\
en",negatives:d.neg,negatives_in_red:d.red?"yes":"no",header:d.hdr?"shown":"hidden",footer:d.ftr?"shown":"hidden"};return Object.keys(p).forEach(function(k){p[k]==null&&delete p[k]}),p}function h(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,
"&quot;")}function negCls(v,d){return d&&d.red&&isNeg(v)?" neg":""}function grid(el,spec,ctx){var st={key:null,dir:1,q:""};function draw(){var rows=spec.rows.filter(function(r){if(!st.q)return!0;var q=st.q.toLowerCase();return spec.columns.some(function(c){return String(r[c.key]==null?"":r[c.key]).toLowerCase().indexOf(q)>=0})});st.key&&(rows=rows.slice().sort(function(a,b){
var x=a[st.key],y=b[st.key];return x==null?1:y==null?-1:(typeof x=="number"&&typeof y=="number"?x-y:String(x).localeCompare(String(y)))*st.dir}));function cell(c,r,tag){var v=r[c.key],txt=c.fmt?c.fmt(v,r):c.money?money(v,ctx.currency,ctx.display):v==null?"":v;return"<"+tag+' class="'+(c.num||c.money?
"num":"")+(c.money?negCls(v,ctx.display):"")+'">'+(c.html?txt:h(txt))+"</"+tag+">"}var html=(spec.filter&&spec.rows.length>8?'<input class="xk-filter" type="search" placeholder="Filter\u2026" aria-label="Filter rows" value="'+h(st.q)+'">':"")+'<div class="xk-scroll"><table class="xk-grid"><thead><tr\
>'+spec.columns.map(function(c){return'<th scope="col" data-k="'+h(c.key)+'" class="'+(c.num||c.money?"num":"")+'" aria-sort="'+(st.key===c.key?st.dir>0?"ascending":"descending":"none")+'">'+h(c.title)+(st.key===c.key?st.dir>0?" \u25B2":" \u25BC":"")+"</th>"}).join("")+"</tr></thead><tbody>"+(rows.length?
rows.map(function(r){return"<tr>"+spec.columns.map(function(c){return cell(c,r,"td")}).join("")+"</tr>"}).join(""):'<tr><td colspan="'+spec.columns.length+'" class="muted">'+h(spec.empty||"Data appears once it's available.")+"</td></tr>")+"</tbody>"+((spec.foot||(spec.total?[spec.total]:[])).length?
"<tfoot>"+(spec.foot||[spec.total]).map(function(f2){return'<tr class="k-total">'+spec.columns.map(function(c){return cell(c,f2,"td")}).join("")+"</tr>"}).join("")+"</tfoot>":"")+"</table></div>";el.innerHTML=html,el.querySelectorAll("th[data-k]").forEach(function(thEl){thEl.addEventListener("click",
function(){var k=thEl.getAttribute("data-k");st.dir=st.key===k?-st.dir:1,st.key=k,draw()})});var f=el.querySelector(".xk-filter");f&&f.addEventListener("input",function(){st.q=f.value;var pos=f.selectionStart;draw();var g=el.querySelector(".xk-filter");g.focus(),g.setSelectionRange(pos,pos)})}draw()}
function scale(vals){var mn=Math.min(0,Math.min.apply(null,vals)),mx=Math.max(0,Math.max.apply(null,vals));return mn===mx&&(mx=mn+1),{mn,mx}}function legend(series){return'<div class="xk-legend">'+series.map(function(s,i){return'<span><i style="background:'+(s.color||"var(--c"+(i+1)+")")+'"></i>'+h(
s.name)+"</span>"}).join("")+"</div>"}function bars(el,o,ctx){var W=640,H=220,P=28,all=[],fmt=o.fmt||function(v){return money(v,ctx.currency,ctx.display)};if(o.stacked?o.labels.forEach(function(_,i){var pos=0,neg=0;o.series.forEach(function(s){var v=s.values[i]||0;v>=0?pos+=v:neg+=v}),all.push(pos,neg)}):
o.series.forEach(function(s){all=all.concat(s.values.filter(function(v){return v!=null}))}),!all.length){el.innerHTML=`<p class="muted">Data appears once it's available.</p>`;return}var sc=scale(all),n=o.labels.length,gw=(W-P*2)/Math.max(n,1),bw=Math.max(2,gw*.7/(o.stacked?1:o.series.length)),stackP=[],
stackN=[];function y(v){return P+(H-P*2)*(1-(v-sc.mn)/(sc.mx-sc.mn))}var svg='<svg viewBox="0 0 '+W+" "+H+'" role="img" aria-label="'+h(o.title||"Bar chart")+'"><line x1="'+P+'" x2="'+(W-P)+'" y1="'+y(0)+'" y2="'+y(0)+'" class="axis"/>';if(o.labels.forEach(function(lb,i){o.series.forEach(function(s,j){
var v=s.values[i];if(v!=null){var base0=0;if(o.stacked){var k=v>=0?stackP:stackN;base0=k[i]||0,k[i]=base0+v}var x=P+gw*i+gw*.15+(o.stacked?0:bw*j),y0=y(base0),y1=y(base0+v),fill=s.colors&&s.colors[i]||s.color||"var(--c"+(j+1)+")";svg+='<rect x="'+x.toFixed(1)+'" y="'+Math.min(y0,y1).toFixed(1)+'" wi\
dth="'+bw.toFixed(1)+'" height="'+Math.max(1,Math.abs(y1-y0)).toFixed(1)+'" fill="'+fill+'"'+(o.fadeFrom!=null&&i>o.fadeFrom?' fill-opacity="0.45" class="proj"':"")+"><title>"+h(s.name+" \xB7 "+lb+": "+fmt(v)+(s.tips&&s.tips[i]?`
`+s.tips[i]:""))+"</title></rect>"}});var nearMark=o.mark&&i!==o.mark.at&&Math.abs(i-o.mark.at)<(o.every||1)/2;!nearMark&&(n<=16||o.every&&i%o.every===0||o.mark&&i===o.mark.at)&&(svg+='<text x="'+(P+gw*i+gw/2).toFixed(1)+'" y="'+(H-8)+'" class="tick" text-anchor="middle">'+h(lb)+"</text>")}),o.mark){
var mx=(P+gw*o.mark.at+gw/2).toFixed(1);svg+='<line x1="'+mx+'" x2="'+mx+'" y1="'+(P-6)+'" y2="'+(H-P+4)+'" class="xk-mark" stroke="var(--ink)" stroke-dasharray="4 3" stroke-width="1"/><text x="'+mx+'" y="'+(P-10)+'" class="tick" text-anchor="middle" font-weight="600">'+h(o.mark.label||"")+"</text>"}
el.innerHTML=svg+"</svg>"+legend(o.series)}var FRIENDLY={needs_connection:"Connect Xero (Settings \u2192 Connections) to see this data.",connection_unavailable:"Xero is temporarily unavailable \u2014 press Refresh to try again.",tool_not_found:"This Xero report is not available on the connected connector.",tool_error:"Xero returned an error \
for this section.",invalid_inputs:"One of the report controls has an invalid value."},MECHANISM="xero-accounting connector \u2014 mySMB custom MCP on the Xero Accounting API (AGT-001)";function app(cfg){var MH=window.MyHubReport,live=!!(MH&&MH.mode!=="snapshot"),I=cfg.inputs||{},S={inputs:Object.assign(
{},cfg.defaults),data:{},errors:{},fetchedAt:null,first:!0,busy:0,pages:{},trunc:{}},$=function(id){return document.getElementById(id)};function disp(){return readDisplay(I.display?S.inputs[I.display]:"")}function setDisp(patch){if(I.display){var d=disp(),k;for(k in patch)d[k]=patch[k];S.inputs[I.display]=
writeDisplay(d)}}function co(){return companyOf(S.data[cfg.org],S.data[cfg.conns],I.org?S.inputs[I.org]:"",(reportOf(S.data[cfg.primary])||{}).ReportTitles)}function fy(){return fiscalStart(co().org,cfg.fyMonth)}function absorb(id,v){var e=errorOf(v);S.pages[id]=null,S.trunc[id]=!1,e?(delete S.data[id],
S.errors[id]={code:"tool_error",message:e}):(S.data[id]=v,delete S.errors[id])}function srcOf(id){return(cfg.sources||{})[id]||null}function quiet(id){var sc=srcOf(id);return!!(sc&&sc.quiet&&sc.quiet(Object.assign({},S.inputs)))}function err(id){var e=S.errors[id],sc=srcOf(id);return e?e.code==="nee\
ds_connection"&&sc?sc.name+" is not connected \u2014 add the "+sc.name+" extension and connect it (Settings \u2192 Connections) to include this.":(FRIENDLY[e.code]||e.message||"Unavailable")+(e.code==="tool_error"&&e.message?" ("+e.message+")":""):null}function announce(){MH&&live&&MH.setInputs(Object.
assign({},S.inputs))}function status(t){var el=$("xk-status");el&&(el.textContent=t||"")}var RATE=/\b429\b|rate.?limit|too many requests/i;function limited(){return Object.keys(S.errors).filter(function(id){var e=S.errors[id];return e&&RATE.test(String(e.message||""))})}function fetchOne(id,inputs){
S.req=S.req||{};var tok=S.req[id]=(S.req[id]||0)+1,latest=function(){return S.req[id]===tok};return MH.getData(id,inputs).then(function(v){latest()&&absorb(id,v)},function(e){latest()&&(S.errors[id]={code:e&&e.code||"tool_error",message:e&&e.message||String(e)})})}function retryLimited(round){var ids=limited();
if(!MH||!live||!ids.length||round>3)return Promise.resolve(!1);S.busy++,status("Xero is busy \u2014 loading "+ids.length+" more section"+(ids.length>1?"s":"")+"\u2026");var inputs=Object.assign({},S.inputs),wait=function(ms){return new Promise(function(r){setTimeout(r,ms)})};return ids.reduce(function(p,id){
return p.then(function(){return wait(round*(cfg.retryMs==null?700:cfg.retryMs))}).then(function(){return fetchOne(id,inputs)})},Promise.resolve()).then(function(){return S.busy--,status(""),S.fetchedAt=new Date().toISOString(),render(),retryLimited(round+1)})}function pageAll(){var P=cfg.paged||{},ids=Object.
keys(P).filter(function(id){return S.data[id]&&!S.pages[id]});return!MH||!live||!ids.length?Promise.resolve(!1):(S.busy++,ids.reduce(function(p,id){return p.then(function(){return more(id)})},Promise.resolve()).then(function(){return S.busy--,status(""),render(),!0}))}function more(id){var P=cfg.paged[id],
size=P.size||100,max=P.max||20,got=S.pages[id]=[S.data[id]],first=S.data[id],tries=0,wait=function(ms){return new Promise(function(r){setTimeout(r,ms)})};function step(){if(S.data[id]!==first)return Promise.resolve();var rows2=(got[got.length-1]||{})[P.key]||[];if(rows2.length<size)return Promise.resolve();
if(got.length>=max)return S.trunc[id]=!0,Promise.resolve();var inp=Object.assign({},S.inputs);return inp[P.input]=got.length+1,status("Loading "+((cfg.tools||{})[id]||id)+" \u2014 page "+(got.length+1)+"\u2026"),MH.getData(id,inp).then(function(v){if(errorOf(v))throw new Error(errorOf(v));return S.data[id]===
first&&(got.push(v),tries=0),step()},function(e){var msg=e&&e.message||String(e);if(RATE.test(msg)&&tries++<3)return wait(tries*(cfg.retryMs==null?700:cfg.retryMs)).then(step);S.data[id]===first&&(S.trunc[id]=!0,S.pageError=S.pageError||{},S.pageError[id]=msg)})}return step()}function fanAll(){var F=cfg.
fan||{},ids=Object.keys(F);if(!MH||!live||!ids.length)return Promise.resolve(!1);S.fan=S.fan||{};var c=ctx(),jobs=[];if(ids.forEach(function(id){var list=F[id](Object.assign({},S.inputs),c)||[],sig=JSON.stringify([S.inputs[I.org]||"",list]);if(!(S.fan[id]&&S.fan[id].sig===sig)){var st=S.fan[id]={sig,
items:list.map(function(x){return{key:x.key,value:null,error:null,done:!1}})};list.forEach(function(x,i){jobs.push({id,st,i,inputs:Object.assign({},S.inputs,x.inputs)})})}}),!jobs.length)return Promise.resolve(!1);var conc=cfg.fanConc||2,next=0,wait=function(ms){return new Promise(function(r){setTimeout(
r,ms)})};S.busy++,status("Loading "+jobs.length+" more figures from Xero\u2026");function run(j,tries){return MH.getData(j.id,j.inputs).then(function(v){var e=errorOf(v);j.st.items[j.i].value=e?null:v,j.st.items[j.i].error=e,j.st.items[j.i].done=!0},function(e){var msg=e&&e.message||String(e);if(RATE.
test(msg)&&tries<3)return wait((tries+1)*(cfg.retryMs==null?700:cfg.retryMs)).then(function(){return run(j,tries+1)});j.st.items[j.i].error=msg,j.st.items[j.i].done=!0})}function worker(){if(next>=jobs.length)return Promise.resolve();var j=jobs[next++];return run(j,0).then(worker)}for(var ws=[],k=0;k<
conc;k++)ws.push(worker());return Promise.all(ws).then(function(){return S.busy--,status(""),render(),!0})}function fan(id){var st=(S.fan||{})[id];return!st||!live?null:st.items.every(function(x){return x.done})?st.items:null}function rows(id){var P=(cfg.paged||{})[id]||{},list=S.pages[id]||(S.data[id]?
[S.data[id]]:[]),out=[];return list.forEach(function(v){(v&&v[P.key]||[]).forEach(function(r){out.push(r)})}),out}function truncated(id){var P=(cfg.paged||{})[id];return!P||!S.data[id]?!1:S.trunc[id]?!0:!live&&((S.data[id]||{})[P.key]||[]).length>=(P.size||100)}function requery(changed){if(!MH||!live)
return render(),Promise.resolve();var ids=Object.keys(cfg.uses||{}).filter(function(id){return!changed||(cfg.uses[id]||[]).some(function(n){return changed.indexOf(n)>=0})});if(!ids.length)return render(),Promise.resolve();S.busy++,status("Loading\u2026");var inputs=Object.assign({},S.inputs);return Promise.
all(ids.map(function(id){return fetchOne(id,inputs)})).then(function(){S.fetchedAt=new Date().toISOString(),S.busy--,status("");var roll=rollPresets();if(roll)return change(roll);var hl=heal();return hl||(render(),retryLimited(1).then(pageAll).then(fanAll))})}function change(patch,dispPatch){var changed=[],
k;S.healed=!1;for(k in patch)k&&S.inputs[k]!==patch[k]&&(S.inputs[k]=patch[k],changed.push(k));if(dispPatch&&setDisp(dispPatch),cfg.derive){var dv=cfg.derive(Object.assign({},S.inputs),fy().month,disp())||{};for(k in dv)S.inputs[k]!==dv[k]&&(S.inputs[k]=dv[k],changed.push(k))}var d=disp();if(cfg.compare&&
d.c!=="none"&&d.c!=="periods"){if(I.cmpStart&&I.start){var c=compare(S.inputs[I.start],S.inputs[I.end],d.c,fy().month);(S.inputs[I.cmpStart]!==c.start||S.inputs[I.cmpEnd]!==c.end)&&(S.inputs[I.cmpStart]=c.start,S.inputs[I.cmpEnd]=c.end,changed.push(I.cmpStart,I.cmpEnd))}if(I.cmpAsAt&&I.asAt){var ca=compareAsAt(
S.inputs[I.asAt],d.c);S.inputs[I.cmpAsAt]!==ca&&(S.inputs[I.cmpAsAt]=ca,changed.push(I.cmpAsAt))}}return announce(),changed.length?requery(changed):(render(),fanAll())}function compareAsAt(asAtIso,mode){var x=parse(asAtIso);return iso(mode==="prev_year"?D(x.getUTCFullYear()-1,x.getUTCMonth()+1,Math.
min(x.getUTCDate(),eom(x.getUTCFullYear()-1,x.getUTCMonth()+1).getUTCDate())):eom(x.getUTCFullYear(),x.getUTCMonth()))}function rollPresets(){if(!live)return null;var d=disp(),p={},f=fy().month;if(I.start&&d.p&&d.p!=="custom"){var r=preset(d.p,f);r&&(r.start!==S.inputs[I.start]||r.end!==S.inputs[I.end])&&
(p[I.start]=r.start,p[I.end]=r.end)}if(I.asAt&&d.a&&d.a!=="custom"){var a=asAt(d.a,f);a&&a!==S.inputs[I.asAt]&&(p[I.asAt]=a)}if(cfg.roll){var cr=cfg.roll(Object.assign({},S.inputs),f,d)||{},k2;for(k2 in cr)cr[k2]!==S.inputs[k2]&&(p[k2]=cr[k2])}if(cfg.derive){var dv=cfg.derive(Object.assign({},S.inputs,
p),f,d)||{},k3;for(k3 in dv)dv[k3]!==S.inputs[k3]&&(p[k3]=dv[k3])}return Object.keys(p).length?p:null}function adoptHeader(){var r=reportOf(S.data[cfg.primary]);if(!(live||!r)){var ds=titleDates((r.ReportTitles||[]).slice(2).join(" "));I.start&&ds.length>=2&&(S.inputs[I.start]=ds[0],I.end&&cfg.headerEnd!==
!1&&(S.inputs[I.end]=ds[1])),I.asAt&&ds.length&&(S.inputs[I.asAt]=ds[ds.length-1])}}function stale(){var want=I.start?[S.inputs[I.start],S.inputs[I.end]]:I.asAt?[S.inputs[I.asAt]]:null;return want?(cfg.dated||[cfg.primary]).filter(function(id){var r=reportOf(S.data[id]);if(!r)return!1;var ds=titleDates(
(r.ReportTitles||[]).slice(2).join(" "));return ds.length?want.length===2?ds.length>=2?!(ds[0]===want[0]&&ds[ds.length-1]===want[1]):ds[0]!==want[1]:ds[ds.length-1]!==want[0]:!1}).map(function(id){var r=reportOf(S.data[id]);return{id,title:String((r.ReportTitles||[]).slice(2).join(" "))}}):[]}function dateKeys(){
return Object.keys(S.inputs).filter(function(k){return k!==I.org&&k!==I.persona&&k!==I.display&&k!==I.basis})}function heal(){return!live||S.healed||!stale().length?null:(S.healed=!0,requery(dateKeys()))}function optv(id){var o=(cfg.options||[]).filter(function(x){return x.id===id})[0],m=new RegExp(
"(?:^|;)"+id+"=([^;]*)").exec(disp().o||"");return m?m[1]:o?o.def:null}function setOpt(id,v){var kv={};return String(disp().o||"").split(";").forEach(function(p){var i=p.indexOf("=");i>0&&(kv[p.slice(0,i)]=p.slice(i+1))}),kv[id]=v,Object.keys(kv).map(function(k){return k+"="+kv[k]}).join(";")}function opt(list,cur){
return list.map(function(o){return'<option value="'+h(o[0])+'"'+(String(o[0])===String(cur)?" selected":"")+">"+h(o[1])+"</option>"}).join("")}function controls(){var el=$("xk-controls");if(el){var d=disp(),c0=co(),dis=live?"":" disabled",x="";I.org&&c0.orgs.length>1?x+='<label class="ctl">Organisat\
ion<select id="xk-client"'+dis+' title="The Xero organisations this connection can access \u2014 one organisation per report.">'+opt(c0.orgs.map(function(f){return[f.id,f.name||f.id]}),S.inputs[I.org]||c0.active||"")+"</select></label>":x+='<label class="ctl">Organisation<select id="xk-client" title\
="The Xero organisation this connection uses."><option>'+h(c0.name||"Connected Xero organisation")+"</option></select></label>",I.start&&(x+='<label class="ctl">Report period<select id="xk-preset"'+dis+">"+opt(cfg.presets||PRESETS,d.p)+'</select></label><label class="ctl">From<input type="date" id="\
xk-from" value="'+h(S.inputs[I.start])+'"'+dis+'></label><label class="ctl">To<input type="date" id="xk-to" value="'+h(S.inputs[I.end])+'"'+dis+"></label>"),I.asAt&&(x+='<label class="ctl">As at<select id="xk-asat-preset"'+dis+">"+opt(cfg.asats||ASAT,d.a)+'</select></label><label class="ctl">Date<in\
put type="date" id="xk-asat" value="'+h(S.inputs[I.asAt])+'"'+dis+"></label>"),I.basis&&(x+='<fieldset class="ctl seg"'+dis+"><legend>Accounting method</legend>"+["Cash","Accrual"].map(function(b){return'<label><input type="radio" name="xk-basis" value="'+b+'"'+(S.inputs[I.basis]===b?" checked":"")+
dis+">"+b+"</label>"}).join("")+"</fieldset>"),I.columnsBy&&cfg.columnsBy&&(x+='<label class="ctl">Display columns by<select id="xk-cols"'+dis+">"+opt(cfg.columnsBy,S.inputs[I.columnsBy])+"</select></label>"),cfg.compare&&(x+='<label class="ctl">Compare to<select id="xk-cmp"'+dis+">"+opt(cfg.compareModes||
(I.asAt?[["none","None"],["prev_period","Previous month end"],["prev_year","Previous year"]]:[["none","None"],["prev_period","Previous period"],["prev_year","Previous year"],["ytd","Year-to-date"]]),d.c)+"</select></label>"),(cfg.enums||[]).forEach(function(e,i){var rq=Object.keys(cfg.uses||{}).some(
function(id){return(cfg.uses[id]||[]).indexOf(e.input)>=0});x+='<label class="ctl">'+h(e.label)+'<select id="xk-enum-'+i+'"'+(rq?dis:"")+">"+opt(e.options,S.inputs[e.input])+"</select></label>"}),cfg.views&&(x+='<label class="ctl">Report<select id="xk-view">'+opt(cfg.views,d.v||cfg.views[0][0])+"</s\
elect></label>"),(cfg.options||[]).forEach(function(o){o.when&&!o.when(d)||(x+='<label class="ctl">'+h(o.label)+'<select id="xk-opt-'+h(o.id)+'"'+(o.title?' title="'+h(o.title)+'"':"")+">"+opt(o.options,optv(o.id))+"</select></label>")}),(I.persona||cfg.personaDisplay)&&(x+='<label class="ctl">View \
as<select id="xk-persona">'+opt([["Client","Client"],["Bookkeeper","Bookkeeper"],["Practitioner","Practitioner"],["Executive","Executive"]],I.persona?S.inputs[I.persona]:d.pv||"Bookkeeper")+"</select></label>"),x+='<details class="ctl customise"><summary>Customise</summary><div class="cz"><label><in\
put type="checkbox" id="xk-cents"'+(d.cents?" checked":"")+'> Show cents</label><label><input type="checkbox" id="xk-k"'+(d.k?" checked":"")+'> Divide by 1000</label><label><input type="checkbox" id="xk-zeros"'+(d.zeros?"":" checked")+'> Except zero amounts</label><label>Negative numbers<select id="\
xk-neg">'+opt([["minus","-100"],["paren","(100)"],["trail","100-"]],d.neg)+'</select></label><label><input type="checkbox" id="xk-red"'+(d.red?" checked":"")+'> Show in red</label><label><input type="checkbox" id="xk-hdr"'+(d.hdr?" checked":"")+'> Header</label><label><input type="checkbox" id="xk-f\
tr"'+(d.ftr?" checked":"")+'> Footer</label><label>View<select id="xk-dens">'+opt([["compact","Compact"],["100","100%"]],d.dens)+'</select></label><label>Branding<select id="xk-branding" title="Xero branding (default) or the mySMB Reporting template \u2014 display only, the data does not change">'+opt(
[["xero","Xero"],["mysmb","mySMB"]],d.style==="mysmb"?"mysmb":"xero")+'</select></label><label>Brand colour<input type="color" id="xk-brand" value="'+h(HEX.test(d.b)?d.b:"#13b5ea")+'"></label><label>&nbsp;<button type="button" id="xk-brand-reset"'+(HEX.test(d.b)?"":" disabled")+">Use Xero branding</\
button></label></div></details>",x+='<div class="ctl btns"><button type="button" id="xk-pdf">Download PDF</button><button type="button" id="xk-xlsx">Download Excel</button></div>',el.innerHTML=x,wire()}}function on(id,ev,fn){var e=$(id);e&&e.addEventListener(ev,fn)}function wire(){on("xk-client","ch\
ange",function(){if(I.org){var p={};p[I.org]=this.value,change(p)}}),on("xk-preset","change",function(){var k=this.value,r=preset(k,fy().month),p={};r&&(p[I.start]=r.start,p[I.end]=r.end),change(p,{p:k})}),on("xk-from","change",function(){var p={};p[I.start]=this.value,change(p,{p:"custom"})}),on("x\
k-to","change",function(){var p={};p[I.end]=this.value,change(p,{p:"custom"})}),on("xk-asat-preset","change",function(){var k=this.value,a=asAt(k,fy().month),p={};a&&(p[I.asAt]=a),change(p,{a:k})}),on("xk-asat","change",function(){var p={};p[I.asAt]=this.value,change(p,{a:"custom"})}),document.querySelectorAll(
'input[name="xk-basis"]').forEach(function(r){r.addEventListener("change",function(){var p={};p[I.basis]=this.value,change(p)})}),on("xk-cols","change",function(){var p={};p[I.columnsBy]=this.value,change(p)}),on("xk-cmp","change",function(){change({},{c:this.value})}),(cfg.enums||[]).forEach(function(e,i){
on("xk-enum-"+i,"change",function(){var p={};p[e.input]=this.value,change(p)})}),on("xk-view","change",function(){change({},{v:this.value})}),(cfg.options||[]).forEach(function(o){on("xk-opt-"+o.id,"change",function(){change({},{o:setOpt(o.id,this.value)})})}),on("xk-persona","change",function(){if(!I.
persona)return change({},{pv:this.value});var p={};p[I.persona]=this.value,change(p)}),[["xk-cents","cents"],["xk-k","k"],["xk-red","red"],["xk-hdr","hdr"],["xk-ftr","ftr"]].forEach(function(c){on(c[0],"change",function(){var p={};p[c[1]]=this.checked?1:0,change({},p)})}),on("xk-zeros","change",function(){
change({},{zeros:this.checked?0:1})}),on("xk-neg","change",function(){change({},{neg:this.value})}),on("xk-dens","change",function(){change({},{dens:this.value})}),on("xk-branding","change",function(){change({},{style:this.value})}),on("xk-brand","change",function(){HEX.test(this.value)&&change({},{
b:this.value.toLowerCase()})}),on("xk-brand-reset","click",function(){change({},{b:""})}),on("xk-pdf","click",function(){window.print()}),on("xk-xlsx","click",function(){exportXlsx()})}function ctx(){var d=disp(),c0=co(),f=fy();return{data:S.data,errors:S.errors,err,inputs:S.inputs,I,display:d,view:d.
v||(cfg.views?cfg.views[0][0]:""),compareMode:cfg.compare?d.c:"none",persona:I.persona?S.inputs[I.persona]:cfg.personaDisplay&&d.pv||"Bookkeeper",company:c0.name,organisation:c0,fy:f,currency:homeCurrency(c0.org),live,fetchedAt:S.fetchedAt,source:srcOf,body:$("xk-body"),change,disp,today:iso(today()),
opt:optv,setOpt:function(id,v){return change({},{o:setOpt(id,v)})},rows,truncated,fan,pageError:function(id){return(S.pageError||{})[id]||null}}}var last={checks:[],na:[],notes:[]};function render(){var c=ctx(),d=c.display,root=document.documentElement;root.classList.toggle("style-mysmb",d.style==="\
mysmb"),root.classList.toggle("dens-compact",d.dens==="compact"),root.classList.toggle("brand-custom",applyBrand(root,d.style==="mysmb"?"":d.b)),document.body.classList.toggle("persona-summary",c.persona==="Client"||c.persona==="Executive"),document.body.classList.toggle("persona-detail",!(c.persona===
"Client"||c.persona==="Executive")),controls();var out={};try{out=cfg.render(c)||{}}catch(e){c.body&&(c.body.innerHTML='<p class="xk-err">This report could not render: '+h(e.message)+"</p>"),out={checks:[{name:"Report rendered",pass:!1,detail:e.message}]}}last={checks:out.checks||[],na:out.na||[],notes:out.
notes||[]},stale().forEach(function(x){last.checks.unshift({name:"Xero report dates = the selected dates",pass:!1,detail:(cfg.tools||{})[x.id]+' returned "'+x.title+'" \u2014 press Refresh'})});var nc=Object.keys(S.errors).some(function(id){return S.errors[id]&&S.errors[id].code==="needs_connection"&&
!srcOf(id)});if(nc&&c.body&&c.body.textContent.indexOf(FRIENDLY.needs_connection)<0){var dv=document.createElement("div");dv.className="xk-banner fail",dv.textContent=FRIENDLY.needs_connection,c.body.insertBefore(dv,c.body.firstChild)}Object.keys(S.errors).forEach(function(id){if(!(id===cfg.conns&&S.
data[cfg.org])&&!quiet(id)){var msg=err(id);if(!last.checks.some(function(k){return k.pass===!1&&k.detail===msg})){var sc=srcOf(id);last.checks.unshift({name:"Data loaded: "+((cfg.tools||{})[id]||id),pass:sc&&sc.optional?null:!1,detail:msg})}}});var hd=$("xk-head");if(hd){hd.hidden=!d.hdr||!!cfg.noHead;
var per=out.period||(I.start?periodLine(S.inputs[I.start],S.inputs[I.end]):I.asAt?asOfLine(S.inputs[I.asAt]):"");hd.innerHTML='<div class="ti">'+h(out.title||cfg.title)+'</div><div class="co">'+h(c.company||"N/A \u2014 not in source")+'</div><div class="pe">'+h(per)+'</div><div class="xk-src">'+(d.style===
"mysmb"?'<span class="xk-badge">mySMB</span>mySMB Reporting \xB7 data from Xero':'<span class="xk-badge">Xero</span>Prepared from Xero')+"</div>"}var ft=$("xk-foot");if(ft){ft.hidden=!d.ftr;var stamp=footerStamp(basisOf(),S.fetchedAt,c.currency);ft.textContent=d.style==="mysmb"?[c.company||"Xero org\
anisation",out.title||cfg.title,stamp].join(" | "):stamp}banner(c),sources(c)}function banner(c){var el=$("xk-banner");if(el){var ch=last.checks,isInfo=function(k){return!!k.info},fails=ch.filter(function(k){return k.pass===!1}),done=ch.filter(function(k){return k.pass===!0}),nInfo=ch.filter(isInfo).
length,nNA=ch.filter(function(k){return k.pass==null&&!isInfo(k)}).length,real=ch.length-nInfo,none=!fails.length&&!done.length&&ch.length>0,extra=(nNA?" \xB7 "+nNA+" N/A":"")+(nInfo?" \xB7 "+nInfo+" for information":"");el.className="xk-banner "+(fails.length?"fail":none?"na":"pass"),el.innerHTML="\
<strong>"+(fails.length?"\u26A0 Validation: "+fails.length+" check"+(fails.length>1?"s":"")+" failed"+(done.length?" \xB7 "+done.length+" passed":"")+extra:none?real?"\u2013 Validation: no check could run ("+nNA+" N/A"+(nInfo?" \xB7 "+nInfo+" for information":"")+")":"\u2139 Validation: "+nInfo+" li\
ne"+(nInfo>1?"s":"")+" for information":"\u2713 Validation: "+done.length+"/"+done.length+" check"+(done.length>1?"s":"")+" passed"+extra)+"</strong> \xB7 Data as of "+h(S.fetchedAt?new Date(S.fetchedAt).toLocaleString("en-AU"):"\u2014")+(live?"":" \xB7 Snapshot: figures frozen at capture time")+" \xB7\
 Financial year starts "+h(MONTHS[c.fy.month-1])+" ("+h(c.fy.source)+")<ul>"+ch.map(function(k){return'<li class="'+(k.pass===!1?"bad":k.pass===!0?"ok":isInfo(k)?"na info":"na")+'">'+(k.pass===!1?"\u2717 ":k.pass===!0?"\u2713 ":isInfo(k)?"\u2139 ":"\u2013 ")+h(k.name)+(k.detail?" \u2014 "+h(k.detail):
"")+"</li>"}).join("")+"</ul>"}}function basisOf(){return I.basis?S.inputs[I.basis]:cfg.basisLabel||(cfg.noBasis?null:"Accrual")}function sources(c){var el=$("xk-sources");if(el){var t=cfg.tools||{},items=Object.keys(t).map(function(id){var sc=srcOf(id);return h(t[id])+(S.errors[id]&&!quiet(id)?' \u2014 \
<span class="'+(sc&&sc.optional?"muted":"xk-err")+'">'+h(err(id))+"</span>":"")}),na=last.na.slice();c.company||na.unshift("Organisation name (Xero returned no organisation details)"),el.innerHTML="<h2>Sources &amp; limitations</h2><ul><li>Mechanism: "+h(cfg.mechanism||MECHANISM)+"</li><li>Tool call\
s: "+items.join(" \xB7 ")+"</li><li>Basis: "+h(basisOf()||"n/a")+" \xB7 Currency: "+h(c.currency)+" (the organisation's base currency \u2014 Xero's reports have no other presentation currency) \xB7 Organisation: "+h(c.company||"N/A \u2014 not in source")+" (one Xero organisation per report)</li>"+(/^assumed/.
test(c.fy.source)?"<li>Financial year: "+h(c.fy.source)+" (starts "+h(MONTHS[c.fy.month-1])+"). Adjust the dates if this organisation uses a different year.</li>":"")+last.notes.map(function(n){return"<li>"+h(n)+"</li>"}).join("")+(na.length?"<li>N/A \u2014 not in source: "+na.map(h).join("; ")+"</l\
i>":"")+"<li>Decision support only \u2014 not audit, tax or legal advice.</li></ul>"}}function exportXlsx(){var c=ctx(),sheets=[];try{sheets=cfg.excel&&cfg.excel(c)||[]}catch(e){sheets=[{name:"Error",rows:[["Excel export failed: "+e.message]]}]}var foot=[basisOf()?basisOf()+" basis":null,c.currency].
filter(Boolean).join(" \xB7 ");sheets.forEach(function(sh){var r=sh.rows||[],a=r[0]&&r[0][0],b=r[1]&&r[1][0];!a||!b||a.s!=="title"||b.s!=="bold"||(r[0]=[{v:b.v,s:"title"}],r[1]=[{v:a.v,s:"bold"}],r[3]&&!r[3].length&&(r[3]=[{v:foot,s:"muted"}]))}),sheets.push({name:"Validation",rows:[[{v:"Check",s:"b\
old"},{v:"Result",s:"bold"},{v:"Detail",s:"bold"}]].concat(last.checks.map(function(k){return[k.name,k.pass===!0?"Pass":k.pass===!1?"FAIL":"N/A",k.detail||""]})),widths:[60,10,60]});var pr=reportParams({start:I.start&&S.inputs[I.start],end:I.end&&S.inputs[I.end],asAt:I.asAt&&S.inputs[I.asAt],basis:I.
basis&&S.inputs[I.basis],org:I.org&&(S.inputs[I.org]||c.organisation.active||""),display:c.display});sheets.push({name:"Parameters",rows:[[{v:"Parameter",s:"bold"},{v:"Value",s:"bold"}]].concat(Object.keys(pr).map(function(k){return[k,String(pr[k])]})).concat([["basis",basisOf()||"n/a"],["currency",
c.currency],[],["Data as of",S.fetchedAt||""],["Source",cfg.mechanism||MECHANISM]]),widths:[28,60]});var name=[c.company||"Xero",cfg.title,I.start?S.inputs[I.start]+" to "+S.inputs[I.end]:I.asAt?"as at "+S.inputs[I.asAt]:""].filter(Boolean).join(" - ").replace(/[\\\/:*?"<>|]+/g," ");download(xlsx(sheets,
c.currency),name+".xlsx")}function boot(bundle){if(S.data={},S.errors=Object.assign({},bundle.errors||{}),S.fetchedAt=bundle.fetchedAt||null,Object.keys(bundle.data||{}).forEach(function(id){S.errors[id]||absorb(id,bundle.data[id])}),adoptHeader(),status(""),S.first){S.first=!1;var roll=rollPresets();
if(roll){change(roll);return}if(announce(),heal())return}render(),retryLimited(1).then(pageAll).then(fanAll)}return MH?(MyHubReport.onData(function(bundle){window.__reportStarted=!0,boot(bundle)}),MH.onRefresh&&MH.onRefresh(function(){status("Refreshing\u2026")}),MH.onThemeChange&&MH.onThemeChange(function(){
render()}),{state:S,change,render,exportXlsx,ctx,retryLimited}):(status("Open this report in mySMB to load Xero data."),{state:S})}window.XK={MONTHS,addDaysIso:function(s,k){return iso(addDays(parse(s),k))},app,asAt,asOfLine,bars,bsParts,eom,find,fyStartOf:function(isoDate2,m){return iso(fyStartOf(parse(
isoDate2),m))},grid,h,isDeduction,isoDate,money,monthLabel,monthsEnding,near,num,parse,pct,pipeline,plParts,rangeLabel,shortDate,sum,walk};})();</script>
<script>XK.app({
  title: 'Business overview', basisLabel: 'Accrual', primary: 'pnl_ytd', org: 'org', conns: 'connections', noBasis: true,
  inputs: { org: 'org', display: 'display' },
  defaults: { as_at: '2026-09-25', fy_start: '2026-07-01', prior_from: '2025-07-01', prior_to: '2025-09-25', month_from: '2026-09-01', org: '', page: 1,
    display: '{"cents":1,"k":0,"zeros":0,"neg":"paren","red":1,"hdr":1,"ftr":1,"style":"xero","dens":"100","p":"custom","a":"today","c":"none","v":"","o":"w="}' },
  uses: { bank: ['month_from', 'as_at', 'org'], invoices: ['org'], bills: ['org'], payments: ['org'], pnl_ytd: ['fy_start', 'as_at', 'org'], pnl_prior: ['prior_from', 'prior_to', 'org'], pnl_month: ['month_from', 'as_at', 'org'], accounts: ['org'], bs: ['as_at', 'org'], org: ['org'], connections: [] },
  paged: { invoices: { input: 'page', key: 'Invoices' }, bills: { input: 'page', key: 'Invoices' } },
  fan: { bank: function (inp) { return XK.monthsEnding(inp.as_at, 6).map(function (m) { return { key: m.key, inputs: { month_from: m.start, as_at: m.end < inp.as_at ? m.end : inp.as_at } }; }); } },
  tools: { bank: 'get_bank_summary (this month; and each of the last 6 months)', invoices: 'list_invoices (sales invoices)', bills: 'list_invoices (bills)', payments: 'list_payments (recent invoice payments)', pnl_ytd: 'get_profit_and_loss (financial year to date)', pnl_prior: 'get_profit_and_loss (same period last year)', pnl_month: 'get_profit_and_loss (this month, for the watchlist)', accounts: 'list_accounts (codes)', bs: 'get_balance_sheet (today, for the ties)', org: 'get_organisation', connections: 'list_connections' },
  roll: function () { return { as_at: XK.asAt('today') }; }, // a dashboard is always "now"
  derive: function (inp, fyMonth) {
    var f = XK.fyStartOf(inp.as_at, fyMonth), y = function (s) { var p = s.split('-'), yy = +p[0] - 1, last = XK.eom(yy, +p[1]).getUTCDate(); return yy + '-' + p[1] + '-' + String(Math.min(+p[2], last)).padStart(2, '0'); };
    return { fy_start: f, prior_from: y(f), prior_to: y(inp.as_at), month_from: inp.as_at.slice(0, 8) + '01' };
  },
  render: function (c) {
    var self = this, body = c.body, money = function (v) { return XK.money(v, c.currency, c.display); }, asAt = c.inputs.as_at, base = c.currency, r2 = function (v) { return Math.round(v * 100) / 100; };
    var w = c.data.pnl_ytd ? XK.walk(c.data.pnl_ytd) : null, wp = c.data.pnl_prior ? XK.walk(c.data.pnl_prior) : null, wm = c.data.pnl_month ? XK.walk(c.data.pnl_month) : null;
    var pl = w ? XK.plParts(w) : null, plp = wp ? XK.plParts(wp) : null;
    // bank accounts (this month's Bank Summary): Opening | Cash Received | Cash Spent | Closing
    var bw = c.data.bank ? XK.walk(c.data.bank) : null, banks = bw ? bw.lines.filter(function (l) { return l.kind === 'row'; }).map(function (l) { return { name: l.label, id: l.id, open: l.values[0], rin: l.values[1], rout: l.values[2], close: l.values[3] }; }) : [];
    var accts = ((c.data.accounts || {}).Accounts || []), byId = {}; accts.forEach(function (a) { byId[a.AccountID] = a; });
    // documents
    var P = XK.pipeline(c.rows('invoices').filter(function (d) { return d.Type === 'ACCREC'; }), asAt, base), Q = XK.pipeline(c.rows('bills').filter(function (d) { return d.Type === 'ACCPAY'; }), asAt, base);
    var A = XK.parse(asAt), dow = (A.getUTCDay() + 6) % 7, wk = [0, 1, 2].map(function (i) { return [XK.addDaysIso(asAt, -dow + 7 * i), XK.addDaysIso(asAt, -dow + 7 * i + 6)]; });
    var d2 = function (s) { return +s.slice(8) + ' ' + XK.MONTHS[+s.slice(5, 7) - 1].slice(0, 3); };
    var aging = function (S) { var b = [{ label: 'Older', v: 0 }, { label: 'This week', v: 0 }, { label: d2(wk[1][0]) + '–' + d2(wk[1][1]), v: 0 }, { label: d2(wk[2][0]) + '–' + d2(wk[2][1]), v: 0 }, { label: 'From ' + d2(XK.addDaysIso(wk[2][1], 1)), v: 0 }];
      S.awaiting.docs.forEach(function (d) { var j = d.due < wk[0][0] ? 0 : d.due <= wk[0][1] ? 1 : d.due <= wk[1][1] ? 2 : d.due <= wk[2][1] ? 3 : 4; b[j].v = r2(b[j].v + d.amount); }); return b; };
    var agI = aging(P), agB = aging(Q);
    var box = function (title, S, ag, id) {
      return '<div class="xk-card"><h3>' + title + '</h3><div class="xk-kpis"><div class="xk-kpi"><div class="lbl">' + S.awaiting.n + ' awaiting payment</div><div class="val">' + money(S.awaiting.v) + '</div></div><div class="xk-kpi"><div class="lbl">' + S.overdue.n + ' of ' + S.awaiting.n + ' overdue</div><div class="val' + (S.overdue.v > 0 ? ' neg' : '') + '">' + money(S.overdue.v) + '</div></div></div><div id="' + id + '"></div>' +
        '<p class="muted">Draft: ' + S.draft.n + ' (' + money(S.draft.v) + ') · Awaiting approval: ' + S.approval.n + ' (' + money(S.approval.v) + ')</p></div>';
    };
    // recent invoice payments
    var pays = ((c.data.payments || {}).Payments || []).filter(function (p) { return p.PaymentType === 'ACCRECPAYMENT' && p.Status !== 'DELETED'; }).slice(0, 9).map(function (p) { var i = p.Invoice || {}; return { number: i.InvoiceNumber || '', contact: (i.Contact || {}).Name || '', date: XK.shortDate(XK.isoDate(p.Date)), amount: XK.num(p.Amount) }; });
    // cash in and out — last 6 months (Bank Summary per month)
    var fan = c.fan('bank'), months = XK.monthsEnding(asAt, 6), cash = fan ? fan.map(function (it, i) {
      if (it.error || !it.value) return { key: months[i].key, error: it.error || 'no data' };
      var t = XK.walk(it.value), tl = XK.find(t.lines, null, /^total$/i, 'total') || { values: [] }; return { key: months[i].key, rin: tl.values[1], rout: tl.values[2], open: tl.values[0], close: tl.values[3] };
    }) : null;
    var cashOk = cash && cash.every(function (m) { return !m.error; }), cin = cashOk ? XK.sum(cash.map(function (m) { return m.rin; })) : null, cout = cashOk ? XK.sum(cash.map(function (m) { return m.rout; })) : null;
    // watchlist: accounts from the P&L (codes from list_accounts); chosen accounts are kept in the display input (o: w=code,code)
    var plRows = w ? w.lines.filter(function (l) { return l.kind === 'row'; }) : [], rowByCode = {}, codeOf = function (l) { var a = byId[l.id]; return a ? a.Code : l.label; };
    plRows.forEach(function (l) { rowByCode[codeOf(l)] = l; });
    var monthVal = function (code) { if (!wm) return null; var l = wm.lines.filter(function (x) { return x.kind === 'row' && codeOf(x) === code; })[0]; return l ? l.values[0] : 0; };
    var chosen = String(c.opt('w') || '').split(',').filter(function (x) { return x && rowByCode[x]; });
    if (!chosen.length && !/(^|;)w=[^;]/.test(c.display.o || '')) chosen = plRows.filter(function (l) { return XK.isDeduction(l.group); }).sort(function (a, b) { return b.values[0] - a.values[0]; }).slice(0, 4).map(codeOf);
    var watch = chosen.map(function (code) { var l = rowByCode[code]; return { code: byId[l.id] ? code : '', name: l.label, month: monthVal(code), ytd: l.values[0] }; });
    var npDelta = pl && plp && plp.np ? (pl.np - plp.np) / Math.abs(plp.np) : null;
    body.innerHTML = '<div class="xk-grid2">' +
      '<div class="xk-card"><h3>Bank accounts</h3>' + (banks.length ? banks.map(function (b) { var a = byId[b.id] || {}, num = a.BankAccountNumber ? '•••• ' + String(a.BankAccountNumber).slice(-4) : ''; return '<div class="xk-kpi" style="margin-bottom:8px"><div class="lbl">' + XK.h((a.CurrencyCode && a.CurrencyCode !== base ? a.CurrencyCode + ' ' : '') + b.name) + (num ? ' · ' + num : '') + '</div><div class="val' + (b.close < 0 ? ' neg' : '') + '">' + money(b.close) + '</div><div class="sub">Balance in Xero · Statement balance: N/A — not in source · Balance difference: N/A</div></div>'; }).join('') : '<p class="xk-err">' + XK.h(c.err('bank') || 'Bank Summary unavailable') + '</p>') + '</div>' +
      box('Invoices owed to you', P, agI, 'bo-ai') + box('Bills to pay', Q, agB, 'bo-ab') +
      '<div class="xk-card"><h3>Tasks</h3><ul><li>' + (P.overdue.n ? 'Chase ' + P.overdue.n + ' overdue invoice' + (P.overdue.n === 1 ? '' : 's') + ' (' + money(P.overdue.v) + ')' : 'No overdue invoices') + '</li><li>' + (Q.overdue.n ? 'Pay ' + Q.overdue.n + ' overdue bill' + (Q.overdue.n === 1 ? '' : 's') + ' (' + money(Q.overdue.v) + ')' : 'No overdue bills') + '</li><li class="muted">Reconcile items: N/A — bank-feed statement lines are not in the Xero API</li></ul></div>' +
      '<div class="xk-card"><h3>Recent invoice payments</h3><div id="bo-pay"></div></div>' +
      '<div class="xk-card"><h3>Cash in and out — last 6 months</h3>' + (cash == null ? '<p class="muted">' + (c.live ? 'Loading the last 6 months…' : 'N/A in a snapshot — open the live report') + '</p>' : cashOk ? '<p>Cash in ' + money(cin) + ' · Cash out ' + money(-cout) + ' · Difference ' + money(r2(cin - cout)) + '</p><div id="bo-cash"></div>' : '<p class="xk-err">Some months could not be loaded: ' + XK.h(cash.filter(function (m) { return m.error; }).map(function (m) { return XK.monthLabel(m.key) + ' (' + m.error + ')'; }).join('; ')) + '</p>') + '</div>' +
      '<div class="xk-card"><h3>Net profit or loss — year to date</h3>' + (pl ? '<div class="xk-kpi"><div class="lbl">' + XK.h(XK.rangeLabel(c.inputs.fy_start, asAt)) + '</div><div class="val' + (pl.np < 0 ? ' neg' : '') + '">' + money(pl.np) + '</div>' + (npDelta != null ? '<span class="chip ' + (npDelta >= 0 ? 'up' : 'down') + '">' + (npDelta >= 0 ? '▲ ' : '▼ ') + XK.pct(Math.abs(npDelta), 0) + ' vs same period last year</span>' : '') + '</div><div id="bo-np"></div>' : '<p class="xk-err">' + XK.h(c.err('pnl_ytd') || 'Profit and Loss unavailable') + '</p>') + '</div>' +
      '<div class="xk-card detail-block"><h3>Chart of accounts watchlist</h3><div id="bo-watch"></div><label class="muted">Add account <select id="bo-add"><option value="">…</option>' + plRows.filter(function (l) { return chosen.indexOf(codeOf(l)) < 0; }).map(function (l) { return '<option value="' + XK.h(codeOf(l)) + '">' + XK.h(l.label) + '</option>'; }).join('') + '</select></label></div>' +
      '</div>';
    var col = function (v) { return v; };
    XK.bars(document.getElementById('bo-ai'), { title: 'Invoices owed by due date', labels: agI.map(function (b) { return b.label; }), series: [{ name: 'Awaiting payment', values: agI.map(function (b) { return b.v; }), colors: ['var(--neg)'] }] }, c);
    XK.bars(document.getElementById('bo-ab'), { title: 'Bills to pay by due date', labels: agB.map(function (b) { return b.label; }), series: [{ name: 'Awaiting payment', values: agB.map(function (b) { return b.v; }), colors: ['var(--neg)'] }] }, c);
    XK.grid(document.getElementById('bo-pay'), { rows: pays, columns: [{ key: 'number', title: 'Invoice #' }, { key: 'contact', title: 'Contact' }, { key: 'date', title: 'Date received' }, { key: 'amount', title: 'Amount', money: true }], empty: 'No invoice payments yet.' }, c);
    if (cashOk) XK.bars(document.getElementById('bo-cash'), { title: 'Cash in and out', labels: cash.map(function (m) { return XK.monthLabel(m.key).slice(0, 3); }), series: [{ name: 'Cash in', values: cash.map(function (m) { return m.rin; }), color: 'var(--pos)' }, { name: 'Cash out', values: cash.map(function (m) { return -m.rout; }), color: 'var(--neg)' }] }, c);
    if (pl) XK.bars(document.getElementById('bo-np'), { title: 'Income vs expenses', labels: ['Income', 'Expenses'], series: [{ name: 'This year to date', values: [pl.income, pl.expenses] }].concat(plp ? [{ name: 'Same period last year', values: [plp.income, plp.expenses] }] : []) }, c);
    XK.grid(document.getElementById('bo-watch'), { rows: watch, columns: [{ key: 'code', title: 'Code' }, { key: 'name', title: 'Account' }, { key: 'month', title: 'This month', money: true }, { key: 'ytd', title: 'YTD', money: true }], empty: 'Choose accounts to watch.' }, c);
    var add = document.getElementById('bo-add'); if (add) add.addEventListener('change', function () { if (this.value) c.change({}, { o: 'w=' + chosen.concat([this.value]).join(',') }); });

    // Checks
    var sumB = function (b) { return XK.sum(b.map(function (x) { return x.v; })); };
    var bs = c.data.bs ? XK.bsParts(XK.walk(c.data.bs)) : null, bankTot = banks.length ? XK.sum(banks.map(function (b) { return b.close; })) : null;
    var checks = [
      { name: 'Invoices owed = Σ ageing buckets', pass: XK.near(sumB(agI), P.awaiting.v), detail: money(P.awaiting.v) },
      { name: 'Bills to pay = Σ ageing buckets', pass: XK.near(sumB(agB), Q.awaiting.v), detail: money(Q.awaiting.v) },
      { name: 'Each bank account: opening + cash in − cash out = balance', pass: banks.length ? banks.every(function (b) { return XK.near(b.open + b.rin - b.rout, b.close); }) : null, detail: banks.length + ' account(s)' },
      cash == null ? { name: 'Cash difference = cash in − cash out (last 6 months)', pass: null, detail: c.live ? 'Loading' : 'N/A in a snapshot' } : { name: 'Cash difference = cash in − cash out; each month closes where the next opens', pass: cashOk ? cash.every(function (m, i) { return i === 0 || XK.near(cash[i - 1].close, m.open); }) : false, detail: cashOk ? money(r2(cin - cout)) + ' over 6 months' : 'Some months failed to load' },
      { name: 'YTD net profit = income − expenses', pass: pl ? XK.near(pl.np, pl.income - pl.expenses) : null, detail: pl ? money(pl.np) + ' = ' + money(pl.income) + ' − ' + money(pl.expenses) : c.err('pnl_ytd') },
      { name: 'Bank accounts = Total Bank on the Balance Sheet today', pass: bs && bankTot != null && bs.bank != null ? XK.near(bankTot, bs.bank) : null, detail: bs && bankTot != null ? money(bankTot) + ' vs ' + money(bs.bank) : c.err('bs') || c.err('bank') },
      { name: 'YTD net profit = Current Year Earnings on the Balance Sheet', pass: bs && pl && bs.cye != null ? XK.near(pl.np, bs.cye) : null, detail: bs && pl ? money(pl.np) + ' vs ' + money(bs.cye) : c.err('bs') || c.err('pnl_ytd') },
      { name: 'Invoices owed vs Accounts Receivable (information)', pass: null, info: true, detail: bs && bs.ar != null ? money(P.awaiting.v) + ' vs ' + money(bs.ar) + (XK.near(P.awaiting.v, bs.ar) ? '' : ' — Accounts Receivable also nets unallocated credit notes, overpayments and prepayments, and excludes future-dated invoices (see Aged Receivables)') : 'N/A' },
      { name: 'All invoices and bills loaded', pass: (c.errors.invoices || c.errors.bills) ? false : (c.truncated('invoices') || c.truncated('bills')) ? false : true, detail: c.errors.invoices ? c.err('invoices') : c.errors.bills ? c.err('bills') : (c.truncated('invoices') || c.truncated('bills')) ? 'May be truncated (over 20 pages)' : c.rows('invoices').length + ' invoice(s), ' + c.rows('bills').length + ' bill(s)' }
    ];
    this._x = { banks: banks, P: P, Q: Q, cash: cash, pl: pl, plp: plp, watch: watch, pays: pays, agI: agI, agB: agB };
    return { checks: checks, notes: ['Net profit, income and expenses come from one Profit and Loss (' + XK.rangeLabel(c.inputs.fy_start, asAt) + '); the comparison is the same dates last year.', 'Cash in and out is Xero\'s Bank Summary for each month (includes transfers between your accounts).'],
      na: ['Bank statement balances and reconcile counts (bank-feed data is not in the Xero API)'], period: XK.asOfLine(asAt) };
  },
  excel: function (c) {
    var x = this._x; if (!x) return [];
    var rows = [[{ v: c.company || 'N/A — not in source', s: 'title' }], [{ v: 'Business overview', s: 'bold' }], [XK.asOfLine(c.inputs.as_at)], [], [{ v: 'Bank account', s: 'bold' }, { v: 'Balance in Xero', s: 'bold' }]]
      .concat(x.banks.map(function (b) { return [b.name, { v: b.close, s: 'money' }]; }))
      .concat([[], [{ v: '', s: 'bold' }, { v: 'Invoices owed', s: 'bold' }, { v: 'Bills to pay', s: 'bold' }], ['Awaiting payment', { v: x.P.awaiting.v, s: 'money' }, { v: x.Q.awaiting.v, s: 'money' }], ['Overdue', { v: x.P.overdue.v, s: 'money' }, { v: x.Q.overdue.v, s: 'money' }], ['Draft', { v: x.P.draft.v, s: 'money' }, { v: x.Q.draft.v, s: 'money' }], ['Awaiting approval', { v: x.P.approval.v, s: 'money' }, { v: x.Q.approval.v, s: 'money' }]]);
    if (x.pl) rows = rows.concat([[], [{ v: 'Year to date', s: 'bold' }, { v: 'This year', s: 'bold' }, { v: 'Last year', s: 'bold' }], ['Income', { v: x.pl.income, s: 'money' }, x.plp ? { v: x.plp.income, s: 'money' } : null], ['Expenses', { v: x.pl.expenses, s: 'money' }, x.plp ? { v: x.plp.expenses, s: 'money' } : null], [{ v: 'Net profit', s: 'bold' }, { v: x.pl.np, s: 'moneyBold' }, x.plp ? { v: x.plp.np, s: 'moneyBold' } : null]]);
    if (x.cash && x.cash.every(function (m) { return !m.error; })) rows = rows.concat([[], [{ v: 'Month', s: 'bold' }, { v: 'Cash in', s: 'bold' }, { v: 'Cash out', s: 'bold' }, { v: 'Difference', s: 'bold' }]]).concat(x.cash.map(function (m) { return [XK.monthLabel(m.key), { v: m.rin, s: 'money' }, { v: -m.rout, s: 'money' }, { v: Math.round((m.rin - m.rout) * 100) / 100, s: 'money' }]; }));
    rows = rows.concat([[], [{ v: 'Ageing (awaiting payment)', s: 'bold' }, { v: 'Invoices owed', s: 'bold' }, { v: 'Bills to pay', s: 'bold' }]]).concat(x.agI.map(function (b, i) { return [b.label, { v: b.v, s: 'money' }, { v: (x.agB[i] || {}).v, s: 'money' }]; }));
    rows = rows.concat([[], [{ v: 'Counts', s: 'bold' }, { v: 'Invoices', s: 'bold' }, { v: 'Bills', s: 'bold' }], ['Awaiting payment', x.P.awaiting.n, x.Q.awaiting.n], ['Overdue', x.P.overdue.n, x.Q.overdue.n], ['Draft', x.P.draft.n, x.Q.draft.n], ['Awaiting approval', x.P.approval.n, x.Q.approval.n]]);
    var pays = [[{ v: 'Invoice #', s: 'bold' }, { v: 'Contact', s: 'bold' }, { v: 'Date received', s: 'bold' }, { v: 'Amount', s: 'bold' }]].concat(x.pays.map(function (p) { return [p.number, p.contact, p.date, { v: p.amount, s: 'money' }]; }));
    var watch = [[{ v: 'Code', s: 'bold' }, { v: 'Account', s: 'bold' }, { v: 'This month', s: 'bold' }, { v: 'YTD', s: 'bold' }]].concat(x.watch.map(function (w) { return [w.code, w.name, { v: w.month, s: 'money' }, { v: w.ytd, s: 'money' }]; }));
    return [{ name: 'Business overview', rows: rows, widths: [34, 18, 18, 18] }, { name: 'Recent payments', rows: pays, widths: [14, 34, 16, 16] }, { name: 'Watchlist', rows: watch, widths: [10, 40, 16, 16] }];
  }
});</script>
</body>
</html>
```
