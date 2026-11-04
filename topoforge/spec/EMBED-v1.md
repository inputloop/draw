<!--
SPDX-FileCopyrightText: 2026 Bryant Frankford <nathanielfrankford@gmail.com> and Corwin Brust <corwin@bru.st> and Contributors
SPDX-License-Identifier: CC-BY-SA-4.0
-->
# Embedding topology forge (formerly TopoForge): EMBED v1, from 1.8 (added to in 1.9, 1.10, 1.11, 1.12 and 1.13)

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

## Added in 1.10 (still v1): the map's modes, its scale, and the wheel over it

Nothing 1.9 promised changes meaning, except one default a page can set back: a preview's caption now
goes to the page (below), and the map shows it only with `mapMode('rings', { mapCaption: true })`, which
is exactly 1.9's look (H1, H3). A page opened on its own is unchanged: it draws the same pixels as 1.9
(S1).

### Three modes for a preview: `TopoForge.mapMode(mode, { mapCaption })`

`mode` is `'cards'`, `'both'` or `'rings'`, in that order from left to right on a three-place slider;
**`'both'` (the middle) is the default**. `mapMode()` with no argument reads `{ mode, mapCaption }`; a name
not in the list changes nothing and returns `false`. Each change is kept in this browser
(`topoforge.ui.v1`, key `mapMode`) and, with `preview` on, sends `topoforge:mapmode` `{ mode, mapCaption
}` (only when something changed) (MM1, MM8).

- **rings** (right): the matches are ringed in the map and the rest dimmed, as in 1.9. The caption is not
  written in the map unless `mapCaption: true`; the page gets it in `topoforge:preview` and may show it in
  its own echo area (MM2).
- **cards** (left): the map shows a **card** about what the page points at, and the map fades behind it
  ("less background"; no lines, frame or texture are added). Nothing is lit in the drawing (MM3).
- **both** (middle): the same card in the map, and the matches highlighted in the **drawing** itself: a
  soft fill and a 2.5-pixel outline in the selection colour, at least 3 to 1 against the drawing's paper
  in both themes, with no motion; it follows redraws and goes with `preview(null)` (MM4, MM7).

The mode never moves or resizes the map: its place, size and corner are the person's (MM3).

### The card: `TopoForge.preview(what, { caption, card })`

The second argument of `preview()` may now be `{ caption, card }` (a string still means a caption).
`card` is `{ title, facts: [[label, value], ...], statement, art }`, every field optional:

- `title`: the line at the top left;
- `facts`: up to 8 pairs, shown as small clusters of label and value;
- `statement`: one short sentence saying what it is;
- `art`: `{ shape: id }` (that shape's own picture from `shapes()`), `'matches'` (a small drawing of the
  matching shapes), or `'none'`. Anything else is ignored: art is only ever the app's own picture.

Every word is set as text, never as markup (MM5). What the page leaves out, the app fills in: the title is
the caption, or the one match's name, or the category's name; the facts are how many are on this page and
on other pages, and the kind; the statement is the one match's tooltip (its `tooltip`, `what` or notes),
else the caption; the art is the one match's picture, else a drawing of the matches.

Each `preview()` call (and `preview(null)`) sends `topoforge:preview`: `{ mode, caption, count, other,
ids, card }` (`card` is the card as shown, or `null` in rings mode; `preview(null)` sends count 0 and an
empty caption) (MM1). The return value of `preview()` is the same object (with `true` still returned for
`null`).

### The map's own scale: `TopoForge.mapScale(n)`

`n` from 1 (the whole drawing, as before) to 8. Above 1 the map shows a nearer part of the drawing,
centred on the view, and follows the view as it moves. `mapScale()` reads it. Kept in this browser
(`mapScale`) (MM6, MM8). With `map` on, the map's handles gain **Mode**, a menu: the three modes (the
current one checked) and the map's scale (Closer, Farther, The whole drawing), all with one pointer (MM6).

### The wheel over the map: `mapwheel`

Off unless a page asks (it changes what the wheel does over the map, so it is a switch, not a default).
With it on, over the map:

| wheel | does |
|---|---|
| plain | zooms the drawing about the middle of the view (the map stays a map; to zoom elsewhere, click the map there first) (MW1) |
| Alt | changes the map's own scale (MW3) |
| Shift | moves the view east and west (MW4) |
| Alt+Shift | moves the view north and south (MW5) |

Browsers send Shift+wheel as a sideways wheel (`deltaX`, with `deltaY` 0) on many systems; the app takes
whichever of the two moved most, so both arrive the same (MW4). Some desktops take Alt+wheel (or Alt with
the pointer) for themselves before the page sees it; where that happens, the Mode menu's Closer and
Farther, or `mapScale()`, do the same. With `mapwheel` off the wheel over the map does nothing, as before
(MW2).

## Added in 1.11 (still v1): the map's pad, and Reset layout

Two new switch words, `mappad` and `reset`, off unless a page asks and in neither `all` nor `bare`.
Nothing 1.10 promised changes; a page opened on its own draws the same pixels as 1.10 (S1).

### The map's pad: `mappad`

`mappad` turns `map` on too (the pad hangs on the map's own frame). The pad is a cross of 44-pixel
cells that hangs on the map's outer edge, beside the handles: on its left, or on its right when the map
is too near the drawing's left edge. It moves with the map, and is shown and hidden with the handles (the
pointer within reach, a handle or the pad focused, or always on a screen with no hover) (PD1).

- **The horizontal bar is a drawn slider** for `mapMode` (`role="slider"`, `aria-valuenow` 0, 1, 2,
  `aria-valuetext` in words): left **Preview shapes** (`cards`), centre **Both** (the default), right
  **Highlight matches** (`rings`). A visible track with three marked and labelled stops; the thumb glides
  between them (0.18 s), and jumps when reduced motion is asked. ← and → (also ↓ and ↑, as a slider
  takes them), Home and End, a click on a stop, or dragging the thumb, all move it. It drives `mapMode`
  and follows it: the Mode menu, `mapMode()` and the pad are always in step (PD2-PD4, PD8).
- **The vertical arm** calibrates the map: ▲ Closer and ▼ Farther (`mapScale` × or ÷ 1.5, between 1
  and 8). **The centre press** is The whole drawing (`mapScale(1)`): a press on the slider's thumb (without
  dragging it), or Enter or Space on the slider (PD5).
- **The grip** (⠿, top left of the cross) moves the map: drag it, or the arrow keys (16 pixels, 64 with
  Shift). The mode never moves or resizes the map (PD6).
- `TopoForge.padArrows('mode-scale' | 'pan')`: `mode-scale` is the default (above). `pan` swaps the arms
  for panning the drawing: ▲ north, ▼ south, ◀ west, ▶ east, 64 pixels a press, Fit in the middle; the
  slider is not shown meanwhile. `padArrows()` reads it; any other word returns `false`. It is not kept
  in the browser: the page sets it (PD7).

Messages, with `map`, `preview` or `mappad` on: `topoforge:mapmode` `{ mode, mapCaption }` as in 1.10
(now also with `mappad` alone), and new `topoforge:mapscale` `{ scale }` whenever the map's scale changes,
by any route (PD3, PD5).

### Reset layout: `reset`, `TopoForge.resetLayout()`, `TopoForge.undoReset()`

`resetLayout()` puts every movable or resizable part back to its first placement: the floating panels
(Shapes, Properties, the pages box: their places, and shown), the map's place and size (190 by 130, 12
pixels from the drawing's right and foot), its scale (1) and its mode (`both`, caption not in the map),
and the pad (which goes with the map). It touches nothing in the drawing: the document and the undo history
are unchanged. It keeps the first placement in this browser, says so in the live region and returns
`{ parts: ['panels', 'minimap', 'mapScale', 'mapMode', 'pad'], undo: true }` (RS1, RS2, RS4).

`undoReset()` puts back exactly what the last reset changed, one level, and returns `true`; with nothing to
undo it returns `false` (RS3). The calls work whenever called. With the `reset` switch on, **Reset layout**
(and, after one, **Undo reset**) appears at the foot of the map's Mode menu and of the View menu (and so
in `commands()`), and each reset and undo sends `topoforge:reset`: `{ parts, undo: true }` for a reset,
`{ parts, undone: true, undo: false }` for an undo, so the page can reset its own frames too (RS3). Without
the switch the menus are as in 1.10 (RS4).

## Added in 1.12 (still v1): the card that fills the map, and the pad that pages it

From Corwin's words of 2026-11-03 ("the feature is way upstream from obsmage"): the words in the map's card
should be larger, "fill as much space as that gives"; "Why no images? This is supposed to be the baseball or
flashcard or scoreboard or boxscore highlights, or several of these paginated"; and the pad could page them,
"changing the color and maybe even rotating the dpad 45deg so it's clear something happened".

Two new switch words, `bigcard` and `cardpad`, off unless a page asks and in neither `all` nor `bare` (W1).
Nothing 1.11 promised changes: a page opened on its own draws the same pixels as 1.11 (S1), and so does a page
with every 1.11 switch on and 1.10's card shown, as long as it has not asked for the new ones (S6).

### The card that fills the map: `bigcard`

`bigcard` turns `preview` on too. While a card shows (in the `cards` and `both` modes):

- **Its words are as large as fit**, found by measuring. The app tries sizes from 1.10's (the floor: a
  12.5-pixel title, 11-pixel facts and statement) up to four times them (the ceiling: a 50-pixel title) and
  draws the largest at which nothing is cut. It fits again whenever the map's box changes size (its handles,
  Position, the window, the pages box) and whenever the map is redrawn (the map's scale, the theme, the
  drawing) (BC1, BC2).
- **The art is large**: a panel beside the words (42% of the card's width, as far as its height allows) or
  above them (42% of its height, as far as its width allows), whichever lets the words be larger; in the map's
  first size, 190 by 130 pixels, it is a third of the card. It is the shape's own picture, the one `shapes()`
  gives; for several matches, their pictures side by side (up to four), which is what `art: 'matches'` means
  with `bigcard`. A card with no picture at all (`art: 'none'`, or nothing on this page) gives the words the
  whole card (BC3).
- **A picture from the page**: `card.art` may be `{ src, alt }`. It is shown only when `src` resolves to a URL
  of the app's own origin over http or https; never another host, a `//host/` path, `data:`, `blob:`,
  `javascript:` or `file:`, and nothing at all when the app is opened from `file://`. It is an `<img>` whose
  `alt` is the page's words (the card's title when it gives none), never markup. Nothing is asked of another
  host, so the app stays within its own content security policy and an embedding page's. A picture that fails
  to load gives way to the shape's own. Without `bigcard`, `{ src }` is ignored, as in 1.10 (BC4).
- **A box score, or lines**: the facts are cells, each a label in small capitals over its value, side by side,
  when they fit at 1.10's size or larger; otherwise they are lines, label and value on one line. In a map too
  small for every fact at 1.10's size, the last facts (and then the statement) are left out, not cut. When the
  page gives no facts, the app's are the kind and the shape's own fields: host name, IP address, VLAN, status,
  vendor, model, subnet (BC5).
- **Several matches are pages.** The first page is the card 1.10 shows (the page's card, or the app's summary);
  then comes one card for each match, in drawing order (or in the page's order when it named them by id or
  ref), each with the match's name, picture, kind and fields, and its tooltip as the statement. The card shows
  "2 of 5" at its top right. There are 9 pages at most: the house number 9, the first card and eight matches.
  A person turns them one at a time, so past nine they should narrow the search instead, and "9 of 9" keeps the
  pad's readout to one digit. The first card then says "As cards: 8 of N". In `both` mode the drawing lights
  every match on the first page and only that match on its own page (BC6, BC7).
- `TopoForge.cardPage()` reads `{ page, pages, title }` (`page` counts from 1; `pages` is 0 when no big card
  shows). `cardPage(n)`, `'next'`, `'previous'`, `'first'` or `'last'` turns to that page and returns the same,
  or `false` (no card, past either end, any other word). Each turn is said in the live region ("Card 2 of 5:
  Edge Router.") and sends `topoforge:cardpage` `{ page, pages, title, ids }`. Each `preview()` starts on page 1
  (BC6).
- With `bigcard`, `topoforge:preview` (and the value `preview()` returns) also carries `page`, `pages` and
  `cards`, every page's card, text only; without it the message is 1.10's, field for field (BC9).
- On a screen 860 pixels wide or less, where the map is hidden, the map shows while a card does: a sheet along
  the drawing's foot, 8 pixels in from its sides and foot, 42% of its height (from 150 to 340 pixels). With the
  card gone it is hidden again. The map's handles are not shown there (BC8).
- `TopoForge.embed({ bigcard: false })` puts 1.10's card back (BC10).

### The pad that pages the cards: `cardpad`

`cardpad` turns `bigcard` and `mappad` on (and so `preview` and `map`). While a big card shows:

- the pad **turns 45 degrees** (a 0.2-second turn, and back again; at once when reduced motion is asked) and its
  arms take the accent colour, their glyphs at least 4.5 to 1 against it (CP2, CP8);
- its slider is put away, and its arms page the cards: **the upper arms go back, the lower arms forward**. Left
  (‹) is the previous card and up («) the first; right (›) is the next and down (») the last. The centre shows
  "2 of 5" and, pressed, says the card again. On those arms ← and → also turn one card, and Home and End go to
  the first and the last. An arm with nowhere to go says so and does nothing. The map's mode and scale are not
  touched; the map's Mode menu still sets them (CP3, CP7);
- every cell's tooltip (`title`) and accessible name say its job ("First card: 1 of 5", "Next card: 3 of 5",
  "Card 2 of 5: Edge Router. Press to hear it again"; the grip keeps "Move the overview map ..."), and the pad's
  own name says it is turned (CP4);
- the turn is said in the live region ("Map pad turned: it pages the cards, 1 of 5. ..."), and a focus that was
  on the slider goes to the next-card arm (CP2, CP5).

When the card goes (cleared, or the mode set to `rings`), the pad is exactly its 1.11 self again: the same
markup 1.11 draws, no tooltip or colour left behind, the focus back on the slider if it was on an arm that is
put away; that is said too ("Map pad back: ...") (CP1, CP6). Without `cardpad` the pad never turns (CP9).
`topoforge:cardpage`, like every message, reaches a parent page of the app's own origin only (E11).

## Added in 1.13 (still v1): a peek at a placed shape's card, and the zoom Fit would set

From Corwin's words of 2026-11-03, 17:01: "when hovering a shape on the main stage area it would be good to have a
modifier key that shows the flash-card/trading-card like we get with no modifier".

One new switch word, `peek`, off unless a page asks and in neither `all` nor `bare` (W1), and one new call,
`TopoForge.fitScale()`, which reads and changes nothing. Nothing 1.12 promised changes: a page opened on its own draws
the same pixels as 1.12 (S1), and so does a page with every 1.12 switch on, the big card on its second page and the pad
turned (S7).

### A peek at a placed shape's card: `peek`

`peek` turns `preview` on too (the peek shows the preview's card). The modifier is **Shift**: a lone Alt takes the focus
to the browser's menu on Windows, and Ctrl and Meta zoom the drawing with the wheel.

- **With the pointer.** While Shift is held with the pointer over a shape on the drawing, and no mouse button is down,
  nothing is being dragged (no move, resize, marquee or connection) and no text is being edited, the map shows that
  shape's card, drawn by the same path as `preview([id])`: the same card, so with `bigcard` it fills the map and is
  fitted (PK2), and in `both` mode the shape is lit in the drawing (PK4). Moving to another shape with Shift held
  swaps the card at once (PK3). Letting Shift go, leaving the shape (Shift still held) or the pointer leaving the
  drawing puts back exactly what the map showed before the peek: the page's own preview, on the card of its pages it
  was on, or nothing (PK4, PK5, PK6).
- **With the keyboard.** With the drawing focused and exactly one shape selected, Shift pressed alone shows the
  selected shape's card the same way, until Shift is let go (while the pointer is on the drawing, the shape under it is
  the one shown). With two or more selected, or the focus elsewhere, it shows nothing (PK7).
- **It never takes an event.** The peek only listens: it prevents and stops nothing. Shift-click still adds a shape
  to the selection or takes it away, Shift-drag still draws a marquee or moves the selection, Shift+wheel still moves
  the view east and west, Shift on a resize handle still keeps the shape's proportions, and Shift with the arrow keys
  still nudges the selection one grid step (PK8). While a button is down there is no card; it comes back when the
  button is let go, if Shift is still held over a shape (PK2).
- **The page is told**: `topoforge:peek`, by the same two routes and the same origin rule as every message, `{ id,
  name }` when a card shows (and again for each shape it swaps to; `name` is the card's title) and `{ id: null }` when
  it goes (PK9, E12). With the map hidden (in a window 860 pixels wide or less, for one) nothing is drawn and nothing is
  lit, but the page is still told (PK10).
- **A peek is not the page's preview.** `topoforge:preview` is not sent for it, and the pad is left as it was (a pad
  turned for the page's cards stays turned, on the page's card). While a peek shows, `cardPage()` reads the card shown
  (one page). The page's own `preview()` during a peek ends it (told `{ id: null }`) and is drawn at once; letting
  Shift go then leaves the page's preview where it is (PK11). `TopoForge.embed({ peek: false })` ends a peek that shows,
  at once, and tells the page (PK1).

### The zoom Fit would set: `TopoForge.fitScale()`

`TopoForge.fitScale()` returns the zoom `k` that `fitView()` (Fit to window) would set now, with the same room for
floating panels, the same padding (`fitScale(pad)` takes the same optional padding as `fitView(pad)`, 50 pixels when
it is left out) and the same limits, rounded as `TopoForge.view` rounds `k` (to 5 places), so that after `fitView()`
`TopoForge.view.k` equals it. It moves nothing: the view is as it was. On a page with nothing on it, it is 1, the zoom
`fitView()` sets there. A page may use it to put "fit" in the middle of its own zoom slider (FS1). The two share one
calculation, and `fitView()` sets exactly the view 1.12 set (FS2). It is not behind a switch: it changes nothing.

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
