#!/bin/sh
# regen.sh - re-export the fixtures through TopoForge's own code (needs node), then run the harness checks.
# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
# Copyright 2026 Bryant Frankford <nathanielfrankford@gmail.com> and Corwin Brust <corwin@bru.st> and Contributors
# Written by Mentat (for Corwin; claude-opus-5-5).
#
# The jq kit (run.sh) does not need this; run it after changing index.html or a fixture source.
#   sh tests/regen.sh            re-export fixtures/*.json + *.md from fixtures/src/*.json
#   NODE_PATH=/path/to/node_modules sh tests/regen.sh   also runs the draw.io/Visio round trip (needs jsdom)
here=$(cd "$(dirname "$0")" && pwd) || exit 2
command -v node >/dev/null 2>&1 || { echo "KIT BROKEN: node not found (regen only; run.sh needs no node)"; exit 2; }
h="$here/harness/tf-node.js"; idx="${TF_HTML:-$here/../../www/topoforge/index.html}"; rc=0
for src in "$here"/fixtures/src/*.json; do
  f=$(basename "$src" .json); [ "$f" = office-later ] && continue   # exported below, with a change list
  node "$h" export "$idx" "$src" "$here/fixtures/$f.json" "$here/fixtures/$f.md" || rc=2
done
node "$h" prev "$idx" "$here/fixtures/src/office.json" "$here/fixtures/src/office-later.json" "$here/fixtures/office-later.json" "$here/fixtures/office-later.md" || rc=2
node "$h" sha "$idx" || rc=1
for src in "$here"/fixtures/src/*.json; do
  echo "== round trip $(basename "$src")"
  node "$h" roundtrip "$idx" "$src"; r=$?
  [ $r = 3 ] && { echo "(round trip skipped: no jsdom)"; break; }
  [ $r = 0 ] || rc=1
done
exit $rc
