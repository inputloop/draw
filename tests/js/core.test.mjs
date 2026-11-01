// SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
// node --test tests/js/   (Node 18 or later; no packages)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as T from '../../www/js/topology-core.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fx = JSON.parse(readFileSync(process.env.TOPOLOGY_FIXTURES ? process.env.TOPOLOGY_FIXTURES + '/showprivate.json' : root + 'spec/fixtures/showprivate.json', 'utf8'));
const tax = JSON.parse(readFileSync(root + 'taxonomy/pillars.json', 'utf8'));
const doc = Object.fromEntries(Object.entries(fx.files).map(([k, v]) => [k, T.parseDoc(k, v)]));

test('TOPOLOGY.md parse: the shared cases', () => {
  for (const p of fx.parse) {
    const d = doc[p.file];
    assert.deepEqual(d.meta, p.meta, p.file + ' meta');
    assert.deepEqual(d.public, p.public, p.file + ' public');
    assert.deepEqual(d.private, p.private, p.file + ' private');
    assert.equal(d.declared, p.declared, p.file + ' declared');
  }
});

test('show private: the shared cases', () => {
  for (const r of fx.resolve) {
    const got = T.resolveShowPrivate({ container: r.container, global: r.global, docs: r.docs.map(n => doc[n]) });
    assert.equal(got.show, r.show, r.name + ' show');
    assert.equal(got.by, r.by, r.name + ' by');
    assert.equal(!!got.seam, r.seam, r.name + ' seam');
  }
  for (const e of fx.errors)
    assert.throws(() => T.resolveShowPrivate({ container: e.container, global: e.global }), /show-private/, e.name);
});

test('upgrade: schema 1 to 3 keeps what the person had', () => {
  const old = { schema: 1, api: 'https://example.org/api', drawing: { pages: [] }, treatment: 'classic' };
  const plan = T.planUpgrade(old);
  assert.equal(plan.from, 1); assert.equal(plan.to, T.SCHEMA);
  assert.equal(plan.changes.length, 5);
  const s = T.applyUpgrade(old);
  assert.equal(s.schema, T.SCHEMA);
  assert.deepEqual(s.endpoints, [{ name: 'mine', url: 'https://example.org/api', kind: 'own' }]);
  assert.equal(s.active, 'mine');
  assert.equal(s.showPrivate.global, 'auto');
  assert.ok(s.drawings['my drawing']);
  assert.equal(s.api, undefined); assert.equal(s.drawing, undefined);
  assert.deepEqual(old.api, 'https://example.org/api', 'the old state object is not changed');
});

test('upgrade: current state needs nothing, newer state is refused', () => {
  assert.equal(T.planUpgrade(T.freshState()).steps.length, 0);
  assert.throws(() => T.planUpgrade({ schema: T.SCHEMA + 1 }), /newer Topology/);
});

test('summary tree: pillars, privacy first, every change once', () => {
  const tree = T.summaryTree(T.planUpgrade({ schema: 1 }).changes, tax);
  assert.equal(tree[0].pillar, 'person', 'the pillar with a privacy change leads');
  const leaves = []; const walk = n => n.change ? leaves.push(n.change.id) : (n.children || []).forEach(walk);
  tree.forEach(walk);
  assert.deepEqual(leaves.sort(), ['drawings-named', 'endpoint-list', 'notation', 'show-private', 'treatment']);
  for (const id of leaves) assert.ok(tax.pillars.some(p => p.id === T.MIGRATIONS.flatMap(m => m.changes).find(c => c.id === id).pillar), id + ' has a known pillar');
});

test('export: before and after are files a person can keep', () => {
  const m = new Map([[T.STORAGE_KEY, JSON.stringify({ schema: 1 })]]);
  const store = { getItem: k => m.get(k) ?? null };
  const out = JSON.parse(T.exportState(store, 'T0'));
  assert.equal(out.key, T.STORAGE_KEY); assert.equal(JSON.parse(out.raw).schema, 1); assert.equal(out.exported, 'T0');
});

test('TopoForge CSV: its columns, quoted cells, pillar and layer carried', () => {
  const csv = T.graphToCSV({ nodes: [
    { id: 'host:gw26', name: 'gw26', kind: 'server', container: 'bru.st', connects: ['gw7', 'gw14'], pillar: 'place', layer: 'physical' },
    { id: 'repo:c4', name: 'c4, the repo', kind: 'storage', notes: 'say "hi"', pillar: 'place' } ] });
  const lines = csv.trim().split('\r\n');
  assert.equal(lines[0], T.TOPOFORGE_CSV_COLS.join(',') + ',pillar,layer,tf_ref');
  assert.match(lines[1], /^gw26,server,.*,bru\.st,gw7;gw14,,,place,physical,host:gw26$/);
  assert.match(lines[2], /^"c4, the repo",storage,.*"say ""hi"""/);
});

test('notations: every element names a TopoForge shape', () => {
  const tf = readFileSync(root + 'www/topoforge/index.html', 'utf8');
  const shapes = new Set([...tf.matchAll(/defShape\('([a-z0-9]+)'/g)].map(m => m[1]));
  assert.ok(shapes.size > 30, 'read TopoForge shapes');
  for (const [k, n] of Object.entries(T.NOTATIONS)) for (const [e, s] of Object.entries(n.elements))
    assert.ok(shapes.has(s), `${k}.${e} -> ${s} is a TopoForge shape`);
  for (const p of tax.pillars) for (const s of p.shapes) assert.ok(shapes.has(s), `pillar ${p.id} shape ${s}`);
});
