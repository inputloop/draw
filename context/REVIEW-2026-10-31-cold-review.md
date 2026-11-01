# REVIEW 2026-10-31: a cold review of this branch, and what was done about each finding

A second agent, given the code and the spec but not my conclusions, reviewed the branch before it
was landed. It changed nothing; it ran its experiments in a scratch folder. Its findings, in its
order, with what was done. "Fixed" means a test now plants the case and passes.

| # | finding (reviewer's words, shortened) | done |
|---|---|---|
| S1 | a `.topology.md` that is a symbolic link to a token was read, and the token served as notes | fixed: links are not followed, in Build and in read_dir; `t/30-graph.t` plants one |
| S2 | a heading inside a fenced code block ended the private part (`# reset it` then `passwd ...` went public), in both languages | fixed in both; fixture `fenced` |
| S3 | a nested `### Private` reset where the private part ends | fixed in both; fixture `nested` |
| S4 | cells were never cleared on rebuild, so a secret moved under `## Private` stayed public in `notes` | fixed: `topology build` makes a fresh graph and swaps it in; checked by hand on the lab fixture |
| S5 | `api.private` failed open for any word but exactly `never` | fixed: any other word than never or auto is refused; tested |
| S6 | show-private is the asker's preference, so any client could ask `global=always` | fixed by default: `api.private` now defaults to `never`; `auto` is the operator's choice, with the reason in topology.conf |
| S7 | a `branch` value could be a git option (`--upload-pack=...`) | fixed: branch names are checked; tested |
| S8 | a `'` in a key path could break GIT_SSH_COMMAND; a token inside a url was accepted | fixed: both refused, the token not repeated; tested |
| S9 | absolute server paths in `source` and `declared_private` | fixed: sources are named as `repo:path`; `declared_private` is not sent |
| P1 | `## Private ##`, indented `## Private`, setext `Private` read as public | first two fixed in both (fixture `odd-headings`); setext is now said in the spec not to be a heading |
| P2 | an empty file: Perl `[]`, JS `[""]` | fixed in JS; fixture `empty` |
| P3 | JS accepted `constructor`, `__proto__` as setting words | fixed (`Object.hasOwn`); fixture errors |
| P4 | a non-ASCII front-matter key kept by Perl, dropped by JS | fixed in JS (`\p{L}`); fixture `unicode-key` |
| P5 | unclosed front matter swallowed the file | fixed in both, and the spec now says so; fixture `unclosed` |
| B1 | the depth limit read one folder down, not two | fixed; `t/30-graph.t` reads `two/down/TOPOLOGY.md` |
| B2 | ids re-read as names on each rebuild (`thing:thing:gw9`) | gone with S4's fresh build |
| B3 | row names beyond Latin-1 broke the encoding | fixed (UTF-8 bytes); tested with `日本` |
| B4 | names matched case-blind, the last one wins, when two things share a name | **not fixed**: open; the fix needs a rule for which wins, which is a design choice |
| R1 | debian/rules printed "node not found" and passed when the JS tests failed | fixed in RECIPE.org |
| A1 | unreadable or newer settings could be overwritten by the first change | fixed: the page will not save over them |
| A2 | an unknown stored notation stopped the settings panel | fixed: falls back to topology and says so |

Nothing the reviewer found in the XSS or path-traversal checks; it said so and how it looked.
