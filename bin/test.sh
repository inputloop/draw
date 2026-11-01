#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
# Tangled from RECIPE.org; edit it there.
#
# test.sh -- every test this tree carries that needs no network and no
# browser: the Perl modules (with the perl given, default /opt/topology/perl
# or perl), the JavaScript rules (node), the accessibility check and its
# planted faults, and the recipe check.
# usage: sh bin/test.sh [PERL]
# exit: 0 all green, 1 something red, 2 a needed tool missing
set -u
case "${1-}" in
  --help) echo "Usage: sh bin/test.sh [PERL]"; exit 0 ;;
  --version) echo "test.sh 0.01"; exit 0 ;;
esac
perl=${1:-}
[ -n "$perl" ] || { [ -x /opt/topology/perl/bin/perl ] && perl=/opt/topology/perl/bin/perl || perl=perl; }
red=0
echo "== Perl ($($perl -e 'print $^V'))"
( cd perl/Topology && prove -e "$perl" -l t/ ) || red=1
echo "== JavaScript"
if (node --version) >/dev/null 2>&1; then node --test tests/js/*.test.mjs >/dev/null 2>&1 && echo "tests/js: ok" || { node --test tests/js/*.test.mjs; red=1; }
else echo "node not found: the JavaScript half was not tested"; red=2; fi
echo "== The examples agree with their fixture"
if (node --version) >/dev/null 2>&1; then node tests/make-examples-fixture.mjs --check || red=1; fi
echo "== Accessibility (WCAG 2.1 AA rules, and the planted faults it must catch)"
if (node --version) >/dev/null 2>&1; then
  node tests/a11y-check.mjs || red=1
  node tests/a11y-check.mjs --plant | tail -1 | tee /dev/stderr | grep -q "all .* caught" || red=1
fi
echo "== The recipe makes this tree"
sh tests/recipe-check.sh || red=1
[ $red -eq 0 ] && echo GREEN || echo RED
exit $red
