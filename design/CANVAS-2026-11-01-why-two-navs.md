# CANVAS 2026-11-01: why two navs, and the free-flowing canvas

The drawing app on corwin.cloud is **topology forge (formerly TopoForge)**, made by Bryant Frankford,
with Corwin Brust and contributors. Code GPL-3.0-or-later OR LGPL-3.0-or-later; prose CC-BY-SA-4.0.
Everything below that changes the app is a proposal into topology (branch `corwin`), credited to him.

This is a design note only. No code was changed for it. Another helper is building the embedding
switches right now (`topoforge/spec/EMBED-v1.md`, not yet committed when this was written); this
note builds on them and does not repeat them.

## His question (2026-11-01 20:51)

> There are still some strange feeling choices in the UI for corwin.cloud. Multiple layers of menu
> and nav. If we are keeping the original left nav let's understand clearly why someone needs to see
> both. My concept was for no borders or menus or anything: just a doom scrolling free flowing canvas.

## The short answer

The two left-hand things do different jobs: Bryant's **shape palette** is for *making* (drag a
router onto the drawing), and our **navigator** is for *finding* (which of the shop's 63 things are
BPMN projects about topology). Almost nobody needs both on the same screen at the same moment: a
visitor reading the shop wants to find, and a person drawing wants to make. So neither should be on
screen by default: one prompt can do the finding, the palette can come out when you start to draw,
and the canvas can be the whole page.

## Observed (what is on the page today)

How: Playwright (Chromium 1.63) against https://corwin.cloud/ on 2026-11-01 at 21:00, 1280 by 800
and 390 by 844 pixels, light and dark (`look.cjs` in the session's scratchpad). Sizes are the
browser's own measurements of each element at 1280 by 800, light; dark measured the same.

| # | Layer | Whose | Where and how big (1280) | What it holds |
|---|---|---|---|---|
| 1 | Top bar | Bryant's | full width, 46 px tall | brand; six menus (File, Edit, Arrange, Layout, View, Help); four tool modes (select, connect, text, pan); undo, redo; zoom out, zoom %, zoom in, fit; the drawing's name; theme |
| 2 | Shape palette | Bryant's | left column, 236 px wide | "Search shapes…" and the shapes in groups (Network, Security, Servers and storage, and on) |
| 3 | Inspector | Bryant's | right column, 296 px wide | tabs Properties, Layers, Issues, Story |
| 4 | Bottom bar | Bryant's | full width, 30 px | 31 page tabs ("The shop", "topology", "obsmage", ...) and a status line (pointer place, "48 shapes · 49 links", zoom) |
| 5 | Overview map (mini-map) | Bryant's | 190 by 130 px, bottom right of the canvas | the whole page in small; click or drag to move |
| 6 | Navigator | ours | floats, 320 by 459 px, at x 248 | grip row (`left` `float` `right` `hide`); its own menu bar (Site, Buffers, Window, Filter, Help); a tool bar of 21 category buttons in four rows (Show, Notation, Is a, Topic); the list (63 items, 7 sections); a mode-line; the `Narrow:` prompt, `[Pin as buffer]`, and a three-line echo area |
| 7 | Legend | ours | floats, 724 by 206 px, at y 525 | five cells: Drawing app (Bryant, linked), Licence, Source, Your drawing, Sheet |
| 8 | Page mode-line | ours | full width, bottom of the window | `corwin.cloud  Top  *home*  ...  go anywhere ↓` |
| 9 | Site top bar | ours | hidden at 1280 (folded into the navigator's Site menu); shown at 390 | Home, Directory, Demos, Packages, About, Customize |
| 10 | Below the fold | ours | the rest of the page | processes as data, recent Emacs builds, nine project tabs, the "Go to:" prompt, the colophon |

Counted from that table (arithmetic on the measured sizes):

- The canvas Bryant's app leaves visible is 748 by 695 pixels (between the palette and the
  inspector, between the top and bottom bars): 519,860 square pixels. The navigator (146,880) and
  the legend (149,144) cover **about 57 %** of it on a first visit.
- **Two menu bars**, eleven top-level menus between them (six of Bryant's, five of ours).
- **Two lists of pages**: Bryant's 31 page tabs, and the navigator's Pages section.
- **Two kinds of tab** that look alike and mean different things: Bryant's page tabs (pages of the
  drawing) and our buffers (saved filters of the navigator).
- **Three status lines**: Bryant's status line, the navigator's mode-line, the page's mode-line.
- **Two search boxes** that search different things: "Search shapes…" (shapes you can add) and
  `Narrow:` (things already drawn).
- **Two theme switches**: Bryant's sun button and the site's Customize.

At 390 pixels (observed): nothing floats; the site top bar, the heading, a one-row navigator strip,
Bryant's top bar (compact: palette button, six menus, select), the canvas, the page tabs, the
legend's first row and the page mode-line stack up; the drawing gets about 500 of 844 pixels.

## Judged: what each layer is for, who needs it, and when

"Who" means three people the site meets (the same three as the LENS of 2026-10-31):

- the **reader**: a visitor who came to see what the shop is, and will not draw;
- the **drawer**: someone who wants to change the drawing or start their own;
- the **checker**: someone who wants to know whose app it is, its licence, and where its source is.

| Layer | Its job, in one line | Reader | Drawer | Checker | Verdict |
|---|---|---|---|---|---|
| 1. Bryant's top bar | every command of the app, by mouse | rarely (zoom, fit) | always | Help, About | **Fold**: its commands go into one prompt and right-click menus; zoom and fit stay as gestures and keys; the bar can return on a press |
| 2. Shape palette | things you can add | never | while drawing | never | **Disappear until drawing**: it comes out when you choose "draw", drag from the prompt, or press its key; it goes when you stop |
| 3. Inspector | edit what is selected; layers; issues; the story in words | Story, Layers (views) | always | never | **Float, closed by default** (EMBED `props`); opens on double-click of a shape or from the prompt; Story is also reachable as the text alternative |
| 4. Page tabs | which page of the drawing | yes: they are the shop's projects | yes | no | **Merge** with the navigator's Pages section and with the overview map (EMBED `pages`): one place for "where am I" |
| 5. Overview map | where you are on a big page | yes | yes | no | **Keep, small**: it becomes the one "where" widget: the map, the page strip, and (with diving, see the dive-in note) the breadcrumb |
| 6. Navigator, list and tool bar | find a thing in the shop by kind and words | yes | sometimes | no | **Merge into one prompt**: the categories become words you can type or press in the prompt's results (`is:project notation:bpmn topology`); the list is the prompt's answer, shown only while you ask |
| 6. Navigator, menu bar | its own commands (buffers, splits, filters) and the site's links | rarely | rarely | no | **Disappear**: each item becomes a command in the same prompt (`split`, `pin results`, `go directory`) |
| 6. Navigator, mode-line | the tooltip of the thing under the pointer | yes | yes | no | **Move to the canvas**: the tooltip appears by the shape (and in a polite status line for screen readers), not in a panel |
| 7. Legend | credit, licence, source, where your drawing lives | no | once | yes | **Shrink to a title-block corner**: one row, always visible, that names Bryant with his link and the licence; it opens to the five cells. It must stay reachable (see the legal note below) |
| 8. Page mode-line | where you are on the long page; the way to "go anywhere" | yes | no | no | **Keep, below the canvas**: it belongs to the long page, not to the canvas. On the canvas screen it is not needed |
| 9. Site links | the site's other pages | yes | no | yes | **Into the prompt and the canvas**: `go demos` in the prompt; and the drawing's own first page can carry the site's doors as shapes (Directory, Demos, Packages, About), which is "the drawing is the front door" taken literally |
| 10. Below the fold | words for each project; processes; builds | yes | no | yes | **Keep**: this is the "doom scroll" past the canvas, and it is where scripts-off and screen-reader readers already get everything |

### So: why would someone need to see both left navs?

Only one person does: a drawer who is adding shapes *about* the shop's own things (dragging a
"server" next to the project it serves, while finding that project in the navigator). That is real
but rare, and even then the two need not both be open: the prompt finds the project and selects it;
the palette adds the server next to the selection. **Recommendation: keep both functions, show
neither by default.**

## Recommendation: no borders or menus, a free-flowing canvas

### What the visitor sees (1280, scripts on)

- The drawing, edge to edge, from the top of the window to the bottom. No bar, no column, no border.
- One small prompt pill at the top centre: `M-x  find, go, or do…` (Alt+x, the house's Emacs key;
  also `/` when focus is on the canvas). It is the only control on the canvas.
- The overview map, small, bottom right, with the page strip folded into it (EMBED `pages`).
- The title-block corner, one row, bottom left: "topology forge by Bryant Frankford · GPL/LGPL ·
  CC-BY-SA · about" with his link. Press it to open the five cells.
- Scroll the page (not the canvas) and the long page continues below: the "doom scroll".

### Where the commands live, once the menus are gone

| Route | What it carries | Built from |
|---|---|---|
| **One prompt** (Alt+x, `/`, or the pill) | everything: Bryant's menu commands, the navigator's finding (categories as words), site pages, shapes to add, "dive into", the legend | Bryant's `MENUS` table is already data (`www/topoforge/index.html`, `const MENUS`): offered to the page as a list (`TopoForge.commands()`, proposed in the roadmap); the navigator's index (`nav/index.json`) as it is |
| **Right-click (context) menus** | what you can do to the thing under the pointer | Bryant's app already has one (`onContext`, and one on page tabs); it stays as he made it, with "Dive in" added for containers |
| **Long-press** on touch screens | the same context menu | see the platform concern below |
| **A radial menu** (optional, later) | the four to nine most used actions around the finger or pointer | only if the test with a touch screen shows the context menu is too small to hit; not in the first stitches |
| **Keys** | Bryant's existing ones (Ctrl+Z, Ctrl+G, F2, Ctrl+0...) unchanged; Alt+x for the prompt; Alt+Down to dive, Alt+Up to climb | his `MENUS` keys; the navigator's key list |
| **"Show the bars"** | brings back Bryant's top bar, palette and inspector exactly as he made them, for anyone who prefers them | the EMBED switches turned off; kept per browser |

The last row matters: the free canvas is a *view*, not a removal. Opened on its own,
`topoforge/index.html` stays Bryant's app as he made it (EMBED v1, "rule zero").

### The honest costs

1. **Discoverability.** A menu shows what is possible; a prompt shows only what you thought to ask.
   Mitigation: the prompt, empty, lists its commands in groups (Find, Go, Draw, Arrange, View, File,
   Help), the same groups as Bryant's menus, so pressing the pill and scrolling *is* the menu.
   Falsifier: in a five-minute try, a first-time visitor cannot find "export as SVG" without being
   told.
2. **Two keyboards meet.** The canvas is in a frame; keys pressed there go to Bryant's app, not to
   the page. Alt+x must work wherever focus is. Mitigation: the app forwards Alt+x to its parent
   (same-origin `postMessage`, as EMBED's selection hook already does) or opens its own copy of the
   prompt. Falsifier: Alt+x pressed with focus on a shape does nothing.
3. **The legal notices must stay visible.** GPLv3 section 5(d): "If the work has interactive user
   interfaces, each must display Appropriate Legal Notices" (`topoforge/COPYING`, line 230), and
   section 0 defines them as "a convenient and prominently visible feature" showing the copyright,
   that there is no warranty, and how to see the licence. Today that is Help, About in Bryant's
   menus and the legend. With both folded, the title-block corner is that feature, so it is never
   hidden entirely. (I am not a lawyer; this is the reading of the words, not advice.)
4. **Bryant's design.** Folding his top bar changes how his app looks. That is his to agree to: it is
   offered as a switch he can see and test, never as a change to the app opened on its own.
5. **Screen readers.** A canvas with no menus is a blank to a screen reader unless its routes are
   named. See the next section.

### Accessibility: the routes that must exist

WCAG here means the W3C's Web Content Accessibility Guidelines, version 2.2, level AA.

- **Keyboard**: every command reachable from the prompt by keyboard alone; the prompt follows the
  combobox pattern (a text box that owns a list, Up and Down move, Enter runs, Escape closes)
  from the W3C's authoring practices. Tab order on the canvas screen: skip link, the prompt pill, the
  canvas, the overview map, the title-block corner. Five stops, not today's 90-odd.
- **Screen readers**: the drawing in words already exists: Bryant's Story tab ("The drawing in
  words: a text alternative you can export"). The pill's first group offers "Read the drawing in
  words". The tooltip that moves from the navigator's mode-line onto the canvas is also said in a
  polite status region. Below the canvas, the long page (layer 10) already carries every project in
  words, with scripts off too.
- **Dragging (WCAG 2.5.7, Dragging Movements, AA)**: "All functionality that uses a dragging
  movement for operation can be achieved by a single pointer without dragging". Moving a shape
  already has Arrange commands and arrow keys in Bryant's app; moving a floating panel has EMBED's
  Move menu; **adding a shape** (today a drag from the palette) needs a single-press route: choose
  it in the prompt or the palette, and it is placed at the centre of view or next to the selection.
- **Target size (WCAG 2.5.8, AA)**: the pill, the title-block corner, the overview map's page strip
  and any radial menu items at least 24 by 24 CSS pixels.
- **Reduced motion**: with `prefers-reduced-motion: reduce`, nothing slides, zooms or fades: the
  prompt appears, the palette appears, a dive cuts straight to the inside. EMBED already promises no
  transition on floating panels (its X2).
- **Narrow screens and scripts off**: unchanged from today: nothing floats at 390 pixels; with
  scripts off the page is the top bar, the list of links and the legend as a block.

## Concerns, each with what would prove it wrong

Tags: [HIS] Corwin's own stated wish; [DOMAIN] a fact of the field (law, accessibility);
[PLATFORM] a browser or app limit; [SKILL] how this note was made; [MINE] my own taste, which
never blocks anything.

- [HIS] "No borders or menus or anything" against "keeping the original left nav". Read as: the
  navigator's *function* stays, its *frame* goes. Falsifier: he says the Emacs frame itself is the
  point and should stay visible.
- [DOMAIN] GPLv3 5(d) legal notices (above). Falsifier: none here; the corner stays.
- [PLATFORM] Long-press: touch browsers differ in whether a long-press raises the page's context
  menu event (my understanding, not checked today: Chrome on Android does, Safari on iOS does not
  by default). Falsifier: a test on both shows the same event; then no extra code is needed.
- [PLATFORM] The frame boundary for keys (cost 2). Falsifier: Alt+x works from inside the frame in
  the browser test at 1280 and 390, light and dark.
- [SKILL] The three people (reader, drawer, checker) are my grouping, not measured. Falsifier: the
  site's own visitors (if Corwin ever wants to ask them) name a fourth need the table misses.
- [MINE] I would drop the radial menu entirely; it is listed because he asked for illustrator-like
  feel and radial menus are common in drawing apps on tablets.

## Sources

- Corwin's words, 2026-11-01 20:51 (the brief for this note); 19:12 and 19:20 (quoted in
  corwin.cloud's `docs/NAV.md`, revision 2).
- corwin.cloud: `docs/NAV.md` (revision 2 and the first design), `docs/UI-AUDIT-2026-11-01.md` (the
  control-by-control inventory), `docs/AMBITIONS.md`.
- The live site, observed with Playwright: https://corwin.cloud/ (2026-11-01, 1280 and 390 px, light
  and dark).
- topology, branch `corwin`: `www/topoforge/index.html` (Bryant Frankford's topology forge 1.8;
  `MENUS`, `onContext`, `showAbout`), `topoforge/spec/EMBED-v1.md` (in progress, another helper),
  `topoforge/COPYING` (GPLv3, sections 0 and 5(d)), `design/LENS-2026-10-31-topology-ui.md`.
- W3C, Understanding WCAG 2.2, 2.5.7 Dragging Movements:
  https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html
- W3C, Understanding WCAG 2.2, 2.5.8 Target Size (Minimum):
  https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- W3C, Understanding WCAG 2.2, 2.3.3 Animation from Interactions:
  https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html
- W3C ARIA Authoring Practices, Combobox pattern: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
