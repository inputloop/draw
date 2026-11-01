# ENHANCE 2026-10-31: a subject boundary moves to the nearest sentence end

**Where**: C4 `bin/tr2sm` (the second transcript layer: subjects).

**Seen**: subject 2 ends at 00:01:45 "... of like the idea of read back your words" and subject 3
begins at 00:01:51 "off the card in front of me". One sentence, two subjects; a reader of subject 3
alone loses who reads what back.

**Opening**: when a boundary falls inside a sentence (the line before it does not end in . ? ! and
the next line starts lower-case), move the boundary forward to the next sentence end if it is within
the window (20 s), and say so in the subject's header. A case in `tests/tr-spec.sh` from these two
lines.

**Would show this is wrong**: `tr2sm`'s spec says subjects split by time window on purpose.
