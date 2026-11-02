/* SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
 *
 * tpaint_mod.h -- the whole contract between topology paint and a mod.
 *
 * A mod is a shared library (.dll on Windows, .so on Linux, .dylib on
 * macOS) placed in a "mods" folder.  topology paint loads every library it
 * finds there at start, looks up one symbol, tpaint_mod_init, and calls it
 * with a TpHost.  The mod registers what it adds through the host and
 * returns 0.  That is all: there is no other entry point and no other
 * header.  See docs/MODDING.md for a walk-through.
 *
 * Rules that keep a mod working across versions:
 *  - Check host->api_version >= the version you were written for; the
 *    host only ever adds fields at the end of TpHost, never moves them.
 *  - Strings and structs you pass to register_* must stay alive as long
 *    as the library is loaded (string literals and static structs do).
 *  - Pixels handed to a mod are straight (not premultiplied) RGBA, 8 bits
 *    per channel, rows top to bottom, `stride` bytes apart.
 *  - Memory a loader returns must come from host->alloc.
 *  - Paths are UTF-8.  Do files through host->read_file / host->write_file,
 *    not fopen: on Windows fopen does not take UTF-8, and a FILE* must not
 *    cross from one C runtime (the program's) to another (a mod's).
 */
#ifndef TPAINT_MOD_H
#define TPAINT_MOD_H

#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

#define TPAINT_MOD_API_VERSION 1

#if defined(_WIN32)
#  define TPAINT_MOD_EXPORT __declspec(dllexport)
#else
#  define TPAINT_MOD_EXPORT __attribute__((visibility("default")))
#endif

/* An image: straight RGBA8. */
typedef struct TpImage {
    int w, h;
    int stride;          /* bytes from one row to the next (>= w*4) */
    uint8_t *px;
} TpImage;

/* A filter changes the pixels of the active layer (or its selection-free
 * whole) in place.  Return 0 on success; anything else cancels the change. */
typedef struct TpFilter {
    const char *name;                              /* shown in the Filter menu */
    int (*apply)(TpImage *img, void *user);
    void *user;
} TpFilter;

/* A file format.  Either function may be NULL (import-only or export-only).
 * Export receives the flattened picture; import fills *out, allocating
 * out->px with host->alloc (stride = w*4).  Return 0 on success. */
typedef struct TpFormat {
    const char *name;                              /* "Portable Graymap" */
    const char *ext;                               /* "pgm", no dot, lower case */
    int (*save)(const char *path, const TpImage *img, void *user);
    int (*load)(const char *path, TpImage *out, void *user);
    void *user;
} TpFormat;

/* A brush tip: coverage 0..1 at (x, y), both in -1..1 across the dab.
 * Called many times per dab, so keep it cheap.  A brush file picks it
 * with  tip = <name>. */
typedef struct TpTip {
    const char *name;
    float (*coverage)(float x, float y, void *user);
    void *user;
} TpTip;

typedef struct TpHost {
    int api_version;                               /* TPAINT_MOD_API_VERSION of the host */
    const char *app_version;                       /* "1.0.0" */
    void (*log)(const char *msg);                  /* shown in the status bar and on stderr */
    int (*register_filter)(const TpFilter *f);     /* 0 ok, -1 full or bad */
    int (*register_format)(const TpFormat *f);
    int (*register_tip)(const TpTip *t);
    void *(*alloc)(size_t n);
    void (*free)(void *p);
    /* whole-file I/O on UTF-8 paths; read_file's buffer is freed with host->free */
    void *(*read_file)(const char *path, size_t *n);
    int (*write_file)(const char *path, const void *data, size_t n);  /* 0 ok */
} TpHost;

/* The one symbol a mod exports. */
typedef int (*TpModInitFn)(const TpHost *host);
#define TPAINT_MOD_INIT_SYMBOL "tpaint_mod_init"

#ifdef __cplusplus
}
#endif
#endif
