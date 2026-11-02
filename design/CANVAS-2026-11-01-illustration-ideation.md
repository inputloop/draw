# CANVAS 2026-11-01: illustration and fine art, from three free-software projects

The drawing app is **topology forge (formerly TopoForge)**, made by Bryant Frankford, with Corwin
Brust and contributors; code GPL-3.0-or-later OR LGPL-3.0-or-later, prose CC-BY-SA-4.0. This note
looks at three free-software design programs for ideas to grow his app toward illustration, and at
whether a closer relationship with any of them is possible under the licences. Design only.

**I am not a lawyer. Nothing here is legal advice.** The licence section is a careful reading of
the licences and of what their own stewards say about them, written so a lawyer's time is spent on
the right questions.

## His words

> If we want to reach for the stars on this one (and I do) the ask here would be: how much canva and
> -again- illustrator like functionality could we add onto this. [...] This ups the ask by calling
> for illustration and fine art features. Maybe some of the recent free software packages made to
> emulate Adobe Creative Cloud can inspire us: this might be a good time to try three layer modeling
> as we review a project or three of that sort for creative and technical ideation. Of course, if the
> licensing is compatible, we can potentially consider a closer relationship: careful analysis is
> required.

## What "three layer modeling" means here (my reading)

"Three layer modeling" is not defined in anything I was given. I read it as looking at each project
three times, from three different heights, and keeping the three apart:

1. **Creative layer**: what a person can *make* with it, and which of its features are worth
   borrowing for an endless stage.
2. **Technical layer**: how it is *built*: architecture, file format, what it runs on, whether it
   can be embedded, its size, its accessibility.
3. **Relationship layer**: how we could *stand* toward it: its exact licence and how that fits ours,
   whether we could embed it, link to it, trade files with it, borrow ideas only, or give back
   upstream; and its health (who steers it, how recently it shipped).

Falsifier for the reading: Corwin meant something else (for instance the three rings of the house,
or three layers of a drawing). Then the facts below stay and only the grouping is redone.

## Why these three

Picked from the programs usually named as free replacements for Adobe's suite, for closeness to
*this* app: a drawing in the browser, on an endless canvas, with containers.

| Picked | It stands in for | Why it is here |
|---|---|---|
| **Penpot** | Figma, Adobe XD | Runs in the browser; boards (artboards), components, layout rules: the "Canva" half of his ask, and the closest to "dive into a frame". |
| **Graphite** | Illustrator, Photoshop (planned) | Runs in the browser; a vector editor on an endless canvas whose layers and node graph are two views of one document; built in Rust and WebAssembly: the "reach for the stars" technical bet. |
| **Inkscape** | Illustrator | The deep illustration tool of the GNU world; its file format is SVG, which Bryant's app already exports; licensed in the GPL family: the "fine art" half, and the easiest relationship. |

Also considered, not reviewed in depth:

- **Krita** (painting; KDE). Its newest tag is v6.0.4.1, dated 2026-09-30 (KDE's GitLab). Brushes
  and painting come late on the roadmap; its ideas are kept for that stage.
- **Excalidraw**: MIT licence (its `LICENSE` file); an endless whiteboard in the browser. Small and
  embeddable, but sketch-style only; less to learn from for illustration than the three above.
- **tldraw**: not free software. Its `LICENSE.md` is "tldraw license", a licence "from tldraw, Inc."
  that "governs your use". Avoid its code; ideas only, and with care.

---

## 1. Penpot

### Creative layer

What a person makes: interface designs, prototypes, design systems; vector work as part of that.

| Feature | Seen in | Worth borrowing for topology forge? |
|---|---|---|
| Boards (artboards) inside an endless canvas | README; changelog ("shareable board links", 2.5) | **Yes**: a container that is also an export frame = an artboard. With diving (see the dive-in note), a board is a place you can step into. |
| Components and **variants** | changelog (variants fixes in 2.17 and 2.18) | **Yes, later**: a container saved as a component, placed many times, edited once. The shop's "project box" is drawn 21 times today. |
| **Design tokens** (named colours, sizes) with libraries | README; 2.19 "internal libraries and file sync for Design Tokens" | **Yes**: topology already shares egad's tokens; shapes could take a token for fill and stroke, so a drawing follows the house palette and its dark mode. |
| **Flex and Grid layout** (CSS-like rules for a board's children) | README | **Yes, for containers**: "lay out this rack's devices in a column, 8 px apart". Bryant's app has whole-page layouts (tree, radial, organic, grid); this is the same idea inside one container, kept as a rule. |
| Path editor, per-side stroke widths | 2.19 (unreleased) | Pen tool: yes (see roadmap). |
| Inspect tab giving SVG, CSS and HTML | README | **Yes, in spirit**: Bryant's Story already writes the drawing in words; "the drawing as SVG for this container" is the same gesture. |
| An MCP server so AI tools can read and change designs | README; changelog (many MCP fixes) | Interesting, and close to topology's "Copy as a prompt" (propose). Not for the first stages. |

### Technical layer

- **Architecture** (observed in the repository at commit bd7239a0, 2026-11-01): a ClojureScript
  front end and a Clojure back end (`deps.edn`, `frontend/`, `backend/`, `common/`), an `exporter`,
  an `mcp` server, `plugins`, and `render-wasm`: a Rust renderer compiled to WebAssembly that uses
  Skia (`skia-safe` 0.153.3 in its `Cargo.toml`). The changelog says the prototype viewer now
  renders "with WASM (Skia) engine instead of SVG".
- **Runs as**: a server. Its compose file starts the front end, back end, admin console, MCP server
  and exporter, plus PostgreSQL 15, Valkey 8.1 and a mail catcher.
- **File format**: `.penpot` (a "new .penpot file format" in the changelog), a ZIP holding JSON
  entries (the changelog's import limits on "ZIP JSON entry" and "V3 binfile"). It imports and
  exports SVG.
- **Embeddable?** Not as a widget in our page: it is a whole service with a database. It can be
  self-hosted beside us and linked to; plugins run inside Penpot, not the other way round.
- **Size**: large (a multi-service deployment); not a fit for "everything stays in your browser".
- **Accessibility**: there is an accessible context-menu component in its front end
  (`context_menu_a11y.cljs`) and older changelog entries for keyboard and dashboard accessibility.
  I did not find a conformance statement (I did not look for one at length).

### Relationship layer

- **Licence**: **MPL-2.0** (`LICENSE`; file headers "This Source Code Form is subject to the terms
  of the Mozilla Public License, v. 2.0"; copyright KALEIDOS SUBSIDIARY SL). The one file header I read
  (`frontend/src/app/main.cljs`) carries no Exhibit B notice ("Incompatible With Secondary
  Licenses"); `render-wasm/src/main.rs` has no licence header at all. Checking every file is a task
  for the day any code would cross.
- **Fit with ours**: MPL-2.0 lets its files be combined with (L)GPL code in a larger work, as long as
  the code is not marked "Incompatible With Secondary Licenses" (Mozilla's MPL FAQ, Q14; and "The
  notice in Exhibit B is not considered 'attached' merely by being present as the Exhibit B of a
  copy of the full MPL 2"). The MPL files stay MPL. **Verdict: compatible with both our code
  options, with conditions; not needed, since we would not copy its code.**
- **What we could do**: borrow ideas; trade drawings as SVG (Bryant's app exports SVG per page); link
  to a Penpot a visitor runs. Embedding: no (a service). Contributing upstream: possible; its
  contribution terms not checked here.
- **Health and governance**: steered by Kaleidos (copyright holder); marked "Verified DPG" (Digital
  Public Good) in its README. Releases: 2.18.0 on GitHub "23 Sep" (the page shows no year); Docker
  Hub dates 2.18.1 on 2026-10-01, 2.18.3 on 2026-10-06, 2.18.4 on 2026-10-23, 2.18.5 on 2026-10-26;
  2.19.0 is in progress. The 300 newest commits on `develop` run from 2026-04-23 to 2026-11-01 under
  118 author names. Healthy and busy.

---

## 2. Graphite

### Creative layer

What a person makes: vector art and graphic design today; procedural (generated) art through its
node graph; raster editing "limited, experimental". Planned: photo editing, motion graphics, digital
painting, desktop publishing, compositing.

| Feature | Seen in | Worth borrowing? |
|---|---|---|
| **Layers and node graph as two views of one document**; canvas tools edit the nodes behind the scenes | features page; README | **Yes, as an idea**: topology already has two views of one thing (the `TOPOLOGY.md` files and the drawing). A "show the recipe" view of a shape (where it came from, which file, which rule drew it) is the same move. |
| **Nondestructive** editing (every change is a step you can revisit) | README | Partly: Bryant's undo keeps 250 steps; a kept history per shape is far later. |
| Endless canvas, artboards | the editor (not re-checked today) | Already ours in part; diving adds the rest. |
| **Boolean operations** | roadmap: "a more robust version in Alpha 5" | **Yes**: union, subtract, intersect for shapes; see the roadmap. Graphite uses a library named `linesweeper` 0.4 for this kind of work (its `Cargo.toml`); its licence would need checking before any use. |
| Brushes with pressure and tilt | roadmap (Alpha 5, Beta 2) | Later; the fine-art stage. |
| Keyframe animation | roadmap ("late 2026") | Not for us now. |

### Technical layer

- **Architecture** (its contributor guide and repository at commit cd0498b, 2026-11-02): the editor is
  Rust compiled to WebAssembly ("where all the business logic occurs"); the user interface is
  TypeScript and Svelte (Svelte 5.55, Vite 8 in `frontend/package.json`), kept "as lightweight and
  minimal as possible"; documents are rendered by Graphene, a node-graph engine that "is itself a
  programming language". Rendering libraries in `Cargo.toml`: kurbo 0.13, vello (a fork), usvg 0.47,
  wgpu 30. There are desktop crates for Linux, macOS and Windows.
- **Runs as**: a web app (editor.graphite.art) and a desktop app in release candidates.
- **File format**: its own; "Stable document format" is planned for Alpha 5, so files are not yet
  promised to open in later versions. Exports SVG and images (not re-checked today).
- **Embeddable?** Not as a component today: it is a whole application, large (WebAssembly plus GPU).
  Pieces of it are separate Rust crates, which is how code could be reused.
- **Accessibility**: "Internationalization and accessibility" appears under its long-term releases on
  the roadmap, with no detail. Judged: not ready for our accessibility floor.

### Relationship layer

- **Licence**: **MIT OR Apache-2.0**, the reader's choice. Observed at commit cd0498b: README "dual-licensed
  under your choice of either the MIT license or the Apache License 2.0"; `LICENSE-MIT` and
  `LICENSE-APACHE` at the top; `license = "MIT OR Apache-2.0"` in `Cargo.toml`. (GitHub's page, read
  the same day through a fetch tool, still said Apache-2.0 with a `LICENSE.txt`; the repository is
  what counts, and when the change happened I did not find.)
- **Fit with ours**: MIT can go into GPL-3.0-or-later and LGPL-3.0-or-later work; Apache-2.0 can go
  into GPLv3 work ("Apache 2 software can therefore be included in GPLv3 projects", Apache's own
  page) but not GPLv2. Taking it under MIT is the simplest. **Verdict: compatible, one way (their
  code into ours, with their notices kept).**
- **What we could do**: borrow ideas freely; reuse a small Rust crate compiled to WebAssembly later
  (a boolean-operations or path library) if one is worth its size; trade files as SVG; contribute
  upstream (contributions must be offered under both MIT and Apache-2.0, per its README).
- **Health and governance**: alpha. Its "latest-stable" release is a moving tag (GitHub: "released
  04 Feb", no year); the tag points at a commit dated 2026-07-01, "Prep for the RC6 release of the
  desktop app". The 200 newest commits on `master` run from 2026-10-07 to 2026-11-02 and come from 6
  names, two of them making 177 (119 and 58). Very active, with a small core: if those two stop, it
  slows a lot. Its blog's newest post is dated 2025-09-19. It took part in Google Summer of Code in
  2024 and 2025.

---

## 3. Inkscape

### Creative layer

What a person makes: illustration, logos, diagrams, maps, technical drawings, cutting files: the
widest vector toolset in free software.

| Feature | Seen in | Worth borrowing? |
|---|---|---|
| **Pen (Bézier) tool**, node editing | long-standing (from its manual; not re-checked today) | **Yes, first** of the illustration features. |
| **Shape Builder** (click regions to join or cut shapes) | 1.4 release notes (improved: splits raster images, keeps copies) | **Yes**: a friendlier boolean tool than menu items; works well by pointer and needs a keyboard route. |
| **Pages** (several pages in one file) | 1.4 notes | Already in Bryant's app. |
| **Layers and Objects** dialog | 1.4 notes | Already in Bryant's app (Layers tab). |
| **Filter Gallery** (effects with previews) | 1.4 notes | **Yes, later**: shadows and blurs as SVG filters, picked from previews. |
| **Swatches** (palettes, including Adobe palette files) | 1.4 notes | **Yes**: palettes = tokens; reading `.ase` palettes is a format question to check. |
| Modular and axonometric **grids** | 1.4 notes | **Yes**: an axonometric grid suits drawing racks and rooms (the "physical" view topology names). |
| Lasso selection, new colour management | 1.5 (development) notes | Lasso: yes, later. |

### Technical layer

- **Architecture**: a desktop program (C++; GTK 3 in 1.4, moving to GTK 4 in the 1.5 development
  branch per its release notes). Not a web app.
- **File format**: **SVG** is its main format ("the standardized SVG file format", its About page),
  with its own extra attributes for layers and settings. This matters most: Bryant's app exports SVG
  already, so a drawing can go to Inkscape for finishing today.
- **Embeddable?** No, not in a page. It can run **beside** us: by hand, or from the command line at
  build time to turn SVG into PDF or PNG.
- **Accessibility**: a desktop GTK program; the 1.4 notes have no accessibility section.

### Relationship layer

- **Licence**: its `COPYING`: "Most Inkscape source code is available under the GNU General Public
  License, version 2 or later", with some files (L)GPL-3.0-or-later and some dual-licensed; "the
  complete binaries of Inkscape are currently covered by the terms of GNU GPL version 3 or later".
  Per-file SPDX lines. So: **GPL-2.0-or-later** for most source files, **GPL-3.0-or-later** for the
  program as built.
- **Fit with ours**: GPL-2.0-or-later code can be taken as GPL-3.0-or-later and joined to our GPL
  option. It can **not** go into the LGPL option: a part copied from Inkscape would make that part of
  topology forge GPL-only, and the "or LGPL" choice Bryant gives would be lost for the whole file
  (it is one HTML file). **Verdict: compatible with our GPL option; copying its code would narrow
  our licence. Using it as a separate program, through SVG files, mixes no code at all.**
- **What we could do**: trade files as SVG (now); offer "Open in Inkscape" as advice in Help (no
  code); learn its tools' behaviour; report or fix SVG bugs upstream where our exports meet its
  import. Embedding: no.
- **Health and governance**: a member project of the Software Freedom Conservancy (a US non-profit),
  per its About page. Releases: 1.4 on 2024-10-13 (inkscape.org); tags 1.4.1 (2025-03-30), 1.4.2
  (2025-05-08), 1.4.3 (2025-12-25) and 1.4.4 (2026-05-05) on GitLab; 1.5 in development with no
  date. Last activity on GitLab 2026-11-02; 4,021 stars there. Old, steady, slow major releases.

---

## Side by side

| | Penpot | Graphite | Inkscape | topology forge today |
|---|---|---|---|---|
| Runs | server + browser | browser, desktop (RC) | desktop | browser, one file, no server |
| Format | `.penpot` (ZIP of JSON); SVG in and out | own (not yet stable) | SVG | own JSON; reads and writes draw.io, Visio, CSV; writes SVG, PNG, PDF |
| Code licence | MPL-2.0 | MIT OR Apache-2.0 | GPL-2.0-or-later (files), GPL-3.0-or-later (program) | GPL-3.0-or-later OR LGPL-3.0-or-later |
| Into our code? | yes, file-level conditions | yes (take MIT) | GPL option only | |
| Newest release found | 2.18.5, 2026-10-26 | moving tag, commit of 2026-07-01 | 1.4.4, 2026-05-05 | 1.8 (in progress) |
| Best idea to borrow | boards, components, layout rules on containers, tokens | layers and recipe as two views of one thing | pen tool, Shape Builder, filter gallery, axonometric grid | |

## Careful analysis of licensing

**Again: I am not a lawyer; this is a reading, to be checked by one before any code crosses over.**

### Safe now

- **Ideas, layouts of tools, ways of working.** Borrowing *how* a feature behaves is not copying code.
  Write our own code and our own words for it.
- **Trading files.** Exporting SVG for Inkscape or Penpot, and reading SVG back (once Bryant's app can),
  mixes no code. The shop's drawings are ours (CC-BY-SA-4.0 as prose and art) and stay ours.
- **Running another program beside ours**, such as Inkscape on the command line at build time.
- **Linking** to their sites and documentation.
- **Taking Graphite code under MIT**, keeping its copyright and licence notice, into either of our
  options.

### Ask a lawyer first

1. **MPL-2.0 code inside a single-file app.** MPL's conditions follow the *file*. Bryant's app is one
   HTML file. Pasting MPL code into it may make that file (not just the pasted part) subject to the
   MPL. Keeping any MPL code in its own file, loaded beside the app, is the likely answer, but it
   needs checking.
2. **GPL-2.0-or-later code from Inkscape** in a file that offers "GPL-3.0-or-later OR LGPL-3.0-or-later":
   does copying it end the LGPL choice for the whole file, or only for the copied part? (My reading:
   the file, in practice.) Decide before any copy, with Bryant, since the OR is his.
3. **Patents.** Apache-2.0 carries a patent licence and a termination clause; MIT does not mention
   patents. If we take Graphite code under MIT, ask whether that matters for us.
4. **Names and logos.** Using "Penpot", "Inkscape" or "Graphite" (or Adobe's product names) in our
   pages, beyond plain mention, may touch trademark rules. Check each project's own policy. Never
   imply that any of them, or Adobe, endorses the shop.
5. **Prose and pictures.** Their manuals, icons and screenshots each have their own licence (not
   checked here). CC-BY-SA-4.0 text can be adapted into GPLv3 works, but not the other way round
   (Creative Commons: GPLv3 is a "BY-SA–Compatible License" for 4.0, "one-way only").
6. **Giving back.** Each project has its own contribution terms (Graphite: offer your code under both
   MIT and Apache-2.0). Read them before a first upstream patch.

### Avoid

- **tldraw's code** (its own non-free licence).
- **Copying icons, art or screenshots** from any project without a licence check.
- **Pasting code from any of the three into Bryant's file** before questions 1 and 2 are answered.
- **Wording that borrows Adobe's names** to describe our work ("Illustrator-like" in a design note
  is a description; on the public site, say what the features do instead).

## Concerns

- [HIS] "Closer relationship" may mean more than file trading (a shared roadmap, upstream work).
  Falsifier: he names one project to approach; then a separate note on that one.
- [DOMAIN] The single-file question (MPL and GPL-2-or-later against the OR licence) is the real
  blocker for any code reuse. Falsifier: a lawyer says copied parts can keep their own licence
  inside one file with clear markers; then reuse widens.
- [PLATFORM] Release dates from GitHub pages lack years; I used Docker Hub, GitLab tags and commit
  dates instead, and said which. Falsifier: a project's own release notes give a different date.
- [SKILL] The three-layer reading is mine (above).
- [MINE] I find Graphite's "two views of one document" the most exciting idea here; it is not the
  first thing to build.

## Sources

- Corwin's words, 2026-11-01 20:51 (the brief for this note).
- topology, branch `corwin`: `www/topoforge/index.html` (Bryant Frankford's topology forge: shapes,
  menus, exports), `README.org` (licences), `topoforge/COPYING`.
- Penpot repository (public): https://github.com/penpot/penpot (read by a shallow clone of
  `develop` at bd7239a0, 2026-11-01: `LICENSE`, `README.md`, `frontend/src/app/main.cljs`,
  `render-wasm/Cargo.toml`, `docker/images/docker-compose.yaml`)
- Penpot changelog: https://github.com/penpot/penpot/blob/develop/CHANGES.md
- Penpot releases: https://github.com/penpot/penpot/releases and
  https://github.com/penpot/penpot/releases/tag/2.18.0
- Penpot image tags and dates (Docker Hub): https://hub.docker.com/r/penpotapp/frontend/tags
- Graphite repository (public): https://github.com/GraphiteEditor/Graphite (shallow clone of `master` at
  cd0498b, 2026-11-02: `README.md`, `Cargo.toml`, `LICENSE-MIT`, `LICENSE-APACHE`,
  `frontend/package.json`; tag `latest-stable` at 95c1ab8)
- Graphite releases: https://github.com/GraphiteEditor/Graphite/releases/tag/latest-stable
- Graphite features and roadmap: https://graphite.art/features/
- Graphite codebase overview: https://graphite.art/volunteer/guide/codebase-overview/
- Graphite blog: https://graphite.art/blog/
- Inkscape licence: https://gitlab.com/inkscape/inkscape/-/blob/master/COPYING
- Inkscape tags (GitLab API): https://gitlab.com/inkscape/inkscape/-/tags
- Inkscape current release: https://inkscape.org/release/
- Inkscape About: https://inkscape.org/about/
- Inkscape 1.4 release notes: https://wiki.inkscape.org/wiki/Release_notes/1.4
- Inkscape 1.5 release notes (development): https://wiki.inkscape.org/wiki/Release_notes/1.5
- Krita tags (KDE GitLab): https://invent.kde.org/graphics/krita/-/tags
- Excalidraw licence: https://github.com/excalidraw/excalidraw/blob/master/LICENSE
- tldraw licence: https://github.com/tldraw/tldraw/blob/main/LICENSE.md
- Mozilla, MPL 2.0 FAQ (Q14, and Exhibit B): https://www.mozilla.org/en-US/MPL/2.0/FAQ/
- Apache Software Foundation, Apache License v2.0 and GPL compatibility:
  https://www.apache.org/licenses/GPL-compatibility.html
- Creative Commons, compatible licenses (GPLv3 and BY-SA 4.0):
  https://creativecommons.org/share-your-work/licensing-considerations/compatible-licenses/
- Web searches used to find the pages above (2026-11-01): "Penpot latest release 2026 changelog";
  "Graphite editor release 2026 Rust WebAssembly vector raster"; "Inkscape 1.4 release latest version
  2026"; "Inkscape 1.5 GTK4 development release 2026", which led among others to
  https://inkscape.org/forums/inks-news/switching-to-gtk4 and
  https://www.phoronix.com/news/Inkscape-Switches-To-GTK4
- The GNU licence list (https://www.gnu.org/licenses/license-list.html) could not be read from this
  session (the connection was reset three times, and refused to the fetch tool); the Apache, Mozilla
  and Creative Commons pages above were used in its place.
