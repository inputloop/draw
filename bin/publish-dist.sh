#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
# Tangled from RECIPE.org; edit it there.
#
# publish-dist.sh -- put the built packages, the source package, the
# vendored CPAN sources and their sums where the front door's Download
# links point (/var/lib/topology/dist by default), with an index.json the
# page can read.  Writes into a temporary folder and renames it into place.
# usage: sh bin/publish-dist.sh BUILDDIR [DEST]
#   BUILDDIR holds the .deb, .dsc, .tar.* and .buildinfo files dpkg-buildpackage left
set -eu
case "${1-}" in
  --help) echo "Usage: sh bin/publish-dist.sh BUILDDIR [DEST]"; exit 0 ;;
  --version) echo "publish-dist.sh 0.01"; exit 0 ;;
  '') echo "publish-dist.sh: give the folder dpkg-buildpackage wrote into" >&2; exit 2 ;;
esac
src=$1 dest=${2:-/var/lib/topology/dist}
tmp=$dest.tmp.$$~
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/debian" "$tmp/src" "$tmp/vendor"
cp "$src"/*.deb "$tmp/debian/"
cp "$src"/*.dsc "$src"/*.tar.* "$tmp/src/"
cp "$src"/*.buildinfo "$src"/*.changes "$tmp/src/" 2>/dev/null || :
cp vendor/cpan/*.tar.gz vendor/cpan/SHA256SUMS vendor/VENDOR.org "$tmp/vendor/"
cp RECIPE.org "$tmp/"
( cd "$tmp" && find debian src vendor RECIPE.org -type f ! -name SHA256SUMS | sort | xargs sha256sum > SHA256SUMS )
( cd "$tmp" && printf '{"made":"%s","files":[' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  first=1
  while read -r sum path; do
    [ $first -eq 1 ] || printf ','; first=0
    printf '{"path":"%s","sha256":"%s","bytes":%s}' "$path" "$sum" "$(wc -c < "$path" | tr -d ' ')"
  done < SHA256SUMS
  printf ']}\n' ) > "$tmp/index.json.tmp" && mv "$tmp/index.json.tmp" "$tmp/index.json"
rm -rf "$dest.old"
[ ! -d "$dest" ] || mv "$dest" "$dest.old"
mv "$tmp" "$dest"
rm -rf "$dest.old"
trap - EXIT
echo "published $(wc -l < "$dest/SHA256SUMS") files to $dest"
