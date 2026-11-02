# CANVAS 2026-11-01: roadmap to an endless stage you can illustrate on

The drawing app is **topology forge (formerly TopoForge)**, made by Bryant Frankford, with Corwin
Brust and contributors; code GPL-3.0-or-later OR LGPL-3.0-or-later, prose CC-BY-SA-4.0. Every stage
below that touches the app is a proposal into topology (branch `corwin`, `www/topoforge/`), credited
to Bryant as its maker, with a version bump, tested in his app's own kit (`topoforge/kit`, run by
`sh bin/test.sh`), and off unless a page turns it on, so the app opened on its own stays his
(the "rule zero" of `topoforge/spec/EMBED-v1.md`). Stages that change his file format need his
agreement first and are marked **format**.

Read with the three notes of the same date: `CANVAS-2026-11-01-why-two-navs.md` (why the page has
too many bars, and the free canvas), `CANVAS-2026-11-01-dive-in.md` (stepping inside a container),
`CANVAS-2026-11-01-illustration-ideation.md` (Penpot, Graphite, Inkscape, and the licences).

Design only; no code was changed for this note.

## Where we start (observed, 2026-11-01)

- On corwin.cloud at 1280 pixels: Bryant's top bar, shape palette, inspector, page tabs and overview
  map; our floating navigator and legend; the page's mode-line. The navigator and legend cover about
  57 % of the visible canvas on a first visit (measured; see the why-two-navs note).
- Bryant's app: pages, layers, containers that nest, connectors, three automatic layouts, undo of
  250 steps, zoom from 0.08 to 5 times, the Story (the drawing in words), imports and exports for
  draw.io, Visio, CSV, JSON, SVG, PNG and PDF. No pen tool, no booleans, no SVG import.
- But the file can already hold a free-form path: a shape of type `custom` carries `geom` (`d`, the
  SVG path data, with its width, height and fill), made today when a Visio file is imported, and kept
  through JSON, draw.io (`vcGeom`) and Visio (`VCGeom`) (`normNode` and the exporters). Styles keep
  `fill`, `stroke`, `color`, `fontSize`, `lineWidth`, `dash` and `bold`; custom fields (`data`) are
  kept as text. An unknown shape type becomes a rectangle, and an unknown style key is dropped, when
  a file is opened: so new *kinds* and new *style keys* are format changes, new `data` fields are not.
- In progress by another helper (1.8): frameless embedding, floating Properties and Shapes, page tabs
  in the overview map, a selection hook, a ready event.
- topology's `AGENTS.md` (as committed) still says "Keep www/topoforge/ unchanged"; 1.8 is being
  built in the working tree. Each stage that touches the app needs Corwin to have lifted that line.

## The smallest first stitch

**Commands as data.** Bryant's menus are already a table in his file (`const MENUS`: label, keys,
action, when it is disabled). Offer that table to the embedding page, read-only:

- `TopoForge.commands()` returns every menu item: group (File, Edit, Arrange, Layout, View, Help),
  label, keys, and whether it can run now (and if not, why, in words).
- `TopoForge.run(group, label)` runs one, exactly as clicking it would.
- corwin.cloud's prompt (today `Narrow:` in the navigator) lists them under "Do", beside "Find" (the
  navigator's things) and "Go" (the site's pages).

Why first: it is a few lines in Bryant's file, adds no pixel and no stored key (rule zero holds), and
it is what makes hiding every menu safe: once every command is reachable from one prompt, the bars
can fold away without losing anything.

- **Test** (kit, browser): every item of `MENUS` appears in `commands()` with its group and keys;
  `run('View', 'Zoom in')` changes the zoom as the menu does; a disabled item (Edit, Paste with an
  empty clipboard) refuses and says why. **Planted faults**: one item dropped from the list; `run`
  ignoring the disabled rule.
- **Second witness, another language** (his rule: new coverage in a language apart from the work and
  its first tests): a Perl check in topology's own tests reads the app's file and counts the `MENUS`
  labels, and must agree with the browser's count.
- **Falsifier**: a menu item a person can click that the prompt cannot run.

## The stages, in order

| # | Stage | Where | What a person gets | Test (each with a planted fault) | Falsifier |
|---|---|---|---|---|---|
| 0 | **Commands as data** (above) | app + site | every command from one prompt | above | a command not reachable from the prompt |
| 1 | **The free canvas** | site (uses 1.8's switches) | the drawing edge to edge; one prompt pill; the overview map with page strip; the title-block corner (Bryant, licence, link); "Show the bars" brings back his app as he made it | browser at 1280 and 390, light and dark: nothing but pill, map and corner over the canvas; the corner always visible (GPLv3 5(d) legal notices); Tab reaches pill, canvas, map, corner in that order; "Show the bars" restores every bar | a first-time visitor cannot find "export as SVG" within five minutes (hand test) |
| 2 | **Add without dragging** | app | choose a shape in the palette or the prompt and it is placed by the selection or at the centre of view; long-press opens the context menu on touch screens | kit: a shape added by one press, by keyboard, and by touch emulation; WCAG 2.5.7 | any drag-only action left (the a11y check walks every action) |
| 3 | **Dive in, inline** (view only) | app + site | step into a container; breadcrumbs; Alt+Up, Escape and Back climb; connectors crossing the edge as tabs; deep links in the address | the nine tests of the dive-in note | the drawing's file changes when you dive |
| 4 | **Dive in, linked** (`tf_page`; one `data` field, which older versions already keep) | app + drawings | the shop's project boxes on "The shop" become doors to their pages; the two page lists become one path | kit: a box with `tf_page` opens its page and the breadcrumb returns; an older copy of the app keeps the field as plain data | a linked box that opens the wrong page, or none, after its page is renamed |

**First cut line.** If time runs short, stop here. Stages 0 to 4 give Corwin's concept as he
described it: no borders or menus, a free-flowing canvas, and stepping inside a container so it
becomes the whole stage. Only stage 4 touches the file, and only by one field.

| # | Stage | Where | What a person gets | Test | Falsifier |
|---|---|---|---|---|---|
| 5 | **The endless stage** | app | wider zoom (proposed 0.01 to 64, to be tuned); small text hidden when too small to read and shown again; only what is in view is drawn | kit: a detail one pixel wide and a span of 10,000 pixels on one page, both reachable by zoom; a drawing of 9,000 shapes pans with no frame longer than 50 ms (9: house number, scaled; picked, not measured) | the drawing stutters at the shop's own size |
| 6 | **Pen tool** (no format change: it draws the `custom` shapes with `geom.d` the file already holds) | app | click to place points, drag for curves (and a keyboard route: points typed or nudged); edit nodes; close a path; exported to SVG, draw.io and Visio as Visio imports already are | kit: a path drawn by clicks only round-trips through JSON byte for byte, and through draw.io and Visio; its SVG export holds the same path data; 1.8 (before the pen tool) opens the file and shows the path; Perl's reader in topology accepts it | a file with pen paths loses them in any export Bryant's app offers, or in 1.8 |
| 7 | **Style**; **format** only for the new keys (gradients, opacity), since fill, stroke, dash and line width already exist | app | fill, stroke, dashes, gradients, opacity; colours chosen from tokens (egad's, so a drawing follows the house palette and its dark mode) | kit: a token-coloured shape changes with the theme; contrast of labels on fills measured (the a11y check already measures pairs); an older app drops only the new keys and keeps the shape | a label under the AA contrast ratio on a token fill |
| 8 | **Combine shapes** (booleans, and a Shape Builder like Inkscape's) | app | join, cut, intersect; click regions to keep or remove | kit: union of two squares is one path with the right area; every Shape Builder action has a keyboard and menu route | a combine that changes the outline of a shape it did not touch |
| 9 | **Artboards and SVG both ways** | app | a container marked as an artboard exports as SVG, PNG or PDF on its own; SVG can be opened (new: today the app writes SVG but does not read it); "finish it in Inkscape" works by file | kit: export an artboard, read it back, the shapes and paths match; a check with Inkscape's command line where Inkscape is installed (skipped, and said, where it is not) | an SVG the app wrote that it cannot read back |

**Second cut line.** Stop here for "Illustrator-like, first edition": paths, styles, booleans,
artboards, and a clean road to Inkscape for anything the app does not do.

| # | Stage | Where | What a person gets | Test | Falsifier |
|---|---|---|---|---|---|
| 10 | **Components and copies** **format** | app | save a container as a component; place copies; edit the original and the copies follow; detach a copy | kit: change the original, every copy changes; undo is one step; the Story says "a copy of" | a copy that drifts from its original without being detached |
| 11 | **Layout rules on containers** (in the manner of Penpot's flex and grid) | app | "stack these in a column, 8 px apart", kept as a rule, applied as children move | kit: adding a child re-lays the container; turning the rule off leaves shapes where they are | a rule that moves shapes outside its container |
| 12 | **Pictures** | app | place an image in the file (it stays in the file, nothing is fetched: Zero Sharing); crop; mask with a path | kit: an image round-trips; no request leaves the page | a network request when an image is placed |
| 13 | **Text for illustration** | app | text on a path; several styles in one label; fonts from the site only | kit: text on a path exports to SVG as `textPath`; the Story reads the words | text that a screen reader cannot read in the Story |
| 14 | **Effects** | app | shadows, blurs, glows as SVG filters, chosen from previews (Inkscape's filter gallery as the model) | kit: the effect appears in SVG export; with reduced motion, no animated effect | an effect that only the app can draw (lost in SVG) |
| 15 | **Freehand and brushes** (fine art) | app | a pencil that smooths into paths; pressure from a stylus where the browser reports it | kit: a stroke recorded by emulated pointer events becomes a path with width; with no pressure reported, a fixed width | a stroke that cannot be edited as a path afterwards |
| 16 | **Starting points** (the "Canva" part) | site + drawings | a gallery of starting drawings: the shop's own pages, a home network, a rack, a poster; open one, it becomes yours, kept in your browser | browser: each starting drawing opens and its credit shows | a starting drawing that replaces a visitor's own drawing without asking (the rule `stage.js` already keeps) |

## How the stages relate to the projects reviewed

- From **Penpot**: artboards (9), components (10), layout rules (11), tokens (7).
- From **Graphite**: the endless stage (5), booleans (8), and later, as an idea only, "two views of one
  document" (the shape and the recipe that drew it), which fits topology's files-to-drawing path.
- From **Inkscape**: pen tool (6), Shape Builder (8), filter gallery (14), axonometric grid (a small
  addition to 5 or 7), and SVG as the road between us (9).
- **No code is copied** from any of them in this plan. If that changes, the licence questions in the
  ideation note come first (the single-file question above all).

## What each stage costs Bryant's app, and how we keep it his

- Every stage is a switch (or a new menu item) that is off when the app is opened on its own, until
  he says otherwise.
- New things go into the file as `data` fields or as `custom` shapes with `geom` wherever they can,
  because his app already keeps both; a new shape *kind* or style key is a format change (an older
  version turns the kind into a rectangle and drops the key), so it waits for his agreement and a
  round-trip test.
- His name stays first: in the file's header, in AUTHORS, in About, and in corwin.cloud's title-block
  corner. Each stage's commit says "for topology forge (formerly TopoForge), Bryant Frankford's app".

## Concerns

- [HIS] "Reach for the stars" against Bryant's ownership: the plan grows his app a great deal.
  Falsifier: Bryant prefers the illustration features to live in a separate app that shares his file
  format; then stages 6 onward move there and stages 0 to 5 stay.
- [DOMAIN] Every format stage (7's new style keys, 10) is a promise to every future reader of the
  file; stage 4 adds only a `data` field, which older versions keep. Falsifier:
  the round-trip tests show an older app keeping the new data; if not, the stage waits.
- [PLATFORM] Pressure and tilt from styluses vary by browser and device. Falsifier: stage 15's test on
  the two browsers the site is tested in.
- [SKILL] Ordering is judged, not measured: by what unlocks the most for the least change to the
  file. Falsifier: Corwin wants illustration first (stage 6 before 3); the table re-sorts without
  other changes, since 6 does not depend on 3.
- [MINE] I would hold stage 15 (brushes) until someone actually asks to paint on it.

## Sources

- Corwin's words, 2026-11-01 20:51 (the brief).
- The three notes of the same date in this folder.
- topology, branch `corwin`: `www/topoforge/index.html` (Bryant Frankford's app: `MENUS`, `zoomAt`,
  the undo limit, the exporters), `topoforge/spec/EMBED-v1.md` (in progress), `AGENTS.md`,
  `topoforge/COPYING` (GPLv3 section 5(d)).
- corwin.cloud: `docs/NAV.md`, `docs/UI-AUDIT-2026-11-01.md`, `docs/AMBITIONS.md`; the live site,
  https://corwin.cloud/ (observed 2026-11-01).
- Penpot features (boards, components, tokens, flex and grid layout): https://github.com/penpot/penpot
- Graphite features and roadmap: https://graphite.art/features/
- Inkscape 1.4 release notes (Shape Builder, Filter Gallery, grids):
  https://wiki.inkscape.org/wiki/Release_notes/1.4
- W3C, Understanding WCAG 2.2, 2.5.7 Dragging Movements:
  https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html
- MDN, Pointer events (pressure, tilt): https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events
