---
name: .github
kind: container
pillar: part
layer: operational
connects: corwin, bryant, github.com/inputloop
repo: https://github.com/inputloop/.github
---
# .github

The inputloop organisation's public profile page (`profile/README.md`) and the community files GitHub
uses for every inputloop repository that has none of its own: how we treat each other
(`CODE_OF_CONDUCT.md`), how to get help (`SUPPORT.md`), how to report a security problem
(`SECURITY.md`) and what we hold ourselves to on accessibility (`ACCESSIBILITY.md`).

The profile page is built, not typed: `profile/catalog.tsv` holds one row per public repository, and
`profile/tiles/` a light and a dark picture for each (see the path `profile-build`). Corwin and Bryant
made it together; prose CC-BY-SA-4.0.
