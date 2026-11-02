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
# 1.9 (B):
#   map-inside     the handles sit inside the map's frame -> N1
#   map-always     the handles never hide                -> N1
#   map-no-near    reaching for the map shows nothing    -> N1
#   map-hover-only a focused handle stays hidden         -> N2
#   map-no-keys    the grip ignores the arrow keys       -> N3
#   map-no-resize  dragging the resize handle does nothing -> N3
#   map-menu-dead  Position, Top left does nothing       -> N4
#   map-not-kept   the map's place is not kept           -> N5
#   map-off-stays  turned off, the map stays in its frame -> N6
#   map-no-store   refused storage breaks the move       -> N7
#   map-touch      no hover, and the handles stay hidden -> N8
#   map-contrast   the handles' text too faint           -> X3
#   map-covered    floating Properties covers the map    -> N9
#   prev-redraw    a redraw loses the preview            -> H1
#   prev-no-clear  preview(null) leaves it                -> H1
#   prev-unasked   preview() draws with no switch        -> H2
#   prev-box       the caption falls out of the pages box -> H3
# 1.9 (C):
#   tabs-scroll    the strip scrolls as before            -> T1
#   tabs-no-window every tab shown, none hidden           -> T1
#   tabs-next-dead › moves nothing                        -> T2
#   tabs-no-arrows the arrow keys do nothing on a tab     -> T3
#   tabs-lost      End leaves the last tab out of the window -> T3
#   tabs-no-filter typing does not narrow the list        -> T4
#   tabs-fly-down  All's list opens below the strip       -> T4
#   tabs-ctl-always the controls show when the tabs fit   -> T5
# 1.10:
#   wheel-unasked  the wheel works with mapwheel off      -> MW2
#   wheel-corner   the wheel zooms about the corner       -> MW1
#   wheel-alt-dead Alt+wheel leaves the map's scale       -> MW3
#   wheel-deltax   Shift+wheel as deltaX is ignored       -> MW4
#   wheel-ns-dead  Alt+Shift+wheel moves nothing          -> MW5
#   mode-default   rings, not both, by default            -> MM1
#   mode-silent    a mode change is not told              -> MM1
#   mode-any       any name is taken as a mode            -> MM1
#   preview-silent preview() tells the page nothing       -> MM1
#   rings-cap-in   rings keeps the caption in the map     -> MM2
#   card-no-fade   the map does not fade behind the card  -> MM3
#   mode-moves-map a mode change resets the map's size    -> MM3
#   both-no-hi     both lights nothing in the drawing     -> MM4
#   both-no-clear  preview(null) leaves the highlight     -> MM4
#   card-markup    the card's title taken as markup       -> MM5
#   menu-dead      Mode, Rings does nothing               -> MM6
#   hi-faint       the highlight too faint to see         -> MM7
#   mode-not-kept  the mode chosen is not kept            -> MM8
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
  # 1.10: a check's id may have two letters (MW1, MM1)
  fails=$(sed -n 's/^FAIL \([A-Z][A-Z]*[0-9]*\) .*/\1/p' "$out/RESULT-$1.txt" 2>/dev/null | sort -u | tr '\n' ' ' | sed 's/ $//')
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
# 1.9 (B)
plant map-inside    N1 's@#mmwrap .mm-handles{position:absolute;bottom:100%;@#mmwrap .mm-handles{position:absolute;bottom:0;@'
plant map-always    N1 's@^#mmwrap:not(.mm-near):not(:focus-within) .mm-handles{opacity:0}$@@'
plant map-no-near   N1 "s@MMW.wrap.classList.toggle('mm-near', b.width > 0 \&\&@MMW.wrap.classList.toggle('mm-near', false \&\&@"
plant map-hover-only N2 's@^#mmwrap:not(.mm-near):not(:focus-within) .mm-handles{opacity:0}$@#mmwrap:not(.mm-near) .mm-handles{opacity:0}@'
plant map-no-keys   N3 's@^    grip.addEventListener(.keydown., e => keyd(e, (dx, dy) => mmMove(dx, dy, true)));$@@'
plant map-no-resize N3 's@^    dragOn(size, (d, dx, dy) => { MMW.w = d.w - dx; MMW.h = d.h - dy; mmApply(); });$@@'
plant map-menu-dead N4 "s@{ label: 'Top left', action: corner(false, false) }@{ label: 'Top left', action: () => {} }@"
plant map-not-kept  N5 's@o.minimap = { r: MMW.r, b: MMW.b, w: MMW.w, h: MMW.h };@o.minimap = null;@'
plant map-off-stays N6 "s@^  else if (mm.parentNode !== \$('#stage')) \$('#stage').insertBefore(mm, MAP ? MAP.box : null);\$@@"
plant map-no-store  N7 '/o.minimap = {/s@try { \(localStorage.setItem(UI_KEY, JSON.stringify(o));\) } catch (e) { /\* refused: kept for this visit only \*/ }@\1@'
plant map-touch     N8 's|^@media (hover:none){#mmwrap .mm-handles{opacity:1 !important}}$||'
plant map-contrast  X3 's@#mmwrap .mm-h{border:1px solid var(--border-2);background:var(--panel);color:var(--text);@#mmwrap .mm-h{border:1px solid var(--border-2);background:var(--panel);color:#a0a8b4;@'
plant map-covered   N9 's@^    if (name === .props. \&\& typeof MMW !== .undefined.*$@@'
plant prev-redraw   H1 's@^  if (PREVIEW) drawPreview();   // 1.9.*$@@'
plant prev-no-clear H1 's@if (what === null || what === undefined) { PREVIEW = null; drawPreview(); if (!quiet) tellPreview(null); return true; }@if (what === null || what === undefined) { return true; }@'
plant prev-unasked  H2 's@if (!EMBED.preview \&\& !quiet) return false;@if (false) return false;@'
plant prev-box      H3 's@^body.tf-preview #mapbox #minimap{position:relative}$@@'
# 1.9 (C)
plant tabs-scroll   T1 's@^#pagetabs.pt-ovf{overflow:hidden}$@@'
plant tabs-no-window T1 's@if (!W || total <= W + 0.5) {@if (true) {@'
plant tabs-next-dead T2 "s@PT.start += c.classList.contains('pt-prev') ? -1 : 1; fitTabs();@fitTabs();@"
plant tabs-no-arrows T3 's@if (j === undefined || e.altKey || e.ctrlKey || e.metaKey) return;@return;@'
plant tabs-lost     T3 "s@if (typeof show === 'number' \&\& show >= 0 \&\& show < n) {@if (false) {@"
plant tabs-no-filter T4 "s@^  inp.addEventListener('input', draw);\$@@"
plant tabs-fly-down T4 "s@m.style.top = 'auto'; m.style.bottom = Math.round(innerHeight - r.top + 4) + 'px';@m.style.top = Math.round(r.bottom + 4) + 'px';@"
plant tabs-ctl-always T5 's@if (!W || total <= W + 0.5) {@if (!W) {@'
# 1.10
plant wheel-unasked  MW2 's@^  if (!EMBED.mapwheel) return;$@@'
plant wheel-corner   MW1 's@else zoomAt(S.view.k \* Math.exp(-d \* 0.0022));@else zoomAt(S.view.k * Math.exp(-d * 0.0022), 0, 0);@'
plant wheel-alt-dead MW3 's@else if (e.altKey) mapScale(MAPSCALE \* Math.exp(-d \* 0.002));@else if (e.altKey) { }@'
plant wheel-deltax   MW4 's@const d = (Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX) \* unit;@const d = e.deltaY * unit;@'
plant wheel-ns-dead  MW5 's@if (e.altKey \&\& e.shiftKey) { S.view.y -= d; applyView(); }@if (e.altKey \&\& e.shiftKey) { }@'
plant mode-default   MM1 "s@^let MAPMODE = 'both',@let MAPMODE = 'rings',@"
plant mode-silent    MM1 "s@ if (EMBED.preview) tell('topoforge:mapmode', { mode, mapCaption: cap });@@"
plant mode-any       MM1 's@^  if (!MAP_MODES.includes(mode)) return false;$@@'
plant preview-silent MM1 's@const r = drawPreview(); tellPreview(r); return r;@const r = drawPreview(); return r;@'
plant rings-cap-in   MM2 's@cap.hidden = !(rings \&\& MAPCAP);@cap.hidden = !rings;@'
plant card-no-fade   MM3 's@^#minimap.mm-carded #mmSvg{opacity:.14}$@@'
plant mode-moves-map MM3 's@^  MAPMODE = mode; MAPCAP = cap;$@  MAPMODE = mode; MAPCAP = cap; if (MMW) { MMW.w = 190; MMW.h = 130; mmApply(); }@'
plant both-no-hi     MM4 "s@drawHighlight(MAPMODE === 'both' ? hits : null);@drawHighlight(null);@"
plant both-no-clear  MM4 's@if (!PREVIEW) { if (cap) cap.hidden = true; drawCard(null); drawHighlight(null); return true; }@if (!PREVIEW) { if (cap) cap.hidden = true; drawCard(null); return true; }@'
plant card-markup    MM5 "s@el.querySelector('.mc-t').textContent = card.title || '';@el.querySelector('.mc-t').innerHTML = card.title || '';@"
plant menu-dead      MM6 "s@{ label: 'Rings: matches ringed in the map', checked: MAPMODE === 'rings', action: set('rings') }@{ label: 'Rings: matches ringed in the map', checked: MAPMODE === 'rings', action: () => {} }@"
plant hi-faint       MM7 's@rx="10" fill="${c}" fill-opacity=".10" stroke="${c}"@rx="10" fill="${c}" fill-opacity=".10" stroke="#e5e7eb"@'
plant mode-not-kept  MM8 "s@if (changed) { uiPut('mapMode', { mode, mapCaption: cap }); drawPreview();@if (changed) { drawPreview();@"
[ $bad -eq 0 ] && echo "embed-prove-red.sh: all $n plants caught" || echo "embed-prove-red.sh: a plant got through" >&2
exit $bad
