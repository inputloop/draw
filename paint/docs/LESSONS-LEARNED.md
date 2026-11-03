# Lessons learned making topology paint

This is what went wrong, what nearly went wrong, and what turned out to matter, in the order it came
up. It closes with what the program does not do yet. If you are changing the program, read *Traps*
first.

## How it was checked, and what that cannot tell you

| Checked | How |
|---|---|
| The core: layers, blending, brushes, undo, fill, every file format, mods | 77 checks in `tests/test_core.c`, on Linux (gcc) and as a Windows `.exe` (MinGW, run under Wine) |
| That the checks can fail | `--prove-red` builds with planted faults: a PSD writer that swaps red and blue, a pressure curve that ignores softness |
| Our files read by other code | stb_image reads our PSD's merged picture; Python's `zipfile` tests our OpenRaster archive |
| The program starts and draws | `--screenshot` renders a scripted painting, on Linux and on the Windows `.exe` under Wine. Both renders came out **byte-identical** |
| Mouse, keys, menus, undo, fill, the unsaved-work prompt | the real program under Xvfb, driven by `xdotool`, with screen grabs |
| MSVC and macOS builds | GitHub Actions (`.github/workflows/paint.yml`); there is no Mac or Visual Studio in the build container |

**Not checked by a machine: a real pen.** The pressure path follows SDL3's pen API exactly
(`SDL_EVENT_PEN_AXIS` for pressure and tilt, `SDL_EVENT_PEN_DOWN/MOTION/UP` for contact), and the
engine's response to pressure is tested. But no tablet was attached while it was written. The first
time an XP-Pen Artist 13.3 Pro V2 touches it, look at the **Pen pressure** box. *Pen: found* and a dot
that follows your pressure mean the whole path works. If it says *Pen: none yet* while you draw,
see *Pen input* below.

## Traps (each of these cost time once)

### A name the Windows headers already use

The version macro was first called `TP_VERSION`. `<windows.h>` already has a `TP_VERSION` (a thread-pool
type in `winnt.h`), so on Windows the build broke inside a system header, with an error that
pointed nowhere near our code. Linux never showed it. **Prefix everything with the project's whole
name** (`TPAINT_`), and **cross-compile for Windows early**. A MinGW build from Linux takes a minute
and catches these.

### Windows paths are not UTF-8

SDL's file dialogs return UTF-8. On Windows, `fopen` reads its argument in the ANSI code page, so any
path with a non-ASCII letter fails: a user called *Zoë* could not save to their own Documents folder.
The fix is one function, `tp_fopen`: convert to UTF-16 and call `_wfopen`. Use it for every file the
core touches, `FindFirstFileW` for listing folders and `LoadLibraryW` for mods. stb has switches for
the same thing (`STBI_WINDOWS_UTF8`, `STBIW_WINDOWS_UTF8`). The test saves and opens files in a folder
named `Ünï 画`, so this stays fixed.

Two false alarms came up while testing it. Both are worth knowing:

- A Windows `main(argc, argv)` receives ANSI arguments too. The **test** has to rebuild `argv` from
  `GetCommandLineW()`, or it fails for its own reasons. (The program doesn't have this problem:
  SDL's `SDL_main` already hands it UTF-8.)
- **Wine mangles non-ASCII arguments** unless the Linux side runs in a UTF-8 locale (`LANG=C.UTF-8`).
  The garbled path came from Wine, not from us.

### A `FILE*` must not cross into a DLL

The first `pgm-export` example called `fopen` and `fprintf` itself. That breaks in two ways. It has the
UTF-8 problem above. And on Windows, if the program and a mod are linked against different C runtimes
(say a static MSVC runtime and MinGW's `msvcrt`), a `FILE*` or a `malloc`'d pointer from one is not
valid in the other. So the mod API gives mods `read_file` and `write_file`, and says that memory
passing across must come from `host->alloc` and go back through `host->free`. **A plug-in boundary
should pass bytes and lengths, never the C library's own objects.**

### Batch files

- `"C:\Program Files (x86)\..."` inside an `if (...)` block ends the block at the `)` in `(x86)`.
  The Visual Studio Build Tools install there, so the path is common. `build.bat` uses delayed
  expansion (`!VAR!`) and `goto` instead of large blocks.
- A `.bat` with LF line ends can make `goto` and `call :label` miss. `paint/.gitattributes` sets
  `*.bat eol=crlf`.
- Wine's `cmd.exe` is not Windows's: its `where` reports success for anything, and `echo(` doesn't
  work. It is good for a smoke test of the parsing, not as proof. A real Windows runner (Actions) is.

### SDL builds without things, silently

SDL's CMake turns off any back end whose headers it can't find, and keeps going. Without `libxi-dev`,
the build succeeds and the program runs, but on X11 **the pen is just a mouse with no pressure**.
Without D-Bus headers, file dialogs need `zenity` at run time; without the Wayland headers, it runs
through XWayland. `build.sh` now checks for each with `pkg-config` and says what each missing one
costs. The program also copes when no dialog can open at all: *Save* writes to the Pictures folder,
and opening falls back to drag-and-drop.

## Pen input

- **Turn off SDL's pen-to-mouse events** (`SDL_HINT_PEN_MOUSE_EVENTS = "0"`, and the touch one). If
  they stay on, every pen stroke also arrives as a mouse drag, and you paint each stroke twice, once
  without pressure. The mouse handler also ignores events whose `which` is `SDL_PEN_MOUSEID`, in case
  a driver sends them anyway.
- **Pressure is its own event.** `SDL_EVENT_PEN_AXIS` carries pressure and tilt separately from
  motion. Keep the latest value and use it at the next motion. The first touch can arrive before
  any pressure value, so a stroke starts at its thinnest and grows, which is also the natural taper.
- **People need to see the pressure.** The live *in / out* readout and the curve with a moving dot
  answer "is my tablet working?" in a second. On Windows, the usual answer is "tick *Windows Ink* in
  the XP-Pen driver". Without it, the driver offers only WinTab, which SDL does not read.
- **Pressure curves are personal.** Softness is one exponent (from 4 down to 1/4), plus a dead zone
  and a full-pressure point. Those three settings cover the common complaints (*too thin*, *ghost
  marks while hovering*, *can't reach full width*) without a curve editor.
- **Express keys are keyboard shortcuts.** Tablet drivers turn the keys and the dial into keystrokes,
  so the important thing is a full set of single-key shortcuts, not tablet-specific code.

## Painting

- **Opacity and flow need a stroke mask.** Stamping each dab straight onto the layer means a stroke
  gets darker wherever it overlaps itself, and a 50%-opacity marker comes out blotchy. Instead, the
  engine keeps a 16-bit coverage mask per stroke. Each dab raises the mask toward the dab's opacity by
  `flow`, and the layer is recomputed from how it looked when the stroke began. Painters expect this
  from every major program.
- **Premultiplied alpha inside, straight alpha at the edges.** Compositing, blur and smudge are
  correct only on premultiplied values; otherwise you get dark fringes where colour meets
  transparency. Files and mods expect straight alpha. Converting at the boundary costs ±1 in a
  channel on round trips, so the tests allow 1.
- **Thin lines fade instead of vanishing.** A dab narrower than a pixel keeps a 1-pixel footprint
  with proportionally less opacity. Without that, light-pressure strokes break into dots.
- **The stabilizer lags, so finish the line.** An exponential pull toward the pen smooths a stroke,
  but it stops short of where the pen lifted. At pen-up, the stroke is drawn on to the pen's real
  last position.
- **Fill under the line.** A bucket fill stops at the anti-aliased edge of an ink line and leaves a
  pale halo. Growing the filled area by one pixel puts the fill under the line's soft edge, which
  is what artists expect from *fill to line art*.

## Structure

- **Keep the core free of the window library.** `src/core/` has no SDL in it, so 77 checks build with
  `cc` in a second, run inside topology's own `bin/test.sh` with no network, and run on Windows
  under Wine with no display. Nearly every bug found here was found through the core.
- **Copy-on-write layer buffers** make undo cheap. A layer-panel step (add, delete, reorder, blend
  mode) saves the list of layers, which point at shared, reference-counted pixel buffers. Only
  painting copies a buffer, and only when it is shared. Brush strokes save just the changed rectangle,
  and undoing swaps it back, so an undo step becomes its own redo step.
- **An immediate-mode UI drawn in software** is small and looks the same everywhere: under 200 lines,
  with no toolkit to install. The cost is that the UI is drawn at the system's point size and
  scaled: at a fractional scale such as 125% (common on a 13" 1080p display), the panels are
  slightly soft. The canvas itself is always drawn at full device resolution.
- **A `--screenshot` mode pays for itself.** It paints a scripted scene, draws one frame and saves
  it. That gives README pictures that never go stale, a start-up smoke test, and the proof that the
  Windows build draws the same as the Linux one.

## Testing

- **A writer's own reader can share its mistakes.** If the PSD writer swaps red and blue and the PSD
  reader swaps them back, a round trip passes. So an independent reader checks each format we write
  (stb_image for PSD, Python's `zipfile` for the OpenRaster zip), and a planted fault proves the
  round trip would catch the swap.
- **Plant the fault that the test is for.** `--prove-red` builds with `TP_PLANT_FAULT`, and
  `bin/test.sh` fails unless the tests go red. A check that has never failed has not shown it can.
- **Test the guide.** The *Threshold* walk-through in MODDING.md was compiled exactly as printed
  and loaded into the program before it was published.

## Not done yet (honest limits)

- **Selections and transforms** (lasso, marquee, move or scale a selection). This is the largest
  gap for daily painting.
- **Text, shapes, gradients, and layer groups.** PSD and ORA groups are flattened into plain layers
  when read.
- **Formats:** PSD is 8-bit RGB only (no 16-bit, CMYK, adjustment layers or masks). TIFF reads only
  uncompressed or PackBits. No WebP, AVIF, HEIC or Krita `.kra` (ORA is the exchange format). GIF
  reads the first frame only.
- **The canvas is limited by the graphics card's largest texture** (commonly 16384 a side). There is
  no tiling yet.
- **Zoomed far out, fine detail shimmers.** The GPU scales the canvas without mipmaps. A half-size
  copy for zooms below 50% would fix it.
- **One drawing at a time.** No tabs and no recent-files list.
- **Mods can't add tools or panels.** They can add filters, formats and tips. Tools need an input
  API, and that is the next version of `tpaint_mod.h`.
- **Builds aren't signed.** macOS asks for right-click > *Open* the first time, and Windows
  SmartScreen may warn about an unknown publisher.
