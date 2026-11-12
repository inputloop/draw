// SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
// Copyright 2026 Bryant Frankford <nathanielfrankford@gmail.com> and Corwin Brust <corwin@bru.st> and Contributors
// Written by Mentat (for Corwin, claude-opus-5-5), 2026-11-01, for topology forge (formerly TopoForge) 1.8; 1.9, 1.10 and 1.11 checks 2026-11-02; 1.12 and 1.13 checks 2026-11-03; 1.14 checks 2026-11-04; 1.15 (the About box says draw) 2026-11-11.
//
// embed.browser.mjs -- the embedding switches (1.8 to 1.15) in real Chromium, held to spec/EMBED-v1.md.
//   S  standalone is unchanged: 1.9 opened with no switch draws the same pixels as 1.8 (rebuilt here from
//      Bryant's 1.5 and patches/, so the kit needs no copy of 1.8), at three widths, light and dark, with the
//      same tab order, and writes nothing new to storage; with more page tabs than fit, only the bottom bar differs (S4).
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
const results = []; let red = 0, at = '';   // at: the check whose steps are running, named if one of them throws
const check = (name, ok, detail = '') => { results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' :: ' + detail : ''}`); if (!ok) red++; };

// ---- the version before, rebuilt: Bryant's 1.5 plus the index.html part of each patch up to it ----
const VER = '1.15', PREV = '1.14';
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
  for (const step of ['1.5-to-1.6', '1.6-to-1.7', '1.7-to-1.8', '1.8-to-1.9', '1.9-to-1.10', '1.10-to-1.11', '1.11-to-1.12', '1.12-to-1.13', '1.13-to-1.14', '1.14-to-1.15'].slice(0, upto)) {
    const pf = path.join(dir, step + '.patch'), out = path.join(dir, step + '.html');
    fs.writeFileSync(pf, indexPart(fs.readFileSync(path.join(KIT, 'patches', 'topoforge-' + step + '.patch'), 'utf8')));
    execFileSync('patch', ['-s', '-o', out, cur, pf], { stdio: 'pipe' }); cur = out;
  }
  return cur;
}
let v17, v18, v111;   // v17: the version before (PREV); v18: 1.8; v111: 1.11, whose pad the 1.12 checks compare with
try { v17 = rebuild(9); v18 = rebuild(3); v111 = rebuild(6); } catch (e) { console.error('KIT BROKEN: could not rebuild ' + PREV + ' from upstream/ and patches/: ' + e.message); process.exit(2); }

// ---- two origins: A serves the app, its fixtures and parent pages; B serves only parent pages ----
const html = fs.readFileSync(file);
const routes = { '/index.html': { type: 'text/html', body: html } };
const parentPage = (src) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>parent</title></head><body style="margin:0">
<iframe id="f" title="the app" src="${src}" style="border:0;width:1200px;height:800px"></iframe>
<script>window.got = []; addEventListener('message', e => window.got.push({ origin: e.origin, data: e.data }));</script></body></html>`;
const reqLog = [];   // 1.12: every request each server saw, 'port path', so a check can say nothing went to the other host
const serve = () => new Promise(ok => {
  const s = http.createServer((q, r) => {
    const u = new URL(q.url, 'http://x'); const f = routes[u.pathname]; reqLog.push(s.address().port + ' ' + u.pathname);
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
  const c = await browser.newContext({ viewport: { width: o.w || 1400, height: o.h || 900 }, colorScheme: o.dark ? 'dark' : 'light', reducedMotion: o.reduce ? 'reduce' : 'no-preference', hasTouch: !!o.touch });
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
    routes['/fixture.json'] = { type: 'application/json', body: json };
    // 1.9: sixty pages, more tabs than fit, for the page-tab checks (S4, T)
    routes['/many.json'] = { type: 'application/json', body: await p.evaluate(() => { const d = newDoc(); d.name = 'Many pages'; d.pages = Array.from({ length: 60 }, (x, i) => newPage(`Page ${i + 1} ${['of the shop', 'hosts', 'a longer name for a page', 'paths'][i % 4]}`)); d.cur = 0; return JSON.stringify(d); }) };
    // 1.12: the same two shapes with their own fields (the back of a card), and ten servers (more matches than the 9 pages hold)
    routes['/rich.json'] = { type: 'application/json', body: await p.evaluate(() => {
      DOC = newDoc(); DOC.name = 'Rich fixture'; DOC.pages[0].name = 'First page'; S.sel.clear(); reindex(); buildPages();
      edit(() => { const a = makeNode('router', 0, 0, { text: 'Edge Router' }), b = makeNode('switch', 300, 0, { text: 'Core Switch' }); a.data.what = 'Where the shop meets the internet.';
        Object.assign(a.props, { hostname: 'gw4', ip: '203.0.113.1', vlan: '1', status: 'up', vendor: 'Ubiquiti' }); Object.assign(b.props, { hostname: 'sw1', vlan: '20' });
        P().nodes.push(a, b); P().links.push(makeLink({ id: a.id, port: null }, { id: b.id, port: null }));
        for (let i = 1; i <= 10; i++) P().nodes.push(makeNode('server', (i - 1) % 5 * 160, 260 + Math.floor((i - 1) / 5) * 160, { text: 'Server ' + i })); });
      return snapshot(); }) };
    routes['/card.png'] = { type: 'image/png', body: Buffer.from(await p.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d');
      g.fillStyle = '#0f766e'; g.fillRect(0, 0, 96, 96); g.fillStyle = '#ffffff'; g.fillRect(24, 24, 48, 48); return c.toDataURL('image/png').split(',')[1]; }), 'base64') };
    await c.close(); }

  // ---- S: standalone, no switch: the same as the version before ----
  routes['/v17.html'] = { type: 'text/html', body: fs.readFileSync(v17) };   // the version before (PREV)
  routes['/v18.html'] = { type: 'text/html', body: fs.readFileSync(v18) };   // 1.8, the last without the page-tab fix (S4)
  routes['/v111.html'] = { type: 'text/html', body: fs.readFileSync(v111) };   // 1.11, for the 1.12 checks of the pad (CP1, CP6)
  for (const [w, h, dark] of [[1400, 900, false], [1400, 900, true], [1000, 800, false], [800, 700, true]]) {
    const tag = `${w}x${h} ${dark ? 'dark' : 'light'}`;
    const a = await open(A + '/v17.html', { w, h, dark, settle: 1200 }), b = await open(A + '/index.html', { w, h, dark, settle: 1200 });
    const [ia, ib] = [await a.p.screenshot(), await b.p.screenshot()]; const d = await pixelDiff(ia, ib);
    fs.writeFileSync(path.join(outdir, `standalone-${PREV}-${w}-${dark ? 'dark' : 'light'}.png`), ia); fs.writeFileSync(path.join(outdir, `standalone-${VER}-${w}-${dark ? 'dark' : 'light'}.png`), ib);
    check(`S1 standalone ${tag}: ${VER} with no switch draws the same pixels as ${PREV}`, d.size && d.over <= 8 && d.n <= d.total / 1000, `${d.n} of ${d.total} pixels differ, largest step ${d.max} of 255, ${d.over} by more than 16 (allowed: anti-aliasing noise, at most 8 pixels by more than 16 of 255 (a speck), at most 1 in 1000 in all; a moved line or a changed colour is hundreds of pixels by far more)`);
    const tabs = async p => { const r = []; await p.evaluate(() => document.body.focus()); for (let i = 0; i < 30; i++) { await p.keyboard.press('Tab'); r.push(await p.evaluate(() => { const e = document.activeElement; return (e.id || e.className || e.tagName) + ':' + (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 16); })); } return r.join('|'); };
    if (w === 1400 && !dark) {
      const [ta, tb] = [await tabs(a.p), await tabs(b.p)];
      check('S2 standalone: the first 30 Tab stops are the same as ' + PREV, ta === tb, ta === tb ? '' : 'differ at ' + ta.split('|').findIndex((x, i) => x !== tb.split('|')[i]));
      const st = await b.p.evaluate(() => ({ cls: document.body.className, added: ['#mapbox', '.fl-bar', '#flLive', '#mmwrap', '.mm-h', '.mm-cap', '.pt-ctl', '#ptFly', '.mm-card', '#tfHi', '#mmPad', '.mc-big', '.mp-cardmode', '.tf-bigcard'].filter(s => document.querySelector(s)), ui: localStorage.getItem('topoforge.ui.v1'), sw: { ...TopoForge.embed() } }));
      check('S3 standalone: no switch is on, no element of 1.8 or 1.9 is in the page, nothing new is kept', st.cls === '' && st.added.length === 0 && st.ui === null && Object.values(st.sw).every(v => !v), JSON.stringify(st));
    }
    await a.c.close(); await b.c.close();
  }
  // 1.12: with every 1.11 switch on and 1.10's card shown (the pad shown beside it), 1.12 draws the same pixels as 1.11
  for (const dark of [false, true]) {
    const u = '?embed=map,preview,mappad,reset,mapwheel&load=/rich.json';
    const a = await open(A + '/v17.html' + u, { dark, settle: 1200 }), b = await open(A + '/index.html' + u, { dark, settle: 1200 });
    for (const x of [a, b]) { await x.p.waitForFunction(() => !document.querySelector('#toasts .toast'), null, { timeout: 8000 }).catch(() => {});
      await x.p.evaluate(() => TopoForge.preview({ category: 'net' })); const m = await boxOf(x.p, '#minimap'); await x.p.mouse.move(m.x - 30, m.y + 20); await x.p.waitForTimeout(500); }
    const [ia, ib] = [await a.p.screenshot(), await b.p.screenshot()]; const d = await pixelDiff(ia, ib);
    fs.writeFileSync(path.join(outdir, `switches111-${PREV}-${dark ? 'dark' : 'light'}.png`), ia); fs.writeFileSync(path.join(outdir, `switches111-${VER}-${dark ? 'dark' : 'light'}.png`), ib);
    check(`S6 every 1.11 switch on (map, preview, mappad, reset, mapwheel), 1.10's card and the pad shown, 1400x900 ${dark ? 'dark' : 'light'}: ${VER} draws the same pixels as ${PREV} (the new switches are off)`, d.size && d.over <= 8 && d.n <= d.total / 1000, `${d.n} of ${d.total} pixels differ, largest step ${d.max} of 255, ${d.over} by more than 16`);
    await a.c.close(); await b.c.close();
  }
  // 1.13: with every 1.12 switch on (cardpad: bigcard, mappad, map, preview), the big card on its second page and the pad turned, 1.13 draws the same pixels as 1.12
  for (const dark of [false, true]) {
    const u = '?embed=cardpad,reset,mapwheel&load=/rich.json';
    const a = await open(A + '/v17.html' + u, { dark, settle: 1200 }), b = await open(A + '/index.html' + u, { dark, settle: 1200 });
    for (const x of [a, b]) { await x.p.waitForFunction(() => !document.querySelector('#toasts .toast'), null, { timeout: 8000 }).catch(() => {});
      await x.p.evaluate(() => { TopoForge.preview({ category: 'net' }); TopoForge.cardPage('next'); }); const m = await boxOf(x.p, '#minimap'); await x.p.mouse.move(m.x + m.w / 2, m.y + m.h + 5); await x.p.waitForTimeout(700); }   // within reach, below the map: not on the turned pad, whose hover would follow the turn
    const [ia, ib] = [await a.p.screenshot(), await b.p.screenshot()]; const d = await pixelDiff(ia, ib);
    fs.writeFileSync(path.join(outdir, `switches112-${PREV}-${dark ? 'dark' : 'light'}.png`), ia); fs.writeFileSync(path.join(outdir, `switches112-${VER}-${dark ? 'dark' : 'light'}.png`), ib);
    check(`S7 every 1.12 switch on (cardpad, so bigcard, mappad, map and preview; reset, mapwheel), the big card on its second page and the pad turned, 1400x900 ${dark ? 'dark' : 'light'}: ${VER} draws the same pixels as ${PREV} (peek is off)`, d.size && d.over <= 8 && d.n <= d.total / 1000, `${d.n} of ${d.total} pixels differ, largest step ${d.max} of 255, ${d.over} by more than 16`);
    await a.c.close(); await b.c.close();
  }
  // 1.14: with every 1.13 switch on (peek, cardpad: bigcard, mappad, map, preview), the big card on its second page, the pad turned, and a peek
  // showing (Shift held over a shape), 1.14 draws the same pixels as 1.13: peekKey is a call, and the title is shortened only when it cannot fit
  for (const dark of [false, true]) {
    const u = '?embed=peek,cardpad,reset,mapwheel&load=/rich.json';
    const a = await open(A + '/v17.html' + u, { dark, settle: 1200 }), b = await open(A + '/index.html' + u, { dark, settle: 1200 });
    for (const x of [a, b]) { await x.p.waitForFunction(() => !document.querySelector('#toasts .toast'), null, { timeout: 8000 }).catch(() => {});
      await x.p.evaluate(() => { TopoForge.preview({ category: 'net' }); TopoForge.cardPage('next'); }); const m = await boxOf(x.p, '#minimap'); await x.p.mouse.move(m.x + m.w / 2, m.y + m.h + 5); await x.p.waitForTimeout(500);
      const v = await x.p.evaluate(() => { const n = P().nodes.find(y => y.text === 'Server 2'), r = svgEl().getBoundingClientRect(); return { x: r.left + (n.x + n.w / 2) * S.view.k + S.view.x, y: r.top + (n.y + n.h / 2) * S.view.k + S.view.y }; }); await x.p.mouse.move(v.x, v.y); await x.p.keyboard.down('Shift'); await x.p.mouse.move(v.x + 2, v.y + 1); await x.p.waitForTimeout(700); }
    const [ia, ib] = [await a.p.screenshot(), await b.p.screenshot()]; const d = await pixelDiff(ia, ib);
    for (const x of [a, b]) await x.p.keyboard.up('Shift');
    fs.writeFileSync(path.join(outdir, `switches113-${PREV}-${dark ? 'dark' : 'light'}.png`), ia); fs.writeFileSync(path.join(outdir, `switches113-${VER}-${dark ? 'dark' : 'light'}.png`), ib);
    check(`S8 every 1.13 switch on (peek; cardpad, so bigcard, mappad, map and preview; reset, mapwheel), the big card on its second page, the pad turned and a peek showing, 1400x900 ${dark ? 'dark' : 'light'}: ${VER} draws the same pixels as ${PREV}`, d.size && d.over <= 8 && d.n <= d.total / 1000, `${d.n} of ${d.total} pixels differ, largest step ${d.max} of 255, ${d.over} by more than 16`);
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
    for (let i = 0; i < 120 && !reached; i++) { await p.keyboard.press('Tab'); /* 1.9: up from 80; the ‹ of a strip that does not fit is one more stop */ reached = await p.evaluate(() => !!document.activeElement.closest('#mapbox .mp-pages .ptab')); }
    check('M3 Tab reaches the page tabs in the box', reached);
    const back = await p.evaluate(() => { TopoForge.embed({ pages: false }); return { inBar: !!document.querySelector('#bottombar #pagetabs'), st: !!document.querySelector('#bottombar #status'), mm: document.querySelector('#minimap').parentNode.id, bottom: getComputedStyle(document.querySelector('#bottombar')).display }; });
    check('M4 TopoForge.embed({ pages: false }) puts every piece back where 1.7 has it', back.inBar && back.st && back.mm === 'stage' && back.bottom === 'flex', JSON.stringify(back));
    await c.close(); }
  { const { c, p } = await open(A + '/index.html');
    const r = await p.evaluate(() => { const a = TopoForge.embed({ chrome: false }); const on = document.body.classList.contains('tf-frameless'); const b = TopoForge.embed({ frameless: false }); return { a: a.frameless, on, b: b.frameless, off: !document.body.classList.contains('tf-frameless') }; });
    check('F3 TopoForge.embed({ chrome: false }) turns frameless on, and { frameless: false } off again', r.a && r.on && !r.b && r.off, JSON.stringify(r));
    await c.close(); }

  // ---- E: the selection hook and the ready event, same origin only ----
  const parentRun = async (origin, src, act, o = {}) => {
    const c = await ctx({ w: 1240, h: 840, ...o }); const p = await c.newPage();
    p.on('pageerror', e => consoleErrors.push('parent: ' + e.message));
    await p.goto(origin + '/parent.html?src=' + encodeURIComponent(src));
    const fr = p.frame({ url: u => u.pathname === '/index.html' });
    await fr.waitForFunction(() => window.TopoForge && document.querySelector('.pal-item'));
    await fr.evaluate(() => { window.own = []; window.ownAll = []; addEventListener('topoforge:select', e => window.own.push(e.detail));
      for (const t of ['view', 'key', 'context', 'pages', 'peek']) addEventListener('topoforge:' + t, e => window.ownAll.push(t)); });
    await p.waitForTimeout(900);
    if (act) await act(p, fr);
    await p.waitForTimeout(500);
    const got = await p.evaluate(() => window.got), own = await fr.evaluate(() => window.own), ownAll = await fr.evaluate(() => window.ownAll);
    const extra = o.after ? await o.after(p, fr) : null;
    await c.close(); return { got, own, ownAll, extra };
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
    check('E7 TopoForge.ready resolves from file:// too (nothing is posted from there)', r.v === VER && r.ok === true && r.sel === 0, JSON.stringify(r));
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
    check('A1 About says "draw", names Bryant Frankford first, and the version', t.h === 'draw' && t.b.indexOf('Bryant Frankford') > -1 && t.b.indexOf('Bryant Frankford') < t.b.indexOf('Corwin Brust') && t.b.includes('Version ' + VER), JSON.stringify(t).slice(0, 300));
    await c.close(); }

  // ======== 1.9 (A): more for an embedding page; each message behind its own switch ========
  const msgs = (got, t) => got.filter(m => m.data && m.data.type === 'topoforge:' + t).map(m => m.data.detail);
  const shapeAt = (fr, label) => fr.evaluate(l => { const n = P().nodes.find(x => x.text === l); const r = svgEl().getBoundingClientRect(); return { x: r.left + (n.x + n.w / 2) * S.view.k + S.view.x, y: r.top + (n.y + n.h / 2) * S.view.k + S.view.y, id: n.id }; }, label);
  const inFrame = async (p, at) => { const fb = await (await p.$('#f')).boundingBox(); return { x: fb.x + at.x, y: fb.y + at.y }; };
  // V: the view
  { const r = await parentRun(A, A + '/index.html?embed=view&load=/fixture.json', async (p, fr) => {
      await fr.evaluate(() => TopoForge.setView({ k: 0.5, x: 100, y: 50 })); await p.waitForTimeout(250);
      const c = await inFrame(p, { x: 700, y: 400 }); await p.mouse.move(c.x, c.y); await p.keyboard.down('Control'); await p.mouse.wheel(0, -200); await p.keyboard.up('Control'); await p.waitForTimeout(300);
    }, { after: (p, fr) => fr.evaluate(() => TopoForge.view) });
    const v = msgs(r.got, 'view'), set = v.find(d => d.k === 0.5 && d.x === 100 && d.y === 50 && d.zoom === 50), last = v[v.length - 1];
    check('V1 view: TopoForge.setView moves the drawing and topoforge:view tells the parent; a zoom by the wheel is told too; TopoForge.view agrees', !!set && last && last.k > 0.5 && JSON.stringify({ k: last.k, x: last.x, y: last.y }) === JSON.stringify({ k: r.extra.k, x: r.extra.x, y: r.extra.y }) && set.width > 0 && 'rect' in set, JSON.stringify({ n: v.length, set, last, now: r.extra }));
    const off = await parentRun(A, A + '/index.html?embed=select&load=/fixture.json', async (p, fr) => { await fr.evaluate(() => TopoForge.setView({ k: 0.7 })); });
    check('V2 without the view switch no topoforge:view is sent, though setView still works', msgs(off.got, 'view').length === 0 && off.ownAll.length === 0, `view messages: ${msgs(off.got, 'view').length}`); }
  // R3: where the selection is on screen; Z3: place(null); U1: setProps
  { const { c, p } = await open(A + '/index.html?load=/fixture.json');
    const r3 = await p.evaluate(() => { const n = P().nodes.find(x => x.text === 'Edge Router'); TopoForge.select([n.id]); const ov = document.querySelector('#overlay rect').getBoundingClientRect(); const k = S.view.k;
      return { rect: TopoForge.selectionRect(), sel: TopoForge.selection.rect, ov: { x: ov.left + 3, y: ov.top + 3, w: ov.width - 6, h: ov.height - 6 }, none: (TopoForge.select([]), TopoForge.selectionRect()) }; });
    const near = (a, b, d = 2) => Math.abs(a - b) <= d;
    check('R3 selectionRect() and the select detail\'s rect give the selected shape\'s box on screen, in the app\'s pixels (null when nothing is selected)', r3.rect && near(r3.rect.x, r3.ov.x) && near(r3.rect.y, r3.ov.y) && near(r3.rect.w, r3.ov.w) && r3.rect.h >= r3.ov.h - 2 && JSON.stringify(r3.rect) === JSON.stringify(r3.sel) && r3.none === null, JSON.stringify(r3));
    const z = await p.evaluate(() => { const n0 = P().nodes.length; const a = TopoForge.place('server'), armed = TopoForge.placing, d = TopoForge.place(null), after = TopoForge.placing, again = TopoForge.place(null); return { n0, a, armed, d, after, again, cross: document.body.classList.contains('tf-placing') }; });
    const cv = await boxOf(p, '#canvas'); await p.mouse.click(cv.x + 300, cv.y + 200); await p.waitForTimeout(150);
    const zn = await p.evaluate(() => P().nodes.length);
    check('Z3 place(null) gives up an armed shape: placing is null, the cross-hair goes, the next press drops nothing; with nothing armed it says false', z.a && z.armed === 'server' && z.d === true && z.after === null && z.again === false && !z.cross && zn === z.n0, JSON.stringify({ ...z, after: zn }));
    const u = await p.evaluate(() => { const n = P().nodes.find(x => x.text === 'Edge Router'), id = n.id, u0 = H.undo.length;
      const ok = TopoForge.setProps(id, { text: 'Edge', data: { what: 'New words', extra: 7 }, w: 120 });
      const mid = { text: N(id).text, what: N(id).data.what, extra: N(id).data.extra, w: N(id).w, undo: H.undo.length - u0, drawn: !!document.querySelector(`#content [data-id="${id}"]`) && document.querySelector('#content').innerHTML.includes('Edge<') };
      const bad = [TopoForge.setProps('no-such-id', { text: 'x' }), TopoForge.setProps(id, { bogus: 1 }), TopoForge.setProps(id, { x: 'a' }), TopoForge.setProps(id, { data: { deep: { no: 1 } } }), TopoForge.setProps(id, {})];
      const still = { text: N(id).text, undo: H.undo.length - u0 };
      TopoForge.undo(); const back = { text: N(id).text, what: N(id).data.what, extra: N(id).data.extra, w: N(id).w };
      return { ok, mid, bad, still, back }; });
    check('U1 setProps(id, patch) changes a shape through the app\'s own edit path: drawn at once, one undo step that puts it all back; an unknown id, an unknown field or a wrong type changes nothing and says false',
      u.ok === true && u.mid.text === 'Edge' && u.mid.what === 'New words' && u.mid.extra === '7' && u.mid.w === 120 && u.mid.undo === 1 && u.mid.drawn && u.bad.every(x => x === false) && u.still.text === 'Edge' && u.still.undo === 1 && u.back.text === 'Edge Router' && u.back.what === 'Where the shop meets the internet.' && u.back.extra === undefined && u.back.w !== 120, JSON.stringify(u));
    await c.close(); }
  // Y: keys for the parent
  { const r = await parentRun(A, A + '/index.html?embed=keys&load=/fixture.json', async (p, fr) => {
      const c = await inFrame(p, { x: 900, y: 650 }); await p.mouse.click(c.x, c.y); await p.waitForTimeout(150);
      for (const k of ['Alt+x', 'F10', 'Control+x', '5', '2']) await p.keyboard.press(k);
      await fr.evaluate(() => { window.ended = TopoForge.endKeys(); });
      await p.keyboard.press('a'); await p.keyboard.press('Control+c'); await p.keyboard.press('Escape'); await p.keyboard.press('b');
      await fr.focus('#palSearch'); await p.keyboard.press('Alt+x');
    }, { after: (p, fr) => fr.evaluate(() => ({ ended: window.ended, search: document.querySelector('#palSearch').value })) });
    const k = msgs(r.got, 'key');
    const want = [['M-x', false], ['<f10>', false], ['C-x', true], ['5', true], ['2', true], ['C-c', true], ['<escape>', false]];
    check('Y1 keys: Alt+x, F10, C-x and C-c pressed in the drawing reach the parent, with the keys of a sequence after them, until endKeys(), C-g or Escape; a plain key outside a sequence, and keys in a text field, stay with the app',
      JSON.stringify(k.map(d => [d.key, d.open])) === JSON.stringify(want) && JSON.stringify(k[4].seq) === '["C-x","5","2"]' && r.extra.ended === true && k.every(d => d.raw && 'code' in d.raw), JSON.stringify({ got: k.map(d => [d.key, d.open, d.seq.join(' ')]), extra: r.extra }));
    // context is on, so the app's 1.9 key listener is there: it is the keys switch, not a missing listener, that keeps the keys
    const off = await parentRun(A, A + '/index.html?embed=select,context&load=/fixture.json', async (p) => { const c = await inFrame(p, { x: 900, y: 650 }); await p.mouse.click(c.x, c.y); await p.keyboard.press('Alt+x'); await p.keyboard.press('Control+x'); await p.keyboard.press('5'); });
    check('Y2 without the keys switch no key is sent to the parent (another 1.9 switch on, so the listener is there)', msgs(off.got, 'key').length === 0 && !off.ownAll.includes('key'), `key messages: ${msgs(off.got, 'key').length}`); }
  // Q: right click, long press and the menu key on a shape
  { let menuSeen = null; const r = await parentRun(A, A + '/index.html?embed=context&load=/fixture.json', async (p, fr) => {
      const s = await inFrame(p, await shapeAt(fr, 'Edge Router')); await p.mouse.click(s.x, s.y, { button: 'right' }); await p.waitForTimeout(200);
      menuSeen = await fr.evaluate(() => !!document.querySelector('.menu .mi'));
      await p.keyboard.press('Escape');
      const empty = await inFrame(p, { x: 900, y: 650 }); await p.mouse.click(empty.x, empty.y, { button: 'right' }); await p.keyboard.press('Escape');
      await fr.evaluate(() => { const n = P().nodes.find(x => x.text === 'Core Switch'); TopoForge.select([n.id]); svgEl().focus(); }); await p.keyboard.press('Shift+F10'); await p.waitForTimeout(150);
    }, { after: async () => ({ menu: menuSeen }) });
    const q = msgs(r.got, 'context');
    const rc = q.find(d => d.via === 'contextmenu'), kb = q.find(d => d.via === 'keyboard');
    check('Q1 context: a right click on a shape tells the parent its ref, name and the point (the app\'s own menu still opens); a right click on the empty drawing tells nothing; Shift+F10 on a selected shape tells it too',
      q.length === 2 && rc && /^router-/.test(rc.ref) && rc.name === 'Edge Router' && rc.x > 0 && rc.y > 0 && rc.rect && rc.rect.w > 0 && r.extra.menu === true && kb && kb.name === 'Core Switch' && kb.x > 0, JSON.stringify({ q, menu: r.extra.menu }));
    const lp = await parentRun(A, A + '/index.html?embed=context&load=/fixture.json', async (p, fr) => {
      const s = await inFrame(p, await shapeAt(fr, 'Core Switch')); const cdp = await p.context().newCDPSession(p);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: s.x, y: s.y }] }); await p.waitForTimeout(800);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(300);
    }, { touch: true });
    const l = msgs(lp.got, 'context');
    check('Q2 a long press (touch, held still) on a shape tells the parent once, via longpress, and selects it', l.length === 1 && l[0].via === 'longpress' && l[0].name === 'Core Switch', JSON.stringify(l)); }
  // G: the page list
  { const r = await parentRun(A, A + '/index.html?embed=pagelist&load=/fixture.json', async (p, fr) => {
      await fr.click('#pagetabs .ptab.add'); await p.waitForTimeout(150);
      await fr.dblclick('#pagetabs .ptab.active'); await fr.fill('#pagetabs .ptab input', 'Renamed page'); await fr.press('#pagetabs .ptab input', 'Enter'); await p.waitForTimeout(150);
      await fr.evaluate(() => TopoForge.showPage(0)); await p.waitForTimeout(150);
      await fr.evaluate(() => { TopoForge.undo(); TopoForge.undo(); }); await p.waitForTimeout(200);
    });
    const g = msgs(r.got, 'pages');
    check('G1 pagelist: the drawing ?load= opens (replaced), adding a page, renaming one and removing one (here by undo) each send topoforge:pages with the new list; showing another page sends none',
      JSON.stringify(g.map(d => d.change)) === '["replaced","added","renamed","renamed","removed"]' && g[0].pages.join('|') === 'First page|Second page' && g[1].added[0] === 'Page-3' && g[2].added[0] === 'Renamed page' && g[4].pages.join('|') === 'First page|Second page', JSON.stringify(g.map(d => [d.change, d.added, d.removed, d.pages.length]))); }
  // W1: 'all' and 'bare' mean what they meant in 1.8
  { const { c, p } = await open(A + '/index.html?embed=all,bare');
    const w = await p.evaluate(() => TopoForge.embed());
    const nu = ['view', 'keys', 'context', 'pagelist', 'map', 'preview', 'mapwheel', 'mappad', 'reset', 'bigcard', 'cardpad', 'peek'];
    check('W1 ?embed=all and bare turn on none of the 1.9 to 1.13 switches (view, keys, context, pagelist, map, preview, mapwheel, mappad, reset, bigcard, cardpad, peek); they still mean what they meant in 1.8', nu.every(k => w[k] === false) && w.frameless && w.props && w.select && w['hide-pages'], JSON.stringify(w));
    await c.close(); }
  // E8: the new messages never reach a parent of another origin
  { const r = await parentRun(B, A + '/index.html?embed=view,pagelist,keys,context&load=/fixture.json', async (p, fr) => {
      await fr.evaluate(() => TopoForge.setView({ k: 0.6 })); await p.waitForTimeout(150);
      const s = await inFrame(p, await shapeAt(fr, 'Edge Router')); await p.mouse.click(s.x, s.y, { button: 'right' }); await p.keyboard.press('Escape');
      await fr.click('#pagetabs .ptab.add');
      const c = await inFrame(p, { x: 900, y: 650 }); await p.mouse.click(c.x, c.y); await p.keyboard.press('Alt+x');
    });
    check('E8 view, pages, context and key messages never reach a parent of another origin, though each fired inside the app', r.got.length === 0 && ['view', 'pages', 'context', 'key'].every(t => r.ownAll.includes(t)), `parent got ${r.got.length}; inside: ${[...new Set(r.ownAll)].join(',')}`); }

  // ======== 1.9 (B): the overview map moved and resized by handles outside its frame; a preview in it ========
  { const { c, p } = await open(A + '/index.html?embed=map&load=/fixture.json');
    const look = () => p.evaluate(() => { const r = e => { const b = e.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height), r: Math.round(b.right), b: Math.round(b.bottom) }; };
      const m = document.querySelector('#minimap'), hs = [...document.querySelectorAll('#mmwrap .mm-h')];
      return { inWrap: m.parentNode.id === 'mmwrap', map: r(m), stage: r(document.querySelector('#stage')), handles: hs.map(r), op: getComputedStyle(document.querySelector('#mmwrap .mm-handles')).opacity, focus: document.activeElement.className }; });
    at = 'N1'; await p.mouse.move(200, 200); await p.waitForTimeout(80); const far = await look();
    const outside = far.handles.every(h => h.b <= far.map.y || h.y >= far.map.b || h.r <= far.map.x || h.x >= far.map.r);
    await p.mouse.move(far.map.r + 25, far.map.y + 40); await p.waitForTimeout(80); const near = await look();
    const g0 = far.handles[1]; await p.mouse.move(g0.x + 10, g0.y + 8); await p.waitForTimeout(80); const onIt = await look();
    check('N1 ?embed=map: the overview map moves into its own frame; its handles sit outside that frame, hidden while the pointer is far, shown when it comes within reach and while it is on them',
      far.inWrap && far.handles.length === 4 && outside && far.op === '0' && near.op === '1' && onIt.op === '1', JSON.stringify({ map: far.map, handles: far.handles, far: far.op, near: near.op, onIt: onIt.op }));
    await p.mouse.move(200, 200); await p.evaluate(() => document.body.focus());
    let n = 0, hit = null; for (; n < 140 && !hit; n++) { await p.keyboard.press('Tab'); hit = await p.evaluate(() => document.activeElement.closest('#mmwrap') ? document.activeElement.className : null); }
    const kf = await look();
    check('N2 the handles are reachable by Tab, and shown while one has the focus though the pointer is far (not a hover-only control)', !!hit && kf.op === '1', JSON.stringify({ tabs: n, hit, op: kf.op }));
    // keys and dragging: move and resize
    at = 'N3'; await p.focus('#mmwrap .mm-grip'); const a0 = await look(); await p.keyboard.press('ArrowLeft'); await p.keyboard.press('Shift+ArrowUp'); const a1 = await look();
    await p.focus('#mmwrap .mm-size'); await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowUp'); const a2 = await look();
    const gb = a2.handles[1]; await p.mouse.move(gb.x + 10, gb.y + 8); await p.mouse.down(); await p.mouse.move(gb.x - 90, gb.y - 32, { steps: 6 }); await p.mouse.up(); const a3 = await look();
    const sb = a3.handles[0]; await p.mouse.move(sb.x + 8, sb.y + 8); await p.mouse.down(); await p.mouse.move(sb.x - 52, sb.y - 22, { steps: 6 }); await p.mouse.up(); const a4 = await look();
    check('N3 the grip moves the map (arrow keys 16 pixels, 64 with Shift, or a drag); the resize handle makes it bigger (arrow keys, or a drag), keeping its right and bottom edges',
      a1.map.x === a0.map.x - 16 && a1.map.y === a0.map.y - 64 && a2.map.w === a1.map.w + 16 && a2.map.h === a1.map.h + 16 && a2.map.r === a1.map.r && a2.map.b === a1.map.b &&
      a3.map.x === a2.map.x - 100 && a3.map.y === a2.map.y - 40 && a3.map.w === a2.map.w && a4.map.w === a3.map.w + 60 && a4.map.h === a3.map.h + 30 && a4.map.r === a3.map.r && a4.map.b === a3.map.b,
      JSON.stringify([a0.map, a1.map, a2.map, a3.map, a4.map]));
    await p.reload(); await p.waitForFunction(() => window.TopoForge && document.querySelector('#mmwrap')); await p.waitForTimeout(500); const a5 = await look();
    const kept = await p.evaluate(() => (JSON.parse(localStorage.getItem('topoforge.ui.v1')) || {}).minimap);
    check('N5 the map\'s place and size are kept in this browser across a reload', a5.map.x === a4.map.x && a5.map.y === a4.map.y && a5.map.w === a4.map.w && a5.map.h === a4.map.h && kept && kept.w === a4.map.w, JSON.stringify({ a5: a5.map, kept }));
    // the Position menu, one pointer, no drag (WCAG 2.5.7)
    at = 'N4'; const menu = async label => { await p.click('#mmwrap .mm-pos'); await p.click(`.menu .mi:has-text("${label}")`); await p.waitForTimeout(60); return look(); };
    const tl = await menu('Top left'), lg = await menu('Larger'), br = await menu('Back to its starting place');
    check('N4 the Position menu places the map with one pointer and no drag: Top left, Larger, Back to its starting place (190 by 130 at the bottom right)',
      tl.map.x === tl.stage.x + 12 && tl.map.y <= tl.stage.y + 34 + 1 && lg.map.w === tl.map.w + 64 && br.map.w === 190 && br.map.h === 130 && br.map.r === br.stage.r - 12 && br.map.b === br.stage.b - 12,
      JSON.stringify({ tl: tl.map, lg: lg.map, br: br.map, stage: br.stage }));
    const off = await p.evaluate(() => { TopoForge.embed({ map: false }); const m = document.querySelector('#minimap'), b = m.getBoundingClientRect(), s = document.querySelector('#stage').getBoundingClientRect();
      return { parent: m.parentNode.id, wrap: getComputedStyle(document.querySelector('#mmwrap')).display, r: Math.round(s.right - b.right), b: Math.round(s.bottom - b.bottom), w: Math.round(b.width), h: Math.round(b.height) }; });
    check('N6 TopoForge.embed({ map: false }) puts the map back where 1.8 has it, and its handles go', off.parent === 'stage' && off.wrap === 'none' && off.r === 12 && off.b === 12 && off.w === 190 && off.h === 130, JSON.stringify(off));
    await c.close(); }
  { const { c, p } = await open(A + '/index.html?embed=map&load=/fixture.json', { noStorage: true });
    await p.focus('#mmwrap .mm-grip'); const b0 = await boxOf(p, '#minimap'); await p.keyboard.press('ArrowLeft'); const b1 = await boxOf(p, '#minimap');
    const said = await p.evaluate(() => (document.querySelector('#flLive') || {}).textContent || '');
    check('N7 with storage refused the map still moves, and the move is said to a screen reader', b1.x === b0.x - 16 && /^Overview map: /.test(said), JSON.stringify([b0, b1, said])); await c.close(); }
  { const { c, p } = await open(A + '/index.html?embed=map&load=/fixture.json', { touch: true });   // a touch screen: (hover: none)
    const hn = await p.evaluate(() => ({ hoverNone: matchMedia('(hover: none)').matches, op: getComputedStyle(document.querySelector('#mmwrap .mm-handles')).opacity }));
    check('N8 where there is no hover (a touch screen), the handles are always shown', hn.hoverNone && hn.op === '1', JSON.stringify(hn)); await c.close(); }
  { const { c, p } = await open(A + '/index.html?embed=props,map&load=/fixture.json');
    const r = await p.evaluate(() => { const s = document.querySelector('#side').getBoundingClientRect(), h = document.querySelector('#mmwrap .mm-handles').getBoundingClientRect(), m = document.querySelector('#minimap').getBoundingClientRect(); return { side: Math.round(s.bottom), handles: Math.round(h.top), share: s.left < m.right && s.right > m.left }; });
    check('N9 floating Properties stops above the map and its handles when they share a column', r.share && r.side <= r.handles, JSON.stringify(r)); await c.close(); }
  // H: the preview
  { const { c, p } = await open(A + '/index.html?embed=preview&load=/fixture.json');
    await p.waitForTimeout(300);
    const h = await p.evaluate(() => { TopoForge.mapMode('rings', { mapCaption: true });   /* 1.9's look, kept as an option in 1.10 */ const ref = P().nodes.find(x => x.text === 'Edge Router').data.tf_ref || TopoForge.story.ensureRefs && '';
      const r1 = TopoForge.preview([P().nodes.find(x => x.text === 'Edge Router').id]);
      const s1 = { rects: document.querySelectorAll('#mmPrev rect').length, cap: document.querySelector('#minimap .mm-cap').textContent, dim: document.querySelector('#mmSvg').classList.contains('mm-dim') };
      const r2 = TopoForge.preview({ category: 'net' }, 'Routers and switches');
      const s2 = { rects: document.querySelectorAll('#mmPrev rect').length, cap: document.querySelector('#minimap .mm-cap').textContent };
      const r3 = TopoForge.preview({ kind: 'firewall' });
      const s3 = { rects: document.querySelectorAll('#mmPrev rect').length, cap: document.querySelector('#minimap .mm-cap').textContent };
      return { r1, s1, r2, s2, r3, s3 }; });
    await p.evaluate(() => { TopoForge.preview({ category: 'net' }); edit(() => { P().nodes.push(makeNode('router', 600, 300, { text: 'Second Router' })); }); });
    await p.waitForTimeout(400);
    const after = await p.evaluate(() => ({ rects: document.querySelectorAll('#mmPrev rect').length, cap: document.querySelector('#minimap .mm-cap').textContent }));
    const cl = await p.evaluate(() => { const r = TopoForge.preview(null); return { r, rects: document.querySelectorAll('#mmPrev rect').length, cap: (document.querySelector('#minimap .mm-cap') || {}).hidden, dim: document.querySelector('#mmSvg').classList.contains('mm-dim') }; });
    check('H1 (rings mode with mapCaption: the 1.9 look, kept as an option) preview(ids or refs), preview({ category }) and preview({ kind }) ring the matching shapes in the map, dim the rest, and write a caption there; it holds across a redraw; preview(null) clears it',
      h.r1.count === 1 && h.s1.rects === 1 && h.s1.cap === 'Edge Router' && h.s1.dim && h.r2.count === 2 && h.s2.rects === 2 && h.s2.cap === 'Routers and switches' && h.r3.count === 0 && h.s3.rects === 0 && /not on this page/.test(h.s3.cap) &&
      after.rects === 3 && /3 shapes/.test(after.cap) && cl.r === true && cl.rects === 0 && cl.cap === true && !cl.dim, JSON.stringify({ h, after, cl }));
    await c.close(); }
  { const { c, p } = await open(A + '/index.html?load=/fixture.json');
    const r = await p.evaluate(() => ({ r: TopoForge.preview({ category: 'net' }), rects: document.querySelectorAll('#mmPrev rect').length, cap: !!document.querySelector('.mm-cap') }));
    check('H2 without the preview switch preview() draws nothing and says false', r.r === false && r.rects === 0 && !r.cap, JSON.stringify(r)); await c.close(); }
  { const { c, p } = await open(A + '/index.html?embed=pages,preview&load=/fixture.json');
    const r = await p.evaluate(() => { TopoForge.mapMode('rings', { mapCaption: true }); const x = TopoForge.preview({ category: 'net' }); const cap = document.querySelector('#mapbox #minimap .mm-cap'), b = cap && cap.getBoundingClientRect(), m = document.querySelector('#mapbox #minimap').getBoundingClientRect(); return { n: x.count, inBox: !!cap, inside: !!b && b.top >= m.top && b.bottom <= m.bottom + 1 && b.width > 20 }; });
    check('H3 with the pages box, the preview shows in the map inside it', r.n === 2 && r.inBox && r.inside, JSON.stringify(r)); await c.close(); }

  // ======== 1.9 (C): page tabs that do not fit (everywhere, standalone too: a fix) ========
  { const [w, h] = [1400, 900];
    const a = await open(A + '/v18.html?load=/many.json', { w, h, settle: 1400 }), b = await open(A + '/index.html?load=/many.json', { w, h, settle: 1400 }), a9 = await open(A + '/v17.html?load=/many.json', { w, h, settle: 1400 });
    for (const x of [a, b, a9]) await x.p.waitForFunction(() => !document.querySelector('#toasts .toast'), null, { timeout: 8000 }).catch(() => {});
    const bar = await boxOf(b.p, '#bottombar');
    const [ia, ib] = [await a.p.screenshot(), await b.p.screenshot()];
    const [ta, tb] = [await a.p.screenshot({ clip: { x: 0, y: 0, width: w, height: bar.y } }), await b.p.screenshot({ clip: { x: 0, y: 0, width: w, height: bar.y } })];
    const [ba, bb] = [await a.p.screenshot({ clip: { x: 0, y: bar.y, width: w, height: h - bar.y } }), await b.p.screenshot({ clip: { x: 0, y: bar.y, width: w, height: h - bar.y } })];
    fs.writeFileSync(path.join(outdir, 'overflow-1.8.png'), ia); fs.writeFileSync(path.join(outdir, `overflow-${VER}.png`), ib);
    const i9 = await a9.p.screenshot(); const d9 = await pixelDiff(i9, ib); await a9.c.close();
    check(`S5 standalone, 60 pages, ${w}x${h}: ${VER} draws the same pixels as ${PREV}, the whole window`, d9.size && d9.over <= 8 && d9.n <= d9.total / 1000, `${d9.n} of ${d9.total} differ, ${d9.over} by more than 16`);
    const [dTop, dBar] = [await pixelDiff(ta, tb), await pixelDiff(ba, bb)];
    const sb = await a.p.evaluate(() => { const t = document.querySelector('#pagetabs'); return t.scrollWidth - t.clientWidth; });
    check(`S4 standalone, 60 pages (more tabs than fit), ${w}x${h}: above the bottom bar ${VER} draws the same pixels as 1.8; the bottom bar is what changed, the page-tab fix of 1.9 (in 1.8 the strip was ${sb} pixels wider than its room, left to the browser to scroll)`,
      dTop.size && dTop.over <= 8 && dTop.n <= dTop.total / 1000 && dBar.size && dBar.over > 200, `above: ${dTop.n} of ${dTop.total} differ, ${dTop.over} by more than 16; bottom bar: ${dBar.over} of ${dBar.total} differ by more than 16`);
    const t1 = await b.p.evaluate(() => { const t = document.querySelector('#pagetabs'), tr = t.getBoundingClientRect(), vis = [...t.querySelectorAll('.ptab[data-pi]:not(.add):not([hidden])')];
      return { ovf: getComputedStyle(t).overflowX, bar: t.offsetHeight - t.clientHeight, scrolled: t.scrollLeft, shown: vis.length, n: DOC.pages.length, inside: vis.every(v => { const r = v.getBoundingClientRect(); return r.left >= tr.left - 0.5 && r.right <= tr.right + 0.5; }),
        cur: !!t.querySelector('.ptab.active:not([hidden])'), ctl: [...t.querySelectorAll('.pt-ctl')].map(c => c.textContent.trim()), add: !!t.querySelector('.ptab.add:not([hidden])'), hidden: t.querySelectorAll('.ptab[hidden]').length }; });
    check('T1 with more tabs than fit, the strip shows the tabs that fit, whole, with the current one among them; ‹, › and All are there with +; no scrollbar, nothing scrolled by the browser',
      t1.ovf === 'hidden' && t1.bar === 0 && t1.scrolled === 0 && t1.shown > 2 && t1.shown < t1.n && t1.shown + t1.hidden === t1.n && t1.inside && t1.cur && t1.add && t1.ctl.join('|') === '‹|›|All 60 ▴', JSON.stringify(t1));
    await a.c.close();
    const p = b.p, first = () => p.evaluate(() => +(document.querySelector('#pagetabs .ptab[data-pi]:not(.add):not([hidden])') || {}).dataset?.pi);
    at = 'T2'; const f0 = await first(), pd0 = await p.evaluate(() => document.querySelector('.pt-prev').disabled);
    await p.click('.pt-next'); const f1 = await first(); await p.click('.pt-next'); const f2 = await first(); await p.click('.pt-prev'); const f3 = await first();
    for (let i = 0; i < 70; i++) { if (await p.evaluate(() => document.querySelector('.pt-next').disabled)) break; await p.click('.pt-next'); }
    const endState = await p.evaluate(() => ({ last: !document.querySelector('#pagetabs .ptab[data-pi="59"]').hidden, next: document.querySelector('.pt-next').disabled, focus: document.activeElement.className, cur: DOC.cur }));
    check('T2 › and ‹ move our own window of tabs one tab at a time; ‹ is off at the start, › at the end (the last page then shows); the page shown does not change',
      f0 === 0 && pd0 && f1 === 1 && f2 === 2 && f3 === 1 && endState.last && endState.next && endState.cur === 0, JSON.stringify({ f0, pd0, f1, f2, f3, endState }));
    // keyboard among the tabs: arrows, Home, End move the focus (and our window), not the selected shapes
    at = 'T3'; await p.evaluate(() => { const n = makeNode('server', 0, 0, { text: 'Kept still' }); edit(() => P().nodes.push(n)); TopoForge.select([n.id]); });
    await p.evaluate(() => { PT.start = 0; fitTabs(0); document.querySelector('#pagetabs .ptab[data-pi="0"]').focus(); });
    await p.keyboard.press('ArrowRight'); const k1 = await p.evaluate(() => document.activeElement.dataset.pi);
    await p.keyboard.press('End'); const k2 = await p.evaluate(() => ({ pi: document.activeElement.dataset.pi, shown: !document.activeElement.hidden }));
    await p.keyboard.press('ArrowLeft'); const k3 = await p.evaluate(() => document.activeElement.dataset.pi);
    await p.keyboard.press('Home'); const k4 = await p.evaluate(() => ({ pi: document.activeElement.dataset.pi, shown: !document.activeElement.hidden }));
    await p.keyboard.press('End'); await p.keyboard.press('Enter'); await p.waitForTimeout(200); const k5 = await p.evaluate(() => DOC.cur);
    await p.evaluate(() => TopoForge.showPage(0)); await p.waitForTimeout(150);
    const still = await p.evaluate(() => { const n = P().nodes.find(x => x.text === 'Kept still'); return n ? [n.x, n.y] : null; });
    check('T3 in the page tabs, ← and → move the focus one tab, Home and End to the first and the last (our window follows), Enter shows that page; the selected shape does not move',
      k1 === '1' && k2.pi === '59' && k2.shown && k3 === '58' && k4.pi === '0' && k4.shown && k5 === 59 && still && still[0] === 0 && still[1] === 0, JSON.stringify({ k1, k2, k3, k4, k5, still }));
    // All: the fly-up list, with a filter, by keyboard alone
    at = 'T4'; await p.focus('.pt-all'); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
    const fly = await p.evaluate(() => { const m = document.querySelector('#ptFly'), b = document.querySelector('.pt-all').getBoundingClientRect(), r = m && m.getBoundingClientRect();
      return m && { n: m.querySelectorAll('li[data-pi]').length, focus: document.activeElement.getAttribute('aria-label'), up: r.bottom <= b.top + 1, exp: document.querySelector('.pt-all').getAttribute('aria-expanded'), sel: m.querySelector('[aria-selected="true"]').textContent }; });
    await p.keyboard.type('page 4'); const filt = await p.evaluate(() => [...document.querySelectorAll('#ptFly li[data-pi]')].map(l => l.textContent));
    await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await p.waitForTimeout(250);
    const picked = await p.evaluate(() => ({ cur: DOC.cur, name: P().name, open: !!document.querySelector('#ptFly'), focus: document.activeElement.dataset.pi, shown: !document.activeElement.hidden }));
    await p.click('.pt-all'); await p.keyboard.type('zzz'); const none = await p.evaluate(() => document.querySelector('#ptFly li').textContent);
    await p.keyboard.press('Escape'); const esc = await p.evaluate(() => ({ open: !!document.querySelector('#ptFly'), focus: document.activeElement.className }));
    check('T4 All opens a list of every page above the strip, the filter focused; typing narrows it, ↓ and Enter show the page chosen and put the focus on its tab; no match is said; Escape closes it and gives the focus back to All',
      fly && fly.n === 60 && fly.focus === 'Filter pages' && fly.up && fly.exp === 'true' && /^Page 1 /.test(fly.sel) && filt.length === 11 && filt.every(t => /page 4/i.test(t)) &&
      picked.name === filt[1].replace(' (shown now)', '') && !picked.open && picked.focus === String(picked.cur) && picked.shown && none === 'No page matches' && !esc.open && /pt-all/.test(esc.focus),
      JSON.stringify({ fly, filt: filt.length, picked, none, esc }));
    await p.setViewportSize({ width: 1400, height: 900 }); await b.c.close(); }
  { const { c, p } = await open(A + '/index.html?load=/many.json', { w: 1400, h: 900 });
    await p.evaluate(() => { edit(() => { DOC.pages.splice(3); DOC.cur = 0; }); buildPages(); }); await p.waitForTimeout(200);
    const t5 = await p.evaluate(() => ({ ctl: document.querySelectorAll('#pagetabs .pt-ctl').length, hidden: document.querySelectorAll('#pagetabs .ptab[hidden]').length, cls: document.querySelector('#pagetabs').className, ovf: getComputedStyle(document.querySelector('#pagetabs')).overflowX }));
    check('T5 when the tabs fit, the strip is as it was: no ‹, › or All, nothing hidden, the browser\'s own overflow as before', t5.ctl === 0 && t5.hidden === 0 && t5.cls === '' && t5.ovf === 'auto', JSON.stringify(t5));
    await c.close(); }
  { const { c, p } = await open(A + '/index.html?embed=pages&load=/many.json', { w: 1400, h: 900 });
    const t6 = await p.evaluate(() => ({ ctl: [...document.querySelectorAll('#mapbox #pagetabs .pt-ctl')].map(x => x.textContent), cur: !!document.querySelector('#mapbox .ptab.active:not([hidden])'), list: !!document.querySelector('#mapbox .mp-list') }));
    check('T6 in the 1.8 pages box the tabs that do not fit get ‹ and ›, and its Pages button stays the list of them all', t6.ctl.join('|') === '‹|›' && t6.cur && t6.list, JSON.stringify(t6));
    await c.close(); }

  // ======== 1.10: the wheel over the map, the map's modes, the card, the drawing's highlight ========
  { const { c, p } = await open(A + '/index.html?embed=map,mapwheel&load=/fixture.json');
    const st = () => p.evaluate(() => { const r = svgEl().getBoundingClientRect(), v = S.view; return { k: v.k, x: v.x, y: v.y, cx: (r.width / 2 - v.x) / v.k, cy: (r.height / 2 - v.y) / v.k, scale: TopoForge.mapScale(), vb: document.querySelector('#mmSvg').getAttribute('viewBox') }; });
    const m = await boxOf(p, '#minimap'); await p.mouse.move(m.x + m.w / 2, m.y + m.h / 2);
    at = 'MW1'; const s0 = await st(); await p.mouse.wheel(0, -200); await p.waitForTimeout(150); const s1 = await st();
    check('MW1 mapwheel: the wheel over the map zooms the drawing, about the middle of the view (the point there stays put)', s1.k > s0.k * 1.2 && Math.abs(s1.cx - s0.cx) < 1 && Math.abs(s1.cy - s0.cy) < 1 && s1.scale === 1, JSON.stringify({ s0, s1 }));
    at = 'MW3'; await p.keyboard.down('Alt'); await p.mouse.wheel(0, -300); await p.keyboard.up('Alt'); await p.waitForTimeout(150); const s2 = await st();
    check('MW3 Alt+wheel over the map changes the map\'s own scale, not the drawing\'s zoom', s2.scale > 1.3 && s2.k === s1.k && s2.vb !== s1.vb && +s2.vb.split(' ')[2] < +s1.vb.split(' ')[2], JSON.stringify({ k: [s1.k, s2.k], scale: s2.scale, vb: [s1.vb, s2.vb] }));
    at = 'MW4'; await p.keyboard.down('Shift'); await p.mouse.wheel(0, 100); await p.keyboard.up('Shift'); await p.waitForTimeout(100); const s3 = await st();
    await p.evaluate(() => document.querySelector('#minimap').dispatchEvent(new WheelEvent('wheel', { deltaX: 100, deltaY: 0, shiftKey: true, bubbles: true, cancelable: true }))); const s4 = await st();
    check('MW4 Shift+wheel moves the view east and west only, whether the wheel arrives as deltaY or (as Shift+wheel often does) as deltaX', Math.abs(s3.x - (s2.x - 100)) < 1 && s3.y === s2.y && Math.abs(s4.x - (s3.x - 100)) < 1 && s4.y === s3.y && s4.k === s2.k, JSON.stringify([s2.x, s3.x, s4.x, s2.y, s4.y]));
    at = 'MW5'; await p.keyboard.down('Alt'); await p.keyboard.down('Shift'); await p.mouse.wheel(0, 100); await p.keyboard.up('Shift'); await p.keyboard.up('Alt'); await p.waitForTimeout(100); const s5 = await st();
    check('MW5 Alt+Shift+wheel moves the view north and south only', Math.abs(s5.y - (s4.y - 100)) < 1 && s5.x === s4.x && s5.k === s4.k, JSON.stringify([s4.y, s5.y, s4.x, s5.x]));
    at = 'MW2'; await p.evaluate(() => TopoForge.embed({ mapwheel: false })); const s6 = await st(); await p.mouse.wheel(0, -200); await p.waitForTimeout(150); const s7 = await st();
    check('MW2 with the mapwheel switch off the wheel over the map changes nothing', s7.k === s6.k && s7.x === s6.x && s7.y === s6.y && s7.scale === s6.scale, JSON.stringify({ s6, s7 }));
    await c.close(); }
  // MM: the modes, the messages, the card, the highlight
  { const r = await parentRun(A, A + '/index.html?embed=preview,map&load=/fixture.json', async (p, fr) => {
      await fr.evaluate(() => { window.r = {}; const id = P().nodes.find(x => x.text === 'Edge Router').id; window.r.def = TopoForge.mapMode();
        window.r.a = TopoForge.mapMode('cards'); window.r.b = TopoForge.mapMode('cards'); window.r.bad = TopoForge.mapMode('nope');
        window.r.p = TopoForge.preview([id], { card: { title: 'The edge', facts: [['Host', 'gw4'], ['Role', 'edge']], statement: 'Where the shop meets the internet.', art: 'matches' } }); });
      await p.waitForTimeout(200);
    }, { after: (p, fr) => fr.evaluate(() => window.r) });
    const mm = msgs(r.got, 'mapmode'), pv = msgs(r.got, 'preview');
    check('MM1 mapMode: both by default; mapMode(\'cards\') sets it and tells the page once (topoforge:mapmode), again changes nothing, a wrong name is false; each preview() tells the page its caption and card (topoforge:preview)',
      r.extra.def.mode === 'both' && r.extra.def.mapCaption === false && r.extra.a.mode === 'cards' && r.extra.bad === false && mm.length === 1 && mm[0].mode === 'cards' && mm[0].mapCaption === false &&
      pv.length === 1 && pv[0].mode === 'cards' && pv[0].caption === 'Edge Router' && pv[0].count === 1 && pv[0].card && pv[0].card.title === 'The edge' && pv[0].card.facts.length === 2, JSON.stringify({ extra: r.extra, mm, pv })); }
  { const { c, p } = await open(A + '/index.html?embed=preview,map&load=/fixture.json');
    const look = () => p.evaluate(() => { const card = document.querySelector('#minimap .mm-card'), cap = document.querySelector('#minimap .mm-cap'), b = document.querySelector('#minimap').getBoundingClientRect();
      return { map: [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)].join(','), card: !!card && !card.hidden, title: card && card.querySelector('.mc-t').textContent, facts: card ? [...card.querySelectorAll('.mc-f div')].map(d => d.textContent) : [], st: card && card.querySelector('.mc-s').textContent, art: !!(card && card.querySelector('.mc-a svg')),
        cap: !!cap && !cap.hidden, rings: document.querySelectorAll('#mmPrev rect').length, hi: document.querySelectorAll('#tfHi rect').length, fade: +getComputedStyle(document.querySelector('#mmSvg')).opacity }; });
    await p.focus('#mmwrap .mm-size'); await p.keyboard.press('Shift+ArrowLeft'); await p.focus('#mmwrap .mm-grip'); await p.keyboard.press('Shift+ArrowUp');   // a place and size of the person's own
    const own = await look();
    at = 'MM2'; const id = await p.evaluate(() => P().nodes.find(x => x.text === 'Edge Router').id);
    await p.evaluate(i => { TopoForge.mapMode('rings'); TopoForge.preview([i]); }, id); const rg = await look();
    await p.evaluate(() => TopoForge.mapMode('rings', { mapCaption: true })); const rc = await look();
    check('MM2 rings: the match is ringed in the map, no card, no highlight in the drawing; the caption is not in the map (it goes to the page) unless mapCaption: true',
      rg.rings === 1 && !rg.card && rg.hi === 0 && !rg.cap && rc.cap, JSON.stringify({ rg, rc }));
    at = 'MM3'; await p.evaluate(i => { TopoForge.mapMode('cards'); TopoForge.preview([i], { card: { title: 'The edge', facts: [['Host', 'gw4'], ['Role', 'edge']], statement: 'Where the shop meets the internet.' } }); }, id); const cd = await look();
    check('MM3 cards: the map shows the page\'s card (title, facts, statement, the shape\'s picture), the map fades behind it, nothing is lit in the drawing; the map keeps the place and size the person gave it through every mode',
      cd.card && cd.title === 'The edge' && cd.facts.join('|') === 'Hostgw4|Roleedge' && cd.st === 'Where the shop meets the internet.' && cd.art && cd.fade < 0.3 && cd.hi === 0 && !cd.cap && [rg.map, rc.map, cd.map].every(m => m === own.map) && own.map.split(',')[2] === '254', JSON.stringify({ cd, maps: [own.map, rg.map, rc.map, cd.map] }));
    at = 'MM4'; await p.evaluate(i => { TopoForge.mapMode('both'); TopoForge.preview([i]); }, id); const bo = await look();
    await p.evaluate(() => TopoForge.preview(null)); const cl = await look();
    check('MM4 both: the match is lit in the drawing itself and the map shows a card the app makes when the page gives none (the name, its facts, what it is); preview(null) clears both and the map no longer fades',
      bo.hi === 1 && bo.card && bo.title === 'Edge Router' && bo.st === 'Where the shop meets the internet.' && bo.facts.some(f => /^On this page1$/.test(f)) && bo.art && bo.rings === 0 && bo.map === cd.map &&
      cl.hi === 0 && !cl.card && cl.fade === 1, JSON.stringify({ bo, cl }));
    at = 'MM5'; const mk = await p.evaluate(i => { TopoForge.preview([i], { card: { title: '<b>bold</b>', facts: [['<i>a</i>', '<img src=x>']], art: '<svg onload=alert(1)>' } }); const c = document.querySelector('#minimap .mm-card'); return { t: c.querySelector('.mc-t').textContent, el: c.querySelectorAll('b, i, img').length, art: c.querySelector('.mc-a').innerHTML.includes('onload') }; }, id);
    check('MM5 the card\'s words are text, never markup from the page; art is only the app\'s own picture', mk.t === '<b>bold</b>' && mk.el === 0 && !mk.art, JSON.stringify(mk));
    at = 'MM6'; await p.click('#mmwrap .mm-mode'); const items = await p.evaluate(() => [...document.querySelectorAll('.menu .mi')].map(b => (b.querySelector('.ck').textContent ? '✓' : '') + b.querySelector('.lb').textContent));
    await p.click('.menu .mi:has-text("Rings")'); const m1 = await p.evaluate(() => TopoForge.mapMode().mode);
    await p.click('#mmwrap .mm-mode'); await p.click('.menu .mi:has-text("Closer")'); const sc = await p.evaluate(() => TopoForge.mapScale());
    check('MM6 the map\'s Mode menu offers the three modes (the current one checked) and the map\'s scale, with one pointer', items.length === 6 && items.some(t => t.startsWith('✓Both')) && m1 === 'rings' && sc === 1.5, JSON.stringify({ items, m1, sc }));
    at = 'MM8'; await p.reload(); await p.waitForFunction(() => window.TopoForge && document.querySelector('#mmwrap')); await p.waitForTimeout(500);
    const kept = await p.evaluate(() => ({ mode: TopoForge.mapMode().mode, scale: TopoForge.mapScale() }));
    check('MM8 the mode and the map\'s scale chosen are kept in this browser across a reload', kept.mode === 'rings' && kept.scale === 1.5, JSON.stringify(kept));
    await c.close(); }
  for (const dark of [false, true]) {
    const { c, p } = await open(A + '/index.html?embed=preview&load=/fixture.json', { dark });
    const k = await p.evaluate(() => { TopoForge.mapMode('both'); TopoForge.preview([P().nodes.find(x => x.text === 'Edge Router').id]);
      const r = document.querySelector('#tfHi rect'), L = h => { const v = hexToRgb(h).map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
      const a = L(r.getAttribute('stroke')), b = L(curPal().paper); return { stroke: r.getAttribute('stroke'), paper: curPal().paper, ratio: Math.round((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) * 100) / 100, motion: getComputedStyle(r).transitionDuration }; });
    check(`MM7 the drawing's highlight has at least 3 to 1 contrast with the drawing's paper (WCAG 1.4.11), ${dark ? 'dark' : 'light'}, and does not move`, k.ratio >= 3 && k.motion === '0s', JSON.stringify(k));
    await c.close();
  }
  { const r = await parentRun(B, A + '/index.html?embed=preview&load=/fixture.json', async (p, fr) => { await fr.evaluate(() => { TopoForge.mapMode('cards'); TopoForge.preview({ category: 'net' }); }); });
    check('E9 topoforge:preview and topoforge:mapmode never reach a parent of another origin', r.got.length === 0, `parent got ${r.got.length}`); }

  // ======== 1.11: the map's pad (mappad) and Reset layout (reset) ========
  { const PDX = {}; const r = await parentRun(A, A + '/index.html?embed=mappad&load=/fixture.json', async (p, fr) => {
      const thumbX = () => fr.evaluate(() => { const t = document.querySelector('#mmPad .mp-thumb').getBoundingClientRect(), s = document.querySelector('#mmPad .mp-sl').getBoundingClientRect(); return Math.round(t.left + t.width / 2 - s.left - document.querySelector('#mmPad .mp-sl').clientLeft); });   // from the slider's inner edge
      const st = () => fr.evaluate(() => { const s = document.querySelector('#mmPad .mp-sl'); return { mode: TopoForge.mapMode().mode, now: s.getAttribute('aria-valuenow'), text: s.getAttribute('aria-valuetext'), scale: TopoForge.mapScale() }; });
      const P0 = await fr.evaluate(() => { const g = document.querySelector('#mmPad'), m = document.querySelector('#minimap').getBoundingClientRect(), b = g.getBoundingClientRect();
        const big = [...g.querySelectorAll('.mp-b')].filter(x => getComputedStyle(x).display !== 'none').every(x => { const r = x.getBoundingClientRect(); return r.width >= 44 && r.height >= 44; });
        return { role: g.getAttribute('role'), label: g.getAttribute('aria-label'), slider: document.querySelector('#mmPad [role=slider]') ? 1 : 0, outside: b.right <= m.left || b.left >= m.right, big, map: TopoForge.embed().map }; });
      PDX.p0 = { ...P0, ...(await st()), x: await thumbX() };
      // the transition is the same smooth glide as the mode changes, and it is there unless reduced motion is asked
      PDX.tr = await fr.evaluate(() => getComputedStyle(document.querySelector('#mmPad .mp-thumb')).transitionDuration);
      await fr.focus('#mmPad .mp-sl'); await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(250); PDX.k1 = { ...(await st()), x: await thumbX() };
      await p.keyboard.press('End'); await p.waitForTimeout(250); PDX.k2 = { ...(await st()), x: await thumbX() };
      await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(250); PDX.k3 = { ...(await st()), x: await thumbX() };
      // a click on a position, then a drag of the thumb
      const fb = await (await p.$('#f')).boundingBox(), sb = await fr.evaluate(() => { const b = document.querySelector('#mmPad .mp-sl').getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
      await p.mouse.click(fb.x + sb.x + sb.w - 22, fb.y + sb.y + 30); await p.waitForTimeout(250); PDX.c1 = await st();
      await p.mouse.move(fb.x + sb.x + sb.w - 22, fb.y + sb.y + 16); await p.mouse.down(); await p.mouse.move(fb.x + sb.x + 30, fb.y + sb.y + 16, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(250); PDX.d1 = await st();
      // the Mode menu and the pad stay in step, both ways
      await fr.evaluate(() => TopoForge.mapMode('both')); PDX.m1 = await st();
      await fr.click('#mmwrap .mm-mode'); PDX.menu = await fr.evaluate(() => [...document.querySelectorAll('.menu .mi')].filter(b => b.querySelector('.ck').textContent).map(b => b.querySelector('.lb').textContent)); await p.keyboard.press('Escape');
      // the vertical arm: up Closer, down Farther; the thumb's press (and Enter) is the whole drawing
      // (pressed from script, so a disabled button is a press that does nothing, not a step that waits and throws)
      await fr.evaluate(() => document.querySelector('#mmPad .mp-up').click()); PDX.u1 = await st(); await fr.evaluate(() => document.querySelector('#mmPad .mp-up').click()); PDX.u2 = await st();
      await fr.evaluate(() => document.querySelector('#mmPad .mp-dn').click()); PDX.u3 = await st();
      await fr.click('#mmPad .mp-thumb'); PDX.u4 = await st();
      await fr.evaluate(() => document.querySelector('#mmPad .mp-up').click()); await fr.focus('#mmPad .mp-sl'); await p.keyboard.press('Enter'); PDX.u5 = await st();
      PDX.names = await fr.evaluate(() => ['.mp-up', '.mp-dn', '.mp-grip'].map(s => document.querySelector('#mmPad ' + s).getAttribute('aria-label')));
    }, { after: async () => PDX });
    const d = r.extra, mm = msgs(r.got, 'mapmode'), ms = msgs(r.got, 'mapscale');
    check('PD1 mappad: a pad of buttons (role group, named) hangs outside the map\'s frame and turns map on; its horizontal bar is a drawn slider (role slider) whose thumb starts at the centre, Both; every button is at least 44 by 44',
      d.p0.role === 'group' && d.p0.label === 'Overview map pad' && d.p0.slider === 1 && d.p0.outside && d.p0.big && d.p0.map === true && d.p0.mode === 'both' && d.p0.now === '1' && d.p0.x === 66 && d.tr !== '0s', JSON.stringify({ p0: d.p0, tr: d.tr }));
    check('PD2 the slider by keyboard: ← to the left (Preview shapes, cards), End to the right (Highlight matches, rings), ← back to the centre; the thumb glides to each stop and aria-valuetext says the mode in words',
      d.k1.mode === 'cards' && d.k1.x === 22 && /^Preview shapes/.test(d.k1.text) && d.k2.mode === 'rings' && d.k2.x === 110 && /^Highlight matches/.test(d.k2.text) && d.k3.mode === 'both' && d.k3.x === 66 && /^Both/.test(d.k3.text), JSON.stringify([d.k1, d.k2, d.k3]));
    check('PD3 a click on a stop, or dragging the thumb, moves the slider and sets the mode; each change is told to the page (topoforge:mapmode)',
      d.c1.mode === 'rings' && d.d1.mode === 'cards' && mm.map(x => x.mode).join(',') === 'cards,rings,both,rings,cards,both', JSON.stringify({ c1: d.c1, d1: d.d1, mm: mm.map(x => x.mode) }));
    check('PD4 the Mode menu and the pad stay in step: mapMode() moves the thumb, and the menu checks what the pad set', d.m1.now === '1' && d.menu.some(t => /^Both/.test(t)), JSON.stringify({ m1: d.m1, menu: d.menu }));
    check('PD5 the vertical arm sets the map\'s scale: up Closer (1.5, then 2.25), down Farther (1.5); a press on the thumb or Enter on the slider is The whole drawing (1); each change is told (topoforge:mapscale); the arm\'s buttons have names',
      d.u1.scale === 1.5 && d.u2.scale === 2.25 && d.u3.scale === 1.5 && d.u4.scale === 1 && d.u4.mode === 'both' && d.u5.scale === 1 && ms.map(x => x.scale).join(',') === '1.5,2.25,1.5,1,1.5,1' && d.names.join('|') === 'Overview map closer|Overview map farther|Move the overview map: drag, or the arrow keys (Shift goes further)',
      JSON.stringify({ u: [d.u1, d.u2, d.u3, d.u4, d.u5].map(x => x.scale), ms: ms.map(x => x.scale), names: d.names })); }
  { const { c, p } = await open(A + '/index.html?embed=mappad&load=/fixture.json');
    at = 'PD6'; const m0 = await boxOf(p, '#minimap'), g0 = await boxOf(p, '#mmPad');
    await p.focus('#mmPad .mp-grip'); await p.keyboard.press('Shift+ArrowUp'); const m1 = await boxOf(p, '#minimap'), g1 = await boxOf(p, '#mmPad');
    const gb = await boxOf(p, '#mmPad .mp-grip'); await p.mouse.move(gb.x + 20, gb.y + 20); await p.mouse.down(); await p.mouse.move(gb.x - 80, gb.y - 20, { steps: 6 }); await p.mouse.up(); const m2 = await boxOf(p, '#minimap'), g2 = await boxOf(p, '#mmPad');
    await p.evaluate(() => TopoForge.mapMode('cards')); const m3 = await boxOf(p, '#minimap');
    check('PD6 the pad\'s grip moves the map (arrow keys, or a drag) and the pad moves with it; the mode never moves or resizes the map',
      m1.y === m0.y - 64 && g1.y === g0.y - 64 && m2.x === m1.x - 100 && g2.x === g1.x - 100 && m2.y === m1.y - 40 && JSON.stringify(m3) === JSON.stringify(m2), JSON.stringify({ m0, m1, m2, m3, g0, g2 }));
    at = 'PD7'; const pan = await p.evaluate(() => { const a = TopoForge.padArrows(), b = TopoForge.padArrows('pan'), bad = TopoForge.padArrows('sideways'), v0 = { ...S.view };
      const sl = getComputedStyle(document.querySelector('#mmPad .mp-sl')).display, w = getComputedStyle(document.querySelector('#mmPad .mp-w')).display;
      document.querySelector('#mmPad .mp-up').click(); const v1 = { ...S.view }; document.querySelector('#mmPad .mp-e').click(); const v2 = { ...S.view };
      document.querySelector('#mmPad .mp-dn').click(); document.querySelector('#mmPad .mp-w').click(); const v3 = { ...S.view }; const sc = TopoForge.mapScale();
      const names = ['.mp-up', '.mp-dn', '.mp-w', '.mp-e', '.mp-c'].map(s => document.querySelector('#mmPad ' + s).getAttribute('aria-label'));
      TopoForge.padArrows('mode-scale'); return { a, b, bad, sl, w, v0, v1, v2, v3, sc, names, back: getComputedStyle(document.querySelector('#mmPad .mp-sl')).display }; });
    check('PD7 padArrows(\'pan\') swaps the arms for panning the drawing (north, east, south, west, 64 pixels a press; Fit in the middle), leaves the map\'s scale alone, and padArrows(\'mode-scale\') (the default) brings the slider back',
      pan.a === 'mode-scale' && pan.b === 'pan' && pan.bad === false && pan.sl === 'none' && pan.w === 'flex' && pan.v1.y === pan.v0.y + 64 && pan.v2.x === pan.v1.x - 64 && pan.v3.x === pan.v0.x && pan.v3.y === pan.v0.y && pan.sc === 1 && pan.names.join('|') === 'Pan north|Pan south|Pan west|Pan east|Fit the drawing' && pan.back !== 'none', JSON.stringify(pan));
    await c.close(); }
  for (const dark of [false, true]) {
    const { c, p } = await open(A + '/index.html?embed=mappad&load=/fixture.json', { dark, reduce: true });
    const k = await p.evaluate(() => { const L = h => { const m = h.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
      const ratio = (a, b) => { const x = L(a), y = L(b); return Math.round((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) * 100) / 100; };
      const sl = getComputedStyle(document.querySelector('#mmPad .mp-sl')).backgroundColor, th = getComputedStyle(document.querySelector('#mmPad .mp-thumb')), tr = getComputedStyle(document.querySelector('#mmPad .mp-track')).backgroundColor, lab = getComputedStyle(document.querySelector('#mmPad .mp-lab')).color;
      return { thumb: ratio(th.backgroundColor, sl), track: ratio(tr, sl), label: ratio(lab, sl), motion: th.transitionDuration }; });
    check(`PD8 the pad, ${dark ? 'dark' : 'light'}: thumb and track at least 3 to 1 against the slider, its words at least 4.5 to 1 (AA); with reduced motion asked the thumb jumps, it does not glide`, k.thumb >= 3 && k.track >= 3 && k.label >= 4.5 && k.motion === '0s', JSON.stringify(k));
    await c.close();
  }
  // RS: Reset layout
  { const RSX = {}; const r = await parentRun(A, A + '/index.html?embed=reset,mappad,props,shapes&load=/fixture.json', async (p, fr) => {
      const doc0 = await fr.evaluate(() => JSON.stringify(TopoForge.doc) + '|' + H.undo.length);
      const look = () => fr.evaluate(() => { const b = s => { const e = document.querySelector(s).getBoundingClientRect(); return [Math.round(e.left), Math.round(e.top), Math.round(e.width), Math.round(e.height)].join(','); };
        return { side: b('#side'), pal: b('#palette'), map: b('#minimap'), pad: b('#mmPad'), sideHidden: document.querySelector('#side').classList.contains('fl-hidden'), mode: TopoForge.mapMode().mode, cap: TopoForge.mapMode().mapCaption, scale: TopoForge.mapScale() }; });
      RSX.start = await look();
      await fr.focus('#side .fl-grip'); await p.keyboard.press('Shift+ArrowLeft'); await fr.focus('#palette .fl-grip'); await p.keyboard.press('Shift+ArrowDown');
      await fr.click('#side .fl-bar [data-act=hide]');
      await fr.focus('#mmwrap .mm-size'); await p.keyboard.press('Shift+ArrowLeft'); await fr.focus('#mmPad .mp-grip'); await p.keyboard.press('Shift+ArrowUp');
      await fr.evaluate(() => { TopoForge.mapScale(3); TopoForge.mapMode('rings', { mapCaption: true }); });
      RSX.moved = await look();
      await fr.click('#mmwrap .mm-mode'); RSX.menu = await fr.evaluate(() => [...document.querySelectorAll('.menu .mi .lb')].map(x => x.textContent)); await fr.click('.menu .mi:has-text("Reset layout")'); await p.waitForTimeout(150);
      RSX.after = await look(); RSX.doc = (await fr.evaluate(() => JSON.stringify(TopoForge.doc) + '|' + H.undo.length)) === doc0;
      RSX.kept = await fr.evaluate(() => { const o = JSON.parse(localStorage.getItem('topoforge.ui.v1')); return { mm: o.minimap, mode: o.mapMode, scale: o.mapScale, props: o.props }; });
      await fr.click('.menu-btn[data-menu="view"]'); RSX.view = await fr.evaluate(() => [...document.querySelectorAll('.menu .mi .lb')].map(x => x.textContent)); await fr.click('.menu .mi:has-text("Undo reset")'); await p.waitForTimeout(150);
      RSX.undone = await look(); RSX.again = await fr.evaluate(() => TopoForge.undoReset());
    }, { after: async () => RSX });
    const x = r.extra, rs = msgs(r.got, 'reset');
    check('RS1 Reset layout (in the Mode menu with the reset switch) puts every part back where it started: both panels (and shown), the map\'s place and size, its scale (1) and its mode (both), and the pad with the map',
      x.menu.includes('Reset layout') && JSON.stringify(x.after) === JSON.stringify(x.start) && x.moved.side !== x.start.side && x.moved.pal !== x.start.pal && x.moved.map !== x.start.map && x.moved.sideHidden && x.moved.scale === 3 && x.moved.mode === 'rings',
      JSON.stringify({ start: x.start, moved: x.moved, after: x.after, menu: x.menu }));
    check('RS2 the reset touches nothing in the drawing (the document and the undo history are byte for byte the same) and keeps the first placement in this browser', x.doc && x.kept.mm && x.kept.mm.w === 190 && x.kept.mode.mode === 'both' && x.kept.scale === 1 && x.kept.props.dx === null && x.kept.props.hidden === false, JSON.stringify({ doc: x.doc, kept: x.kept }));
    check('RS3 View offers Reset layout and, after one, Undo reset, which puts back exactly what the reset changed (one level: a second undo says false); the page is told each time (topoforge:reset)',
      x.view.includes('Reset layout') && x.view.includes('Undo reset') && JSON.stringify(x.undone) === JSON.stringify(x.moved) && x.again === false && rs.length === 2 && rs[0].parts.join(',') === 'panels,minimap,mapScale,mapMode,pad' && rs[0].undo === true && rs[1].undone === true,
      JSON.stringify({ view: x.view, undone: x.undone, rs })); }
  { const { c, p } = await open(A + '/index.html?embed=mappad&load=/fixture.json');
    const r = await p.evaluate(async () => { const v = MENUS.view().map(i => i.label).filter(Boolean), m = TopoForge.commands().some(c => c.label === 'Reset layout' || c.label === 'Undo reset'); TopoForge.mapScale(2); const out = TopoForge.resetLayout(); return { v: v.includes('Reset layout'), m, scale: TopoForge.mapScale(), parts: out.parts.length }; });
    const got = await p.evaluate(() => (document.querySelector('#flLive') || {}).textContent);
    check('RS4 without the reset switch the menus offer no Reset layout, but TopoForge.resetLayout() still works when a page calls it, and it is said to a screen reader', !r.v && !r.m && r.scale === 1 && r.parts === 5 && /^Layout reset/.test(got), JSON.stringify({ r, got })); await c.close(); }
  { const r = await parentRun(B, A + '/index.html?embed=mappad,reset&load=/fixture.json', async (p, fr) => { await fr.evaluate(() => { TopoForge.mapMode('cards'); TopoForge.mapScale(2); TopoForge.resetLayout(); }); });
    check('E10 topoforge:mapscale, topoforge:mapmode and topoforge:reset never reach a parent of another origin', r.got.length === 0, `parent got ${r.got.length}`); }

  // ======== 1.12: the card that fills the map (bigcard), and the pad that pages it (cardpad) ========
  // read in the page with the kit's own code, not the app's: how big the words are, and what of the card is cut or outside it
  const CARD_READ = `(() => {
    const m = document.querySelector('#minimap'), el = m.querySelector('.mm-card'), R = e => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, r: b.right, b: b.bottom }; };
    const mb = R(m); if (!el || el.hidden || getComputedStyle(m).display === 'none') return { shown: false, map: mb };
    const cb = R(el), px = s => { const e = el.querySelector(s); return e ? parseFloat(getComputedStyle(e).fontSize) : 0; };
    const cut = () => { const out = [];
      for (const e of el.querySelectorAll('.mc-x, .mc-t, .mc-n, .mc-f, .mc-f dt, .mc-f dd, .mc-s')) { if (e.closest('[hidden]') || !e.getClientRects().length) continue;
        const b = R(e); if (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1 || b.x < cb.x - 1 || b.r > cb.r + 1 || b.y < cb.y - 1 || b.b > cb.b + 1) out.push(e.className || e.tagName); }
      return out; };
    const k = +getComputedStyle(el).getPropertyValue('--mck'), cut0 = cut();
    el.style.setProperty('--mck', String(k + 0.03)); const cutUp = cut(); el.style.setProperty('--mck', String(k));
    const a = el.querySelector('.mc-a'), ab = R(a), shownA = getComputedStyle(a).display !== 'none';
    const facts = [...el.querySelectorAll('.mc-f>div')].map(d => { const t = d.querySelector('dt'), v = d.querySelector('dd'), tb = R(t), vb = R(v); return { t: t.textContent, v: v.textContent, hidden: d.hidden, over: tb.b <= vb.y + 1, line: Math.abs((tb.y + tb.b) / 2 - (vb.y + vb.b) / 2) < 3 }; });
    return { shown: true, big: el.classList.contains('mc-big'), cls: el.className, map: mb, card: cb, k, cut0, cutUp, title: el.querySelector('.mc-t').textContent, pager: (el.querySelector('.mc-n') || {}).textContent || '', st: el.querySelector('.mc-s').textContent,
      fonts: { t: px('.mc-t'), dt: px('.mc-f dt'), dd: px('.mc-f dd'), s: px('.mc-s') }, art: shownA ? { w: ab.w, h: ab.h, share: ab.w * ab.h / (cb.w * cb.h), svg: a.querySelector(':scope>svg') ? a.querySelector(':scope>svg').outerHTML : '', inner: a.querySelectorAll(':scope>svg>svg').length, img: a.querySelector('img') ? { src: a.querySelector('img').getAttribute('src'), alt: a.querySelector('img').alt, ok: a.querySelector('img').complete && a.querySelector('img').naturalWidth > 0 } : null, hidden: a.getAttribute('aria-hidden') } : null,
      facts, hi: document.querySelectorAll('#tfHi rect').length, live: (document.querySelector('#flLive') || {}).textContent || '' };
  })()`;
  const cardRead = p => p.evaluate(CARD_READ);
  const iconOf = (p, kind) => p.evaluate(k => { const t = document.createElement('div'); t.innerHTML = TopoForge.shapes().flatMap(c => c.shapes).find(s => s.id === k).icon; return t.firstElementChild.outerHTML; }, kind);
  const idOf = (p, name) => p.evaluate(n => P().nodes.find(x => x.text === n).id, name);
  const fitted = c => c.shown && c.big && c.k >= 1 && c.cut0.length === 0 && (c.k >= 4 || c.cutUp.length > 0) && c.fonts.t >= 12.5 && c.fonts.dt >= 11 && c.fonts.dd >= 11 && (!c.st || c.fonts.s >= 11);
  { const { c, p } = await open(A + '/index.html?embed=bigcard&load=/rich.json');
    at = 'BC1'; const sw = await p.evaluate(() => TopoForge.embed());
    const r0 = await p.evaluate(i => TopoForge.preview([i]), await idOf(p, 'Edge Router')); const c0 = await cardRead(p);
    check('BC1 bigcard (it turns preview on): the card fills the map, its words as large as fit, found by measuring: at the size chosen nothing is cut, 3 hundredths larger something is (or it is at the ceiling, 4); never smaller than 1.10\'s (title 12.5 px, facts 11 px)',
      sw.bigcard && sw.preview && !sw.map && fitted(c0) && Math.abs(c0.card.w - c0.map.w) <= 2 && Math.abs(c0.card.h - c0.map.h) <= 2 && r0.pages === 1, JSON.stringify({ sw: { bigcard: sw.bigcard, preview: sw.preview }, c0: { ...c0, art: c0.art && { ...c0.art, svg: c0.art.svg.length } } }));
    at = 'BC3'; const icon = await iconOf(p, 'router');
    const r1 = await p.evaluate(() => TopoForge.preview({ category: 'net' })); const c1 = await cardRead(p);
    check('BC3 the art is the shape\'s own picture (the same as shapes() gives), a real share of the card: at least a fifth of it, and more than 1.5 times 1.10\'s 40 pixels each way; several matches show their pictures side by side',
      c0.art && c0.art.svg === icon && c0.art.share >= 0.2 && c0.art.w > 60 && c0.art.h > 60 && c0.art.hidden === 'true' && c1.art && c1.art.inner === 2 && r1.pages === 3, JSON.stringify({ a0: { ...c0.art, svg: c0.art && c0.art.svg.slice(0, 40) }, same: c0.art && c0.art.svg === icon, a1: c1.art && { inner: c1.art.inner, share: c1.art.share } }));
    at = 'BC8'; await p.evaluate(() => TopoForge.preview(null)); await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(250);
    const n0 = await cardRead(p), hid0 = await p.evaluate(() => getComputedStyle(document.querySelector('#minimap')).display);
    await p.evaluate(i => TopoForge.preview([i]), await idOf(p, 'Edge Router')); await p.waitForTimeout(250); const n1 = await cardRead(p);
    const st = await boxOf(p, '#stage'); await p.evaluate(() => TopoForge.preview(null)); const hid1 = await p.evaluate(() => getComputedStyle(document.querySelector('#minimap')).display);
    check('BC8 on a phone-wide screen (390 pixels), where the map is hidden, the map shows while a card does, as a sheet along the drawing\'s foot (8 pixels in), the card fitted in it; with the card gone it is hidden again',
      hid0 === 'none' && fitted(n1) && Math.abs(n1.map.x - (st.x + 8)) <= 1 && Math.abs(n1.map.r - (st.x + st.w - 8)) <= 1 && Math.abs(n1.map.b - (st.y + st.h - 8)) <= 1 && n1.map.h >= 150 && hid1 === 'none',
      JSON.stringify({ hid0, n1: { map: n1.map, k: n1.k, cut0: n1.cut0 }, st, hid1 }));
    await c.close(); }
  { const { c, p } = await open(A + '/index.html?embed=bigcard,map&load=/rich.json');
    at = 'BC2'; await p.evaluate(i => TopoForge.preview([i]), await idOf(p, 'Edge Router')); const a0 = await cardRead(p);
    const sz = await boxOf(p, '#mmwrap .mm-size'); await p.mouse.move(sz.x + sz.w / 2, sz.y + sz.h / 2); await p.mouse.down(); await p.mouse.move(sz.x - 240, sz.y - 150, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(250);
    const a1 = await cardRead(p);
    await p.click('#mmwrap .mm-pos'); await p.click('.menu .mi:has-text("Smaller")'); await p.waitForTimeout(300); const a2 = await cardRead(p);
    await p.evaluate(() => TopoForge.mapScale(2)); await p.waitForTimeout(250); const a3 = await cardRead(p);
    await p.evaluate(i => TopoForge.preview([i], { card: { title: 'Up', facts: [['N', '1']], statement: 'Short.', art: 'none' } }), await idOf(p, 'Edge Router')); await p.evaluate(() => TopoForge.mapScale(1));
    for (let i = 0; i < 3; i++) { await p.focus('#mmwrap .mm-size'); await p.keyboard.press('Shift+ArrowLeft'); await p.keyboard.press('Shift+ArrowUp'); }
    await p.waitForTimeout(300); const a4 = await cardRead(p);
    check('BC2 it fits again when the map changes size: dragging the resize handle larger makes the words larger, Position, Smaller smaller, and the map\'s own scale changes nothing it needs; a short card in a large map stops at the ceiling, 4 times 1.10\'s sizes (a 50-pixel title)',
      [a0, a1, a2, a3].every(fitted) && a1.map.w > a0.map.w + 100 && a1.k > a0.k && a2.k < a1.k && a3.k === a2.k && a4.k === 4 && a4.fonts.t === 50 && a4.cut0.length === 0,
      JSON.stringify([a0, a1, a2, a3, a4].map(x => ({ map: [Math.round(x.map.w), Math.round(x.map.h)], k: x.k, cls: x.cls, cut0: x.cut0, cutUp: (x.cutUp || []).length, t: (x.fonts || {}).t }))));
    at = 'BC5'; await p.evaluate(i => TopoForge.preview([i]), await idOf(p, 'Edge Router')); await p.waitForTimeout(200); const big = await cardRead(p);
    await p.click('#mmwrap .mm-pos'); await p.click('.menu .mi:has-text("Back to its starting place")'); await p.waitForTimeout(350); const small = await cardRead(p);
    const shownF = x => x.facts.filter(f => !f.hidden), hidF = x => x.facts.map(f => f.hidden);
    check('BC5 with room the facts are a box score (each a cell, its label over its value; cells side by side); in the small map they are lines (label and value on one line); nothing shown is cut, and facts that do not fit at 1.10\'s size are left out from the end, not cut',
      /mc-box/.test(big.cls) && shownF(big).length === 6 && shownF(big).every(f => f.over) && fitted(big) && /mc-lines/.test(small.cls) && shownF(small).length >= 1 && shownF(small).every(f => f.line) && fitted(small) &&
      hidF(small).indexOf(true) !== -1 && hidF(small).slice(hidF(small).indexOf(true)).every(Boolean) && shownF(big)[2].t === 'IP address' && shownF(big)[2].v === '203.0.113.1',
      JSON.stringify({ big: { cls: big.cls, k: big.k, facts: big.facts }, small: { cls: small.cls, k: small.k, facts: small.facts, cut0: small.cut0 } }));
    at = 'BC10'; const off = await p.evaluate(() => { TopoForge.embed({ bigcard: false }); const el = document.querySelector('#minimap .mm-card'), a = el.querySelector('.mc-a').getBoundingClientRect(); return { big: el.classList.contains('mc-big'), body: document.body.classList.contains('tf-bigcard'), art: [Math.round(a.width), Math.round(a.height)], preview: TopoForge.embed().preview }; });
    const on = await p.evaluate(() => { TopoForge.embed({ bigcard: true }); return document.querySelector('#minimap .mm-card').classList.contains('mc-big'); });
    check('BC10 TopoForge.embed({ bigcard: false }) puts 1.10\'s card back (its 40-pixel picture), and { bigcard: true } the big one again', !off.big && !off.body && off.art.join() === '40,40' && off.preview && on, JSON.stringify({ off, on }));
    await c.close(); }
  // BC4: a picture the page gives: this origin only, an <img> with alt text; nothing asked of another host
  { const { c, p } = await open(A + '/index.html?embed=bigcard,map&load=/rich.json'); const asked = []; p.on('request', q => asked.push(q.url()));
    at = 'BC4'; const id = await idOf(p, 'Edge Router'), Bp = new URL(B).port;
    for (let i = 0; i < 3; i++) { await p.focus('#mmwrap .mm-size'); await p.keyboard.press('Shift+ArrowLeft'); }
    const show = async art => { await p.evaluate(([i, a]) => TopoForge.preview([i], { card: { title: 'The edge "<b>x</b>"', art: a } }), [id, art]); await p.waitForTimeout(400); return cardRead(p); };
    const own = await show({ src: '/card.png', alt: 'Green square "><b>bold</b>' }), noAlt = await show({ src: A + '/card.png?2' });
    const refused = []; for (const src of [B + '/card.png', '//127.0.0.1:' + Bp + '/card.png', 'data:image/png;base64,iVBORw0KGgo=', 'javascript:alert(1)', 'file:///etc/hosts']) { const x = await show({ src, alt: 'no' }); refused.push(!x.art.img && x.art.svg.length > 0); }
    const gone = await show({ src: '/missing.png', alt: 'Not there' }); await p.waitForTimeout(300); const gone2 = await cardRead(p);
    const marks = await p.evaluate(() => document.querySelectorAll('#minimap .mm-card b').length);
    const off = await p.evaluate(i => { TopoForge.embed({ bigcard: false }); TopoForge.preview([i], { card: { art: { src: '/card.png', alt: 'x' } } }); const r = !!document.querySelector('#minimap .mm-card img'); TopoForge.embed({ bigcard: true }); return r; }, id);
    const other = asked.filter(u => u.includes(':' + Bp + '/')).concat(reqLog.filter(l => l.startsWith(Bp + ' /card')));
    check('BC4 a picture the page gives (art: { src, alt }) is shown in an <img> only from this page\'s own origin, with its alt text (the title when it gives none), and loads; another host, a host-relative //, data:, javascript: and file: are refused (the shape\'s own picture instead) and nothing is asked of another host; a picture that fails gives way to the shape\'s; markup stays text; without bigcard there is no <img>',
      own.art.img && own.art.img.src === A + '/card.png' && own.art.img.alt === 'Green square "><b>bold</b>' && own.art.img.ok && own.art.hidden === null && noAlt.art.img && noAlt.art.img.alt === 'The edge "<b>x</b>"' &&
      refused.every(Boolean) && !gone2.art.img && gone2.art.svg.length > 0 && marks === 0 && other.length === 0 && !off,
      JSON.stringify({ own: own.art.img, noAlt: noAlt.art.img && noAlt.art.img.alt, refused, gone: { img: gone2.art.img, svg: gone2.art.svg.length > 0 }, marks, other, off }));
    await c.close(); }
  // BC6, BC7, BC9: pages, and what the page is told
  { const BX = {}; const r = await parentRun(A, A + '/index.html?embed=bigcard,map&load=/rich.json', async (p, fr) => {
      for (let i = 0; i < 3; i++) { await fr.focus('#mmwrap .mm-size'); await p.keyboard.press('Shift+ArrowLeft'); await p.keyboard.press('Shift+ArrowUp'); }
      BX.r = await fr.evaluate(() => TopoForge.preview({ category: 'net' })); BX.c1 = await cardRead(fr); BX.q1 = await fr.evaluate(() => TopoForge.cardPage());
      BX.n2 = await fr.evaluate(() => TopoForge.cardPage('next')); await p.waitForTimeout(150); BX.c2 = await cardRead(fr); BX.icon = await iconOf(fr, 'router');
      BX.n3 = await fr.evaluate(() => [TopoForge.cardPage('last'), TopoForge.cardPage('next'), TopoForge.cardPage(0), TopoForge.cardPage('sideways'), TopoForge.cardPage('first')]); BX.c3 = await cardRead(fr);
      const sw = await idOf(fr, 'Core Switch'), rt = await idOf(fr, 'Edge Router');
      BX.ord = await fr.evaluate(([a, b]) => { TopoForge.preview([a, b]); TopoForge.cardPage(2); return TopoForge.cardPage().title; }, [sw, rt]);
      BX.cap = await fr.evaluate(() => { const x = TopoForge.preview({ kind: 'server' }); return { pages: x.pages, cover: x.cards[0].facts, last: x.cards[8] && x.cards[8].title }; });
    }, { after: async () => BX });
    const x = r.extra, cp = msgs(r.got, 'cardpage'), pv = msgs(r.got, 'preview');
    check('BC6 several matches are pages: the card 1.10 shows first, then one card for each match (its name, its picture, its own fields), "1 of 3" shown in the card; cardPage(\'next\'), \'previous\', \'first\', \'last\' or a number turn them (anything else, or past the ends, is false); each turn is said in the live region and told to the page (topoforge:cardpage); in both mode the drawing lights all the matches on the first card and only that match on its own; matches named by id keep the page\'s order',
      x.r.pages === 3 && x.c1.pager === '1 of 3' && x.c1.title === 'Network' && x.c1.hi === 2 && x.q1.page === 1 && x.q1.pages === 3 &&
      x.n2.page === 2 && x.c2.title === 'Edge Router' && x.c2.pager === '2 of 3' && x.c2.art.svg === x.icon && x.c2.facts.some(f => f.t === 'Hostname' && f.v === 'gw4') && x.c2.hi === 1 && /^Card 2 of 3: Edge Router\./.test(x.c2.live) &&
      x.n3[0].page === 3 && x.n3[1] === false && x.n3[2] === false && x.n3[3] === false && x.n3[4].page === 1 && x.c3.hi === 2 && x.ord === 'Core Switch' &&
      cp.length >= 4 && cp[0].page === 2 && cp[0].pages === 3 && cp[0].title === 'Edge Router' && cp[0].ids.length === 1,
      JSON.stringify({ pages: x.r.pages, c1: [x.c1.title, x.c1.pager, x.c1.hi], q1: x.q1, n2: x.n2, c2: [x.c2.title, x.c2.pager, x.c2.hi, x.c2.live, x.c2.art.svg === x.icon], n3: x.n3, c3hi: x.c3.hi, ord: x.ord, cp: cp.slice(0, 2) }));
    check('BC7 the pages stop at 9 (house number GREAT): ten servers make the first card and 8 of theirs, and the first card says "As cards: 8 of 10"',
      x.cap.pages === 9 && x.cap.cover.some(f => f[0] === 'As cards' && f[1] === '8 of 10') && x.cap.last === 'Server 8', JSON.stringify(x.cap));
    const pv0 = pv[0] || {};
    const off = await parentRun(A, A + '/index.html?embed=preview,map&load=/rich.json', async (p, fr) => { await fr.evaluate(() => TopoForge.preview({ category: 'net' })); });
    const pvOff = msgs(off.got, 'preview')[0] || {};
    check('BC9 with bigcard, topoforge:preview also carries the page shown, how many, and every card (text only); without it the message is 1.10\'s, field for field',
      pv0.page === 1 && pv0.pages === 3 && Array.isArray(pv0.cards) && pv0.cards.length === 3 && pv0.cards[1].title === 'Edge Router' && Object.keys(pvOff).join() === 'mode,caption,count,other,ids,card',
      JSON.stringify({ with: { page: pv0.page, pages: pv0.pages, n: (pv0.cards || []).length }, without: Object.keys(pvOff) })); }
  // CP: the pad while a card shows
  { const { c: c11, p: p11 } = await open(A + '/v111.html?embed=mappad&load=/rich.json'); const pad11 = await p11.evaluate(() => ({ html: document.querySelector('#mmPad').outerHTML, tf: getComputedStyle(document.querySelector('#mmPad')).transform })); await c11.close();
    const { c, p } = await open(A + '/index.html?embed=cardpad&load=/rich.json');
    const padRead = () => p.evaluate(() => { const g = document.querySelector('#mmPad'), cs = getComputedStyle(g), e = g.querySelector('.mp-e'), es = getComputedStyle(e);
      const L = h => { const m = h.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
      const ratio = (a, b) => { const x = L(a), y = L(b); return Math.round((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) * 100) / 100; };
      const cells = [...g.querySelectorAll('.mp-b, .mp-sl')].filter(b => getComputedStyle(b).display !== 'none').map(b => ({ cls: b.className.replace('mp-b ', ''), name: b.getAttribute('aria-label'), title: b.getAttribute('title'), off: b.getAttribute('aria-disabled') === 'true' }));
      return { html: g.outerHTML, cls: g.className, label: g.getAttribute('aria-label'), tf: cs.transform, tr: cs.transitionDuration, trp: cs.transitionProperty, bg: es.backgroundColor, ink: ratio(es.color, es.backgroundColor), cells, focus: document.activeElement.className, mode: TopoForge.mapMode().mode, scale: TopoForge.mapScale(), page: TopoForge.cardPage(), live: (document.querySelector('#flLive') || {}).textContent || '' }; });
    at = 'CP1'; const sw = await p.evaluate(() => TopoForge.embed()); const p0 = await padRead();
    check('CP1 cardpad turns on bigcard, mappad, map and preview; with no card shown the pad is 1.11\'s pad, the same markup as 1.11 draws',
      sw.cardpad && sw.bigcard && sw.mappad && sw.map && sw.preview && p0.html === pad11.html && p0.tf === pad11.tf, JSON.stringify({ sw: [sw.cardpad, sw.bigcard, sw.mappad, sw.map, sw.preview], same: p0.html === pad11.html, tf: [p0.tf, pad11.tf] }));
    at = 'CP2'; await p.focus('#mmPad .mp-sl'); await p.evaluate(() => TopoForge.preview({ category: 'net' })); await p.waitForTimeout(400); const p1 = await padRead();
    const m = (p1.tf.match(/matrix\(([^)]+)\)/) || [, ''])[1].split(',').map(Number), deg = Math.round(Math.atan2(m[1], m[0]) * 180 / Math.PI);
    check('CP2 while a card shows the pad turns 45 degrees (a brief turn: 0.2 s) and takes the accent colour, its glyphs at least 4.5 to 1 against it; the slider is put away and the focus that was on it goes to Next',
      /mp-cardmode/.test(p1.cls) && deg === 45 && p1.tr === '0.2s' && /transform/.test(p1.trp) && p1.bg !== 'rgb(255, 255, 255)' && p1.ink >= 4.5 && !p1.cells.some(x => /mp-sl/.test(x.cls)) && /mp-e/.test(p1.focus),
      JSON.stringify({ cls: p1.cls, deg, tr: p1.tr, trp: p1.trp, bg: p1.bg, ink: p1.ink, focus: p1.focus }));
    at = 'CP4'; const names = p1.cells.map(x => [x.cls, x.name, x.title === x.name, x.off]);
    check('CP4 every cell of the turned pad says its new job, in its tooltip (title) and its accessible name alike: up the first card, down the last, left the previous, right the next, the centre the card shown (with "1 of 3"); the grip keeps its own; the pad\'s name says it is turned',
      p1.cells.length === 6 && p1.cells.every(x => x.title === x.name && x.name) && /^Overview map pad, turned/.test(p1.label) &&
      /^First card: 1 of 3/.test(p1.cells.find(x => /mp-up/.test(x.cls)).name) && /^Last card: 3 of 3/.test(p1.cells.find(x => /mp-dn/.test(x.cls)).name) && /^Previous card/.test(p1.cells.find(x => /mp-w/.test(x.cls)).name) &&
      /^Next card: 2 of 3/.test(p1.cells.find(x => /mp-e/.test(x.cls)).name) && /^Card 1 of 3: Network/.test(p1.cells.find(x => /mp-c/.test(x.cls)).name) && /^Move the overview map/.test(p1.cells.find(x => /mp-grip/.test(x.cls)).name),
      JSON.stringify({ label: p1.label, names }));
    check('CP5 the turn is said in the app\'s live region', /^Map pad turned: it pages the cards, 1 of 3/.test(p1.live), p1.live);
    at = 'CP3'; const pg = async sel => { await p.mouse.move(900, 700); await p.click('#mmPad ' + sel, { force: true }); await p.waitForTimeout(120); const r = await padRead(); return { page: r.page.page, mode: r.mode, scale: r.scale, live: r.live }; };
    const t1 = await pg('.mp-e'), t2 = await pg('.mp-dn'), t3 = await pg('.mp-up'), t4 = await pg('.mp-w'), t5 = await pg('.mp-e'), t6 = await pg('.mp-w'), t7 = await pg('.mp-c');
    check('CP3 the turned pad\'s arms page the cards: right the next, down the last, up the first, left the previous; an arm with nowhere to go says so and does nothing; the centre says the card again (its facts too); the map\'s mode and scale are not touched',
      [t1, t2, t3, t4, t5, t6, t7].map(t => t.page).join() === '2,3,1,1,2,1,1' && /^Previous card: none/.test(t4.live) && /^Card 1 of 3: Network\. On this page 2/.test(t7.live) && [t1, t2, t3, t4, t5, t6, t7].every(t => t.mode === 'both' && t.scale === 1), JSON.stringify([t1, t2, t3, t4, t5, t6, t7]));
    at = 'CP7'; await p.focus('#mmPad .mp-e'); const kp = [];
    for (const k of ['ArrowRight', 'End', 'Home', 'ArrowLeft', 'ArrowRight']) { await p.keyboard.press(k); kp.push(await p.evaluate(() => TopoForge.cardPage().page)); }
    check('CP7 on the turned pad\'s arms, the keys page too: right and left one card, Home the first, End the last', kp.join() === '2,3,1,1,2', kp.join());
    at = 'CP6'; await p.focus('#mmPad .mp-e'); const un = await p.evaluate(() => { TopoForge.preview(null); const g = document.querySelector('#mmPad'); return { cls: g.className, tr: getComputedStyle(g).transitionDuration }; }); await p.waitForTimeout(450); const p2 = await padRead();
    await p.evaluate(() => TopoForge.preview({ category: 'net' })); await p.waitForTimeout(150); await p.evaluate(() => TopoForge.mapMode('rings')); await p.waitForTimeout(450); const p3 = await padRead();
    await p.focus('#mmPad .mp-sl'); await p.keyboard.press('Home'); const p4 = await padRead();
    check('CP6 when the card goes (cleared, or the mode turned to rings) the pad turns back (a brief turn: 0.2 s) and is then exactly its 1.11 self again: the same markup as 1.11\'s pad (no title, no turn, no colour left behind), the focus back on the slider, and the slider sets the mode again; that is said too',
      un.cls === 'mp-unturn' && un.tr === '0.2s' && p2.html === pad11.html && p2.tf === pad11.tf && /mp-sl/.test(p2.focus) && /^Map pad back/.test(p2.live) && p3.html.replace(/aria-valuenow="2" aria-valuetext="[^"]*"/, '') === pad11.html.replace(/aria-valuenow="1" aria-valuetext="[^"]*"/, '').replace('--tx: 66px', '--tx: 110px') && p4.mode === 'cards',
      JSON.stringify({ un, same: p2.html === pad11.html, tf: p2.tf, focus: p2.focus, live: p2.live, rings: p3.cls, p4: p4.mode }));
    await c.close(); }
  for (const dark of [false, true]) {
    const { c, p } = await open(A + '/index.html?embed=cardpad&load=/rich.json', { dark, reduce: true });
    const k = await p.evaluate(async () => { TopoForge.preview({ category: 'net' }); await new Promise(r => setTimeout(r, 50)); const g = document.querySelector('#mmPad'); const a = getComputedStyle(g).transitionDuration; TopoForge.preview(null); return { on: a, off: getComputedStyle(g).transitionDuration, unturn: g.classList.contains('mp-unturn') }; });
    check(`CP8 with reduced motion asked the pad turns at once, both ways (no transition), ${dark ? 'dark' : 'light'}`, k.on === '0s' && k.off === '0s' && !k.unturn, JSON.stringify(k));
    await c.close();
  }
  { const { c, p } = await open(A + '/index.html?embed=bigcard,mappad&load=/rich.json');
    const r = await p.evaluate(() => { TopoForge.preview({ category: 'net' }); const g = document.querySelector('#mmPad'); document.querySelector('#mmPad .mp-up').click(); return { cls: g.className, pages: TopoForge.cardPage().pages, scale: TopoForge.mapScale(), sl: getComputedStyle(g.querySelector('.mp-sl')).display, title: g.querySelector('.mp-up').getAttribute('title') }; });
    check('CP9 without cardpad (bigcard and mappad on) the pad does not turn while a card shows: it keeps its 1.11 jobs (up is Closer)', r.cls === '' && r.pages === 3 && r.scale === 1.5 && r.sl !== 'none' && r.title === null, JSON.stringify(r)); await c.close(); }
  { const r = await parentRun(B, A + '/index.html?embed=cardpad&load=/rich.json', async (p, fr) => { await fr.evaluate(() => { TopoForge.preview({ category: 'net' }); TopoForge.cardPage('next'); }); });
    check('E11 topoforge:cardpage, and topoforge:preview with its pages, never reach a parent of another origin', r.got.length === 0, `parent got ${r.got.length}`); }

  // ======== 1.13: a peek at a placed shape's card (peek), and the zoom Fit would set (fitScale) ========
  // what the map shows, read with the kit's own code: the card shown or not, its title and pager; the map, the drawing's
  // highlight and the pad as markup, for an exact compare; the peeks and previews the app's own window heard
  const PEEK_READ = `(() => { const m = document.querySelector('#minimap'), el = m.querySelector('.mm-card'), hi = document.querySelector('#tfHi'), pad = document.querySelector('#mmPad');
    const shown = !!el && !el.hidden && getComputedStyle(m).display !== 'none', n = shown && el.querySelector('.mc-n');
    return { shown, title: shown ? el.querySelector('.mc-t').textContent : '', pager: n && !n.hidden ? n.textContent : '', map: m.outerHTML, hi: hi ? hi.outerHTML : '', hiN: document.querySelectorAll('#tfHi rect').length, pad: pad ? pad.outerHTML : '',
      cap: !!m.querySelector('.mm-cap:not([hidden])'), rings: document.querySelectorAll('#mmPrev rect').length, carded: m.classList.contains('mm-carded'), page: TopoForge.cardPage(), peeks: (window.pk || []).slice(), previews: (window.pv || []).length }; })()`;
  const peekRead = p => p.evaluate(PEEK_READ);
  const listenPeek = p => p.evaluate(() => { window.pk = []; window.pv = []; addEventListener('topoforge:peek', e => window.pk.push(e.detail)); addEventListener('topoforge:preview', e => window.pv.push(e.detail)); });
  const worldAt = (p, x, y) => p.evaluate(([x, y]) => { const r = svgEl().getBoundingClientRect(); return { x: r.left + x * S.view.k + S.view.x, y: r.top + y * S.view.k + S.view.y }; }, [x, y]);   // an empty spot: (150, 150) in rich.json
  const names = pk => JSON.stringify(pk.map(x => x.id === null ? null : x.name));
  const mapShot = async p => { const m = await boxOf(p, '#minimap'); return p.screenshot({ clip: { x: m.x, y: m.y, width: m.w, height: m.h } }); };
  const bigger = async p => { for (let i = 0; i < 3; i++) { await p.focus('#mmwrap .mm-size'); await p.keyboard.press('Shift+ArrowLeft'); await p.keyboard.press('Shift+ArrowUp'); } await p.evaluate(() => document.activeElement.blur()); };   // room for the big card, as BC2 gives it
  { const one = async (url) => { const { c, p } = await open(url); await listenPeek(p);
      const s = await shapeAt(p, 'Edge Router'); await p.mouse.move(s.x, s.y); await p.keyboard.down('Shift'); await p.mouse.move(s.x + 3, s.y + 2); await p.waitForTimeout(150);
      const r = { ...(await peekRead(p)), sw: (await p.evaluate(() => TopoForge.embed())).peek, el: await p.evaluate(() => !!document.querySelector('#minimap .mm-card')) };
      await p.keyboard.up('Shift'); await c.close(); return r; };
    at = 'PK1'; const solo = await one(A + '/index.html?load=/rich.json'), other = await one(A + '/index.html?embed=preview,bigcard,map,cardpad&load=/rich.json');
    const { c, p } = await open(A + '/index.html?embed=bigcard,map&load=/rich.json'); await listenPeek(p);
    const on = await p.evaluate(() => TopoForge.embed({ peek: true }).peek);
    const s = await shapeAt(p, 'Edge Router'); await p.mouse.move(s.x, s.y); await p.keyboard.down('Shift'); await p.mouse.move(s.x + 3, s.y + 2); await p.waitForTimeout(150); const shown = await peekRead(p);
    const offNow = await p.evaluate(() => { const sw = TopoForge.embed({ peek: false }).peek, el = document.querySelector('#minimap .mm-card'); return { sw, card: !!el && !el.hidden, pk: window.pk.slice() }; });
    await p.mouse.move(s.x + 6, s.y + 4); await p.waitForTimeout(150); const after = await peekRead(p); await p.keyboard.up('Shift'); await c.close();
    check('PK1 peek is off unless a page asks: opened on its own, and with every other card switch on (preview, bigcard, map, cardpad), Shift over a shape shows no card and tells nothing; TopoForge.embed({ peek: true }) turns it on, and { peek: false } ends a peek that shows, at once (told { id: null })',
      [solo, other].every(x => !x.shown && x.peeks.length === 0 && x.sw === false) && !solo.el && on === true && shown.shown && shown.title === 'Edge Router' && offNow.sw === false && !offNow.card && names(offNow.pk) === '["Edge Router",null]' && !after.shown && after.peeks.length === 2,
      JSON.stringify({ solo: [solo.shown, solo.peeks.length, solo.sw, solo.el], other: [other.shown, other.peeks.length, other.sw], on, shown: [shown.shown, shown.title], offNow, after: [after.shown, after.peeks.length] })); }
  { const { c, p } = await open(A + '/index.html?embed=peek,bigcard,map&load=/rich.json'); await listenPeek(p);
    at = 'PK2'; const sw = await p.evaluate(() => { const off = TopoForge.embed({ bigcard: false, preview: false }); TopoForge.embed({ bigcard: true }); return off; }); await bigger(p);   // asked off, preview stays on while peek is
    const s = await shapeAt(p, 'Core Switch'); await p.evaluate(i => TopoForge.select([i]), s.id);
    await p.mouse.move(s.x, s.y); await p.waitForTimeout(100); const none = await peekRead(p);
    await p.keyboard.down('Shift'); await p.waitForTimeout(200); const c1 = await cardRead(p), r1 = await peekRead(p);
    await p.mouse.down(); await p.waitForTimeout(150); const down = await peekRead(p), selDown = await p.evaluate(() => S.sel.size);   // a Shift-press on the selected shape: out of the selection, no drag
    await p.mouse.up(); await p.waitForTimeout(150); const up = await peekRead(p);
    await p.keyboard.up('Shift'); await p.waitForTimeout(100);
    check('PK2 peek turns preview on (asked off, with bigcard off too, it stays on); with Shift held and the pointer on a shape, the map shows that shape\'s card, its name the title, fitted as bigcard fits a card (one page, no pager); no card without Shift, none while a mouse button is down (a Shift-press that takes the shape out of the selection and starts no drag), and the card again when the button is let go',
      sw.peek && sw.preview && !none.shown && fitted(c1) && c1.title === 'Core Switch' && c1.pager === '' && names(r1.peeks) === '["Core Switch"]' && !down.shown && selDown === 0 && up.shown && up.title === 'Core Switch',
      JSON.stringify({ sw: [sw.peek, sw.preview], none: none.shown, c1: { shown: c1.shown, title: c1.title, k: c1.k, cut0: c1.cut0, pager: c1.pager }, down: [down.shown, selDown], up: [up.shown, up.title], peeks: r1.peeks }));
    at = 'PK3'; const e = await shapeAt(p, 'Edge Router'), v = await shapeAt(p, 'Server 4'); await p.evaluate(() => { window.pk.length = 0; });
    await p.keyboard.down('Shift'); await p.waitForTimeout(100); await p.mouse.move(e.x, e.y); await p.waitForTimeout(150); const s2 = await peekRead(p);
    await p.mouse.move(v.x, v.y); await p.waitForTimeout(150); const s3 = await peekRead(p); await p.keyboard.up('Shift'); await p.waitForTimeout(100);
    check('PK3 moving to another shape with Shift held swaps the card at once: one topoforge:peek for each shape, nothing between',
      s2.title === 'Edge Router' && s3.title === 'Server 4' && names(s3.peeks) === '["Core Switch","Edge Router","Server 4"]', JSON.stringify({ t: [s2.title, s3.title], peeks: names(s3.peeks) }));
    await c.close(); }
  { const { c, p } = await open(A + '/index.html?embed=peek,cardpad&load=/rich.json'); await listenPeek(p); await bigger(p);
    await p.waitForFunction(() => !document.querySelector('#toasts .toast'), null, { timeout: 8000 }).catch(() => {});   // 1.7's toast over the map's corner (PK5 compares its pixels)
    at = 'PK4'; await p.evaluate(() => { TopoForge.preview({ category: 'net' }); TopoForge.cardPage('next'); }); await p.waitForTimeout(500); const before = await peekRead(p);
    const v = await shapeAt(p, 'Server 2'); await p.mouse.move(v.x, v.y); await p.waitForTimeout(150);
    await p.keyboard.down('Shift'); await p.waitForTimeout(200); const during = await peekRead(p);
    await p.keyboard.up('Shift'); await p.waitForTimeout(200); const after = await peekRead(p);
    check('PK4 letting Shift go puts back exactly what the map showed before the peek: the page\'s own preview on the card it was on (2 of 3), the same markup in the map, the same highlight in the drawing; meanwhile the map showed the shape\'s card (cardPage() read it, one page) and lit it, and the pad, turned for the page\'s cards, was left as it was',
      before.shown && before.pager === '2 of 3' && during.shown && during.title === 'Server 2' && during.page.pages === 1 && during.hiN === 1 && during.hi !== before.hi && during.pad === before.pad && during.previews === 1 &&
      after.map === before.map && after.hi === before.hi && after.pad === before.pad && after.page.page === 2 && after.page.pages === 3 && names(after.peeks) === '["Server 2",null]' && after.previews === 1,
      JSON.stringify({ before: [before.title, before.pager, before.hiN], during: [during.title, during.page, during.hiN, during.pad === before.pad, during.previews], same: { map: after.map === before.map, hi: after.hi === before.hi, pad: after.pad === before.pad }, page: after.page, peeks: names(after.peeks) }));
    at = 'PK5'; await p.evaluate(() => { TopoForge.preview(null); window.pk.length = 0; }); await p.mouse.move(5, 300); await p.waitForTimeout(600); const b5 = await peekRead(p), shot0 = await mapShot(p);
    await p.mouse.move(v.x, v.y); await p.keyboard.down('Shift'); await p.waitForTimeout(200); const d5 = await peekRead(p);
    await p.keyboard.up('Shift'); await p.waitForTimeout(200); const a5 = await peekRead(p), shot1 = await mapShot(p); const dd = await pixelDiff(shot0, shot1);
    check('PK5 with nothing in the map before the peek, letting Shift go leaves nothing again: no card, no caption, no rings, nothing lit in the drawing, the map not faded, the same pixels in the map, the pad as it was',
      !b5.shown && d5.shown && d5.title === 'Server 2' && !a5.shown && !a5.cap && a5.rings === 0 && a5.hiN === 0 && !a5.carded && a5.pad === b5.pad && dd.size && dd.n === 0 && names(a5.peeks) === '["Server 2",null]',
      JSON.stringify({ b5: b5.shown, d5: [d5.shown, d5.title], a5: [a5.shown, a5.cap, a5.rings, a5.hiN, a5.carded, a5.pad === b5.pad], diff: dd, peeks: names(a5.peeks) }));
    at = 'PK6'; await p.evaluate(() => { TopoForge.preview({ category: 'net' }); TopoForge.cardPage('last'); }); await p.mouse.move(5, 300); await p.waitForTimeout(500); const b6 = await peekRead(p);
    const e = await shapeAt(p, 'Edge Router'), gap = await worldAt(p, 150, 150), m = await boxOf(p, '#minimap');
    await p.mouse.move(e.x, e.y); await p.keyboard.down('Shift'); await p.waitForTimeout(150); const on1 = await peekRead(p);
    await p.mouse.move(gap.x, gap.y); await p.waitForTimeout(150); const off1 = await peekRead(p);   // onto the empty drawing, Shift still held
    await p.mouse.move(e.x, e.y); await p.waitForTimeout(150); const on2 = await peekRead(p);
    await p.mouse.move(m.x + m.w / 2, m.y + m.h / 2); await p.waitForTimeout(150); const off2 = await peekRead(p);   // straight off the drawing, onto the map
    await p.keyboard.up('Shift');
    check('PK6 leaving the shape (onto the empty drawing, Shift still held) or leaving the drawing (straight onto the map) puts back exactly what the map showed before: the page\'s own preview, on its last card',
      b6.pager === '3 of 3' && on1.title === 'Edge Router' && off1.map === b6.map && off1.hi === b6.hi && on2.title === 'Edge Router' && off2.map === b6.map && off2.hi === b6.hi && off2.page.page === 3,
      JSON.stringify({ b6: [b6.title, b6.pager], on1: on1.title, off1: [off1.title, off1.pager, off1.map === b6.map, off1.hi === b6.hi], on2: on2.title, off2: [off2.title, off2.pager, off2.map === b6.map, off2.hi === b6.hi] }));
    await c.close(); }
  { const { c, p } = await open(A + '/index.html?embed=peek,bigcard,map&load=/rich.json'); await listenPeek(p);
    at = 'PK7'; const e = await shapeAt(p, 'Edge Router'), s = await shapeAt(p, 'Core Switch'), x0 = await p.evaluate(i => N(i).x, e.id), grid = await p.evaluate(() => ST().grid);
    await p.evaluate(i => { TopoForge.select([i]); svgEl().focus(); }, e.id);
    await p.keyboard.down('Shift'); await p.waitForTimeout(150); const k1 = await peekRead(p);
    await p.keyboard.press('ArrowRight'); await p.waitForTimeout(150); const x1 = await p.evaluate(i => N(i).x, e.id);
    await p.keyboard.up('Shift'); await p.waitForTimeout(150); const k2 = await peekRead(p);
    await p.evaluate(([a, b]) => { TopoForge.select([a, b]); svgEl().focus(); }, [e.id, s.id]); await p.keyboard.down('Shift'); await p.waitForTimeout(100); const k3 = await peekRead(p); await p.keyboard.up('Shift');
    await p.evaluate(i => { TopoForge.select([i]); document.querySelector('#palSearch').focus(); }, e.id); await p.keyboard.down('Shift'); await p.waitForTimeout(100); const k4 = await peekRead(p); await p.keyboard.up('Shift');
    check('PK7 by keyboard: with the drawing focused and one shape selected, Shift pressed alone shows that shape\'s card, Shift+→ still nudges it one grid step, and letting Shift go takes the card away; with two shapes selected, or the focus elsewhere, Shift shows nothing',
      k1.shown && k1.title === 'Edge Router' && x1 === x0 + grid && !k2.shown && !k3.shown && !k4.shown && names(k4.peeks) === '["Edge Router",null]', JSON.stringify({ k1: [k1.shown, k1.title], x: [x0, x1, grid], k2: k2.shown, k3: k3.shown, k4: k4.shown, peeks: names(k4.peeks) }));
    await c.close(); }
  { const seq = async url => { const { c, p } = await open(url); await listenPeek(p);
      const st = () => p.evaluate(() => JSON.stringify({ sel: [...S.sel].map(i => (N(i) || {}).text).sort(), v: S.view, n: P().nodes.map(n => [n.text, n.x, n.y, n.w, n.h]) }));
      const out = [], pt = l => shapeAt(p, l);
      const e = await pt('Edge Router'), s = await pt('Core Switch'), v = await pt('Server 3');
      await p.mouse.click(e.x, e.y); out.push(await st());
      await p.keyboard.down('Shift'); await p.mouse.move(s.x, s.y); await p.mouse.down(); await p.mouse.up(); out.push(await st());   // Shift-click adds
      await p.mouse.move(e.x, e.y); await p.mouse.down(); await p.mouse.up(); out.push(await st());   // Shift-click takes away
      await p.mouse.move(v.x, v.y); await p.mouse.wheel(0, 120); await p.waitForTimeout(80); out.push(await st());   // Shift+wheel pans east and west
      const v1 = await pt('Server 1'); await p.mouse.move(v1.x - 60, v1.y - 60); await p.mouse.down(); await p.mouse.move(v1.x + 260, v1.y + 80, { steps: 6 }); await p.mouse.up(); out.push(await st());   // Shift-drag a marquee adds
      const v5 = await pt('Server 5'); await p.mouse.move(v5.x, v5.y); await p.mouse.down(); await p.mouse.move(v5.x + 40, v5.y + 60, { steps: 6 }); await p.mouse.up(); out.push(await st());   // Shift-drag a shape: adds it and moves the selection
      await p.keyboard.up('Shift');
      const v2 = await pt('Server 2'); await p.mouse.click(v2.x, v2.y);
      const hp = await p.evaluate(() => { const n = singleSelNode(); if (!n) return null; const h = handlePositions(n).find(h => h.k === 'se'), r = svgEl().getBoundingClientRect(); return { x: r.left + h.x * S.view.k + S.view.x, y: r.top + h.y * S.view.k + S.view.y }; });
      if (hp) { await p.mouse.move(hp.x, hp.y); await p.keyboard.down('Shift'); await p.mouse.down(); await p.mouse.move(hp.x + 50, hp.y + 10, { steps: 5 }); await p.mouse.up(); } out.push(await st() + (hp ? '' : ' (no single shape to resize)'));   // Shift resize keeps the shape's proportions
      await p.keyboard.up('Shift'); await p.evaluate(() => svgEl().focus()); await p.keyboard.press('Shift+ArrowRight'); out.push(await st());   // Shift+arrow nudges a grid step
      const peeks = await p.evaluate(() => window.pk.length); await c.close(); return { out, peeks }; };
    at = 'PK8'; const on = await seq(A + '/index.html?embed=peek&load=/rich.json'), off = await seq(A + '/index.html?load=/rich.json');
    const same = on.out.map((x, i) => x === off.out[i]), J = x => JSON.parse(x), moved = J(off.out[3]).v.x !== J(off.out[2]).v.x && J(off.out[3]).v.y === J(off.out[2]).v.y;
    check('PK8 the peek never takes an event: Shift-click adding and taking away, Shift+wheel, Shift-drag (a marquee, and a shape), Shift resize and Shift+→ leave the same selection, view and shapes with peek on as with it off, and the peek showed meanwhile',
      same.every(Boolean) && on.peeks >= 2 && off.peeks === 0 && moved && J(off.out[1]).sel.length === 2 && J(off.out[2]).sel.length === 1,
      JSON.stringify({ same, peeks: [on.peeks, off.peeks], moved, differ: on.out.map((x, i) => x === off.out[i] ? null : { on: x.slice(0, 160), off: off.out[i].slice(0, 160) }).filter(Boolean).slice(0, 2) })); }
  { const r = await parentRun(A, A + '/index.html?embed=peek&load=/rich.json', async (p, fr) => {
      const g = await inFrame(p, await worldAt(fr, 150, 150)); await p.mouse.click(g.x, g.y); await p.waitForTimeout(100);   // the frame focused, on an empty spot of the drawing
      const e = await inFrame(p, await shapeAt(fr, 'Edge Router')), s = await inFrame(p, await shapeAt(fr, 'Core Switch'));
      await p.mouse.move(e.x, e.y); await p.keyboard.down('Shift'); await p.waitForTimeout(150); await p.mouse.move(s.x, s.y); await p.waitForTimeout(150); await p.keyboard.up('Shift'); await p.waitForTimeout(150);
    }, { after: (p, fr) => fr.evaluate(() => ['Edge Router', 'Core Switch'].map(t => P().nodes.find(n => n.text === t).id)) });
    const pk = msgs(r.got, 'peek'), pv = msgs(r.got, 'preview');
    check('PK9 the page is told: topoforge:peek { id, name } when a card shows (again for the next shape) and { id: null } when it goes, by the same two routes as the other messages (the parent, of this origin, and the app\'s own window); a peek is not a preview, so no topoforge:preview',
      JSON.stringify(pk) === JSON.stringify([{ id: r.extra[0], name: 'Edge Router' }, { id: r.extra[1], name: 'Core Switch' }, { id: null }]) && pv.length === 0 && r.ownAll.filter(t => t === 'peek').length === 3 && r.got.every(m => m.origin === A),
      JSON.stringify({ pk, ids: r.extra, pv: pv.length, own: r.ownAll })); }
  { const { c, p } = await open(A + '/index.html?embed=peek&load=/rich.json', { w: 800, h: 700 }); await listenPeek(p);
    at = 'PK10'; const e = await shapeAt(p, 'Edge Router'); await p.mouse.move(e.x, e.y); await p.keyboard.down('Shift'); await p.waitForTimeout(150);
    const h1 = await p.evaluate(() => ({ disp: getComputedStyle(document.querySelector('#minimap')).display, card: !!document.querySelector('#minimap .mm-card'), carded: document.querySelector('#minimap').classList.contains('mm-carded'), hi: !!document.querySelector('#tfHi'), pk: window.pk.slice() }));
    await p.keyboard.up('Shift'); await p.waitForTimeout(100); const pk2 = await p.evaluate(() => window.pk.slice());
    check('PK10 with the map hidden (a window 800 pixels wide) a peek draws nothing (no card, nothing lit in the drawing), but the page is still told: { id, name }, then { id: null }',
      h1.disp === 'none' && !h1.card && !h1.carded && !h1.hi && names(h1.pk) === '["Edge Router"]' && names(pk2) === '["Edge Router",null]', JSON.stringify({ h1, pk2 }));
    await c.close(); }
  { const { c, p } = await open(A + '/index.html?embed=peek,bigcard,map&load=/rich.json'); await listenPeek(p); await bigger(p);
    at = 'PK11'; const e = await shapeAt(p, 'Edge Router'); await p.mouse.move(e.x, e.y); await p.keyboard.down('Shift'); await p.waitForTimeout(150); const a1 = await peekRead(p);
    const r = await p.evaluate(() => TopoForge.preview({ kind: 'server' }, 'Servers')); await p.waitForTimeout(150); const a2 = await peekRead(p);
    await p.keyboard.up('Shift'); await p.waitForTimeout(150); const a3 = await peekRead(p);
    check('PK11 the page\'s own preview() during a peek ends the peek (told { id: null }) and is drawn at once, on its first card; letting Shift go then leaves the page\'s preview in the map',
      a1.title === 'Edge Router' && r && r.count === 10 && a2.title === 'Servers' && a2.pager === '1 of 9' && a3.map === a2.map && a3.title === 'Servers' && names(a3.peeks) === '["Edge Router",null]',
      JSON.stringify({ a1: a1.title, r: r && r.count, a2: [a2.title, a2.pager], a3: [a3.title, a3.map === a2.map], peeks: names(a3.peeks) }));
    await c.close(); }
  { const r = await parentRun(B, A + '/index.html?embed=peek&load=/rich.json', async (p, fr) => {
      const e = await inFrame(p, await shapeAt(fr, 'Edge Router')); await p.mouse.move(e.x, e.y); await p.keyboard.down('Shift'); await p.mouse.move(e.x + 2, e.y + 2); await p.waitForTimeout(150);
      await p.keyboard.up('Shift'); await p.mouse.move(e.x + 4, e.y + 4); await p.waitForTimeout(150); });
    check('E12 topoforge:peek never reaches a parent of another origin, though it fired inside the app', r.got.length === 0 && r.ownAll.filter(t => t === 'peek').length === 2, `parent got ${r.got.length}; inside: ${r.ownAll.join(',')}`); }
  { const { c, p } = await open(A + '/index.html?embed=props,shapes&load=/rich.json');
    at = 'FS1'; const f = await p.evaluate(() => { const r = {};
      TopoForge.setView({ k: 0.3, x: 11, y: 7 }); const v0 = JSON.stringify(S.view), t0 = JSON.stringify(TopoForge.view);
      r.k = TopoForge.fitScale(); r.k80 = TopoForge.fitScale(80); r.still = JSON.stringify(S.view) === v0 && JSON.stringify(TopoForge.view) === t0;
      TopoForge.fitView(); r.after = TopoForge.view.k; r.raw = S.view.k;
      TopoForge.setView({ k: 2, x: 0, y: 0 }); TopoForge.fitView(80); r.after80 = TopoForge.view.k;
      DOC.pages.push(newPage('Empty')); buildPages(); TopoForge.showPage('Empty'); TopoForge.setView({ k: 0.5, x: 9, y: 9 }); const v1 = JSON.stringify(S.view);
      r.empty = TopoForge.fitScale(); r.stillEmpty = JSON.stringify(S.view) === v1; return r; });
    check('FS1 TopoForge.fitScale() is the zoom Fit would set now, read without moving the view: equal to TopoForge.view.k after fitView() (with both panels floating, so the room they take counts), fitScale(80) to it after fitView(80); 1 on an empty page; the reading moves nothing',
      typeof f.k === 'number' && f.k !== 0.3 && f.still && f.k === f.after && Math.abs(f.k - f.raw) < 1e-5 && f.k80 === f.after80 && f.k80 !== f.k && f.empty === 1 && f.stillEmpty, JSON.stringify(f));
    await c.close();
    at = 'FS2'; const fv = async url => { const { c, p } = await open(url); const r = await p.evaluate(() => { const out = [];
        for (const pad of [undefined, 80, 0]) { TopoForge.setView({ k: 0.4, x: 3, y: 5 }); TopoForge.fitView(pad); out.push(JSON.stringify(S.view)); }
        DOC.pages.push(newPage('Empty')); buildPages(); TopoForge.showPage('Empty'); TopoForge.setView({ k: 0.4, x: 3, y: 5 }); TopoForge.fitView(); out.push(JSON.stringify(S.view)); return out; }); await c.close(); return r; };
    const f12 = await fv(A + '/v17.html?embed=props,shapes&load=/rich.json'), f13 = await fv(A + '/index.html?embed=props,shapes&load=/rich.json');
    check(`FS2 fitView() sets exactly the view ${PREV}'s fitView sets (the same drawing, the same floating panels, the same window): pad 50, 80 and 0, and an empty page`, JSON.stringify(f12) === JSON.stringify(f13) && f13.length === 4, JSON.stringify({ [PREV]: f12, [VER]: f13 })); }

  // ======== 1.14: the page's Shift (peekKey), and a title too long for the card (bigcard) ========
  // PK12 and PK13 run in a parent page of this origin with the focus in the parent, as an embedding page's own keys would hear Shift
  const pkCall = (p, down) => p.evaluate(d => document.getElementById('f').contentWindow.TopoForge.peekKey(d), down);
  const parentCorner = p => p.mouse.click(1225, 825);   // the parent's own body, beside the frame (1200 by 800 at its top left): the focus leaves the app
  { const cap = {};
    const off = await parentRun(A, A + '/index.html?embed=bigcard,map&load=/rich.json', async (p, fr) => {
      await parentCorner(p); const e = await inFrame(p, await shapeAt(fr, 'Edge Router')); await p.mouse.move(e.x, e.y); await p.waitForTimeout(100);
      cap.offRet = await pkCall(p, true); await p.waitForTimeout(150); cap.offCard = await peekRead(fr); await pkCall(p, false); });
    const on = await parentRun(A, A + '/index.html?embed=peek,bigcard,map&load=/rich.json', async (p, fr) => {
      await parentCorner(p); cap.focus = await p.evaluate(() => [document.hasFocus(), document.getElementById('f').contentDocument.hasFocus()]);
      const e = await inFrame(p, await shapeAt(fr, 'Edge Router')); await p.mouse.move(e.x - 3, e.y); await p.mouse.move(e.x, e.y); await p.waitForTimeout(150);   // the pointer rests on the shape; no Shift
      cap.before = await peekRead(fr);
      cap.r1 = await pkCall(p, true); await p.waitForTimeout(150); cap.c1 = await cardRead(fr); cap.p1 = await peekRead(fr);
      cap.r2 = await pkCall(p, false); await p.waitForTimeout(150); cap.p2 = await peekRead(fr);
      cap.sel = await fr.evaluate(() => S.sel.size);
    }, { after: (p, fr) => fr.evaluate(() => P().nodes.find(n => n.text === 'Edge Router').id) });
    const pk = msgs(on.got, 'peek');
    at = 'PK12'; check('PK12 TopoForge.peekKey(down), for a page whose own keys hear Shift (the focus in the parent page, never in the app): with the pointer resting on a shape and no Shift the app could hear, peekKey(true) shows that shape\'s card (it returns { id, name }; the page is told), peekKey(false) puts back what the map showed, here nothing (no card, not faded, nothing lit, as PK5 judges it; it returns null; told { id: null }); it takes no event (the selection as it was); with peek off it does nothing and returns false',
      cap.offRet === false && !cap.offCard.shown && msgs(off.got, 'peek').length === 0 && cap.focus[0] === true && cap.focus[1] === false && !cap.before.shown &&
      cap.r1 && cap.r1.id === on.extra && cap.r1.name === 'Edge Router' && fitted(cap.c1) && cap.c1.title === 'Edge Router' && cap.r2 === null && !cap.p2.shown && !cap.p2.carded && !cap.p2.cap && cap.p2.rings === 0 && cap.p2.hiN === 0 && cap.sel === 0 &&
      JSON.stringify(pk) === JSON.stringify([{ id: on.extra, name: 'Edge Router' }, { id: null }]) && on.got.every(m => m.origin === A),
      JSON.stringify({ off: [cap.offRet, cap.offCard.shown], focus: cap.focus, before: cap.before.shown, r1: cap.r1, c1: { shown: cap.c1.shown, title: cap.c1.title, cut0: cap.c1.cut0, k: cap.c1.k }, r2: cap.r2, p2: [cap.p2.shown, cap.p2.carded, cap.p2.cap, cap.p2.rings, cap.p2.hiN], sel: cap.sel, pk })); }
  { const cap = {};
    await parentRun(A, A + '/index.html?embed=peek,bigcard,map&load=/rich.json', async (p, fr) => {
      const [e, s] = [await shapeAt(fr, 'Edge Router'), await shapeAt(fr, 'Core Switch')];
      await fr.evaluate(i => TopoForge.select([i]), e.id); await parentCorner(p); await p.waitForTimeout(100);   // one selected, the pointer and the focus in the parent
      cap.r1 = await pkCall(p, true); await p.waitForTimeout(150); cap.k1 = await peekRead(fr); cap.r1b = await pkCall(p, false); await p.waitForTimeout(150); cap.k1b = await peekRead(fr);
      await fr.evaluate(([a, b]) => TopoForge.select([a, b]), [e.id, s.id]); cap.r2 = await pkCall(p, true); await p.waitForTimeout(150); cap.k2 = await peekRead(fr); await pkCall(p, false);
      await fr.evaluate(() => TopoForge.select([])); cap.r3 = await pkCall(p, true); await p.waitForTimeout(150); cap.k3 = await peekRead(fr); await pkCall(p, false);
      await fr.evaluate(i => TopoForge.select([i]), e.id); await pkCall(p, true); cap.selAfter = await fr.evaluate(() => [...S.sel].map(i => N(i).text)); await pkCall(p, false); });
    at = 'PK13'; check('PK13 with the pointer off the drawing, peekKey(true) shows the one selected shape\'s card though the drawing is not focused (the page speaks for the keyboard), and peekKey(false) takes it away; with two selected, or none, it shows nothing (null); the selection is never changed',
      cap.r1 && cap.r1.name === 'Edge Router' && cap.k1.shown && cap.k1.title === 'Edge Router' && cap.r1b === null && !cap.k1b.shown && cap.r2 === null && !cap.k2.shown && cap.r3 === null && !cap.k3.shown && JSON.stringify(cap.selAfter) === '["Edge Router"]',
      JSON.stringify({ r1: cap.r1, k1: [cap.k1.shown, cap.k1.title], r1b: cap.r1b, k1b: cap.k1b.shown, two: [cap.r2, cap.k2.shown], none: [cap.r3, cap.k3.shown], sel: cap.selAfter })); }
  // BC11: a title too long to fit at 1.10's sizes even alone, on a match's own card (a later page): shortened at a word, with an ellipsis, not cut off
  { const LONG = 'gitcha: A free, self-hosted forge for people and their agents: packages, git, site hosting and CI, with two-factor sign-in on every account. Its README says which parts are tested only against stand-ins.';
    const FULL = LONG.slice(0, 200);   // the card's title as the app makes it: the shape's first line, up to 200 characters (matchCard)
    const add = p => p.evaluate(L => { edit(() => { const z = makeNode('server', 900, 400, { text: L + '\nsecond line' }); z.data.tooltip = 'A long tooltip: ' + L; P().nodes.push(z); }); render();
      const ids = ['Edge Router', L + '\nsecond line', 'Core Switch'].map(t => P().nodes.find(n => n.text === t).id); TopoForge.preview(ids); TopoForge.cardPage(3); }, LONG);
    const tRead = p => p.evaluate(() => { const t = document.querySelector('#minimap .mm-card .mc-t'); return { attr: t.getAttribute('title'), lines: Math.round(t.getBoundingClientRect().height / parseFloat(getComputedStyle(t).lineHeight)), page: TopoForge.cardPage(), live: (document.querySelector('#flLive') || {}).textContent || '' }; });
    const short = c => c.title.endsWith('…') && FULL.startsWith(c.title.slice(0, -1)) && /[\s,;:.]/.test(FULL.charAt(c.title.length - 1));   // a word's end, then the ellipsis
    const { c, p } = await open(A + '/index.html?embed=bigcard,map&load=/rich.json');
    at = 'BC11'; await add(p); await p.waitForTimeout(250); const c1 = await cardRead(p), t1 = await tRead(p);
    await bigger(p); await p.waitForTimeout(250); const c2 = await cardRead(p), t2 = await tRead(p);
    await p.evaluate(() => TopoForge.fitView()); await p.waitForTimeout(250); const c3 = await cardRead(p);   // the view at fitScale(): the map redrawn, the card fitted again
    await p.evaluate(() => TopoForge.mapScale(2)); await p.waitForTimeout(250); const c4 = await cardRead(p);
    await p.evaluate(() => TopoForge.cardPage(2)); await p.waitForTimeout(200); const c5 = await cardRead(p), t5 = await tRead(p);
    await c.close();
    const ph = await open(A + '/index.html?embed=bigcard&load=/rich.json', { w: 390, h: 844 }); await add(ph.p); await ph.p.waitForTimeout(300); const c6 = await cardRead(ph.p); await ph.c.close();
    check('BC11 a title too long to fit at 1.10\'s sizes even alone (a match\'s card, its own page) is shortened to the words that fit, at a word, ending in an ellipsis, not cut off: nothing of the card is cut, in the map\'s first size, a larger map (more of it shown, or all), with the view at fitScale(), at the map\'s scale 2 and on a phone\'s sheet; its whole text stays in its title attribute, in cardPage() and in the live region; it fills two lines or more; a short title is as before',
      c1.shown && c1.cut0.length === 0 && short(c1) && t1.lines >= 2 && t1.attr === FULL && t1.page.title === FULL && t1.live.includes(FULL.slice(0, 80)) &&
      c2.cut0.length === 0 && (c2.title === FULL || (short(c2) && c2.title.length > c1.title.length)) && (c2.title === FULL ? t2.attr === null : t2.attr === FULL) &&
      c3.cut0.length === 0 && c3.title === c2.title && c4.cut0.length === 0 && c4.title === c2.title &&
      fitted(c5) && c5.title === 'Edge Router' && t5.attr === null && c6.shown && c6.cut0.length === 0 && (c6.title === FULL || short(c6)),
      JSON.stringify({ c1: [c1.title, c1.cut0, c1.k, c1.cls], t1: { attr: t1.attr === FULL, lines: t1.lines, page: t1.page.title === FULL, live: t1.live.slice(0, 40) }, c2: [c2.title.length, c2.cut0, c2.k], c3: [c3.title.length, c3.cut0], c4: [c4.title.length, c4.cut0], c5: [c5.title, c5.cut0, t5.attr], c6: [c6.title.length, c6.cut0, c6.k] })); }

  // ---- X: axe with every switch on; reduced motion ----
  for (const dark of [false, true]) {
    const { c, p } = await open(A + '/index.html?embed=all,map,preview,view,keys,context,pagelist,mappad,reset,bigcard,cardpad,peek&load=/fixture.json', { dark, reduce: true });
    await p.evaluate(() => TopoForge.preview({ category: 'net' }));
    await p.waitForFunction(() => !document.querySelector('#toasts .toast'), null, { timeout: 8000 }).catch(() => {});   // 1.7's toasts: see NEWS, 1.8
    await p.addScriptTag({ content: axeSrc });
    const v = await p.evaluate(async () => (await axe.run(document, { resultTypes: ['violations'] })).violations.map(x => ({ id: x.id, impact: x.impact, n: x.nodes.length, t: x.nodes.slice(0, 4).map(y => y.target.join(' ')) })));
    fs.writeFileSync(path.join(outdir, `axe-embed-all-${dark ? 'dark' : 'light'}.json`), JSON.stringify(v, null, 1));
    const bad = v.filter(x => x.impact === 'critical' || x.impact === 'serious');
    check(`X1 axe, every switch on, ${dark ? 'dark' : 'light'}: no critical or serious finding`, bad.length === 0, v.map(x => `${x.impact} ${x.id} x${x.n} [${x.t.join(' | ')}]`).join(' ;; ') || 'no findings');
    if (!dark) {
      const mo = await p.evaluate(() => ['#palette', '#side', '#mapbox', '.fl-bar', '#mmwrap .mm-handles', '#mmwrap .mm-h', '#mmPad .mp-thumb'].map(s => getComputedStyle(document.querySelector(s)).transitionDuration));
      check('X2 the floating parts do not move by themselves (no transition) with reduced motion asked', mo.every(d => d === '0s'), mo.join(','));
      await p.screenshot({ path: path.join(outdir, 'embed-all-light.png') });
    } else await p.screenshot({ path: path.join(outdir, 'embed-all-dark.png') });
    await c.close();
  }
  for (const dark of [false, true]) {   // 1.9: the map's handles and the preview's caption, shown (the pages box is off, so the map is in its own frame)
    const { c, p } = await open(A + '/index.html?embed=map,preview,shapes,mappad&load=/fixture.json', { dark, reduce: true });
    await p.waitForFunction(() => !document.querySelector('#toasts .toast'), null, { timeout: 8000 }).catch(() => {});
    await p.evaluate(() => TopoForge.preview({ category: 'net' })); await p.focus('#mmwrap .mm-grip');
    await p.addScriptTag({ content: axeSrc });
    const v = await p.evaluate(async () => (await axe.run(document, { resultTypes: ['violations'] })).violations.map(x => ({ id: x.id, impact: x.impact, n: x.nodes.length, t: x.nodes.slice(0, 4).map(y => y.target.join(' ')) })));
    const bad = v.filter(x => x.impact === 'critical' || x.impact === 'serious');
    check(`X3 axe, the map's handles shown and a preview caption, ${dark ? 'dark' : 'light'}: no critical or serious finding`, bad.length === 0, v.map(x => `${x.impact} ${x.id} x${x.n} [${x.t.join(' | ')}]`).join(' ;; ') || 'no findings');
    await p.screenshot({ path: path.join(outdir, `map-preview-${dark ? 'dark' : 'light'}.png`) });
    await c.close();
  }
  for (const dark of [false, true]) {   // 1.12: the big card on its second page, and the pad turned beside it, its handles shown
    const { c, p } = await open(A + '/index.html?embed=cardpad&load=/rich.json', { dark, reduce: true });
    await p.waitForFunction(() => !document.querySelector('#toasts .toast'), null, { timeout: 8000 }).catch(() => {});
    for (let i = 0; i < 3; i++) { await p.focus('#mmwrap .mm-size'); await p.keyboard.press('Shift+ArrowLeft'); await p.keyboard.press('Shift+ArrowUp'); }
    await p.evaluate(() => { TopoForge.preview({ category: 'net' }); TopoForge.cardPage('next'); }); await p.focus('#mmPad .mp-e'); await p.waitForTimeout(300);
    await p.addScriptTag({ content: axeSrc });
    const v = await p.evaluate(async () => (await axe.run(document, { resultTypes: ['violations'] })).violations.map(x => ({ id: x.id, impact: x.impact, n: x.nodes.length, t: x.nodes.slice(0, 4).map(y => y.target.join(' ')) })));
    const bad = v.filter(x => x.impact === 'critical' || x.impact === 'serious');
    check(`X4 axe, the big card on its second page and the pad turned, ${dark ? 'dark' : 'light'}: no critical or serious finding`, bad.length === 0, v.map(x => `${x.impact} ${x.id} x${x.n} [${x.t.join(' | ')}]`).join(' ;; ') || 'no findings');
    await p.screenshot({ path: path.join(outdir, `bigcard-${dark ? 'dark' : 'light'}.png`) });
    await c.close();
  }
  check('C1 no console errors', consoleErrors.length === 0, consoleErrors.join(' | ').slice(0, 600));
} catch (e) { const m = String(e && e.message || e).split('\n')[0].slice(0, 300); if (at && !results.some(r => r.startsWith('PASS ' + at + ' ') || r.startsWith('FAIL ' + at + ' '))) check(at + ' did not finish: one of its steps threw', false, m); check('C0 the kit ran to its end (a check that throws is a failure, and the checks before it still count)', false, m); }
finally { await browser.close(); for (const s of [sA, sB]) { s.close(); if (s.closeAllConnections) s.closeAllConnections(); } }

console.log(results.join('\n'));
console.log(red ? `TOPOFORGE EMBED RED (${red} failed)` : 'TOPOFORGE EMBED GREEN');
const passed = results.filter(r => r.startsWith('PASS')).length;
fs.writeFileSync(RESULT, [red ? 'RED' : 'GREEN',
  'draw ' + VER + ' (the drawing app), the embedding switches, in a real browser -- written by tests/browser/embed.browser.mjs (do not edit by hand)',
  'Licence of this note: CC-BY-SA-4.0',
  'Run at: ' + new Date().toISOString() + ' on ' + os.type() + ' ' + os.release() + ', node ' + process.version + ', ' + 'playwright ' + require(PW + '/package.json').version,
  'File tested: index.html sha256 ' + sha(html),
  'Compared with: ' + PREV + ' rebuilt from upstream/topoforge-1.5.html and patches/, sha256 ' + sha(fs.readFileSync(v17)),
  'Kit: tests/browser/embed.browser.mjs sha256 ' + sha(fs.readFileSync(fileURLToPath(import.meta.url))),
  `Result: ${passed} checks passed, ${red} failed. Exit ${red ? 1 : 0} (0 green, 1 red, 2 kit broken).`,
  '', 'CHECKS', ...results, ''].join('\n'));
console.log('wrote ' + RESULT);
process.exit(red ? 1 : 0);
