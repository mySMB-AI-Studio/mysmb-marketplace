// node demo.js <report> [light|dark] [xero|mysmb] -> out/<report>.<theme>[.<brand>].demo.html — report + inline mock SDK on the ledger
const fs = require('fs'), path = require('path'), build = require('./build.js');
const [name, theme = 'light', brand = 'xero'] = process.argv.slice(2);
const FX = {
  ar: 'invoices: L.listInvoices, credit_notes: L.listCreditNotes, overpayments: L.listOverpayments, prepayments: L.listPrepayments, bs: L.bs', ap: 'invoices: L.listInvoices, credit_notes: L.listCreditNotes, overpayments: L.listOverpayments, prepayments: L.listPrepayments, bs: L.bs',
  so: 'invoices: L.listInvoices, credit_notes: L.listCreditNotes, overpayments: L.listOverpayments, prepayments: L.listPrepayments, linked: L.listLinked, repeating: L.listRepeating, bs: L.bs',
  pu: 'invoices: L.listInvoices, credit_notes: L.listCreditNotes, overpayments: L.listOverpayments, prepayments: L.listPrepayments, purchase_orders: L.listPurchaseOrders, repeating: L.listRepeating, bs: L.bs',
  bo: 'bank: L.bankSummary, invoices: L.listInvoices, bills: L.listInvoices, payments: L.listPayments, pnl_ytd: L.pnl, pnl_prior: L.pnl, pnl_month: L.pnl, accounts: L.listAccounts, bs: L.bs',
  pf: 'pnl_12: L.pnl, pnl_p12: L.pnl, pnl_total: L.pnl, bs: L.bs', cp: 'bs_12: L.bs, bank: L.bankSummary, bank_total: L.bankSummary, receivables: L.listInvoices, payables: L.listInvoices',
  hs: 'pnl: L.pnl, pnl_prev: L.pnl, bs: L.bs', vz: 'pnl_12: L.pnl, bs_12: L.bs, bank: L.bankSummary, pnl_total: L.pnl', cs: 'pnl_cash: L.pnl, bank: L.bankSummary',
  cf: 'bank: L.bankSummary, bank_past: L.bankSummary, receivables: L.listInvoices, payables: L.listInvoices, bank_tx: L.listBankTransactions, payments: L.listPayments, bs: L.bs',
  gst: 'invoices: L.listInvoices, credit_notes: L.listCreditNotes, bank_tx: L.listBankTransactions, tax_rates: L.listTaxRates, accounts: L.listAccounts, bs_end: L.bs, bs_start: L.bs', rc: '',
  pnl: 'pnl: L.pnl, pnl_cash: L.pnl, pnl_compare: L.pnl, pnl_compare_cash: L.pnl, bs_end: L.bs', bs: 'bs: L.bs, bs_cash: L.bs, bs_compare: L.bs, bs_compare_cash: L.bs, pnl_ytd: L.pnl' };
const manifest = fs.readFileSync(path.join(__dirname, 'reports', name + '.manifest.json'), 'utf8'), led = fs.readFileSync(path.join(__dirname, 'ledger.js'), 'utf8');
const mock = `<script>
var module = { exports: {} };
(function(){ var RD = Date, NOW = new RD(2026, 8, 25, 10, 52).getTime(); window.Date = function (a,b,c,d,e,f,g) { var x = arguments.length ? new (Function.prototype.bind.apply(RD, [null].concat([].slice.call(arguments))))() : new RD(NOW); return x; }; Date.UTC = RD.UTC; Date.parse = RD.parse; Date.now = function () { return NOW; }; Date.prototype = RD.prototype; })();
${led}
var L = module.exports, FX = { ${FX[name]}${FX[name] ? ', ' : ''}org: L.organisation, connections: L.connections };
(function(){
  var M = ${manifest}, TODAY = '2026-09-25';
  function resolve(s){ var o = {}; M.inputs.forEach(function(i){ var v = s && s[i.name] !== undefined ? s[i.name] : i.default; if (i.type==='date' && v==='today') v = TODAY; o[i.name] = v; }); return o; }
  function params(b, inp){ var p = {}; Object.keys(b.params||{}).forEach(function(k){ var v = b.params[k]; p[k] = v.kind==='static' ? v.value : v.kind==='input' ? inp[v.input] : TODAY; }); return p; }
  function one(b, inp){ return FX[b.id](params(b, inp)); }
  window.MyHubReport = { mode:'live', theme:'${theme}', onData:function(f){ var inp = resolve({}), data = {}; M.bindings.forEach(function(b){ data[b.id] = one(b, inp); }); setTimeout(function(){ f({ data: data, errors: {}, fetchedAt: new Date().toISOString() }); }, 20); },
    onRefresh:function(){}, onThemeChange:function(){}, setInputs:function(){},
    getData:function(id, s){ var b = M.bindings.filter(function(x){ return x.id===id; })[0]; return new Promise(function(r){ setTimeout(function(){ r(one(b, resolve(s))); }, 10); }); } };
})();
</script>`;
let html = build(name).replace('<html lang="en-AU">', `<html lang="en-AU" data-myhub-theme="${theme}">`).replace('</head>', mock + '\n</head>');
if (brand !== 'xero') html = html.split('\\"style\\":\\"xero\\"').join('\\"style\\":\\"' + brand + '\\"').split('"style":"xero"').join('"style":"' + brand + '"');
fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'out', name + '.' + theme + (brand !== 'xero' ? '.' + brand : '') + '.demo.html'), html);
console.log('demo', name, theme, brand);
