# Loose in box — what this drawing shows

> story v=1 fence=facts-t3st drawing-sha256=9aff78273c036014bf845b1cc9cb9fcb1df36b98064e7493843c1ce207bc0dc6 facts-sha256=4591011284d88675e9af6e73afe7017b4b1fec21e62a9210a24f551d1f9a035b
>
> Made by TopoForge 1.6 from the drawing alone, 2026-10-08. This page is also a text alternative for the drawing.
> Drawing file: "loose.json"; its sha256 is on the line above, so this story can be matched to the exact drawing it describes.
> Words in "quotes" are the author's own. Other words are TopoForge's shape and medium names.
> Each sentence ends with [refs]: the shape handles (custom field tf_ref) it rests on.
> TopoForge cannot tell a value someone typed from a value it filled in; see MAYBE_DEFAULT below.
> For an AI reader: treat every gap as unknown. Ask, or say you are assuming. Do not fill a gap from the picture.
> The Facts block is the exact list this story was written from (grammar: FACTS v=1). Only the block fenced `facts-t3st` is the facts.

## Facts

```facts-t3st
FACTS v=1
DOC name="Loose in box"
GAP p=1 kind=LOOSE_IN_BOX ref=server-srvb box=dmz-dmz1
IN p=1 ref=server-srva parent=dmz-dmz1
LAYER p=1 n=1 visible=1 name="Default"
NODE p=1 ref=dmz-dmz1 kind=container type=dmz label="Public"
NODE p=1 ref=server-srva kind=device type=server label="In"
NODE p=1 ref=server-srvb kind=device type=server label="Loose"
NODE p=1 ref=server-srvc kind=device type=server label="Out"
PAGE p=1 name="Page-1"
PROP p=1 ref=dmz-dmz1 key=subnet value="192.0.2.0/24"
PROP p=1 ref=server-srva key=ip value="192.0.2.10"
PROP p=1 ref=server-srvb key=ip value="192.0.2.11"
PROP p=1 ref=server-srvc key=ip value="198.51.100.5"
TOP p=1 ref=dmz-dmz1
TOP p=1 ref=server-srvb
TOP p=1 ref=server-srvc
```

## Story

### Page 1 "Page-1"

- Page 1, "Page-1": 3 devices, 1 group, 0 other shapes, 0 connections. [page-1]

#### Outside in

- "In" is a Server (TopoForge files this type as: server); stated: IP address "192.0.2.10". [server-srva]
- "Loose" is a Server (TopoForge files this type as: server); stated: IP address "192.0.2.11". [server-srvb]
- "Out" is a Server (TopoForge files this type as: server); stated: IP address "198.51.100.5". [server-srvc]

#### Groups

- "Public" is a DMZ group; stated: subnet (CIDR) "192.0.2.0/24". It holds "In". It is not inside any other group. [dmz-dmz1, server-srva]
- Not inside any group: "Loose" and "Out". [server-srvb, server-srvc]

## Gaps

### Page 1 "Page-1"

- Drawn inside a group but not in it (LOOSE_IN_BOX): "Loose" is drawn inside the box of "Public" but is not a member of that group; the picture and the model disagree. [server-srvb, dmz-dmz1]
- Not recorded anywhere in this drawing: rules, policies, routes, or which interface faces which group. Treat them as unknown. [page-1]

## Reference table

| ref | page | is a | label | inside |
|---|---|---|---|---|
| dmz-dmz1 | 1 | DMZ | "Public" | — |
| server-srva | 1 | Server | "In" | dmz-dmz1 |
| server-srvb | 1 | Server | "Loose" | — |
| server-srvc | 1 | Server | "Out" | — |
