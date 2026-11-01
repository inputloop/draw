---
name: about-corwin
kind: container
pillar: part
layer: operational
repo: https://github.com/inputloop/about-corwin
---
# about-corwin

The source of aboutcorwin.com, a personal page. The repository is public (since 2026-11-01).

What it holds: `content/` (one text file per card), `src/`, `build.py` (Python standard library only),
`tests/` with `run.sh --prove-red`, and `DESIGN.md`, `ACCESSIBILITY.md` and `BUILDING.md`. It links only
public repositories. It builds in several places and is put on its host by hand.
