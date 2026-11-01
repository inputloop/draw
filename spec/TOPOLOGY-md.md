# TOPOLOGY.md: how a container describes itself

A container is anything the drawing can hold other things in: a repository, a host, a site, a
folder, a VLAN. It may carry a file at its top named `TOPOLOGY.md`, or `.topology.md` (hidden, for
places where a visible file would be in the way), or both. Topology reads them; nothing else needs
to.

This spec is implemented twice, in Perl (`perl/Topology/lib/Topology/Doc.pm`) and in JavaScript
(`www/js/topology-core.js`), by the same hand but from this page and not from each other. Both are
run against `spec/fixtures/showprivate.json`. If the two disagree, this page decides, and the page
is wrong if it cannot.

## The format

```
---
name: gw26
kind: server             # a TopoForge shape (server, router, site, zone ...) or a word of ours
layer: physical          # abstract | operational | physical  (optional)
private: hide            # this component's own say: show | hide  (optional)
contains: nginx, topology-api
connects: gw7, gw14
---
# gw26

Anything in Markdown. This part is public.

## Private

Lines from here to the next heading at the same level or above are the private part.
```

- Front matter is optional. It opens with a first line that is exactly `---` and closes with the
  next such line; a file whose `---` never closes has no front matter, and all of it is body.
  Each line inside is `key: value`; keys are case-blind; a `#` after the value starts a comment;
  blank lines and `#` lines are skipped. Nothing else (no nesting, no quoting rules): this is not
  YAML, on purpose, so that a 2002-era Perl reader and a shell `sed` can both read it.
- List values (`contains`, `connects`, and any other) are split on commas and semicolons.
- A heading whose text is `Private` (an ATX heading, `#` to `######`, indented up to three spaces,
  closing `#`s allowed; any case) opens the private part. A second `Private` heading inside it
  changes nothing. The next other heading at the same or a higher level closes it. Lines inside a
  fenced code block (``` or ~~~) are never headings. Underlined (setext) headings are not read as
  headings at all: write `## Private`. There can be more than one private part.
- A `TOPOLOGY.md` or `.topology.md` that is a symbolic link is not read.
- Unknown keys are kept and shown; they become columns in the graph (see `design/`).

## Show private

Three settings take part. The first that decides, decides.

1. **Per container, set by the person** (kept in their browser, and sent with each request
   as `c.<row>=show|hide|auto`): `show`, `hide` or `auto`. Unset counts as not deciding.
2. **Global, set by the person** (also kept in the browser, sent as `global=`): `always` (show), `never` (hide) or `auto`. The default is `auto`.
   The global setting is used only when the container has no setting of its own.
3. **The component**, when what is in force is `auto`: the `private:` line of its own
   `TOPOLOGY.md` and `.topology.md`.
   - Neither says: **hide**. ("by: default")
   - One says, or both say the same: that. ("by: component")
   - They disagree: **hide**, and the answer carries a seam naming both files and what each said,
     so the person sees the disagreement instead of a silent choice.

So `auto` on the container falls through to the component and never to the global setting: a
person who set this one container to `auto` asked for what the component says.

A setting that is not one of its words is an error, said in words, never read as a default.

The answer is always three things: show (yes or no), by (container, global, component or
default), and the seam, if any. The app shows "by" beside every private part it keeps back, so a
person can see which setting to change.

## What showing means

Hidden private parts are left out of what the API sends and what the app draws; the app says that
a private part exists and is kept back, and by which setting. It never says what is in it.
A server with `api.private = never` (see `etc/topology.conf`) never sends private parts at all,
whatever a browser asks: that is the operator's floor, and the app says so when it applies.
