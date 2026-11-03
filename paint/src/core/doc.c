/* SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
 * doc.c -- documents, layers, compositing, undo, fill, colour helpers. */
#include "tpaint.h"
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <math.h>

static void *xcalloc(size_t n, size_t s) { void *p = calloc(n ? n : 1, s); if (!p) { fprintf(stderr, "out of memory\n"); abort(); } return p; }
static void *xmalloc(size_t n) { void *p = malloc(n ? n : 1); if (!p) { fprintf(stderr, "out of memory\n"); abort(); } return p; }
static float clampf(float v, float a, float b) { return v < a ? a : v > b ? b : v; }

/* ------------------------------------------------------------ blend names */
static const struct { const char *name, *ora, *psd; } BLENDS[TP_BLEND_COUNT] = {
    {"Normal", "svg:src-over", "norm"}, {"Multiply", "svg:multiply", "mul "},
    {"Screen", "svg:screen", "scrn"}, {"Overlay", "svg:overlay", "over"},
    {"Darken", "svg:darken", "dark"}, {"Lighten", "svg:lighten", "lite"},
    {"Add", "svg:plus", "lddg"}, {"Subtract", "krita:subtract", "fsub"},
    {"Difference", "svg:difference", "diff"}, {"Color Dodge", "svg:color-dodge", "div "},
    {"Color Burn", "svg:color-burn", "idiv"}, {"Hard Light", "svg:hard-light", "hLit"},
    {"Soft Light", "svg:soft-light", "sLit"},
};
const char *tp_blend_name(TpBlend b) { return b < TP_BLEND_COUNT ? BLENDS[b].name : "Normal"; }
const char *tp_blend_ora(TpBlend b) { return b < TP_BLEND_COUNT ? BLENDS[b].ora : "svg:src-over"; }
const char *tp_blend_psd(TpBlend b) { return b < TP_BLEND_COUNT ? BLENDS[b].psd : "norm"; }
TpBlend tp_blend_from_ora(const char *s) {
    for (int i = 0; i < TP_BLEND_COUNT; i++) if (s && !strcmp(s, BLENDS[i].ora)) return (TpBlend)i;
    if (s && !strcmp(s, "svg:add")) return TP_BLEND_ADD;
    return TP_BLEND_NORMAL;
}
TpBlend tp_blend_from_psd(const char *k) {
    for (int i = 0; i < TP_BLEND_COUNT; i++) if (!memcmp(k, BLENDS[i].psd, 4)) return (TpBlend)i;
    return TP_BLEND_NORMAL;
}

/* ------------------------------------------------------------ pixbufs */
static TpPixbuf *pb_new(int w, int h) {
    TpPixbuf *p = xcalloc(1, sizeof *p);
    p->refs = 1; p->px = xcalloc((size_t)w * h, 4);
    return p;
}
static TpPixbuf *pb_ref(TpPixbuf *p) { if (p) p->refs++; return p; }
static void pb_unref(TpPixbuf *p) { if (p && --p->refs == 0) { free(p->px); free(p); } }

uint8_t *tp_layer_px(TpLayer *l) { return l->buf->px; }
static TpLayer *layer_of_buf(TpDoc *d, TpLayer *l) { (void)d; return l; }
uint8_t *tp_layer_px_mut(TpDoc *d, TpLayer *l) {
    l = layer_of_buf(d, l);
    if (l->buf->refs > 1) {
        TpPixbuf *n = pb_new(1, 1);
        free(n->px);
        n->px = xmalloc((size_t)d->w * d->h * 4);
        memcpy(n->px, l->buf->px, (size_t)d->w * d->h * 4);
        pb_unref(l->buf);
        l->buf = n;
    }
    return l->buf->px;
}

/* ------------------------------------------------------------ undo store */
enum { U_PIXELS, U_STATE };
typedef struct UEntry {
    int type;
    size_t bytes;
    int layer, x, y, w, h;      /* U_PIXELS */
    uint8_t *data;
    int nlayers, active, dw, dh; /* U_STATE */
    TpLayer *layers;
} UEntry;
struct TpUndo {
    UEntry *e; int n, cap, pos;
    /* a stroke in progress */
    int pending, layer;
    TpPixbuf *base;
    int x0, y0, x1, y1;
};
static size_t undo_limit = (size_t)1 << 30;
static int undo_max_steps = 400;
void tp_undo_set_limit(size_t bytes) { undo_limit = bytes; }

static void ue_free(UEntry *u) {
    free(u->data);
    if (u->layers) { for (int i = 0; i < u->nlayers; i++) pb_unref(u->layers[i].buf); free(u->layers); }
    memset(u, 0, sizeof *u);
}
static void undo_truncate_redo(TpUndo *U) {
    for (int i = U->pos; i < U->n; i++) ue_free(&U->e[i]);
    U->n = U->pos;
}
static void undo_append(TpUndo *U, UEntry *u) {
    undo_truncate_redo(U);
    if (U->n == U->cap) { U->cap = U->cap ? U->cap * 2 : 64; U->e = realloc(U->e, U->cap * sizeof *U->e); }
    U->e[U->n++] = *u; U->pos = U->n;
    /* drop the oldest steps over the limits */
    size_t total = 0; for (int i = 0; i < U->n; i++) total += U->e[i].bytes;
    int drop = 0;
    while (U->n - drop > 1 && (total > undo_limit || U->n - drop > undo_max_steps)) { total -= U->e[drop].bytes; ue_free(&U->e[drop]); drop++; }
    if (drop) { memmove(U->e, U->e + drop, (U->n - drop) * sizeof *U->e); U->n -= drop; U->pos -= drop; }
}
void tp_undo_begin_pixels(TpDoc *d, int layer) {
    TpUndo *U = d->undo;
    if (U->pending) tp_undo_end_pixels(d);
    if (layer < 0 || layer >= d->nlayers) return;
    U->pending = 1; U->layer = layer;
    U->base = pb_ref(d->layers[layer].buf);
    tp_layer_px_mut(d, &d->layers[layer]);      /* the layer gets its own copy; base keeps the old */
    U->x0 = d->w; U->y0 = d->h; U->x1 = 0; U->y1 = 0;
}
const uint8_t *tp_undo_base(TpDoc *d) { return d->undo->pending ? d->undo->base->px : NULL; }
void tp_undo_touch(TpDoc *d, int x0, int y0, int x1, int y1) {
    TpUndo *U = d->undo; if (!U->pending) return;
    if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0; if (x1 > d->w) x1 = d->w; if (y1 > d->h) y1 = d->h;
    if (x0 < U->x0) U->x0 = x0; if (y0 < U->y0) U->y0 = y0;
    if (x1 > U->x1) U->x1 = x1; if (y1 > U->y1) U->y1 = y1;
}
void tp_undo_end_pixels(TpDoc *d) {
    TpUndo *U = d->undo; if (!U->pending) return;
    U->pending = 0;
    if (U->x1 > U->x0 && U->y1 > U->y0) {
        UEntry u = {0};
        u.type = U_PIXELS; u.layer = U->layer;
        u.x = U->x0; u.y = U->y0; u.w = U->x1 - U->x0; u.h = U->y1 - U->y0;
        u.bytes = (size_t)u.w * u.h * 4;
        u.data = xmalloc(u.bytes);
        for (int r = 0; r < u.h; r++)
            memcpy(u.data + (size_t)r * u.w * 4, U->base->px + ((size_t)(u.y + r) * d->w + u.x) * 4, (size_t)u.w * 4);
        undo_append(U, &u);
        d->dirty = 1;
    }
    pb_unref(U->base); U->base = NULL;
}
static void state_capture(TpDoc *d, UEntry *u) {
    u->type = U_STATE; u->nlayers = d->nlayers; u->active = d->active; u->dw = d->w; u->dh = d->h;
    u->layers = xmalloc(sizeof(TpLayer) * (d->nlayers ? d->nlayers : 1));
    for (int i = 0; i < d->nlayers; i++) { u->layers[i] = d->layers[i]; pb_ref(u->layers[i].buf); }
    u->bytes = 256;
}
void tp_undo_push_state(TpDoc *d) {
    if (d->undo->pending) tp_undo_end_pixels(d);
    UEntry u = {0}; state_capture(d, &u); undo_append(d->undo, &u); d->dirty = 1;
}
static void undo_swap(TpDoc *d, UEntry *u) {
    if (u->type == U_PIXELS) {
        if (u->layer >= d->nlayers) return;
        uint8_t *px = tp_layer_px_mut(d, &d->layers[u->layer]);
        uint8_t *tmp = xmalloc((size_t)u->w * 4);
        for (int r = 0; r < u->h; r++) {
            uint8_t *a = px + ((size_t)(u->y + r) * d->w + u->x) * 4, *b = u->data + (size_t)r * u->w * 4;
            memcpy(tmp, a, (size_t)u->w * 4); memcpy(a, b, (size_t)u->w * 4); memcpy(b, tmp, (size_t)u->w * 4);
        }
        free(tmp);
        d->active = u->layer;
    } else {
        UEntry cur = {0}; state_capture(d, &cur);
        for (int i = 0; i < d->nlayers; i++) pb_unref(d->layers[i].buf);
        d->nlayers = u->nlayers; d->active = u->active; d->w = u->dw; d->h = u->dh;
        for (int i = 0; i < u->nlayers; i++) d->layers[i] = u->layers[i];   /* refs move to the doc */
        free(u->layers);
        u->layers = cur.layers; u->nlayers = cur.nlayers; u->active = cur.active; u->dw = cur.dw; u->dh = cur.dh;
    }
    d->dirty = 1;
}
int tp_undo(TpDoc *d) {
    TpUndo *U = d->undo; if (U->pending) tp_undo_end_pixels(d);
    if (U->pos == 0) return 0;
    U->pos--; undo_swap(d, &U->e[U->pos]); return 1;
}
int tp_redo(TpDoc *d) {
    TpUndo *U = d->undo; if (U->pos >= U->n) return 0;
    undo_swap(d, &U->e[U->pos]); U->pos++; return 1;
}
int tp_undo_can(const TpDoc *d) { return d->undo->pos > 0; }
int tp_redo_can(const TpDoc *d) { return d->undo->pos < d->undo->n; }

/* ------------------------------------------------------------ documents */
TpDoc *tp_doc_new_empty(int w, int h) {
    if (w < 1) w = 1; if (h < 1) h = 1;
    if (w > TP_MAX_SIDE) w = TP_MAX_SIDE; if (h > TP_MAX_SIDE) h = TP_MAX_SIDE;
    TpDoc *d = xcalloc(1, sizeof *d);
    d->w = w; d->h = h; d->undo = xcalloc(1, sizeof(TpUndo));
    return d;
}
TpDoc *tp_doc_new(int w, int h, uint32_t bg) {
    TpDoc *d = tp_doc_new_empty(w, h);
    int b = tp_layer_add(d, 0, "Background");
    if (bg >> 24) {
        uint8_t *px = tp_layer_px(&d->layers[b]);
        uint8_t c[4] = { bg & 255, (bg >> 8) & 255, (bg >> 16) & 255, bg >> 24 };
        tp_premul(c, 1);
        for (size_t i = 0; i < (size_t)d->w * d->h; i++) memcpy(px + i * 4, c, 4);
    }
    tp_layer_add(d, 1, "Layer 1");
    d->dirty = 0;
    return d;
}
void tp_doc_free(TpDoc *d) {
    if (!d) return;
    TpUndo *U = d->undo;
    if (U->pending) { pb_unref(U->base); }
    for (int i = 0; i < U->n; i++) ue_free(&U->e[i]);
    free(U->e); free(U);
    for (int i = 0; i < d->nlayers; i++) pb_unref(d->layers[i].buf);
    free(d);
}
int tp_layer_add(TpDoc *d, int at, const char *name) {
    if (d->nlayers >= TP_MAX_LAYERS) return -1;
    if (at < 0 || at > d->nlayers) at = d->nlayers;
    memmove(&d->layers[at + 1], &d->layers[at], (d->nlayers - at) * sizeof(TpLayer));
    TpLayer *l = &d->layers[at];
    memset(l, 0, sizeof *l);
    snprintf(l->name, sizeof l->name, "%s", name && *name ? name : "Layer");
    l->buf = pb_new(d->w, d->h); l->opacity = 1; l->visible = 1; l->blend = TP_BLEND_NORMAL;
    d->nlayers++; d->active = at; d->dirty = 1;
    return at;
}
int tp_layer_add_image(TpDoc *d, const char *name, const TpImage *im) {
    int i = tp_layer_add(d, d->nlayers, name);
    if (i < 0) return -1;
    uint8_t *px = tp_layer_px(&d->layers[i]);
    int w = im->w < d->w ? im->w : d->w, h = im->h < d->h ? im->h : d->h;
    for (int y = 0; y < h; y++) {
        memcpy(px + (size_t)y * d->w * 4, im->px + (size_t)y * im->stride, (size_t)w * 4);
        tp_premul(px + (size_t)y * d->w * 4, w);
    }
    return i;
}
void tp_layer_delete(TpDoc *d, int i) {
    if (i < 0 || i >= d->nlayers) return;
    pb_unref(d->layers[i].buf);
    memmove(&d->layers[i], &d->layers[i + 1], (d->nlayers - i - 1) * sizeof(TpLayer));
    d->nlayers--;
    if (d->nlayers == 0) tp_layer_add(d, 0, "Layer 1");
    if (d->active >= d->nlayers) d->active = d->nlayers - 1;
    d->dirty = 1;
}
int tp_layer_duplicate(TpDoc *d, int i) {
    if (i < 0 || i >= d->nlayers || d->nlayers >= TP_MAX_LAYERS) return -1;
    memmove(&d->layers[i + 2], &d->layers[i + 1], (d->nlayers - i - 1) * sizeof(TpLayer));
    d->layers[i + 1] = d->layers[i];
    pb_ref(d->layers[i + 1].buf);                         /* shared until one is painted */
    char nm[TP_NAME_MAX]; snprintf(nm, sizeof nm, "%.50s copy", d->layers[i].name);
    memcpy(d->layers[i + 1].name, nm, sizeof nm);
    d->nlayers++; d->active = i + 1; d->dirty = 1;
    return i + 1;
}
void tp_layer_move(TpDoc *d, int i, int dir) {
    int j = i + dir;
    if (i < 0 || i >= d->nlayers || j < 0 || j >= d->nlayers) return;
    TpLayer t = d->layers[i]; d->layers[i] = d->layers[j]; d->layers[j] = t;
    d->active = j; d->dirty = 1;
}
void tp_layer_clear(TpDoc *d, int i) {
    if (i < 0 || i >= d->nlayers) return;
    memset(tp_layer_px_mut(d, &d->layers[i]), 0, (size_t)d->w * d->h * 4);
    d->dirty = 1;
}

/* ------------------------------------------------------------ compositing */
static float blend_ch(TpBlend m, float s, float b) {   /* s source, b backdrop, straight 0..1 */
    switch (m) {
    case TP_BLEND_MULTIPLY: return s * b;
    case TP_BLEND_SCREEN: return s + b - s * b;
    case TP_BLEND_OVERLAY: return b <= 0.5f ? 2 * s * b : 1 - 2 * (1 - s) * (1 - b);
    case TP_BLEND_DARKEN: return s < b ? s : b;
    case TP_BLEND_LIGHTEN: return s > b ? s : b;
    case TP_BLEND_ADD: return clampf(s + b, 0, 1);
    case TP_BLEND_SUBTRACT: return clampf(b - s, 0, 1);
    case TP_BLEND_DIFFERENCE: return fabsf(s - b);
    case TP_BLEND_COLOR_DODGE: return b <= 0 ? 0 : s >= 1 ? 1 : clampf(b / (1 - s), 0, 1);
    case TP_BLEND_COLOR_BURN: return b >= 1 ? 1 : s <= 0 ? 0 : 1 - clampf((1 - b) / s, 0, 1);
    case TP_BLEND_HARD_LIGHT: return s <= 0.5f ? 2 * s * b : 1 - 2 * (1 - s) * (1 - b);
    case TP_BLEND_SOFT_LIGHT: {
        if (s <= 0.5f) return b - (1 - 2 * s) * b * (1 - b);
        float dd = b <= 0.25f ? ((16 * b - 12) * b + 4) * b : sqrtf(b);
        return b + (2 * s - 1) * (dd - b);
    }
    default: return s;
    }
}
void tp_composite(const TpDoc *d, uint8_t *out, int x0, int y0, int w, int h) {
    static const float inv = 1.0f / 255.0f;
    for (int y = y0; y < y0 + h; y++) {
        for (int x = x0; x < x0 + w; x++) {
            size_t o = ((size_t)y * d->w + x) * 4;
            float ar = 0, ag = 0, ab = 0, aa = 0;
            for (int i = 0; i < d->nlayers; i++) {
                const TpLayer *l = &d->layers[i];
                if (!l->visible || l->opacity <= 0) continue;
                const uint8_t *p = l->buf->px + o;
                if (!p[3]) continue;
                float op = l->opacity * inv;
                float sr = p[0] * op, sg = p[1] * op, sb = p[2] * op, sa = p[3] * op;
                if (l->blend == TP_BLEND_NORMAL || aa <= 0) {
                    float k = 1 - sa; ar = sr + ar * k; ag = sg + ag * k; ab = sb + ab * k; aa = sa + aa * k;
                } else {
                    float csr = sr / sa, csg = sg / sa, csb = sb / sa;
                    float cbr = ar / aa, cbg = ag / aa, cbb = ab / aa;
                    float both = sa * aa;
                    ar = sr * (1 - aa) + ar * (1 - sa) + both * blend_ch(l->blend, csr, cbr);
                    ag = sg * (1 - aa) + ag * (1 - sa) + both * blend_ch(l->blend, csg, cbg);
                    ab = sb * (1 - aa) + ab * (1 - sa) + both * blend_ch(l->blend, csb, cbb);
                    aa = sa + aa - both;
                }
            }
            out[o + 0] = (uint8_t)(clampf(ar, 0, 1) * 255 + 0.5f);
            out[o + 1] = (uint8_t)(clampf(ag, 0, 1) * 255 + 0.5f);
            out[o + 2] = (uint8_t)(clampf(ab, 0, 1) * 255 + 0.5f);
            out[o + 3] = (uint8_t)(clampf(aa, 0, 1) * 255 + 0.5f);
        }
    }
}
void tp_composite_display(const TpDoc *d, uint8_t *out, int x0, int y0, int w, int h) {
    tp_composite(d, out, x0, y0, w, h);
    for (int y = y0; y < y0 + h; y++)
        for (int x = x0; x < x0 + w; x++) {
            uint8_t *p = out + ((size_t)y * d->w + x) * 4;
            int bg = (((x >> 3) ^ (y >> 3)) & 1) ? 204 : 255;
            int k = 255 - p[3];
            p[0] = (uint8_t)(p[0] + (bg * k + 127) / 255);
            p[1] = (uint8_t)(p[1] + (bg * k + 127) / 255);
            p[2] = (uint8_t)(p[2] + (bg * k + 127) / 255);
            p[3] = 255;
        }
}
TpImage tp_flatten(const TpDoc *d) {
    TpImage im = { d->w, d->h, d->w * 4, xmalloc((size_t)d->w * d->h * 4) };
    tp_composite(d, im.px, 0, 0, d->w, d->h);
    tp_unpremul(im.px, (size_t)d->w * d->h);
    return im;
}
void tp_image_free(TpImage *im) { free(im->px); im->px = NULL; }

void tp_premul(uint8_t *p, size_t n) {
    for (size_t i = 0; i < n; i++, p += 4) {
        unsigned a = p[3];
        if (a == 255) continue;
        p[0] = (uint8_t)((p[0] * a + 127) / 255); p[1] = (uint8_t)((p[1] * a + 127) / 255); p[2] = (uint8_t)((p[2] * a + 127) / 255);
    }
}
void tp_unpremul(uint8_t *p, size_t n) {
    for (size_t i = 0; i < n; i++, p += 4) {
        unsigned a = p[3];
        if (a == 255) continue;
        if (a == 0) { p[0] = p[1] = p[2] = 0; continue; }
        unsigned r = (p[0] * 255 + a / 2) / a, g = (p[1] * 255 + a / 2) / a, b = (p[2] * 255 + a / 2) / a;
        p[0] = r > 255 ? 255 : r; p[1] = g > 255 ? 255 : g; p[2] = b > 255 ? 255 : b;
    }
}

int tp_layer_merge_down(TpDoc *d, int i) {
    if (i <= 0 || i >= d->nlayers) return -1;
    TpLayer *top = &d->layers[i], *bot = &d->layers[i - 1];
    /* composite just these two, with the lower layer's opacity folded in */
    TpDoc tmp = *d; tmp.nlayers = 2;
    tmp.layers[0] = *bot; tmp.layers[0].visible = 1; tmp.layers[0].blend = TP_BLEND_NORMAL;
    tmp.layers[1] = *top;
    uint8_t *out = xmalloc((size_t)d->w * d->h * 4);
    tp_composite(&tmp, out, 0, 0, d->w, d->h);
    uint8_t *px = tp_layer_px_mut(d, bot);
    memcpy(px, out, (size_t)d->w * d->h * 4);
    free(out);
    bot->opacity = 1;
    tp_layer_delete(d, i);
    d->active = i - 1;
    return i - 1;
}

/* ------------------------------------------------------------ whole-picture transforms */
static void each_layer_remap(TpDoc *d, int nw, int nh, int mode) {
    for (int i = 0; i < d->nlayers; i++) {
        TpLayer *l = &d->layers[i];
        TpPixbuf *n = pb_new(nw, nh);
        const uint32_t *s = (const uint32_t *)l->buf->px; uint32_t *o = (uint32_t *)n->px;
        for (int y = 0; y < d->h; y++)
            for (int x = 0; x < d->w; x++) {
                int tx, ty;
                switch (mode) {
                case 0: tx = d->w - 1 - x; ty = y; break;            /* flip h */
                case 1: tx = x; ty = d->h - 1 - y; break;            /* flip v */
                case 2: tx = d->h - 1 - y; ty = x; break;            /* cw */
                default: tx = y; ty = d->w - 1 - x; break;           /* ccw */
                }
                o[(size_t)ty * nw + tx] = s[(size_t)y * d->w + x];
            }
        pb_unref(l->buf); l->buf = n;
    }
    d->w = nw; d->h = nh; d->dirty = 1;
}
void tp_doc_flip(TpDoc *d, int horizontal) { each_layer_remap(d, d->w, d->h, horizontal ? 0 : 1); }
void tp_doc_rotate90(TpDoc *d, int cw) { each_layer_remap(d, d->h, d->w, cw ? 2 : 3); }
int tp_doc_resize_canvas(TpDoc *d, int nw, int nh, int ax, int ay) {
    if (nw < 1 || nh < 1 || nw > TP_MAX_SIDE || nh > TP_MAX_SIDE) return -1;
    int ox = (nw - d->w) * ax / 2, oy = (nh - d->h) * ay / 2;
    for (int i = 0; i < d->nlayers; i++) {
        TpLayer *l = &d->layers[i];
        TpPixbuf *n = pb_new(nw, nh);
        for (int y = 0; y < d->h; y++) {
            int ty = y + oy; if (ty < 0 || ty >= nh) continue;
            for (int x = 0; x < d->w; x++) {
                int tx = x + ox; if (tx < 0 || tx >= nw) continue;
                memcpy(n->px + ((size_t)ty * nw + tx) * 4, l->buf->px + ((size_t)y * d->w + x) * 4, 4);
            }
        }
        pb_unref(l->buf); l->buf = n;
    }
    d->w = nw; d->h = nh; d->dirty = 1;
    return 0;
}

/* ------------------------------------------------------------ pick and fill */
uint32_t tp_pick(const TpDoc *d, int x, int y, int merged) {
    if (x < 0 || y < 0 || x >= d->w || y >= d->h || d->nlayers == 0) return 0;
    uint8_t p[4];
    if (merged) {
        /* the compositor on a 1x1 view of this one pixel */
        TpDoc *v = malloc(sizeof *v);
        TpPixbuf *bufs = malloc(sizeof(TpPixbuf) * TP_MAX_LAYERS);
        if (!v || !bufs) { free(v); free(bufs); return 0; }
        *v = *d; v->w = 1; v->h = 1;
        for (int i = 0; i < d->nlayers; i++) {
            bufs[i].refs = 1; bufs[i].px = d->layers[i].buf->px + ((size_t)y * d->w + x) * 4;
            v->layers[i].buf = &bufs[i];
        }
        tp_composite(v, p, 0, 0, 1, 1);
        free(v); free(bufs);
    } else memcpy(p, d->layers[d->active].buf->px + ((size_t)y * d->w + x) * 4, 4);
    tp_unpremul(p, 1);
    return (uint32_t)p[0] | (uint32_t)p[1] << 8 | (uint32_t)p[2] << 16 | (uint32_t)p[3] << 24;
}

int tp_fill(TpDoc *d, int sx, int sy, uint32_t rgba, int tol, int merged) {
    if (sx < 0 || sy < 0 || sx >= d->w || sy >= d->h) return 0;
    TpLayer *L = &d->layers[d->active];
    size_t N = (size_t)d->w * d->h;
    uint8_t *ref = xmalloc(N * 4);
    if (merged) tp_composite(d, ref, 0, 0, d->w, d->h); else memcpy(ref, L->buf->px, N * 4);
    uint8_t seed[4]; memcpy(seed, ref + ((size_t)sy * d->w + sx) * 4, 4);
    uint8_t col[4] = { rgba & 255, (rgba >> 8) & 255, (rgba >> 16) & 255, rgba >> 24 };
    tp_premul(col, 1);
    uint8_t *mark = xcalloc(N, 1);
    int *stack = xmalloc(sizeof(int) * 2 * (N < 1u << 22 ? N + 16 : (1u << 22)));
    size_t cap = N < 1u << 22 ? N + 16 : (1u << 22), sp = 0;
    int t = tol * 4;
#define MATCH(i) (abs(ref[(i)*4]-seed[0]) + abs(ref[(i)*4+1]-seed[1]) + abs(ref[(i)*4+2]-seed[2]) + abs(ref[(i)*4+3]-seed[3]) <= t)
    stack[sp * 2] = sx; stack[sp * 2 + 1] = sy; sp++;
    int x0 = d->w, y0 = d->h, x1 = 0, y1 = 0;
    while (sp) {
        sp--; int x = stack[sp * 2], y = stack[sp * 2 + 1];
        size_t row = (size_t)y * d->w;
        if (mark[row + x] || !MATCH(row + x)) continue;
        int l = x, r = x;
        while (l > 0 && !mark[row + l - 1] && MATCH(row + l - 1)) l--;
        while (r < d->w - 1 && !mark[row + r + 1] && MATCH(row + r + 1)) r++;
        for (int i = l; i <= r; i++) mark[row + i] = 1;
        if (l < x0) x0 = l; if (r + 1 > x1) x1 = r + 1; if (y < y0) y0 = y; if (y + 1 > y1) y1 = y + 1;
        for (int ny = y - 1; ny <= y + 1; ny += 2) {
            if (ny < 0 || ny >= d->h) continue;
            size_t nrow = (size_t)ny * d->w;
            for (int i = l; i <= r; i++) {
                if (!mark[nrow + i] && MATCH(nrow + i)) {
                    if (sp < cap) { stack[sp * 2] = i; stack[sp * 2 + 1] = ny; sp++; }
                    while (i <= r && !mark[nrow + i] && MATCH(nrow + i)) i++;
                }
            }
        }
    }
#undef MATCH
    int changed = 0;
    if (x1 > x0) {
        tp_undo_begin_pixels(d, d->active);
        uint8_t *px = tp_layer_px_mut(d, L);
        /* grow the fill by one pixel and blend the rim, so it meets line art without a gap */
        for (int y = y0 > 0 ? y0 - 1 : 0; y < (y1 < d->h ? y1 + 1 : d->h); y++)
            for (int x = x0 > 0 ? x0 - 1 : 0; x < (x1 < d->w ? x1 + 1 : d->w); x++) {
                size_t i = (size_t)y * d->w + x;
                int cov = mark[i] ? 255 : 0;
                if (!cov) {
                    int nb = (x > 0 && mark[i - 1]) || (x < d->w - 1 && mark[i + 1]) || (y > 0 && mark[i - d->w]) || (y < d->h - 1 && mark[i + d->w]);
                    if (!nb) continue;
                    cov = 255;     /* full: fills under the anti-aliased edge of a line */
                }
                uint8_t *p = px + i * 4;
                if (L->alpha_lock) {        /* keep the alpha, take the colour */
                    unsigned a = p[3];
                    uint8_t st[4] = { rgba & 255, (rgba >> 8) & 255, (rgba >> 16) & 255, 255 };
                    for (int c = 0; c < 3; c++) p[c] = (uint8_t)((st[c] * a + 127) / 255);
                } else {
                    unsigned k = 255 - col[3];
                    for (int c = 0; c < 4; c++) p[c] = (uint8_t)(col[c] + (p[c] * k + 127) / 255);
                }
                changed = 1;
            }
        tp_undo_touch(d, x0 - 1, y0 - 1, x1 + 1, y1 + 1);
        tp_undo_end_pixels(d);
    }
    free(ref); free(mark); free(stack);
    return changed;
}

/* ------------------------------------------------------------ colour */
void tp_hsv_to_rgb(float h, float s, float v, float *r, float *g, float *b) {
    h = fmodf(h, 1.0f); if (h < 0) h += 1;
    float i = floorf(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    switch ((int)i % 6) {
    case 0: *r = v; *g = t; *b = p; break; case 1: *r = q; *g = v; *b = p; break;
    case 2: *r = p; *g = v; *b = t; break; case 3: *r = p; *g = q; *b = v; break;
    case 4: *r = t; *g = p; *b = v; break; default: *r = v; *g = p; *b = q; break;
    }
}
void tp_rgb_to_hsv(float r, float g, float b, float *h, float *s, float *v) {
    float mx = fmaxf(r, fmaxf(g, b)), mn = fminf(r, fminf(g, b)), dd = mx - mn;
    *v = mx; *s = mx > 0 ? dd / mx : 0;
    if (dd <= 0) { *h = 0; return; }
    float hh = mx == r ? (g - b) / dd : mx == g ? 2 + (b - r) / dd : 4 + (r - g) / dd;
    hh /= 6; if (hh < 0) hh += 1; *h = hh;
}
