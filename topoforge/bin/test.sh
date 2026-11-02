#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
# Copyright 2026 Bryant Frankford <nathanielfrankford@gmail.com> and
# Corwin Brust <corwin@bru.st> and Contributors
# Tangled from RECIPE.org; edit it there.
#
# test.sh -- run every test kit this tree carries.
# usage: sh bin/test.sh
# exit:  0 all green, 1 something red, 2 a kit is missing or broken
set -u
cd "$(dirname "$0")/.." || exit 2
red=0 broken=0
note() { r=$1; shift; echo "$* -> exit $r"
  case $r in 0) ;; 1) red=1 ;; *) broken=1 ;; esac; }
if [ -f tests/run.sh ]; then
  sh tests/run.sh; note $? "tests/run.sh"
elif ls tests/*.sh >/dev/null 2>&1; then
  for t in tests/*.sh; do sh "$t"; note $? "$t"; done
else
  echo "NOT BUILT: tests/ (TopoForge's own tests, builder T1) is not here yet"; broken=1
fi
if command -v python3 >/dev/null 2>&1; then
  PYTHONDONTWRITEBYTECODE=1 python3 -I kit/project-files/check.py; note $? "kit/project-files/check.py"
else
  echo "SKIP: python3 not found; kit/project-files not run"; broken=1
fi
[ $red -eq 1 ] && exit 1
[ $broken -eq 1 ] && exit 2
exit 0
