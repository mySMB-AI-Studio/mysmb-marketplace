// Every MYOB Client Report Analytics report when the opening bundle never arrives (QA, 19 Oct 2026: a large MYOB file passed the
// platform's 30-second gateway limit and the viewer showed only a toast): the MYOB kit loads each source on its own — every binding
// once, the same page as a normal open, a note under Sources & limitations — and a normal open never falls back.
const { suite } = require('../harness.js');
const { run, man, text, wait, FX, withDefaults } = require('./lib.js');
const fs = require('fs');
const { ok, done } = suite('myob/fallback');
const NOTE = /Loaded section by section \(the full load timed out\)/;
// the page without fetch times (a fallback's sources are fetched later than the test bundle's fixed time)
const page = (t) => ['header', '#mk-body', '#mk-banner ul'].map((q) => text(t.doc, q)).join(' | ').replace(/\d{1,2}:\d\d[ap]m \d{1,2} \w+ \d{4}/g, '<time>');
(async () => {
  const ids = fs.readdirSync(__dirname).filter((f) => f.endsWith('.cfg.js')).map((f) => f.replace('.cfg.js', '')).filter((id) => !process.argv[2] || id === process.argv[2]);
  for (const id of ids) {
    // the kit's own starting values: the connection's default company file (the manifest's default is the same, '')
    const m = withDefaults(man(id), {}), fx = FX(m), keys = m.bindings.map((b) => b.id);
    const a = await run('myob/' + id, m, fx, { bundleInputs: true, fallbackMs: 20 }), n0 = a.calls.length; await wait(250);
    const b = await run('myob/' + id, m, fx, { noBundle: true, fallbackMs: 20 }); await wait(400);
    const asked = b.calls.filter((x) => x.requery);
    // (a report may ask for more after opening — Tax by Type's months 2 and 3 — so: every binding, and no more calls than a normal open)
    ok(id + ': no bundle → every binding is requested on its own, with no more calls than a normal open', keys.every((k) => asked.some((x) => x.id === k)) && asked.length <= n0 && !b.calls.some((x) => x.error),
      { missing: keys.filter((k) => !asked.some((x) => x.id === k)), asked: asked.length, normal: n0, errors: b.calls.filter((x) => x.error).slice(0, 2) });
    ok(id + ': … the same page as a normal open (header, body, checks), with no script errors', page(b) === page(a) && b.errs.length === 0, { errs: b.errs.slice(0, 2), a: page(a).slice(0, 300), b: page(b).slice(0, 300) });
    ok(id + ': … says so under Sources & limitations; a normal open does not, and never falls back', NOTE.test(text(b.doc, '#mk-sources')) && !NOTE.test(text(a.doc, '#mk-sources')) && a.calls.length === n0,
      { note: NOTE.test(text(b.doc, '#mk-sources')), extra: a.calls.length - n0 });
  }
  done();
})();
