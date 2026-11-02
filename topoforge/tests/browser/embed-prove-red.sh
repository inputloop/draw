#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
# Copyright 2026 Bryant Frankford <nathanielfrankford@gmail.com> and
# Corwin Brust <corwin@bru.st> and Contributors
# Written by Mentat (for Corwin, claude-opus-5-5), 2026-11-01.
#
# embed-prove-red.sh -- show that embed.browser.mjs can go red on each promise of the 1.8 switches.
# A control run on the file as given must be green first. Then each plant changes a COPY of index.html
# in one place, the kit runs on the copy, and the check named for that plant must be among those that
# fail (a plant may trip others too: the standalone ones watch the whole page).
#   on-by-default  a switch on with no ?embed=          -> S3 (standalone is no longer 1.7)
#   any-origin     postMessage to '*'                   -> E5 (a parent of another origin hears it)
#   silent-select  the hook's call in renderOverlay gone -> E2
#   no-ready       the ready event never told           -> E1
#   not-kept       places not written to storage        -> K5
#   no-keys        the grip ignores the arrow keys       -> K1
#   tabs-stay      the page tabs stay in the bottom bar  -> M1
#   brand-shows    frameless leaves the brand            -> F1
#   old-name       About says only "TopoForge"           -> A1
#   no-room        Fit ignores the floating panels       -> P2
#   runs-disabled  run() runs a disabled command         -> R2
#   drops-items    commands() leaves out some items      -> R1
#   shapes-shows   hide-shapes leaves the palette        -> B2
#   bare-pages     bare leaves the page tabs             -> B1
#   no-icons       shapes() without pictures             -> Z1
#   drop-lost      an armed place() drops nothing        -> Z2
# 1.9 (A):
#   view-silent    applyView no longer tells the view    -> V1
#   view-unasked   the view is told with no switch       -> V2
#   rect-off       selectionRect forgets the canvas's place -> R3
#   unarm-not      place(null) leaves the shape armed    -> Z3
#   props-no-undo  setProps bypasses the edit path       -> U1
#   props-any-key  setProps takes any field              -> U1
#   keys-letters   every plain key goes to the parent    -> Y1
#   keys-trap      Escape and C-g do not end a sequence  -> Y1
#   keys-unasked   keys forwarded with no switch         -> Y2
#   ctx-silent     a right click tells nothing           -> Q1
#   ctx-no-menu    the app's own menu is shut            -> Q1
#   ctx-no-press   a long press never fires              -> Q2
#   pages-silent   the page list is never told           -> G1
#   pages-switch   showing a page is told as a change    -> G1
#   all-grows      'all' turns on the 1.9 switches       -> W1
#   any-origin-19  postMessage to '*', the new messages  -> E8
# usage: sh tests/browser/embed-prove-red.sh /path/to/index.html [outdir]   (default outdir: out-embed-prove-red)
#        PLANTS='name name' runs only those plants (after the control); the full run is what counts
# exit:  0 every plant caught, 1 a plant NOT caught, 2 cannot run (no file, control not green)
set -u
ix=${1-}; out=${2:-out-embed-prove-red}
here=$(cd "$(dirname "$0")" && pwd) || exit 2
kit=$here/embed.browser.mjs
[ -f "$ix" ] || { echo "embed-prove-red.sh: usage: sh embed-prove-red.sh /path/to/index.html [outdir]" >&2; exit 2; }
command -v node >/dev/null 2>&1 || { echo "embed-prove-red.sh: node not found" >&2; exit 2; }
mkdir -p "$out" && out=$(cd "$out" && pwd) || exit 2
run() { # NAME FILE: sets rc and fails (the failing check ids)
  RESULT=$out/RESULT-$1.txt node "$kit" "$2" "$out/out-$1" > "$out/log-$1.txt" 2>&1; rc=$?
  fails=$(sed -n 's/^FAIL \([A-Z][0-9]*\) .*/\1/p' "$out/RESULT-$1.txt" 2>/dev/null | sort -u | tr '\n' ' ' | sed 's/ $//')
}
run control "$ix"
[ "$rc" -eq 0 ] || { echo "embed-prove-red.sh: the control run is not green (exit $rc, failing: ${fails:-none}); nothing proved" >&2; exit 2; }
echo "control      exit 0, no check failed"
bad=0 n=0
plant() { # NAME WANT SED-EXPR
  name=$1 want=$2 expr=$3
  [ -n "${PLANTS-}" ] && case " $PLANTS " in *" $name "*) ;; *) return ;; esac
  n=$((n + 1))
  sed "$expr" "$ix" > "$out/plant-$name.html" || exit 2
  cmp -s "$ix" "$out/plant-$name.html" && { echo "embed-prove-red.sh: plant $name changed nothing; fix the plant" >&2; exit 2; }
  run "$name" "$out/plant-$name.html"
  case " $fails " in
    *" $want "*) [ "$rc" -eq 1 ] && { echo "caught       $name: $want fails (all failing: $fails)"; return; } ;;
  esac
  echo "NOT CAUGHT   $name: exit $rc, failing: ${fails:-none}; wanted $want (see $out/log-$name.txt)" >&2; bad=1
}
plant on-by-default S3 "s#const q = new URLSearchParams(location.search).get('embed'), o = {};#const q = new URLSearchParams(location.search).get('embed') || 'frameless', o = {};#"
plant any-origin    E5 "s#window.parent.postMessage({ type, detail }, location.origin)#window.parent.postMessage({ type, detail }, '*')#"
plant silent-select E2 's#^  tellSelection(); tellPages();$#  tellPages();#'
plant no-ready      E1 "s#if (EMBED.ready \&\& !_readyTold) { _readyTold = true; tell('topoforge:ready', _readyDetail); }##"
plant not-kept      K5 's#try { localStorage.setItem(UI_KEY, JSON.stringify(o)); }#try { }#'
plant no-keys       K1 's#if (d) { e.preventDefault(); f.move(d\[0\], d\[1\]); }##'
plant tabs-stay     M1 's#MAP.row.appendChild(tabs); ##'
plant brand-shows   F1 's#body.tf-frameless .brand{#body.tf-frameless .no-brand{#'
plant no-room       P2 's#const fi = fitInsets(r), W#const fi = { l: 0, r: 0 }, W#'
plant runs-disabled R2 's#if (!c || !c.enabled) return false;#if (!c) return false;#'
plant drops-items   R1 's#if (!it.action) continue;#if (!it.action || it.kbd) continue;#'
plant shapes-shows  B2 's#body.tf-hide-shapes \#palette,body.tf-hide-shapes \#btnPal{display:none}#body.tf-hide-shapes \#btnPal{display:none}#'
plant bare-pages    B1 "s#const HIDE_ALL = \['frameless', 'hide-menus', 'hide-tools', 'hide-shapes', 'hide-props', 'hide-pages'\];#const HIDE_ALL = ['frameless', 'hide-menus', 'hide-tools', 'hide-shapes', 'hide-props'];#"
plant no-icons      Z1 "s#icon: previewSVG(k) }))#icon: '' }))#"
plant drop-lost     Z2 's#e.preventDefault(); e.stopImmediatePropagation(); const k = PLACING; placing(null); addShapeAt(k, toWorld(e));#placing(null);#'
plant old-name      A1 "s#title: 'topology forge (formerly TopoForge)'#title: 'TopoForge'#"
# 1.9 (A)
plant view-silent   V1 's#^  tellView();$##'
plant view-unasked  V2 's#^  if (!EMBED.view) return;$#  if (false) return;#'
plant rect-off      R3 's#return { x: Math.round(r.left + S.view.x + b.x \* k), y: Math.round(r.top + S.view.y + b.y \* k)#return { x: Math.round(S.view.x + b.x * k), y: Math.round(S.view.y + b.y * k)#'
plant unarm-not     Z3 's#if (id === null) { if (!PLACING) return false; placing(null);#if (id === null) { if (!PLACING) return false;#'
plant props-no-undo U1 's#^  edit(() => applyPatch(it, patch, keys));$#  applyPatch(it, patch, keys);#'
plant props-any-key U1 "s#^    if (!SETPROPS_KEYS\[n ? 'node' : 'link'\].includes(k)) return false;\$##"
plant keys-letters  Y1 "s#if (name === 'M-x' || name === '<f10>') { forwardKey#if (name === 'M-x' || name === '<f10>' || name.length === 1) { forwardKey#"
plant keys-trap     Y1 "s#const done = name === 'C-g' || name === '<escape>' || KEYSEQ.length >= 5;#const done = KEYSEQ.length >= 50;#"
plant keys-unasked  Y2 's#^  if (!EMBED.keys) return;$#  if (false) return;#'
plant ctx-silent    Q1 "s#if (h.type === 'node' || h.type === 'link') tellContext(h.node || h.link, { x: e.clientX, y: e.clientY }, 'contextmenu');##"
plant ctx-no-menu   Q1 "s#if (!EMBED.context || Date.now() - _lpAt < 900) return;#closeMenus(); if (!EMBED.context || Date.now() - _lpAt < 900) return;#"
plant ctx-no-press  Q2 's#^    }, 550) };$#    }, 55000) };#'
plant pages-silent  G1 's#^  if (!EMBED.pagelist) return;$#  return;#'
plant pages-switch  G1 's#const names = DOC.pages.map(p => p.name), key = JSON.stringify(names);#const names = DOC.pages.map(p => p.name), key = JSON.stringify(names) + DOC.cur;#'
plant all-grows     W1 "s#if (w === 'all') ALL_V1.forEach#if (w === 'all') EMBED_WORDS.forEach#"
plant any-origin-19 E8 "s#window.parent.postMessage({ type, detail }, location.origin)#window.parent.postMessage({ type, detail }, '*')#"
[ $bad -eq 0 ] && echo "embed-prove-red.sh: all $n plants caught" || echo "embed-prove-red.sh: a plant got through" >&2
exit $bad
