<!--
SPDX-FileCopyrightText: 2026 Bryant Frankford <nathanielfrankford@gmail.com> and Corwin Brust <corwin@bru.st> and Contributors
SPDX-License-Identifier: CC-BY-SA-4.0
-->
# To any agent working in this repository

Read README.org first, then RECIPE.org (it makes `bin/`, `debian/` and `etc/`; edit the recipe, run
`sh bin/tangle.sh`, never edit a tangled file alone), then `spec/TOPOLOGY-md.md`.

## Who commits, and how the agent's part is said

As in every inputloop repository (the full rule: ils4's AGENTS.md, section 1): commits are authored by
the person the work is for, `Corwin Brust <corwin@bru.st>`, unsigned (signing is his act, by hand).
The agent's part is a byline, the last line of the message: `Mentat (for Corwin, <model>)`, with the
serving model as the session reports it. No vendor trailers (`Co-Authored-By`, `Claude-Session`,
"Generated with"), no session links. A `commit-msg` hook that refuses these is kept with the
shop's other hooks; install it in `.git/hooks/` before the first commit.

## Where work lands

Work on the `corwin` branch only. Make no other branches and open no pull requests. Fix an error
with a new commit on top (fast-forward only); do not rewrite history, and do not force-push.

The first three commits on `corwin` (8487a29, 7792b46, 924d117) were made before this rule and its
hook existed, and carry vendor trailers and a session link. They stay in history, because this
branch only moves forward.

## Before every push

- `sh bin/test.sh` green. It runs the Perl tests, the JavaScript tests (including the example
  fixtures and the accessibility check) and the recipe check.
- A new promise gets a check, and the check gets a planted fault (`--prove-red` where the script
  has one).
- Private parts of a `TOPOLOGY.md` stay under a `## Private` heading and the file says
  `private: hide`; nothing a person marked private appears in a public part.
- Keep `www/topoforge/` unchanged; it is Bryant Frankford's TopoForge.
