#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
# Tangled from RECIPE.org; edit it there.
#
# vendor-install.sh -- build, test and install the vendored CPAN
# distributions with a given perl, in the order vendor/ORDER gives.
# Each tarball is checked against vendor/cpan/SHA256SUMS first.
# usage: sh bin/vendor-install.sh PERL CPANDIR WORKDIR
# TOPOLOGY_TEST=no skips each distribution's own tests.
set -eu
case "${1-}" in
  --help) echo "Usage: sh bin/vendor-install.sh PERL CPANDIR WORKDIR"; exit 0 ;;
  --version) echo "vendor-install.sh 0.01"; exit 0 ;;
esac
[ $# -eq 3 ] || { echo "vendor-install.sh: give PERL CPANDIR WORKDIR" >&2; exit 2; }
perl=$1 cpan=$2 work=$3
here=$(pwd)
order=$here/vendor/ORDER
( cd "$cpan" && sha256sum -c --quiet SHA256SUMS ) || { echo "vendor-install.sh: a tarball does not match SHA256SUMS" >&2; exit 1; }
mkdir -p "$work"
while read -r dist; do
  case $dist in ''|'#'*) continue ;; esac
  tgz=$(ls "$cpan"/"$dist"-[0-9v]*.tar.gz 2>/dev/null | head -n 1)
  [ -n "$tgz" ] || { echo "vendor-install.sh: no tarball for $dist" >&2; exit 1; }
  tar -C "$work" -xzf "$tgz"
  dir=$work/$(basename "$tgz" .tar.gz)
  (
    cd "$dir"
    if [ -f Build.PL ]; then
      "$perl" Build.PL >build.log 2>&1 && ./Build >>build.log 2>&1
      [ "${TOPOLOGY_TEST:-yes}" = no ] || ./Build test >test.log 2>&1 || { tail -n 20 test.log >&2; exit 1; }
      ./Build install >>build.log 2>&1
    else
      "$perl" Makefile.PL >build.log 2>&1 && make >>build.log 2>&1
      [ "${TOPOLOGY_TEST:-yes}" = no ] || make test >test.log 2>&1 || { tail -n 20 test.log >&2; exit 1; }
      make install >>build.log 2>&1
    fi
  ) || { echo "vendor-install.sh: $dist failed; see $dir/build.log" >&2; exit 1; }
  echo "installed $dist"
done < "$order"
