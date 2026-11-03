#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
#
# run.sh -- build topology paint's core and its example mods with the C
# compiler at hand (no SDL, no network) and check every promise in
# tests/test_core.c; then let Python's zipfile, an independent reader,
# test an OpenRaster file the core wrote.
# usage: sh paint/tests/run.sh [--prove-red]
#   --prove-red  build with planted faults (TP_PLANT_FAULT); the tests must fail
# exit: 0 green (or, with --prove-red, the plants were caught), 1 red, 2 no compiler
set -u
here=$(cd "$(dirname "$0")/.." && pwd)
cc=${CC:-cc}
command -v "$cc" >/dev/null 2>&1 || { echo "paint: no C compiler ($cc)"; exit 2; }
d=$(mktemp -d) || exit 2
trap 'rm -rf "$d"' EXIT
case $(uname -s) in Darwin) so=dylib ;; *) so=so ;; esac
plant=
[ "${1-}" = --prove-red ] && plant=-DTP_PLANT_FAULT
flags="-std=c11 -O1 -Wall -Wno-misleading-indentation -Wno-format-truncation -I$here/include -I$here/src/core"
libs="-lm"
[ "$so" = so ] && libs="$libs -ldl"
mkdir -p "$d/mods" "$d/out"
# shellcheck disable=SC2086
$cc $flags $plant -o "$d/test_core" "$here/tests/test_core.c" "$here"/src/core/*.c $libs 2>"$d/cc.log" ||
  { cat "$d/cc.log"; echo "paint: the core did not build"; exit 1; }
for m in posterize:posterize pgm-export:pgm_export star-tip:star_tip; do
  dir=${m%%:*} src=${m#*:}
  # shellcheck disable=SC2086
  $cc $flags -shared -fPIC -o "$d/mods/$dir.$so" "$here/mods/$dir/$src.c" -lm 2>>"$d/cc.log" ||
    { cat "$d/cc.log"; echo "paint: mod $dir did not build"; exit 1; }
done
out=$("$d/test_core" "$d/out" "$d/mods" 2>&1); rc=$?
if [ -n "$plant" ]; then
  if [ $rc -ne 0 ]; then echo "$out" | grep "^not ok" | sed 's/^/  caught: /'; echo "prove-red: the planted faults are caught"; exit 0; fi
  echo "prove-red: the planted faults were NOT caught"; exit 1
fi
[ $rc -eq 0 ] || { echo "$out"; echo "paint: RED"; exit 1; }
echo "$out" | tail -1
if command -v python3 >/dev/null 2>&1; then
  PYTHONDONTWRITEBYTECODE=1 python3 -I - "$d/out/t.ora" <<'PY' || exit 1
import sys, zipfile
z = zipfile.ZipFile(sys.argv[1])
bad = z.testzip()
names = z.namelist()
assert bad is None, "bad member %s" % bad
assert names[0] == "mimetype" and z.read("mimetype") == b"image/openraster", "mimetype must come first, stored"
assert z.getinfo("mimetype").compress_type == 0
for need in ("stack.xml", "mergedimage.png", "Thumbnails/thumbnail.png"):
    assert need in names, need
print("paint: zipfile reads our OpenRaster (%d members, CRCs good)" % len(names))
PY
else echo "paint: python3 not found, the independent zip check was skipped"; fi
echo "paint: GREEN"
