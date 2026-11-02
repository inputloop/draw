---
name: omg-heal
kind: rect
pillar: part
layer: operational
file: packaging/healer/omg-heal
state: built
---
# omg-heal

`packaging/healer/omg-heal`: the build healer. Follows `main` (the default), project meta, tags, or
signed tags only. Runs on gw33 as an ordinary user's systemd timer (`packaging/healer/user/`) and
builds the obsmage add-on `.deb` (plugin and tools, 0.0.1) from `main`. A `.deb` of OBS itself waits
on a patch queue and a `debian/` overlay for OBS. Tests: `tests/e2e-healer.sh`, `tests/e2e-packaging.sh`.
