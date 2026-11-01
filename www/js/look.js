// SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
// Copyright 2026 Bryant Frankford <nathanielfrankford@gmail.com> and
// Corwin Brust <corwin@bru.st> and Contributors
//
// look.js -- put the person's look on the page before it is drawn, so
// nothing flashes.  Reads two small things this browser keeps:
//   topology.state  (the app's settings): its "treatment"
//   topology.look   {"palette":"egad|original", "theme":"auto|light|dark"}
// and writes data-treatment, data-palette and data-theme on <html>.
// Never throws; with no storage the page keeps its defaults (egad, system light/dark).
(function () {
  var r = document.documentElement;
  function read(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  var s = read('topology.state'), l = read('topology.look');
  if (s && s.treatment) r.dataset.treatment = s.treatment;
  if (l && l.palette === 'original') r.dataset.palette = 'original';
  if (l && (l.theme === 'light' || l.theme === 'dark')) r.dataset.theme = l.theme;
})();
