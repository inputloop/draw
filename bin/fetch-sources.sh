#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
# Tangled from RECIPE.org; edit it there.
#
# fetch-sources.sh -- put perl's source tarball into vendor/perl/, checked
# against the sum written here.  It is the one input not kept in git (21 MB);
# the source package carries it.  The CPAN tarballs are in git already.
# usage: sh bin/fetch-sources.sh
set -eu
case "${1-}" in
  --help) echo "Usage: sh bin/fetch-sources.sh"; exit 0 ;;
  --version) echo "fetch-sources.sh 0.01"; exit 0 ;;
esac
v=5.44.0
sum=3b855066b92491cb40e86affb1ca57d1a388aa43e51b91c7806a32c2f65f96c3
f=vendor/perl/perl-$v.tar.gz
mkdir -p vendor/perl
if [ ! -f "$f" ]; then
  (curl --version) >/dev/null 2>&1 || { echo "fetch-sources.sh: needs curl, or put $f there by hand" >&2; exit 2; }
  curl -fsSL -o "$f.tmp.$$~" "https://www.cpan.org/src/5.0/perl-$v.tar.gz"
  mv "$f.tmp.$$~" "$f"
fi
echo "$sum  $f" | sha256sum -c --quiet || { echo "fetch-sources.sh: $f does not match the sum in this script" >&2; exit 1; }
echo "ok $f"
