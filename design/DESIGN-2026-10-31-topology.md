# DESIGN 2026-10-31: topology, the corwin branch

What it should be, written before and while it was built, where a tool can find it. The request is
`context/PROMPT-2026-10-31-topology-corwin.md`; the answers to its two questions are
`design/LENS-2026-10-31-topology-ui.md`; the words are `design/TAXONOMY.org`.

## One paragraph

topology reads a list of git repositories, finds a `TOPOLOGY.md` (or `.topology.md`) in each
container, keeps what it learns as key/value cells on disk, sorts each thing by four pillars
(place, part, path, person), and serves a graph API that a browser app draws with TopoForge. The
browser app works with no server at all (Zero Sharing). Every feature can be switched off, down to
the browser app as files on disk. It ships as three Debian packages built by one literate recipe
that is itself shipped in them.

## The pieces, and the objective each answers

| objective (prompt) | piece | where |
|---|---|---|
| name is "topology" | everything | |
| circular recipe, Debian, switch features off to just the SPA | `RECIPE.org`, `debian/`, the ladder | `RECIPE.org`, `etc/topology.conf`, `Topology::Config` |
| a list of git repositories, credentials | `repos.d/*.conf`, `Topology::Repo`, `topology-askpass` | `perl/Topology/lib/Topology/Repo.pm` |
| graph API, on gw26 | `Topology::Server`, `topology serve`, nginx snippet, run card | `perl/.../Server.pm`, `runcards/` |
| latest stable perl | 5.44.0, built into `/opt/topology/perl` | `topology-perl`, `bin/fetch-sources.sh` |
| well-maintained CPAN modules | 16 distributions, chosen by maintainer | `vendor/VENDOR.org` |
| the class system, Object::Pad, async; classic conventions as the bridge | class for data, classic for operator code, `CLASSIC-BRIDGE.pod`; tests on 5.44 (core class) and 5.38 (Object::Pad) | `perl/Topology/` |
| h2xs-style package | `Makefile.PL`, `MANIFEST`, `Changes`, `README`, `t/` | `perl/Topology/` |
| browse and download sources and debs | `topology-www` + `/dist/` | `bin/publish-dist.sh` |
| Classic Open Source front door, two ways in | `www/index.html` | |
| Zero Sharing, upgrade wizard, Accept all, summary tree, export before and after | `www/app.html`, `topology-core.js` | browser test `tests/browser/app.browser.mjs` |
| TOPOLOGY.md, show private per container and global | spec, Perl, JavaScript, shared fixtures | `spec/TOPOLOGY-md.md`, `spec/fixtures/` |
| k/v graph, context drawn and normalized by the taxonomy | `Topology::Graph` (cells written twice), `Topology::Build`, `pillars.json` | |
| UI/UX ideation through LENS and writing-forms | the LENS page | `design/LENS-2026-10-31-topology-ui.md` |
| capture the baseline for others | `context/` | `context/FOR-OTHERS.md` |

## Describe, propose, effect

From Bridget's words (see `context/REVIEW-2026-10-31-topography-transcript.md`). Three buttons
over the drawing:

- **Draw the graph** (describe): fetch the graph from the API in use, turn it into the CSV
  TopoForge reads, and add it to the drawing. With no API, the person draws by hand.
- **Copy as a prompt** (propose): the drawing's things, the notation it is read in, and the rule
  "treat anything the drawing does not say as unknown", as text for any tool the person trusts.
- **Go** (effect): `POST /api/v1/go`. Off unless the operator switches `write` on; when off it
  says so and offers the prompt instead. No tool that effects changes is shipped yet: with `write`
  on, the server says that too (501). That is the honest state of this branch.

## The k/v graph

One cell per fact: row (a thing), column (a property), value. Each cell is two files,
`r/<row>/<col>` and `c/<col>/<row>`, written atomically. `topology check` reads both sides and
reports any cell they disagree on. `ls c/pillar` lists every thing that has a pillar; `cat
r/lab%2Fgw26/notes` reads one (a `/` in a name is written `%2F`). `topology build` makes a fresh graph
beside the old one and swaps it in, so nothing a repository stopped saying survives a rebuild. Rows are named by where they came from (`repo:c4`, `c4/serve`,
`thing:gw26` for a name only mentioned). A `TOPOLOGY.md` key the app does not know becomes a column
`meta.<key>`: nothing is dropped.

## The ladder

`spa < web < api < repos < write`. Each rung needs those below it. `ceiling` caps them all; a
`feature.X = off` line switches one off. systemd units run `topology need api` (or `repos`) as
ExecCondition, so a unit above the ceiling is skipped, not failed. `topology config` prints every
feature, on or off, and the line that decided.

## What is not built (said here so nobody has to find it out)

- A tool behind Go. The route exists and refuses in words.
- The layer filter in the app, and TopoForge's palette relabelled by notation (Bryant's file).
- The merge panel of the 2026-10-27 proposal; our host side of its integration object is built.
- A deploy to gw26: this session reached gw26 over HTTPS only. `runcards/RUNCARD-2026-10-31-gw26.md`
  is the hand-run version.
- An accessibility scan of our two pages with axe-core (TopoForge's own kit covers TopoForge).
