/* SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
 * pgm-export -- an example format mod: save the picture as a grayscale
 * Portable Graymap (.pgm, P5) laid on white, and read P5 files back.
 * It builds the file in memory and lets the host write it, so UTF-8 paths
 * work on Windows and no FILE* crosses between C runtimes. */
#include "tpaint_mod.h"
#include <stdio.h>
#include <string.h>
#include <ctype.h>

static const TpHost *H;

static int save_pgm(const char *path, const TpImage *img, void *user) {
    (void)user;
    char head[96];
    int hn = snprintf(head, sizeof head, "P5\n# made by topology paint's pgm-export mod\n%d %d\n255\n", img->w, img->h);
    size_t n = (size_t)hn + (size_t)img->w * img->h;
    unsigned char *out = H->alloc(n);
    if (!out) return -1;
    memcpy(out, head, (size_t)hn);
    unsigned char *o = out + hn;
    for (int y = 0; y < img->h; y++) {
        const uint8_t *p = img->px + (size_t)y * img->stride;
        for (int x = 0; x < img->w; x++, p += 4) {
            int g = (p[0] * 54 + p[1] * 183 + p[2] * 19) >> 8, a = p[3];
            *o++ = (unsigned char)((g * a + 255 * (255 - a)) / 255);
        }
    }
    int r = H->write_file(path, out, n);
    H->free(out);
    return r;
}

/* the next number in the header, past blanks and # comments */
static int number(const unsigned char *s, size_t n, size_t *at) {
    while (*at < n) {
        if (s[*at] == '#') { while (*at < n && s[*at] != '\n') (*at)++; }
        else if (isspace(s[*at])) (*at)++;
        else break;
    }
    if (*at >= n || !isdigit(s[*at])) return -1;
    int v = 0;
    while (*at < n && isdigit(s[*at]) && v < 100000) v = v * 10 + (s[(*at)++] - '0');
    return v;
}

static int load_pgm(const char *path, TpImage *out, void *user) {
    (void)user;
    size_t n = 0, at = 2;
    unsigned char *s = H->read_file(path, &n);
    if (!s) return -1;
    int w = -1, h = -1, mx = -1;
    if (n > 2 && s[0] == 'P' && s[1] == '5') { w = number(s, n, &at); h = number(s, n, &at); mx = number(s, n, &at); }
    at++;                                         /* the one blank after the header */
    if (w <= 0 || h <= 0 || w > 16384 || h > 16384 || mx != 255 || at + (size_t)w * h > n) { H->free(s); return -1; }
    out->w = w; out->h = h; out->stride = w * 4;
    out->px = H->alloc((size_t)w * h * 4);
    if (!out->px) { H->free(s); return -1; }
    for (size_t i = 0; i < (size_t)w * h; i++) {
        unsigned char g = s[at + i];
        out->px[i * 4] = out->px[i * 4 + 1] = out->px[i * 4 + 2] = g; out->px[i * 4 + 3] = 255;
    }
    H->free(s);
    return 0;
}

static const TpFormat PGM = { "Portable Graymap (mod)", "pgm", save_pgm, load_pgm, NULL };

TPAINT_MOD_EXPORT int tpaint_mod_init(const TpHost *host) {
    if (host->api_version < 1) return 1;
    H = host;
    return host->register_format(&PGM);
}
