// ap.cfg.js = ar.cfg.js with the A/P platform block (keeps the two ageing families identical in behaviour)
const fs = require('fs'), p = __dirname + '/reports/';
const ar = fs.readFileSync(p + 'ar.cfg.js', 'utf8');
const AP = "var P = { kind: 'AP', title: 'A/P Ageing Summary', family: 'Accounts payable', token: 'AP_AGING', party: 'Supplier', ageing: 'aged_payables', detail: 'aged_payable_detail', docs: 'open_bills', entity: 'Bill', ref: 'VendorRef', bsGroup: 'AP', bsRe: /^total accounts payable/i, who: 'Who you owe', verb: 'you owe',\n  views: [['summary', 'A/P ageing summary'], ['detail', 'A/P ageing detail'], ['open', 'Unpaid bills'], ['balance', 'Supplier balance summary']] };";
const out = ar.replace(/^var P = \{[\s\S]*?\};\r?\n/, AP + '\n');
if (out === ar) throw new Error('P block not found');
fs.writeFileSync(p + 'ap.cfg.js', out); console.log('ap.cfg.js generated');
