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
# 1.8: the patches from Bryant's 1.5 rebuild the app byte for byte (the index.html part of each patch)
chain() { # $1 = the app to compare
  cp "$here/../upstream/topoforge-1.5.html" "$tmp/c0.html" || return 2; n=0
  for p in $(ls "$here"/../patches/topoforge-*.patch | sort -V); do   # 1.10: by version, so 1.10 comes after 1.9 (a glob puts it before 1.5)
    awk '/^--- topoforge-/ { on = ($2 ~ /\/index\.html$/) } on' "$p" > "$tmp/c.patch"
    patch -s -o "$tmp/c$((n + 1)).html" "$tmp/c$n.html" "$tmp/c.patch" >/dev/null 2>&1 || { echo "$(basename "$p") does not apply"; return 1; }
    n=$((n + 1))
  done
  cmp -s "$tmp/c$n.html" "$1" || { echo "1.5 plus $n patches is not $1"; return 1; }
  echo "1.5 plus $n patches is index.html, byte for byte"
}
if command -v patch >/dev/null 2>&1; then
  step "patches: Bryant's 1.5 plus every patch is the app, byte for byte" chain "$html"
  chain_red() { sed 's/^const TF_VERSION = /const  TF_VERSION = /' "$html" > "$tmp/x.html"; cmp -s "$tmp/x.html" "$html" && { echo "could not plant"; return 2; }
    chain "$tmp/x.html" >/dev/null && { echo "the chain stayed green on a changed app"; return 2; }; return 0; }
  step "prove-red: one changed line in the app breaks the chain" chain_red
else echo "BROKEN patch(1) not found: the patch chain was not checked"; broken=1; fi
# 1.8: the selection hook and the ready event post to this page's own origin only, never to '*'
origin_only() { # $1 = the app
  all=$(grep -c 'postMessage(' "$1"); good=$(grep -c 'postMessage({ type, detail }, location\.origin)' "$1")
  [ "$all" -ge 1 ] && [ "$all" = "$good" ] || { echo "$all postMessage call(s), $good of them to location.origin"; return 1; }
}
step "every postMessage in the app names location.origin" origin_only "$html"
origin_red() { sed "s/postMessage({ type, detail }, location\.origin)/postMessage({ type, detail }, '*')/" "$html" > "$tmp/o.html"
  cmp -s "$tmp/o.html" "$html" && { echo "could not plant"; return 2; }; origin_only "$tmp/o.html" >/dev/null && { echo "stayed green with '*'"; return 2; }; return 0; }
step "prove-red: a postMessage to '*' is caught" origin_red
# 1.8: the name is "topology forge (formerly TopoForge)" (Corwin, 2026-11-01 20:51: "topology is the correct
# name"); the misspelling "topography" is in none of the files 1.8 touched
spelled() { bad=$(grep -l -i 'topography' "$@" 2>/dev/null); [ -z "$bad" ] || { echo "\"topography\" in: $bad"; return 1; }; }
named="$html $here/../README.org $here/../NEWS $here/../ChangeLog $here/../AUTHORS $here/../RECIPE.org $here/../spec/EMBED-v1.md $here/browser/embed.browser.mjs $here/browser/embed-prove-red.sh $here/../../README.org $here/../../NEWS $here/../../ChangeLog"
step "the name is spelled topology in the app and its documents" spelled $named
# 1.8: topology's RECIPE.org names the app it serves by sha256 (its ingredients table)
recipe_sum() { # $1 = the app
  r=$here/../../RECIPE.org; [ -f "$r" ] || { echo "no topology RECIPE.org beside topoforge/"; return 2; }
  want=$(sed -n 's/^| topology forge .*=www\/topoforge\/index.html=.*sha256 =\([0-9a-f]\{64\}\)= |$/\1/p' "$r")
  got=$(sha256sum "$1" | cut -d' ' -f1)
  [ -n "$want" ] && [ "$want" = "$got" ] || { echo "RECIPE.org says ${want:-nothing}, the app is $got"; return 1; }
}
if [ -f "$here/../../RECIPE.org" ]; then
  step "topology's RECIPE.org names the app's sha256" recipe_sum "$html"
  recipe_red() { printf ' ' >> "$tmp/r.html"; cat "$html" >> "$tmp/r.html"; recipe_sum "$tmp/r.html" >/dev/null && { echo "stayed green"; return 2; }; return 0; }
  step "prove-red: a changed app no longer matches RECIPE.org" recipe_red
fi
spelled_red() { sed 's/topology forge (formerly/topography forge (formerly/' "$html" > "$tmp/s.html"; cmp -s "$tmp/s.html" "$html" && { echo "could not plant"; return 2; }
  spelled "$tmp/s.html" >/dev/null && { echo "stayed green"; return 2; }; return 0; }
step "prove-red: \"topography\" planted in the app is caught" spelled_red
if [ $broken = 1 ]; then echo "KIT BROKEN"; exit 2; fi
if [ $red = 1 ]; then echo "KIT RED"; exit 1; fi
echo "KIT GREEN"; exit 0
