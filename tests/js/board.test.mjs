// SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
// board.test.mjs -- topology board (www/board/index.html): its promises read from the file, and for each a planted fault it must catch.
//   B1 one file: no script, style or font is fetched from anywhere (no src= or href= to another site, no @import, no url(http)).
//   B2 every button written in the page says what it does (text or aria-label); the page has a language and a title.
//   B3 the brushes it shares with topology paint carry paint's numbers (size, hardness, pressure_size, min_size, smoothing),
//      read from paint/src/core/brush.c, so a change in paint shows here.
//   B4 it asks its host only at a path under its own (./api), never at a named site.
// Mentat (for Corwin, claude-opus-5-5)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const page = readFileSync(new URL('../../www/board/index.html', import.meta.url), 'utf8');
const brushC = new URL('../../paint/src/core/brush.c', import.meta.url);

const B1 = t => [...t.matchAll(/\s(?:src|href)\s*=\s*["']?(https?:)?\/\//gi)].length === 0 && !/@import|url\(\s*["']?https?:/i.test(t);
const B2 = t => /<html lang="[a-z]{2}/.test(t) && /<title>[^<]+<\/title>/.test(t) &&
  [...t.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].every(([, a, inner]) => /aria-label="[^"]+"/.test(a) || inner.replace(/<[^>]+>/g, '').trim());
const B4 = t => !/fetch\(\s*["'`]https?:/.test(t) && /location\.pathname[^\n]*'\/api'/.test(t);
function B3(t, c) {
  const paint = {}; for (const m of c.matchAll(/"name=([^\\]+)\\n([^"]+)"/g)) paint[m[1]] = Object.fromEntries(m[2].split('\\n').map(kv => kv.split('=')).map(([k, v]) => [k, +v]));
  const ours = {}; for (const m of t.matchAll(/'([A-Z][\w ]+)':\s*\{([^}]+)\}/g)) ours[m[1]] = Object.fromEntries([...m[2].matchAll(/(\w+):\s*([\d.]+)/g)].map(([, k, v]) => [k, +v]));
  const shared = Object.keys(ours).filter(n => paint[n]); if (shared.length < 4) return false;
  return shared.every(n => ['size', 'hardness', 'pressure_size', 'min_size', 'smoothing'].every(k => paint[n][k] === undefined || ours[n][k] === undefined ? true : paint[n][k] === ours[n][k]));
}

test('B1 one file, nothing fetched from another site', () => { assert.ok(B1(page)); assert.ok(!B1(page.replace('<style>', '<script src="https://cdn.example/x.js"></script><style>')), 'planted: a CDN script'); });
test('B2 buttons say what they do; lang and title', () => { assert.ok(B2(page)); assert.ok(!B2(page.replace('<button class="x" data-close="tags" aria-label="Hide the tag palette">×</button>', '<button class="x"></button>')), 'planted: a mute button'); });
test('B3 the shared brushes carry topology paint\'s numbers', { skip: !existsSync(brushC) && 'paint/ is not in this tree' }, () => {
  const c = readFileSync(brushC, 'utf8'); assert.ok(B3(page, c)); assert.ok(!B3(page.replace("'Pencil':      { size: 4,", "'Pencil':      { size: 5,"), c), 'planted: Pencil drifts from paint'); });
test('B4 the host is asked under the page\'s own path', () => { assert.ok(B4(page)); assert.ok(!B4(page.replace("fetch(base + '/hello'", "fetch('https://example.org/hello'")), 'planted: a named site'); });
