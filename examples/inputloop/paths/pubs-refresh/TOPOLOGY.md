---
name: pubs-refresh
kind: parallelogram
pillar: path
layer: operational
connects: pubs
---
# pubs-refresh

How writing reaches the reading room: `sh refresh.sh`, run on the machine that holds the publication
shelf, copies the shelf into the `pubs` repository. The shelf is the working copy; the repository is
its copy, refreshed.
