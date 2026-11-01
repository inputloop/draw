---
name: topology-www
kind: site
pillar: place
layer: operational
contains: topology-core, topoforge
file: www/
connects: gw26
---
# topology-www

`www/`: the front door (`index.html`), the app (`app.html`), the stylesheets (`css/topology.css`, with
egad's tokens in `css/egad.css`) and TopoForge. Works with no server (Zero Sharing). Checked for
accessibility by `tests/a11y-check.mjs`.
