// SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
// The examples under examples/ against the shared fixture spec/fixtures/examples.json,
// read by JavaScript.  The Perl twin is perl/Topology/t/70-examples.t.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as T from '../../www/js/topology-core.js';
import { walk } from '../make-examples-fixture.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fx = JSON.parse(readFileSync(root + 'spec/fixtures/examples.json', 'utf8'));
const tax = JSON.parse(readFileSync(root + 'taxonomy/pillars.json', 'utf8'));
const pillarOf = {}; for (const p of tax.pillars) for (const s of p.shapes) pillarOf[s] ??= p.id;
const docs = fx.files.map(f => ({ f, d: T.parseDoc(f.file, readFileSync(root + f.file, 'utf8')) }));
const SECRETISH = [/\b\d{1,3}(\.\d{1,3}){3}\b/, /(password|passwd|api[_-]?key|token)\s*[:=]/i, /\bghp_\w+/, /BEGIN [A-Z ]*PRIVATE KEY/];

test('the fixture lists every example on disk, and the JS reader agrees with it', () => {
  assert.deepEqual(walk(root + 'examples').map(p => p.slice(root.length)), fx.files.map(f => f.file));
  assert.ok(fx.files.length >= 30, 'the shop is drawn, not sketched');
  for (const { f, d } of docs) {
    assert.deepEqual(d.meta, f.meta, f.file + ' meta'); assert.deepEqual(d.public, f.public, f.file + ' public');
    assert.deepEqual(d.private, f.private, f.file + ' private'); assert.equal(d.declared, f.declared, f.file + ' declared');
  }
});

test('each example names itself, has a kind the taxonomy knows, and a pillar that agrees', () => {
  const names = new Set();
  for (const { f, d } of docs) {
    const n = d.meta.name, k = d.meta.kind;
    assert.ok(n && k, f.file + ' needs name and kind');
    assert.ok(!names.has(n), `${f.file}: name ${n} is used twice`); names.add(n);
    assert.ok(pillarOf[k.toLowerCase()], `${f.file}: kind ${k} is a gap in the taxonomy`);
    assert.equal(d.meta.pillar, pillarOf[k.toLowerCase()], `${f.file}: pillar says ${d.meta.pillar}, kind ${k} is ${pillarOf[k.toLowerCase()]}`);
  }
  for (const { f, d } of docs) for (const key of ['contains', 'connects'])
    for (const ref of d.list(key)) assert.ok(names.has(ref), `${f.file}: ${key} names ${ref}, which no example defines`);
});

test('the show-private rule: private projects hide, public ones carry no private part', () => {
  const mine = new Set(fx.private_projects);
  for (const { f, d } of docs) {
    const hasPriv = d.private.some(l => l.trim());
    if (mine.has(d.meta.name)) {
      assert.equal(d.declared, 'hide', f.file + ' is private and must say private: hide');
      assert.ok(hasPriv, f.file + ' is private and keeps its details under ## Private');
      assert.equal(T.resolveShowPrivate({ container: 'auto', global: 'auto', docs: [d] }).show, false, f.file + ' resolves to hidden');
    } else {
      assert.ok(!hasPriv, f.file + ' is public and must not carry a Private part');
      assert.notEqual(d.declared, 'show', f.file + ' says show, which an example should not decide for the reader');
    }
  }
});

test('nothing private reaches a public line, and nothing public looks like a credential', () => {
  const pub = docs.flatMap(({ d }) => d.public.concat(Object.values(d.meta)));
  for (const { f, d } of docs) for (const l of d.private.filter(l => l.trim().length >= 40))
    assert.ok(!pub.some(p => p.includes(l.trim())), `${f.file}: a private line appears in a public part: ${l.slice(0, 40)}`);
  for (const { f, d } of docs) for (const l of d.public.concat(Object.values(d.meta)))
    for (const re of SECRETISH) assert.ok(!re.test(l), `${f.file}: looks like a credential or address: ${l}`);
});
