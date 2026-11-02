---
name: obsmage-core
kind: rect
pillar: part
layer: abstract
file: plugin/obsmage-core/
state: skeleton; builds and loads
---
# obsmage-core

The core plugin skeleton: where AR desktop control and camera calibration will attach
(`docs/AR-CONTROL.md`). It builds against Ubuntu 26.04's libobs and loads in OBS Studio 32.1.0 on
gw33 (2026-11-01, `docs/REQUIREMENTS.md`, R4). Its two Tools-menu entries only log so far; no
Windows build yet.
