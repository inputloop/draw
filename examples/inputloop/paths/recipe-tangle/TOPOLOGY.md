---
name: recipe-tangle
kind: parallelogram
pillar: path
layer: operational
connects: topology
---
# recipe-tangle

`RECIPE.org` is tangled by `sh bin/tangle.sh` into `bin/`, `debian/` and `etc/`; `tests/recipe-check.sh`
says whether the tree still agrees with the recipe. Edit the recipe, then tangle; never edit a tangled file alone.
