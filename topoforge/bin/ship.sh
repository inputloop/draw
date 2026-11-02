#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
# Copyright 2026 Bryant Frankford <nathanielfrankford@gmail.com> and
# Corwin Brust <corwin@bru.st> and Contributors
# Tangled from RECIPE.org; edit it there.
#
# ship.sh -- verify, test, sum, and pack one release into dist/.
# usage: sh bin/ship.sh VERSION      (e.g. 1.6)
# exit:  0 packed, 1 a check was red or the tarball already exists, 2 usage or tool error
set -u
cd "$(dirname "$0")/.." || exit 2
v=${1-}
case $v in ''|*[!0-9.]*) echo "usage: sh bin/ship.sh VERSION (digits and dots)" >&2; exit 2 ;; esac
tgz=dist/topoforge-$v.tar.gz
[ -e "$tgz" ] && { echo "ship.sh: $tgz exists; not overwriting" >&2; exit 1; }
sh bin/verify.sh || { echo "ship.sh: verify not green; stopping" >&2; exit 1; }
sh bin/test.sh   || { echo "ship.sh: tests not green; stopping" >&2; exit 1; }
res=tests/browser/RESULT.txt
want_ix=$(sha256sum index.html | cut -d' ' -f1)
[ "$(sed -n 1p "$res" 2>/dev/null)" = GREEN ] && grep -q "^File tested: index.html sha256 $want_ix\$" "$res" || {
  echo "ship.sh: $res is not GREEN for this index.html ($want_ix); run the browser kit" >&2; exit 1; }
sh bin/sums.sh   || exit 2
sh bin/verify.sh || exit 1
mkdir -p dist || exit 2
# The tarball holds the ship list as sums.sh names it (tests/, spec/ and
# patches/ included), plus SHA256SUMS itself, under one top folder topoforge-VERSION/.
files=$(cut -c67- SHA256SUMS) || exit 2
# shellcheck disable=SC2086
tar -czf "$tgz" --transform "s,^,topoforge-$v/," SHA256SUMS $files || exit 2
sha256sum "$tgz"
echo "ship.sh: packed $tgz. To sign (Corwin):"
echo "  gpg --armor --detach-sign $tgz"
