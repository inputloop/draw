# CANVAS 2026-11-01: diving into a container

The drawing app is **topology forge (formerly TopoForge)**, made by Bryant Frankford, with Corwin
Brust and contributors. Everything here that changes the app is a proposal into topology (branch
`corwin`, under `www/topoforge/`), credited to him, tested in his app's own kit, and off unless a
page turns it on, as the embedding switches are (`topoforge/spec/EMBED-v1.md`, in progress).

Design only; no code was changed for this note.

## His words

> I mentioned before the idea of stepping inside ("diving into") the frame of a container so that
> that container becomes the whole of the endless stage for topology forge.

## Observed: what the app has to build on

Read in `www/topoforge/index.html` (1.8, 2026-11-01):

- A drawing is a list of **pages**; each page has its own **layers**, **nodes** (shapes) and
  **links** (connectors). `DOC.cur` is the page in view.
- Seven **container** shapes (Zone, Site / Building, VLAN, Subnet, DMZ, Cloud VPC, Rack). Any node
  can have a `parent`, which must be a container on the same page; nesting is any depth (`IDX.depth`),
  and cycles are broken on load.
- Links join two nodes on the same page. A link from a shape inside a rack to a shape outside it is
  allowed and common.
- **Commands already there**: Group into container (Ctrl+G), Remove container (keep contents),
  Fit container to contents, Zoom to selection, Fit to window (Ctrl+0).
- **Zoom** is held to between 0.08 and 5 times (`zoomAt`: `clamp(k, 0.08, 5)`).
- Every shape and connector has a lasting handle, `data.tf_ref`, stamped as you draw and carried in
  JSON, draw.io and Visio files (the story feature). The Story tab cites shapes by it.
- No part of the app reads or writes the address's `#` part or the browser history today.
- EMBED v1 (in progress) adds a selection hook (`topoforge:select`, with `ref`, `page`, `tooltip`)
  and a ready event, to the app's own window and to a same-origin parent page.

## Judged: what "diving in" should mean

**One sentence**: diving into a container hides everything that is not inside it, lets the inside
spread without limit, and gives you a clear way back; nothing in the drawing moves or changes.

It is a **view**, not an edit. The file does not change when you dive. That is what keeps it safe to
ship first and easy to undo: Back, Escape or Alt+Up and you are where you were.

### Two kinds of inside

| Kind | What is inside | When to use | First? |
|---|---|---|---|
| **Inline** | the container's own children on the same page (its descendants by `parent`) | a rack's devices, a zone's hosts | **yes**: needs no new field |
| **Linked** | another page of the drawing, named by the container (a new custom field, `tf_page`, holding that page's name or id) | "the topology project" box on The shop page opens the page "topology" | second: one new field, read-only to older versions (they keep it as plain data, as they keep any custom field) |

Linked insides are how the shop drawing already wants to work: The shop page has a box per project,
and each project has its own page. Today those are two places the visitor must connect in their head
(and the two page lists the why-two-navs note counts). With `tf_page`, the box *is* the door.

## What you see and do

### Going in

- **Double-click a container's label**, or select it and press **Alt+Down** (as file managers go
  into a folder), or choose **Dive in** from its right-click menu or from the prompt (`dive rack-a`).
  Bryant's app uses double-click and F2 to edit text today; double-click on the *label* edits, so
  the dive is on the container's empty inside. (Falsifier: in the kit test, double-clicking a
  container's label still starts editing its text.)
- The view becomes the inside: shapes not inside are not drawn and cannot be selected; the
  container's own outline is not drawn either (you are *in* it, so its edge is the edge of the world,
  and the world has no edge). Grid, snapping, guides and layers work as before.
- The view fits the inside (the same as Fit to window, on the inside only).
- With reduced motion asked for, the change is a cut. Without it, at most a short zoom into the
  container's box (a single animation, under half a second), then the cut.
- A polite status line says: "Inside Rack A: 6 shapes, 4 connectors, 2 leave this container."

### The endless stage

- Inside, the zoom limits widen (proposed 0.01 to 64 times; numbers picked, not measured: they are
  to be tuned by the test that draws a 1-pixel detail and a 10,000-pixel span on one inside).
- Drawing past the container's old edge is allowed. The container grows to hold what you drew
  **when you climb back out** (Bryant's own Fit container to contents, run once, as one undo step).
  Falsifier: after drawing outside the old edge and climbing out, any shape lies outside its
  container's outline.

### Coming back

- **Breadcrumbs** (one row, folded into the overview map's box, EMBED `pages`):
  `The shop › Site: gw lab › Rack A`. Each crumb is a button; the last is the current inside.
- **Alt+Up** or **Escape** (when nothing is selected and no text is being edited) climbs one level.
- The browser's **Back** climbs one level too (each dive is a history entry; see the address below).
- **Zooming out** far past the inside's fit does *not* climb by itself: that would surprise anyone
  using a trackpad. Instead, at that point the breadcrumb's parent crumb is highlighted and says
  "Alt+Up to climb". (A continuous "zoom through the wall" mode can come later, off by default.)
- Climbing selects the container you came out of and centres it, so you see where you were.

## Connectors that cross the edge

A connector with one end inside and one end outside is drawn as a **stub**: it runs from the inside
shape to the edge of the view, ending in a small tab. This is the flowchart's off-page connector,
which topology already speaks (flowcharts are one of its notations).

- The tab sits where the line *would* leave the view, on the side toward the outside end, so the
  geometry still tells you which way the world is.
- The tab is labelled with the far end's name (its first line of text) and, if the far end is in
  another container, that container's name: "→ web host (in Zone: public)". Private parts never
  reach the drawing in the first place (topology's show-private rule), so no extra rule is needed.
- When more than four stubs would sit on one side, they gather into one tab: "5 links to the left".
  (Four is the house's GRAIN number, picked because a number had to be picked, not measured.)
- Pressing a tab: climbs to the level where both ends are visible and selects the far end. Pressing
  it with Alt held: dives into the far end's container instead ("dive across").
- For screen readers and keyboard: the tabs are buttons in the tab order after the inside's shapes,
  each named in full ("Connector from switch-1 to web host, outside this container; press to go
  there"). The status line counts them.
- Inside a **linked** page, there is no geometry to the outside. Stubs are listed instead in a
  column of tabs at the left edge ("from The shop: 3 connectors into this box").

## Pages, layers and the overview map, together

| Thing | Inside a container |
|---|---|
| **Page** | Diving never changes the page for an inline inside; a linked inside switches to its page, and the breadcrumb keeps the page you came from. The page strip marks the current page; crumbs show the path. |
| **Layers** | Stay per page, as Bryant made them. Their visibility and locks carry in. The Layers tab shows, for each layer, how many of its shapes are inside ("operational: 4 of 31 here"). A layer with none inside is shown dimmed, not hidden, so nothing seems to vanish. |
| **Overview map** | Shows the inside, not the whole page. Above it, the breadcrumb row; below it, the page strip. One box answers "where am I": page, path, and view. |
| **Story** (Bryant's text alternative) | Narrows to the inside: "Inside Rack A, on the page The shop: ...", with the same `[refs]`. Its export (File, Story) still writes the whole drawing; a second item, "Story of this inside", writes only the inside. |
| **Navigator / prompt results** (corwin.cloud) | The prompt gains the word `in:` (`in:rack-a`), set for you when you dive; results narrow to things drawn inside, and the mode-line tooltip is the inside's. Clearing it does not climb; climbing clears it. |
| **Selection hook** (EMBED `select`) | Its `detail` gains `scope`: `{ ref, name, path: [ {ref, name}, ... ], page }`, empty at the top. A new event, `topoforge:scope`, is sent on every dive and climb, by the same two routes and the same origin rule as `topoforge:select`. |

## The address: deep links

Every dive is something you can link to and come back to.

- Inside the app, the `#` part of its address carries the view:
  `#page=<page name>&in=<tf_ref>&sel=<tf_ref>,<tf_ref>&view=<x>,<y>,<zoom>`.
  `in` may be a path (`in=site-lab/rack-a`) so a link survives a container being moved between
  parents only if its handle is kept; it is keyed by `tf_ref`, never by the app's internal ids, which
  change on copy and paste.
- Each dive and climb is `history.pushState`; a pan or zoom is `history.replaceState` (so Back
  does not step through every scroll).
- On load, an unknown page or handle is not an error: the app opens the nearest thing that exists
  (the page, then the top) and says in the status line what it could not find.
- corwin.cloud mirrors the same words in its own address (`/?page=topology&in=...`), passes them to
  the app with `?load=`, and listens to `topoforge:scope` to keep its address in step. A link copied
  from the page opens the same inside for anyone.
- Nothing is sent anywhere: the `#` part never leaves the browser (it is not sent to the server),
  which keeps "Zero Sharing".

## Tests, each with a planted fault

In Bryant's app's kit (`topoforge/kit`, run by `sh bin/test.sh`), browser at 1280 and 390, light
and dark; every check has a planted fault that must turn it red.

1. Dive into a rack: only its descendants are drawn and selectable; the file's JSON is byte for byte
   unchanged. (Plant: the dive edits a node.)
2. Alt+Up, Escape and Back each climb one level and select the container. (Plant: Back leaves.)
3. A connector crossing the edge shows a stub tab on the side toward its far end; pressing it climbs
   and selects the far end. (Plant: tab on the wrong side.)
4. More than four stubs on a side gather into one tab with the right count. (Plant: count off by one.)
5. Drawing past the edge, then climbing, leaves no shape outside its container's outline; one Undo
   restores the old outline. (Plant: no fit on climb.)
6. A deep link `#page=..&in=..&sel=..` opens the same inside and selection after a reload; an unknown
   handle opens the page and says so. (Plant: the hash ignored.)
7. `topoforge:scope` reaches a same-origin parent and not another origin. (Plant: posted to `*`.)
8. With reduced motion, no animation runs on dive. (Plant: transition left on.)
9. Opened on its own with no switch, the app behaves exactly as 1.8 (EMBED rule zero). (Plant: dive
   on by default.)

## Concerns

- [HIS] "the whole of the endless stage": read as no outline and no limit while inside. Falsifier:
  he wants the container's outline visible as a frame you are inside (an artboard). Then the outline
  stays and only the outside fades; one line of CSS, same model.
- [PLATFORM] Double-click is already Bryant's "edit text" gesture on shapes. Falsifier: kit test 1
  above shows editing and diving each reached by their own gesture.
- [DOMAIN] Off-page connector tabs are a flowchart convention; readers who do not know flowcharts may
  not read them. Falsifier: the tab's words alone ("→ web host") are understood in a hand test.
- [MINE] I prefer explicit diving to "zoom through the wall"; the zoom-through mode is left as a
  later, optional fork.

## Sources

- Corwin's words, 2026-11-01 20:51 (the brief), and his earlier mention of diving into a container
  (as quoted in that brief).
- topology, branch `corwin`: `www/topoforge/index.html` (Bryant Frankford's topology forge 1.8:
  pages, layers, `parent`, containers, `zoomAt`, `tf_ref`, the Story tab), `topoforge/spec/EMBED-v1.md`
  (in progress), `design/TAXONOMY.org` (flowcharts under the path pillar).
- corwin.cloud: `docs/NAV.md` (the navigator, the mode-line tooltip, proposed TopoForge hooks).
- MDN, History API, `pushState` and `replaceState`:
  https://developer.mozilla.org/en-US/docs/Web/API/History_API
- MDN, `prefers-reduced-motion`:
  https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
- W3C, Understanding WCAG 2.2, 2.3.3 Animation from Interactions:
  https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html
