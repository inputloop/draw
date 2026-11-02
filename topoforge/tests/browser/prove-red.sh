#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
# Copyright 2026 Bryant Frankford <nathanielfrankford@gmail.com> and
# Corwin Brust <corwin@bru.st> and Contributors
# Written by Mentat (for Corwin; claude-sonnet-5-5), 2026-10-27.
#
# prove-red.sh -- show that the ?load= checks of the browser kit can go red.
# It plants a fault in a COPY of index.html, runs the kit's --load-only checks on the
# copy, and requires that the one check watching that fault fails and no other does.
# A control run on the untouched file comes first: it must be green, or nothing is proved.
#   plant 1: the origin test commented out  -> "load 2" must go red (another origin is let in)
#   plant 2: the sample guard removed       -> "load 1" must go red (a first visit gets the sample AND the rows)
#   plant 3: the file: test removed         -> "load 3" must go red (a relative ?load= from file:// is no longer refused and said)
# usage: sh tests/browser/prove-red.sh /path/to/index.html [outdir]    (default outdir: out-prove-red)
# Needs what the kit needs, except axe-core (Node, Playwright, Chromium; see README.org).
# Nothing is deleted: the copies and notes stay in outdir (git ignores out-*/).
# exit:  0 every plant was caught, 1 a plant was NOT caught, 2 cannot run (no file, no kit, control not green)
set -u
ix=${1-}; out=${2:-out-prove-red}
here=$(cd "$(dirname "$0")" && pwd) || exit 2
kit=$here/topoforge.browser.mjs
[ -f "$ix" ] || { echo "prove-red.sh: usage: sh prove-red.sh /path/to/index.html [outdir]" >&2; exit 2; }
[ -f "$kit" ] || { echo "prove-red.sh: no kit at $kit" >&2; exit 2; }
command -v node >/dev/null 2>&1 || { echo "prove-red.sh: node not found" >&2; exit 2; }
mkdir -p "$out" || exit 2
out=$(cd "$out" && pwd) || exit 2

# run NAME FILE: run the load-only kit on FILE; its notes go to $out/RESULT-NAME.txt; sets rc and, in $fails, the failing check numbers
run() {
  RESULT=$out/RESULT-$1.txt node "$kit" --load-only "$2" "$out/out-$1" > "$out/log-$1.txt" 2>&1; rc=$?
  fails=$(sed -n 's/^FAIL load \([0-9a-z]*\):.*/\1/p' "$out/RESULT-$1.txt" 2>/dev/null | tr '\n' ' ' | sed 's/ $//')
}

run control "$ix"
if [ "$rc" -ne 0 ]; then
  echo "prove-red.sh: the control run on $ix is not green (exit $rc, failing: ${fails:-none}); see $out/log-control.txt. Nothing proved." >&2
  exit 2
fi
echo "control   exit 0, no check failed (index.html as given)"

bad=0
# plant NAME WANT SED-EXPR: apply SED-EXPR to a copy, require it to change the copy, run, and require exactly WANT to fail
plant() {
  name=$1 want=$2 expr=$3
  sed "$expr" "$ix" > "$out/plant-$name.html" || exit 2
  if cmp -s "$ix" "$out/plant-$name.html"; then
    echo "prove-red.sh: plant $name did not change the copy (index.html no longer has the line it plants in); fix the plant" >&2; exit 2
  fi
  run "$name" "$out/plant-$name.html"
  if [ "$rc" -eq 1 ] && [ "$fails" = "$want" ]; then
    echo "caught    plant $name: kit exit 1, failing check: load $fails"
  else
    echo "NOT CAUGHT plant $name: kit exit $rc, failing checks: ${fails:-none}, wanted exactly: load $want (see $out/log-$name.txt)" >&2; bad=1
  fi
}
plant origin-test 2 's#|| u\.origin !== location\.origin#/* & */#'
plant sample-guard 1 "s# && !new URLSearchParams(location\.search)\.get('load')##"
plant file-test 3 "s#location\.protocol === 'file:' || ##"
[ $bad -eq 0 ] && echo "prove-red.sh: every plant was caught" || echo "prove-red.sh: a plant got through; the check is not watching what it says" >&2
exit $bad
