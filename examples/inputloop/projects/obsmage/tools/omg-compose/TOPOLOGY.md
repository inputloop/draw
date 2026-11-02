---
name: omg-compose
kind: rect
pillar: part
layer: operational
file: tools/omg_compose.py
state: built; plugin wiring open
---
# omg-compose

`tools/omg_compose.py`: `displays`, `audit`, `compose`, `infer-layout`. Audits which captures bind to a display by index (fragile) or by stable id,
rebinds them, keeps screen-map scenes current. Never deletes; hides and reports. Every write is behind
`--write` and leaves a dated backup. See `docs/COMPOSER.md`. Tests: `tests/test_compose.py`.
