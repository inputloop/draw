# How to mod topology paint

There are three levels of modding. Use the lowest one that does what you need:

| Level | You write | You need | It can |
|---|---|---|---|
| 1. Data | `.brush`, `.gpl` text files | a text editor | add and change brushes and palettes |
| 2. Native mod | a `.c` file built as a shared library | a C compiler | add filters, file formats and brush tips |
| 3. Source | changes to `src/` | the build | anything: tools, blend modes, panels |

Mods and data are read from two places:

- **beside the program** (`brushes/`, `palettes/`, `mods/` in the install folder, or inside
  `topology-paint.app/Contents/Resources/` on macOS). These are the ones that ship with it.
- **your user folder** (*Help > Open My Folder*: `%APPDATA%\inputloop\topology-paint\` on Windows,
  `~/.local/share/inputloop/topology-paint/` on Linux,
  `~/Library/Application Support/inputloop/topology-paint/` on macOS). These are yours, and updating
  the program never touches them.

A brush in your folder with the same `name` as a shipped one replaces it. *Edit > Reload Brushes
and Palettes* picks up new files without a restart. Mods load only at start.

---

## 1. Data: brushes and palettes

### A brush file

A `.brush` file is plain text, one `key = value` per line, with `#` starting a comment. Keys you
leave out keep their defaults, and keys the program doesn't know are skipped, so a brush written for
a later version still loads. The easiest way to make one is to set the sliders, then press **Save
brush**. That writes `<your folder>/brushes/<name>.brush`.

```ini
# brushes/Wet Ink.brush
name = Wet Ink
tip = round            # round | square | ring | grain | a tip a mod adds (star)
mode = paint           # paint | erase | smudge
size = 14              # diameter in pixels at full pressure (0.5 .. 2000)
hardness = 0.9         # 0 soft edge .. 1 hard edge
opacity = 1            # the most one stroke can reach (0 .. 1)
flow = 0.6             # how much each dab adds toward that (0 .. 1)
spacing = 0.04         # dab distance as a fraction of the diameter
pressure_size = 1      # how much pressure drives size (0 .. 1)
min_size = 0.05        # size at zero pressure, as a fraction of size
pressure_opacity = 0.3
pressure_flow = 0
roundness = 1          # 1 circle .. 0.05 flat
angle = 0              # degrees
tilt_angle = 0         # 1: the tip turns with the pen's tilt
jitter = 0             # random size change per dab (0 .. 1)
scatter = 0            # random offset per dab, in diameters
smoothing = 0.4        # stabilizer (0 .. 1)
smudge = 0.6           # smudge strength, for mode = smudge
aliased = 0            # 1: hard pixel edges, for pixel art
```

The program clamps values to their ranges, so a typo can't crash it.

**Opacity or flow?** *Opacity* is a ceiling on the whole stroke: going back over the same spot in
one stroke never gets darker than it. *Flow* is how fast each dab climbs toward that ceiling. For a
marker that stays even, use high flow and low opacity. For an airbrush that builds up as you hold
it, use low flow and high opacity.

### A palette

Palettes are GIMP's `.gpl` format, so palettes from GIMP, Krita, Inkscape and Lospec work as they
are:

```
GIMP Palette
Name: My Palette
Columns: 10
#
255   0   0	Red
  0 128 255	Sky
```

Put the file in `palettes/`, then switch palettes with `<` and `>` above the swatches. The panel shows
the first 60 colours.

### Settings

`settings.ini` in your folder is written when the program quits. You can edit it while the program
is closed: `pressure_softness`, `pressure_min`, `pressure_max`, `mouse_pressure`, `jpeg_quality`,
`autosave_minutes` (0 turns autosave off), `fill_tolerance`.

---

## 2. Native mods

A mod is a shared library with **one exported function**:

```c
#include "tpaint_mod.h"
TPAINT_MOD_EXPORT int tpaint_mod_init(const TpHost *host);
```

At start, topology paint loads every `.dll` (Windows), `.so` (Linux) or `.dylib` (macOS) in a `mods/`
folder. It calls `tpaint_mod_init` with a `TpHost`, a table of functions the mod uses to register
what it adds. Return 0 to stay loaded; anything else means the mod is left out, and the status bar
says so. The help sheet (F1) lists the mods that loaded.

The **whole contract** is [`include/tpaint_mod.h`](../include/tpaint_mod.h), about a hundred lines.
A mod includes nothing else from topology paint, so it does not have to be rebuilt when the program
changes.

### What a mod can add

| Register with | A mod gives | Shows up as |
|---|---|---|
| `host->register_filter(&f)` | `name`, `apply(TpImage *img, void *user)` | an item in the **Filter** menu; runs on the active layer and can be undone |
| `host->register_format(&f)` | `name`, `ext`, `save(path, img, user)` and/or `load(path, &img, user)` | a file type in Open, Import and Export |
| `host->register_tip(&t)` | `name`, `coverage(x, y, user)` | a brush tip, chosen with `tip = <name>` in a brush file |

### Walk-through: a "Threshold" filter

**1. Write it** in `mods/threshold/threshold.c`:

```c
#include "tpaint_mod.h"

/* Pixels are straight RGBA, 8 bits each; rows are `stride` bytes apart. */
static int threshold(TpImage *img, void *user) {
    int cut = *(const int *)user;
    for (int y = 0; y < img->h; y++) {
        uint8_t *p = img->px + (size_t)y * img->stride;
        for (int x = 0; x < img->w; x++, p += 4) {
            int g = (p[0] * 54 + p[1] * 183 + p[2] * 19) >> 8;   /* luminance */
            p[0] = p[1] = p[2] = g >= cut ? 255 : 0;
        }
    }
    return 0;                       /* non-zero cancels: the layer is left as it was */
}

static const int MID = 128;
static const TpFilter THRESHOLD = { "Threshold", threshold, (void *)&MID };

TPAINT_MOD_EXPORT int tpaint_mod_init(const TpHost *host) {
    if (host->api_version < 1) return 1;          /* too old a host for us */
    host->log("threshold: ready");
    return host->register_filter(&THRESHOLD);
}
```

**2. Build it.** You only need the header, not the rest of the program:

```bash
# Linux
cc -O2 -shared -fPIC -I paint/include -o threshold.so mods/threshold/threshold.c
# macOS
cc -O2 -shared -fPIC -I paint/include -o threshold.dylib mods/threshold/threshold.c
```

```bat
:: Windows, in a "Developer Command Prompt for VS"
cl /O2 /LD /I paint\include mods\threshold\threshold.c /Fe:threshold.dll
:: or with MinGW
gcc -O2 -shared -I paint/include -o threshold.dll mods/threshold/threshold.c
```

You can also build it along with the program: copy one of the `add_library(... MODULE ...)` blocks
in `CMakeLists.txt` (the `MODS` list), and `build.bat` or `build.sh` builds it every time.

**3. Install it:** put the library in `mods/` in your folder (*Help > Open My Folder*) and restart.
*Filter > Threshold* is there.

### The rules that keep a mod working

- **Check `host->api_version`.** The host only ever *adds* fields to the end of `TpHost`, so a mod
  written for version 1 keeps working with later hosts. If you need something added in a later
  version, check for that version and return non-zero if the host is older.
- **Keep what you register alive.** `TpFilter`, `TpFormat` and `TpTip` structs, and their strings,
  must outlive the library. Make them `static const`, as above. The program never unloads a mod.
- **Pixels are straight RGBA8.** Inside, layers are premultiplied; the host converts at the boundary,
  so a mod never sees premultiplied values.
- **Memory you hand over comes from `host->alloc`.** A format's `load` fills `out->px` with
  `host->alloc(w*h*4)` and sets `w`, `h` and `stride`. Free what the host gave you with `host->free`.
- **Do files through the host.** Use `host->read_file` and `host->write_file`, not `fopen`. Paths are
  UTF-8. On Windows, `fopen` does not take UTF-8 (a user named Zoë could not save), and a `FILE*` must
  never pass from the program's C runtime to the mod's, because they may be different ones.
  `mods/pgm-export` shows the pattern: build the file in memory, then hand it to `write_file`.
- **Tips are called many times per dab.** `coverage(x, y)` gets `x` and `y` in −1…1 across the dab
  and returns 0…1. Keep it cheap: no allocation and no I/O. Edge softness is up to you; `star-tip`
  ramps its edge over a few hundredths so it anti-aliases.
- **A format registered later wins.** A mod can replace a built-in format by registering the same
  extension. When saving, the program uses the last registered format that can save that extension.
- **Name things for people.** The filter name is what appears in the menu. Log one line at start;
  log failures with the reason.

### The examples

| | Shows |
|---|---|
| [`mods/posterize`](../mods/posterize/posterize.c) | two filters from one function, told apart by `user` |
| [`mods/pgm-export`](../mods/pgm-export/pgm_export.c) | a format that saves and loads, with whole-file host I/O |
| [`mods/star-tip`](../mods/star-tip/star_tip.c) | a brush tip; `brushes/Star Stamp.brush` uses it |

### Debugging a mod

- Start the program from a terminal: everything it logs goes to stderr with a `topology-paint:`
  prefix, including why a mod did not load (`no tpaint_mod_init`, the loader's own error, or the
  code your init returned).
- On Linux and macOS, `nm -D threshold.so | grep tpaint_mod_init` (or `nm -gU` on macOS) shows
  whether the symbol is exported. On Windows, `dumpbin /exports threshold.dll` does the same.
  `TPAINT_MOD_EXPORT` does the exporting.
- The core can be tested without a window: `paint/tests/test_core.c` loads the example mods and
  checks what they do. Copy its `test_mods` pattern to test yours.

---

## 3. The source

The **core** (`src/core/`) has no SDL in it and builds with any C compiler. That makes changes easy
to test (`sh paint/tests/run.sh`), and it means another front end could use the core too.

| To add | Change |
|---|---|
| a built-in **file format** | write `load_x(const uint8_t *data, size_t n, ...)` and/or `save_x(const TpDoc *, path, ...)` in `formats.c`; call `add_builtin("Name", "ext", layered, can_load, save_x)` in `tp_formats_init`; recognise its magic bytes in `load_by_magic`; add a round trip to `test_formats` |
| a **blend mode** | add it before `TP_BLEND_COUNT` in `tpaint.h`; give it a name, an ORA op and a PSD key in `BLENDS` (`doc.c`); write its formula in `blend_ch` |
| a **built-in filter** | a function `int f(TpImage *, void *)` in `mods.c`, and one `add_filter("Name", f, NULL)` in `tp_core_init` |
| a **brush setting** | a field in `TpBrush`, its line in `tp_brush_parse` and `tp_brush_save`, its use in `dab()` (`brush.c`), a slider in `brush_panel` (`panels.c`) |
| a **tool** | a `TOOL_` in `app.h`; its key in `on_key`; what a click does in `canvas_down` / `canvas_move` (`main.c`); its button comes from `tool_name` |
| a **menu item** | an `ACT_` in `app.h`; a line in the right `M_*` table (`panels.c`); what it does in `app_action` (`main.c`) |
| a **panel** | a function in `panels.c` that draws with `ui_*` calls, called from `panels_draw`. The UI is immediate mode: widgets draw and report clicks in one call, with no state to keep |

Before sending a change: run `sh paint/tests/run.sh` and `sh paint/tests/run.sh --prove-red`. For a
new promise, add a check, and if the check could pass by accident, add a planted fault under
`#ifdef TP_PLANT_FAULT` that it must catch. Inside topology, `sh bin/test.sh` runs both.
