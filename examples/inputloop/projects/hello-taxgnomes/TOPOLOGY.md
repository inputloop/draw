---
name: hello-taxgnomes
kind: container
pillar: part
layer: operational
connects: corwin, egad, github.com/inputloop
repo: https://github.com/inputloop/hello-taxgnomes
---
# hello-taxgnomes

The Gnemonic Word Mines: a reading component built from a taxonomy at build time. Pick a word from the
word game's four tables and move a four-way slider: north simpler, south denser, east moodier, west
drier; the centre is the plain gloss. Every sentence says who wrote it: a dictionary, the game's pooled
sentences, a template, or a local model.

A worked example for egad: its egad hooks are suggestions, and the page works alone. `make` builds one
page, `build/hello-taxgnomes.html`, that runs in any browser; `make check` has two unfolders agree and a
second reader check the build. By Corwin Brust and Contributors. Code GPL-3.0-or-later; prose
CC BY-SA 4.0; the readings quote WordNet 3.1, GCIDE 0.53 and SCOWL under their own terms.
