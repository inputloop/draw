/* SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
 * brush.c -- brush presets, the pressure curve and the dab engine.
 *
 * A stroke is a row of "dabs" (stamps of the brush tip) laid along the pen's
 * path, one every `spacing` x diameter.  Each dab raises a per-stroke
 * coverage mask toward the dab's opacity by `flow`; the layer is then
 * recomputed from how it was when the stroke began plus the mask.  So
 * opacity caps a stroke however often it crosses itself (as artists expect
 * from Photoshop, Krita and Clip Studio), while flow builds up within it.
 */
#include "tpaint.h"
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <math.h>
#include <ctype.h>

const uint8_t *tp_undo_base(TpDoc *d);

static float clampf(float v, float a, float b) { return v < a ? a : v > b ? b : v; }
static float lerpf(float a, float b, float t) { return a + (b - a) * t; }

/* ------------------------------------------------------------ presets */
void tp_brush_defaults(TpBrush *b) {
    memset(b, 0, sizeof *b);
    snprintf(b->name, sizeof b->name, "Round Brush");
    snprintf(b->tip, sizeof b->tip, "round");
    b->mode = TP_MODE_PAINT; b->size = 24; b->hardness = 0.7f; b->opacity = 1; b->flow = 1;
    b->spacing = 0.1f; b->min_size = 0.15f; b->pressure_size = 1; b->pressure_opacity = 0;
    b->pressure_flow = 0; b->roundness = 1; b->angle = 0; b->smoothing = 0.2f; b->smudge = 0.6f;
}

static char *trim(char *s) {
    while (isspace((unsigned char)*s)) s++;
    char *e = s + strlen(s);
    while (e > s && isspace((unsigned char)e[-1])) *--e = 0;
    return s;
}
int tp_brush_parse(TpBrush *b, const char *text) {
    int n = 0;
    const char *p = text;
    while (*p) {
        char line[512]; size_t k = 0;
        while (*p && *p != '\n' && k < sizeof line - 1) line[k++] = *p++;
        while (*p && *p != '\n') p++;
        if (*p) p++;
        line[k] = 0;
        char *h = strchr(line, '#'); if (h) *h = 0;
        char *eq = strchr(line, '='); if (!eq) continue;
        *eq = 0;
        char *key = trim(line), *val = trim(eq + 1);
        for (char *c = key; *c; c++) *c = (char)tolower((unsigned char)*c);
        float f = (float)atof(val);
#define F(k, field, lo, hi) else if (!strcmp(key, k)) b->field = clampf(f, lo, hi)
        if (!strcmp(key, "name")) snprintf(b->name, sizeof b->name, "%s", val);
        else if (!strcmp(key, "tip")) snprintf(b->tip, sizeof b->tip, "%s", val);
        else if (!strcmp(key, "mode")) b->mode = !strcmp(val, "erase") ? TP_MODE_ERASE : !strcmp(val, "smudge") ? TP_MODE_SMUDGE : TP_MODE_PAINT;
        F("size", size, 0.5f, 2000); F("hardness", hardness, 0, 1); F("opacity", opacity, 0, 1);
        F("flow", flow, 0.001f, 1); F("spacing", spacing, 0.01f, 5); F("min_size", min_size, 0, 1);
        F("pressure_size", pressure_size, 0, 1); F("pressure_opacity", pressure_opacity, 0, 1);
        F("pressure_flow", pressure_flow, 0, 1); F("roundness", roundness, 0.05f, 1);
        F("angle", angle, -360, 360); F("jitter", jitter, 0, 1); F("scatter", scatter, 0, 5);
        F("smoothing", smoothing, 0, 1); F("smudge", smudge, 0, 1);
        else if (!strcmp(key, "tilt_angle")) b->tilt_angle = atoi(val) != 0;
        else if (!strcmp(key, "aliased")) b->aliased = atoi(val) != 0;
        else continue;
#undef F
        n++;
    }
    return n;
}
int tp_brush_load(TpBrush *b, const char *path) {
    size_t n; char *t = tp_read_file(path, &n);
    if (!t) return -1;
    tp_brush_defaults(b);
    int k = tp_brush_parse(b, t);
    free(t);
    return k > 0 ? 0 : -1;
}
int tp_brush_save(const TpBrush *b, const char *path) {
    char buf[2048];
    int n = snprintf(buf, sizeof buf,
        "# topology paint brush (see docs/MODDING.md)\n"
        "name = %s\ntip = %s\nmode = %s\nsize = %g\nhardness = %g\nopacity = %g\nflow = %g\n"
        "spacing = %g\nmin_size = %g\npressure_size = %g\npressure_opacity = %g\npressure_flow = %g\n"
        "roundness = %g\nangle = %g\ntilt_angle = %d\njitter = %g\nscatter = %g\nsmoothing = %g\n"
        "smudge = %g\naliased = %d\n",
        b->name, b->tip, b->mode == TP_MODE_ERASE ? "erase" : b->mode == TP_MODE_SMUDGE ? "smudge" : "paint",
        b->size, b->hardness, b->opacity, b->flow, b->spacing, b->min_size, b->pressure_size,
        b->pressure_opacity, b->pressure_flow, b->roundness, b->angle, b->tilt_angle, b->jitter,
        b->scatter, b->smoothing, b->smudge, b->aliased);
    return tp_write_file(path, buf, (size_t)n);
}

static const char *BUILTIN[] = {
    "name=Pencil\nsize=4\nhardness=0.9\nspacing=0.05\npressure_size=0.6\nmin_size=0.3\npressure_opacity=0.8\nsmoothing=0.1",
    "name=Ink Pen\nsize=10\nhardness=0.95\nspacing=0.04\npressure_size=1\nmin_size=0.05\nsmoothing=0.45",
    "name=Round Brush\nsize=30\nhardness=0.7\nspacing=0.08\npressure_size=0.8\nmin_size=0.2\npressure_opacity=0.5",
    "name=Soft Airbrush\nsize=140\nhardness=0\nopacity=0.8\nflow=0.06\nspacing=0.06\npressure_size=0\npressure_flow=1",
    "name=Marker\nsize=26\nhardness=0.85\nopacity=0.5\nspacing=0.05\npressure_size=0.3\nmin_size=0.6",
    "name=Calligraphy\nsize=28\nhardness=0.9\nroundness=0.22\nangle=40\nspacing=0.03\npressure_size=0.7\nmin_size=0.25\nsmoothing=0.3",
    "name=Chalk\ntip=square\nsize=18\nhardness=0.4\nflow=0.5\nspacing=0.2\njitter=0.5\nscatter=0.35\npressure_opacity=1\npressure_size=0.3",
    "name=Pixel\nsize=1\naliased=1\nhardness=1\nspacing=0.1\npressure_size=0\nsmoothing=0",
    "name=Blender\nmode=smudge\nsize=40\nhardness=0.3\nsmudge=0.75\nspacing=0.1\npressure_size=0.5",
    "name=Eraser\nmode=erase\nsize=30\nhardness=0.85\nspacing=0.06\npressure_size=0.6",
    "name=Soft Eraser\nmode=erase\nsize=90\nhardness=0\nflow=0.25\nspacing=0.08\npressure_size=0\npressure_flow=1",
    "name=Tilt Pencil\nsize=12\nhardness=0.8\nroundness=0.35\ntilt_angle=1\nspacing=0.05\npressure_size=0.5\nmin_size=0.3\npressure_opacity=0.7",
};
int tp_brush_builtin_count(void) { return (int)(sizeof BUILTIN / sizeof *BUILTIN); }
void tp_brush_builtin(int i, TpBrush *out) {
    tp_brush_defaults(out);
    if (i >= 0 && i < tp_brush_builtin_count()) tp_brush_parse(out, BUILTIN[i]);
}

/* ------------------------------------------------------------ pressure curve */
float tp_curve_apply(const TpCurve *c, float p) {
    float lo = clampf(c->min_in, 0, 0.9f), hi = clampf(c->max_in, lo + 0.05f, 1);
    p = clampf((p - lo) / (hi - lo), 0, 1);
    /* softness s in -1..1 maps to an exponent 4..0.25: soft makes a light touch count more */
    float e = powf(4.0f, -clampf(c->softness, -1, 1));
#ifdef TP_PLANT_FAULT
    e = 1;                                           /* planted: the curve's softness is ignored */
#endif
    return powf(p, e);
}

/* ------------------------------------------------------------ dabs */
static float rnd(TpStroke *s) {
    s->seed ^= s->seed << 13; s->seed ^= s->seed >> 17; s->seed ^= s->seed << 5;
    return (s->seed & 0xffffff) / (float)0x1000000;
}
static void grow(int *x0, int *y0, int *x1, int *y1, int a, int b, int c, int d) {
    if (a < *x0) *x0 = a; if (b < *y0) *y0 = b; if (c > *x1) *x1 = c; if (d > *y1) *y1 = d;
}

static float tip_cov(const TpBrush *b, const TpTip *mod, float u, float v, float r) {
    /* u, v: pixel offset from the centre in tip space (roundness already applied), r: radius px */
    if (b->aliased) {
        float m = !strcmp(b->tip, "square") ? fmaxf(fabsf(u), fabsf(v)) : sqrtf(u * u + v * v);
        return m <= fmaxf(r, 0.5f) ? 1.0f : 0.0f;
    }
    if (mod) {
        if (fabsf(u) > r || fabsf(v) > r) return 0;
        return clampf(mod->coverage(u / r, v / r, mod->user), 0, 1);
    }
    float dist = !strcmp(b->tip, "square") ? fmaxf(fabsf(u), fabsf(v)) : sqrtf(u * u + v * v);
    float edge = clampf(r - dist + 0.5f, 0, 1);          /* one pixel of anti-aliasing */
    if (edge <= 0) return 0;
    float nd = dist / r, h = b->hardness;
    float soft = 1;
    if (nd > h) { float t = clampf((nd - h) / (1 - h + 1e-4f), 0, 1); soft = (1 - t) * (1 - t) * (1 + 2 * t); }
    return soft * edge;
}

static void dab(TpDoc *d, TpStroke *s, float cx, float cy, float p, float tx, float ty) {
    const TpBrush *b = &s->b;
    TpLayer *L = &d->layers[s->layer];
    uint8_t *px = L->buf->px;                     /* unshared since tp_undo_begin_pixels */
    const uint8_t *base = s->base;
    float sf = lerpf(1, b->min_size + (1 - b->min_size) * p, b->pressure_size);
    float diam = b->size * sf;
    if (b->jitter > 0) diam *= 1 + b->jitter * (rnd(s) - 0.5f);
    float fade = 1;
    if (diam < 1 && !b->aliased) { fade = diam; diam = 1; }   /* a hairline thins by fading */
    float r = diam * 0.5f;
    if (b->scatter > 0) { cx += (rnd(s) - 0.5f) * b->scatter * diam; cy += (rnd(s) - 0.5f) * b->scatter * diam; }
    float op = b->opacity * lerpf(1, p, b->pressure_opacity) * fade;
    float flow = b->flow * lerpf(1, p, b->pressure_flow);
    float ang = b->angle * 3.14159265f / 180;
    if (b->tilt_angle && (fabsf(tx) > 2 || fabsf(ty) > 2)) ang = atan2f(ty, tx) + 1.5707963f;
    float ca = cosf(ang), sa = sinf(ang), rnd_ = b->roundness;
    const TpTip *mod = NULL;
    if (strcmp(b->tip, "round") && strcmp(b->tip, "square")) mod = tp_tip_find(b->tip);

    int x0 = (int)floorf(cx - r - 1), y0 = (int)floorf(cy - r - 1), x1 = (int)ceilf(cx + r + 1), y1 = (int)ceilf(cy + r + 1);
    if (b->aliased) { x0 = (int)floorf(cx - r); y0 = (int)floorf(cy - r); x1 = (int)floorf(cx + r) + 1; y1 = (int)floorf(cy + r) + 1; }
    if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0; if (x1 > d->w) x1 = d->w; if (y1 > d->h) y1 = d->h;
    if (x0 >= x1 || y0 >= y1) return;

    if (b->mode == TP_MODE_SMUDGE) {
        /* sample what is under the dab now, lay down what the brush carries, then mix */
        double acc[4] = {0}, wsum = 0;
        for (int y = y0; y < y1; y++) for (int x = x0; x < x1; x++) {
            float dx = x + 0.5f - cx, dy = y + 0.5f - cy;
            float u = dx * ca + dy * sa, v = (-dx * sa + dy * ca) / rnd_;
            float c = tip_cov(b, mod, u, v, r); if (c <= 0) continue;
            const uint8_t *q = px + ((size_t)y * d->w + x) * 4;
            for (int k = 0; k < 4; k++) acc[k] += q[k] * c;
            wsum += c;
        }
        if (wsum <= 0) return;
        float sample[4]; for (int k = 0; k < 4; k++) sample[k] = (float)(acc[k] / wsum / 255.0);
        if (!s->has_carry) { memcpy(s->carry, sample, sizeof sample); s->has_carry = 1; return; }
        float str = b->smudge * lerpf(1, p, b->pressure_opacity);
        for (int y = y0; y < y1; y++) for (int x = x0; x < x1; x++) {
            float dx = x + 0.5f - cx, dy = y + 0.5f - cy;
            float u = dx * ca + dy * sa, v = (-dx * sa + dy * ca) / rnd_;
            float c = tip_cov(b, mod, u, v, r) * str; if (c <= 0) continue;
            uint8_t *q = px + ((size_t)y * d->w + x) * 4;
            float na = lerpf(q[3] / 255.0f, s->carry[3], c);
            if (L->alpha_lock) na = q[3] / 255.0f;
            for (int k = 0; k < 3; k++) {
                float v2 = lerpf(q[k] / 255.0f, s->carry[k], c);
                if (v2 > na) v2 = na;
                q[k] = (uint8_t)(clampf(v2, 0, 1) * 255 + 0.5f);
            }
            q[3] = (uint8_t)(clampf(na, 0, 1) * 255 + 0.5f);
        }
        for (int k = 0; k < 4; k++) s->carry[k] = lerpf(sample[k], s->carry[k], b->smudge);
    } else {
        uint8_t col[4] = { s->color & 255, (s->color >> 8) & 255, (s->color >> 16) & 255, s->color >> 24 };
        float cr = col[0] / 255.0f, cg = col[1] / 255.0f, cb = col[2] / 255.0f, cA = col[3] / 255.0f;
        for (int y = y0; y < y1; y++) {
            for (int x = x0; x < x1; x++) {
                float dx = x + 0.5f - cx, dy = y + 0.5f - cy;
                float u = dx * ca + dy * sa, v = (-dx * sa + dy * ca) / rnd_;
                float c = tip_cov(b, mod, u, v, r);
                if (c <= 0) continue;
                size_t i = (size_t)y * d->w + x;
                float target = c * op * 65535.0f, m = s->mask[i];
                if (target <= m) continue;
                m += (target - m) * (b->aliased ? 1 : flow);
                s->mask[i] = (uint16_t)(m + 0.5f);
                float a = m / 65535.0f;
                const uint8_t *bp = base + i * 4; uint8_t *q = px + i * 4;
                float br = bp[0] / 255.0f, bg = bp[1] / 255.0f, bb = bp[2] / 255.0f, ba = bp[3] / 255.0f;
                float orr, og, ob, oa;
                if (b->mode == TP_MODE_ERASE) {
                    if (L->alpha_lock) continue;
                    float k = 1 - a; orr = br * k; og = bg * k; ob = bb * k; oa = ba * k;
                } else if (L->alpha_lock) {
                    float t = a * cA;
                    orr = lerpf(br, cr * ba, t); og = lerpf(bg, cg * ba, t); ob = lerpf(bb, cb * ba, t); oa = ba;
                } else {
                    float sa2 = a * cA, k = 1 - sa2;
                    orr = cr * sa2 + br * k; og = cg * sa2 + bg * k; ob = cb * sa2 + bb * k; oa = sa2 + ba * k;
                }
                q[0] = (uint8_t)(orr * 255 + 0.5f); q[1] = (uint8_t)(og * 255 + 0.5f);
                q[2] = (uint8_t)(ob * 255 + 0.5f); q[3] = (uint8_t)(oa * 255 + 0.5f);
            }
        }
    }
    grow(&s->bx0, &s->by0, &s->bx1, &s->by1, x0, y0, x1, y1);
    grow(&s->dx0, &s->dy0, &s->dx1, &s->dy1, x0, y0, x1, y1);
    tp_undo_touch(d, x0, y0, x1, y1);
}

/* ------------------------------------------------------------ strokes */
static float diameter_at(const TpBrush *b, float p) {
    return fmaxf(1.0f, b->size * lerpf(1, b->min_size + (1 - b->min_size) * p, b->pressure_size));
}

static void path_to(TpDoc *d, TpStroke *s, float nx, float ny, float np, float ntx, float nty) {
    float dx = nx - s->lx, dy = ny - s->ly, len = sqrtf(dx * dx + dy * dy);
    if (len <= 1e-4f) { s->lp = np; return; }
    float traveled = 0;
    float step = fmaxf(s->b.aliased ? 0.5f : 0.35f, s->b.spacing * diameter_at(&s->b, s->lp));
    float need = step - s->rest;
    while (len - traveled >= need) {
        traveled += need;
        float t = traveled / len;
        float p = lerpf(s->lp, np, t);
        dab(d, s, s->lx + dx * t, s->ly + dy * t, p, lerpf(s->ltx, ntx, t), lerpf(s->lty, nty, t));
        s->rest = 0;
        need = fmaxf(s->b.aliased ? 0.5f : 0.35f, s->b.spacing * diameter_at(&s->b, p));
    }
    s->rest += len - traveled;
    s->lx = nx; s->ly = ny; s->lp = np; s->ltx = ntx; s->lty = nty;
}

void tp_stroke_begin(TpDoc *d, TpStroke *s, const TpBrush *b, uint32_t rgba, float x, float y, float p, float tx, float ty) {
    memset(s, 0, sizeof *s);
    if (d->nlayers == 0) return;
    s->b = *b; s->color = rgba; s->layer = d->active; s->active = 1;
    s->seed = 0x9e3779b9u ^ (uint32_t)(x * 131 + y * 7);
    tp_undo_begin_pixels(d, s->layer);
    s->base = (uint8_t *)tp_undo_base(d);
    s->mask = calloc((size_t)d->w * d->h, sizeof(uint16_t));
    if (!s->mask) { s->active = 0; tp_undo_end_pixels(d); return; }
    s->bx0 = s->dx0 = d->w; s->by0 = s->dy0 = d->h; s->bx1 = s->by1 = s->dx1 = s->dy1 = 0;
    s->lx = s->sx = s->px_ = x; s->ly = s->sy = s->py_ = y; s->lp = s->sp = s->pp_ = p; s->ltx = tx; s->lty = ty;
    dab(d, s, x, y, p, tx, ty);
}

void tp_stroke_to(TpDoc *d, TpStroke *s, float x, float y, float p, float tx, float ty) {
    if (!s->active) return;
    float k = 1 - s->b.smoothing * 0.92f;            /* a lazy pull toward the pen */
    s->sx += (x - s->sx) * k; s->sy += (y - s->sy) * k; s->sp += (p - s->sp) * fminf(1, k * 1.5f);
    path_to(d, s, s->sx, s->sy, s->sp, tx, ty);
    s->px_ = x; s->py_ = y; s->pp_ = p;              /* where the pen really is */
}

void tp_stroke_end(TpDoc *d, TpStroke *s) {
    if (!s->active) return;
    /* the stabilizer lags behind the pen; finish the line where the pen lifted */
    if (s->b.smoothing > 0) path_to(d, s, s->px_, s->py_, s->pp_, s->ltx, s->lty);
    s->active = 0;
    free(s->mask); s->mask = NULL; s->base = NULL;
    tp_undo_end_pixels(d);
}

int tp_stroke_take_dirty(TpStroke *s, int *x, int *y, int *w, int *h) {
    if (s->dx1 <= s->dx0 || s->dy1 <= s->dy0) return 0;
    *x = s->dx0; *y = s->dy0; *w = s->dx1 - s->dx0; *h = s->dy1 - s->dy0;
    s->dx0 = 1 << 30; s->dy0 = 1 << 30; s->dx1 = 0; s->dy1 = 0;
    return 1;
}
