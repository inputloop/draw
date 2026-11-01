# Starting your own topology

Several versions of this project are being made from the same conversations: Bryant's, this one
(the `corwin` branch), perhaps Bridget's, perhaps yours. The point is to compare later how different
setups, people and tools do with the same request. This page is for anyone who wants to make one,
including us, later, when we will be "others" too.

## What to start from

1. **The request**, word for word: `PROMPT-2026-10-31-topology-corwin.md`. Use it as it is, change
   it, or write your own; say which in your branch.
2. **What we read beside it**: `SOURCES.md`. You may have more (your own notes from the talks) or
   less. Write down what you had: that is the variable a comparison needs.
3. **The one recording we have of the talks**, and a critical reading of it:
   `REVIEW-2026-10-31-topography-transcript.md`. The transcript itself is in Corwin's C4 tree and in
   Bridget's family parcel of 2026-10-31.

## How to make your branch

```
git clone https://github.com/inputloop/topology.git
cd topology
git switch --orphan YOURNAME          # start empty, as we did
mkdir context && cp ../PROMPT-....md context/   # keep your starting request, verbatim
```

Start from nothing (an orphan branch) if you want the comparison to be fair; start from `corwin` if
you want to build on it. Either is fine; say which.

## What makes branches comparable later

A short list, so nobody has to guess:

- `context/PROMPT-*.md`: the request, verbatim, with the date and who sent it.
- `context/SOURCES.md`: what was read, with a hash or a date for each, and what was *not* available.
- The tools and models used, in one line each (ours: Claude in Corwin's Cowork setup, with the
  vibrobeast skills; perl 5.44.0; node 22; Chromium through Playwright for the browser test).
- The tests you can run, and what they say (ours: `sh bin/test.sh`).
- What is not built, said plainly (ours: `design/DESIGN-2026-10-31-topology.md`, last section).

## Questions worth asking of every version

- Which objectives did it take on, and which did it leave? Was that said?
- Where did it put the choices: with the person, the operator, or the build?
- What did it do with Bridget's three acts (describe, propose, effect)?
- Could someone who was not in the talks rebuild it from what is in the branch?
