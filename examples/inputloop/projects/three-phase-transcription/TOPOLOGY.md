---
name: three-phase-transcription
kind: container
pillar: part
layer: operational
connects: corwin, github.com/inputloop
repo: https://github.com/inputloop/three-phase-transcription
---
# three-phase-transcription

Recorded talk, in three layers that each cite the one below: quotes by time (`tr1qt`), subjects drawn
from the quotes (`tr2sm`), and a result (`tr3rm`) that names each seam and the pin that holds it, or
says it is still open. Every sentence in a result can be followed back to the second it was said.
`tr2vs` holds a subject layer against another reader's findings.

What can be checked is checked twice, by two readers written in different languages from the same
rules (`tests/tr-spec.sh` re-reads a set in sh and awk). The recordings stay where they were made; only
the tools travel (see the path `transcript-sync`). Corwin's. Code GPL-3.0-or-later (or
LGPL-3.0-or-later where a file says so); prose CC-BY-SA-4.0.
