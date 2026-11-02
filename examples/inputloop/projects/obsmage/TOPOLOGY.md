---
name: obsmage
kind: container
pillar: part
private: hide
layer: operational
contains: omg-atoms, omg-compose, omg-heal, obsmage-core
connects: avalon, gw33
code-licence: GPL-3.0-or-later OR LGPL-3.0-or-later
prose-licence: CC-BY-SA-4.0
files: README.md, CONVENTIONS.md, MODEL.md, STAGES.md, AGENTS.md, docs/REQUIREMENTS.md, docs/AR-CONTROL.md, docs/COMPOSER.md, docs/PACKAGING.md
---
# obsmage

OBS Studio kept as a living, literate configuration, with plugins that sense the room. A downstream
build of OBS whose whole configuration is split into key/value atoms that a person or a tool can read,
diff, version and change, with credentials kept out of everything published.

## Parts

- `omg-atoms` splits an OBS configuration into atoms and joins it back (INI byte-exact, JSON parse-equal).
- `omg-compose` audits and rebinds multi-monitor captures by stable id.
- `omg-heal` plans, builds and heals Debian and source builds.
- `obsmage-core` is the plugin skeleton: it builds and loads in OBS Studio 32.1.0; its menu entries only log.

## Files that say what it is

| file | says |
|---|---|
| `README.md` | what works today, what is only designed, how to try it |
| `CONVENTIONS.md` | atoms and their classes, the `STAGES.md` seam, why nothing is reorganized automatically |
| `MODEL.md` | the direction, for a brand-new reader |
| `STAGES.md` | the one-file roll-up of every atom (two readers, two writers, a pin) |
| `AGENTS.md` | who commits, and what must be green before a push |
| `docs/REQUIREMENTS.md` | the requirements R1 to R8 and where each stands |

Personal recipes live in their own repositories that consume this one; `obsmage-corwin` is the first.

## Private

The repository is not public yet: https://github.com/inputloop/obsmage
