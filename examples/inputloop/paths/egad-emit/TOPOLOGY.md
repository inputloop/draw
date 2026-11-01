---
name: egad-emit
kind: parallelogram
pillar: path
layer: operational
connects: egad
---
# egad-emit

How one set of tokens reaches every surface: `emit/emit.py` derives CSS custom properties, an Org HTML
export theme, two Emacs themes packaged for ELPA, and adapters for platforms that can be themed
(Nextcloud, Element, KDE). `make` writes them into `dist/`; `make check` measures every promised colour
pair first.
