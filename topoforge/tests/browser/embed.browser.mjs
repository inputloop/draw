// SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
// Copyright 2026 Bryant Frankford <nathanielfrankford@gmail.com> and Corwin Brust <corwin@bru.st> and Contributors
// Written by Mentat (for Corwin, claude-opus-5-5), 2026-11-01, for topology forge (formerly TopoForge) 1.8.
//
// embed.browser.mjs -- the 1.8 embedding switches in real Chromium, held to spec/EMBED-v1.md.
//   S  standalone is unchanged: 1.8 opened with no switch draws the same pixels as 1.7 (rebuilt here from
//      Bryant's 1.5 and patches/, so the kit needs no copy of 1.7), at three widths, light and dark, with the
//      same tab order, and writes nothing new to storage.
//   F  frameless; P props floats right; H shapes floats left; M pages fold into the overview box;
//   K  keyboard and one-pointer moves, hide and show, kept across a reload, storage refused;
//   E  the selection hook and the ready event reach a parent page of the same origin, and never one of
//      another origin; A  the About box; X  axe-core, light and dark, every switch on; C  console errors.
//
//   node embed.browser.mjs /path/to/index.html [outdir]      exit 0 green, 1 red, 2 kit broken
// Writes RESULT-embed.txt (first line GREEN or RED, computed) to $RESULT, default beside this kit.
// Needs what topoforge.browser.mjs needs (playwright, axe-core, Chromium; looked for the same way) and patch(1).
import { createRequire } from 'module';
import fs from 'fs'; import path from 'path'; import crypto from 'crypto'; import os from 'os'; import http from 'http';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url)), KIT = path.resolve(HERE, '..', '..');
const PW = process.env.PW_MODULE || [path.resolve('node_modules/playwright'), '/opt/npm-tools/node_modules/playwright'].find(p => fs.existsSync(p)) || 'playwright';
const AXE = process.env.AXE || path.resolve('node_modules/axe-core/axe.min.js');
const CHROMIUM = process.env.CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const [file, outdirArg] = process.argv.slice(2); const outdir = path.resolve(outdirArg || 'out-embed');
if (!file || !fs.existsSync(file)) { console.error('usage: node embed.browser.mjs index.html [outdir]'); process.exit(2); }
fs.mkdirSync(outdir, { recursive: true });
let chromium; try { ({ chromium } = require(PW)); } catch (e) { console.error('KIT BROKEN: playwright not found at ' + PW); process.exit(2); }
let axeSrc; try { axeSrc = fs.readFileSync(AXE, 'utf8'); } catch (e) { console.error('KIT BROKEN: axe-core not found at ' + AXE); process.exit(2); }
const RESULT = process.env.RESULT || path.join(HERE, 'RESULT-embed.txt');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const results = []; let red = 0;
const check = (name, ok, detail = '') => { results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' :: ' + detail : ''}`); if (!ok) red++; };

// ---- 1.7, rebuilt: Bryant's 1.5 plus the index.html part of each patch up to 1.7 ----
function indexPart(patchText) { // the hunks of one multi-file patch that touch index.html
  const out = []; let on = false;
  for (const l of patchText.split('\n')) {
    if (l.startsWith('--- topoforge-')) on = /\/index\.html$/.test(l);
    if (on) out.push(l);
  }
  return out.join('\n') + '\n';
}
function rebuild(upto) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-embed-')); let cur = path.join(KIT, 'upstream', 'topoforge-1.5.html');
  for (const step of ['1.5-to-1.6', '1.6-to-1.7', '1.7-to-1.8'].slice(0, upto)) {
    const pf = path.join(dir, step + '.patch'), out = path.join(dir, step + '.html');
    fs.writeFileSync(pf, indexPart(fs.readFileSync(path.join(KIT, 'patches', 'topoforge-' + step + '.patch'), 'utf8')));
    execFileSync('patch', ['-s', '-o', out, cur, pf], { stdio: 'pipe' }); cur = out;
  }
  return cur;
}
let v17;
try { v17 = rebuild(2); } catch (e) { console.error('KIT BROKEN: could not rebuild 1.7 from upstream/ and patches/: ' + e.message); process.exit(2); }

// ---- two origins: A serves the app, its fixtures and parent pages; B serves only parent pages ----
const html = fs.readFileSync(file);
const routes = { '/index.html': { type: 'text/html', body: html } };
const parentPage = (src) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>parent</title></head><body style="margin:0">
<iframe id="f" title="the app" src="${src}" style="border:0;width:1200px;height:800px"></iframe>
<script>window.got = []; addEventListener('message', e => window.got.push({ origin: e.origin, data: e.data }));</script></body></html>`;
const serve = () => new Promise(ok => {
  const s = http.createServer((q, r) => {
    const u = new URL(q.url, 'http://x'); const f = routes[u.pathname];
    if (u.pathname === '/parent.html') { r.setHeader('content-type', 'text/html'); r.end(parentPage(u.searchParams.get('src'))); return; }
    if (!f) { r.statusCode = 404; r.end('not found'); return; }
    r.setHeader('content-type', f.type); r.end(f.body);
  });
  s.listen(0, '127.0.0.1', () => ok(s));
});
const sA = await serve(), sB = await serve();
const A = 'http://127.0.0.1:' + sA.address().port, B = 'http://127.0.0.1:' + sB.address().port;

const browser = await chromium.launch({ executablePath: CHROMIUM, headless: true });
const consoleErrors = [];
async function ctx(o = {}) {
  const c = await browser.newContext({ viewport: { width: o.w || 1400, height: o.h || 900 }, colorScheme: o.dark ? 'dark' : 'light', reducedMotion: o.reduce ? 'reduce' : 'no-preference' });
  if (o.noStorage) await c.addInitScript(() => { const no = () => { throw new DOMException('refused', 'SecurityError'); }; Storage.prototype.getItem = no; Storage.prototype.setItem = no; });
  return c;
}
async function open(url, o = {}) {
  const c = o.c || await ctx(o); const p = await c.newPage();
  p.on('pageerror', e => consoleErrors.push(url + ': pageerror ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/404|load failed/.test(m.text())) consoleErrors.push(url + ': ' + m.text()); });
  await p.goto(url); await p.waitForFunction(() => window.TopoForge && document.querySelector('.pal-item'));
  await p.waitForTimeout(o.settle || 900);
  return { c, p };
}
// pixels compared in the browser itself (no PNG library needed): how many differ, and by how much
let diffPage = null;
async function pixelDiff(a, b) {
  if (!diffPage) diffPage = await (await browser.newContext()).newPage();
  return diffPage.evaluate(async ([x, y]) => {
    const load = s => new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.src = 'data:image/png;base64,' + s; });
    const [i, j] = [await load(x), await load(y)]; if (i.width !== j.width || i.height !== j.height) return { size: false, n: -1, total: 0, max: 255, over: 1 };
    const px = im => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, im.width, im.height).data; };
    const [p, q] = [px(i), px(j)]; let n = 0, max = 0, over = 0;
    for (let k = 0; k < p.length; k += 4) { const m = Math.max(Math.abs(p[k] - q[k]), Math.abs(p[k + 1] - q[k + 1]), Math.abs(p[k + 2] - q[k + 2])); if (m) { n++; if (m > max) max = m; if (m > 16) over++; } }
    return { size: true, n, total: p.length / 4, max, over };
  }, [a.toString('base64'), b.toString('base64')]);
}
const boxOf = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height), pos: cs.position, disp: cs.display }; }, sel);

try {
  // a drawing for the hook: two pages, shapes with what they do in data.what (as corwin.cloud's drawings carry it)
  { const { c, p } = await open(A + '/index.html');
    const json = await p.evaluate(() => {
      DOC = newDoc(); DOC.name = 'Embed fixture'; DOC.pages[0].name = 'First page'; DOC.pages.push(newPage('Second page'));
      S.sel.clear(); reindex(); buildPages();
      edit(() => { const a = makeNode('router', 0, 0, { text: 'Edge Router' }), b = makeNode('switch', 300, 0, { text: 'Core Switch' }); a.data.what = 'Where the shop meets the internet.'; P().nodes.push(a, b); P().links.push(makeLink({ id: a.id, port: null }, { id: b.id, port: null })); });
      return snapshot();
    });
    routes['/fixture.json'] = { type: 'application/json', body: json }; await c.close(); }

  // ---- S: standalone, no switch: the same as 1.7 ----
  routes['/v17.html'] = { type: 'text/html', body: fs.readFileSync(v17) };
  for (const [w, h, dark] of [[1400, 900, false], [1400, 900, true], [1000, 800, false], [800, 700, true]]) {
    const tag = `${w}x${h} ${dark ? 'dark' : 'light'}`;
    const a = await open(A + '/v17.html', { w, h, dark, settle: 1200 }), b = await open(A + '/index.html', { w, h, dark, settle: 1200 });
    const [ia, ib] = [await a.p.screenshot(), await b.p.screenshot()]; const d = await pixelDiff(ia, ib);
    fs.writeFileSync(path.join(outdir, `standalone-1.7-${w}-${dark ? 'dark' : 'light'}.png`), ia); fs.writeFileSync(path.join(outdir, `standalone-1.8-${w}-${dark ? 'dark' : 'light'}.png`), ib);
    check(`S1 standalone ${tag}: 1.8 with no switch draws the same pixels as 1.7`, d.size && d.over <= 8 && d.n <= d.total / 1000, `${d.n} of ${d.total} pixels differ, largest step ${d.max} of 255, ${d.over} by more than 16 (allowed: anti-aliasing noise, at most 8 pixels by more than 16 of 255 (a speck), at most 1 in 1000 in all; a moved line or a changed colour is hundreds of pixels by far more)`);
    const tabs = async p => { const r = []; await p.evaluate(() => document.body.focus()); for (let i = 0; i < 30; i++) { await p.keyboard.press('Tab'); r.push(await p.evaluate(() => { const e = document.activeElement; return (e.id || e.className || e.tagName) + ':' + (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 16); })); } return r.join('|'); };
    if (w === 1400 && !dark) {
      const [ta, tb] = [await tabs(a.p), await tabs(b.p)];
      check('S2 standalone: the first 30 Tab stops are the same as 1.7', ta === tb, ta === tb ? '' : 'differ at ' + ta.split('|').findIndex((x, i) => x !== tb.split('|')[i]));
      const st = await b.p.evaluate(() => ({ cls: document.body.className, added: ['#mapbox', '.fl-bar', '#flLive'].filter(s => document.querySelector(s)), ui: localStorage.getItem('topoforge.ui.v1'), sw: { ...TopoForge.embed() } }));
      check('S3 standalone: no switch is on, no 1.8 element is in the page, nothing new is kept', st.cls === '' && st.added.length === 0 && st.ui === null && Object.values(st.sw).every(v => !v), JSON.stringify(st));
    }
    await a.c.close(); await b.c.close();
  }

  // ---- F, P, H, M: each switch ----
  { const { c, p } = await open(A + '/index.html?embed=frameless');
    const f = await p.evaluate(() => { const br = document.querySelector('.brand').getBoundingClientRect(); return { brandW: br.width, h1: !!document.querySelector('h1.brand'), name: getComputedStyle(document.querySelector('#docName')).display, rule: getComputedStyle(document.querySelector('#topbar')).borderBottomColor, cls: document.body.className }; });
    check('F1 ?embed=frameless: the brand is hidden but still a heading, the document name and the frame rules are gone', f.brandW <= 1 && f.h1 && f.name === 'none' && /rgba\(0, 0, 0, 0\)|transparent/.test(f.rule), JSON.stringify(f));
    const pp = await boxOf(p, '#side'); check('F2 ?embed=frameless alone floats nothing', pp.pos === 'static', JSON.stringify(pp));
    await c.close(); }
  { const { c, p } = await open(A + '/index.html?embed=props,shapes&load=/fixture.json');
    const [pal, side, stage] = [await boxOf(p, '#palette'), await boxOf(p, '#side'), await boxOf(p, '#stage')];
    check('P1 ?embed=props: Properties floats, starting at the right of the drawing', side.pos === 'fixed' && Math.abs(side.x + side.w - (stage.x + stage.w - 12)) <= 1 && side.y === stage.y + 12, JSON.stringify({ side, stage }));
    check('H1 ?embed=shapes: Shapes floats, starting at the left; the drawing takes the whole width', pal.pos === 'fixed' && pal.x === stage.x + 12 && stage.x === 0 && stage.w === 1400, JSON.stringify({ pal, stage }));
    const fit = await p.evaluate(() => { edit(() => { P().nodes.push(makeNode('server', 2400, 300, { text: 'Far Server' })); }); TopoForge.fitView(); const c = document.querySelector('#content').getBoundingClientRect(), pr = document.querySelector('#side').getBoundingClientRect(), pl = document.querySelector('#palette').getBoundingClientRect(); return { left: Math.round(c.left), right: Math.round(c.right), props: Math.round(pr.left), shapes: Math.round(pl.right) }; });
    check('P2 Fit to window, with both panels floating, fits the drawing between them', fit.right <= fit.props && fit.left >= fit.shapes, JSON.stringify(fit));
    // K: keyboard, one pointer, drag, hide, kept
    const at = () => boxOf(p, '#side');
    const s0 = await at(); await p.focus('#side .fl-grip'); await p.keyboard.press('ArrowLeft'); const s1 = await at();
    await p.keyboard.press('Shift+ArrowDown'); const s2 = await at();
    check('K1 the grip moves Properties 16 pixels with an arrow key and 64 with Shift', s1.x === s0.x - 16 && s2.y === s1.y + 64, JSON.stringify([s0.x, s1.x, s1.y, s2.y]));
    await p.click('#side .fl-bar [data-act=move]'); const mi = await p.evaluate(() => [...document.querySelectorAll('.menu .mi')].map(b => b.textContent.trim()));
    await p.click('.menu .mi:has-text("Left")'); const s3 = await at();
    check('K2 one pointer, no drag: Move, Left moves Properties 64 pixels (WCAG 2.5.7)', s3.x === s2.x - 64 && mi.includes('Back to its starting place'), JSON.stringify({ mi, x: [s2.x, s3.x] }));
    const g = await boxOf(p, '#side .fl-grip'); await p.mouse.move(g.x + 30, g.y + 8); await p.mouse.down(); await p.mouse.move(g.x - 70, g.y + 48, { steps: 6 }); await p.mouse.up(); const s4 = await at();
    check('K3 dragging the grip moves Properties', s4.x === s3.x - 100 && s4.y === s3.y + 40, JSON.stringify([s3.x, s3.y, s4.x, s4.y]));
    await p.click('#side .fl-bar [data-act=hide]'); const hid = await p.evaluate(() => ({ h: document.querySelector('#side').getBoundingClientRect().height, exp: document.querySelector('#side [data-act=hide]').getAttribute('aria-expanded'), label: document.querySelector('#side [data-act=hide]').getAttribute('aria-label'), live: (document.querySelector('#flLive') || {}).textContent }));
    check('K4 Hide leaves only the grip row, says so to a screen reader, and offers Show', hid.h < 50 && hid.exp === 'false' && hid.label === 'Show Properties' && /hidden/.test(hid.live), JSON.stringify(hid));
    await p.reload(); await p.waitForFunction(() => window.TopoForge && document.querySelector('.fl-bar')); await p.waitForTimeout(600);
    const s5 = await at(), kept = await p.evaluate(() => JSON.parse(localStorage.getItem('topoforge.ui.v1')));
    check('K5 the place and the hidden state are kept in this browser across a reload', s5.x === s4.x && s5.y === s4.y && s5.h < 50 && kept.props && kept.props.hidden === true, JSON.stringify({ s5, kept }));
    await p.click('#side .fl-bar [data-act=hide]'); await p.click('#side .fl-bar [data-act=move]'); await p.click('.menu .mi:has-text("Back to its starting place")');
    const s6 = await at(); check('K6 Show and Back to its starting place return Properties to the right', s6.h > 300 && s6.x === s0.x && s6.y === s0.y, JSON.stringify(s6));
    await c.close(); }
  { const { c, p } = await open(A + '/index.html?embed=props,shapes,pages', { noStorage: true });
    const side = await boxOf(p, '#side'); await p.focus('#side .fl-grip'); await p.keyboard.press('ArrowUp'); const s1 = await boxOf(p, '#side');
    const st = await boxOf(p, '#stage');
    check('K7 with storage refused the panels still float and move', side.pos === 'fixed' && s1.y === Math.max(st.y, side.y - 16), JSON.stringify([side, s1]) + ' (ArrowUp stops at the top of the drawing)');
    await c.close(); }
  { const { c, p } = await open(A + '/index.html?embed=all', { w: 800, h: 700 });
    const [pal, bar] = [await boxOf(p, '#palette'), await boxOf(p, '#palette .fl-bar')];
    check('K8 at 800 pixels nothing floats: the drawers of 1.7 stay', pal.pos === 'fixed' && pal.x + pal.w <= 0 && bar.disp === 'none', JSON.stringify({ pal, bar }));
    await c.close(); }
  { const { c, p } = await open(A + '/index.html?embed=pages&load=/fixture.json');
    const m = await p.evaluate(() => ({ inBox: !!document.querySelector('#mapbox #pagetabs .ptab.active'), cur: (document.querySelector('#mapbox .ptab[aria-current="page"]') || {}).textContent, bottom: getComputedStyle(document.querySelector('#bottombar')).display, status: !!document.querySelector('#mapbox #status'), map: !!document.querySelector('#mapbox #minimap') }));
    check('M1 ?embed=pages: the page tabs, the overview map and the status line are in one box; the bottom bar is gone', m.inBox && m.cur === 'First page' && m.bottom === 'none' && m.status && m.map, JSON.stringify(m));
    await p.focus('#mapbox .mp-list'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
    const items = await p.evaluate(() => [...document.querySelectorAll('.menu .mi')].map(b => b.textContent.trim()));
    await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
    const now = await p.evaluate(() => ({ cur: DOC.cur, mark: (document.querySelector('#mapbox .ptab[aria-current="page"]') || {}).textContent, focus: document.activeElement.className }));
    check('M2 the Pages button lists every page and opens one, by keyboard alone', items.join('|') === '✓First page|Second page' && now.cur === 1 && now.mark === 'Second page', JSON.stringify({ items, now }));
    let reached = false; await p.evaluate(() => document.body.focus());
    for (let i = 0; i < 80 && !reached; i++) { await p.keyboard.press('Tab'); reached = await p.evaluate(() => !!document.activeElement.closest('#mapbox .mp-pages .ptab')); }
    check('M3 Tab reaches the page tabs in the box', reached);
    const back = await p.evaluate(() => { TopoForge.embed({ pages: false }); return { inBar: !!document.querySelector('#bottombar #pagetabs'), st: !!document.querySelector('#bottombar #status'), mm: document.querySelector('#minimap').parentNode.id, bottom: getComputedStyle(document.querySelector('#bottombar')).display }; });
    check('M4 TopoForge.embed({ pages: false }) puts every piece back where 1.7 has it', back.inBar && back.st && back.mm === 'stage' && back.bottom === 'flex', JSON.stringify(back));
    await c.close(); }
  { const { c, p } = await open(A + '/index.html');
    const r = await p.evaluate(() => { const a = TopoForge.embed({ chrome: false }); const on = document.body.classList.contains('tf-frameless'); const b = TopoForge.embed({ frameless: false }); return { a: a.frameless, on, b: b.frameless, off: !document.body.classList.contains('tf-frameless') }; });
    check('F3 TopoForge.embed({ chrome: false }) turns frameless on, and { frameless: false } off again', r.a && r.on && !r.b && r.off, JSON.stringify(r));
    await c.close(); }

  // ---- E: the selection hook and the ready event, same origin only ----
  const parentRun = async (origin, src, act) => {
    const c = await ctx({ w: 1240, h: 840 }); const p = await c.newPage();
    p.on('pageerror', e => consoleErrors.push('parent: ' + e.message));
    await p.goto(origin + '/parent.html?src=' + encodeURIComponent(src));
    const fr = p.frame({ url: u => u.pathname === '/index.html' });
    await fr.waitForFunction(() => window.TopoForge && document.querySelector('.pal-item'));
    await fr.evaluate(() => { window.own = []; addEventListener('topoforge:select', e => window.own.push(e.detail)); });
    await p.waitForTimeout(900);
    if (act) await act(p, fr);
    await p.waitForTimeout(500);
    const got = await p.evaluate(() => window.got), own = await fr.evaluate(() => window.own);
    await c.close(); return { got, own };
  };
  const clickFirst = async (p, fr) => { // a real click on the first shape, through the iframe
    const at = await fr.evaluate(() => { const n = P().nodes.find(x => x.text === 'Edge Router'); const r = svgEl().getBoundingClientRect(); return { x: r.left + (n.x + n.w / 2) * S.view.k + S.view.x, y: r.top + (n.y + n.h / 2) * S.view.k + S.view.y }; });
    const fb = await (await p.$('#f')).boundingBox(); await p.mouse.click(fb.x + at.x, fb.y + at.y); await p.waitForTimeout(300);
    await fr.evaluate(() => TopoForge.showPage('Second page'));
  };
  const same = await parentRun(A, A + '/index.html?embed=select,ready&load=/fixture.json', clickFirst);
  const types = same.got.map(m => m.data && m.data.type);
  const ready = same.got.filter(m => m.data.type === 'topoforge:ready');
  check('E1 ready: one topoforge:ready reaches the parent, after the drawing named by ?load= is open', ready.length === 1 && ready[0].origin === A && ready[0].data.detail.name === 'Embed fixture' && ready[0].data.detail.loaded === '/fixture.json' && ready[0].data.detail.ok === true && ready[0].data.detail.pages.join('|') === 'First page|Second page', JSON.stringify(ready.map(m => m.data.detail)));
  const sel = same.got.filter(m => m.data.type === 'topoforge:select').map(m => m.data.detail);
  const hit = sel.find(d => d.name === 'Edge Router');
  check('E2 a click on a shape tells the parent its name, tooltip, kind and page', !!hit && hit.tooltip === 'Where the shop meets the internet.' && hit.kind === 'router' && hit.page === 'First page' && hit.pageIndex === 0 && hit.count === 1 && /^router-/.test(hit.ref), JSON.stringify(hit || sel));
  const pg = sel[sel.length - 1];
  check('E3 a change of page is told too (nothing selected, the new page named)', pg && pg.page === 'Second page' && pg.count === 0, JSON.stringify(pg));
  // the app's own listener is added after load, so it hears the last of the parent's messages, in the same order
  const tail = sel.slice(sel.length - same.own.length);
  check('E4 the same messages go to the app\'s own window as topoforge:select events', same.own.length >= 2 && JSON.stringify(same.own) === JSON.stringify(tail), `own=${same.own.length} parent=${sel.length}`);
  const other = await parentRun(B, A + '/index.html?embed=select,ready&load=/fixture.json', clickFirst);
  check('E5 a parent page of another origin receives nothing, though the hook fired inside the app', other.got.length === 0 && other.own.some(d => d.name === 'Edge Router'), `parent got ${other.got.length}: ${JSON.stringify(other.got).slice(0, 200)}; own=${other.own.length}`);
  const off = await parentRun(A, A + '/index.html?load=/fixture.json', clickFirst);
  check('E6 with no switch the app tells no parent anything', off.got.length === 0 && off.own.length === 0, `parent got ${off.got.length}, own ${off.own.length}`);
  { const { c, p } = await open('file://' + path.resolve(file) + '?embed=select,ready');
    const r = await p.evaluate(async () => { const d = await TopoForge.ready; return { v: d.version, ok: d.ok, sel: TopoForge.selection.count }; });
    check('E7 TopoForge.ready resolves from file:// too (nothing is posted from there)', r.v === '1.8' && r.ok === true && r.sel === 0, JSON.stringify(r));
    await c.close(); }

  // ---- B: hiding the app's own chrome, all of it or each piece ----
  { const shown = sel => `(() => { const e = document.querySelector('${sel}'); if (!e) return false; const b = e.getBoundingClientRect(); return getComputedStyle(e).display !== 'none' && b.width > 0 && b.height > 0 && b.right > 0; })()`;
    const look = p => p.evaluate(`({ menus: ${shown('#menubar')}, tools: ${shown('#topbar .toolgroup')}, top: ${shown('#topbar')}, shapes: ${shown('#palette')}, props: ${shown('#side')}, pages: ${shown('#bottombar')} || ${shown('#mapbox')}, stage: (() => { const b = document.querySelector('#stage').getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)].join(','); })() })`);
    { const { c, p } = await open(A + '/index.html?embed=bare,pages&load=/fixture.json'); const v = await look(p);
      check('B1 ?embed=bare hides every piece of the app\'s chrome (hiding beats pages): the drawing is the whole window', !v.menus && !v.tools && !v.top && !v.shapes && !v.props && !v.pages && v.stage === '0,0,1400,900', JSON.stringify(v)); await c.close(); }
    const each = { 'hide-menus': v => !v.menus && v.tools, 'hide-tools': v => v.menus && !v.tools, 'hide-shapes': v => !v.shapes && v.props && v.stage.startsWith('0,'), 'hide-props': v => v.shapes && !v.props && v.stage.split(',')[2] === '1400', 'hide-pages': v => !v.pages && v.stage.endsWith(',900') };
    const bad = [];
    for (const [w, ok] of Object.entries(each)) { const { c, p } = await open(A + '/index.html?embed=' + w); const v = await look(p); if (!ok(v)) bad.push(w + ' ' + JSON.stringify(v)); await c.close(); }
    check('B2 each hide word hides its own piece and leaves the others: ' + Object.keys(each).join(', '), !bad.length, bad.join(' ; ') || 'all as named');
  }

  // ---- Z: the palette's catalogue, and placing a shape without it ----
  { const { c, p } = await open(A + '/index.html?embed=hide-shapes&load=/fixture.json');
    const z = await p.evaluate(() => { const cat = TopoForge.shapes(); const ui = [...document.querySelectorAll('#palList .pal-cat')].map(e => ({ id: e.dataset.cat, keys: [...e.querySelectorAll('.pal-item')].map(i => i.dataset.key) }));
      return { same: JSON.stringify(cat.map(c => ({ id: c.id, keys: c.shapes.map(s => s.id) }))) === JSON.stringify(ui), cats: cat.length, n: cat.reduce((a, c) => a + c.shapes.length, 0), icons: cat.every(c => c.shapes.every(s => /^<svg[\s\S]*<\/svg>$/.test(s.icon.trim()) && s.label && s.category === c.id)) }; });
    check('Z1 TopoForge.shapes() is the palette\'s catalogue: its categories and shapes in the palette\'s order, each with its label and picture', z.same && z.icons && z.cats >= 5 && z.n > 30, JSON.stringify(z));
    const n0 = await p.evaluate(() => P().nodes.length);
    const a1 = await p.evaluate(() => TopoForge.place('firewall', 'center'));
    const n1 = await p.evaluate(() => P().nodes.length);
    const armed = await p.evaluate(() => TopoForge.place('server') && TopoForge.placing);
    const cv = await boxOf(p, '#canvas'); const at = { x: cv.x + 300, y: cv.y + 200 };
    await p.mouse.click(at.x, at.y); await p.waitForTimeout(150);
    const dropped = await p.evaluate(([x, y]) => { const n = P().nodes[P().nodes.length - 1]; const w = toWorld({ clientX: x, clientY: y }); return { type: n.type, dx: Math.abs(n.x + n.w / 2 - w.x), dy: Math.abs(n.y + n.h / 2 - w.y), placing: TopoForge.placing, count: P().nodes.length }; }, [at.x, at.y]);
    await p.evaluate(() => TopoForge.place('switch')); await p.keyboard.press('Escape'); const esc = await p.evaluate(() => ({ count: P().nodes.length, placing: TopoForge.placing }));
    await p.evaluate(() => TopoForge.place('switch')); await p.keyboard.press('Enter'); const ent = await p.evaluate(() => ({ count: P().nodes.length, type: P().nodes[P().nodes.length - 1].type }));
    const unknown = await p.evaluate(() => TopoForge.place('no-such-shape'));
    check('Z2 TopoForge.place: "center" adds at the middle; armed, a press drops it at the pointer, Escape gives up, Enter drops it in the middle; an unknown id is false',
      a1 && n1 === n0 + 1 && armed === 'server' && dropped.type === 'server' && dropped.dx <= 20 && dropped.dy <= 20 && dropped.placing === null && dropped.count === n1 + 1 && esc.count === n1 + 1 && esc.placing === null && ent.count === n1 + 2 && ent.type === 'switch' && unknown === false,
      JSON.stringify({ n0, n1, armed, dropped, esc, ent, unknown }));
    await c.close(); }

  // ---- R: every menu command, for a page that hides the chrome ----
  { const { c, p } = await open(A + '/index.html?embed=frameless&load=/fixture.json');
    const cmds = await p.evaluate(() => TopoForge.commands());
    const ui = {};
    for (const m of ['file', 'edit', 'arrange', 'layout', 'view', 'help']) {
      await p.evaluate(() => closeMenus()); await p.click(`.menu-btn[data-menu="${m}"]`); await p.waitForTimeout(80);
      ui[m] = await p.evaluate(() => [...document.querySelectorAll('.menu .mi')].map(b => ({ label: b.querySelector('.lb').textContent, on: !b.disabled })));
      await p.keyboard.press('Escape');
    }
    const bad = Object.keys(ui).filter(m => JSON.stringify(ui[m]) !== JSON.stringify(cmds.filter(x => x.menu === m).map(x => ({ label: x.label, on: x.enabled }))));
    check('R1 TopoForge.commands() lists every menu item, in order, enabled as the menus show it; ids unique', cmds.length > 40 && !bad.length && new Set(cmds.map(x => x.id)).size === cmds.length && cmds.every(x => /^[a-z]+:[a-z0-9-]*:[a-z0-9-]+$/.test(x.id) && 'shortcut' in x),
      `${cmds.length} commands; menus that differ from the UI: ${bad.map(m => m + ' ' + JSON.stringify(ui[m])).join(' ; ') || 'none'}`);
    const r = await p.evaluate(() => { try {
      const all = TopoForge.commands(), sel = all.find(x => x.label === 'Select all'), undo = all.find(x => x.menu === 'edit' && x.label === 'Undo');
      TopoForge.select([]); const ran = TopoForge.run(sel.id), n = TopoForge.selection.count;
      const u = undo.enabled ? null : TopoForge.run(undo.id);
      return { id: sel.id, ran, n, want: P().nodes.length + P().links.length, undoEnabled: undo.enabled, undoRan: u, none: TopoForge.run('no:such:command') };
    } catch (e) { return { error: String(e) }; } });
    check('R2 TopoForge.run(id) runs a command (Select all selects every shape); a disabled or unknown id runs nothing and says false', r.ran === true && r.n === r.want && r.undoEnabled === false && r.undoRan === false && r.none === false, JSON.stringify(r));
    await c.close(); }

  // ---- A: the About box ----
  { const { c, p } = await open(A + '/index.html');
    await p.click('.menu-btn[data-menu="help"]'); await p.click('.menu .mi:has-text("About")'); await p.waitForTimeout(200);
    const t = await p.evaluate(() => ({ h: document.querySelector('.modal-h h2').textContent, b: document.querySelector('.modal-b').textContent }));
    check('A1 About says "topology forge (formerly TopoForge)", names Bryant Frankford first, and the version', t.h === 'topology forge (formerly TopoForge)' && t.b.indexOf('Bryant Frankford') > -1 && t.b.indexOf('Bryant Frankford') < t.b.indexOf('Corwin Brust') && /Version 1\.8/.test(t.b), JSON.stringify(t).slice(0, 300));
    await c.close(); }

  // ---- X: axe with every switch on; reduced motion ----
  for (const dark of [false, true]) {
    const { c, p } = await open(A + '/index.html?embed=all&load=/fixture.json', { dark, reduce: true });
    await p.waitForFunction(() => !document.querySelector('#toasts .toast'), null, { timeout: 8000 }).catch(() => {});   // 1.7's toasts: see NEWS, 1.8
    await p.addScriptTag({ content: axeSrc });
    const v = await p.evaluate(async () => (await axe.run(document, { resultTypes: ['violations'] })).violations.map(x => ({ id: x.id, impact: x.impact, n: x.nodes.length, t: x.nodes.slice(0, 4).map(y => y.target.join(' ')) })));
    fs.writeFileSync(path.join(outdir, `axe-embed-all-${dark ? 'dark' : 'light'}.json`), JSON.stringify(v, null, 1));
    const bad = v.filter(x => x.impact === 'critical' || x.impact === 'serious');
    check(`X1 axe, every switch on, ${dark ? 'dark' : 'light'}: no critical or serious finding`, bad.length === 0, v.map(x => `${x.impact} ${x.id} x${x.n} [${x.t.join(' | ')}]`).join(' ;; ') || 'no findings');
    if (!dark) {
      const mo = await p.evaluate(() => ['#palette', '#side', '#mapbox', '.fl-bar'].map(s => getComputedStyle(document.querySelector(s)).transitionDuration));
      check('X2 the floating parts do not move by themselves (no transition) with reduced motion asked', mo.every(d => d === '0s'), mo.join(','));
      await p.screenshot({ path: path.join(outdir, 'embed-all-light.png') });
    } else await p.screenshot({ path: path.join(outdir, 'embed-all-dark.png') });
    await c.close();
  }
  check('C1 no console errors', consoleErrors.length === 0, consoleErrors.join(' | ').slice(0, 600));
} finally { await browser.close(); for (const s of [sA, sB]) { s.close(); if (s.closeAllConnections) s.closeAllConnections(); } }

console.log(results.join('\n'));
console.log(red ? `TOPOFORGE EMBED RED (${red} failed)` : 'TOPOFORGE EMBED GREEN');
const passed = results.filter(r => r.startsWith('PASS')).length;
fs.writeFileSync(RESULT, [red ? 'RED' : 'GREEN',
  'topology forge (formerly TopoForge) 1.8, the embedding switches, in a real browser -- written by tests/browser/embed.browser.mjs (do not edit by hand)',
  'Licence of this note: CC-BY-SA-4.0',
  'Run at: ' + new Date().toISOString() + ' on ' + os.type() + ' ' + os.release() + ', node ' + process.version + ', ' + 'playwright ' + require(PW + '/package.json').version,
  'File tested: index.html sha256 ' + sha(html),
  'Compared with: 1.7 rebuilt from upstream/topoforge-1.5.html and patches/, sha256 ' + sha(fs.readFileSync(v17)),
  'Kit: tests/browser/embed.browser.mjs sha256 ' + sha(fs.readFileSync(fileURLToPath(import.meta.url))),
  `Result: ${passed} checks passed, ${red} failed. Exit ${red ? 1 : 0} (0 green, 1 red, 2 kit broken).`,
  '', 'CHECKS', ...results, ''].join('\n'));
console.log('wrote ' + RESULT);
process.exit(red ? 1 : 0);
