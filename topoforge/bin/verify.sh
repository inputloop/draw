#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
# Copyright 2026 Bryant Frankford <nathanielfrankford@gmail.com> and
# Corwin Brust <corwin@bru.st> and Contributors
# Tangled from RECIPE.org; edit it there.
#
# verify.sh -- is upstream/ still Bryant's v1.5, and do the files match SHA256SUMS?
# usage: sh bin/verify.sh
# exit:  0 all match, 1 something differs, 2 cannot check (missing tool or file)
set -u
cd "$(dirname "$0")/.." || exit 2
command -v sha256sum >/dev/null 2>&1 || { echo "verify.sh: sha256sum not found" >&2; exit 2; }
want=6a76e9ca66e6a2733a35677c11599114b4009529568580526d90427fa08a9e2a
up=upstream/topoforge-1.5.html
[ -f "$up" ] || { echo "verify.sh: missing $up" >&2; exit 2; }
rc=0
got=$(sha256sum "$up" | cut -d' ' -f1)
if [ "$got" = "$want" ]; then
  echo "OK      $up is Bryant's v1.5"
else
  echo "CHANGED $up: $got, expected $want"; rc=1
fi
if [ -f SHA256SUMS ]; then
  if sha256sum -c --quiet SHA256SUMS; then
    echo "OK      every file in SHA256SUMS matches ($(wc -l < SHA256SUMS | tr -d ' ') files)"
  else
    echo "CHANGED see the lines above"; rc=1
  fi
else
  echo "NOTE    no SHA256SUMS yet: make one with sh bin/sums.sh"
fi
exit $rc
