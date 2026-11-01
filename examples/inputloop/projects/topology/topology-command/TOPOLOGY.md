---
name: topology-command
kind: rect
pillar: part
layer: operational
file: perl/Topology/script/topology
connects: gw26
---
# topology-command

`perl/Topology/script/topology`: reads `repos.d`, fetches the repositories listed, builds the graph as
small files (`r/` and `c/`, written twice) and serves it read-only. Modules: `Config`, `Doc`, `Repo`,
`Graph`, `Taxonomy`, `Build`, `CSV`, `Server`. Every feature can be switched off in
`/etc/topology/topology.conf`; `ceiling = spa` leaves only the app's files.
