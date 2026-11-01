---
name: topology-core
kind: rect
pillar: part
layer: operational
file: www/js/topology-core.js
---
# topology-core

`www/js/topology-core.js`: the rules, not the pictures: reading `TOPOLOGY.md`, deciding what private parts
show, the settings kept in the browser, and the CSV TopoForge opens. The same rules are written a second
time in Perl (`Topology::Doc`), and both run against `spec/fixtures/`.
