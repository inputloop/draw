---
name: transcript-sync
kind: parallelogram
pillar: path
layer: operational
connects: three-phase-transcription
---
# transcript-sync

How the transcription tools travel: `PATHS` lists what belongs to the repository, and `sync.sh` moves
those paths both ways: `diff` says what differs in words, `into` unpacks them into a working tree, and
`from` rebuilds the repository from one. The recordings themselves never travel.
