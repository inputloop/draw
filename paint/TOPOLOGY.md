---
name: topology-paint
kind: rect
pillar: part
layer: operational
connects: bryant
files: README.md, docs/MODDING.md, docs/LESSONS-LEARNED.md, include/tpaint_mod.h, build.bat, build.sh
---
# topology-paint

topology paint, the drawing and painting program built into topology, made for Bryant Frankford. One C
program for Windows, Linux and macOS: pen pressure and tilt (SDL3), brushes, layers with blend modes,
OpenRaster and Photoshop files with their layers, PNG, JPEG, TIFF and more, and mods (filters,
formats, brush tips) as shared libraries.

| file | says |
|---|---|
| `README.md` | what it does, how to build, install and update it, pen tablet setup |
| `docs/MODDING.md` | brushes, palettes, native mods, and where to change the source |
| `docs/LESSONS-LEARNED.md` | what went wrong, what mattered, what is not done yet |
| `include/tpaint_mod.h` | the whole mod contract |

`build.bat` (Windows) or `build.sh` builds, installs and updates it; `sh tests/run.sh` checks its core.
