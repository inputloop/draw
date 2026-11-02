// SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
// Copyright 2026 Bryant Frankford <nathanielfrankford@gmail.com> and Corwin Brust <corwin@bru.st> and Contributors
// Written by Mentat (for Corwin; claude-opus-5-5), builder B1 (browser QA), 2026-10-08;
// fixer FT 2026-10-08: dark-theme scan, menu-button keyboard checks, writes RESULT.txt itself.
// fixer FT2 2026-10-08: heading-order check; header says what the code does; finds
// playwright and Chromium beside the kit as well as at the cloud paths.
// 1.7 2026-10-27, Mentat (for Corwin; claude-sonnet-5-5): the ?load= checks (served from a
// throwaway server on 127.0.0.1, with a second server as "the other origin"), and --load-only,
// which runs only those checks, needs no axe-core, and writes RESULT-load.txt, never RESULT.txt.
//
// TopoForge browser kit: real Chromium, index.html opened from file://.
// Draws a small office network, checks tf_ref handles, the Story tab (live region,
// download .md: one facts block, sha256 header lines, Gaps section), the keyboard path,
// an axe-core scan of the main page and the Story tab, and console errors. Then (1.7) the
// ?load= checks: a CSV and a JSON drawing open from the page's own origin on a first visit;
// another origin and file:// are refused and said; a 404 is said; importCSV is exposed.
//
//   node topoforge.browser.mjs [--load-only] /path/to/index.html [outdir]
// outdir (default: out-topoforge in the current folder) gets the axe scans, the tab
// order, the downloaded files and checks.txt.
// Writes RESULT.txt (first line GREEN or RED, computed from the checks) to $RESULT,
// default: RESULT.txt beside this kit.
// --load-only runs the ?load= checks alone: no axe-core, no keyboard checks. It writes
// RESULT-load.txt (first line PARTIAL-GREEN or PARTIAL-RED) to $RESULT, default beside this
// kit. It is not RESULT.txt, and bin/ship.sh does not read it.
// Needs, all looked for from the CURRENT folder (run it where you did `npm i`):
//   playwright: $PW_MODULE, else ./node_modules/playwright, else /opt/npm-tools/node_modules/playwright
//   axe-core:   $AXE (path to axe.min.js), else ./node_modules/axe-core/axe.min.js
//   Chromium:   $CHROMIUM, else /opt/pw-browsers/chromium if it exists, else the one
//               playwright installed for itself (`npx playwright install chromium`)
// Exit 0 green, 1 red, 2 kit broken. Prints one line per check.
import { createRequire } from 'module';
import fs from 'fs'; import path from 'path'; import crypto from 'crypto'; import os from 'os'; import http from 'http';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const PW = process.env.PW_MODULE || [path.resolve('node_modules/playwright'), '/opt/npm-tools/node_modules/playwright'].find(p => fs.existsSync(p)) || 'playwright';
const AXE = process.env.AXE || path.resolve('node_modules/axe-core/axe.min.js');
const CHROMIUM = process.env.CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const args = process.argv.slice(2); const LOAD_ONLY = args.includes('--load-only');
const [file, outdirArg] = args.filter(a => !a.startsWith('--')); const outdir = outdirArg || 'out-topoforge';
if (!file || !fs.existsSync(file)) { console.error('usage: node topoforge.browser.mjs [--load-only] index.html [outdir]'); process.exit(2); }
fs.mkdirSync(outdir, { recursive: true });
let chromium; try { ({ chromium } = require(PW)); } catch (e) { console.error('KIT BROKEN: playwright not found at ' + PW); process.exit(2); }
let axeSrc; if (!LOAD_ONLY) try { axeSrc = fs.readFileSync(AXE, 'utf8'); } catch (e) { console.error('KIT BROKEN: axe-core not found at ' + AXE); process.exit(2); }
const RESULT = process.env.RESULT || path.join(path.dirname(fileURLToPath(import.meta.url)), LOAD_ONLY ? 'RESULT-load.txt' : 'RESULT.txt');
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

const results = []; let red = 0;
const check = (name, ok, detail = '') => { results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' :: ' + detail : ''}`); if (!ok) red++; };
const note = s => results.push('NOTE ' + s);

// --- 1.7: ?load=<path>. A throwaway server on 127.0.0.1 serves index.html and the fixtures; a second one, on
// another port, is "the other origin". It holds a good CSV and allows any origin (CORS *), so only the page's own
// origin test can keep it out. The fixtures arrive 100 ms late, so the sample's 0 ms timer always fires first,
// as it does on any real network. Every case opens in a fresh browser context: a first visit, nothing autosaved. ---
async function loadChecks(browser) {
  const html = fs.readFileSync(file);
  const CSV = 'name,type,ip,connects_to\r\nEdge,firewall,10.0.0.1,Core\r\nCore,switch,10.0.0.2,PC 1;PC 2\r\nPC 1,desktop,10.0.10.21,\r\nPC 2,desktop,10.0.10.22,\r\n';
  const serve = (routes, hits, cors) => new Promise(ok => {
    const s = http.createServer((q, r) => {
      const p = q.url.split('?')[0]; hits.push(p); const f = routes[p];
      if (cors) r.setHeader('access-control-allow-origin', '*');
      if (!f) { r.statusCode = 404; r.end('not found'); return; }
      r.setHeader('content-type', f.type); setTimeout(() => r.end(f.body), f.delay || 0);
    });
    s.listen(0, '127.0.0.1', () => ok(s));
  });
  const hitsA = [], hitsB = [];
  const routesA = { '/': { type: 'text/html', body: html }, '/index.html': { type: 'text/html', body: html }, '/x.csv': { type: 'text/csv', body: CSV, delay: 100 } };
  const sA = await serve(routesA, hitsA, false), sB = await serve({ '/x.csv': { type: 'text/csv', body: CSV } }, hitsB, true);
  const A = 'http://127.0.0.1:' + sA.address().port, B = 'http://127.0.0.1:' + sB.address().port;
  const open = async (url, wantToast = true) => {
    const c = await browser.newContext({ viewport: { width: 1400, height: 900 } }); const pg = await c.newPage();
    await pg.goto(url); await pg.waitForFunction(() => window.TopoForge && document.querySelector('.pal-item'));
    if (wantToast) await pg.waitForFunction(() => document.querySelector('#toasts .toast'), null, { timeout: 5000 }).catch(() => {});
    await pg.waitForTimeout(700); // the fetch, the import and the sample's timer have all had their turn
    const s = await pg.evaluate(() => ({ names: P().nodes.map(n => (n.text || '').split('\n')[0]), links: P().links.length, doc: DOC.name, toasts: [...document.querySelectorAll('#toasts .toast')].map(t => t.textContent), imp: typeof window.TopoForge.importCSV }));
    await c.close(); return s;
  };
  const gotCsv = s => s.names.includes('Edge') || s.names.includes('Core'); // names only the CSV has (the sample has 'Edge Firewall', 'Core Switch')
  const shown = s => `nodes=${s.names.length} links=${s.links} toasts=${s.toasts.join(' / ')}`;
  try {
    // a small TopoForge JSON drawing, made by the app itself, for the JSON branch
    const jc = await browser.newContext(); const jp = await jc.newPage();
    await jp.goto(A + '/index.html'); await jp.waitForFunction(() => window.TopoForge && document.querySelector('.pal-item'));
    const json = await jp.evaluate(() => {
      DOC = newDoc(); DOC.name = 'Loaded by query'; S.sel.clear(); reindex(); buildPages();
      edit(() => { const a = makeNode('router', 0, 0, { text: 'Query Router' }), b = makeNode('switch', 240, 0, { text: 'Query Switch' }); P().nodes.push(a, b); P().links.push(makeLink({ id: a.id, port: null }, { id: b.id, port: null })); });
      return snapshot();
    });
    await jc.close();
    routesA['/x.json'] = { type: 'application/json', body: json, delay: 100 };

    const base = await open(A + '/index.html', false);
    check('load 1c: without ?load= a first visit still shows the sample (the sample guard acts only on ?load=)', base.names.includes('Edge Firewall') && base.names.length > 10, 'nodes=' + base.names.length);
    const r1 = await open(A + '/index.html?load=/x.csv');
    check('load 1: ?load=/x.csv from the page\'s own origin imports the rows, and only the rows, on a first visit',
      r1.names.length === 4 && ['Edge', 'Core', 'PC 1', 'PC 2'].every(n => r1.names.includes(n)) && r1.links === 3 && r1.toasts.some(t => /Imported 4 devices, 3 links/.test(t)), shown(r1));
    const r1b = await open(A + '/index.html?load=/x.json');
    check('load 1b: ?load=/x.json opens the TopoForge JSON drawing in place of the sample', r1b.doc === 'Loaded by query' && r1b.names.join('|') === 'Query Router|Query Switch' && r1b.links === 1 && r1b.toasts.some(t => /Loaded \/x\.json/.test(t)), shown(r1b) + ' doc=' + r1b.doc);
    const r2 = await open(A + '/index.html?load=' + encodeURIComponent(B + '/x.csv'));
    check('load 2: ?load= another origin is refused: nothing imported, the toast names the refusal, the other server is never asked',
      !gotCsv(r2) && r2.toasts.some(t => /load refused/.test(t) && t.includes(B)) && hitsB.length === 0, shown(r2) + ' otherServerHits=' + hitsB.length);
    const dir = path.join(outdir, 'file-origin'); fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html); fs.writeFileSync(path.join(dir, 'x.csv'), CSV); // a double-clicked copy with its CSV beside it
    const r3 = await open('file://' + path.resolve(dir, 'index.html') + '?load=x.csv');
    check('load 3: file://...index.html?load=x.csv imports nothing and says it is refused', !gotCsv(r3) && r3.toasts.some(t => /load refused/.test(t)), shown(r3));
    const r4 = await open(A + '/index.html?load=/missing.csv');
    check('load 4: ?load= a path that is not there says "load failed: 404" and imports nothing', !gotCsv(r4) && r4.toasts.some(t => /load failed: 404/.test(t)), shown(r4));
    check('load 5: window.TopoForge.importCSV is a function', base.imp === 'function', base.imp);
  } finally { for (const s of [sA, sB]) { s.close(); if (s.closeAllConnections) s.closeAllConnections(); } }
}

const browser = await chromium.launch({ executablePath: CHROMIUM, headless: true });
if (LOAD_ONLY) { // the ?load= checks alone: no axe-core, no keyboard checks; written to RESULT-load.txt, which is not RESULT.txt
  note('browser ' + browser.version() + ', playwright ' + require(PW + '/package.json').version + ' (--load-only: no axe-core scan, no keyboard checks)');
  await loadChecks(browser); await browser.close();
  fs.writeFileSync(path.join(outdir, 'checks-load.txt'), results.join('\n') + '\n');
  console.log(results.join('\n'));
  console.log(red ? `TOPOFORGE LOAD CHECKS RED (${red} failed)` : 'TOPOFORGE LOAD CHECKS GREEN');
  const passed = results.filter(r => r.startsWith('PASS')).length;
  fs.writeFileSync(RESULT, [red ? 'PARTIAL-RED' : 'PARTIAL-GREEN',
    'TopoForge ?load= checks only -- written by tests/browser/topoforge.browser.mjs --load-only (do not edit by hand)',
    'This is not RESULT.txt: no axe-core scan and no keyboard checks were run, and bin/ship.sh reads RESULT.txt only.',
    'Licence of this note: CC-BY-SA-4.0',
    'Run at: ' + new Date().toISOString() + ' on ' + os.type() + ' ' + os.release() + ', node ' + process.version,
    'File tested: ' + path.basename(file) + ' sha256 ' + sha(file),
    'Kit: tests/browser/topoforge.browser.mjs sha256 ' + sha(fileURLToPath(import.meta.url)),
    `Result: ${passed} checks passed, ${red} failed. Exit ${red ? 1 : 0} (0 green, 1 red, 2 kit broken).`,
    '', 'CHECKS', ...results, ''].join('\n'));
  console.log('wrote ' + RESULT);
  process.exit(red ? 1 : 0);
}
const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));
note('browser ' + browser.version() + ', playwright ' + require(PW + '/package.json').version + ', axe-core ' + JSON.parse(fs.readFileSync(path.join(path.dirname(AXE), 'package.json'), 'utf8')).version);

await page.goto('file://' + path.resolve(file));
await page.waitForFunction(() => window.TopoForge && document.querySelector('.pal-item'));
check('loads from file:// and exposes TopoForge', true, await page.evaluate(() => 'TF_VERSION=' + TF_VERSION));

// --- axe on the main page (as booted) ---
await page.addScriptTag({ content: axeSrc });
const AXE_IDS = [];
async function axeScan(label, context) {
  const r = await page.evaluate(async c => {
    const res = await axe.run(c ? document.querySelector(c) : document, { resultTypes: ['violations'] });
    return res.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, n: v.nodes.length, targets: v.nodes.slice(0, 6).map(x => x.target.join(' ')) }));
  }, context || null);
  fs.writeFileSync(path.join(outdir, `axe-${label}.json`), JSON.stringify(r, null, 1));
  AXE_IDS.push(...r.map(v => `${label}:${v.id}`));
  const bad = r.filter(v => v.impact === 'critical' || v.impact === 'serious');
  check(`axe ${label}: no critical/serious violations`, bad.length === 0,
    r.length ? r.map(v => `${v.impact} ${v.id} x${v.n} [${v.targets.join(' | ')}]`).join(' ;; ') : 'no violations');
  return r;
}
await axeScan('main');

// --- draw the office network: palette clicks (the UI) for the shapes, app's edit() for names/groups/links ---
await page.evaluate(() => { DOC = newDoc(); S.sel.clear(); reindex(); buildPages(); afterChange(); });
const keys = ['router', 'firewall', 'dmz', 'server', 'server', 'vlan', 'switch', 'desktop', 'desktop'];
for (const k of keys) await page.click(`.pal-item[data-key="${k}"]`);
const n0 = await page.evaluate(() => P().nodes.length);
check('palette clicks added 9 shapes', n0 === 9, 'nodes=' + n0);
await page.evaluate(() => edit(() => {
  const ns = P().nodes; const by = t => ns.filter(n => n.type === t);
  const [gw] = by('router'), [fw] = by('firewall'), [dmz] = by('dmz'), [s1, s2] = by('server'), [lan] = by('vlan'), [sw] = by('switch'), [pc1, pc2] = by('desktop');
  const place = (n, x, y, t, props = {}) => { n.x = x; n.y = y; n.text = t; Object.assign(n.props, props); };
  place(gw, 400, 0, 'Gateway', { hostname: 'gw01', ip: '203.0.113.1' });
  place(fw, 400, 140, 'Firewall', { hostname: 'fw01', ip: '10.0.0.1' });
  place(dmz, 60, 260, 'DMZ'); dmz.w = 340; dmz.h = 220; dmz.props.subnet = '172.16.0.0/24';
  place(s1, 100, 330, 'Web Server', { hostname: 'web01', ip: '172.16.0.10' }); s1.parent = dmz.id;
  place(s2, 240, 330, 'Mail Server', { hostname: 'mail01', ip: '172.16.0.20' }); s2.parent = dmz.id;
  place(lan, 480, 260, 'LAN'); lan.w = 380; lan.h = 260; lan.props.subnet = '10.0.10.0/24';
  place(sw, 600, 320, 'LAN Switch', { hostname: 'sw01' }); sw.parent = lan.id;
  place(pc1, 520, 420, 'PC 1', { ip: '10.0.10.21' }); pc1.parent = lan.id;
  place(pc2, 700, 420, 'PC 2', { ip: '10.0.10.22' }); pc2.parent = lan.id;
  const L = (a, b, t) => { const l = makeLink({ id: a.id, port: null }, { id: b.id, port: null }); l.text = t || ''; P().links.push(l); };
  L(gw, fw, 'uplink'); L(fw, s1); L(fw, s2); L(fw, sw); L(sw, pc1); L(sw, pc2);
}));
await page.waitForTimeout(800);
const refs = await page.evaluate(() => [...P().nodes, ...P().links].map(x => ({ t: x.type || 'link', ref: x.data.tf_ref || '' })));
const goodRef = /^[a-z0-9][a-z0-9._-]*$/;
check('every shape and link has data.tf_ref', refs.length === 15 && refs.every(r => goodRef.test(r.ref)), refs.map(r => r.ref).join(','));
check('tf_refs unique', new Set(refs.map(r => r.ref)).size === refs.length);
// axe on the Properties panel with one shape selected (the inspector form)
await page.evaluate(() => setSel([P().nodes.find(n => n.type === 'firewall').id])); await page.waitForTimeout(300);
await axeScan('props-selected', '#tab-props');
await page.evaluate(() => setSel([]));

// --- menu buttons: plain buttons that open a menu (no menubar role), keyboard opens and Escape returns ---
const mb = await page.evaluate(() => ({ role: document.querySelector('#menubar').getAttribute('role'), pop: [...document.querySelectorAll('.menu-btn')].every(b => b.getAttribute('aria-haspopup') === 'menu' && b.getAttribute('aria-expanded') === 'false') }));
check('menu bar has no menubar role; each menu button says it opens a menu', mb.role === null && mb.pop, JSON.stringify(mb));
await page.focus('.menu-btn[data-menu="file"]'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
const mo = await page.evaluate(() => ({ exp: document.querySelector('.menu-btn[data-menu="file"]').getAttribute('aria-expanded'), inMenu: !!document.activeElement.closest('.menu') }));
await page.keyboard.press('Escape'); await page.waitForTimeout(100);
const mc = await page.evaluate(() => ({ exp: document.querySelector('.menu-btn[data-menu="file"]').getAttribute('aria-expanded'), back: document.activeElement.dataset.menu || document.activeElement.tagName }));
check('Enter opens the File menu with focus inside; Escape closes it and returns focus to File', mo.exp === 'true' && mo.inMenu && mc.exp === 'false' && mc.back === 'file', JSON.stringify({ mo, mc }));
// --- dark theme: the same scans (contrast differs per theme) ---
await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'dark'); });
await page.waitForTimeout(200);
await axeScan('main-dark');
await page.evaluate(() => setSel([P().nodes.find(n => n.type === 'firewall').id])); await page.waitForTimeout(300);
await axeScan('props-selected-dark', '#tab-props');
await page.evaluate(() => { setSel([]); document.documentElement.setAttribute('data-theme', 'light'); });
await page.waitForTimeout(200);

// --- keyboard path to the Story tab ---
await page.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
await page.keyboard.press('Escape');
let tabStops = [], reached = null;
for (let i = 0; i < 400; i++) {
  await page.keyboard.press('Tab');
  const a = await page.evaluate(() => { const e = document.activeElement; return e ? { id: e.id, tag: e.tagName, role: e.getAttribute('role'), txt: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 30) } : null; });
  tabStops.push(a);
  if (a && a.role === 'tab') { reached = i + 1; break; }
}
check('Tab reaches the inspector tab row', !!reached, reached ? `after ${reached} Tab presses (at ${tabStops[tabStops.length - 1].id})` : 'never reached; stops: ' + tabStops.slice(-8).map(s => s && (s.id || s.tag)).join(','));
fs.writeFileSync(path.join(outdir, 'tab-order.json'), JSON.stringify(tabStops, null, 1));
const focusVisible = async () => page.evaluate(() => {
  const e = document.activeElement; if (!e || e === document.body) return 'no focus';
  const cs = getComputedStyle(e); const fv = e.matches(':focus-visible');
  const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none');
  return fv && ring ? 'ok' : `focus-visible=${fv} outline=${cs.outlineStyle} ${cs.outlineWidth} shadow=${cs.boxShadow}`;
});
let fvr = await focusVisible(); check('focus visible on tab', fvr === 'ok', fvr);
// move to Story with arrows (roving tabindex) then activate with Enter
let guard = 0;
while (guard++ < 6 && (await page.evaluate(() => document.activeElement.id)) !== 'tabbtn-story') await page.keyboard.press('ArrowRight');
check('Right arrow reaches Story tab', (await page.evaluate(() => document.activeElement.id)) === 'tabbtn-story');
await page.keyboard.press('Enter');
await page.waitForTimeout(700);
let st = await page.evaluate(() => ({ sel: document.querySelector('#tabbtn-story').getAttribute('aria-selected'), hidden: document.querySelector('#tab-story').hidden }));
check('Enter on Story tab shows Story panel', st.sel === 'true' && !st.hidden, JSON.stringify(st));
fvr = await focusVisible(); check('focus visible on Story tab', fvr === 'ok', fvr);
// Space activation: go to Properties with Home, Space, then back to Story with End + Space
await page.keyboard.press('Home'); await page.keyboard.press(' '); await page.waitForTimeout(200);
const propsSel = await page.evaluate(() => document.querySelector('#tabbtn-props').getAttribute('aria-selected'));
await page.keyboard.press('End'); await page.keyboard.press(' '); await page.waitForTimeout(700);
st = await page.evaluate(() => ({ sel: document.querySelector('#tabbtn-story').getAttribute('aria-selected'), hidden: document.querySelector('#tab-story').hidden, panning: !!(S && S.space) }));
check('Space on tabs activates (Home->Properties, End->Story) and does not start panning', propsSel === 'true' && st.sel === 'true' && !st.hidden && !st.panning, `props=${propsSel} story=${JSON.stringify(st)}`);

// --- Story content and live region ---
const story = await page.evaluate(() => ({
  live: (() => { const l = document.querySelector('#storyLive'); return l && { role: l.getAttribute('role'), live: l.getAttribute('aria-live') }; })(),
  about: (document.querySelector('#storyAbout') || {}).textContent || '',
  text: (document.querySelector('#storyBody') || {}).textContent || '',
  refBtns: document.querySelectorAll('#storyBody button.ref').length,
}));
check('Story aria-live region exists (role=status, polite)', story.live && story.live.role === 'status' && story.live.live === 'polite', JSON.stringify(story.live));
check('Story says it is a text alternative', /text alternative/.test(story.about));
check('Story names the drawn shapes', ['Gateway', 'Firewall', 'DMZ', 'Web Server', 'Mail Server', 'LAN', 'LAN Switch', 'PC 1', 'PC 2'].every(w => story.text.includes(w)), 'refBtns=' + story.refBtns);
await page.evaluate(() => edit(() => { P().nodes.find(n => n.text === 'PC 2').text = 'Reception PC'; }));
await page.waitForTimeout(1000);
const after = await page.evaluate(() => ({ live: document.querySelector('#storyLive').textContent, body: document.querySelector('#storyBody').textContent, ch: document.querySelector('#storyChanges').textContent }));
check('Story updates after an edit and announces it', after.body.includes('Reception PC') && /Reception PC/.test(after.live), 'live="' + after.live + '"');

// --- axe on the Story tab ---
await axeScan('story-page');
await axeScan('story-panel', '#tab-story');
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark')); await page.waitForTimeout(200);
await axeScan('story-panel-dark', '#tab-story');
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light')); await page.waitForTimeout(200);
await page.focus('#tabbtn-story');

// --- keyboard to the Download button; Enter downloads ---
let dlReached = false;
for (let i = 0; i < 40; i++) { await page.keyboard.press('Tab'); if (await page.evaluate(() => document.activeElement.hasAttribute('data-story-dl'))) { dlReached = true; break; } }
check('Tab reaches Download story button', dlReached);
fvr = await focusVisible(); check('focus visible on Download button', fvr === 'ok', fvr);
async function grabDownloads(trigger) {
  const got = []; const h = d => got.push(d); page.on('download', h);
  await trigger(); const t0 = Date.now(); while (got.length < 2 && Date.now() - t0 < 5000) await page.waitForTimeout(100);
  page.off('download', h); const out = [];
  for (const d of got) { const p = path.join(outdir, d.suggestedFilename()); await d.saveAs(p); out.push(p); }
  return out;
}
let files = await grabDownloads(() => page.keyboard.press('Enter'));
check('Enter on Download saves .json and -story.md', files.some(f => f.endsWith('-story.md')) && files.some(f => f.endsWith('.json')), files.map(f => path.basename(f)).join(','));
const files2 = await grabDownloads(() => page.keyboard.press(' '));
check('Space on Download also saves', files2.some(f => f.endsWith('-story.md')), files2.map(f => path.basename(f)).join(','));
const md = files.find(f => f.endsWith('-story.md')); const js = files.find(f => f.endsWith('.json'));
if (md) {
  const t = fs.readFileSync(md, 'utf8');
  const fences = (t.match(/^```facts-[a-z0-9]+\s*$/gm) || []).length;
  check('story .md has exactly one facts block', fences === 1, 'facts fences=' + fences);
  const shaLines = t.split('\n').slice(0, 8).filter(l => /sha256/i.test(l));
  check('story .md header carries sha256 lines', shaLines.length >= 1 && (t.match(/[0-9a-f]{64}/g) || []).length >= 2, shaLines.join(' / ').slice(0, 200));
  check('story .md has a Gaps section', /^## Gaps/m.test(t));
  if (js) {
    const crypto = await import('crypto');
    const h = crypto.createHash('sha256').update(fs.readFileSync(js)).digest('hex');
    check('story header names the saved JSON by its sha256', t.includes(h), h.slice(0, 16));
  }
}

// --- keyboard trap probe: 300 Tabs from the Story panel must leave it and cycle ---
const seen = new Set(); let stuck = 0, last = '';
for (let i = 0; i < 300; i++) {
  await page.keyboard.press('Tab');
  const id = await page.evaluate(() => { const e = document.activeElement; return e ? (e.id || e.tagName + ':' + (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 20)) : 'none'; });
  stuck = id === last ? stuck + 1 : 0; last = id; seen.add(id);
}
check('no keyboard trap (focus keeps moving under Tab)', stuck < 3, `distinct stops=${seen.size}`);

check('headings do not skip a level (no axe heading-order in any scan)', !AXE_IDS.some(x => x.endsWith(':heading-order')),
  AXE_IDS.filter(x => x.endsWith(':heading-order')).join(', ') || 'none');
check('no console errors', consoleErrors.length === 0, consoleErrors.join(' | ').slice(0, 600));
await loadChecks(browser); // 1.7: in their own contexts, so a 404 or a refusal does not touch the console check above
await browser.close();
fs.writeFileSync(path.join(outdir, 'checks.txt'), results.join('\n') + '\n');
console.log(results.join('\n'));
console.log(red ? `TOPOFORGE BROWSER RED (${red} failed)` : 'TOPOFORGE BROWSER GREEN');
// RESULT.txt: the first line is computed from the checks above, never written by hand.
const passed = results.filter(r => r.startsWith('PASS')).length;
const up = path.join(path.dirname(path.resolve(file)), 'upstream', 'topoforge-1.5.html');
const lines = [red ? 'RED' : 'GREEN',
  'TopoForge in a real browser from file:// -- written by tests/browser/topoforge.browser.mjs (do not edit by hand)',
  'Licence of this note: CC-BY-SA-4.0',
  'Run at: ' + new Date().toISOString() + ' on ' + os.type() + ' ' + os.release() + ', node ' + process.version,
  'File tested: ' + path.basename(file) + ' sha256 ' + sha(file),
  fs.existsSync(up) ? 'Upstream beside it: upstream/topoforge-1.5.html sha256 ' + sha(up) : 'Upstream beside it: not present',
  'Kit: tests/browser/topoforge.browser.mjs sha256 ' + sha(fileURLToPath(import.meta.url)),
  `Result: ${passed} checks passed, ${red} failed. Exit ${red ? 1 : 0} (0 green, 1 red, 2 kit broken).`,
  'A check fails on any critical or serious axe finding; moderate and minor findings are listed but do not fail.',
  '', 'CHECKS', ...results, '',
  'NOT TESTED HERE', '- A real screen reader (NVDA, Narrator, Orca); Windows browsers; Visio round trip.', ''];
fs.writeFileSync(RESULT, lines.join('\n'));
console.log('wrote ' + RESULT);
process.exit(red ? 1 : 0);
