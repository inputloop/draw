// SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
// The app in a real browser: the upgrade wizard (export before, Accept all,
// the summary tree, export after, ACCEPT) and drawing a graph from an API.
// usage: node tests/browser/app.browser.mjs SITE_URL API_URL
// Needs Playwright with a Chromium (PW_MODULE to point at it).  Exit 0 green, 1 red, 2 kit broken.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw; try { pw = require(process.env.PW_MODULE || 'playwright'); } catch (e) { console.log('KIT BROKEN: no playwright'); process.exit(2); }
const [site, api] = process.argv.slice(2);
if (!site || !api) { console.log('usage: app.browser.mjs SITE_URL API_URL'); process.exit(2); }
const results = []; const check = (ok, what) => { results.push([!!ok, what]); console.log((ok ? 'ok   ' : 'FAIL ') + what); };

const browser = await pw.chromium.launch();
const ctx = await browser.newContext({ acceptDownloads: true });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message));

// 1. the front door
await page.goto(site + '/index.html');
check(await page.getByRole('link', { name: 'Start now, share nothing' }).isVisible(), 'front door: the Zero Sharing way in is visible');
check(await page.getByRole('link', { name: 'Connect and draw' }).isVisible(), 'front door: the Connect way in is visible');
check(!(await page.locator('#ladder table').isVisible()), 'front door: the rest waits behind a link');

// 2. old settings in this browser, then the app
await page.evaluate(() => localStorage.setItem('topology.state', JSON.stringify({ schema: 1, api: 'http://example.invalid/api/v1', drawing: { pages: [] } })));
await page.goto(site + '/app.html#zero');
await page.getByRole('heading', { name: 'Your saved settings need an update' }).waitFor();
check(true, 'wizard: shown for schema-1 settings');
let dl = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export my settings now' }).click();
const before = await (await dl).path(); const fs = await import('node:fs');
check(JSON.parse(JSON.parse(fs.readFileSync(before, 'utf8')).raw).schema === 1, 'wizard: export before holds the old settings');
await page.getByRole('button', { name: 'Show me the changes' }).click();
check(await page.getByText('Change 1 of 5').isVisible(), 'wizard: one change at a time');
await page.getByRole('button', { name: 'Accept all: show the summary' }).click();
await page.getByRole('heading', { name: 'Summary' }).waitFor();
const tree = await page.locator('.tree').innerText();
check(/Person[\s\S]*Private parts get a setting/.test(tree), 'summary: grouped by pillar, privacy first');
check((await page.locator('.tree li').count()) >= 5, 'summary: every change listed');
check(JSON.parse(await page.evaluate(() => localStorage.getItem('topology.state'))).schema === 1, 'nothing changed before ACCEPT');
await page.getByLabel('Also export my settings after accepting').check();
dl = page.waitForEvent('download'); await page.getByRole('button', { name: 'ACCEPT' }).click();
const after = await (await dl).path();
check(JSON.parse(JSON.parse(fs.readFileSync(after, 'utf8')).raw).schema === 3, 'ACCEPT: export after holds the new settings');
const s = JSON.parse(await page.evaluate(() => localStorage.getItem('topology.state')));
check(s.schema === 3 && s.endpoints[0].url === 'http://example.invalid/api/v1' && s.drawings['my drawing'], 'ACCEPT: settings upgraded, nothing lost');

// 3. connect an API and draw
await page.locator('summary', { hasText: 'Add an address' }).click();
await page.getByLabel('Name').fill('test api');
await page.getByLabel('Address of a graph API').fill(api);
await page.getByRole('button', { name: 'Add' }).click();
await page.frameLocator('#tf').locator('body').waitFor();
await page.waitForFunction(() => document.getElementById('tf').contentWindow.TopoForge);
await page.getByRole('button', { name: 'Draw the graph' }).click();
await page.getByText(/Drew \d+ things/).waitFor({ timeout: 10000 });
check(true, 'draw: the graph reached TopoForge');
const kept = await page.locator('#priv-containers').innerText();
check(/the two files disagree/.test(kept), 'private: the seam between TOPOLOGY.md and .topology.md is shown');
check(/kept back \(decided by: component\)/.test(kept), 'private: says which setting decided');
await page.getByRole('button', { name: 'Go' }).click();
await page.getByText(/Not done: go is off/).waitFor();
check(true, 'go: refused while write is off, and says so');
check(await page.evaluate(() => !!document.getElementById('tf').contentWindow.TopoForge.integration), 'integration: the host object is set for TopoForge');
await page.getByLabel('Look', { exact: true }).selectOption('console');
check(await page.evaluate(() => document.documentElement.dataset.treatment) === 'console', 'treatment: console applies');
check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join('; ') : ''));
await browser.close();
const red = results.filter(r => !r[0]).length;
console.log(red ? `RED ${red} of ${results.length}` : `GREEN ${results.length} of ${results.length}`);
process.exit(red ? 1 : 0);
