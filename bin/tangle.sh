#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
# Copyright 2026 Bryant Frankford <nathanielfrankford@gmail.com> and
# Corwin Brust <corwin@bru.st> and Contributors
# Tangled from RECIPE.org; edit it there.
#
# tangle.sh -- write each source block that names ":tangle PATH" to PATH.
# usage: sh bin/tangle.sh [-d DIR] [FILE.org]   (defaults: DIR ., RECIPE.org)
# exit:  0 written, 2 usage error, missing file, bad path or a path named twice
set -u
dir=.
if [ "${1-}" = -d ]; then
  [ $# -ge 2 ] || { echo "tangle.sh: -d needs a directory" >&2; exit 2; }
  dir=$2; shift 2
fi
org=${1:-RECIPE.org}
[ -f "$org" ] || { echo "tangle.sh: no such file: $org" >&2; exit 2; }
[ -d "$dir" ] || { echo "tangle.sh: no such directory: $dir" >&2; exit 2; }
awk -v dir="$dir" '
function bad(m) { print "tangle.sh: " FILENAME ":" NR ": " m > "/dev/stderr"; err = 2; exit 2 }
BEGIN { inblk = 0; err = 0 }
{
  low = tolower($0)
  if (!inblk && low ~ /^#\+begin_src[ \t]/) {
    path = ""; sheb = ""
    if (match($0, /:tangle[ \t]+[^ \t]+/)) {
      path = substr($0, RSTART, RLENGTH); sub(/^:tangle[ \t]+/, "", path)
    }
    if (match($0, /:shebang[ \t]+"[^"]*"/)) {
      sheb = substr($0, RSTART, RLENGTH); sub(/^:shebang[ \t]+"/, "", sheb); sub(/"$/, "", sheb)
    }
    inblk = 1
    if (path == "" || path == "no") { out = ""; next }
    if (path ~ /^\// || path ~ /\.\./ || path ~ /["'"'"'\\$`]/) bad("refusing path " path)
    if (path in seen) bad("path named twice: " path)
    seen[path] = 1
    out = dir "/" path
    d = out; sub(/\/[^\/]*$/, "", d)
    if (d != out && system("mkdir -p \"" d "\"") != 0) bad("cannot make " d)
    printf "" > out
    if (sheb != "") print sheb > out
    n++; names[n] = path
    next
  }
  if (inblk && low ~ /^#\+end_src/) { if (out != "") close(out); inblk = 0; out = ""; next }
  if (inblk && out != "") {
    line = $0
    if (line ~ /^,(\*|#\+)/) line = substr(line, 2)
    print line > out
  }
}
END {
  if (err) exit err
  if (inblk) { print "tangle.sh: unclosed source block" > "/dev/stderr"; exit 2 }
  for (i = 1; i <= n; i++) print "tangled " names[i]
}' "$org"
