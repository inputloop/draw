// SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
// Copyright 2026 Bryant Frankford <nathanielfrankford@gmail.com> and
// Corwin Brust <corwin@bru.st> and Contributors
//
// a11y-check.mjs -- the WCAG 2.1 AA rules that www/index.html, www/app.html
// and the stylesheets promise, as checks.  Node 18+, no packages.
//   node tests/a11y-check.mjs            check the tree; exit 1 on a failure
//   node tests/a11y-check.mjs --plant    break a copy in 13 known ways; each
//                                        must be caught (prove-red); exit 1 if not
// It reads the page the way a person's tools first do: the static HTML, not
// what the script draws later.  It does not replace a screen reader.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = p => readFileSync(root + p, 'utf8');

// ------------------------------------------------------------ a small HTML reader
const VOID = new Set(['meta', 'link', 'br', 'hr', 'img', 'input', 'source', 'area', 'col', 'base', 'wbr']);
export function parseHTML(src) {
  const doc = src.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, m => m.replace(/>[\s\S]*<\//, '></'));
  const els = [], stack = [];
  const re = /<\/?([a-zA-Z][\w-]*)((?:\s+[^\s=>\/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*\/?>|([^<]+)/g;
  let m;
  while ((m = re.exec(doc))) {
    if (m[3] !== undefined) { for (const e of stack) e.text += m[3]; continue; }
    const tag = m[1].toLowerCase();
    if (m[0][1] === '/') { for (let i = stack.length - 1; i >= 0; i--) if (stack[i].tag === tag) { stack.length = i; break; } continue; }
    const attrs = {};
    for (const a of m[2].matchAll(/([^\s=>\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))
      attrs[a[1].toLowerCase()] = a[2] ?? a[3] ?? a[4] ?? '';
    const e = { tag, attrs, text: '', parents: stack.map(s => s.tag), order: els.length, anc: stack.slice() };
    els.push(e);
    if (!VOID.has(tag) && !m[0].endsWith('/>')) stack.push(e);
  }
  return els;
}

// ------------------------------------------------------------ colour
const hex = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const lum = rgb => { const [r, g, b] = rgb.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
export const ratio = (a, b) => { const [x, y] = [lum(hex(a)), lum(hex(b))].sort((p, q) => q - p); return (x + .05) / (y + .05); };

function cssBlocks(src) {   // flat list of {sel: [parts], decl: {name: value}, media}; @media blocks are kept apart
  const s = src.replace(/\/\*[\s\S]*?\*\//g, ''), out = [];
  const walk = (text, media) => {
    let i = 0;
    while (i < text.length) {
      const o = text.indexOf('{', i); if (o < 0) break;
      const head = text.slice(i, o).trim(); let d = 1, j = o + 1;
      while (j < text.length && d) { if (text[j] === '{') d++; else if (text[j] === '}') d--; j++; }
      const body = text.slice(o + 1, j - 1);
      if (head.startsWith('@')) { if (head.startsWith('@media')) walk(body, head); }
      else {
        const decl = {};
        for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) decl[m[1]] = m[2].trim();
        out.push({ sel: head.split(',').map(x => x.replace(/\s+/g, ' ').trim()), decl, media, body });
      }
      i = j;
    }
  };
  walk(s, null);
  return out;
}
function scope(blocks, parts) {   // the custom properties in force when exactly these selectors apply (source order)
  const vars = {};
  for (const b of blocks) if (!b.media && b.sel.some(p => parts.includes(p))) Object.assign(vars, b.decl);
  const get = (n, d = 0) => { let v = vars[n]; if (v === undefined || d > 8) return undefined; const m = /^var\((--[\w-]+)\)$/.exec(v); return m ? get(m[1], d + 1) : v; };
  return get;
}

const SCOPES = {
  'egad light':     [':root', ':root[data-theme="light"]'],
  'egad dark':      [':root', ':root[data-theme="dark"]'],
  'original light': [':root', ':root[data-theme="light"]', ':root[data-palette="original"]'],
  'original dark':  [':root', ':root:where([data-palette="original"])[data-theme="dark"]', ':root[data-palette="original"]'],
  'console':        [':root', ':root[data-theme="light"]', ':root[data-treatment="console"]'],
};
const PAIRS = [   // [fg, bg, minimum, why]
  ['--fg', '--bg', 4.5, 'body text'], ['--muted', '--bg', 4.5, 'secondary text'], ['--fg', '--panel', 4.5, 'text in a panel'],
  ['--muted', '--panel', 4.5, 'secondary text in a panel'], ['--link', '--bg', 4.5, 'links'], ['--link', '--panel', 4.5, 'links in a panel'],
  ['--visited', '--bg', 4.5, 'visited links'], ['--visited', '--panel', 4.5, 'visited links in a panel'],
  ['--accent-fg', '--accent', 4.5, 'primary button label'], ['--warn', '--bg', 4.5, 'warning text'], ['--warn', '--panel', 4.5, 'warning text in a panel'],
  ['--control', '--bg', 3, 'edge of an input (1.4.11)'], ['--control', '--panel', 3, 'edge of an input in a panel'],
  ['--focus', '--bg', 3, 'focus ring'], ['--focus', '--panel', 3, 'focus ring in a panel'],
];

// ------------------------------------------------------------ the rules
export function check(files) {
  const bad = [];
  const fail = (f, msg) => bad.push(`${f}: ${msg}`);
  for (const f of ['index.html', 'app.html']) {
    const src = files['www/' + f], els = parseHTML(src), by = t => els.filter(e => e.tag === t);
    const ids = new Map(); els.forEach(e => { if (e.attrs.id !== undefined) ids.set(e.attrs.id, (ids.get(e.attrs.id) || 0) + 1); });
    for (const [id, n] of ids) if (n > 1) fail(f, `id "${id}" is used ${n} times`);
    // 3.1.1 language, 2.4.2 title, 1.4.4 zoom
    if (!/^[a-z]{2,3}(-[\w-]+)?$/i.test((by('html')[0] || { attrs: {} }).attrs.lang || '')) fail(f, '<html> has no lang');
    if (!by('title').some(t => t.text.trim().length >= 3)) fail(f, 'no <title>');
    const vp = by('meta').find(m => m.attrs.name === 'viewport');
    if (!vp) fail(f, 'no viewport meta'); else if (/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/i.test(vp.attrs.content || '')) fail(f, 'the viewport forbids zoom');
    // 1.3.1 headings, landmarks
    const hs = els.filter(e => /^h[1-6]$/.test(e.tag)).map(e => +e.tag[1]);
    if (hs.filter(n => n === 1).length !== 1) fail(f, `want exactly one <h1>, found ${hs.filter(n => n === 1).length}`);
    for (let i = 1; i < hs.length; i++) if (hs[i] > hs[i - 1] + 1) fail(f, `heading level jumps from h${hs[i - 1]} to h${hs[i]}`);
    if (by('main').length !== 1) fail(f, `want exactly one <main>, found ${by('main').length}`);
    if (!by('header').length) fail(f, 'no banner (<header>)');
    for (const t of ['nav', 'aside']) if (by(t).length > 1 || (t === 'aside' && by(t).length)) for (const e of by(t)) if (!e.attrs['aria-label'] && !e.attrs['aria-labelledby']) fail(f, `a <${t}> has no accessible name`);
    // 2.4.1 skip link: first focusable thing, target exists and can take focus
    const first = els.find(e => (e.tag === 'a' && e.attrs.href !== undefined) || e.tag === 'button' || e.tag === 'input' || e.tag === 'select');
    if (!first || first.tag !== 'a' || !first.attrs.class?.split(/\s+/).includes('skip') || !first.attrs.href.startsWith('#')) fail(f, 'the first focusable element is not a skip link');
    else {
      const t = els.find(e => e.attrs.id === first.attrs.href.slice(1));
      if (!t) fail(f, `the skip link points at #${first.attrs.href.slice(1)}, which does not exist`);
      else if (!('tabindex' in t.attrs) && !['a', 'button', 'input', 'select'].includes(t.tag)) fail(f, `the skip link's target #${t.attrs.id} cannot take focus (no tabindex)`);
    }
    for (const a of els.filter(e => e.tag === 'a' && e.attrs.class?.split(/\s+/).includes('skip'))) if (a.attrs.href[0] === '#' && !ids.has(a.attrs.href.slice(1))) fail(f, `skip link ${a.attrs.href} has no target`);
    // 1.3.1 / 3.3.2 / 4.1.2 names
    const labelFor = new Set(by('label').map(l => l.attrs.for).filter(Boolean));
    for (const e of els.filter(e => ['input', 'select', 'textarea'].includes(e.tag) && e.attrs.type !== 'hidden')) {
      const named = (e.attrs.id && labelFor.has(e.attrs.id)) || e.anc.some(a => a.tag === 'label') || e.attrs['aria-label'] || e.attrs['aria-labelledby'];
      if (!named) fail(f, `<${e.tag}${e.attrs.id ? ' id=' + e.attrs.id : ''}> has no label`);
    }
    for (const b of by('button')) if (!b.text.trim() && !b.attrs['aria-label']) fail(f, `a button (${b.attrs.id || 'no id'}) has no name`);
    for (const a of by('a')) { if (a.attrs.href === undefined) fail(f, 'an <a> without href'); else if (!a.text.trim() && !a.attrs['aria-label']) fail(f, `a link to ${a.attrs.href} has no text`); }
    for (const i of by('img')) if (i.attrs.alt === undefined) fail(f, `<img ${i.attrs.src || ''}> has no alt`);
    for (const i of by('iframe')) if (!i.attrs.title) fail(f, 'an <iframe> has no title');
    for (const e of els) for (const k of ['aria-labelledby', 'aria-describedby'])
      for (const id of (e.attrs[k] || '').split(/\s+/).filter(Boolean)) if (!ids.has(id)) fail(f, `${k}="${id}" names nothing on the page`);
    // 2.1.1 keyboard: nothing leaves the tab order wrongly; scrollable pre is reachable
    for (const e of els) if (+e.attrs.tabindex > 0) fail(f, 'tabindex above 0 reorders the keyboard path');
    for (const p of by('pre')) if (p.attrs.tabindex !== '0') fail(f, 'a <pre> that can scroll cannot be reached by keyboard (needs tabindex="0")');
    for (const e of els) if (e.attrs.onclick !== undefined && !['a', 'button', 'input', 'select', 'summary'].includes(e.tag)) fail(f, `<${e.tag}> has onclick but is not a control`);
  }
  // CSS: focus, motion, forced colours, contrast
  const egad = files['www/css/egad.css'], topo = files['www/css/topology.css'];
  if (!/:focus-visible[^{]*\{[^}]*outline:\s*[23]px/.test(topo)) fail('topology.css', 'no visible focus style (outline of 2px or more on :focus-visible)');
  if (!/@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(topo)) fail('topology.css', 'no prefers-reduced-motion: reduce rule');
  if (/outline:\s*(none|0)\b/.test(topo.replace(/\/\*[\s\S]*?\*\//g, ''))) fail('topology.css', 'an outline is switched off');
  const blocks = [...cssBlocks(egad), ...cssBlocks(topo)];
  for (const [name, parts] of Object.entries(SCOPES)) {
    const get = scope(blocks, parts);
    for (const [fg, bg, min, why] of PAIRS) {
      const a = get(fg), b = get(bg);
      if (!/^#[0-9a-f]{3,6}$/i.test(a || '') || !/^#[0-9a-f]{3,6}$/i.test(b || '')) { fail('css', `${name}: ${fg} on ${bg} did not resolve to two hex colours (${a} / ${b})`); continue; }
      const r = ratio(a, b);
      if (r < min) fail('css', `${name}: ${why} (${fg} ${a} on ${bg} ${b}) is ${r.toFixed(2)}:1, wants ${min}:1`);
    }
    if (name.startsWith('egad')) for (const [fg, bg] of [['--fg', '--bg'], ['--link', '--bg']]) {
      const r = ratio(get(fg), get(bg)); if (r < 7) fail('css', `${name}: ${fg} on ${bg} is ${r.toFixed(2)}:1; egad promises 7:1 (AAA) for text`);
    }
  }
  return bad;
}

// ------------------------------------------------------------ run
const names = ['www/index.html', 'www/app.html', 'www/css/egad.css', 'www/css/topology.css'];
const load = () => Object.fromEntries(names.map(n => [n, read(n)]));
const PLANTS = [
  ['no lang', f => { f['www/app.html'] = f['www/app.html'].replace('<html lang="en">', '<html>'); }],
  ['heading skips a level', f => { f['www/index.html'] = f['www/index.html'].replace('<summary>What it is</summary>', '<h4>x</h4><summary>What it is</summary>'); }],
  ['a field loses its label', f => { f['www/app.html'] = f['www/app.html'].replace('<label for="endpoint">Use</label>', ''); }],
  ['skip link points nowhere', f => { f['www/index.html'] = f['www/index.html'].replace('href="#main"', 'href="#nowhere"'); }],
  ['skip target cannot take focus', f => { f['www/index.html'] = f['www/index.html'].replace('<main id="main" tabindex="-1">', '<main id="main">'); }],
  ['no main landmark', f => { f['www/app.html'] = f['www/app.html'].replace('<main id="main">', '<div>').replace('</main>', '</div>'); }],
  ['iframe loses its title', f => { f['www/app.html'] = f['www/app.html'].replace(' title="TopoForge, the drawing"', ''); }],
  ['an image with no alt', f => { f['www/index.html'] = f['www/index.html'].replace('<main', '<img src="x.png"><main'); }],
  ['zoom forbidden', f => { f['www/index.html'] = f['www/index.html'].replace('initial-scale=1', 'initial-scale=1, user-scalable=no'); }],
  ['muted text too pale', f => { f['www/css/topology.css'] = f['www/css/topology.css'].replace('--muted: var(--egad-text-dim);', '--muted: #bbbbbb;'); }],
  ['focus ring removed', f => { f['www/css/topology.css'] = f['www/css/topology.css'].replace(/outline: 3px solid var\(--focus\)/g, 'outline: 0 solid var(--focus)'); }],
  ['reduced motion ignored', f => { f['www/css/topology.css'] = f['www/css/topology.css'].replace('prefers-reduced-motion: reduce', 'prefers-reduced-motion: no-preference-x'); }],
  ['egad colour changed to fail', f => { f['www/css/egad.css'] = f['www/css/egad.css'].replace('--egad-fg-dim: #595959;', '--egad-fg-dim: #999999;'); }],
];
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--plant')) {
    let missed = 0;
    const clean = check(load());
    if (clean.length) { console.log('the clean tree already fails:\n  ' + clean.join('\n  ')); process.exit(1); }
    for (const [name, plant] of PLANTS) {
      const f = load(); plant(f);
      const before = JSON.stringify(load());
      if (JSON.stringify(f) === before) { console.log(`PLANT NOT APPLIED (the text it changes is gone): ${name}`); missed++; continue; }
      const got = check(f);
      if (got.length) console.log(`caught: ${name}  (${got[0]})`); else { console.log(`MISSED: ${name}`); missed++; }
    }
    console.log(missed ? `a11y-check --plant: ${missed} not caught` : `a11y-check --plant: all ${PLANTS.length} planted faults caught`);
    process.exit(missed ? 1 : 0);
  }
  const bad = check(load());
  if (bad.length) { console.log('a11y-check: ' + bad.length + ' failure(s)\n  ' + bad.join('\n  ')); process.exit(1); }
  console.log(`a11y-check: index.html and app.html pass the structural rules; ${Object.keys(SCOPES).length} palettes x ${PAIRS.length} colour pairs pass`);
}
