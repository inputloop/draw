# REVIEW 2026-10-31: the "topography" recording with Bridget, read critically

What was reviewed: C4's three-layer take of the 2 min 44 s recording of 2026-10-31 01:34:15
(`/f/claude/c4/d/transcripts/2026-10-31-topography/`, commit `5c4ae672`, which also went to
Bridget in her family parcel). Reader's stance: someone about to build from what was said. Verdict:
the transcript is faithful enough to build from; the third layer's cue readings mostly fire on
greetings and on the word "but", and four small gaps are worth fixing (ENHANCE items below).

Two piles throughout: OBSERVED quotes the file and line; JUDGED says it is my reading.

## What it gives this branch

OBSERVED (`q1/.../QUOTES.md`, 00:01:51 to 00:02:28):

> "what you see is what you get is the main one, right? And the idea that as we're giving
> instructions into Topo Forge if I'm putting shapes on the page or if I'm typing. Either way I'm
> describing something I want to have be buildable and explaining that in terms of the composable
> shapes that I'm steering on this page. If that's an existing thing I'm proposing a change to it
> asking for a prompt to do it or literally affecting that change if I press go and I have tools
> that can implement the change for me."

JUDGED: this is the clearest requirement in the recording, and it fits the prompt's first question.
It names three levels of the same act on a drawing: **describe** (shapes or typed words), **propose**
(a change to something that exists, or a prompt for it), **effect** (press go, if tools are present).
This branch takes those three as the app's control ladder: every drawing can be read as a
description; a drawing over an existing topology is a proposal (a diff the API can show); "go" is
offered only where the server's feature level allows writes (`write` in `etc/topology.conf`), and
otherwise the same button says what it would do and offers the prompt instead. See
`design/DESIGN-2026-10-31-topology.md`, section "Describe, propose, effect".

## What the layers got right

- Layer 1 marks itself as machine transcription with no speakers, and says to check the recording
  before quoting anyone. That warning is earned: nothing in the lines says who says what.
- Layer 3 already caught the one place two readers part (the README: qwen3:8b reads subject 2 as
  Bridget offering to work; the lines say she is the one invited). That is the dual-reader check
  doing its job.
- Every line is in exactly one subject and is linked back (`s2/LINKS.tsv`), and `tr3rm check`
  reports 80 citations, 0 faults.

## What is weak, with the check that would show I am wrong

1. **The cue readings fire on discourse words.** OBSERVED (`s2/RESULT.md`): SEAMs at "But welcome."
   (00:00:21) and "but I didn't get up until like seven." (00:00:43) and "but that's okay."
   (00:00:59); SEMAPHOREs at four greetings ("Bridget, should we meet?", "How are you doing?").
   JUDGED: none of these is a place where two readings of one truth split. The only line that reads
   as a real open question, "existing thing I'm proposing a change to it asking for a prompt to do
   it or" (00:02:17), is the one SEMAPHORE that matters. Falsifier: Corwin or Bridget points at one
   of the greeting lines and names the gate it signals.
2. **A subject boundary cuts a sentence.** OBSERVED: subject 2 ends at 00:01:45 "... of like the idea
   of read back your words" and subject 3 opens at 00:01:51 "off the card in front of me". JUDGED:
   "read back your words off the card in front of me" is one sentence split across two subjects, so
   a reader of subject 3 alone loses who is reading what. Falsifier: `tr2sm` documents that
   subjects may split sentences by design (window 20 s).
3. **The clock is not said.** OBSERVED: "wall clock at 00:00:00: 2026-10-31 01:34:15 (read from the
   file name)" and, in the talk, "Oh boy, work at 1130 at night" (00:01:07). JUDGED: the file-name
   clock and the spoken clock differ by about two hours, which fits two people in two time zones
   (or a recorder clock in another zone). The header should say which zone the file name is in, so a
   later reader does not "correct" either. I make no claim about where anyone is. Falsifier: the
   recorder's settings show the file name is local time at a known place and the "1130" was loose
   talk.
4. **Things named and not linked.** OBSERVED: "I had a half filled card about it somewhere in front
   of me. A lens we started to draw and then never got as far as applying back" (00:01:18 to
   00:01:28). JUDGED: the card and the lens are the real inputs of this talk and the transcript does
   not say where they are. Falsifier: a search of C4 for that card finds it already linked from the
   transcript's README.
5. **"topo cord"** (00:01:14) is kept as heard, correctly. JUDGED: it may be "topo card" (the card
   just named) or "TopoForge". The transcript is right not to guess; a note beside it saying which
   readings are possible would help a reader who was not there.

## Openings (ENHANCE)

Each is filed as its own page in this folder so it can be taken up alone.

- `ENHANCE-2026-10-31-cue-stoplist.md` — cue readings skip discourse markers and greetings, with a
  prove-red fixture made from this very recording (items 1).
- `ENHANCE-2026-10-31-sentence-continuity.md` — a subject boundary moves to the nearest sentence end
  when one is within the window (item 2).
- `ENHANCE-2026-10-31-clock-and-links.md` — the header carries the zone of the file-name clock, and
  a "named but not linked" list for things the talk points at (cards, lenses, files) (items 3-5).
- The talk itself is an opening for this branch: Bridget's three levels (describe, propose, effect)
  are now the control ladder of the app, and her card, once found, belongs in `context/` beside
  this review. **Say to her**: the branch quotes her lines at 00:01:51 to 00:02:28 as the source of
  that ladder, so she can say whether it is what she meant.
