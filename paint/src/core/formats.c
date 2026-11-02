/* SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
 * formats.c -- every file format topology paint reads and writes.
 *
 *   layered:  OpenRaster .ora (the native format; Krita, GIMP, MyPaint read it)
 *             Photoshop .psd (8-bit RGB, layers, blend modes, PackBits RLE)
 *   flat:     PNG, JPEG, BMP, TGA, TIFF, QOI, PPM  (read and write)
 *             GIF (first frame), Radiance HDR, PGM  (read)
 *   + any format a mod registers (see mods.c)
 *
 * stb_image/stb_image_write do PNG, JPEG, BMP, TGA, GIF, HDR, PNM; the rest
 * is written here from the published specifications.
 */
#include "tpaint.h"
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <math.h>
#include <ctype.h>

#ifdef _WIN32
#define STBI_WINDOWS_UTF8
#define STBIW_WINDOWS_UTF8
#endif
#define STB_IMAGE_IMPLEMENTATION
#define STBI_NO_PIC
#if defined(__GNUC__)
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wunused-function"
#pragma GCC diagnostic ignored "-Wsign-compare"
#endif
#include "../../third_party/stb/stb_image.h"
#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "../../third_party/stb/stb_image_write.h"
#if defined(__GNUC__)
#pragma GCC diagnostic pop
#endif

int tp_jpeg_quality = 92;

#define ERR(...) do { if (err) snprintf(err, errn, __VA_ARGS__); } while (0)

/* ------------------------------------------------------------ growable buffer */
typedef struct { uint8_t *p; size_t n, cap; } Buf;
static void b_need(Buf *b, size_t k) {
    if (b->n + k <= b->cap) return;
    size_t c = b->cap ? b->cap : 4096; while (c < b->n + k) c *= 2;
    uint8_t *np = realloc(b->p, c); if (!np) { fprintf(stderr, "out of memory\n"); abort(); }
    b->p = np; b->cap = c;
}
static void b_put(Buf *b, const void *d, size_t k) { b_need(b, k); memcpy(b->p + b->n, d, k); b->n += k; }
static void b_u8(Buf *b, unsigned v) { uint8_t c = (uint8_t)v; b_put(b, &c, 1); }
static void b_be16(Buf *b, unsigned v) { b_u8(b, v >> 8); b_u8(b, v); }
static void b_be32(Buf *b, uint32_t v) { b_be16(b, v >> 16); b_be16(b, v & 0xffff); }
static void b_le16(Buf *b, unsigned v) { b_u8(b, v); b_u8(b, v >> 8); }
static void b_le32(Buf *b, uint32_t v) { b_le16(b, v & 0xffff); b_le16(b, v >> 16); }
static void b_set_be32(Buf *b, size_t at, uint32_t v) { b->p[at] = v >> 24; b->p[at + 1] = v >> 16; b->p[at + 2] = v >> 8; b->p[at + 3] = (uint8_t)v; }
static uint32_t rd_be32(const uint8_t *p) { return (uint32_t)p[0] << 24 | (uint32_t)p[1] << 16 | (uint32_t)p[2] << 8 | p[3]; }
static unsigned rd_be16(const uint8_t *p) { return (unsigned)p[0] << 8 | p[1]; }
static uint32_t rd_le32(const uint8_t *p) { return (uint32_t)p[3] << 24 | (uint32_t)p[2] << 16 | (uint32_t)p[1] << 8 | p[0]; }
static unsigned rd_le16(const uint8_t *p) { return (unsigned)p[1] << 8 | p[0]; }

static TpDoc *doc_from_image(const TpImage *im, const char *name) {
    TpDoc *d = tp_doc_new_empty(im->w, im->h);
    tp_layer_add_image(d, name ? name : "Background", im);
    d->dirty = 0;
    return d;
}

/* ------------------------------------------------------------ crc32 and zip */
uint32_t tp_crc32(const void *data, size_t n) {
    static uint32_t T[256]; static int init = 0;
    if (!init) { for (uint32_t i = 0; i < 256; i++) { uint32_t c = i; for (int k = 0; k < 8; k++) c = c & 1 ? 0xedb88320u ^ (c >> 1) : c >> 1; T[i] = c; } init = 1; }
    uint32_t c = 0xffffffffu; const uint8_t *p = data;
    for (size_t i = 0; i < n; i++) c = T[(c ^ p[i]) & 255] ^ (c >> 8);
    return c ^ 0xffffffffu;
}
struct TpZipW { FILE *f; Buf cd; int count; uint32_t off; int bad; };
TpZipW *tp_zipw_open(const char *path) {
    FILE *f = tp_fopen(path, "wb"); if (!f) return NULL;
    TpZipW *z = calloc(1, sizeof *z); z->f = f; return z;
}
int tp_zipw_add(TpZipW *z, const char *name, const void *data, size_t n) {
    Buf h = {0}; uint32_t crc = tp_crc32(data, n); size_t nl = strlen(name);
    const unsigned dtime = 0, ddate = (46u << 9) | (11u << 5) | 1u;   /* 2026-11-01, a fixed stamp: same input, same file */
    b_le32(&h, 0x04034b50); b_le16(&h, 10); b_le16(&h, 0); b_le16(&h, 0); b_le16(&h, dtime); b_le16(&h, ddate);
    b_le32(&h, crc); b_le32(&h, (uint32_t)n); b_le32(&h, (uint32_t)n); b_le16(&h, (unsigned)nl); b_le16(&h, 0);
    b_put(&h, name, nl);
    if (fwrite(h.p, 1, h.n, z->f) != h.n || (n && fwrite(data, 1, n, z->f) != n)) z->bad = 1;
    Buf *c = &z->cd;
    b_le32(c, 0x02014b50); b_le16(c, 20); b_le16(c, 10); b_le16(c, 0); b_le16(c, 0); b_le16(c, dtime); b_le16(c, ddate);
    b_le32(c, crc); b_le32(c, (uint32_t)n); b_le32(c, (uint32_t)n); b_le16(c, (unsigned)nl); b_le16(c, 0); b_le16(c, 0);
    b_le16(c, 0); b_le16(c, 0); b_le32(c, 0); b_le32(c, z->off); b_put(c, name, nl);
    z->off += (uint32_t)(h.n + n); z->count++;
    free(h.p);
    return z->bad ? -1 : 0;
}
int tp_zipw_close(TpZipW *z) {
    Buf e = {0};
    b_le32(&e, 0x06054b50); b_le16(&e, 0); b_le16(&e, 0); b_le16(&e, z->count); b_le16(&e, z->count);
    b_le32(&e, (uint32_t)z->cd.n); b_le32(&e, z->off); b_le16(&e, 0);
    if (fwrite(z->cd.p, 1, z->cd.n, z->f) != z->cd.n || fwrite(e.p, 1, e.n, z->f) != e.n) z->bad = 1;
    if (fclose(z->f)) z->bad = 1;
    int bad = z->bad; free(z->cd.p); free(e.p); free(z);
    return bad ? -1 : 0;
}
void *tp_zip_extract(const uint8_t *zip, size_t zn, const char *name, size_t *out_n) {
    if (zn < 22) return NULL;
    size_t e = zn - 22, stop = zn > 65557 ? zn - 65557 : 0;
    for (;; e--) { if (rd_le32(zip + e) == 0x06054b50) break; if (e == stop) return NULL; }
    unsigned count = rd_le16(zip + e + 10);
    size_t cd = rd_le32(zip + e + 16);
    size_t nl0 = strlen(name);
    for (unsigned i = 0; i < count; i++) {
        if (cd + 46 > zn || rd_le32(zip + cd) != 0x02014b50) return NULL;
        unsigned method = rd_le16(zip + cd + 10);
        size_t csize = rd_le32(zip + cd + 20), usize = rd_le32(zip + cd + 24);
        unsigned nl = rd_le16(zip + cd + 28), xl = rd_le16(zip + cd + 30), cl = rd_le16(zip + cd + 32);
        size_t lho = rd_le32(zip + cd + 42);
        if (cd + 46 + nl > zn) return NULL;
        if (nl == nl0 && !memcmp(zip + cd + 46, name, nl)) {
            if (lho + 30 > zn || rd_le32(zip + lho) != 0x04034b50) return NULL;
            size_t data = lho + 30 + rd_le16(zip + lho + 26) + rd_le16(zip + lho + 28);
            if (data + csize > zn) return NULL;
            if (method == 0) {
                void *o = malloc(csize ? csize : 1); if (!o) return NULL;
                memcpy(o, zip + data, csize); *out_n = csize; return o;
            }
            if (method == 8) {
                int on = 0;
                char *o = stbi_zlib_decode_noheader_malloc((const char *)zip + data, (int)csize, &on);
                if (!o) return NULL;
                (void)usize; *out_n = (size_t)on; return o;
            }
            return NULL;
        }
        cd += 46 + nl + xl + cl;
    }
    return NULL;
}

/* ------------------------------------------------------------ PNG helper */
void *tp_png_encode(const TpImage *im, int *out_len) {
    return stbi_write_png_to_mem(im->px, im->stride, im->w, im->h, 4, out_len);
}
static TpImage layer_straight(const TpDoc *d, int i) {
    TpImage im = { d->w, d->h, d->w * 4, malloc((size_t)d->w * d->h * 4) };
    memcpy(im.px, d->layers[i].buf->px, (size_t)d->w * d->h * 4);
    tp_unpremul(im.px, (size_t)d->w * d->h);
    return im;
}

/* ------------------------------------------------------------ OpenRaster */
static void xml_escape(Buf *b, const char *s) {
    for (; *s; s++) {
        switch (*s) {
        case '&': b_put(b, "&amp;", 5); break; case '<': b_put(b, "&lt;", 4); break;
        case '>': b_put(b, "&gt;", 4); break; case '"': b_put(b, "&quot;", 6); break;
        default: b_u8(b, (unsigned char)*s);
        }
    }
}
static void b_str(Buf *b, const char *s) { b_put(b, s, strlen(s)); }
static int save_ora(const TpDoc *d, const char *path, char *err, size_t errn) {
    TpZipW *z = tp_zipw_open(path);
    if (!z) { ERR("cannot write %s", path); return -1; }
    int bad = tp_zipw_add(z, "mimetype", "image/openraster", 16);
    Buf x = {0}; char t[256];
    snprintf(t, sizeof t, "<?xml version='1.0' encoding='UTF-8'?>\n<image version=\"0.0.5\" w=\"%d\" h=\"%d\" xres=\"72\" yres=\"72\">\n <stack>\n", d->w, d->h);
    b_str(&x, t);
    for (int i = d->nlayers - 1; i >= 0; i--) {
        const TpLayer *l = &d->layers[i];
        b_str(&x, "  <layer name=\""); xml_escape(&x, l->name);
        snprintf(t, sizeof t, "\" src=\"data/layer%03d.png\" x=\"0\" y=\"0\" opacity=\"%.4f\" visibility=\"%s\" composite-op=\"%s\"%s />\n",
                 i, l->opacity, l->visible ? "visible" : "hidden", tp_blend_ora(l->blend), l->alpha_lock ? " alpha-preserve=\"true\"" : "");
        b_str(&x, t);
        TpImage im = layer_straight(d, i);
        int n = 0; void *png = tp_png_encode(&im, &n);
        char nm[64]; snprintf(nm, sizeof nm, "data/layer%03d.png", i);
        if (!png || tp_zipw_add(z, nm, png, (size_t)n)) bad = 1;
        STBIW_FREE(png); tp_image_free(&im);
    }
    b_str(&x, " </stack>\n</image>\n");
    if (tp_zipw_add(z, "stack.xml", x.p, x.n)) bad = 1;
    free(x.p);
    TpImage flat = tp_flatten(d);
    int n = 0; void *png = tp_png_encode(&flat, &n);
    if (!png || tp_zipw_add(z, "mergedimage.png", png, (size_t)n)) bad = 1;
    STBIW_FREE(png);
    /* a thumbnail no bigger than 256 on its long side */
    int tw = d->w, th = d->h;
    if (tw > 256 || th > 256) { if (tw >= th) { th = (int)((long long)th * 256 / tw); tw = 256; } else { tw = (int)((long long)tw * 256 / th); th = 256; } }
    if (tw < 1) tw = 1; if (th < 1) th = 1;
    TpImage thumb = { tw, th, tw * 4, malloc((size_t)tw * th * 4) };
    for (int y = 0; y < th; y++) for (int xx = 0; xx < tw; xx++)
        memcpy(thumb.px + ((size_t)y * tw + xx) * 4, flat.px + ((size_t)(y * d->h / th) * d->w + (size_t)xx * d->w / tw) * 4, 4);
    png = tp_png_encode(&thumb, &n);
    if (!png || tp_zipw_add(z, "Thumbnails/thumbnail.png", png, (size_t)n)) bad = 1;
    STBIW_FREE(png); tp_image_free(&thumb); tp_image_free(&flat);
    if (tp_zipw_close(z)) bad = 1;
    if (bad) ERR("could not write all of %s", path);
    return bad ? -1 : 0;
}
static int attr(const char *tag, const char *end, const char *key, char *out, size_t on) {
    size_t kl = strlen(key);
    for (const char *p = tag; p + kl + 2 < end; p++) {
        if ((p == tag || isspace((unsigned char)p[-1])) && !strncmp(p, key, kl) && p[kl] == '=' && (p[kl + 1] == '"' || p[kl + 1] == '\'')) {
            char q = p[kl + 1]; const char *v = p + kl + 2; size_t k = 0;
            while (v < end && *v != q && k + 1 < on) {
                if (*v == '&') {
                    static const struct { const char *e; char c; } E[] = {{"&amp;", '&'}, {"&lt;", '<'}, {"&gt;", '>'}, {"&quot;", '"'}, {"&apos;", '\''}};
                    int hit = 0;
                    for (int i = 0; i < 5; i++) { size_t el = strlen(E[i].e); if (!strncmp(v, E[i].e, el)) { out[k++] = E[i].c; v += el; hit = 1; break; } }
                    if (hit) continue;
                }
                out[k++] = *v++;
            }
            out[k] = 0;
            return 1;
        }
    }
    return 0;
}
static TpDoc *load_ora(const uint8_t *z, size_t zn, char *err, size_t errn) {
    size_t xn = 0; char *xml = tp_zip_extract(z, zn, "stack.xml", &xn);
    if (!xml) { ERR("not an OpenRaster file (no stack.xml)"); return NULL; }
    char *xz = realloc(xml, xn + 1); if (!xz) { free(xml); return NULL; } xml = xz; xml[xn] = 0;
    char v[1024];
    const char *im = strstr(xml, "<image");
    if (!im) { free(xml); ERR("stack.xml has no <image>"); return NULL; }
    const char *ie = strchr(im, '>');
    int w = attr(im, ie, "w", v, sizeof v) ? atoi(v) : 0, h = attr(im, ie, "h", v, sizeof v) ? atoi(v) : 0;
    if (w <= 0 || h <= 0 || w > TP_MAX_SIDE || h > TP_MAX_SIDE) { free(xml); ERR("bad picture size %dx%d", w, h); return NULL; }
    TpDoc *d = tp_doc_new_empty(w, h);
    /* stack.xml lists the top layer first; collect, then add bottom-up */
    const char *tags[TP_MAX_LAYERS]; int nt = 0;
    for (const char *p = ie; (p = strstr(p, "<layer")) && nt < TP_MAX_LAYERS; p += 6)
        if (isspace((unsigned char)p[6])) tags[nt++] = p;
    for (int t = nt - 1; t >= 0; t--) {
        const char *tg = tags[t], *te = strchr(tg, '>'); if (!te) continue;
        char src[512], name[TP_NAME_MAX] = "Layer";
        if (!attr(tg, te, "src", src, sizeof src)) continue;
        attr(tg, te, "name", name, sizeof name);
        size_t pn = 0; uint8_t *png = tp_zip_extract(z, zn, src, &pn);
        if (!png) continue;
        int iw, ih, c; uint8_t *px = stbi_load_from_memory(png, (int)pn, &iw, &ih, &c, 4);
        free(png);
        if (!px) continue;
        int ox = attr(tg, te, "x", v, sizeof v) ? atoi(v) : 0, oy = attr(tg, te, "y", v, sizeof v) ? atoi(v) : 0;
        int li = tp_layer_add(d, d->nlayers, name);
        if (li < 0) { stbi_image_free(px); break; }
        TpLayer *L = &d->layers[li];
        for (int y = 0; y < ih; y++) {
            int ty = y + oy; if (ty < 0 || ty >= h) continue;
            for (int x = 0; x < iw; x++) {
                int tx = x + ox; if (tx < 0 || tx >= w) continue;
                memcpy(L->buf->px + ((size_t)ty * w + tx) * 4, px + ((size_t)y * iw + x) * 4, 4);
            }
        }
        tp_premul(L->buf->px, (size_t)w * h);
        stbi_image_free(px);
        if (attr(tg, te, "opacity", v, sizeof v)) { float o = (float)atof(v); L->opacity = o < 0 ? 0 : o > 1 ? 1 : o; }
        if (attr(tg, te, "visibility", v, sizeof v)) L->visible = strcmp(v, "hidden") != 0;
        if (attr(tg, te, "composite-op", v, sizeof v)) L->blend = tp_blend_from_ora(v);
        if (attr(tg, te, "alpha-preserve", v, sizeof v)) L->alpha_lock = !strcmp(v, "true");
    }
    free(xml);
    if (d->nlayers == 0) {
        /* no readable layers: fall back to the merged image */
        size_t pn = 0; uint8_t *png = tp_zip_extract(z, zn, "mergedimage.png", &pn);
        int iw, ih, c; uint8_t *px = png ? stbi_load_from_memory(png, (int)pn, &iw, &ih, &c, 4) : NULL;
        free(png);
        if (!px) { tp_doc_free(d); ERR("OpenRaster file has no readable layers"); return NULL; }
        TpImage img = { iw, ih, iw * 4, px }; tp_layer_add_image(d, "Background", &img); stbi_image_free(px);
    }
    d->active = d->nlayers - 1; d->dirty = 0;
    return d;
}

/* ------------------------------------------------------------ PackBits (PSD, TIFF) */
static void packbits_row(Buf *b, const uint8_t *row, int n) {
    int i = 0;
    while (i < n) {
        int j = i;
        while (j + 1 < n && row[j + 1] == row[i] && j - i < 127) j++;
        int run = j - i + 1;
        if (run >= 3) { b_u8(b, (unsigned)(257 - run)); b_u8(b, row[i]); i = j + 1; continue; }
        int st = i;
        while (i < n && i - st < 128) {
            if (i + 2 < n && row[i] == row[i + 1] && row[i] == row[i + 2]) break;
            i++;
        }
        b_u8(b, (unsigned)(i - st - 1)); b_put(b, row + st, (size_t)(i - st));
    }
}
static int unpackbits(const uint8_t *s, size_t sn, uint8_t *out, size_t on) {
    size_t i = 0, o = 0;
    while (i < sn && o < on) {
        int c = (int8_t)s[i++];
        if (c >= 0) { size_t k = (size_t)c + 1; if (i + k > sn || o + k > on) return -1; memcpy(out + o, s + i, k); i += k; o += k; }
        else if (c != -128) { size_t k = (size_t)(1 - c); if (i >= sn || o + k > on) return -1; memset(out + o, s[i++], k); o += k; }
    }
    return o == on ? 0 : -1;
}

/* ------------------------------------------------------------ Photoshop */
static void psd_channel_rle(Buf *b, const uint8_t *straight, int w, int h, int ch) {
    /* compression 1, then a 2-byte length per row, then the rows */
    uint8_t *row = malloc((size_t)w);
    Buf data = {0};
    size_t counts = b->n + 2;
    b_be16(b, 1);
    for (int y = 0; y < h; y++) b_be16(b, 0);
    for (int y = 0; y < h; y++) {
        for (int x = 0; x < w; x++) row[x] = straight[((size_t)y * w + x) * 4 + ch];
        size_t before = data.n;
        packbits_row(&data, row, w);
        size_t len = data.n - before;
        b->p[counts + (size_t)y * 2] = (uint8_t)(len >> 8); b->p[counts + (size_t)y * 2 + 1] = (uint8_t)len;
    }
    b_put(b, data.p, data.n);
    free(data.p); free(row);
}
static int save_psd(const TpDoc *d, const char *path, char *err, size_t errn) {
    if (d->w > 30000 || d->h > 30000) { ERR("PSD is limited to 30000 pixels a side"); return -1; }
    Buf b = {0};
    b_put(&b, "8BPS", 4); b_be16(&b, 1); for (int i = 0; i < 6; i++) b_u8(&b, 0);
    b_be16(&b, 4); b_be32(&b, (uint32_t)d->h); b_be32(&b, (uint32_t)d->w); b_be16(&b, 8); b_be16(&b, 3);
    b_be32(&b, 0);                                   /* colour mode data */
    b_be32(&b, 0);                                   /* image resources */
    size_t lmi = b.n; b_be32(&b, 0);                 /* layer and mask info length, set below */
    size_t li = b.n; b_be32(&b, 0);                  /* layer info length, set below */
    b_be16(&b, (unsigned)d->nlayers);
    /* channel data first into its own buffer, so the records can carry their lengths */
    Buf cd = {0};
    size_t *lens = calloc((size_t)d->nlayers * 4, sizeof *lens);
    for (int i = 0; i < d->nlayers; i++) {
        TpImage im = layer_straight(d, i);
        static const int order[4] = { 3, 0, 1, 2 };  /* alpha (-1), then r, g, b */
        for (int c = 0; c < 4; c++) {
            size_t before = cd.n;
#ifdef TP_PLANT_FAULT
            psd_channel_rle(&cd, im.px, d->w, d->h, c == 1 ? 2 : c == 3 ? 0 : order[c]);  /* planted: r and b swapped */
#else
            psd_channel_rle(&cd, im.px, d->w, d->h, order[c]);
#endif
            lens[i * 4 + c] = cd.n - before;
        }
        tp_image_free(&im);
    }
    for (int i = 0; i < d->nlayers; i++) {
        const TpLayer *l = &d->layers[i];
        b_be32(&b, 0); b_be32(&b, 0); b_be32(&b, (uint32_t)d->h); b_be32(&b, (uint32_t)d->w);
        b_be16(&b, 4);
        static const int ids[4] = { -1, 0, 1, 2 };
        for (int c = 0; c < 4; c++) { b_be16(&b, (unsigned)(uint16_t)ids[c]); b_be32(&b, (uint32_t)lens[i * 4 + c]); }
        b_put(&b, "8BIM", 4); b_put(&b, tp_blend_psd(l->blend), 4);
        b_u8(&b, (unsigned)(l->opacity * 255 + 0.5f)); b_u8(&b, 0);
        b_u8(&b, (l->alpha_lock ? 1 : 0) | (l->visible ? 0 : 2)); b_u8(&b, 0);
        /* extra data: mask (0), blending ranges (0), name (Pascal, padded to 4), luni (UTF-16 name) */
        size_t nl = strlen(l->name); if (nl > 255) nl = 255;
        size_t pas = (1 + nl + 3) & ~(size_t)3;
        size_t luni = 4 + 4 + 4 + 4 + nl * 2; luni = (luni + 3) & ~(size_t)3;
        b_be32(&b, (uint32_t)(4 + 4 + pas + luni));
        b_be32(&b, 0); b_be32(&b, 0);
        b_u8(&b, (unsigned)nl); b_put(&b, l->name, nl); for (size_t k = 1 + nl; k < pas; k++) b_u8(&b, 0);
        size_t ls = b.n;
        b_put(&b, "8BIM", 4); b_put(&b, "luni", 4); b_be32(&b, (uint32_t)(4 + nl * 2 + ((4 + nl * 2) % 4 ? 2 : 0)));
        b_be32(&b, (uint32_t)nl); for (size_t k = 0; k < nl; k++) b_be16(&b, (unsigned char)l->name[k]);
        while ((b.n - ls) % 4) b_u8(&b, 0);
    }
    b_put(&b, cd.p, cd.n); free(cd.p); free(lens);
    if ((b.n - li - 4) % 2) b_u8(&b, 0);
    b_set_be32(&b, li, (uint32_t)(b.n - li - 4));
    b_be32(&b, 0);                                   /* global layer mask info */
    b_set_be32(&b, lmi, (uint32_t)(b.n - lmi - 4));
    /* the merged picture: RLE, counts for every channel's rows first */
    TpImage flat = tp_flatten(d);
    b_be16(&b, 1);
    size_t counts = b.n;
    for (int i = 0; i < 4 * d->h; i++) b_be16(&b, 0);
    uint8_t *row = malloc((size_t)d->w);
    for (int c = 0; c < 4; c++)
        for (int y = 0; y < d->h; y++) {
            for (int x = 0; x < d->w; x++) row[x] = flat.px[((size_t)y * d->w + x) * 4 + c];
            size_t before = b.n; packbits_row(&b, row, d->w); size_t len = b.n - before;
            size_t at = counts + ((size_t)c * d->h + y) * 2; b.p[at] = (uint8_t)(len >> 8); b.p[at + 1] = (uint8_t)len;
        }
    free(row); tp_image_free(&flat);
    int r = tp_write_file(path, b.p, b.n);
    free(b.p);
    if (r) ERR("cannot write %s", path);
    return r;
}
static int psd_read_channel(const uint8_t *s, size_t sn, int w, int h, uint8_t *out) {
    if (sn < 2) return -1;
    unsigned comp = rd_be16(s);
    s += 2; sn -= 2;
    size_t need = (size_t)w * h;
    if (comp == 0) { if (sn < need) return -1; memcpy(out, s, need); return 0; }
    if (comp == 1) {
        if (sn < (size_t)h * 2) return -1;
        size_t at = (size_t)h * 2;
        for (int y = 0; y < h; y++) {
            size_t len = rd_be16(s + (size_t)y * 2);
            if (at + len > sn || unpackbits(s + at, len, out + (size_t)y * w, (size_t)w)) return -1;
            at += len;
        }
        return 0;
    }
    return -1;   /* zip-compressed channels: not read */
}
static TpDoc *load_psd(const uint8_t *p, size_t n, char *err, size_t errn) {
    if (n < 26 || memcmp(p, "8BPS", 4) || rd_be16(p + 4) != 1) { ERR("not a PSD file (or a PSB)"); return NULL; }
    int ch = (int)rd_be16(p + 12), h = (int)rd_be32(p + 14), w = (int)rd_be32(p + 18), depth = (int)rd_be16(p + 22), mode = (int)rd_be16(p + 24);
    (void)ch;
    if (w <= 0 || h <= 0 || w > TP_MAX_SIDE || h > TP_MAX_SIDE) { ERR("bad PSD size"); return NULL; }
    size_t at = 26;
    if (at + 4 > n) return NULL; at += 4 + rd_be32(p + at);            /* colour mode data */
    if (at + 4 > n) return NULL; at += 4 + rd_be32(p + at);            /* image resources */
    if (at + 4 > n) return NULL;
    size_t lmlen = rd_be32(p + at), lm = at + 4; at = lm + lmlen;
    TpDoc *d = NULL;
    if (depth == 8 && mode == 3 && lmlen >= 4 && lm + 4 <= n) {
        size_t lilen = rd_be32(p + lm), li = lm + 4;
        if (lilen >= 2 && li + lilen <= n) {
            int count = (int16_t)rd_be16(p + li); if (count < 0) count = -count;
            size_t r = li + 2;
            typedef struct { int t, l, b, rr, nch; int id[16]; size_t len[16]; char key[4]; int op, flags; char name[TP_NAME_MAX]; int skip; } Rec;
            Rec *rec = calloc((size_t)(count ? count : 1), sizeof(Rec));
            int ok = 1;
            for (int i = 0; i < count && ok; i++) {
                Rec *R = &rec[i];
                if (r + 18 > n) { ok = 0; break; }
                R->t = (int32_t)rd_be32(p + r); R->l = (int32_t)rd_be32(p + r + 4); R->b = (int32_t)rd_be32(p + r + 8); R->rr = (int32_t)rd_be32(p + r + 12);
                R->nch = (int)rd_be16(p + r + 16); r += 18;
                if (R->nch > 16 || r + (size_t)R->nch * 6 + 16 > n) { ok = 0; break; }
                for (int c = 0; c < R->nch; c++) { R->id[c] = (int16_t)rd_be16(p + r); R->len[c] = rd_be32(p + r + 2); r += 6; }
                memcpy(R->key, p + r + 4, 4); R->op = p[r + 8]; R->flags = p[r + 10];
                size_t xl = rd_be32(p + r + 12); r += 16;
                size_t xe = r + xl; if (xe > n) { ok = 0; break; }
                size_t q = r;
                if (q + 4 <= xe) q += 4 + rd_be32(p + q);                  /* mask */
                if (q + 4 <= xe) q += 4 + rd_be32(p + q);                  /* blending ranges */
                if (q < xe) { size_t nl = p[q]; size_t k = nl < TP_NAME_MAX - 1 ? nl : TP_NAME_MAX - 1;
                    if (q + 1 + nl <= xe) { memcpy(R->name, p + q + 1, k); R->name[k] = 0; } q += (1 + nl + 3) & ~(size_t)3; }
                while (q + 12 <= xe && (!memcmp(p + q, "8BIM", 4) || !memcmp(p + q, "8B64", 4))) {
                    const uint8_t *key = p + q + 4; size_t len = rd_be32(p + q + 8), body = q + 12;
                    if (body + len > xe) break;
                    if (!memcmp(key, "lsct", 4) && len >= 4) { unsigned t = (unsigned)rd_be32(p + body); if (t >= 1 && t <= 3) R->skip = 1; }
                    if (!memcmp(key, "luni", 4) && len >= 4) {
                        size_t cnt = rd_be32(p + body), k = 0;
                        for (size_t u = 0; u < cnt && body + 4 + u * 2 + 1 < xe && k + 1 < TP_NAME_MAX; u++) {
                            unsigned c16 = rd_be16(p + body + 4 + u * 2);
                            if (c16 < 0x80) R->name[k++] = (char)c16;
                            else if (c16 < 0x800 && k + 2 < TP_NAME_MAX) { R->name[k++] = (char)(0xc0 | (c16 >> 6)); R->name[k++] = (char)(0x80 | (c16 & 63)); }
                            else if (k + 3 < TP_NAME_MAX) { R->name[k++] = (char)(0xe0 | (c16 >> 12)); R->name[k++] = (char)(0x80 | ((c16 >> 6) & 63)); R->name[k++] = (char)(0x80 | (c16 & 63)); }
                        }
                        R->name[k] = 0;
                    }
                    q = body + len;
                }
                r = xe;
            }
            if (ok && count > 0) {
                d = tp_doc_new_empty(w, h);
                for (int i = 0; i < count; i++) {
                    Rec *R = &rec[i];
                    int lw = R->rr - R->l, lh = R->b - R->t;
                    uint8_t *planes[4] = {0};
                    int bad = 0;
                    for (int c = 0; c < R->nch; c++) {
                        size_t len = R->len[c];
                        if (r + len > n) { bad = 1; break; }
                        int slot = R->id[c] == -1 ? 3 : (R->id[c] >= 0 && R->id[c] < 3) ? R->id[c] : -1;
                        if (slot >= 0 && lw > 0 && lh > 0 && !R->skip) {
                            planes[slot] = malloc((size_t)lw * lh);
                            if (psd_read_channel(p + r, len, lw, lh, planes[slot])) { free(planes[slot]); planes[slot] = NULL; }
                        }
                        r += len;
                    }
                    if (!bad && !R->skip && !(lw <= 0 && strstr(R->name, "</Layer group>"))) {
                        int li2 = tp_layer_add(d, d->nlayers, R->name[0] ? R->name : "Layer");
                        if (li2 >= 0) {
                            TpLayer *L = &d->layers[li2];
                            for (int y = 0; y < lh; y++) {
                                int ty = y + R->t; if (ty < 0 || ty >= h) continue;
                                for (int x = 0; x < lw; x++) {
                                    int tx = x + R->l; if (tx < 0 || tx >= w) continue;
                                    uint8_t *o = L->buf->px + ((size_t)ty * w + tx) * 4; size_t k = (size_t)y * lw + x;
                                    for (int c = 0; c < 3; c++) o[c] = planes[c] ? planes[c][k] : 0;
                                    o[3] = planes[3] ? planes[3][k] : 255;
                                }
                            }
                            tp_premul(L->buf->px, (size_t)w * h);
                            L->blend = tp_blend_from_psd(R->key); L->opacity = R->op / 255.0f;
                            L->visible = !(R->flags & 2); L->alpha_lock = R->flags & 1;
                        }
                    }
                    for (int c = 0; c < 4; c++) free(planes[c]);
                    if (bad) break;
                }
                if (d->nlayers == 0) { tp_doc_free(d); d = NULL; }
            }
            free(rec);
        }
    }
    if (!d) {
        /* not layered (or not read): the merged picture, through stb_image */
        int iw, ih, c; uint8_t *px = stbi_load_from_memory(p, (int)n, &iw, &ih, &c, 4);
        if (!px) { ERR("cannot read this PSD: %s", stbi_failure_reason()); return NULL; }
        TpImage im = { iw, ih, iw * 4, px }; d = doc_from_image(&im, "Background"); stbi_image_free(px);
    }
    d->active = d->nlayers - 1; d->dirty = 0;
    return d;
}

/* ------------------------------------------------------------ QOI */
static int save_qoi(const TpDoc *d, const char *path, char *err, size_t errn) {
    TpImage im = tp_flatten(d);
    Buf b = {0};
    b_put(&b, "qoif", 4); b_be32(&b, (uint32_t)im.w); b_be32(&b, (uint32_t)im.h); b_u8(&b, 4); b_u8(&b, 0);
    uint8_t idx[64][4] = {{0}}, prev[4] = { 0, 0, 0, 255 };
    int run = 0; size_t N = (size_t)im.w * im.h;
    for (size_t i = 0; i < N; i++) {
        const uint8_t *px = im.px + i * 4;
        if (!memcmp(px, prev, 4)) {
            run++;
            if (run == 62 || i == N - 1) { b_u8(&b, 0xc0 | (run - 1)); run = 0; }
            continue;
        }
        if (run) { b_u8(&b, 0xc0 | (run - 1)); run = 0; }
        int h = (px[0] * 3 + px[1] * 5 + px[2] * 7 + px[3] * 11) % 64;
        if (!memcmp(idx[h], px, 4)) b_u8(&b, (unsigned)h);
        else {
            memcpy(idx[h], px, 4);
            if (px[3] == prev[3]) {
                int dr = (int8_t)(px[0] - prev[0]), dg = (int8_t)(px[1] - prev[1]), db = (int8_t)(px[2] - prev[2]);
                int drg = dr - dg, dbg = db - dg;
                if (dr > -3 && dr < 2 && dg > -3 && dg < 2 && db > -3 && db < 2) b_u8(&b, 0x40 | (dr + 2) << 4 | (dg + 2) << 2 | (db + 2));
                else if (drg > -9 && drg < 8 && dg > -33 && dg < 32 && dbg > -9 && dbg < 8) { b_u8(&b, 0x80 | (dg + 32)); b_u8(&b, (drg + 8) << 4 | (dbg + 8)); }
                else { b_u8(&b, 0xfe); b_put(&b, px, 3); }
            } else { b_u8(&b, 0xff); b_put(&b, px, 4); }
        }
        memcpy(prev, px, 4);
    }
    static const uint8_t end[8] = { 0, 0, 0, 0, 0, 0, 0, 1 };
    b_put(&b, end, 8);
    int r = tp_write_file(path, b.p, b.n);
    free(b.p); tp_image_free(&im);
    if (r) ERR("cannot write %s", path);
    return r;
}
static TpDoc *load_qoi(const uint8_t *p, size_t n, char *err, size_t errn) {
    if (n < 22 || memcmp(p, "qoif", 4)) { ERR("not a QOI file"); return NULL; }
    int w = (int)rd_be32(p + 4), h = (int)rd_be32(p + 8);
    if (w <= 0 || h <= 0 || w > TP_MAX_SIDE || h > TP_MAX_SIDE) { ERR("bad QOI size"); return NULL; }
    TpImage im = { w, h, w * 4, malloc((size_t)w * h * 4) };
    uint8_t idx[64][4] = {{0}}, px[4] = { 0, 0, 0, 255 };
    size_t at = 14, N = (size_t)w * h; int run = 0;
    for (size_t i = 0; i < N; i++) {
        if (run > 0) run--;
        else if (at < n - 8) {
            unsigned b1 = p[at++];
            if (b1 == 0xfe) { memcpy(px, p + at, 3); at += 3; }
            else if (b1 == 0xff) { memcpy(px, p + at, 4); at += 4; }
            else if ((b1 & 0xc0) == 0x00) memcpy(px, idx[b1], 4);
            else if ((b1 & 0xc0) == 0x40) { px[0] += ((b1 >> 4) & 3) - 2; px[1] += ((b1 >> 2) & 3) - 2; px[2] += (b1 & 3) - 2; }
            else if ((b1 & 0xc0) == 0x80) { unsigned b2 = p[at++]; int dg = (int)(b1 & 0x3f) - 32;
                px[0] += dg - 8 + ((b2 >> 4) & 15); px[1] += dg; px[2] += dg - 8 + (b2 & 15); }
            else run = b1 & 0x3f;
            memcpy(idx[(px[0] * 3 + px[1] * 5 + px[2] * 7 + px[3] * 11) % 64], px, 4);
        }
        memcpy(im.px + i * 4, px, 4);
    }
    TpDoc *d = doc_from_image(&im, "Background"); tp_image_free(&im);
    return d;
}

/* ------------------------------------------------------------ TIFF */
static int save_tiff(const TpDoc *d, const char *path, char *err, size_t errn) {
    TpImage im = tp_flatten(d);
    Buf b = {0};
    const int NE = 14;
    uint32_t ifd = 8, extra = ifd + 2 + NE * 12 + 4, bps = extra, xres = bps + 8, yres = xres + 8, pix = yres + 8;
    b_put(&b, "II*\0", 4); b_le32(&b, ifd);
    b_le16(&b, NE);
#define ENT(tag, type, count, val) do { b_le16(&b, tag); b_le16(&b, type); b_le32(&b, count); \
        if ((type) == 3 && (count) == 1) { b_le16(&b, (unsigned)(val)); b_le16(&b, 0); } else b_le32(&b, (uint32_t)(val)); } while (0)
    ENT(256, 4, 1, im.w); ENT(257, 4, 1, im.h); ENT(258, 3, 4, bps); ENT(259, 3, 1, 1); ENT(262, 3, 1, 2);
    ENT(273, 4, 1, pix); ENT(277, 3, 1, 4); ENT(278, 4, 1, im.h); ENT(279, 4, 1, (uint32_t)im.w * im.h * 4);
    ENT(282, 5, 1, xres); ENT(283, 5, 1, yres); ENT(284, 3, 1, 1); ENT(296, 3, 1, 2); ENT(338, 3, 1, 2);
#undef ENT
    b_le32(&b, 0);
    for (int i = 0; i < 4; i++) b_le16(&b, 8);
    b_le32(&b, 72); b_le32(&b, 1); b_le32(&b, 72); b_le32(&b, 1);
    b_put(&b, im.px, (size_t)im.w * im.h * 4);
    int r = tp_write_file(path, b.p, b.n);
    free(b.p); tp_image_free(&im);
    if (r) ERR("cannot write %s", path);
    return r;
}
static TpDoc *load_tiff(const uint8_t *p, size_t n, char *err, size_t errn) {
    if (n < 8) return NULL;
    int le = p[0] == 'I';
#define U16(o) (le ? rd_le16(p + (o)) : rd_be16(p + (o)))
#define U32(o) (le ? rd_le32(p + (o)) : rd_be32(p + (o)))
    size_t ifd = U32(4);
    if (ifd + 2 > n) { ERR("bad TIFF"); return NULL; }
    unsigned ne = U16(ifd);
    uint32_t w = 0, h = 0, comp = 1, photo = 2, spp = 1, rps = 0, planar = 1, bits = 8;
    size_t offs_at = 0, cnts_at = 0; uint32_t nstrips = 0, offs_type = 4, cnts_type = 4;
    for (unsigned i = 0; i < ne; i++) {
        size_t e = ifd + 2 + i * 12; if (e + 12 > n) break;
        unsigned tag = U16(e), type = U16(e + 2); uint32_t cnt = U32(e + 4);
        uint32_t val = type == 3 ? U16(e + 8) : U32(e + 8);
        switch (tag) {
        case 256: w = val; break; case 257: h = val; break;
        case 258: bits = cnt == 1 ? val : (U32(e + 8) + 2 <= n ? U16(U32(e + 8)) : 8); break;
        case 259: comp = val; break; case 262: photo = val; break; case 277: spp = val; break;
        case 278: rps = val; break; case 284: planar = val; break;
        case 273: nstrips = cnt; offs_type = type; offs_at = (cnt * (type == 3 ? 2 : 4) <= 4) ? e + 8 : U32(e + 8); break;
        case 279: cnts_type = type; cnts_at = (cnt * (type == 3 ? 2 : 4) <= 4) ? e + 8 : U32(e + 8); break;
        }
    }
    if (!w || !h || w > TP_MAX_SIDE || h > TP_MAX_SIDE || bits != 8 || planar != 1 || (comp != 1 && comp != 32773) || !nstrips || !(spp == 1 || spp == 3 || spp == 4) || (photo != 1 && photo != 2 && photo != 0)) {
        ERR("this TIFF kind is not read (only 8-bit, uncompressed or PackBits, gray/RGB/RGBA)"); return NULL; }
    if (!rps || rps > h) rps = h;
    size_t rowb = (size_t)w * spp;
    uint8_t *raw = calloc((size_t)h, rowb);
    for (uint32_t s = 0; s < nstrips; s++) {
        size_t oa = offs_at + s * (offs_type == 3 ? 2 : 4), ca = cnts_at + s * (cnts_type == 3 ? 2 : 4);
        if (oa + 4 > n || ca + 4 > n) break;
        size_t off = offs_type == 3 ? U16(oa) : U32(oa), cnt = cnts_type == 3 ? U16(ca) : U32(ca);
        size_t y0 = (size_t)s * rps; if (y0 >= h) break;
        size_t rows = h - y0 < rps ? h - y0 : rps;
        if (off + cnt > n) break;
        if (comp == 1) memcpy(raw + y0 * rowb, p + off, cnt < rows * rowb ? cnt : rows * rowb);
        else unpackbits(p + off, cnt, raw + y0 * rowb, rows * rowb);
    }
#undef U16
#undef U32
    TpImage im = { (int)w, (int)h, (int)w * 4, malloc((size_t)w * h * 4) };
    for (size_t i = 0; i < (size_t)w * h; i++) {
        uint8_t *o = im.px + i * 4, *q = raw + i * spp;
        if (spp == 1) { uint8_t g = photo == 0 ? 255 - q[0] : q[0]; o[0] = o[1] = o[2] = g; o[3] = 255; }
        else { o[0] = q[0]; o[1] = q[1]; o[2] = q[2]; o[3] = spp == 4 ? q[3] : 255; }
    }
    free(raw);
    TpDoc *d = doc_from_image(&im, "Background"); tp_image_free(&im);
    return d;
}

/* ------------------------------------------------------------ stb-backed flat formats */
static TpDoc *load_stb(const uint8_t *p, size_t n, char *err, size_t errn) {
    int w, h, c; uint8_t *px = stbi_load_from_memory(p, (int)n, &w, &h, &c, 4);
    if (!px) { ERR("cannot read the picture: %s", stbi_failure_reason()); return NULL; }
    if (w > TP_MAX_SIDE || h > TP_MAX_SIDE) { stbi_image_free(px); ERR("picture is larger than %d pixels a side", TP_MAX_SIDE); return NULL; }
    TpImage im = { w, h, w * 4, px };
    TpDoc *d = doc_from_image(&im, "Background"); stbi_image_free(px);
    return d;
}
static int save_flat(const TpDoc *d, const char *path, const char *ext, char *err, size_t errn) {
    TpImage im = tp_flatten(d);
    int ok = 0;
    if (!strcmp(ext, "png")) ok = stbi_write_png(path, im.w, im.h, 4, im.px, im.stride);
    else if (!strcmp(ext, "bmp")) ok = stbi_write_bmp(path, im.w, im.h, 4, im.px);
    else if (!strcmp(ext, "tga")) ok = stbi_write_tga(path, im.w, im.h, 4, im.px);
    else if (!strcmp(ext, "jpg") || !strcmp(ext, "ppm")) {
        /* no alpha in these: lay the picture on white */
        uint8_t *rgb = malloc((size_t)im.w * im.h * 3);
        for (size_t i = 0; i < (size_t)im.w * im.h; i++) {
            unsigned a = im.px[i * 4 + 3];
            for (int c = 0; c < 3; c++) rgb[i * 3 + c] = (uint8_t)((im.px[i * 4 + c] * a + 255 * (255 - a) + 127) / 255);
        }
        if (ext[0] == 'j') ok = stbi_write_jpg(path, im.w, im.h, 3, rgb, tp_jpeg_quality);
        else {
            Buf b = {0}; char hdr[64]; int hn = snprintf(hdr, sizeof hdr, "P6\n%d %d\n255\n", im.w, im.h);
            b_put(&b, hdr, (size_t)hn); b_put(&b, rgb, (size_t)im.w * im.h * 3);
            ok = tp_write_file(path, b.p, b.n) == 0; free(b.p);
        }
        free(rgb);
    }
    tp_image_free(&im);
    if (!ok) ERR("cannot write %s", path);
    return ok ? 0 : -1;
}
static int save_png(const TpDoc *d, const char *p, char *e, size_t n) { return save_flat(d, p, "png", e, n); }
static int save_jpg(const TpDoc *d, const char *p, char *e, size_t n) { return save_flat(d, p, "jpg", e, n); }
static int save_bmp(const TpDoc *d, const char *p, char *e, size_t n) { return save_flat(d, p, "bmp", e, n); }
static int save_tga(const TpDoc *d, const char *p, char *e, size_t n) { return save_flat(d, p, "tga", e, n); }
static int save_ppm(const TpDoc *d, const char *p, char *e, size_t n) { return save_flat(d, p, "ppm", e, n); }

/* ------------------------------------------------------------ the registry */
#define MAX_FORMATS 64
static TpFileFormat FORMATS[MAX_FORMATS];
static int nformats;
static TpDoc *load_by_magic(const uint8_t *p, size_t n, char *err, size_t errn);
static TpDoc *load_file_magic(const char *path, char *err, size_t errn) {
    size_t n; uint8_t *p = (uint8_t *)tp_read_file(path, &n);
    if (!p) { ERR("cannot read %s", path); return NULL; }
    TpDoc *d = load_by_magic(p, n, err, errn);
    free(p);
    return d;
}
static void add_builtin(const char *name, const char *ext, int layered, int can_load,
                        int (*save)(const TpDoc *, const char *, char *, size_t)) {
    if (nformats >= MAX_FORMATS) return;
    TpFileFormat *f = &FORMATS[nformats++];
    memset(f, 0, sizeof *f);
    snprintf(f->name, sizeof f->name, "%s", name); snprintf(f->ext, sizeof f->ext, "%s", ext);
    f->layered = layered; f->can_load = can_load; f->can_save = save != NULL;
    f->load_doc = can_load ? load_file_magic : NULL; f->save_doc = save;
}
void tp_formats_init(void) {
    if (nformats) return;
    add_builtin("OpenRaster", "ora", 1, 1, save_ora);
    add_builtin("Photoshop", "psd", 1, 1, save_psd);
    add_builtin("PNG", "png", 0, 1, save_png);
    add_builtin("JPEG", "jpg", 0, 1, save_jpg);
    add_builtin("JPEG", "jpeg", 0, 1, save_jpg);
    add_builtin("TIFF", "tif", 0, 1, save_tiff);
    add_builtin("TIFF", "tiff", 0, 1, save_tiff);
    add_builtin("Windows Bitmap", "bmp", 0, 1, save_bmp);
    add_builtin("Targa", "tga", 0, 1, save_tga);
    add_builtin("QOI", "qoi", 0, 1, save_qoi);
    add_builtin("Portable Pixmap", "ppm", 0, 1, save_ppm);
    add_builtin("GIF", "gif", 0, 1, NULL);
    add_builtin("Radiance HDR", "hdr", 0, 1, NULL);
    add_builtin("Portable Graymap", "pgm", 0, 1, NULL);
}
int tp_format_register_mod(const TpFormat *m) {
    if (!m || !m->ext || nformats >= MAX_FORMATS) return -1;
    TpFileFormat *f = &FORMATS[nformats++];
    memset(f, 0, sizeof *f);
    snprintf(f->name, sizeof f->name, "%s", m->name ? m->name : m->ext);
    snprintf(f->ext, sizeof f->ext, "%s", m->ext);
    f->can_load = m->load != NULL; f->can_save = m->save != NULL; f->mod = m;
    return 0;
}
int tp_formats_count(void) { return nformats; }
const TpFileFormat *tp_format_at(int i) { return i >= 0 && i < nformats ? &FORMATS[i] : NULL; }
const TpFileFormat *tp_format_for_path(const char *path, int for_save) {
    const char *e = tp_path_ext(path);
    /* mods are looked at last-registered first, so a mod can replace a built-in */
    for (int i = nformats - 1; i >= 0; i--)
        if (!strcmp(FORMATS[i].ext, e) && (for_save ? FORMATS[i].can_save : FORMATS[i].can_load)) return &FORMATS[i];
    return NULL;
}
void tp_format_patterns(int for_save, char *out, size_t n) {
    size_t k = 0; out[0] = 0;
    for (int i = 0; i < nformats; i++) {
        if (!(for_save ? FORMATS[i].can_save : FORMATS[i].can_load)) continue;
        int w = snprintf(out + k, n - k, "%s%s", k ? ";" : "", FORMATS[i].ext);
        if (w < 0 || (size_t)w >= n - k) break;
        k += (size_t)w;
    }
}
static TpDoc *load_by_magic(const uint8_t *p, size_t n, char *err, size_t errn) {
    if (n >= 4 && !memcmp(p, "PK\3\4", 4)) return load_ora(p, n, err, errn);
    if (n >= 4 && !memcmp(p, "8BPS", 4)) return load_psd(p, n, err, errn);
    if (n >= 4 && !memcmp(p, "qoif", 4)) return load_qoi(p, n, err, errn);
    if (n >= 4 && (!memcmp(p, "II*\0", 4) || !memcmp(p, "MM\0*", 4))) return load_tiff(p, n, err, errn);
    return load_stb(p, n, err, errn);
}
TpDoc *tp_load_memory(const void *data, size_t n, char *err, size_t errn) { return load_by_magic(data, n, err, errn); }

TpDoc *tp_load(const char *path, char *err, size_t errn) {
    const TpFileFormat *f = tp_format_for_path(path, 0);
    TpDoc *d = NULL;
    if (f && f->mod) {
        TpImage im = {0};
        if (f->mod->load(path, &im, f->mod->user) || !im.px) { ERR("the %s mod could not read %s", f->name, path); return NULL; }
        if (!im.stride) im.stride = im.w * 4;
        d = doc_from_image(&im, "Background");
        tp_host()->free(im.px);
    } else d = load_file_magic(path, err, errn);   /* by content, whatever the name says */
    if (d) snprintf(d->path, sizeof d->path, "%s", path);
    return d;
}
int tp_save(const TpDoc *d, const char *path, char *err, size_t errn) {
    const TpFileFormat *f = tp_format_for_path(path, 1);
    if (!f) { ERR("no format saves .%s files", tp_path_ext(path)); return -1; }
    if (f->mod) {
        TpImage im = tp_flatten(d);
        int r = f->mod->save(path, &im, f->mod->user);
        tp_image_free(&im);
        if (r) ERR("the %s mod could not write %s", f->name, path);
        return r ? -1 : 0;
    }
    return f->save_doc(d, path, err, errn);
}

/* ------------------------------------------------------------ palettes */
int tp_palette_parse(TpPalette *p, const char *t) {
    memset(p, 0, sizeof *p);
    snprintf(p->name, sizeof p->name, "Palette");
    if (strncmp(t, "GIMP Palette", 12)) return -1;
    const char *s = t;
    while (*s) {
        const char *e = strchr(s, '\n'); size_t l = e ? (size_t)(e - s) : strlen(s);
        char line[256]; if (l >= sizeof line) l = sizeof line - 1; memcpy(line, s, l); line[l] = 0;
        s = e ? e + 1 : s + l;
        int r, g, b;
        if (!strncmp(line, "Name:", 5)) { char *nm = line + 5; while (*nm == ' ') nm++; snprintf(p->name, sizeof p->name, "%s", nm);
            size_t k = strlen(p->name); while (k && (p->name[k - 1] == '\r' || p->name[k - 1] == ' ')) p->name[--k] = 0; }
        else if (line[0] != '#' && sscanf(line, "%d %d %d", &r, &g, &b) == 3 && p->n < 512)
            p->c[p->n++] = (uint32_t)(r & 255) | (uint32_t)(g & 255) << 8 | (uint32_t)(b & 255) << 16 | 0xff000000u;
    }
    return p->n > 0 ? 0 : -1;
}
int tp_palette_load(TpPalette *p, const char *path) {
    size_t n; char *t = tp_read_file(path, &n); if (!t) return -1;
    int r = tp_palette_parse(p, t); free(t); return r;
}
void tp_palette_default(TpPalette *p) {
    static const char *DEF =
        "GIMP Palette\nName: topology paint\n"
        "0 0 0\n64 64 64\n128 128 128\n192 192 192\n255 255 255\n"
        "120 28 28\n200 40 40\n240 100 80\n250 170 140\n255 225 205\n"
        "120 70 20\n200 120 40\n240 170 60\n250 210 110\n255 240 180\n"
        "30 90 40\n50 150 70\n110 200 100\n180 230 150\n225 245 210\n"
        "20 60 110\n40 100 180\n80 150 230\n150 200 245\n210 230 255\n"
        "60 30 100\n110 60 170\n170 110 220\n215 170 240\n245 225 255\n";
    tp_palette_parse(p, DEF);
}
