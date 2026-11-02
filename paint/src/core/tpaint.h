/* SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
 *
 * tpaint.h -- the core of topology paint: documents and layers, the brush
 * engine, undo, file formats and the mod registry.  Nothing here knows
 * about windows, SDL or the screen, so the tests build it with any C
 * compiler (tests/run.sh) and a mod or another front end could reuse it.
 *
 * Pixels inside a layer are premultiplied RGBA8 (r,g,b already multiplied
 * by a), which makes compositing, blur and smudge exact and cheap.  At every
 * edge (files, mods, the colour picker) they are straight RGBA8.
 */
#ifndef TPAINT_H
#define TPAINT_H

#include <stdint.h>
#include <stddef.h>
#include "tpaint_mod.h"

#define TPAINT_VERSION "1.0.0"
#define TP_MAX_LAYERS 256
#define TP_MAX_SIDE 16384
#define TP_NAME_MAX 64

/* ---- blend modes (the order is the order of the Layer menu) ---- */
typedef enum {
    TP_BLEND_NORMAL, TP_BLEND_MULTIPLY, TP_BLEND_SCREEN, TP_BLEND_OVERLAY,
    TP_BLEND_DARKEN, TP_BLEND_LIGHTEN, TP_BLEND_ADD, TP_BLEND_SUBTRACT,
    TP_BLEND_DIFFERENCE, TP_BLEND_COLOR_DODGE, TP_BLEND_COLOR_BURN,
    TP_BLEND_HARD_LIGHT, TP_BLEND_SOFT_LIGHT,
    TP_BLEND_COUNT
} TpBlend;
const char *tp_blend_name(TpBlend b);       /* "Multiply" */
const char *tp_blend_ora(TpBlend b);        /* "svg:multiply" */
const char *tp_blend_psd(TpBlend b);        /* "mul " (4 chars) */
TpBlend tp_blend_from_ora(const char *s);
TpBlend tp_blend_from_psd(const char *key4);

/* ---- pixel buffers, shared between undo snapshots (copy on write) ---- */
typedef struct TpPixbuf { int refs; uint8_t *px; } TpPixbuf;

typedef struct TpLayer {
    char name[TP_NAME_MAX];
    TpPixbuf *buf;          /* w*h*4 premultiplied, same size as the document */
    float opacity;          /* 0..1 */
    int visible;
    int alpha_lock;         /* painting keeps the alpha that is there */
    TpBlend blend;
} TpLayer;

typedef struct TpUndo TpUndo;

typedef struct TpDoc {
    int w, h;
    int nlayers;
    TpLayer layers[TP_MAX_LAYERS];  /* 0 is the bottom */
    int active;
    TpUndo *undo;
    int dirty;                      /* changed since the last save */
    char path[1024];                /* where it was last saved/opened, or "" */
} TpDoc;

TpDoc *tp_doc_new(int w, int h, uint32_t bg_rgba /* straight, 0 = transparent */);
TpDoc *tp_doc_new_empty(int w, int h);          /* no layers at all; loaders use it */
void   tp_doc_free(TpDoc *d);
int    tp_layer_add(TpDoc *d, int at, const char *name);   /* returns index or -1 */
int    tp_layer_add_image(TpDoc *d, const char *name, const TpImage *straight);
void   tp_layer_delete(TpDoc *d, int i);
int    tp_layer_duplicate(TpDoc *d, int i);
void   tp_layer_move(TpDoc *d, int i, int dir);      /* -1 down, +1 up */
int    tp_layer_merge_down(TpDoc *d, int i);
void   tp_layer_clear(TpDoc *d, int i);
uint8_t *tp_layer_px(TpLayer *l);                    /* read */
uint8_t *tp_layer_px_mut(TpDoc *d, TpLayer *l);      /* write: unshares first */

/* flips and quarter turns of the whole picture (every layer) */
void tp_doc_flip(TpDoc *d, int horizontal);
void tp_doc_rotate90(TpDoc *d, int clockwise);
int  tp_doc_resize_canvas(TpDoc *d, int nw, int nh, int anchor_x /*0,1,2*/, int anchor_y);

/* Composite every visible layer into out (premultiplied RGBA8, d->w*4 stride)
 * for the rectangle x,y,w,h. */
void tp_composite(const TpDoc *d, uint8_t *out, int x, int y, int w, int h);
/* The flattened picture as a new straight RGBA8 image (free with tp_image_free). */
TpImage tp_flatten(const TpDoc *d);
void tp_image_free(TpImage *im);
/* Composite onto a checkerboard for the screen: out is straight RGBA8, opaque. */
void tp_composite_display(const TpDoc *d, uint8_t *out, int x, int y, int w, int h);

/* premultiply / unpremultiply helpers */
void tp_premul(uint8_t *px, size_t n);
void tp_unpremul(uint8_t *px, size_t n);

/* ---- undo (swap based: undoing a step makes it the redo step) ---- */
void tp_undo_begin_pixels(TpDoc *d, int layer);       /* before a stroke */
void tp_undo_touch(TpDoc *d, int x0, int y0, int x1, int y1); /* grow the changed rect */
void tp_undo_end_pixels(TpDoc *d);                    /* after it */
void tp_undo_push_state(TpDoc *d);                    /* before a layer/structure change */
int  tp_undo(TpDoc *d);                               /* 1 if something was undone */
int  tp_redo(TpDoc *d);
int  tp_undo_can(const TpDoc *d);
int  tp_redo_can(const TpDoc *d);
void tp_undo_set_limit(size_t bytes);

/* ---- brushes ---- */
typedef enum { TP_MODE_PAINT, TP_MODE_ERASE, TP_MODE_SMUDGE } TpBrushMode;

typedef struct TpBrush {
    char name[TP_NAME_MAX];
    char tip[TP_NAME_MAX];      /* "round", "square", or a mod's tip */
    TpBrushMode mode;
    float size;                 /* diameter in pixels at full pressure */
    float hardness;             /* 0 soft .. 1 hard edge */
    float opacity;              /* 0..1, the most one stroke can reach */
    float flow;                 /* 0..1, how much each dab adds */
    float spacing;              /* dab distance as a fraction of the diameter */
    float min_size;             /* fraction of size at zero pressure */
    float pressure_size;        /* 0..1 how much pressure drives size */
    float pressure_opacity;     /* 0..1 how much pressure drives opacity */
    float pressure_flow;        /* 0..1 how much pressure drives flow */
    float roundness;            /* 1 circle .. 0.05 flat */
    float angle;                /* degrees */
    int   tilt_angle;           /* 1: the tip turns with the pen's tilt */
    float jitter;               /* size jitter 0..1 */
    float scatter;              /* position jitter, fraction of diameter */
    float smoothing;            /* stabilizer 0..1 */
    float smudge;               /* smudge strength 0..1 */
    int   aliased;              /* 1: pixel-art pencil, no anti-aliasing */
} TpBrush;

void tp_brush_defaults(TpBrush *b);
/* Parse "key = value" lines (a .brush file).  Unknown keys are ignored. */
int  tp_brush_parse(TpBrush *b, const char *text);
int  tp_brush_load(TpBrush *b, const char *path);
int  tp_brush_save(const TpBrush *b, const char *path);
/* The presets compiled in, so the program works with no files beside it. */
int  tp_brush_builtin_count(void);
void tp_brush_builtin(int i, TpBrush *out);

/* Pressure curve: what the tablet sends (0..1) to what the brush uses. */
typedef struct TpCurve {
    float softness;             /* -1 hard (needs force) .. 0 linear .. 1 soft (light touch) */
    float min_in;               /* pressure below this counts as 0 (dead zone) */
    float max_in;               /* pressure at or above this counts as full */
} TpCurve;
float tp_curve_apply(const TpCurve *c, float p);

typedef struct TpStroke {
    TpBrush b;
    int active;
    int layer;
    uint32_t color;             /* straight RGBA */
    float lx, ly, lp, ltx, lty; /* last dab */
    float sx, sy, sp;           /* stabilized position */
    float px_, py_, pp_;        /* the pen's own last position */
    float rest;                 /* distance carried to the next dab */
    uint16_t *mask;             /* stroke coverage, d->w*d->h */
    uint8_t *base;              /* layer as it was when the stroke began */
    float carry[4];             /* smudge: the colour on the brush (premul 0..1) */
    int has_carry;
    uint32_t seed;
    int bx0, by0, bx1, by1;     /* rect changed by this stroke */
    int dx0, dy0, dx1, dy1;     /* rect changed since tp_stroke_take_dirty */
} TpStroke;

void tp_stroke_begin(TpDoc *d, TpStroke *s, const TpBrush *b, uint32_t straight_rgba,
                     float x, float y, float pressure, float tiltx, float tilty);
void tp_stroke_to(TpDoc *d, TpStroke *s, float x, float y, float pressure, float tiltx, float tilty);
void tp_stroke_end(TpDoc *d, TpStroke *s);
/* The rect touched since the last call; 0 if none. */
int  tp_stroke_take_dirty(TpStroke *s, int *x, int *y, int *w, int *h);

/* Bucket fill of the active layer.  sample_merged: decide the region from
 * the whole picture rather than the layer.  Returns 1 if anything changed. */
int  tp_fill(TpDoc *d, int x, int y, uint32_t straight_rgba, int tolerance, int sample_merged);
uint32_t tp_pick(const TpDoc *d, int x, int y, int merged);  /* straight RGBA */

/* ---- colour ---- */
void tp_hsv_to_rgb(float h, float s, float v, float *r, float *g, float *b);
void tp_rgb_to_hsv(float r, float g, float b, float *h, float *s, float *v);

/* ---- palettes (GIMP .gpl) ---- */
typedef struct TpPalette { char name[TP_NAME_MAX]; int n; uint32_t c[512]; } TpPalette;
int tp_palette_parse(TpPalette *p, const char *text);
int tp_palette_load(TpPalette *p, const char *path);
void tp_palette_default(TpPalette *p);

/* ---- file formats ---- */
typedef struct TpFileFormat {
    char name[64];
    char ext[16];               /* lower case, no dot */
    int layered;                /* keeps layers */
    int can_load, can_save;
    /* built-in formats fill these */
    TpDoc *(*load_doc)(const char *path, char *err, size_t errn);
    int (*save_doc)(const TpDoc *d, const char *path, char *err, size_t errn);
    /* mod formats fill this */
    const TpFormat *mod;
} TpFileFormat;

int  tp_formats_count(void);
const TpFileFormat *tp_format_at(int i);
const TpFileFormat *tp_format_for_path(const char *path, int for_save);
TpDoc *tp_load(const char *path, char *err, size_t errn);
int    tp_save(const TpDoc *d, const char *path, char *err, size_t errn);
/* "png;jpg;jpeg;..." of every format that can load (or save), for dialogs */
void   tp_format_patterns(int for_save, char *out, size_t n);
extern int tp_jpeg_quality;      /* 1..100, default 92 */

/* in-memory helpers the app uses for the clipboard */
TpDoc *tp_load_memory(const void *data, size_t n, char *err, size_t errn);
void  *tp_png_encode(const TpImage *im, int *out_len);

/* ---- zip, for OpenRaster ---- */
typedef struct TpZipW TpZipW;
TpZipW *tp_zipw_open(const char *path);
int  tp_zipw_add(TpZipW *z, const char *name, const void *data, size_t n); /* stored */
int  tp_zipw_close(TpZipW *z);
/* read a member of a zip in memory; returns malloc'd data or NULL */
void *tp_zip_extract(const uint8_t *zip, size_t zn, const char *name, size_t *out_n);
uint32_t tp_crc32(const void *data, size_t n);

/* ---- filters and mods ---- */
typedef struct TpFilterEntry { char name[64]; const TpFilter *mod;
    int (*builtin)(TpImage *img, void *user); void *user; } TpFilterEntry;
int  tp_filters_count(void);
const TpFilterEntry *tp_filter_at(int i);
/* Apply filter i to the active layer, with undo.  0 ok. */
int  tp_filter_apply(TpDoc *d, int i);
int  tp_tips_count(void);
const TpTip *tp_tip_at(int i);
const TpTip *tp_tip_find(const char *name);

void tp_core_init(void);                 /* built-in formats, filters, tips */
/* Load every mod in dir.  Returns how many loaded. */
int  tp_mods_load_dir(const char *dir);
int  tp_mods_loaded(void);
const char *tp_mod_name(int i);
void tp_set_log(void (*fn)(const char *msg));
void tp_log(const char *fmt, ...);
const TpHost *tp_host(void);

/* small utilities shared by the core and the app */
#include <stdio.h>
FILE *tp_fopen(const char *utf8_path, const char *mode);   /* UTF-8 paths on Windows too */
char *tp_read_file(const char *path, size_t *n);
int   tp_write_file(const char *path, const void *data, size_t n);
const char *tp_path_ext(const char *path);   /* "png" (pointer into a static) */
int   tp_list_dir(const char *dir, const char *ext, char names[][256], int max);

#endif
