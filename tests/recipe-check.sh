#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
# Tangled from RECIPE.org; edit it there.
#
# recipe-check.sh -- tangle RECIPE.org into a scratch folder and compare
# every file it writes with the file of that name in this tree.  The
# recipe is the source; this says whether the tree still agrees with it.
# usage: sh tests/recipe-check.sh [--prove-red]
# exit: 0 agree, 1 differ, 2 could not run
set -u
d=$(mktemp -d) || exit 2
trap 'rm -rf "$d"' EXIT
if [ "${1-}" = --prove-red ]; then
  # plant: change one line of the recipe's copy; the check must turn red
  sed 's/^ceiling = write$/ceiling = api/' RECIPE.org > "$d/RECIPE.org"
  mkdir -p "$d/out"
  sh bin/tangle.sh -d "$d/out" "$d/RECIPE.org" >/dev/null || exit 2
  cmp -s "$d/out/etc/topology.conf" etc/topology.conf && { echo "prove-red: the plant was NOT caught"; exit 1; }
  echo "prove-red: a changed recipe line is caught"; exit 0
fi
mkdir -p "$d/out"
list=$(sh bin/tangle.sh -d "$d/out" RECIPE.org) || exit 2
n=0 bad=0
for p in $(printf '%s\n' "$list" | sed -n 's/^tangled //p'); do
  n=$((n + 1))
  if ! cmp -s "$d/out/$p" "$p"; then
    # the tangler adds the shebang line; mode bits are not compared
    echo "differs: $p"; bad=$((bad + 1))
  fi
done
[ $n -gt 0 ] || { echo "recipe-check: the recipe tangled nothing"; exit 2; }
[ $bad -eq 0 ] && echo "recipe-check: $n files, all as the recipe makes them" || echo "recipe-check: $bad of $n differ"
[ $bad -eq 0 ]
