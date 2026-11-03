---
name: topology
kind: container
pillar: part
layer: operational
contains: topology-command, topology-www, topology-core, topoforge, topology-paint
connects: gw26, obsmage, vibrobeast
branch: corwin
repo: https://github.com/inputloop/topology
files: README.org, RECIPE.org, AGENTS.md, spec/TOPOLOGY-md.md, taxonomy/pillars.json, design/TAXONOMY.org, www/index.html, www/app.html, www/css/egad.css, tests/a11y-check.mjs, paint/README.md
---
# topology

Draw what you have, from the files that describe it. Reads `TOPOLOGY.md` from the git repositories you
keep, sorts what they say by place, part, path and person, and draws it with TopoForge. Carries a
painting program too, topology paint (`paint/`).

## Files that say what it is

| file | says |
|---|---|
| `README.org` | what it is, how to try it, where things are |
| `RECIPE.org` | the source of `bin/`, `debian/` and `etc/`; tangle it to rebuild them |
| `spec/TOPOLOGY-md.md` | the file format and the show-private rule |
| `taxonomy/pillars.json` | the four pillars, two axes, six tensions, as data |
| `AGENTS.md` | who commits and where work lands |
| `examples/inputloop/` | this drawing of the shop |
| `paint/README.md` | topology paint: build, install, pen tablets, mods |

Private parts of any `TOPOLOGY.md` stay hidden until the component or the person says show.

The repository is public, on the `corwin` branch (public since 2026-11-01).
