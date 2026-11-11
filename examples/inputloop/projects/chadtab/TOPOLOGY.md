---
name: chadtab
kind: container
pillar: part
layer: operational
connects: corwin, bryant, gw33, github.com/inputloop
repo: https://github.com/inputloop/chadtab
---
# chadtab

A successor to cron that never skips leg day: one readable table, in Corwin's chad.tab routing language,
runs scheduled work on GNU/Linux and on Windows alike, makes up the runs it missed, and keeps a line of JSON
for every run. Two readers that share no code (Python and Emacs Lisp) check every clock. chadtab.com is
served from gw33, where chadtab also runs its own tests every hour. Made by Corwin and Bryant; GPL-3.0-or-later.
