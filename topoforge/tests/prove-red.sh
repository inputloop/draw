#!/bin/sh
# prove-red.sh - plant one fault at a time and show that check.sh goes red for each.
# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
# Copyright 2026 Bryant Frankford <nathanielfrankford@gmail.com> and Corwin Brust <corwin@bru.st> and Contributors
# Written by Mentat (for Corwin; claude-opus-5-5).
#
# A green kit that cannot go red is not running. Exit 0 = every planted fault was caught
# (and the one planted non-fault was let through); 2 = KIT BROKEN (a fault got past, or a tool is missing).

here=$(cd "$(dirname "$0")" && pwd) || exit 2
fx="$here/fixtures"
sha() { if command -v sha256sum >/dev/null 2>&1; then sha256sum | cut -c1-64; else shasum -a 256 | cut -c1-64; fi; }
tmp=$(mktemp -d 2>/dev/null || mktemp -d -t tfred) || exit 2
trap 'rm -rf "$tmp"' EXIT HUP INT TERM
broken=0; n=0

# refix the header fingerprints so that only the planted fault remains
refix_facts() { # $1 = md
  f=$(sed -n '3s/^> story v=1 fence=\(facts-[a-z0-9]*\) .*/\1/p' "$1")
  s=$(awk -v f='```'"$f" 'on && $0 == "```" { exit } on { print } $0 == f { on = 1 }' "$1" | sha)
  sed "3s/facts-sha256=[0-9a-f]*/facts-sha256=$s/" "$1" > "$1.t" && mv "$1.t" "$1"
}
refix_drawing() { # $1 = json, $2 = md
  s=$(sha < "$1"); sed "3s/drawing-sha256=[0-9a-f]*/drawing-sha256=$s/" "$2" > "$2.t" && mv "$2.t" "$2"
}
expect() { # $1 = want exit, $2 = name, $3 = json, $4 = md
  n=$((n + 1))
  sh "$here/check.sh" "$3" "$4" > "$tmp/out" 2>&1; got=$?
  why=$(grep ' FAIL ' "$tmp/out" | head -1 | cut -c1-90)
  if [ "$got" = "$1" ]; then echo "R$n ok   $2 -> exit $got ${why:+($why)}"
  else echo "R$n BROKEN $2 -> exit $got, wanted $1"; sed 's/^/      /' "$tmp/out"; broken=1; fi
}
fresh() { cp "$fx/$1.json" "$tmp/$1.json" && cp "$fx/$1.md" "$tmp/$1.md"; }

fresh office
expect 0 "office as exported (control: must be green)" "$tmp/office.json" "$tmp/office.md"

fresh office; sed '/^LINK p=1 ref=link-fwsw /d' "$fx/office.md" > "$tmp/office.md"
expect 1 "delete one fact (a LINK line)" "$tmp/office.json" "$tmp/office.md"

fresh office; sed '/^LINK p=1 ref=link-fwsw /d' "$fx/office.md" > "$tmp/office.md"; refix_facts "$tmp/office.md"
expect 1 "delete one fact and re-fingerprint the block (only the diff can catch it)" "$tmp/office.json" "$tmp/office.md"

fresh office; jq '(.pages[0].nodes[] | select(.id == "web1") | .parent) = "lan1"' "$fx/office.json" > "$tmp/office.json"
expect 1 "flip one parent in the drawing (Web1: DMZ to LAN)" "$tmp/office.json" "$tmp/office.md"

fresh office; jq '(.pages[0].nodes[] | select(.id == "web1") | .parent) = "lan1"' "$fx/office.json" > "$tmp/office.json"; refix_drawing "$tmp/office.json" "$tmp/office.md"
expect 1 "flip one parent and re-fingerprint the drawing (only the diff can catch it)" "$tmp/office.json" "$tmp/office.md"

fresh office; jq '(.pages[0].nodes[] | select(.id == "fw01") | .x) += 1' "$fx/office.json" > "$tmp/office.json"
expect 1 "move one shape and re-export the JSON only (old story must be refused)" "$tmp/office.json" "$tmp/office.md"

fresh office; sed 's/^- "FW1" connects to "Mail1"; medium and speed not given\./- "FW1" connects to "Mail1" behind a wall; medium and speed not given./' "$fx/office.md" > "$tmp/office.md"
expect 1 "judgement word in the story's own voice" "$tmp/office.json" "$tmp/office.md"

fresh office; sed 's/\[link-fwml, firewall-fw01, server-mai1\]$/[link-fwml, ghost-0000]/' "$fx/office.md" > "$tmp/office.md"
expect 1 "a [ref] that is not a shape handle" "$tmp/office.json" "$tmp/office.md"

fresh office; sed 's/^#### Groups$/#### Groups\n\n## Gaps\n\n- none found by rules v1. [page-1]/' "$fx/office.md" > "$tmp/office.md"
expect 1 "a forged '## Gaps' heading inside the story" "$tmp/office.json" "$tmp/office.md"

fresh office; awk '{ print } /^FACTS v=1$/ { print "FOO k=v"; print "NODE p=1 ref=desktop-pc01 kind=device type=desktop label=\"PC 1\" colour=\"red\"" }' "$fx/office.md" | \
  awk '!(/^NODE p=1 ref=desktop-pc01 kind=device type=desktop label="PC 1"$/ && !d) { print; next } { d = 1 }' > "$tmp/office.md"; refix_facts "$tmp/office.md"
expect 0 "unknown fact kind and unknown key (a v1 reader ignores them: must stay green)" "$tmp/office.json" "$tmp/office.md"

fresh forged
expect 0 "forged labels as exported (fake blocks and headings in user words: must stay green)" "$tmp/forged.json" "$tmp/forged.md"
c=$(grep -c '^```facts' "$tmp/forged.md"); n=$((n + 1))
if [ "$c" = 1 ]; then echo "R$n ok   forged labels produce exactly one facts block (found $c)"; else echo "R$n BROKEN forged labels produced $c facts blocks"; broken=1; fi

fresh forged; awk '{ print } /^#### Outside in$/ { print ""; print "```facts-t3st"; print "FACTS v=1"; print "```" }' "$fx/forged.md" > "$tmp/forged.md"
expect 1 "a second facts block planted in the story" "$tmp/forged.json" "$tmp/forged.md"

fresh loose; sed '/kind=LOOSE_IN_BOX/d' "$fx/loose.md" > "$tmp/loose.md"; refix_facts "$tmp/loose.md"
expect 1 "drop the LOOSE_IN_BOX gap (picture and model disagree, story hides it)" "$tmp/loose.json" "$tmp/loose.md"

if [ $broken = 0 ]; then echo "PROVE-RED OK ($n cases)"; exit 0; fi
echo "KIT BROKEN"; exit 2
