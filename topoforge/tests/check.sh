#!/bin/sh
# check.sh - does a TopoForge story (.md) tell the truth about its drawing (.json)?
# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
# Copyright 2026 Bryant Frankford <nathanielfrankford@gmail.com> and Corwin Brust <corwin@bru.st> and Contributors
# Written by Mentat (for Corwin; claude-opus-5-5). Spec: ../spec/FACTS-v1.md
#
#   sh check.sh DRAWING.json STORY.md     rebuild the facts with jq and compare
#   sh check.sh --tables INDEX.html       are the copied tables in tables.json still right?
#
# Exit 0 = green (agree), 1 = red (disagree), 2 = kit broken (missing tool, bad arguments).
# Needs: POSIX sh, jq, awk, sed, grep, sort, diff, and sha256sum or shasum. No JavaScript.

here=$(cd "$(dirname "$0")" && pwd) || exit 2
command -v jq >/dev/null 2>&1 || { echo "KIT BROKEN: jq not found"; exit 2; }
sha() { if command -v sha256sum >/dev/null 2>&1; then sha256sum | cut -c1-64; else shasum -a 256 | cut -c1-64; fi; }
tmp=$(mktemp -d 2>/dev/null || mktemp -d -t tfcheck) || { echo "KIT BROKEN: mktemp"; exit 2; }
trap 'rm -rf "$tmp"' EXIT HUP INT TERM
red=0
pass() { echo "$1 PASS $2"; }
fail() { echo "$1 FAIL $2"; red=1; }

if [ "${1:-}" = "--tables" ]; then
  html=${2:-}; [ -r "$html" ] || { echo "KIT BROKEN: cannot read index.html '$html'"; exit 2; }
  # shapes, straight from the defShape(...) lines
  grep "^defShape('" "$html" | sed "s/^defShape('\([a-z0-9]*\)', '\([^']*\)', '[a-z]*', '\([a-z]*\)'\(.*\)$/\1	\3	\2	\4/" |
    awk -F '	' '{ t = 5; if (match($4, /tier: [0-9]+/)) t = substr($4, RSTART + 6, RLENGTH - 6); print $1 "\t" $2 "\t" t "\t" $3 }' > "$tmp/shapes.txt"
  grep -c . "$tmp/shapes.txt" | grep -q '^[1-9]' || { echo "KIT BROKEN: no defShape lines found"; exit 2; }
  # SHAPES.custom is defined by hand, not by defShape
  grep -q "^SHAPES.custom = { key: 'custom', name: 'Imported Shape', cat: 'basic', kind: 'basic'.* tier: 5," "$html" &&
    printf 'custom\tbasic\t5\tImported Shape\n' >> "$tmp/shapes.txt"
  sed -n "s/^const DEFAULT_BASE = { \(.*\) };$/\1/p" "$html" | tr ',' '\n' |
    sed -n "s/^ *\([a-z0-9]*\): '\([^']*\)' *$/\1	\2/p" > "$tmp/base.txt"
  awk -F '	' 'NR == FNR { b[$1] = $2; next } { print $1 "\t" $2 "\t" $3 "\t" $4 "\t" (($1 in b) ? b[$1] : $4) }' "$tmp/base.txt" "$tmp/shapes.txt" | LC_ALL=C sort > "$tmp/from-html.txt"
  jq -r '.shapes | to_entries[] | [.key, .value.kind, (.value.tier | tostring), .value.name, .value.base] | join("\t")' "$here/tables.json" | LC_ALL=C sort > "$tmp/from-json.txt"
  if diff "$tmp/from-html.txt" "$tmp/from-json.txt" > "$tmp/d"; then pass T1 "shape table: $(wc -l < "$tmp/from-json.txt" | tr -d ' ') types match index.html"; else fail T1 "shape table differs from index.html:"; cat "$tmp/d"; fi
  for v in NET_PROPS:net_props LINK_PROPS:link_props; do
    js=${v%%:*}; jn=${v#*:}
    a=$(sed -n "s/^const $js = \[\(.*\)\];$/\1/p" "$html" | tr -d " '" )
    b=$(jq -r ".$jn | join(\",\")" "$here/tables.json")
    if [ -n "$a" ] && [ "$a" = "$b" ]; then pass T2 "$js matches ($a)"; else fail T2 "$js: index.html has '$a', tables.json has '$b'"; fi
  done
  [ $red = 0 ] && { echo "TABLES MATCH"; exit 0; }; echo "TABLES DIFFER"; exit 1
fi

json=${1:-}; md=${2:-}
[ -r "$json" ] && [ -r "$md" ] || { echo "usage: sh check.sh DRAWING.json STORY.md | --tables INDEX.html"; exit 2; }
jq -e . "$json" >/dev/null 2>&1 || { echo "K0 FAIL drawing is not JSON"; echo DISAGREE; exit 1; }

# K1 the header line (always line 3) names the fence word and both fingerprints
hdr=$(sed -n '3p' "$md")
fence=$(printf '%s\n' "$hdr" | sed -n 's/^> story v=1 fence=\(facts-[a-z0-9][a-z0-9][a-z0-9][a-z0-9]\) drawing-sha256=[0-9a-f]\{64\} facts-sha256=[0-9a-f]\{64\}$/\1/p')
if [ -z "$fence" ]; then fail K1 "line 3 is not a story v=1 header"; echo DISAGREE; exit 1; fi
dsha=$(printf '%s\n' "$hdr" | sed 's/.* drawing-sha256=\([0-9a-f]*\) .*/\1/')
fsha=$(printf '%s\n' "$hdr" | sed 's/.* facts-sha256=\([0-9a-f]*\)$/\1/')
pass K1 "header: fence $fence"

# K2 exactly one facts block, opened with this export's own fence word; exactly two fence lines in the file
nf=$(grep -c '^```facts' "$md"); nt=$(grep -c '^```' "$md")
if [ "$nf" = 1 ] && [ "$nt" = 2 ] && grep -qx '```'"$fence" "$md"; then pass K2 "one facts block"; else fail K2 "facts block lines: $nf, fence lines: $nt (want 1 and 2)"; fi
awk -v f='```'"$fence" 'on && $0 == "```" { exit } on { print } $0 == f { on = 1 }' "$md" > "$tmp/block"

# K3 the drawing is the one this story was made from
got=$(sha < "$json")
if [ "$got" = "$dsha" ]; then pass K3 "drawing sha256 matches"; else fail K3 "drawing sha256 is $got, story says $dsha (story is for another drawing, or the drawing changed)"; fi

# K4 the facts block is the one the header fingerprinted
got=$(sha < "$tmp/block")
if [ "$got" = "$fsha" ]; then pass K4 "facts block sha256 matches"; else fail K4 "facts block sha256 is $got, header says $fsha"; fi

# K5 the block starts with the grammar line and every line parses
if [ "$(sed -n 1p "$tmp/block")" = "FACTS v=1" ]; then pass K5 "grammar FACTS v=1"; else fail K5 "first fact line is not 'FACTS v=1'"; fi
jq -R -r --arg mode bad -f "$here/canon.jq" < "$tmp/block" > "$tmp/bad"
if [ -s "$tmp/bad" ]; then fail K5 "lines that break the grammar:"; sed 's/^/    /' "$tmp/bad"; fi

# K6 rebuild the facts from the drawing with jq and compare (the v1 reading rule: unknown kinds and keys are ignored)
jq -r --slurpfile TB "$here/tables.json" -f "$here/facts.jq" "$json" > "$tmp/ref.raw" || { echo "KIT BROKEN: facts.jq failed"; exit 2; }
jq -R -r -f "$here/canon.jq" < "$tmp/ref.raw" | LC_ALL=C sort > "$tmp/ref.facts"
jq -R -r -f "$here/canon.jq" < "$tmp/block" | LC_ALL=C sort > "$tmp/js.facts"
n=$(wc -l < "$tmp/ref.facts" | tr -d ' ')
if [ "$n" -gt 2 ] && diff "$tmp/ref.facts" "$tmp/js.facts" > "$tmp/d"; then pass K6 "facts agree ($n lines)"
else fail K6 "facts differ (< rebuilt by jq, > in the story):"; sed 's/^/    /' "$tmp/d"; fi

# The sentences: everything from '## Story' up to '## Reference table'
awk '/^## Story$/ { on = 1; next } /^## Reference table$/ { on = 0 } on' "$md" > "$tmp/prose"

# K7 every sentence ends with [refs], and every ref is a shape handle in the facts (or page-N)
jq -R -r --arg mode refs -f "$here/canon.jq" < "$tmp/ref.raw" | LC_ALL=C sort -u > "$tmp/known"
sed -n 's/^PAGE p=\([0-9]*\) .*/page-\1/p' "$tmp/ref.raw" >> "$tmp/known"
grep -v '^#' "$tmp/prose" | grep -v '^$' > "$tmp/sent"
bad=$(grep -v -c '^- .* \[[a-z0-9._-][a-z0-9._, -]*\]$' "$tmp/sent")
sed -n 's/^- .* \[\([a-z0-9._, -]*\)\]$/\1/p' "$tmp/sent" | tr ',' '\n' | sed 's/^ *//' | grep -v '^$' | LC_ALL=C sort -u > "$tmp/used"
unknown=$(LC_ALL=C sort -u "$tmp/known" | comm -23 "$tmp/used" - | tr '\n' ' ')
if [ "$bad" = 0 ] && [ -z "$unknown" ]; then pass K7 "$(wc -l < "$tmp/sent" | tr -d ' ') sentences, every [ref] is known"
else fail K7 "sentences without a [ref] ending: $bad; unknown refs: ${unknown:-none}"; fi

# K8 no judgement words in TopoForge's own voice (author's quoted words are left out first)
sed -E 's/"([^"\\]|\\.)*"//g' "$tmp/sent" | grep -n -i -E '(^|[^A-Za-z])(secure|redundant|protected|behind|trusted|safe)([^A-Za-z]|$)' > "$tmp/judged"
if [ -s "$tmp/judged" ]; then fail K8 "judgement words in the story's own voice:"; sed 's/^/    /' "$tmp/judged"; else pass K8 "no judgement words"; fi

# K9 headings are only the ones the generator writes (a label cannot add one)
awk -v f='```'"$fence" 'on && $0 == "```" { on = 0; next } on { next } $0 == f { on = 1; next } /^#/ { print NR ": " $0 }' "$md" |
  grep -v -E '^1: # .* — what this drawing shows$' |
  grep -v -E '^[0-9]+: ## (Facts|Story|Gaps|Reference table|Changes since last export)$' |
  grep -v -E '^[0-9]+: ### Page [0-9]+ ".*"$' |
  grep -v -E '^[0-9]+: #### (Outside in|Groups|Other shapes|Connections|Custom fields)$' > "$tmp/heads"
if [ -s "$tmp/heads" ]; then fail K9 "headings the generator does not write:"; sed 's/^/    /' "$tmp/heads"; fi
# ...and the top-level sections come once each, in the generator's order
order=$(awk -v f='```'"$fence" 'on && $0 == "```" { on = 0; next } on { next } $0 == f { on = 1; next } /^## / { printf "%s|", substr($0, 4) }' "$md")
case "$order" in
  "Facts|Story|Gaps|Reference table|" | "Facts|Story|Gaps|Reference table|Changes since last export|") [ -s "$tmp/heads" ] || pass K9 "headings as generated, sections in order" ;;
  *) fail K9 "sections out of order or repeated: $order" ;;
esac

if [ $red = 0 ]; then echo "AGREE $n facts"; exit 0; fi
echo DISAGREE; exit 1
