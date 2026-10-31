'use strict';
// Exploratory QA sweep: an AI agent with a browser (Antigravity's browser subagent, via the `agy` CLI) plays the game
// like a person, one brief at a time, writing one report line per item as it goes. NOT deterministic - for finding new
// bugs before a release. The repeatable regression check is `npm run test:browser`.
//
//   npm run qa:sweep                           # all briefs against ./index.html
//   npm run qa:sweep -- --build old.html       # another build
//   npm run qa:sweep -- --only 03,04           # selected briefs
//   QA_MODEL=gemini-4-argon-high npm run qa:sweep
//
// Runs ONE browser at a time on purpose (a 16 GB PC blue-screened under parallel browser load). ~25-30 min per brief.
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : null; };
const build = path.resolve(opt('build') || path.join(ROOT, 'index.html'));
const only = (opt('only') || '').split(',').filter(Boolean);
const model = process.env.QA_MODEL || 'gemini-3.8-flash-high';
const timeout = process.env.QA_TIMEOUT || '30m';
const briefDir = path.join(ROOT, 'docs', 'qa', 'briefs');
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outDir = path.join(ROOT, 'qa-reports', stamp);

const html = fs.readFileSync(build);
const srv = http.createServer((req, res) => {
  const p = req.url.split('?')[0];
  if (p === '/' || p === '/index.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(html); }
  res.writeHead(404); res.end();
});

srv.listen(0, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${srv.address().port}/`;
  fs.mkdirSync(outDir, { recursive: true });
  const briefs = fs.readdirSync(briefDir).filter((f) => f.endsWith('.md')).sort()
    .filter((f) => !only.length || only.includes(f.slice(0, 2)));
  console.log(`QA sweep: ${briefs.length} brief(s), build ${path.relative(ROOT, build) || build}, served at ${url}, model ${model}`);
  console.log(`Reports: ${path.relative(ROOT, outDir)}`);
  const rows = [];
  for (const f of briefs) {
    const report = path.join(outDir, f.replace(/\.md$/, '.report.md')).split(path.sep).join('/');
    const prompt = fs.readFileSync(path.join(briefDir, f), 'utf8').replace(/\{\{URL\}\}/g, url).replace(/\{\{REPORT\}\}/g, report);
    const t0 = Date.now();
    console.log(`\n> ${f} (started ${new Date().toISOString().slice(11, 16)} UTC)`);
    // agy is a real executable: no shell, so the multi-line brief reaches it intact. agy prints only its final answer, which is why the
    // brief makes the agent append to {{REPORT}} item by item.
    const r = spawnSync('agy', ['--add-dir', ROOT, '--add-dir', outDir, '--model', model, '--dangerously-skip-permissions',
      '--print-timeout', timeout, '-p', prompt], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', shell: false });
    const text = fs.existsSync(report) ? fs.readFileSync(report, 'utf8') : '';
    const count = (k) => (text.match(new RegExp('\\| ' + k + '\\b', 'g')) || []).length;
    const row = { brief: f, minutes: ((Date.now() - t0) / 60000).toFixed(1), works: count('WORKS'), broken: count('BROKEN'), untested: count('UNTESTED'), exit: r.status };
    if (!text) row.note = 'no report written' + (r.stderr ? ': ' + r.stderr.trim().split('\n').pop() : '');
    rows.push(row);
    console.log(`  ${row.works} WORKS, ${row.broken} BROKEN, ${row.untested} UNTESTED in ${row.minutes} min${row.note ? ' - ' + row.note : ''}`);
    for (const line of text.split('\n')) if (/\| (BROKEN|UNTESTED)\b|^CONSOLE ERROR/.test(line)) console.log('    ' + line.slice(0, 220));
  }
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify({ build: path.relative(ROOT, build), url, model, rows }, null, 2));
  srv.close();
  const broken = rows.reduce((a, r) => a + r.broken, 0);
  console.log(`\nDone: ${rows.reduce((a, r) => a + r.works, 0)} WORKS, ${broken} BROKEN, ${rows.reduce((a, r) => a + r.untested, 0)} UNTESTED. Summary: ${path.relative(ROOT, path.join(outDir, 'summary.json'))}`);
  process.exit(broken ? 1 : 0);
});
