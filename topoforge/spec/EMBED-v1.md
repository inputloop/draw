<!--
SPDX-FileCopyrightText: 2026 Bryant Frankford <nathanielfrankford@gmail.com> and Corwin Brust <corwin@bru.st> and Contributors
SPDX-License-Identifier: CC-BY-SA-4.0
-->
# Embedding topology forge (formerly TopoForge): EMBED v1, from 1.8

topology forge (formerly TopoForge) was made by Bryant Frankford, with Corwin Brust and contributors.
This spec says what a page that embeds it (in an `iframe`) may ask for, and what the app promises.
`tests/browser/embed.browser.mjs` holds the app to it; each promise below names its check.

## Rule zero: opened on its own, nothing changes

With no `?embed=` and no call to `TopoForge.embed()`, 1.8 is 1.7 to look at and to use: the same
pixels at every width, light and dark (S1), the same tab order (S2), no new element, class or stored
key (S3), and nothing posted to any parent (E6).

## Turning switches on

- In the address: `?embed=` with any of the words in the table, separated by commas. Two short
  words: `all` turns on every switch that keeps the chrome (`frameless`, `props`, `shapes`, `pages`,
  `select`, `ready`); `bare` turns on `frameless` and every `hide-` word. Unknown words are ignored.
  It combines with `?load=` (`?load=/x.json&embed=bare,select,ready`).
- From script, once the app has booted: `window.TopoForge.embed({ frameless: true, 'hide-props':
  true, ... })`, each word as a key, `true` or `false`; `chrome: false` means `frameless: true`. It
  returns every switch as it now stands; `TopoForge.embed()` with no argument only reads them.

| word | what it does | checks |
|---|---|---|
| `frameless` | the brand is hidden from sight (it stays the page's level-one heading for screen readers), the document name is hidden, and the rules between the app's areas are gone; the menus and tools stay | F1, F2, F3 |
| `props` | the inspector (Properties, Layers, Issues, Story) floats over the drawing, starting at its right | P1 |
| `shapes` | the shape palette floats, starting at the drawing's left; the drawing takes the whole width | H1 |
| `pages` | the bottom bar folds into one floating box at the drawing's bottom right: the overview map, a row with a Pages button (it lists every page) and the page tabs (the current one marked `aria-current="page"`), and the status line | M1-M4 |
| `select` | the selection hook (below) | E2-E5 |
| `ready` | the ready event (below) | E1 |
| `hide-menus` | the menu buttons (File ... Help) are not shown | B2 |
| `hide-tools` | the tool buttons (pointer, connector, text, pan, undo, redo, zoom, fit, theme) are not shown; with `hide-menus` too, the whole top bar goes and the drawing takes its row | B1, B2 |
| `hide-shapes` | the shape palette is not shown; the drawing takes its column | B2, Z1 |
| `hide-props` | the inspector (Properties, Layers, Issues, Story) is not shown; the drawing takes its column | B2 |
| `hide-pages` | the page tabs and the status line are not shown, in the bottom bar or in the overview box; the drawing takes the row | B1, B2 |

Hiding beats floating: `hide-props` with `props` hides the inspector. With `bare` the drawing is the
whole window (B1); the embedding page then offers what the chrome offered, through the calls below.

A floating panel has a grip row: its name (drag it, or focus it and use the arrow keys: 16 pixels, 64
with Shift), **Move** (a menu: Left, Right, Up, Down, Back to its starting place, so no drag is ever
needed: WCAG 2.5.7), and **Hide** / **Show** (hidden, only the grip row stays). Each move and hide is
said in a polite live region. Places and hidden states are kept in this browser under
`topoforge.ui.v1`; with storage refused they last for the visit (K1-K7). Panels float only when the
app's own window is wider than 860 pixels; narrower, the drawers of 1.7 stay (K8). Nothing that
floats has a transition (X2).

## The selection hook

With `select` on, after any change of the selection or of the page, the app sends `topoforge:select`:

- as a `CustomEvent` on its own `window` (`event.detail`), and
- to `window.parent` with `postMessage({ type: 'topoforge:select', detail }, location.origin)`: only a
  parent of the app's own origin receives it (E5); nothing is posted from `file://`.

`detail`: `name` (the first line of the shape's text, else its shape name), `tooltip` (its custom
field `tooltip`, else `what`, else its notes), `kind` (the shape's type, or `link`), `ref` (its
`tf_ref`), `id`, `page` (the page's name), `pageIndex`, `count` (how many are selected; the fields
above describe the first) and `items` (one entry per selected thing). Nothing selected: `count` 0 and
empty strings. `TopoForge.selection` returns the same object at any time.

## The ready event

`TopoForge.ready` is a promise, always there, resolved once the app has booted and any `?load=` has
finished or failed. With `ready` on, the same detail is sent as `topoforge:ready`, by the same two
routes and the same origin rule, once. `detail`: `version`, `name` (the drawing's), `pages` (names),
`page`, `pageIndex`, `loaded` (the `?load=` value, or null), `ok`, `error` (E1, E7).

## Every menu command, for a page that hides the chrome

`TopoForge.commands()` lists every command in the app's menus (File, Edit, Arrange, Layout, View,
Help), in menu order, read from the menus' own table each time it is called: `{ id, menu, group,
label, shortcut, enabled, checked }`. `id` is `menu:group:label` in lower case with words joined by
`-` (`group` is the menu's last heading, empty before one), so the same label under Import and Export
gets two ids. `TopoForge.run(id)` runs one, as choosing it in the menu would, and returns `true`; a
disabled or unknown id runs nothing and returns `false` (R1, R2). With these an embedding page can
offer every command from its own prompt or menu, which is what makes hiding the app's own chrome safe.

## The palette's catalogue, and placing a shape

`TopoForge.shapes()` returns the palette's catalogue, in the palette's order: a list of categories
`{ id, label, shapes }`, each shape `{ id, label, category, kind, w, h, icon }`, where `icon` is the
same small SVG the palette shows (a string beginning `<svg`) and `w`, `h` its default size (Z1).

`TopoForge.place(id, where)` places a shape as the palette would, and returns `true` (`false` for an
unknown id):

- `place(id, 'center')`: in the middle of the view, as a click on the palette does;
- `place(id, { x, y })`: at that point, in the app's own pixels (as a drop there would);
- `place(id)`: arms it. The drawing's pointer becomes a cross-hair and a polite message says what
  to do; the next press on the drawing drops it at the pointer, Enter drops it in the middle of the
  view, Escape gives up. `TopoForge.placing` is the armed shape's id, or `null` (Z2).

An embedding page may also let people drag from its own palette with HTML drag and drop, the data type
`text/x-topoforge` set to the shape's id, as the app's own palette does; the drawing takes the drop.

## Also for an embedding page (read-only)

`TopoForge.version`; `TopoForge.showPage(name or index)` (true if that page exists);
`TopoForge.panels()` (where the stage, the shapes, the inspector and the overview are, in the app's
pixels, and whether each floats or is hidden).

## Not changed

`window.TopoForge`'s name, the TopoForge JSON format, every storage key 1.7 used, and the brand and
title a standalone visitor sees. Changing them would break saved drawings and pages that embed it.
