#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
# Tangled from RECIPE.org; edit it there.
#
# stage-www.sh -- assemble the site as it is installed: www/ plus the
# files the front door links to (the recipe, the spec, the taxonomy, the
# context of this branch, the licences).  Writes into a temporary folder
# beside DEST and renames it into place.
# usage: sh bin/stage-www.sh DEST
set -eu
case "${1-}" in
  --help) echo "Usage: sh bin/stage-www.sh DEST"; exit 0 ;;
  --version) echo "stage-www.sh 0.01"; exit 0 ;;
  '') echo "stage-www.sh: give a destination folder" >&2; exit 2 ;;
esac
dest=$1
tmp=$dest.tmp.$$~
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp"
cp -R www/. "$tmp/"
mkdir -p "$tmp/spec" "$tmp/taxonomy" "$tmp/context" "$tmp/design"
cp RECIPE.org COPYING COPYING.LESSER "$tmp/"
cp spec/TOPOLOGY-md.md "$tmp/spec/"
cp taxonomy/pillars.json "$tmp/taxonomy/"
cp context/*.md "$tmp/context/"
cp design/*.md design/*.org "$tmp/design/" 2>/dev/null || :
rm -rf "$dest"
mv "$tmp" "$dest"
trap - EXIT
echo "staged $dest"
