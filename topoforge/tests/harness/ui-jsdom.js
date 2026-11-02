// SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
// Copyright 2026 Bryant Frankford <nathanielfrankford@gmail.com> and Corwin Brust <corwin@bru.st> and Contributors
// Written by Mentat (for Corwin; claude-opus-5-5).
// Boots the whole app in jsdom (NODE_PATH must hold jsdom) and drives the Story tab:
// tabs by keyboard, live region, ref buttons, change list, unique handles on duplicate, download.
//   NODE_PATH=/path/to/node_modules node tests/harness/ui-jsdom.js index.html
// jsdom is not a browser: no layout, no real screen reader. Prints what it saw; read it.
const { JSDOM } = require('jsdom'); const fs = require('fs');
const html = fs.readFileSync(process.argv[2], 'utf8');
const errors = [];
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'file:///tmp/index.html',
  beforeParse(w) {
    w.TextEncoder = TextEncoder; w.ResizeObserver = class { observe() {} disconnect() {} };
    w.matchMedia = () => ({ matches: false, addEventListener() {} });
    w.SVGElement.prototype.getBBox = () => ({ x: 0, y: 0, width: 10, height: 10 });
    w.SVGElement.prototype.getScreenCTM = () => ({ inverse: () => ({}) });
    w.Element.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 700, right: 1000, bottom: 700, x: 0, y: 0 });
    w.CSS = { escape: s => s.replace(/["\\]/g, '\\$&') };
    w.URL.createObjectURL = () => 'blob:x'; w.URL.revokeObjectURL = () => {};
    w.addEventListener('error', e => errors.push(e.message));
    w.__downloads = [];
  } });
const w = dom.window, d = w.document;
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await wait(300);
  // capture downloads
  const origClick = w.HTMLAnchorElement.prototype.click;
  w.HTMLAnchorElement.prototype.click = function () { w.__downloads.push(this.download); };
  const T = w.TopoForge; const out = [];
  out.push('nodes after boot (sample): ' + T.doc.pages[0].nodes.length);
  out.push('every shape has tf_ref: ' + T.doc.pages.every(p => [...p.nodes, ...p.links].every(x => /^[a-z0-9][a-z0-9._-]*$/.test(x.data.tf_ref || ''))));
  const tabs = [...d.querySelectorAll('.tabs [role=tab]')].map(b => `${b.textContent.replace(/\d+$/, '')}:${b.getAttribute('aria-selected')}:${b.tabIndex}`);
  out.push('tabs: ' + tabs.join(' '));
  // keyboard: focus Properties tab, press End -> Story
  const t0 = d.querySelector('#tabbtn-props'); t0.focus();
  t0.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'End', bubbles: true }));
  await wait(50);
  out.push('after End key: active=' + d.activeElement.id + ' story hidden=' + d.querySelector('#tab-story').hidden + ' aria-selected=' + d.querySelector('#tabbtn-story').getAttribute('aria-selected'));
  const live = d.querySelector('#storyLive');
  out.push('live region: role=' + live.getAttribute('role') + ' aria-live=' + live.getAttribute('aria-live'));
  out.push('story headings: ' + [...d.querySelectorAll('#storyBody h2, #storyBody h3')].map(h => h.textContent).join(' | '));
  out.push('ref buttons: ' + d.querySelectorAll('#storyBody button.ref').length + ', first aria-label=' + d.querySelector('#storyBody button.ref').getAttribute('aria-label'));
  out.push('about text: ' + d.querySelector('#storyAbout').textContent.slice(0, 60) + '...');
  // click a ref -> selection
  const rb = [...d.querySelectorAll('#storyBody button.ref')].find(b => !b.dataset.tfref.startsWith('page-'));
  rb.click(); await wait(20);
  out.push('clicked ref ' + rb.dataset.tfref + ' -> selected ' + JSON.stringify([...(w.eval('S.sel'))]));
  // edit: rename selected shape through the model and see the live change list
  w.eval(`edit(() => { const n = N([...S.sel][0]) || LK([...S.sel][0]); n.text = 'Renamed thing'; })`);
  await wait(800);
  out.push('live region now: ' + live.textContent);
  out.push('recent changes: ' + d.querySelector('#storyChanges').textContent.slice(0, 120));
  // add a node via paste/duplicate -> must get its own unique ref
  w.eval(`cmdDuplicate()`); await wait(800);
  const refs = T.doc.pages[0].nodes.map(n => n.data.tf_ref); out.push('duplicate keeps refs unique: ' + (new Set(refs).size === refs.length));
  out.push('undo stack len after duplicate: ' + w.eval('H.undo.length'));
  // export menu item exists
  const items = w.eval(`MENUS.file().filter(x => x && x.label).map(x => x.label)`);
  out.push('File menu has story export: ' + items.some(l => /Story/.test(l)));
  // download button
  d.querySelector('[data-story-dl]').click(); await wait(700);
  out.push('downloads: ' + JSON.stringify(w.__downloads));
  out.push('about version: ' + (w.eval('TF_VERSION')));
  out.push('errors: ' + JSON.stringify(errors));
  console.log(out.join('\n'));
  process.exit(0);
})().catch(e => { console.error('UI TEST ERROR', e); process.exit(2); });
