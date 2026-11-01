// SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
// Copyright 2026 Bryant Frankford <nathanielfrankford@gmail.com> and
// Corwin Brust <corwin@bru.st> and Contributors
//
// topology-core.js -- the parts of Topology's browser app that are rules,
// not pictures: reading TOPOLOGY.md, deciding what private parts show,
// the settings kept in this browser and how an upgrade changes them, the
// notations a drawing can be read in, and the CSV TopoForge opens.
//
// No network, no DOM.  The page (www/app.html) does those; node runs the
// tests (tests/js/).  The TOPOLOGY.md rules are written a second time here,
// from spec/TOPOLOGY-md.md, beside the Perl in Topology::Doc.

// ---------------------------------------------------------------- TOPOLOGY.md

export function parseDoc(path, text) {
  const t = String(text);
  const lines = t === '' ? [] : t.split(/\r?\n/);
  const meta = {};
  let i = 0;
  if (lines.length && lines[0] === '---') {
    // front matter only if it closes; otherwise the whole file is body
    const close = lines.indexOf('---', 1);
    if (close > 0) {
      for (let j = 1; j < close; j++) {
        if (/^\s*(#|$)/.test(lines[j])) continue;
        const m = /^(\p{L}[\p{L}\p{N}_.-]*)\s*:\s*(.*?)\s*(?:#.*)?$/u.exec(lines[j]);
        if (m) meta[m[1].toLowerCase()] = m[2];
      }
      i = close + 1;
    }
  }
  const pub = [], priv = [];
  let inPrivate = 0, fence = null;
  for (; i < lines.length; i++) {
    const l = lines[i];
    let m;
    // a fenced code block (``` or ~~~) holds no headings
    if (fence !== null) { if (new RegExp('^ {0,3}' + fence.replace(/[`~]/g, c => '\\' + c) + '\\s*$').test(l)) fence = null; }
    else if ((m = /^ {0,3}(`{3,}|~{3,})/.exec(l))) fence = m[1];
    else if ((m = /^ {0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/.exec(l))) {
      const lvl = m[1].length, h = m[2].toLowerCase();
      if (h === 'private') { if (!inPrivate) inPrivate = lvl; continue; }
      if (inPrivate && lvl <= inPrivate) inPrivate = 0;
    }
    (inPrivate ? priv : pub).push(l);
  }
  const v = (meta.private || '').toLowerCase();
  return {
    path, meta, public: pub, private: priv,
    declared: v === 'show' || v === 'hide' ? v : null,
    list(key) { return (meta[key.toLowerCase()] || '').split(/[,;]/).map(s => s.trim()).filter(Boolean); },
  };
}

const GLOBAL = { always: 'show', never: 'hide', auto: 'auto' };
const LOCAL = { show: 'show', hide: 'hide', auto: 'auto' };

export function resolveShowPrivate({ container = '', global = 'auto', docs = [] } = {}) {
  const c = String(container || '').toLowerCase();
  const g = String(global || 'auto').toLowerCase();
  if (c && !Object.hasOwn(LOCAL, c)) throw new Error(`show-private: container setting '${c}' is not show, hide or auto`);
  if (!Object.hasOwn(GLOBAL, g)) throw new Error(`show-private: global setting '${g}' is not always, never or auto`);
  if (c === 'show' || c === 'hide') return { show: c === 'show', by: 'container', seam: null };
  if (!c && g !== 'auto') return { show: GLOBAL[g] === 'show', by: 'global', seam: null };
  const said = docs.filter(d => d.declared).map(d => [d.path, d.declared]);
  if (!said.length) return { show: false, by: 'default', seam: null };
  if (new Set(said.map(s => s[1])).size > 1)
    return { show: false, by: 'component', seam: said.map(s => `${s[0]} says ${s[1]}`).join(' / ') };
  return { show: said[0][1] === 'show', by: 'component', seam: null };
}

// ---------------------------------------------------------------- settings

export const STORAGE_KEY = 'topology.state';
export const SCHEMA = 3;

export function freshState() {
  return {
    schema: SCHEMA,
    endpoints: [],                       // [{ name, url, kind: 'own'|'ours'|'other' }]
    active: null,                        // name of the endpoint in use, or null (none)
    showPrivate: { global: 'auto', containers: {} },
    treatment: 'classic',
    notation: 'topology',
    drawings: {},                        // name -> { doc, savedAt, ancestor }
  };
}

// Each migration lists its changes before it makes them, so the wizard can
// show them one by one.  pillar and category place a change in the summary
// tree; tension names the pillar pair it pulls between, when it does.
// Categories, least to most weighty: look, setting, shape, privacy.
export const CATEGORY_ORDER = ['look', 'setting', 'shape', 'privacy'];

export const MIGRATIONS = [
  {
    from: 1, to: 2,
    changes: [
      { id: 'endpoint-list', pillar: 'place', category: 'shape',
        title: 'One API address becomes a list of addresses',
        detail: 'Your single "api" address is kept as the first entry, named "mine", and stays the one in use.' },
      { id: 'show-private', pillar: 'person', category: 'privacy',
        title: 'Private parts get a setting of their own',
        detail: 'Nothing new is shown: the global setting starts at auto, which shows a private part only when the component\'s own TOPOLOGY.md says show.',
        tension: ['place', 'person'] },
    ],
    apply(s) {
      const out = { ...s, schema: 2 };
      out.endpoints = s.api ? [{ name: 'mine', url: s.api, kind: 'own' }] : [];
      out.active = s.api ? 'mine' : null;
      delete out.api;
      out.showPrivate = { global: 'auto', containers: {} };
      return out;
    },
  },
  {
    from: 2, to: 3,
    changes: [
      { id: 'treatment', pillar: 'person', category: 'look',
        title: 'Choose how the app looks: classic, console or cards',
        detail: 'You keep the look you had (classic). The others are one click away in Settings.' },
      { id: 'notation', pillar: 'path', category: 'setting',
        title: 'Drawings can be read in a notation',
        detail: 'topology (as before), flowchart, BPMN or BPMN+. Your drawings are unchanged; the notation only changes how shapes are named and checked.',
        tension: ['part', 'path'] },
      { id: 'drawings-named', pillar: 'part', category: 'shape',
        title: 'Your drawing gets a name, and can have siblings',
        detail: 'The one drawing you had is kept, named "my drawing". Loading a file into it will offer to keep both instead of mixing them.' },
    ],
    apply(s) {
      const out = { ...s, schema: 3, treatment: s.treatment || 'classic', notation: 'topology' };
      out.drawings = s.drawing ? { 'my drawing': { doc: s.drawing, savedAt: null, ancestor: null } } : (s.drawings || {});
      delete out.drawing;
      return out;
    },
  },
];

// What an upgrade of this state would change.  No state: nothing to do.
export function planUpgrade(state) {
  if (!state) return { from: SCHEMA, to: SCHEMA, steps: [] };
  const from = state.schema || 1;
  if (from > SCHEMA) throw new Error(`settings are from a newer Topology (schema ${from}); this page knows ${SCHEMA}. Nothing was changed.`);
  const steps = MIGRATIONS.filter(m => m.from >= from && m.to <= SCHEMA);
  return { from, to: SCHEMA, steps, changes: steps.flatMap(m => m.changes.map(c => ({ ...c, from: m.from, to: m.to }))) };
}

export function applyUpgrade(state) {
  let s = state;
  for (const m of planUpgrade(state).steps) s = m.apply(s);
  return s;
}

// The summary tree the Accept All button jumps to: pillar, then category,
// then each change.  A level with one child is folded into its parent, so
// a small upgrade reads as a short list and a large one as a tree.
export function summaryTree(changes, taxonomy) {
  const pname = Object.fromEntries((taxonomy?.pillars || []).map(p => [p.id, p.name]));
  const byPillar = new Map();
  for (const c of changes) {
    if (!byPillar.has(c.pillar)) byPillar.set(c.pillar, new Map());
    const cats = byPillar.get(c.pillar);
    if (!cats.has(c.category)) cats.set(c.category, []);
    cats.get(c.category).push(c);
  }
  const tree = [];
  for (const [pillar, cats] of byPillar) {
    const kids = [...cats.entries()]
      .sort((a, b) => CATEGORY_ORDER.indexOf(b[0]) - CATEGORY_ORDER.indexOf(a[0]))
      .map(([cat, list]) => ({ label: cat, children: list.map(c => ({ label: c.title, change: c })) }));
    const node = { label: pname[pillar] || pillar, pillar, children: kids };
    if (kids.length === 1) node.children = kids[0].children.map(k => ({ ...k, category: kids[0].label }));
    tree.push(node);
  }
  // weightiest first: a pillar holding a privacy change comes first
  const weight = n => Math.max(...changes.filter(c => c.pillar === n.pillar).map(c => CATEGORY_ORDER.indexOf(c.category)));
  tree.sort((a, b) => weight(b) - weight(a));
  return tree.length === 1 && tree[0].children.length === 1 ? tree[0].children : tree;
}

// Everything under our key, as a file a person can keep.  storage is
// anything with getItem (localStorage, or a Map-backed stand-in in tests).
export function exportState(storage, when) {
  const raw = storage.getItem(STORAGE_KEY);
  return JSON.stringify({ exported: when || new Date().toISOString(), key: STORAGE_KEY, raw }, null, 2);
}

// ---------------------------------------------------------------- notations

// A notation says what a shape means.  It never changes the drawing; it
// changes the names in the palette and which checks run.  Shapes are
// TopoForge's own (see www/topoforge/index.html, defShape).
export const NOTATIONS = {
  topology: { name: 'Topology', about: 'devices, groups and links, as TopoForge draws them', elements: {} },
  flowchart: { name: 'Flowchart', about: 'start, step, decision, input/output, end',
    elements: { start: 'ellipse', step: 'rect', decision: 'diamond', io: 'parallelogram', end: 'ellipse', note: 'rounded' } },
  bpmn: { name: 'BPMN', about: 'events, tasks, gateways, lanes (a subset of BPMN 2.0 drawn with basic shapes)',
    elements: { event: 'ellipse', task: 'rounded', gateway: 'diamond', data: 'parallelogram', lane: 'zone', pool: 'site' } },
  bpmnplus: { name: 'BPMN+', about: 'BPMN, plus the three acts: describe, propose, effect, and the hand that says go',
    elements: { event: 'ellipse', task: 'rounded', gateway: 'diamond', data: 'parallelogram', lane: 'zone', pool: 'site',
      describe: 'rect', propose: 'hexagon', effect: 'triangle', go: 'user' } },
};

// ---------------------------------------------------------------- TopoForge

export const TOPOFORGE_CSV_COLS = ['name', 'type', 'hostname', 'ip', 'mac', 'vlan', 'status', 'vendor', 'model', 'notes', 'container', 'connects_to', 'x', 'y'];

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// graph: { nodes: [{ id, name, kind, container, connects: [], pillar, layer, ... }] }
// Extra columns carry pillar and layer; TopoForge keeps them as the shape's data.
export function graphToCSV(graph) {
  const extra = ['pillar', 'layer', 'tf_ref'];
  const rows = [[...TOPOFORGE_CSV_COLS, ...extra]];
  for (const n of graph.nodes || []) {
    const row = Object.fromEntries(TOPOFORGE_CSV_COLS.map(k => [k, '']));
    row.name = n.name || n.id;
    row.type = n.kind || 'server';
    row.hostname = n.hostname || '';
    row.notes = String(n.notes || '').split('\n').find(l => /\S/.test(l) && !l.startsWith('#')) || '';   // first line of prose
    row.container = n.container || '';
    row.connects_to = (n.connects || []).join(';');
    rows.push([...TOPOFORGE_CSV_COLS.map(k => row[k]), n.pillar || '', n.layer || '', n.id]);
  }
  return rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

// The integration object TopoForge's 2026-10-27 proposal names
// (c4 h/MODEL-2026-10-27-merge-and-literate-shape.md, section 2.C).
// TopoForge 1.7 does not read it yet; this app sets it so that a TopoForge
// that does finds a host, and so the contract has a second reader now.
export function makeIntegration(state, persist) {
  return {
    name: () => state.current || 'my drawing',
    ancestorFor: (doc) => {
      const d = state.drawings[state.current || 'my drawing'];
      return d && d.ancestor ? d.ancestor : null;
    },
    save: (name, doc, story) => {
      state.drawings[name] = { doc, story: story || null, savedAt: new Date().toISOString(),
        ancestor: (state.drawings[name] && state.drawings[name].ancestor) || null };
      persist(state);
      return true;
    },
  };
}
