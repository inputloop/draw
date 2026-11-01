---
name: suit-crm-6-5-php-sec-backport
kind: container
pillar: part
layer: operational
connects: corwin, gw19, github.com/inputloop
repo: https://github.com/inputloop/suit-crm-6-5-php-sec-backport
---
# suit-crm-6-5-php-sec-backport

Patched PHP 7.4, 8.0 and 8.1 for SuiteCRM (the SugarCRM CE 6.5 lineage), against CVE-2026-109618 and
CVE-2026-109619. It builds PHP from the end-of-life mitigation commits the PHP project published on
2026-10-18 and 2026-10-21, pinned by full SHA (the build refuses to go on if a branch head moves),
proves that SuiteCRM 7.13 installs and logs in on each build, and publishes the binaries together with
the complete sources they were built from.

It is a build-and-prove apparatus: no exploit and no vulnerable code of its own; the patches are the PHP
project's, unchanged. `RUNBOOK.md` is what was run by hand on gw19 on 2026-10-21, in containers; CI runs
the same scripts. Corwin's. Scripts and documents GPL-3.0-or-later (one script Expat); PHP stays under
the PHP License 3.01 and SuiteCRM under AGPL-3.0.
