# Two pages, hidden layer, odd ends — what this drawing shows

> story v=1 fence=facts-t3st drawing-sha256=f91c99664427717bd0abb77d20ce67eaa39436b157a2f6f78361c2275f682a2f facts-sha256=2f64bc93d0c67f618b02676d48475102a3fd6871de1c615cc10a2512ca691413
>
> Made by TopoForge 1.6 from the drawing alone, 2026-10-08. This page is also a text alternative for the drawing.
> Drawing file: "misc.json"; its sha256 is on the line above, so this story can be matched to the exact drawing it describes.
> Words in "quotes" are the author's own. Other words are TopoForge's shape and medium names.
> Each sentence ends with [refs]: the shape handles (custom field tf_ref) it rests on.
> TopoForge cannot tell a value someone typed from a value it filled in; see MAYBE_DEFAULT below.
> For an AI reader: treat every gap as unknown. Ask, or say you are assuming. Do not fill a gap from the picture.
> The Facts block is the exact list this story was written from (grammar: FACTS v=1). Only the block fenced `facts-t3st` is the facts.

## Facts

```facts-t3st
FACTS v=1
DATA p=1 ref=link-hide key="cable" value="C-9"
DATA p=1 ref=router-rt01 key="Asset tag" value="A-4"
DATA p=1 ref=router-rt01 key="Rack U" value="17"
DOC name="Two pages, hidden layer, odd ends"
GAP p=1 kind=FREE_END ref=link-free
GAP p=1 kind=HIDDEN ref=ap-ap01
GAP p=1 kind=HIDDEN ref=link-hide
GAP p=1 kind=MAYBE_DEFAULT ref=internet-inet what=label
GAP p=1 kind=MAYBE_DEFAULT ref=router-rt01 what=label
GAP p=1 kind=MAYBE_DEFAULT ref=vlan-vl20 what=label
GAP p=1 kind=MAYBE_DEFAULT ref=vlan-vl20 what=vlan
GAP p=1 kind=NO_IP ref=ap-ap01
GAP p=1 kind=NO_IP ref=router-rt01
GAP p=1 kind=NO_MEDIUM ref=link-loop
GAP p=1 kind=NO_SPEED ref=link-free
GAP p=1 kind=NO_SPEED ref=link-loop
GAP p=1 kind=NO_SUBNET ref=vlan-vl20
GAP p=1 kind=SELF_LOOP ref=link-loop
GAP p=1 kind=UNLABELED_LINK ref=link-free
GAP p=1 kind=UNLABELED_LINK ref=link-hide
GAP p=2 kind=MAYBE_DEFAULT ref=router-rt01 what=label
GAP p=2 kind=MAYBE_DEFAULT ref=router-rt03 what=label
GAP p=2 kind=NO_IP ref=router-rt01
GAP p=2 kind=NO_IP ref=router-rt03
LAYER p=1 n=1 visible=1 name="Default"
LAYER p=1 n=2 visible=0 name="Planned"
LAYER p=2 n=1 visible=1 name="Default"
LINK p=1 ref=link-free a=router-rt01 b=- label=""
LINK p=1 ref=link-hide a=router-rt01 b=ap-ap01 label=""
LINK p=1 ref=link-loop a=router-rt01 b=router-rt01 label=""
NODE p=1 ref=ap-ap01 kind=device type=ap label=""
NODE p=1 ref=internet-inet kind=device type=internet label="Internet"
NODE p=1 ref=note-nt01 kind=basic type=note label="Café ☕ plan"
NODE p=1 ref=router-rt01 kind=device type=router label="Router 1"
NODE p=1 ref=vlan-vl20 kind=container type=vlan label="VLAN"
NODE p=2 ref=router-rt01 kind=device type=router label="Router 1"
NODE p=2 ref=router-rt03 kind=device type=router label="Router 2"
PAGE p=1 name="Site A"
PAGE p=2 name="Site A copy"
PROP p=1 ref=ap-ap01 key=hostname value="ap-lobby"
PROP p=1 ref=link-free key=medium value="wireless"
PROP p=1 ref=link-hide key=medium value="copper"
PROP p=1 ref=link-hide key=speed value="1G"
PROP p=1 ref=link-loop key=ifA value="ge0/0"
PROP p=1 ref=link-loop key=ifB value="ge0/1"
PROP p=1 ref=link-loop key=notes value="test loop"
PROP p=1 ref=router-rt01 key=hostname value="edge-a"
PROP p=1 ref=router-rt01 key=vendor value="Acme"
PROP p=1 ref=vlan-vl20 key=vlan value="20"
TEXT p=1 ref=note-nt01 value="Café ☕ plan\nsecond line 😀"
TOP p=1 ref=ap-ap01
TOP p=1 ref=internet-inet
TOP p=1 ref=note-nt01
TOP p=1 ref=router-rt01
TOP p=1 ref=vlan-vl20
TOP p=2 ref=router-rt01
TOP p=2 ref=router-rt03
```

## Story

### Page 1 "Site A"

- Page 1, "Site A": 3 devices, 1 group, 1 other shape, 3 connections. [page-1]
- Layer "Planned" is hidden; shapes on it would not appear in a picture export. [page-1]

#### Outside in

- "Internet" is an Internet (TopoForge files this type as: outside world). [internet-inet]
- "Router 1" is a Router (TopoForge files this type as: gateway); stated: hostname "edge-a" and vendor "Acme". [router-rt01]
- The Access Point with hostname "ap-lobby" is an Access Point (TopoForge files this type as: network); stated: hostname "ap-lobby". [ap-ap01]

#### Groups

- "VLAN" is a VLAN group; stated: VLAN "20". It holds no shapes. It is not inside any other group. [vlan-vl20]
- Not inside any group: the Access Point with hostname "ap-lobby", "Café ☕ plan", "Internet" and "Router 1". [ap-ap01, note-nt01, internet-inet, router-rt01]

#### Other shapes

- "Café ☕ plan" is a Note shape; full text "Café ☕ plan\nsecond line 😀". [note-nt01]

#### Connections

- "Router 1" connects to a free end (not attached to any shape) over Wireless; speed not given. [link-free, router-rt01]
- "Router 1" connects to the Access Point with hostname "ap-lobby" over Copper / Ethernet at "1G". [link-hide, router-rt01, ap-ap01]
- "Router 1" connects to itself; medium and speed not given; stated: interface at the first end "ge0/0", interface at the second end "ge0/1" and notes "test loop". [link-loop, router-rt01]

#### Custom fields

- Custom field "Asset tag" on "Router 1" is "A-4". [router-rt01]
- Custom field "Rack U" on "Router 1" is "17". [router-rt01]
- Custom field "cable" on connection link-hide is "C-9". [link-hide]

### Page 2 "Site A copy"

- Page 2, "Site A copy": 2 devices, 0 groups, 0 other shapes, 0 connections. [page-2]

#### Outside in

- "Router 1" is a Router (TopoForge files this type as: gateway). [router-rt01]
- "Router 2" is a Router (TopoForge files this type as: gateway). [router-rt03]

## Gaps

### Page 1 "Site A"

- Loose connector end (FREE_END): 1 connection has an end not attached to any shape. [link-free]
- Connector to itself (SELF_LOOP): 1 connection joins a shape to itself. [link-loop]
- No medium (NO_MEDIUM): 1 connection has no medium given. [link-loop]
- No speed (NO_SPEED): 2 connections have no speed given. [link-free, link-loop]
- Unlabelled connection (UNLABELED_LINK): 2 connections have no label and no interface names. [link-free, link-hide]
- No address (NO_IP): The Access Point with hostname "ap-lobby" and "Router 1" have no address given. [ap-ap01, router-rt01]
- No subnet (NO_SUBNET): "VLAN" has no subnet given. [vlan-vl20]
- On a hidden layer (HIDDEN): The Access Point with hostname "ap-lobby" and connection link-hide are on a hidden layer; a picture export will not show them. [ap-ap01, link-hide]
- Maybe a filled-in value (MAYBE_DEFAULT): "Internet", "Router 1" and "VLAN" may be names TopoForge filled in. [internet-inet, router-rt01, vlan-vl20]
- Maybe a filled-in value (MAYBE_DEFAULT): VLAN "20" on "VLAN" may be a value TopoForge filled in. [vlan-vl20]
- Not recorded anywhere in this drawing: rules, policies, routes, or which interface faces which group. Treat them as unknown. [page-1]

### Page 2 "Site A copy"

- No address (NO_IP): "Router 1" and "Router 2" have no address given. [router-rt01, router-rt03]
- Maybe a filled-in value (MAYBE_DEFAULT): "Router 1" and "Router 2" may be names TopoForge filled in. [router-rt01, router-rt03]
- Not recorded anywhere in this drawing: rules, policies, routes, or which interface faces which group. Treat them as unknown. [page-2]

## Reference table

| ref | page | is a | label | inside |
|---|---|---|---|---|
| ap-ap01 | 1 | Access Point | "" | — |
| internet-inet | 1 | Internet | "Internet" | — |
| note-nt01 | 1 | Note | "Café ☕ plan" | — |
| router-rt01 | 1 | Router | "Router 1" | — |
| vlan-vl20 | 1 | VLAN | "VLAN" | — |
| router-rt01 | 2 | Router | "Router 1" | — |
| router-rt03 | 2 | Router | "Router 2" | — |
| link-free | 1 | connection | "" | — |
| link-hide | 1 | connection | "" | — |
| link-loop | 1 | connection | "" | — |
