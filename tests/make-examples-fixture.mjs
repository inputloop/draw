// SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
// Copyright 2026 Bryant Frankford <nathanielfrankford@gmail.com> and
// Corwin Brust <corwin@bru.st> and Contributors
//
// make-examples-fixture.mjs -- write spec/fixtures/examples.json: what the JS reader
// says of every TOPOLOGY.md under examples/.  The Perl test and the JS test both
// read the same files and must agree with this one (and so with each other).
// Run it after changing an example, and read the diff: it is the review.
//   node tests/make-examples-fixture.mjs [--check]     (--check: exit 1 if the file is stale)
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseDoc } from '../www/js/topology-core.js';

const root = fileURLToPath(new URL('../', import.meta.url));
export function walk(dir, out = []) {
  for (const n of readdirSync(dir).sort()) {
    const p = dir + '/' + n, st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (n === 'TOPOLOGY.md' || n === '.topology.md') out.push(p);
  }
  return out;
}
export function build() {
  const base = root + 'examples';
  const files = walk(base).map(p => {
    const rel = p.slice(root.length), d = parseDoc(rel, readFileSync(p, 'utf8'));
    return { file: rel, meta: d.meta, public: d.public, private: d.private, declared: d.declared };
  });
  return {
    about: 'Shared by perl/Topology/t/70-examples.t and tests/js/examples.test.mjs. Made by tests/make-examples-fixture.mjs; review the diff when it changes.',
    private_projects: ['obsmage', 'obsmage-corwin', 'about-corwin', 'gitcha', 'c4', 'topology'],
    files,
  };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const text = JSON.stringify(build(), null, 1) + '\n', out = root + 'spec/fixtures/examples.json';
  if (process.argv.includes('--check')) {
    let have = ''; try { have = readFileSync(out, 'utf8'); } catch (e) { /* missing */ }
    if (have !== text) { console.log('spec/fixtures/examples.json is stale: run node tests/make-examples-fixture.mjs'); process.exit(1); }
    console.log('examples fixture is current'); process.exit(0);
  }
  writeFileSync(out, text); console.log(`wrote ${out.slice(root.length)}: ${JSON.parse(text).files.length} files`);
}
