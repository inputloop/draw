#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
// Copyright 2026 Bryant Frankford <nathanielfrankford@gmail.com> and Corwin Brust <corwin@bru.st> and Contributors
// Written by Mentat (for Corwin; claude-opus-5-5).
//
// Headless harness: runs TopoForge's own <script> from index.html in a node `vm` with a
// tiny stand-in for the browser (no network, no page drawn). It PRODUCES exports the way
// the app does; it does not CHECK anything about facts - that is tests/check.sh (jq + sh).
//
//   node tf-node.js export   <index.html> <src.json> <out.json> <out.md> [fence] [date]
//   node tf-node.js prev     <index.html> <old-src.json> <src.json> <out.json> <out.md> [fence] [date]
//   node tf-node.js sha      <index.html>          # built-in SHA-256 vs node's, prints OK/FAIL
//   node tf-node.js roundtrip <index.html> <src.json>  # JSON, draw.io, Visio: are tf_ref handles kept?
//                                                     # (needs jsdom on NODE_PATH for DOMParser)
'use strict';
const fs = require('fs'), vm = require('vm'), nodeCrypto = require('crypto');
const [cmd, htmlPath, ...rest] = process.argv.slice(2);
if (!cmd || !htmlPath) { console.error('usage: see header'); process.exit(2); }

function load(withDom) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const m = html.match(/<script>([\s\S]*)<\/script>/);
  if (!m) { console.error('no <script> in ' + htmlPath); process.exit(2); }
  const noop = () => {};
  const doc = { addEventListener: noop, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, getContext: () => null }), documentElement: { dataset: {} } };
  const ctx = { document: doc, localStorage: { getItem: () => null, setItem: noop }, matchMedia: () => ({ matches: false, addEventListener: noop }), console, setTimeout, clearTimeout, TextEncoder, TextDecoder, navigator: { userAgent: 'node' }, Uint8Array, btoa: globalThis.btoa, atob: globalThis.atob, CompressionStream: globalThis.CompressionStream, DecompressionStream: globalThis.DecompressionStream, Blob: globalThis.Blob, Response: globalThis.Response };
  if (withDom) {
    let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.error('SKIP: jsdom not found on NODE_PATH; round trip not run'); process.exit(3); }
    const w = new JSDOM('<!doctype html><body></body>').window; ctx.DOMParser = w.DOMParser; ctx.XMLSerializer = w.XMLSerializer; ctx.document = new Proxy(w.document, { get: (t, k) => k === 'addEventListener' ? noop : (typeof t[k] === 'function' ? t[k].bind(t) : t[k]) }); ctx.getComputedStyle = w.getComputedStyle; ctx.Node = w.Node;
  }
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(m[1] + '\n;globalThis.__T = { normalizeDoc, reindex, factsOf, storyMarkdown, sha256hexSync, sha256hex, buildDrawio, parseDrawio, buildVsdx, parseVsdx, refOf, get DOC() { return DOC; }, set DOC(d) { DOC = d; } };', ctx);
  return ctx;
}
function adopt(T, src) { T.DOC = T.normalizeDoc(JSON.parse(fs.readFileSync(src, 'utf8'))); T.reindex(); return T.DOC; }
const FIXED_TS = '2026-10-08T00:00:00.000Z';

(async () => {
  if (cmd === 'export' || cmd === 'prev') {
    const ctx = load(false), T = ctx.__T;
    let prev = null, a = rest;
    if (cmd === 'prev') { const d0 = adopt(T, a[0]); prev = T.factsOf(d0); a = a.slice(1); }
    const [src, outJson, outMd, fence = 'facts-t3st', date = '2026-10-08'] = a;
    const d = adopt(T, src);
    const json = JSON.stringify({ ...d, exported: FIXED_TS }, null, 1);   // exactly as exportJSON() writes it
    const md = await T.storyMarkdown(d, { json, file: require('path').basename(outJson), date, fence, prev });
    fs.writeFileSync(outJson, json); fs.writeFileSync(outMd, md.text);
    console.log(`wrote ${outJson} ${outMd} (${md.facts.length} fact lines)`);
  } else if (cmd === 'sha') {
    const ctx = load(false), T = ctx.__T; let bad = 0;
    const samples = ['', 'abc', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'é漢😀\n"\\', 'x'.repeat(100000)];
    for (const s of samples) { const want = nodeCrypto.createHash('sha256').update(s, 'utf8').digest('hex'); const got = T.sha256hexSync(s); if (got !== want) { bad++; console.log('FAIL len=' + s.length); } }
    ctx.crypto = globalThis.crypto; const viaSubtle = await T.sha256hex('abc');
    if (viaSubtle !== nodeCrypto.createHash('sha256').update('abc').digest('hex')) { bad++; console.log('FAIL subtle path'); }
    console.log(bad ? `SHA FAIL ${bad}` : `SHA OK ${samples.length + 1} samples (built-in and crypto.subtle)`); process.exit(bad ? 1 : 0);
  } else if (cmd === 'roundtrip') {
    const ctx = load(true), T = ctx.__T; const d = adopt(T, rest[0]);
    const want = d.pages.map(p => [...p.nodes, ...p.links].map(T.refOf).sort().join(' '));
    const facts0 = T.factsOf(d).join('\n');
    let bad = 0, factsChanged = 0;
    const check = (name, pages) => {
      const got = pages.map(p => [...p.nodes, ...p.links].map(x => (x.data && x.data.tf_ref) || '(none)').sort().join(' '));
      const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) bad++;
      console.log(`${ok ? 'KEPT' : 'LOST'} ${name}: ${ok ? want.join(' | ').split(' ').length + ' handles' : '\n  want ' + want.join(' | ') + '\n  got  ' + got.join(' | ')}`);
      // does the story's fact list survive too? (layer ids, coordinates and page ids may be rewritten by the format)
      const f1 = T.factsOf({ name: d.name, pages }).filter(x => !x.startsWith('DOC '));
      const f0 = T.factsOf(d).filter(x => !x.startsWith('DOC '));
      const lost = f0.filter(x => !f1.includes(x)), extra = f1.filter(x => !f0.includes(x));
      console.log(`  ${lost.length || extra.length ? 'FACTS CHANGED' : 'FACTS SAME'} after ${name} (${f0.length} lines)` + lost.map(x => '\n    - ' + x).join('') + extra.map(x => '\n    + ' + x).join(''));
      if (lost.length || extra.length) factsChanged++;
    };
    // JSON
    const j = T.normalizeDoc(JSON.parse(JSON.stringify({ ...d, exported: FIXED_TS }))); check('JSON', j.pages);
    // draw.io
    try { const xml = T.buildDrawio(d); const back = await T.parseDrawio(xml); check('draw.io', back.pages || back); }
    catch (e) { bad++; console.log('ERROR draw.io: ' + e.message); }
    // Visio (.vsdx built and read by TopoForge itself; Visio 2010 not involved)
    try { const buf = await T.buildVsdx(d); const ab = buf instanceof ctx.Blob || (globalThis.Blob && buf instanceof globalThis.Blob) ? await buf.arrayBuffer() : buf; const back = await T.parseVsdx(ab); check('Visio .vsdx (TopoForge to TopoForge)', back.pages || back); }
    catch (e) { bad++; console.log('ERROR vsdx: ' + e.message); }
    // facts after a JSON round trip must be byte-identical
    T.DOC = j; T.reindex(); const facts1 = T.factsOf(j).join('\n');
    console.log(facts0 === facts1 ? 'SAME facts after JSON round trip' : (bad++, 'DIFFERENT facts after JSON round trip'));
    console.log(factsChanged ? `NOTE: facts changed in ${factsChanged} format(s); see above` : 'facts unchanged in every format');
    process.exit(bad ? 1 : 0);
  } else { console.error('unknown command ' + cmd); process.exit(2); }
})().catch(e => { console.error('HARNESS ERROR: ' + (e && e.stack || e)); process.exit(2); });
