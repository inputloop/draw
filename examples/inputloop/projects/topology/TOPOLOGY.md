---
name: topology
kind: container
pillar: part
private: hide
layer: operational
contains: topology-command, topology-www, topology-core, topoforge
connects: gw26, obsmage, vibrobeast
branch: corwin
files: README.org, RECIPE.org, AGENTS.md, spec/TOPOLOGY-md.md, taxonomy/pillars.json, design/TAXONOMY.org, www/index.html, www/app.html, www/css/egad.css, tests/a11y-check.mjs
---
# topology

Draw what you have, from the files that describe it. Reads `TOPOLOGY.md` from the git repositories you
keep, sorts what they say by place, part, path and person, and draws it with TopoForge.

## Files that say what it is

| file | says |
|---|---|
| `README.org` | what it is, how to try it, where things are |
| `RECIPE.org` | the source of `bin/`, `debian/` and `etc/`; tangle it to rebuild them |
| `spec/TOPOLOGY-md.md` | the file format and the show-private rule |
| `taxonomy/pillars.json` | the four pillars, two axes, six tensions, as data |
| `AGENTS.md` | who commits and where work lands |
| `examples/inputloop/` | this drawing of the shop |

Private parts of any `TOPOLOGY.md` stay hidden until the component or the person says show.

## Private

The repository is not public yet: https://github.com/inputloop/topology
