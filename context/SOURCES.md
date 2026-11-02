# SOURCES: what this branch was made from (2026-10-31)

The request is `PROMPT-2026-10-31-topology-corwin.md`. This page lists what was read beside it, so
that someone repeating the work (Bryant, Bridget, a stranger, or us later) can see which inputs we
had and choose their own. Each row names the file as it sits on Corwin's computer (avalon, MSYS2
spelling), its sha256 when read, and what it gave this branch. Nothing here is copied into the
branch unless the last column says so.

## Inputs read

| file | sha256 (first 16) | what it gave |
|---|---|---|
| `/f/claude/projects/topoforge/index.html` (TopoForge 1.7, commit `70c3db4`) | `c6c0fbc0e2ba99fd` | the drawing app; vendored as `www/topoforge/index.html` unchanged; its CSV columns are what our graph API speaks |
| `/f/claude/projects/topoforge/README.org` | `ea86b28614ac1f51` | licences (code GPL-3.0+ OR LGPL-3.0+, prose CC-BY-SA-4.0), accessibility bar, `?load=` rules |
| `/f/claude/projects/topoforge/RECIPE.org` | `15de01be45196b30` | the shape of a literate ship recipe; `bin/tangle.sh` taken over as is |
| `/f/claude/projects/topoforge/FOR-BRYANT.md` | `14a4b43e5d4e629b` | what is Bryant's to decide in TopoForge; nothing here overrides it |
| `/f/claude/c4/h/MODEL-2026-10-27-merge-and-literate-shape.md` | (read, not hashed) | the integration object (`ancestorFor`, `save`, `name`); our app is a host for it |
| `/f/claude/c4/q/PROMPT-2026-10-27-topoforge-merge-and-literate-shape.md` | `44a73e63b1336b4f` | "work out the literate shape of the recipe first"; where voice wins |
| `/f/claude/c4/h/WORKSURFACE-ui-directions.md` | `0fbcf9e84f47d649` | the UI treatments on the bench (Board, Cosmos, Chamber, Console), motion with a reduced-motion path |
| `/f/claude/c4/d/transcripts/2026-10-31-topography/` (README, QUOTES, RESULT) | `e080557d…`, `f8421bd2…`, `9902435f…` | the recording with Bridget; reviewed in `REVIEW-2026-10-31-topography-transcript.md` |
| `/g/dist-fam/bridget/2026-10-31-5c4ae672/READ-FIRST.md` | `a5680c3d62ea42f6` | what Bridget received today (C4 at `5c4ae672`) |
| `/f/claude/AS4CE/AS4CE0001/advice/LENS-2026-10-08-topo-pony/` | (listed) | the earlier lens on TopoForge's story |
| skills `medley-review`, `lens`, `writing-forms`, `topoforge-story`, `taxonomy-link` (vibrobeast) | (plugin copies) | Bob Proulx's house idiom; the four-view LENS; the form register; the story rules; words through the taxonomy |
| `https://www.cpan.org/src/` | (listing) | latest stable perl: 5.44.0 (`3b855066b92491cb…`); 5.45.x is the development series |
| `https://fastapi.metacpan.org/v1/release/<dist>` | (per dist) | authors and dates of the CPAN modules we vendor (`vendor/VENDOR.org`) |
| Corwin's memory notes for this project (egad, inputloop, cards, design direction, build rules) | n/a | the egad distribution idea; "undersell us, sell the opportunity"; tiered offerings |

## Brought forward on 2026-11-01

Corwin, 2026-11-01 18:31: work on TopoForge now moves forward here, on this branch; the TopoForge
repository stays as Bryant's last pass, for others to rebuild from, and may be archived. So its
companion files were copied into `topoforge/` from its commit `e5b646c` (`git archive`), byte for
byte, except:

- `index.html` is not copied: the app stays where it was, `www/topoforge/index.html`, unchanged and
  the same bytes (`c6c0fbc0e2ba99fd`). `topoforge/tests/run.sh` and `regen.sh` read it from there
  (`TF_HTML` overrides); those two lines are the only edits.
  From 2026-11-01 (20:20 and 20:35) the app itself moves forward here too: 1.8 changes it in
  place, `topoforge/patches/topoforge-1.7-to-1.8.patch` says how, and `topoforge/tests/run.sh`
  checks that Bryant's 1.5 plus every patch is the app, byte for byte.
- Left out: `FOR-BRYANT.md` (a letter to Bryant, his to keep), `.github/`, `SHA256SUMS` (it sums
  the app at the old place; `topoforge/kit/project-files/check.py` remakes sums in a scratch tree),
  and Bryant's example drawing `examples/how-gitcha-works.json` with its story (held for Corwin's
  word; corwin.cloud already stages it from gitcha, checked by sha256).

`sh bin/test.sh` now runs both TopoForge kits against `www/topoforge/index.html`.

## Inputs we did not have

- Bryant's own version of topology, and his notes from the last few days' talk. The repository was
  empty when this branch was cut (`git clone` of `inputloop/topology`, 2026-10-31).
- The hours of discussion among Bryant, Bridget, Corwin and others, except the 2 min 44 s recording.
- A shell on gw26. Our session reached it over HTTPS only (`curl -I https://gw26.bru.st` answered 200
  from nginx); the deploy steps are written as a run card for a hand with SSH (`runcards/`).
- Bridget's half-filled card and the lens she began (named in the recording at 00:01:18 to 00:01:26).

## Repeating this

`FOR-OTHERS.md` says how to start your own branch from the same request.
