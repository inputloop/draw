#!/bin/sh
# run.sh - the whole TopoForge story kit: tables, fixtures, hand-written expectations, prove-red.
# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
# Copyright 2026 Bryant Frankford <nathanielfrankford@gmail.com> and Corwin Brust <corwin@bru.st> and Contributors
# Written by Mentat (for Corwin; claude-opus-5-5).
#
#   sh tests/run.sh        exit 0 green, 1 red, 2 kit broken.   Needs jq, not JavaScript.
here=$(cd "$(dirname "$0")" && pwd) || exit 2
html=${TF_HTML:-$here/../../www/topoforge/index.html}   # topology keeps the app in www/topoforge/
command -v jq >/dev/null 2>&1 || { echo "KIT BROKEN: jq not found"; exit 2; }
tmp=$(mktemp -d 2>/dev/null || mktemp -d -t tfrun) || exit 2
trap 'rm -rf "$tmp"' EXIT HUP INT TERM
red=0; broken=0
step() { # $1 = name, rest = command
  name=$1; shift; "$@" > "$tmp/out" 2>&1; rc=$?
  case $rc in 0) echo "GREEN  $name" ;; 1) echo "RED    $name"; sed 's/^/       /' "$tmp/out"; red=1 ;;
              *) echo "BROKEN $name (exit $rc)"; sed 's/^/       /' "$tmp/out"; broken=1 ;; esac
}
step "tables copied from index.html still match" sh "$here/check.sh" --tables "$html"
for f in office office-later loose forged misc; do
  step "fixture $f: story agrees with drawing" sh "$here/check.sh" "$here/fixtures/$f.json" "$here/fixtures/$f.md"
done
# jq itself, against facts written by hand from the spec (not by either program)
expect_lines() { # $1 json, $2 expected file, $3 grep filter
  jq -r --slurpfile TB "$here/tables.json" -f "$here/facts.jq" "$1" | grep -e "$3" | LC_ALL=C sort > "$tmp/got"
  LC_ALL=C sort "$2" > "$tmp/want"
  diff "$tmp/want" "$tmp/got"
}
step "jq rebuild of loose.json equals the hand-written facts" expect_lines "$here/fixtures/loose.json" "$here/expect/loose.facts" "."
step "jq gaps for office.json equal the hand-written gap list" expect_lines "$here/fixtures/office.json" "$here/expect/office.gaps" "^GAP "
step "prove-red: every planted fault is caught" sh "$here/prove-red.sh"
tables_red() { # a wrong copied table must go red
  sed "s/^defShape('firewall', 'Firewall', 'sec', 'device', { tier: 1,/defShape('firewall', 'Firewall', 'sec', 'device', { tier: 2,/" "$html" > "$tmp/index.html"
  cmp -s "$tmp/index.html" "$html" && { echo "could not plant the fault"; return 2; }
  sh "$here/check.sh" --tables "$tmp/index.html"; [ $? = 1 ] && return 0; echo "tables check stayed green on a planted fault"; return 2
}
step "prove-red: a changed shape table is caught" tables_red
if [ $broken = 1 ]; then echo "KIT BROKEN"; exit 2; fi
if [ $red = 1 ]; then echo "KIT RED"; exit 1; fi
echo "KIT GREEN"; exit 0
