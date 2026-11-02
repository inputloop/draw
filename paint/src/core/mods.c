/* SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
 * mods.c -- the mod host: filters, brush tips and formats registered by the
 * program itself and by shared libraries in a mods folder; plus the few
 * things that differ between Windows and POSIX (files, folders, libraries).
 */
#include "tpaint.h"
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <stdarg.h>
#include <math.h>
#include <ctype.h>
#ifdef _WIN32
#  define WIN32_LEAN_AND_MEAN
#  include <windows.h>
#else
#  include <dlfcn.h>
#  include <dirent.h>
#endif

int tp_format_register_mod(const TpFormat *m);
void tp_formats_init(void);

/* ------------------------------------------------------------ logging */
static void (*log_fn)(const char *);
void tp_set_log(void (*fn)(const char *)) { log_fn = fn; }
void tp_log(const char *fmt, ...) {
    char b[1024]; va_list ap; va_start(ap, fmt); vsnprintf(b, sizeof b, fmt, ap); va_end(ap);
    fprintf(stderr, "topology-paint: %s\n", b);
    if (log_fn) log_fn(b);
}
static void host_log(const char *m) { tp_log("%s", m ? m : ""); }

/* ------------------------------------------------------------ files */
FILE *tp_fopen(const char *path, const char *mode) {
#ifdef _WIN32
    /* the file dialogs hand back UTF-8; fopen would read it as the ANSI code page */
    wchar_t wp[1024], wm[8];
    if (!MultiByteToWideChar(CP_UTF8, 0, path, -1, wp, 1024) || !MultiByteToWideChar(CP_UTF8, 0, mode, -1, wm, 8)) return NULL;
    return _wfopen(wp, wm);
#else
    return fopen(path, mode);
#endif
}
char *tp_read_file(const char *path, size_t *n) {
    FILE *f = tp_fopen(path, "rb"); if (!f) return NULL;
    if (fseek(f, 0, SEEK_END)) { fclose(f); return NULL; }
    long len = ftell(f); if (len < 0) { fclose(f); return NULL; }
    rewind(f);
    char *p = malloc((size_t)len + 1);
    if (!p || fread(p, 1, (size_t)len, f) != (size_t)len) { free(p); fclose(f); return NULL; }
    fclose(f); p[len] = 0; if (n) *n = (size_t)len;
    return p;
}
int tp_write_file(const char *path, const void *data, size_t n) {
    FILE *f = tp_fopen(path, "wb"); if (!f) return -1;
    int bad = fwrite(data, 1, n, f) != n;
    if (fclose(f)) bad = 1;
    return bad ? -1 : 0;
}
const char *tp_path_ext(const char *path) {
    static char e[16];
    const char *dot = strrchr(path, '.'), *sl = strrchr(path, '/'), *bs = strrchr(path, '\\');
    if (bs > sl) sl = bs;
    e[0] = 0;
    if (!dot || (sl && dot < sl)) return e;
    size_t k = 0; for (const char *c = dot + 1; *c && k < sizeof e - 1; c++) e[k++] = (char)tolower((unsigned char)*c);
    e[k] = 0;
    return e;
}
int tp_list_dir(const char *dir, const char *ext, char names[][256], int max) {
    int n = 0;
#ifdef _WIN32
    char pat[1024]; snprintf(pat, sizeof pat, "%s\\*.%s", dir, ext);
    wchar_t wpat[1024];
    if (!MultiByteToWideChar(CP_UTF8, 0, pat, -1, wpat, 1024)) return 0;
    WIN32_FIND_DATAW fd; HANDLE h = FindFirstFileW(wpat, &fd);
    if (h == INVALID_HANDLE_VALUE) return 0;
    do {
        if (!(fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) && n < max &&
            WideCharToMultiByte(CP_UTF8, 0, fd.cFileName, -1, names[n], 256, NULL, NULL)) n++;
    } while (FindNextFileW(h, &fd));
    FindClose(h);
#else
    DIR *d = opendir(dir); if (!d) return 0;
    struct dirent *e;
    while ((e = readdir(d)) && n < max) {
        if (e->d_name[0] == '.') continue;
        if (!strcmp(tp_path_ext(e->d_name), ext)) snprintf(names[n++], 256, "%s", e->d_name);
    }
    closedir(d);
#endif
    /* sorted, so the order on screen does not depend on the file system */
    for (int i = 1; i < n; i++) for (int j = i; j > 0 && strcmp(names[j - 1], names[j]) > 0; j--) {
        char t[256]; memcpy(t, names[j], 256); memcpy(names[j], names[j - 1], 256); memcpy(names[j - 1], t, 256);
    }
    return n;
}

/* ------------------------------------------------------------ filters */
#define MAX_FILTERS 64
static TpFilterEntry FILTERS[MAX_FILTERS];
static int nfilters;
static int add_filter(const char *name, int (*fn)(TpImage *, void *), const TpFilter *mod) {
    if (nfilters >= MAX_FILTERS) return -1;
    TpFilterEntry *f = &FILTERS[nfilters++];
    snprintf(f->name, sizeof f->name, "%s", name); f->builtin = fn; f->mod = mod; f->user = NULL;
    return 0;
}
int tp_filters_count(void) { return nfilters; }
const TpFilterEntry *tp_filter_at(int i) { return i >= 0 && i < nfilters ? &FILTERS[i] : NULL; }

static int f_invert(TpImage *im, void *u) {
    (void)u;
    for (int y = 0; y < im->h; y++) { uint8_t *p = im->px + (size_t)y * im->stride;
        for (int x = 0; x < im->w; x++, p += 4) { p[0] = 255 - p[0]; p[1] = 255 - p[1]; p[2] = 255 - p[2]; } }
    return 0;
}
static int f_desaturate(TpImage *im, void *u) {
    (void)u;
    for (int y = 0; y < im->h; y++) { uint8_t *p = im->px + (size_t)y * im->stride;
        for (int x = 0; x < im->w; x++, p += 4) { uint8_t g = (uint8_t)((p[0] * 54 + p[1] * 183 + p[2] * 19) >> 8); p[0] = p[1] = p[2] = g; } }
    return 0;
}
/* three box passes approximate a Gaussian; done on premultiplied values so edges do not darken */
static void box_pass(float *src, float *dst, int w, int h, int r, int horiz) {
    int len = horiz ? w : h, lines = horiz ? h : w;
    for (int l = 0; l < lines; l++) {
        for (int c = 0; c < 4; c++) {
            float acc = 0; int cnt = 0;
            for (int i = -r; i <= r; i++) { int k = i < 0 ? 0 : i >= len ? len - 1 : i; acc += src[(horiz ? ((size_t)l * w + k) : ((size_t)k * w + l)) * 4 + c]; cnt++; }
            for (int i = 0; i < len; i++) {
                dst[(horiz ? ((size_t)l * w + i) : ((size_t)i * w + l)) * 4 + c] = acc / cnt;
                int out = i - r < 0 ? 0 : i - r, in = i + r + 1 >= len ? len - 1 : i + r + 1;
                acc += src[(horiz ? ((size_t)l * w + in) : ((size_t)in * w + l)) * 4 + c] - src[(horiz ? ((size_t)l * w + out) : ((size_t)out * w + l)) * 4 + c];
            }
        }
    }
}
static void blur_into(TpImage *im, float *a, int radius) {
    size_t N = (size_t)im->w * im->h;
    float *b = malloc(N * 4 * sizeof(float));
    for (int pass = 0; pass < 3; pass++) { box_pass(a, b, im->w, im->h, radius, 1); box_pass(b, a, im->w, im->h, radius, 0); }
    free(b);
}
static float *to_premul_f(const TpImage *im) {
    size_t N = (size_t)im->w * im->h; float *a = malloc(N * 4 * sizeof(float));
    for (int y = 0; y < im->h; y++) for (int x = 0; x < im->w; x++) {
        const uint8_t *p = im->px + (size_t)y * im->stride + (size_t)x * 4; float *q = a + ((size_t)y * im->w + x) * 4;
        float al = p[3] / 255.0f; q[0] = p[0] * al; q[1] = p[1] * al; q[2] = p[2] * al; q[3] = p[3];
    }
    return a;
}
static void from_premul_f(TpImage *im, const float *a) {
    for (int y = 0; y < im->h; y++) for (int x = 0; x < im->w; x++) {
        uint8_t *p = im->px + (size_t)y * im->stride + (size_t)x * 4; const float *q = a + ((size_t)y * im->w + x) * 4;
        float al = q[3] < 0 ? 0 : q[3] > 255 ? 255 : q[3];
        p[3] = (uint8_t)(al + 0.5f);
        for (int c = 0; c < 3; c++) { float v = al > 0 ? q[c] / (al / 255.0f) : 0; p[c] = (uint8_t)(v < 0 ? 0 : v > 255 ? 255 : v + 0.5f); }
    }
}
static int f_blur(TpImage *im, void *u) {
    (void)u; float *a = to_premul_f(im); blur_into(im, a, 2); from_premul_f(im, a); free(a); return 0;
}
static int f_sharpen(TpImage *im, void *u) {
    (void)u;
    float *a = to_premul_f(im), *o = to_premul_f(im);
    blur_into(im, a, 1);
    size_t N = (size_t)im->w * im->h;
    for (size_t i = 0; i < N * 4; i++) { if (i % 4 == 3) continue; o[i] = o[i] + 0.8f * (o[i] - a[i]); if (o[i] < 0) o[i] = 0; if (o[i] > o[i - i % 4 + 3]) o[i] = o[i - i % 4 + 3]; }
    from_premul_f(im, o); free(a); free(o); return 0;
}
static int f_brighten(TpImage *im, void *u) {
    (void)u;
    for (int y = 0; y < im->h; y++) { uint8_t *p = im->px + (size_t)y * im->stride;
        for (int x = 0; x < im->w; x++, p += 4) for (int c = 0; c < 3; c++) { int v = p[c] + 16; p[c] = v > 255 ? 255 : (uint8_t)v; } }
    return 0;
}
static int f_darken(TpImage *im, void *u) {
    (void)u;
    for (int y = 0; y < im->h; y++) { uint8_t *p = im->px + (size_t)y * im->stride;
        for (int x = 0; x < im->w; x++, p += 4) for (int c = 0; c < 3; c++) { int v = p[c] - 16; p[c] = v < 0 ? 0 : (uint8_t)v; } }
    return 0;
}

int tp_filter_apply(TpDoc *d, int i) {
    const TpFilterEntry *f = tp_filter_at(i);
    if (!f || d->nlayers == 0) return -1;
    TpLayer *L = &d->layers[d->active];
    size_t N = (size_t)d->w * d->h;
    TpImage im = { d->w, d->h, d->w * 4, malloc(N * 4) };
    memcpy(im.px, L->buf->px, N * 4);
    tp_unpremul(im.px, N);
    int r = f->mod ? f->mod->apply(&im, f->mod->user) : f->builtin(&im, f->user);
    if (r == 0) {
        tp_premul(im.px, N);
        tp_undo_begin_pixels(d, d->active);
        memcpy(tp_layer_px_mut(d, L), im.px, N * 4);
        tp_undo_touch(d, 0, 0, d->w, d->h);
        tp_undo_end_pixels(d);
    }
    free(im.px);
    return r;
}

/* ------------------------------------------------------------ tips */
#define MAX_TIPS 64
static const TpTip *TIPS[MAX_TIPS];
static int ntips;
int tp_tips_count(void) { return ntips; }
const TpTip *tp_tip_at(int i) { return i >= 0 && i < ntips ? TIPS[i] : NULL; }
const TpTip *tp_tip_find(const char *name) {
    for (int i = ntips - 1; i >= 0; i--) if (!strcmp(TIPS[i]->name, name)) return TIPS[i];
    return NULL;
}
static float tip_ring(float x, float y, void *u) { (void)u; float r = sqrtf(x * x + y * y); float d = fabsf(r - 0.75f); return d < 0.25f ? 1 - d / 0.25f : 0; }
static float tip_grain(float x, float y, void *u) {
    (void)u; float r = sqrtf(x * x + y * y); if (r > 1) return 0;
    unsigned h = (unsigned)((x + 2) * 977) * 2654435761u ^ (unsigned)((y + 2) * 1231) * 40503u;
    h ^= h >> 13; h *= 0x5bd1e995u; h ^= h >> 15;
    return ((h & 255) / 255.0f) * (1 - r * r);
}
static const TpTip TIP_RING = { "ring", tip_ring, NULL };
static const TpTip TIP_GRAIN = { "grain", tip_grain, NULL };

/* ------------------------------------------------------------ the host */
static int reg_filter(const TpFilter *f) { return f && f->name && f->apply ? add_filter(f->name, NULL, f) : -1; }
static int reg_tip(const TpTip *t) { if (!t || !t->name || !t->coverage || ntips >= MAX_TIPS) return -1; TIPS[ntips++] = t; return 0; }
static void *h_alloc(size_t n) { return malloc(n); }
static void h_free(void *p) { free(p); }
static void *h_read(const char *p, size_t *n) { return tp_read_file(p, n); }
static const TpHost HOST = { TPAINT_MOD_API_VERSION, TPAINT_VERSION, host_log, reg_filter, tp_format_register_mod, reg_tip, h_alloc, h_free, h_read, tp_write_file };
const TpHost *tp_host(void) { return &HOST; }

void tp_core_init(void) {
    static int done; if (done) return; done = 1;
    tp_formats_init();
    add_filter("Invert", f_invert, NULL);
    add_filter("Desaturate", f_desaturate, NULL);
    add_filter("Gaussian Blur", f_blur, NULL);
    add_filter("Sharpen", f_sharpen, NULL);
    add_filter("Brighten", f_brighten, NULL);
    add_filter("Darken", f_darken, NULL);
    reg_tip(&TIP_RING);
    reg_tip(&TIP_GRAIN);
}

#define MAX_MODS 64
static char MOD_NAMES[MAX_MODS][256];
static int nmods;
int tp_mods_loaded(void) { return nmods; }
const char *tp_mod_name(int i) { return i >= 0 && i < nmods ? MOD_NAMES[i] : ""; }

int tp_mods_load_dir(const char *dir) {
#ifdef _WIN32
    const char *ext = "dll";
#elif defined(__APPLE__)
    const char *ext = "dylib";
#else
    const char *ext = "so";
#endif
    static char names[MAX_MODS][256];
    int n = tp_list_dir(dir, ext, names, MAX_MODS), loaded = 0;
    for (int i = 0; i < n && nmods < MAX_MODS; i++) {
        char path[1024]; snprintf(path, sizeof path, "%s/%s", dir, names[i]);
        int dup = 0; for (int k = 0; k < nmods; k++) if (!strcmp(MOD_NAMES[k], names[i])) dup = 1;
        if (dup) { tp_log("mod %s: already loaded from another folder, skipped", names[i]); continue; }
#ifdef _WIN32
        wchar_t wpath[1024];
        HMODULE h = MultiByteToWideChar(CP_UTF8, 0, path, -1, wpath, 1024) ? LoadLibraryW(wpath) : NULL;
        TpModInitFn init = h ? (TpModInitFn)(void (*)(void))GetProcAddress(h, TPAINT_MOD_INIT_SYMBOL) : NULL;
#else
        void *h = dlopen(path, RTLD_NOW | RTLD_LOCAL);
        TpModInitFn init = NULL;
        if (h) { void *sym = dlsym(h, TPAINT_MOD_INIT_SYMBOL); memcpy(&init, &sym, sizeof init); }
        else tp_log("mod %s: %s", names[i], dlerror());
#endif
        if (!init) { tp_log("mod %s: no %s, not loaded", names[i], TPAINT_MOD_INIT_SYMBOL); continue; }
        int r = init(&HOST);
        if (r) { tp_log("mod %s: its init said %d, not loaded", names[i], r); continue; }
        snprintf(MOD_NAMES[nmods++], 256, "%s", names[i]);
        loaded++;
        tp_log("mod loaded: %s", names[i]);
        /* the library stays loaded for the life of the program: what it registered points into it */
    }
    return loaded;
}
