---
name: omg-atoms
kind: rect
pillar: part
layer: operational
file: tools/omg_atoms.py
state: built
---
# omg-atoms

`tools/omg_atoms.py`: `find`, `verify`, `split`, `join`, `rollup`, `unroll` over an OBS configuration.
Secret atoms go to a local vault (mode 600) and appear in anything published only as `@secret(len=N)`.
Tests: `tests/test_atoms.py`, `tests/e2e.sh` with `--prove-red`.
