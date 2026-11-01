---
name: egad
kind: container
pillar: part
layer: operational
connects: corwin, github.com/inputloop
repo: https://github.com/inputloop/egad
---
# egad

The house design system: one set of design tokens (`tokens/egad-tokens.json`: colours, type, spacing,
radii), rooted in GNU Emacs's Modus themes, which were built to clear WCAG AAA (7:1) for text. The gate
in the repository measures that claim rather than repeating it; corwin.cloud's demo of egad measures it
again, each time the site is built.

Emitters derive everything else from the tokens (see the path `egad-emit`). An archive node serves the
derivations the way ELPA serves packages: plain files, signed, found through `/.well-known/egad`.
egadjit is literate tooling: an Org file that tangles with or without Emacs, and a test that insists
the two agree. Corwin's; the colour values come from the Modus themes (Protesilaos Stavrou). Code
GPL-3.0-or-later; prose CC BY-SA 4.0.
