#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
# Copyright 2026 Bryant Frankford <nathanielfrankford@gmail.com> and
# Corwin Brust <corwin@bru.st> and Contributors
# Tangled from RECIPE.org; edit it there.
#
# sums.sh -- write SHA256SUMS for TopoForge's files.
# usage: sh bin/sums.sh [-o OUT] [FILE...]   sum FILEs (default: the ship list) into OUT
#        sh bin/sums.sh --check [SUMSFILE]   check them (default SHA256SUMS)
# exit:  0 written / all match, 1 a file is missing or differs, 2 usage or tool error
set -u
cd "$(dirname "$0")/.." || exit 2
command -v sha256sum >/dev/null 2>&1 || { echo "sums.sh: sha256sum not found" >&2; exit 2; }
LC_ALL=C; export LC_ALL
out=SHA256SUMS
case ${1-} in
  --check)
    f=${2:-SHA256SUMS}
    [ -f "$f" ] || { echo "sums.sh: no such file: $f" >&2; exit 2; }
    if sha256sum -c "$f"; then exit 0; else exit 1; fi ;;
  -o)
    [ $# -ge 2 ] || { echo "sums.sh: -o needs a file name" >&2; exit 2; }
    out=$2; shift 2 ;;
  -h|--help)
    sed -n '7,10p' "$0"; exit 0 ;;
  -*)
    echo "sums.sh: unknown option: $1" >&2; exit 2 ;;
esac
if [ $# -eq 0 ]; then
  set -- index.html upstream/topoforge-1.5.html \
    README.org FOR-BRYANT.md AUTHORS COPYING COPYING.LESSER NEWS ChangeLog INSTALL \
    RECIPE.org REUSE.toml LICENSES/*.txt bin/*.sh kit/project-files/* \
    $(find tests spec patches -type f ! -path '*/node_modules/*' ! -path '*/out-*' | sort)
fi
missing=0
for f do
  [ "$f" = "$out" ] && continue
  [ -f "$f" ] || { echo "sums.sh: missing: $f" >&2; missing=1; }
done
[ $missing -eq 0 ] || exit 1
sums=$(for f do [ "$f" = "$out" ] || printf '%s\n' "$f"; done | sort -u |
  while IFS= read -r f; do sha256sum -- "$f" || exit 2; done) || exit 2
[ -n "$sums" ] || { echo "sums.sh: nothing to sum" >&2; exit 2; }
printf '%s\n' "$sums" > "$out" || exit 2
echo "sums.sh: wrote $out ($(printf '%s\n' "$sums" | wc -l | tr -d ' ') files)"
