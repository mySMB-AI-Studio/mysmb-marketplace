// node test.js — runs every catalogue/*.test.js and reports/*.test.js, fails if any does.
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
let failed = 0, ran = 0;
for (const p of ['catalogue', 'reports']) {
  const dir = path.join(__dirname, p);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.test.js')).sort()) {
    ran++; console.log('\n▶ ' + p + '/' + f);
    try { execFileSync(process.execPath, [path.join(dir, f)], { stdio: 'inherit' }); } catch { failed++; }
  }
}
console.log('\n' + (failed ? failed + ' of ' + ran + ' test files FAILED' : 'ALL ' + ran + ' test files passed'));
process.exit(failed ? 1 : 0);
