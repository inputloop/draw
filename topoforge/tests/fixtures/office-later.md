# Small office — what this drawing shows

> story v=1 fence=facts-t3st drawing-sha256=8a3d4ddb3651b9ee036e1ed12ef27ef1d6d30bd7b3757a0e511446dfc0e19bfa facts-sha256=4a4a1bede9a0dc8788e5330dbb8e2a1586fe9984ec3df8fd7709d76cc313b49a
>
> Made by TopoForge 1.6 from the drawing alone, 2026-10-08. This page is also a text alternative for the drawing.
> Drawing file: "office-later.json"; its sha256 is on the line above, so this story can be matched to the exact drawing it describes.
> Words in "quotes" are the author's own. Other words are TopoForge's shape and medium names.
> Each sentence ends with [refs]: the shape handles (custom field tf_ref) it rests on.
> TopoForge cannot tell a value someone typed from a value it filled in; see MAYBE_DEFAULT below.
> For an AI reader: treat every gap as unknown. Ask, or say you are assuming. Do not fill a gap from the picture.
> The Facts block is the exact list this story was written from (grammar: FACTS v=1). Only the block fenced `facts-t3st` is the facts.

## Facts

```facts-t3st
FACTS v=1
DOC name="Small office"
GAP p=1 kind=MAYBE_DEFAULT ref=desktop-pc01 what=label
GAP p=1 kind=MAYBE_DEFAULT ref=desktop-pc03 what=label
GAP p=1 kind=MAYBE_DEFAULT ref=dmz-dmz1 what=label
GAP p=1 kind=MAYBE_DEFAULT ref=vlan-lan1 what=vlan
GAP p=1 kind=NO_IP ref=desktop-pc01
GAP p=1 kind=NO_IP ref=desktop-pc02
GAP p=1 kind=NO_IP ref=desktop-pc03
GAP p=1 kind=NO_IP ref=server-mai1
GAP p=1 kind=NO_IP ref=server-web1
GAP p=1 kind=NO_IP ref=switch-sw01
GAP p=1 kind=NO_MEDIUM ref=link-fwwb
GAP p=1 kind=NO_MEDIUM ref=link-swp1
GAP p=1 kind=NO_MEDIUM ref=link-swp2
GAP p=1 kind=NO_MEDIUM ref=link-swp3
GAP p=1 kind=NO_SPEED ref=link-fwwb
GAP p=1 kind=NO_SPEED ref=link-swp1
GAP p=1 kind=NO_SPEED ref=link-swp2
GAP p=1 kind=NO_SPEED ref=link-swp3
GAP p=1 kind=NO_SUBNET ref=dmz-dmz1
GAP p=1 kind=NO_SUBNET ref=vlan-lan1
GAP p=1 kind=UNLABELED_LINK ref=link-fwwb
GAP p=1 kind=UNLABELED_LINK ref=link-gwfw
GAP p=1 kind=UNLABELED_LINK ref=link-swp1
GAP p=1 kind=UNLABELED_LINK ref=link-swp2
GAP p=1 kind=UNLABELED_LINK ref=link-swp3
IN p=1 ref=desktop-pc01 parent=vlan-lan1
IN p=1 ref=desktop-pc02 parent=vlan-lan1
IN p=1 ref=desktop-pc03 parent=vlan-lan1
IN p=1 ref=server-mai1 parent=dmz-dmz1
IN p=1 ref=server-web1 parent=dmz-dmz1
IN p=1 ref=switch-sw01 parent=vlan-lan1
LAYER p=1 n=1 visible=1 name="Default"
LINK p=1 ref=link-fwsw a=firewall-fw01 b=switch-sw01 label="trunk"
LINK p=1 ref=link-fwwb a=firewall-fw01 b=server-web1 label=""
LINK p=1 ref=link-gwfw a=router-gw01 b=firewall-fw01 label=""
LINK p=1 ref=link-swp1 a=switch-sw01 b=desktop-pc01 label=""
LINK p=1 ref=link-swp2 a=switch-sw01 b=desktop-pc02 label=""
LINK p=1 ref=link-swp3 a=switch-sw01 b=desktop-pc03 label=""
NODE p=1 ref=desktop-pc01 kind=device type=desktop label="PC 1"
NODE p=1 ref=desktop-pc02 kind=device type=desktop label="Reception PC"
NODE p=1 ref=desktop-pc03 kind=device type=desktop label="PC 3"
NODE p=1 ref=dmz-dmz1 kind=container type=dmz label="DMZ"
NODE p=1 ref=firewall-fw01 kind=device type=firewall label="FW1"
NODE p=1 ref=router-gw01 kind=device type=router label="Gateway"
NODE p=1 ref=server-mai1 kind=device type=server label="Mail1"
NODE p=1 ref=server-web1 kind=device type=server label="Web1"
NODE p=1 ref=switch-sw01 kind=device type=switch label="SW1"
NODE p=1 ref=vlan-lan1 kind=container type=vlan label="LAN"
PAGE p=1 name="Page-1"
PROP p=1 ref=firewall-fw01 key=ip value="192.168.1.1"
PROP p=1 ref=link-fwsw key=medium value="copper"
PROP p=1 ref=link-fwsw key=speed value="1G"
PROP p=1 ref=link-gwfw key=medium value="fiber"
PROP p=1 ref=link-gwfw key=speed value="1G"
PROP p=1 ref=router-gw01 key=ip value="203.0.113.1"
PROP p=1 ref=vlan-lan1 key=vlan value="10"
TOP p=1 ref=dmz-dmz1
TOP p=1 ref=firewall-fw01
TOP p=1 ref=router-gw01
TOP p=1 ref=vlan-lan1
```

## Story

### Page 1 "Page-1"

- Page 1, "Page-1": 8 devices, 2 groups, 0 other shapes, 6 connections. [page-1]

#### Outside in

- "FW1" is a Firewall (TopoForge files this type as: perimeter); stated: IP address "192.168.1.1". [firewall-fw01]
- "Gateway" is a Router (TopoForge files this type as: gateway); stated: IP address "203.0.113.1". [router-gw01]
- "SW1" is a Switch (TopoForge files this type as: access). [switch-sw01]
- "Mail1" is a Server (TopoForge files this type as: server). [server-mai1]
- "Web1" is a Server (TopoForge files this type as: server). [server-web1]
- "PC 1" is a Desktop PC (TopoForge files this type as: endpoint). [desktop-pc01]
- "PC 3" is a Desktop PC (TopoForge files this type as: endpoint). [desktop-pc03]
- "Reception PC" is a Desktop PC (TopoForge files this type as: endpoint). [desktop-pc02]

#### Groups

- "DMZ" is a DMZ group. It holds "Mail1" and "Web1". It is not inside any other group. [dmz-dmz1, server-mai1, server-web1]
- "LAN" is a VLAN group; stated: VLAN "10". It holds "PC 1", "PC 3", "Reception PC" and "SW1". It is not inside any other group. [vlan-lan1, desktop-pc01, desktop-pc03, desktop-pc02, switch-sw01]
- Not inside any group: "FW1" and "Gateway". [firewall-fw01, router-gw01]

#### Connections

- "FW1" connects to "SW1" over Copper / Ethernet at "1G"; labelled "trunk". [link-fwsw, firewall-fw01, switch-sw01]
- "FW1" connects to "Web1"; medium and speed not given. [link-fwwb, firewall-fw01, server-web1]
- "Gateway" connects to "FW1" over Fiber at "1G". [link-gwfw, router-gw01, firewall-fw01]
- "SW1" connects to "PC 1"; medium and speed not given. [link-swp1, switch-sw01, desktop-pc01]
- "SW1" connects to "Reception PC"; medium and speed not given. [link-swp2, switch-sw01, desktop-pc02]
- "SW1" connects to "PC 3"; medium and speed not given. [link-swp3, switch-sw01, desktop-pc03]

## Gaps

### Page 1 "Page-1"

- No medium (NO_MEDIUM): 4 connections have no medium given. [link-fwwb, link-swp1, link-swp2, link-swp3]
- No speed (NO_SPEED): 4 connections have no speed given. [link-fwwb, link-swp1, link-swp2, link-swp3]
- Unlabelled connection (UNLABELED_LINK): 5 connections have no label and no interface names. [link-fwwb, link-gwfw, link-swp1, link-swp2, link-swp3]
- No address (NO_IP): "PC 1", "Reception PC", "PC 3", "Mail1", "Web1" and "SW1" have no address given. [desktop-pc01, desktop-pc02, desktop-pc03, server-mai1, server-web1, switch-sw01]
- No subnet (NO_SUBNET): "DMZ" and "LAN" have no subnet given. [dmz-dmz1, vlan-lan1]
- Maybe a filled-in value (MAYBE_DEFAULT): "PC 1", "PC 3" and "DMZ" may be names TopoForge filled in. [desktop-pc01, desktop-pc03, dmz-dmz1]
- Maybe a filled-in value (MAYBE_DEFAULT): VLAN "10" on "LAN" may be a value TopoForge filled in. [vlan-lan1]
- Not recorded anywhere in this drawing: rules, policies, routes, or which interface faces which group. Treat them as unknown. [page-1]

## Reference table

| ref | page | is a | label | inside |
|---|---|---|---|---|
| desktop-pc01 | 1 | Desktop PC | "PC 1" | vlan-lan1 |
| desktop-pc02 | 1 | Desktop PC | "Reception PC" | vlan-lan1 |
| desktop-pc03 | 1 | Desktop PC | "PC 3" | vlan-lan1 |
| dmz-dmz1 | 1 | DMZ | "DMZ" | — |
| firewall-fw01 | 1 | Firewall | "FW1" | — |
| router-gw01 | 1 | Router | "Gateway" | — |
| server-mai1 | 1 | Server | "Mail1" | dmz-dmz1 |
| server-web1 | 1 | Server | "Web1" | dmz-dmz1 |
| switch-sw01 | 1 | Switch | "SW1" | vlan-lan1 |
| vlan-lan1 | 1 | VLAN | "LAN" | — |
| link-fwsw | 1 | connection | "trunk" | — |
| link-fwwb | 1 | connection | "" | — |
| link-gwfw | 1 | connection | "" | — |
| link-swp1 | 1 | connection | "" | — |
| link-swp2 | 1 | connection | "" | — |
| link-swp3 | 1 | connection | "" | — |

## Changes since last export

- Connection added: "SW1" to "PC 3". [link-swp3]
- "PC 2" renamed "Reception PC". [desktop-pc02]
- New shape "PC 3" (Desktop PC). [desktop-pc03]
- Connection removed: "FW1" to "Mail1". [link-fwml]
- "PC 3" put into "LAN". [desktop-pc03, vlan-lan1]
- "FW1": ip set to "192.168.1.1". [firewall-fw01]
- Maybe a filled-in value (MAYBE_DEFAULT) no longer applies to "Reception PC". [desktop-pc02]
- No address (NO_IP) no longer applies to "FW1". [firewall-fw01]
