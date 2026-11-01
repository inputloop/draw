---
name: profile-build
kind: parallelogram
pillar: path
layer: operational
connects: .github
---
# profile-build

How the organisation's front page is made: the catalog lives with its builder and its check in a
members' repository; the public rows are cut from it into `profile/catalog.tsv`, the builder writes
the page between two marked lines, and the check refuses the page when it names anything private.
