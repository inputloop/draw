# LENS 2026-10-31: the two questions, ground to a monticule

Form: LENS (does his hypothesis bear out when looked at through one deliberately chosen way of
seeing), run as a grinder: the four views of the LENS, then the persona and its inverse, then each
point restated from principles, and what falls out collected as a small heap of questions and
answers (a monticule) that the app now carries. Every answer below names the file in this branch
where it is built, or says that it is not built.

## His hypothesis, verbatim

> How can we use the neat design interfaces in topo forge in ways that let people select UI/UX
> treaments, BPMn (or my BPMn+) notations, basic flow-charts and logics design, and the topology
> that represents defining abstractly or in some for/as operational design, also physical aspects?
>
> How can the front-door page (and supporting debian package and source distribution and other
> materials we show on our site) best both put this capability (each user of it) at the center of
> the universe and also (say it without saying it) showcase our methods and hopes for ways people
> can grow together by them?

With the rule for both: "taking all due haste toward openings for freedom and access and
simplicity and options for effecting both display and control; take risk and selection of
mitigation (options for users before enforced choices by us at build time before hard codes ways
to work ...)".

## The four views

- **a. mine.** TopoForge already has what most of question 1 needs: thirty-odd device shapes,
  seven containers, seven basic shapes (diamond, parallelogram, ellipse...), layers, pages, a
  story, and a CSV door (`?load=`, `importCSV`). What it lacks is a way to say *what a shape
  means* that is chosen by the person and not baked into the shape. That is a notation, and a
  notation is data, not code.
- **b. ascribed to Corwin** (from his words in the prompt, and his 2026-10-27 prompt on merge and
  literate shape): choices belong to the person, made late, reversible, and visible; we ship
  options before guards and guards before hard code; the site should undersell us and sell the
  opening.
- **b. ascribed to Bryant** (invented wording: I have none of his words on topology yet): TopoForge
  is his, and anything that changes how it behaves is a proposal to him, not an edit.
- **b. ascribed to Bridget** (her words, 00:01:51 to 00:02:28): what you see is what you get;
  shapes or typing describe something buildable; over an existing thing it is a proposal or a
  prompt; go makes it.
- **c. their pull on mine.** Bryant's ownership kept every answer outside TopoForge's file: the
  notation, the treatment and the act ladder all live in our host page and in data TopoForge
  already accepts (CSV extra columns become a shape's data). Bridget's three acts turned an
  abstract "control" into three buttons.
- **d. my pull on theirs.** I chose four pillars and named them; a person reading the summary tree
  reads my words for their changes. The words are in one data file so anyone can replace them.

## Persona, then its inverse

The persona of the shop (freedom first, show the strings, no ceremony) would put everything on one
page: every option visible, every tension named. Its inverse, a newcomer who wants to draw a home
network in five minutes, wants one button. Both land on the same shape: two ways in on the front
door and nothing else unfolded; every option one click deeper, with the default chosen to be the
one that shares nothing and changes nothing. The inverse found one thing the persona missed: the
upgrade wizard must let you leave ("Not now") without losing anything, and the app must still work
when you do. It does (fresh settings, nothing saved, said in the status line).

## Question 1: treatments, notations, flowcharts and logic, layers

Ground into the questions it holds, each answered.

1. **Where does a choice of look live?** In the browser, per person: `treatment` in the settings
   (classic, console, cards), one CSS file with three blocks (`www/css/topology.css`). TopoForge's
   own light/dark stays its own. Built.
2. **Where does a notation live?** As data: `NOTATIONS` in `www/js/topology-core.js` maps each
   element (event, task, gateway, decision, lane...) to a TopoForge shape. Choosing a notation
   changes the names and the checks, never the drawing, so one drawing can be read as topology
   one minute and BPMN the next. Built for the mapping; the palette relabelling inside TopoForge is
   **not built** (it needs Bryant's say, see 6).
3. **What is BPMN+?** BPMN plus the act axis: `describe`, `propose`, `effect`, and `go` as a shape
   a person owns (a lane is a person; go only a person takes). It is in `NOTATIONS.bpmnplus` and in
   the taxonomy's act axis. Corwin's own BPMN+ may hold more; this is the slot for it.
4. **Flowcharts and logic?** The flowchart notation (start, step, decision, io, end) uses the
   basic shapes TopoForge already has. Logic gates would be a further notation in the same table,
   not a new mechanism.
5. **Abstract, operational, physical?** The layer axis. A `TOPOLOGY.md` says `layer:`; the CSV
   carries it as an extra column TopoForge keeps as data; the app can filter by it. TopoForge's
   own layers (visibility groups) can hold one each. Carried; the filter UI is **not built**.
6. **How do we change TopoForge without taking it from Bryant?** We do not change it. We host it:
   our page sets `window.TopoForge.integration` (the object proposed for him on 2026-10-27:
   `name`, `ancestorFor`, `save`), feeds it CSV, and reads its story. A TopoForge that reads the
   integration object will find a host already there. Built on our side; his side is his.
7. **How does a person go from drawing to change?** The three acts as three buttons: Draw (describe,
   from a graph or by hand), Copy as a prompt (propose, to any tool the person trusts), Go (effect,
   only where a server has `write` on, which is off by default). Built; Go answers with what it
   would have done and offers the prompt instead.

## Question 2: the front door at the person's centre, our methods shown and not said

1. **Who is the subject of the first sentence?** The person: "Your systems, drawn by you." The
   project's name is the masthead and nothing more; no names of people on the page.
2. **What can they do in one click?** Two things: start with nothing shared, or connect an API.
   Both are verbs. Everything else is behind a disclosure.
3. **How do we show "you own this" without saying it?** By what the page lets you do: export
   everything, before and after any upgrade; switch every feature off, down to just these files;
   bring your own API; choose your own look and notation; and read the source of every page one
   click away.
4. **How do we show the methods?** By shipping them as things a person uses, not as claims:
   - the recipe is a link in the masthead, and it rebuilds everything including the page you are on;
   - the ladder (spa, web, api, repos, write) is a table, and it is the actual config file;
   - "Make it yours" links to this branch's starting request, kept word for word with its sources,
     so anyone can begin from the same place (`context/FOR-OTHERS.md`);
   - the four questions (where, what, how, who) are in the first paragraph, and the taxonomy behind
     them is one file anyone can edit.
5. **How do the packages carry the same message?** The smallest package (`topology-www`) is the
   whole app as files; the perl package carries its own CPAN sources and says who maintains each;
   the source package carries the recipe that built it. Each package can be taken alone.
6. **How do people grow together by it?** Several branches of one repository (Bryant's, Bridget's,
   ours, a stranger's), each starting from the same kept request, compared later. The front door
   says "start your own" in the place a project usually says "contribute".

## Restated from principles

In the order the shop decides by: (1) universalism and egalitarianism: the default way in costs
nothing and shares nothing, and needs no account; (2) the four freedoms: every page's source is one
click away and the recipe rebuilds the rest (freedom 1, to study; freedom 3, to share changes);
(3) the software-freedom movement: GPL or LGPL by choice, a source package that carries its own
perl; (4) the wider technical community: Debian's own forms (control, copyright, systemd units that
skip, not fail), CPAN's toolchain, h2xs's shape.

## Risks, and who carries each

| risk | first: an option for the person | then: a guard we ship | hard-coded? |
|---|---|---|---|
| a private part leaves a server | per-container and global show-private; auto hides when unsaid | `api.private = never` is the default floor: nothing private leaves until an operator sets `auto` (show-private is the asker's preference, and anyone who can reach the API can ask); two files that disagree hide, and say so; links are not followed | no |
| a token is read by others | the operator chooses the file and mode | `credentials.strict` refuses a token others can read; on by default, can be switched off | no |
| a secret lands in a log or a process list | (none needed) | tokens go through GIT_ASKPASS; no secret on a command line or in an error message (a test plants one) | yes: there is no setting that puts a token on a command line |
| a world-readable ssh key | (none needed) | none of ours: ssh itself refuses it; we let it | n/a |
| go changes something | go is off; the person can always copy the prompt instead | `write` must be switched on by the operator, under the ceiling | no |
| an upgrade loses settings | export before, export after, "Not now" | nothing changes before ACCEPT (a browser test checks) | no |
