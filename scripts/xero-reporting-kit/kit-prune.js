// The kit as it goes into one report: only the XK members that report's config calls (plus whatever they use inside the
// kit), minified for whitespace and syntax with names kept, and broken into lines of at most ~300 characters.
//
// Why per report: the agent writes the whole document in a single artifact_save call, so every byte of kit is output it
// has to generate. The full kit on one line (65,000 characters) made the agent's turn run out without a reply. Lines
// stay short because a long skill result can reach the model as a file, and reading it back cuts lines over 2,000 characters.
const fs = require('fs'), path = require('path'), esbuild = require('esbuild');

const SRC = fs.readFileSync(path.join(__dirname, 'xk-kit.js'), 'utf8').replace(/\r\n/g, '\n').replace(/\nif \(typeof module[^\n]*\n?$/, '\n');
const START = SRC.indexOf("'use strict';"), RET = SRC.lastIndexOf('\n  return {');
if (START < 0 || RET < 0) throw new Error('xk-kit.js: expected "var XK = (function () { \'use strict\'; … return {…}; })();"');
const BODY = SRC.slice(START + "'use strict';".length, RET);

// The kit's public members, from its closing `return { name: expr, … }`.
const MEMBERS = (() => {
  const obj = SRC.slice(RET).replace(/\n\}\)\(\);\s*$/, '').replace(/^\s*return\s*/, '').replace(/;\s*$/, '').trim().slice(1, -1);
  const out = new Map(); let depth = 0, cur = '', q = null;
  for (let i = 0; i < obj.length; i++) {
    const ch = obj[i];
    if (q) { if (ch === '\\') { cur += ch + obj[++i]; continue; } if (ch === q) q = null; cur += ch; continue; }
    if (ch === "'" || ch === '"') q = ch;
    else if ('({['.includes(ch)) depth++;
    else if (')}]'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { add(cur); cur = ''; } else cur += ch;
  }
  add(cur);
  function add(p) { p = p.trim(); if (p) out.set(p.slice(0, p.indexOf(':')).trim(), p); }
  return out;
})();

const ALWAYS = ['app']; // the config calls XK.app(cfg); everything else is found in the config text
function membersFor(cfgText) {
  const used = new Set(ALWAYS);
  for (const m of cfgText.matchAll(/\bXK\.([A-Za-z_$][\w$]*)/g)) used.add(m[1]);
  const unknown = [...used].filter((u) => !MEMBERS.has(u));
  if (unknown.length) throw new Error('config calls XK.' + unknown.join(', XK.') + ', which the kit does not export');
  return [...used].sort();
}

function reportKit(cfgText) {
  const used = membersFor(cfgText);
  const mod = "'use strict';" + BODY + '\nwindow.XK = {' + used.map((u) => MEMBERS.get(u)).join(',\n') + '};\n';
  const code = esbuild.transformSync(mod, { minifyWhitespace: true, minifySyntax: true, treeShaking: true, format: 'iife', lineLimit: 300, legalComments: 'none', target: 'es2017' }).code.trim();
  new Function(code); // parses
  return code;
}

module.exports = { reportKit, membersFor, MEMBERS };
