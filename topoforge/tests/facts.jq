# facts.jq - rebuild the FACTS v=1 list from a TopoForge JSON export.
# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
# Copyright 2026 Bryant Frankford <nathanielfrankford@gmail.com> and Corwin Brust <corwin@bru.st> and Contributors
# Written by Mentat (for Corwin; claude-opus-5-5). Grammar: ../spec/FACTS-v1.md
#
#   jq -r --slurpfile TB tables.json -f facts.jq drawing.json
#
# Prints one fact per line, unsorted (check.sh sorts with LC_ALL=C).
# This file never runs TopoForge's JavaScript; it reads the JSON and applies the spec.

def TB: $TB[0];
def sh($t): (TB.shapes[$t] // TB.shapes["rect"]);
def fl: ((tostring | split("\n") | .[0]) // "");
def ref: ((.data // {}).tf_ref // "") as $r
  | if ($r | type) == "string" and $r != "" then $r else (.id | tostring) end;
def has($k): (.[$k] // "") != "";

. as $doc
| "FACTS v=1",
  "DOC name=" + (($doc.name // "") | tostring | tojson),
  ( ($doc.pages // []) | to_entries[] | (.key + 1 | tostring) as $p | .value as $pg
    | ($pg.layers // []) as $layers
    | ($pg.nodes // []) as $nodes
    | ($pg.links // []) as $links
    | (reduce $nodes[] as $n ({}; .[$n.id | tostring] = $n)) as $byid
    | ([$nodes | to_entries[] | select(sh(.value.type).kind == "container")]) as $conts
    | def hidden: .layer as $l | ([$layers[] | select(.id == $l)] | .[0] // $layers[0]) as $L
                  | ($L != null and $L.visible == false);
      def parentnode: (.parent // "") as $par
                  | if $par != "" and $byid[$par | tostring] != null
                       and sh($byid[$par | tostring].type).kind == "container"
                    then $byid[$par | tostring] else null end;
      def endref($e): if ($e.id // "") != "" and $byid[$e.id | tostring] != null
                      then ($byid[$e.id | tostring] | ref) else "-" end;
    ( "PAGE p=\($p) name=" + (($pg.name // "") | tostring | tojson) ),
    ( $layers | to_entries[]
      | "LAYER p=\($p) n=\(.key + 1) visible=\(if .value.visible == false then 0 else 1 end) name=" + ((.value.name // "") | tostring | tojson) ),
    ( $nodes | to_entries[] | .key as $ni | .value as $n
      | ($n | ref) as $r | sh($n.type) as $sh | (($n.text // "") | tostring) as $text | ($text | fl) as $lab
      | ($n | parentnode) as $par | ($n.props // {}) as $pr
      | "NODE p=\($p) ref=\($r) kind=\($sh.kind) type=\($n.type) label=" + ($lab | tojson),
        (if ($text | contains("\n")) then "TEXT p=\($p) ref=\($r) value=" + ($text | tojson) else empty end),
        (if $par != null then "IN p=\($p) ref=\($r) parent=\($par | ref)" else "TOP p=\($p) ref=\($r)" end),
        (TB.net_props[] as $k | select($pr | has($k)) | "PROP p=\($p) ref=\($r) key=\($k) value=" + ($pr[$k] | tostring | tojson)),
        (($n.data // {}) | to_entries[] | select(.key != "tf_ref")
          | "DATA p=\($p) ref=\($r) key=" + (.key | tojson) + " value=" + (.value | tostring | tojson)),
        (if $sh.kind == "device" and $sh.tier != 0 and ($pr | has("ip") | not) then "GAP p=\($p) kind=NO_IP ref=\($r)" else empty end),
        (if $sh.kind == "container" and ($pr | has("subnet") | not) then "GAP p=\($p) kind=NO_SUBNET ref=\($r)" else empty end),
        (if $par == null then
           ([ $conts[] | select(.key != $ni) | .key as $ci | .value as $c
              | select($c.x <= $n.x and $c.y <= $n.y and ($n.x + $n.w) <= ($c.x + $c.w) and ($n.y + $n.h) <= ($c.y + $c.h))
              | { a: ($c.w * $c.h), i: $ci, r: ($c | ref) } ] | sort_by([.a, .i]) | .[0]) as $best
           | if $best != null then "GAP p=\($p) kind=LOOSE_IN_BOX ref=\($r) box=\($best.r)" else empty end
         else empty end),
        (if ($n | hidden) then "GAP p=\($p) kind=HIDDEN ref=\($r)" else empty end),
        (if $sh.kind == "device" and (
              (($lab | startswith($sh.base + " ")) and ($lab[($sh.base | length) + 1:] | test("\\A[0-9]+\\z")))
              or (($n.type == "internet" or $n.type == "cloud" or $n.type == "wan") and $lab == $sh.base))
         then "GAP p=\($p) kind=MAYBE_DEFAULT ref=\($r) what=label" else empty end),
        (if $sh.kind == "container" and $lab == $sh.name then "GAP p=\($p) kind=MAYBE_DEFAULT ref=\($r) what=label" else empty end),
        (if $n.type == "vlan" and (($pr.vlan // "") | tostring | test("\\A[1-9][0-9]*0\\z")) then "GAP p=\($p) kind=MAYBE_DEFAULT ref=\($r) what=vlan" else empty end)
    ),
    ( $links[] as $l
      | ($l | ref) as $r | (($l.text // "") | tostring) as $text | ($l.props // {}) as $lp
      | endref($l.a // {}) as $A | endref($l.b // {}) as $B
      | "LINK p=\($p) ref=\($r) a=\($A) b=\($B) label=" + ($text | fl | tojson),
        (if ($text | contains("\n")) then "TEXT p=\($p) ref=\($r) value=" + ($text | tojson) else empty end),
        (TB.link_props[] as $k | select($lp | has($k)) | "PROP p=\($p) ref=\($r) key=\($k) value=" + ($lp[$k] | tostring | tojson)),
        (($l.data // {}) | to_entries[] | select(.key != "tf_ref")
          | "DATA p=\($p) ref=\($r) key=" + (.key | tojson) + " value=" + (.value | tostring | tojson)),
        (if $A == "-" or $B == "-" then "GAP p=\($p) kind=FREE_END ref=\($r)"
         elif $l.a.id == $l.b.id then "GAP p=\($p) kind=SELF_LOOP ref=\($r)" else empty end),
        (if ($lp | has("medium") | not) then "GAP p=\($p) kind=NO_MEDIUM ref=\($r)" else empty end),
        (if ($lp | has("speed") | not) then "GAP p=\($p) kind=NO_SPEED ref=\($r)" else empty end),
        (if $text == "" and ($lp | has("ifA") | not) and ($lp | has("ifB") | not) then "GAP p=\($p) kind=UNLABELED_LINK ref=\($r)" else empty end),
        (if ($l | hidden) then "GAP p=\($p) kind=HIDDEN ref=\($r)" else empty end)
    )
  )
