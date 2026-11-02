# canon.jq - read fact lines (jq -R) and write them back in one fixed form.
# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
# Copyright 2026 Bryant Frankford <nathanielfrankford@gmail.com> and Corwin Brust <corwin@bru.st> and Contributors
# Written by Mentat (for Corwin; claude-opus-5-5). Grammar: ../spec/FACTS-v1.md
#
#   jq -R -r -f canon.jq                  canonical lines (unknown kinds and keys dropped: the v1 reading rule)
#   jq -R -r --arg mode refs -f canon.jq  just the ref= values
#   jq -R -r --arg mode bad -f canon.jq   lines that do not parse, or refs that break the ref rule

def KEYS: {
  FACTS: ["v"], DOC: ["name"], PAGE: ["p","name"], LAYER: ["p","n","visible","name"],
  NODE: ["p","ref","kind","type","label"], TEXT: ["p","ref","value"], IN: ["p","ref","parent"],
  TOP: ["p","ref"], LINK: ["p","ref","a","b","label"], PROP: ["p","ref","key","value"],
  DATA: ["p","ref","key","value"], GAP: ["p","kind","ref","box","what"] };
def parse:
  (capture("\\A(?<kind>[A-Z]+)(?<rest>( .*)?)\\z") // null) as $m
  | if $m == null then null else
      { kind: $m.kind,
        k: ([ $m.rest | scan(" ([A-Za-z]+)=(\"(?:[^\"\\\\]|\\\\.)*\"|[^ \"]*)") | { key: .[0], value: .[1] } ] | from_entries),
        tail: ($m.rest | gsub(" ([A-Za-z]+)=(\"(?:[^\"\\\\]|\\\\.)*\"|[^ \"]*)"; "")) } end;
($ARGS.named.mode // "canon") as $mode
| parse as $f
| if $mode == "bad" then
    if $f == null or $f.tail != "" then "UNPARSED: " + .
    elif ($f.k.ref // null) != null and ($f.k.ref | test("\\A[a-z0-9][a-z0-9._-]{0,63}\\z") | not) then "BAD REF: " + .
    else empty end
  elif $f == null then empty
  elif $mode == "refs" then ($f.k.ref // empty), ($f.k.parent // empty), ($f.k.box // empty)
  elif KEYS[$f.kind] == null then empty
  else ([$f.kind] + [ KEYS[$f.kind][] as $key | select($f.k[$key] != null) | "\($key)=\($f.k[$key])" ]) | join(" ")
  end
