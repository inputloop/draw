/* SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
 * test_core.c -- the promises topology paint's core makes, each checked.
 * usage: test_core SCRATCH_DIR [MODS_DIR]      (tests/run.sh builds and runs it)
 */
#include "tpaint.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#ifdef _WIN32
#  define WIN32_LEAN_AND_MEAN
#  include <windows.h>
#  include <shellapi.h>
#endif

#define STBI_ONLY_PSD
#include "../third_party/stb/stb_image.h"   /* declarations only: the implementation is in formats.c */

static int fails, passes;
#define CHECK(cond, ...) do { if (cond) { passes++; } else { fails++; printf("not ok: "); printf(__VA_ARGS__); printf("  (%s:%d)\n", __FILE__, __LINE__); } } while (0)

static const char *dir;
static char *tmp(const char *name) { static char b[8][1024]; static int k; k = (k + 1) % 8; snprintf(b[k], sizeof b[k], "%s/%s", dir, name); return b[k]; }

static void rename_u8(const char *from, const char *to) {
#ifdef _WIN32
    wchar_t a[1024], b[1024];
    MultiByteToWideChar(CP_UTF8, 0, from, -1, a, 1024); MultiByteToWideChar(CP_UTF8, 0, to, -1, b, 1024);
    MoveFileExW(a, b, MOVEFILE_REPLACE_EXISTING);
#else
    rename(from, to);
#endif
}
static uint8_t *px(TpDoc *d, int layer, int x, int y) { return d->layers[layer].buf->px + ((size_t)y * d->w + x) * 4; }
static void fill_layer(TpDoc *d, int layer, uint8_t r, uint8_t g, uint8_t b, uint8_t a) {
    uint8_t c[4] = { r, g, b, a }; tp_premul(c, 1);
    uint8_t *p = tp_layer_px_mut(d, &d->layers[layer]);
    for (size_t i = 0; i < (size_t)d->w * d->h; i++) memcpy(p + i * 4, c, 4);
}
static int count_alpha(TpDoc *d, int layer, int min) {
    int n = 0; for (int y = 0; y < d->h; y++) for (int x = 0; x < d->w; x++) if (px(d, layer, x, y)[3] >= min) n++;
    return n;
}
static void line(TpDoc *d, const TpBrush *b, uint32_t col, float x0, float y0, float x1, float y1, float p0, float p1) {
    TpStroke s; tp_stroke_begin(d, &s, b, col, x0, y0, p0, 0, 0);
    for (int i = 1; i <= 40; i++) { float t = i / 40.0f; tp_stroke_to(d, &s, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, p0 + (p1 - p0) * t, 0, 0); }
    tp_stroke_end(d, &s);
}
/* a picture with three distinct layers, for the round trips */
static TpDoc *sample_doc(void) {
    TpDoc *d = tp_doc_new(64, 48, 0xffffffffu);          /* Background white, Layer 1 */
    TpBrush b; tp_brush_builtin(2, &b); b.size = 12;
    line(d, &b, 0xff2040e0u, 5, 5, 58, 40, 0.3f, 1.0f);   /* red-ish line on Layer 1 */
    int l2 = tp_layer_add(d, d->nlayers, "Glaze & <shade>");
    for (int y = 10; y < 30; y++) for (int x = 20; x < 50; x++) { uint8_t *q = px(d, l2, x, y); q[0] = 10; q[1] = 90; q[2] = 50; q[3] = 128; }
    d->layers[l2].opacity = 0.5f; d->layers[l2].blend = TP_BLEND_MULTIPLY;
    d->layers[1].visible = 0; d->layers[1].alpha_lock = 1;
    return d;
}
static int same_layers(TpDoc *a, TpDoc *b, int tol, int check_props, const char *what) {
    int ok = 1;
    if (a->nlayers != b->nlayers || a->w != b->w || a->h != b->h) { printf("  %s: %d layers %dx%d vs %d layers %dx%d\n", what, a->nlayers, a->w, a->h, b->nlayers, b->w, b->h); return 0; }
    for (int i = 0; i < a->nlayers; i++) {
        int worst = 0;
        for (size_t k = 0; k < (size_t)a->w * a->h * 4; k++) { int dd = abs(a->layers[i].buf->px[k] - b->layers[i].buf->px[k]); if (dd > worst) worst = dd; }
        if (worst > tol) { printf("  %s: layer %d differs by %d\n", what, i, worst); ok = 0; }
        if (check_props) {
            if (strcmp(a->layers[i].name, b->layers[i].name)) { printf("  %s: name '%s' vs '%s'\n", what, a->layers[i].name, b->layers[i].name); ok = 0; }
            if (fabsf(a->layers[i].opacity - b->layers[i].opacity) > 0.01f) { printf("  %s: opacity of %d\n", what, i); ok = 0; }
            if (a->layers[i].visible != b->layers[i].visible) { printf("  %s: visibility of %d\n", what, i); ok = 0; }
            if (a->layers[i].blend != b->layers[i].blend) { printf("  %s: blend of %d\n", what, i); ok = 0; }
            if (a->layers[i].alpha_lock != b->layers[i].alpha_lock) { printf("  %s: alpha lock of %d\n", what, i); ok = 0; }
        }
    }
    return ok;
}
static int same_flat(TpDoc *a, TpDoc *b, int tol, const char *what) {
    TpImage x = tp_flatten(a), y = tp_flatten(b);
    int worst = 0;
    if (x.w != y.w || x.h != y.h) { printf("  %s: size differs\n", what); tp_image_free(&x); tp_image_free(&y); return 0; }
    for (size_t k = 0; k < (size_t)x.w * x.h * 4; k++) { int dd = abs(x.px[k] - y.px[k]); if (dd > worst) worst = dd; }
    tp_image_free(&x); tp_image_free(&y);
    if (worst > tol) printf("  %s: flattened pictures differ by %d\n", what, worst);
    return worst <= tol;
}

static void test_blend(void) {
    TpDoc *d = tp_doc_new(4, 4, 0xffffffffu);
    fill_layer(d, 1, 255, 0, 0, 128);
    TpImage f = tp_flatten(d);
    CHECK(f.px[0] == 255 && abs(f.px[1] - 127) <= 1 && abs(f.px[2] - 127) <= 1 && f.px[3] == 255, "half red over white is pink: %d %d %d %d", f.px[0], f.px[1], f.px[2], f.px[3]);
    tp_image_free(&f);
    fill_layer(d, 0, 200, 200, 200, 255); fill_layer(d, 1, 128, 128, 128, 255); d->layers[1].blend = TP_BLEND_MULTIPLY;
    f = tp_flatten(d);
    CHECK(abs(f.px[0] - 100) <= 1, "multiply 128 over 200 is 100: %d", f.px[0]);
    tp_image_free(&f);
    d->layers[1].blend = TP_BLEND_SCREEN; f = tp_flatten(d);
    CHECK(abs(f.px[0] - 227) <= 1, "screen 128 over 200 is 228: %d", f.px[0]);
    tp_image_free(&f);
    d->layers[1].visible = 0; f = tp_flatten(d);
    CHECK(f.px[0] == 200, "a hidden layer adds nothing: %d", f.px[0]);
    tp_image_free(&f);
    tp_doc_free(d);
}

static void test_pressure(void) {
    TpBrush b; tp_brush_builtin(1, &b);          /* Ink Pen: size from pressure */
    b.smoothing = 0;
    TpDoc *d = tp_doc_new(200, 60, 0);
    line(d, &b, 0xff000000u, 10, 30, 190, 30, 0.15f, 0.15f);
    int light = count_alpha(d, 1, 128);
    tp_layer_clear(d, 1);
    line(d, &b, 0xff000000u, 10, 30, 190, 30, 1.0f, 1.0f);
    int firm = count_alpha(d, 1, 128);
    CHECK(firm > light * 3, "a firm stroke is wider than a light one: %d vs %d pixels", firm, light);
    tp_layer_clear(d, 1);
    line(d, &b, 0xff000000u, 10, 30, 190, 30, 0.05f, 1.0f);    /* a taper */
    int left = 0, right = 0;
    for (int y = 0; y < 60; y++) { left += px(d, 1, 30, y)[3] >= 128; right += px(d, 1, 170, y)[3] >= 128; }
    CHECK(right > left, "a stroke pressed harder at its end is thicker there: %d vs %d", right, left);

    TpCurve c = { 0, 0, 1 };
    CHECK(fabsf(tp_curve_apply(&c, 0.5f) - 0.5f) < 1e-4f, "a linear curve passes pressure through");
    c.softness = 0.6f;
    CHECK(tp_curve_apply(&c, 0.5f) > 0.6f, "a soft curve makes a light touch count more: %f", tp_curve_apply(&c, 0.5f));
    c.softness = -0.6f;
    CHECK(tp_curve_apply(&c, 0.5f) < 0.4f, "a hard curve needs more force: %f", tp_curve_apply(&c, 0.5f));
    c.softness = 0; c.min_in = 0.1f;
    CHECK(tp_curve_apply(&c, 0.05f) == 0, "pressure in the dead zone counts as none");
    tp_doc_free(d);
}

static void test_opacity_flow_erase(void) {
    TpBrush b; tp_brush_builtin(4, &b);          /* Marker: opacity 0.5 */
    b.smoothing = 0;
    TpDoc *d = tp_doc_new(100, 100, 0);
    TpStroke s; tp_stroke_begin(d, &s, &b, 0xff0000ffu, 10, 50, 1, 0, 0);
    for (int k = 0; k < 6; k++) { tp_stroke_to(d, &s, 90, 50, 1, 0, 0); tp_stroke_to(d, &s, 10, 50, 1, 0, 0); }
    tp_stroke_end(d, &s);
    int mx = 0; for (int x = 0; x < 100; x++) if (px(d, 1, x, 50)[3] > mx) mx = px(d, 1, x, 50)[3];
    CHECK(mx <= 129 && mx >= 120, "one stroke never passes the brush's opacity, however often it crosses itself: %d", mx);
    line(d, &b, 0xff0000ffu, 10, 50, 90, 50, 1, 1);
    mx = 0; for (int x = 0; x < 100; x++) if (px(d, 1, x, 50)[3] > mx) mx = px(d, 1, x, 50)[3];
    CHECK(mx > 180, "a second stroke builds on the first: %d", mx);
    TpBrush e; tp_brush_builtin(9, &e); e.smoothing = 0; e.size = 30;
    CHECK(e.mode == TP_MODE_ERASE, "the Eraser preset erases");
    int before = count_alpha(d, 1, 1);
    line(d, &e, 0xff000000u, 50, 20, 50, 80, 1, 1);
    CHECK(px(d, 1, 50, 50)[3] == 0, "the eraser clears what it crosses");
    CHECK(count_alpha(d, 1, 1) < before, "erasing leaves fewer painted pixels");
    /* alpha lock: painting changes colour, never coverage */
    TpDoc *d2 = tp_doc_new(40, 40, 0);
    for (int y = 0; y < 20; y++) for (int x = 0; x < 40; x++) { uint8_t *q = px(d2, 1, x, y); q[0] = q[1] = q[2] = 0; q[3] = 255; }
    d2->layers[1].alpha_lock = 1;
    TpBrush r; tp_brush_builtin(2, &r); r.smoothing = 0; r.size = 30;
    line(d2, &r, 0xffffffffu, 20, 2, 20, 38, 1, 1);
    CHECK(px(d2, 1, 20, 10)[0] > 200 && px(d2, 1, 20, 10)[3] == 255, "alpha lock recolours what is there");
    CHECK(px(d2, 1, 20, 30)[3] == 0, "alpha lock paints nothing where nothing was");
    tp_doc_free(d2);
    tp_doc_free(d);
}

static void test_undo(void) {
    TpDoc *d = tp_doc_new(80, 80, 0xffffffffu);
    TpBrush b; tp_brush_builtin(2, &b);
    uint8_t *was = malloc(80 * 80 * 4); memcpy(was, d->layers[1].buf->px, 80 * 80 * 4);
    line(d, &b, 0xff00ff00u, 5, 5, 75, 75, 1, 1);
    uint8_t *after = malloc(80 * 80 * 4); memcpy(after, d->layers[1].buf->px, 80 * 80 * 4);
    CHECK(memcmp(was, after, 80 * 80 * 4) != 0, "a stroke changes the layer");
    CHECK(tp_undo(d) && !memcmp(d->layers[1].buf->px, was, 80 * 80 * 4), "undo puts back every byte");
    CHECK(tp_redo(d) && !memcmp(d->layers[1].buf->px, after, 80 * 80 * 4), "redo brings the stroke back exactly");
    tp_undo_push_state(d); tp_layer_add(d, 2, "extra");
    tp_undo_push_state(d); tp_layer_delete(d, 1);
    CHECK(d->nlayers == 2, "add then delete leaves two layers");
    tp_undo(d); tp_undo(d);
    CHECK(d->nlayers == 2 && !memcmp(d->layers[1].buf->px, after, 80 * 80 * 4), "undoing both brings back the painted layer");
    tp_redo(d);
    CHECK(d->nlayers == 3 && !strcmp(d->layers[2].name, "extra"), "redo adds the layer again");
    /* a duplicate shares pixels until painted; painting one leaves the other alone */
    int dup = tp_layer_duplicate(d, 1);
    line(d, &b, 0xffff0000u, 5, 75, 75, 5, 1, 1);
    CHECK(dup == 2 && memcmp(d->layers[1].buf->px, d->layers[2].buf->px, 80 * 80 * 4) != 0 && !memcmp(d->layers[1].buf->px, after, 80 * 80 * 4), "painting a duplicate does not change its original");
    tp_undo_push_state(d); tp_doc_rotate90(d, 1);
    tp_undo(d);
    CHECK(d->w == 80 && !memcmp(d->layers[1].buf->px, after, 80 * 80 * 4), "a turn is undone");
    free(was); free(after);
    tp_doc_free(d);
    TpDoc *r = tp_doc_new(30, 20, 0);
    tp_doc_rotate90(r, 1); CHECK(r->w == 20 && r->h == 30, "a quarter turn swaps the sides");
    px(r, 1, 0, 0)[3] = 255; tp_doc_flip(r, 1); CHECK(px(r, 1, 19, 0)[3] == 255, "a flip moves a corner to the other side");
    tp_doc_free(r);
}

static void test_fill(void) {
    TpDoc *d = tp_doc_new(100, 100, 0);
    TpBrush b; tp_brush_builtin(1, &b); b.smoothing = 0; b.size = 4;
    TpStroke s; tp_stroke_begin(d, &s, &b, 0xff000000u, 50 + 30, 50, 1, 0, 0);
    for (int i = 1; i <= 120; i++) { float a = i * 6.2831853f / 120; tp_stroke_to(d, &s, 50 + 30 * cosf(a), 50 + 30 * sinf(a), 1, 0, 0); }
    tp_stroke_end(d, &s);
    CHECK(tp_fill(d, 50, 50, 0xff0000ffu, 32, 0), "a fill inside a ring changes something");
    CHECK(px(d, 1, 50, 50)[0] == 255 && px(d, 1, 50, 50)[3] == 255, "the inside is filled");
    CHECK(px(d, 1, 3, 3)[3] == 0, "the outside is not");
    uint32_t c = tp_pick(d, 50, 50, 1);
    CHECK((c & 0xffffff) == 0x0000ff, "the picker reads the fill colour back: %08x", c);
    tp_undo(d);
    CHECK(px(d, 1, 50, 50)[3] == 0, "a fill is undone");
    tp_doc_free(d);
}

static void test_formats(void) {
    TpDoc *d = sample_doc();
    char err[256] = "";
    /* layered */
    CHECK(tp_save(d, tmp("t.ora"), err, sizeof err) == 0, "save OpenRaster: %s", err);
    TpDoc *o = tp_load(tmp("t.ora"), err, sizeof err);
    CHECK(o && same_layers(d, o, 1, 1, "ora"), "OpenRaster keeps layers, names, opacity, visibility, blend and alpha lock");
    if (o) tp_doc_free(o);
    CHECK(tp_save(d, tmp("t.psd"), err, sizeof err) == 0, "save PSD: %s", err);
    o = tp_load(tmp("t.psd"), err, sizeof err);
    CHECK(o && same_layers(d, o, 1, 1, "psd"), "PSD keeps layers, names, opacity, visibility, blend and alpha lock");
    if (o) tp_doc_free(o);
    /* an independent reader: stb_image's PSD loader reads only the merged picture */
    int w, h, c; uint8_t *m = stbi_load(tmp("t.psd"), &w, &h, &c, 4);
    TpImage flat = tp_flatten(d);
    int worst = 999;
    if (m && w == d->w && h == d->h) { worst = 0; for (size_t k = 0; k < (size_t)w * h * 4; k++) { int dd = abs(m[k] - flat.px[k]); if (dd > worst) worst = dd; } }
    CHECK(worst <= 1, "stb_image reads our PSD's merged picture as we flattened it (worst %d)", worst);
    if (m) stbi_image_free(m);
    tp_image_free(&flat);
    /* flat: exact */
    const char *exact[] = { "png", "bmp", "tga", "tif", "qoi" };
    for (int i = 0; i < 5; i++) {
        char nm[32]; snprintf(nm, sizeof nm, "t.%s", exact[i]);
        CHECK(tp_save(d, tmp(nm), err, sizeof err) == 0, "save %s: %s", exact[i], err);
        o = tp_load(tmp(nm), err, sizeof err);
        CHECK(o && same_flat(d, o, 1, exact[i]), "%s keeps the flattened picture exactly", exact[i]);
        if (o) tp_doc_free(o);
    }
    /* flat, lossy or without alpha: the picture over white, close */
    TpDoc *opaque = tp_doc_new(64, 48, 0xffffffffu);
    TpBrush b; tp_brush_builtin(2, &b); line(opaque, &b, 0xff2040e0u, 5, 5, 58, 40, 1, 1);
    CHECK(tp_save(opaque, tmp("t.jpg"), err, sizeof err) == 0, "save JPEG");
    o = tp_load(tmp("t.jpg"), err, sizeof err);
    CHECK(o && same_flat(opaque, o, 60, "jpg"), "JPEG comes back close");
    if (o) tp_doc_free(o);
    CHECK(tp_save(opaque, tmp("t.ppm"), err, sizeof err) == 0, "save PPM");
    o = tp_load(tmp("t.ppm"), err, sizeof err);
    CHECK(o && same_flat(opaque, o, 0, "ppm"), "PPM keeps an opaque picture exactly");
    if (o) tp_doc_free(o);
    /* by content, not name: a PNG called .psd still opens */
    CHECK(tp_save(opaque, tmp("misnamed.png"), err, sizeof err) == 0, "save png");
    rename_u8(tmp("misnamed.png"), tmp("misnamed.psd"));
    o = tp_load(tmp("misnamed.psd"), err, sizeof err);
    CHECK(o != NULL, "a file is read by what it holds, not what it is called");
    if (o) tp_doc_free(o);
    CHECK(tp_load(tmp("no-such-file.png"), err, sizeof err) == NULL && err[0], "a missing file is an error in words");
    CHECK(tp_save(d, tmp("t.xyz"), err, sizeof err) != 0, "an unknown extension is refused");
    /* a zip member compressed with deflate is read too (other programs write them) */
    tp_doc_free(opaque);
    tp_doc_free(d);
}

static void test_presets(void) {
    TpBrush b; tp_brush_defaults(&b);
    int n = tp_brush_parse(&b, "# a comment\nname = Wet Ink\n size=33 \nmode=smudge\nhardness = 3\nunknown = 1\ntip = star\n");
    CHECK(n == 4 + 1 && !strcmp(b.name, "Wet Ink") && b.size == 33 && b.mode == TP_MODE_SMUDGE && b.hardness == 1 && !strcmp(b.tip, "star"),
          "a .brush file is read, values are clamped, unknown keys are skipped (%d keys)", n);
    CHECK(tp_brush_save(&b, tmp("t.brush")) == 0, "a brush saves");
    TpBrush c; CHECK(tp_brush_load(&c, tmp("t.brush")) == 0 && !memcmp(&b, &c, sizeof b), "and loads back the same");
    CHECK(tp_brush_builtin_count() >= 10, "at least ten presets are built in");
    TpPalette p;
    CHECK(tp_palette_parse(&p, "GIMP Palette\nName: Test\nColumns: 4\n#\n255   0   0\tRed\n  0 255   0 Green\n") == 0 && p.n == 2 && p.c[0] == 0xff0000ffu && !strcmp(p.name, "Test"),
          "a GIMP .gpl palette is read");
    CHECK(tp_palette_parse(&p, "not a palette") != 0, "anything else is refused");
}

static void test_mods(const char *mods) {
    int f0 = tp_filters_count(), t0 = tp_tips_count();
    int n = tp_mods_load_dir(mods);
    CHECK(n == 3, "the three example mods load (%d did)", n);
    CHECK(tp_filters_count() == f0 + 2, "posterize adds two filters");
    CHECK(tp_tip_find("star") != NULL && tp_tips_count() == t0 + 1, "star-tip adds a tip");
    const TpFileFormat *pgm = tp_format_for_path("x.pgm", 1);
    CHECK(pgm && pgm->mod, "pgm-export adds a format that saves .pgm");
    TpDoc *d = tp_doc_new(32, 32, 0xffffffffu);
    fill_layer(d, 1, 100, 30, 200, 255);
    int fi = -1; for (int i = 0; i < tp_filters_count(); i++) if (!strcmp(tp_filter_at(i)->name, "Posterize (4 levels)")) fi = i;
    CHECK(fi >= 0 && tp_filter_apply(d, fi) == 0, "the posterize filter runs");
    uint8_t *q = px(d, 1, 3, 3);
    CHECK(q[0] == 85 && q[1] == 0 && q[2] == 170, "and cuts to four levels: %d %d %d", q[0], q[1], q[2]);
    tp_undo(d);
    CHECK(px(d, 1, 3, 3)[0] == 100, "a filter is undone");
    char err[256];
    CHECK(tp_save(d, tmp("t.pgm"), err, sizeof err) == 0, "a mod format saves");
    TpDoc *o = tp_load(tmp("t.pgm"), err, sizeof err);
    CHECK(o && o->w == 32, "and loads");
    if (o) tp_doc_free(o);
    TpBrush b; tp_brush_defaults(&b); snprintf(b.tip, sizeof b.tip, "star"); b.size = 30; b.spacing = 5; b.smoothing = 0;
    tp_layer_clear(d, 1);
    TpStroke s; tp_stroke_begin(d, &s, &b, 0xff000000u, 16, 16, 1, 0, 0); tp_stroke_end(d, &s);
    CHECK(px(d, 1, 16, 16)[3] > 200 && px(d, 1, 16 + 9, 16 + 9)[3] < 60, "a mod tip shapes the dab (centre %d, between points %d)", px(d, 1, 16, 16)[3], px(d, 1, 25, 25)[3]);
    tp_doc_free(d);
    CHECK(tp_mods_load_dir(mods) == 0, "loading the same folder twice loads nothing twice");
}

/* a folder whose name is not ASCII: what a Windows user called "Zoë" or "画家" has */
static void test_unicode_paths(int with_mods) {
    char sub[1024]; snprintf(sub, sizeof sub, "%s/\xc3\x9cn\xc3\xaf \xe7\x94\xbb", dir);   /* "Ünï 画" in UTF-8 */
#ifdef _WIN32
    wchar_t w[1024]; MultiByteToWideChar(CP_UTF8, 0, sub, -1, w, 1024); CreateDirectoryW(w, NULL);
#else
    char cmd[1200]; snprintf(cmd, sizeof cmd, "mkdir -p '%s'", sub); if (system(cmd)) {}
#endif
    TpDoc *d = sample_doc(); char err[256] = "", p[1100];
    const char *ext[] = { "ora", "psd", "png", "jpg", "pgm" };
    for (int i = 0; i < (with_mods ? 5 : 4); i++) {
        snprintf(p, sizeof p, "%s/picture.%s", sub, ext[i]);
        int s = tp_save(d, p, err, sizeof err);
        TpDoc *o = s == 0 ? tp_load(p, err, sizeof err) : NULL;
        CHECK(o && o->w == d->w, "a .%s saves and opens in a folder named in UTF-8: %s", ext[i], err);
        if (o) tp_doc_free(o);
    }
    tp_doc_free(d);
}

int main(int argc, char **argv) {
    if (argc < 2) { fprintf(stderr, "usage: test_core SCRATCH_DIR [MODS_DIR]\n"); return 2; }
#ifdef _WIN32
    /* main() gets ANSI arguments on Windows; the app gets UTF-8 from SDL, so test with UTF-8 too */
    static char u8[3][1024];
    int wn = 0; wchar_t **wa = CommandLineToArgvW(GetCommandLineW(), &wn);
    for (int i = 1; i < wn && i < 3; i++) { WideCharToMultiByte(CP_UTF8, 0, wa[i], -1, u8[i], 1024, NULL, NULL); argv[i] = u8[i]; }
#endif
    dir = argv[1];
    tp_core_init();
    test_blend();
    test_pressure();
    test_opacity_flow_erase();
    test_undo();
    test_fill();
    test_formats();
    test_presets();
    if (argc > 2) test_mods(argv[2]);
    test_unicode_paths(argc > 2);
    printf("%d passed, %d failed\n", passes, fails);
    return fails ? 1 : 0;
}
