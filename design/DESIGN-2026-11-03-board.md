<!--
SPDX-FileCopyrightText: 2026 Corwin Brust <corwin@bru.st> and Bryant Frankford <nathanielfrankford@gmail.com>
SPDX-License-Identifier: CC-BY-SA-4.0
-->
# DESIGN 2026-11-03 — topology board: notes in a meeting, on a canvas

## What it should be

A page where a person reads one document and takes notes beside it, in whichever way the moment needs:
typing a card, dropping it in a lane, scribbling anywhere (including over cards: color outside the lines),
framing a scribble and some cards to lift them into one note, and tagging by dropping a chip on a card or on the
backdrop. A chip dropped on the backdrop makes a *ground*: a region whose cards carry the tag without anyone typing it.
Topology knows nothing about where the documents come from. A page that serves it answers at `./api` (hello, docs,
doc, board, save). Without one, it keeps the board in the browser and exports Markdown, Org and JSON.

Corwin's ask, verbatim (2026-11-03 08:45 CST, excerpt): "When the user wants to lift into a named note they can just
draw frame around the text and it should offer to add the one to the other, exposing the preferences panel/frame
inline to allow setting other particulars." and "The icing on the cake would be a tag pallet, that could be
dropped/added onto/into the cards or the backdrop, enabling containerization implicitly … trying to use edge detect to
find if we should 'just draw' or if we should ask, adding menu/customization options for this."

## Major modes and looks (what is built in www/board/index.html)

| | what it is | where it came from (JUDGED: my reading of each suite's history, from general knowledge, not a source read today) |
|---|---|---|
| Board mode | lanes, cards, grounds; double-click for a card | Trello/Planner buckets; Lotus Notes *views* over documents (the same notes seen by lane and by tag) |
| Sketch mode | the pen first; ink over or under cards | OneNote's free page, where ink and typed text live together and a lasso turns ink into an object |
| Read mode | the reader grows; `q` quotes a selection into a card | Word's Reading View; Google Docs' comment-beside-text; Emacs's `org-capture` from a buffer |
| Free look | no borders; small Emacs-like frames float on the canvas: menus, tool bar, tool options, mode-line, echo area | corwin.cloud's *free* (q/2026-11-01-free-and-classic) |
| Classic look | the same pieces docked: menu bar, ribbon, docked reader, status line | Office 2007's ribbon and status bar; corwin.cloud's *classic* |

Each look and each mode uses the same DOM. A look only moves the pieces, so a feature added to one is there in the other.

## Controls, one by one

- **The mode-line** is a string of live elements, as Emacs's is: modified flag, board name (click: rename), `(Major +minors)`
  (click: next major mode), tool (click: next), zoom (click: 100%), counts, look (click: switch). Every element is a button
  with its own label.
- **The echo area** is the status line until it is clicked or `M-x` is pressed. Then it becomes the one-line
  minibuffer with Tab completion of commands. Questions (rename, tag, ground) are asked there with a default, never in a modal.
- **Edge detect, made small.** A stroke whose ends meet (gap under 15% of its diagonal, diagonal over 60 px) and which
  encloses cards or other ink is a question. The answer is a setting (Tools menu, the pen's options, `M-x closed-loop`):
  *ask* (default), *just draw*, *lift at once*. The frame tool always asks.
- **The lift panel** is inline beside the frame, not a modal. It shows what is inside, a title, *add to* (a new card or
  one of the cards inside: "add the one to the other"), lane, tags, and *keep the ink too*. Enter makes the note and
  Esc keeps it as ink.
- **Ink** follows Bryant's topology paint: his presets (Pencil, Ink Pen, Round Brush, Marker, Calligraphy, with paint's
  numbers, checked by tests/js/board.test.mjs B3), his pressure curve as a softer/firmer slider with a live meter, his
  stabilizer, and his Dusk palette. Strokes are stored as vectors, so a board stays text.

## Accessibility (the house positions, as carried)

- The board has a text alternative: the outline (`o`, or the skip link) is the same Markdown the export writes, with
  lanes, cards, tags, implicit tags from grounds, and a count of the ink.
- Every action is in a menu and has a key. Menus are buttons that say they open a menu and whether it is open, with
  arrow keys inside and Escape back to the button (topology forge's changes to Bryant's 1.5, kept the same here). There
  is no `role=menubar`.
- Cards are focusable list items whose labels give their first line and tags. Tag chips take Enter (tag the selected
  card) and Shift+Enter (make a ground), so dragging is never the only way.
- The font stacks only name fonts: Atkinson Hyperlegible first, mono without ligatures. It follows the system's
  dark/light setting, with an override. Reduced motion and forced colours are respected. axe-core finds no WCAG 2 A/AA
  violations on the served page (checked 2026-11-03, Playwright, with a planner open and a card tagged).

## Open, his to decide

- Ink to text (OneNote's handwriting recognition) is not here: it would need a model, and the board is one file with
  nothing fetched.
- A ground currently tags by where a card's centre sits. Whether a card should *keep* the tag when it leaves the ground
  is a choice (now: it does not, the tag is implicit and shown dashed).
- Bryant's paint is a native SDL program. The board borrows its brush model, not its code. A shared brush file format
  (`.brush` read by both) is the natural next reuse.

Mentat (for Corwin, claude-opus-5-5)
