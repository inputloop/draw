<!--
SPDX-FileCopyrightText: 2026 Bryant Frankford <nathanielfrankford@gmail.com> and Corwin Brust <corwin@bru.st> and Contributors
SPDX-License-Identifier: CC-BY-SA-4.0
-->
# Embedding topology forge (formerly TopoForge): EMBED v1, from 1.8 (added to in 1.9)

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

## Added in 1.9 (still v1)

1.9 adds calls, switches and fields; it changes nothing 1.8 promised, so a page written for 1.8 works
unchanged and this is still v1 (no v2 is needed). The six new switch words are `view`, `keys`, `context`,
`pagelist`, `map` and `preview`. **None of them is turned on by `all` or `bare`**, which mean exactly
what they meant in 1.8 (W1). Each message below goes by the same two routes and the same origin rule as
`topoforge:select`: a `CustomEvent` on the app's own window, and `postMessage` to a parent of the app's
own origin only, never from `file://` (E8).

### The view: `view`

`TopoForge.view` is `{ k, x, y, zoom, width, height }`: `k` the zoom (1 is 100 %), `x`, `y` where the
drawing's point 0,0 sits in the canvas, `zoom` the percentage the app shows, `width`, `height` the
canvas's size, all in the app's own pixels. `TopoForge.setView({ k, x, y })` sets any of the three (`k`
is held between 0.08 and 5, as the app's own zoom is) and returns the new view. With `view` on, every
change of the view (a wheel, a drag, Fit, setView) sends `topoforge:view`, at most once per 60 ms, with
the view's fields and `rect` (below) (V1, V2).

### Where the selection is

`TopoForge.selectionRect()` is the box around what is selected, as it is on screen, in the app's own
pixels (`{ x, y, w, h }`, as `getBoundingClientRect` gives them inside the app; a device's box includes
its label below it), or `null` with nothing selected. The select detail (`topoforge:select`,
`TopoForge.selection`) gains the same as `rect`; `topoforge:view` carries it too, so a page that floats
something beside the shape can follow a zoom or a pan (R3).

### Giving up an armed shape

`TopoForge.place(null)` gives up a shape armed with `place(id)`, as Escape on the drawing does: the
cross-hair goes and `TopoForge.placing` is `null`. It returns `true`, or `false` when nothing was armed
(Z3).

### Setting a shape's fields

`TopoForge.setProps(id, patch)` changes one shape or link on the current page through the app's own
edit path: it is drawn at once and is **one** undo step. A shape takes `text`, `x`, `y`, `w`, `h`,
`layer`, `props`, `data`, `style`; a link takes `text`, `layer`, `route` (`orthogonal`, `straight`,
`curved`), `arrows` (`none`, `end`, `start`, `both`), `props`, `data`, `style`. `props`, `data` and
`style` are merged field by field: a value of `null` removes the field, others are kept (as text, in
`props` and `data`, as the inspector keeps them). Moving a container moves what is in it. An unknown id,
a field not in the list, a wrong type, a nested object or an empty patch changes nothing and returns
`false` (U1).

### Keys for the page: `keys`

With `keys` on, Alt+x, F10, Ctrl+X and Ctrl+C pressed while the focus is in the drawing (the canvas, or
nothing in the app) are not the app's: each is sent as `topoforge:key`. Ctrl+X and Ctrl+C (Emacs's C-x
and C-c) open a sequence: the keys pressed after them are sent too, wherever the focus is, until the
page calls `TopoForge.endKeys()` (true if a sequence was open), C-g or Escape is pressed, four keys have
followed the first, or the app's window loses focus, so the keyboard can never be kept from the app
(WCAG 2.1.2). Detail: `key` (Emacs's name: `M-x`, `<f10>`, `C-x`, `5`, `C-g`, `<escape>`, `RET`, `S-<f3>`
...), `seq` (the sequence so far, the first key first), `open` (true while more keys of the sequence
will come) and `raw` (`key`, `code`, `alt`, `ctrl`, `shift`, `meta`). A plain key outside a sequence,
and every key typed into a field, stay with the app (Y1, Y2).

The trade, said plainly: while `keys` is on, the drawing's own Ctrl+X and Ctrl+C (cut and copy) belong
to the page. Edit, Cut and Edit, Copy stay in the app's menus and in `commands()`, and the page may run
them.

### Long press and right click: `context`

With `context` on, a right click on a shape or a link, a long press on one (touch or pen, held still for
550 ms), or the menu key or Shift+F10 with something selected and the focus in the drawing, sends
`topoforge:context`: `via` (`contextmenu`, `longpress`, `keyboard`), `x`, `y` (the point, in the app's
own pixels; the middle of the selection for the keyboard), `id`, `ref`, `name`, `tooltip`, `kind`,
`page`, `pageIndex` and `rect` (that shape's box on screen). The app still selects what was pressed and
its own menu still opens on a right click; a right click on the empty drawing sends nothing (Q1, Q2).

### Pages changed: `pagelist`

The word `pages` was taken in 1.8 (the page tabs in the overview box), so this switch is `pagelist`.
With it on, a change to the list of pages sends `topoforge:pages`: `change` (`added`, `removed`,
`renamed`, `moved`, or `replaced` when a whole drawing is opened in place of the last), `added` and
`removed` (names), `pages` (every name, in order), `page`, `pageIndex`. Undo and redo are changes like
any other. Showing another page is not a change of the list (the select message says it) (G1).

### The overview map, moved and resized: `map`

With `map` on, the overview map leaves its fixed corner for a frame of its own (starting where it always
was: 190 by 130 pixels, 12 from the drawing's right and foot). Its handles sit **outside** that frame,
in a row just above its top edge: a resize handle (⤡), a grip (⠿ Move) and **Position**. They are not
shown until the pointer comes within 40 pixels of the map or its handles, "as a door handle appears when
you reach for the car door": a hand that knows where they are finds them there. They stay shown while the
pointer is on them and while one of them has the keyboard focus; they are ordinary buttons, in the Tab
order even while unseen, so a keyboard user reaches them and sees them as they get the focus. Where the
screen has no hover (a touch screen), they are always shown (N1, N2, N8).

- the grip: drag it, or the arrow keys on it (16 pixels, 64 with Shift);
- the resize handle: drag it (up and left make the map bigger; its right and bottom edges stay put), or
  the arrow keys (left and up bigger, right and down smaller; Shift goes further). The map stays between
  120 by 80 pixels and 70 % of the drawing;
- **Position**, a menu: Bottom right, Bottom left, Top right, Top left, Larger, Smaller, Back to its
  starting place: every move with one pointer and no drag (WCAG 2.5.7) (N3, N4).

Each move is said in the polite live region. The place and size are kept in this browser under
`topoforge.ui.v1`, key `minimap`; with storage refused they last for the visit (N5, N7). Turned off, the
map goes back to its corner as 1.8 has it (N6). With `pages` on too, the map stays in the pages box
(which 1.8 already lets you move), and these handles are not shown. Narrower than 861 pixels the map is
hidden, as it always was. Nothing in the frame or its handles has a transition (X2).

### A preview in the map: `preview`

With `preview` on, `TopoForge.preview(what, caption)` lets an embedding page use the overview map as a
small dashboard for what the person is pointing at in the page's own frame (a finder, a tool-bar):

- `what` is a list of shape ids or `tf_ref`s, `{ category }` (a category id from `shapes()`), or
  `{ kind }` (a shape id from `shapes()`); `null` clears the preview;
- the matching shapes on the current page are ringed in the map and the rest dimmed, and a one-line
  caption is written along the map's foot: `caption` if given, else the shape's name, or "Network: 3
  shapes", or "not on this page", with "· N on other pages" when there are some there;
- it returns `{ count, other, caption, ids }`, `true` for `null`, and `false` (drawing nothing) when the
  switch is off or `what` is not one of the forms above (H1, H2).

The preview holds through redraws and page changes until it is cleared or replaced, and works in all
three places the map can be: its corner, its own frame (`map`) and the pages box (H3). The caption is not
a live region: the page that asked for the preview speaks for the thing pointed at.

## Page tabs that do not fit (1.9, everywhere)

This one is a fix, not a switch: it applies to the app opened on its own too, and only when there are more
page tabs than the strip can show. Then the strip shows as many whole tabs as fit (the current one among
them when a page is shown), with **‹** and **›** before and after them, which move the app's own window of
tabs one tab at a time (no browser scrollbar, nothing scrolled by the browser), and, in the bottom bar,
**All N**, which opens a list of every page above the strip: a filter box (typing narrows the list), ↓
and ↑ to choose, Enter to show that page (the focus goes to its tab), Escape to close (the focus goes back
to All). In the 1.8 pages box (`pages`) the tabs get ‹ and ›, and its Pages button stays the list of them
all. In the page tabs, ← and → move the focus one tab and Home and End to the first and the last, the
window following; Enter shows the page (before 1.9 these keys nudged the selected shapes) (T1-T6).

When the tabs fit, the strip is exactly as before (T5), and the app draws the same pixels as 1.8 (S1);
with sixty pages only the bottom bar differs from 1.8 (S4).

## Not changed

`window.TopoForge`'s name, the TopoForge JSON format, every storage key 1.7 used, and the brand and
title a standalone visitor sees. Changing them would break saved drawings and pages that embed it.
