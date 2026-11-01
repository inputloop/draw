---
name: atoms-roundtrip
kind: parallelogram
pillar: path
layer: operational
connects: obsmage
---
# atoms-roundtrip

An OBS configuration is split into atoms, rolled up into `STAGES.md`, edited by a person or a tool, and
unrolled back. If both sides changed since the pin, the tool stops and names the atoms in conflict.
It never picks a side.
