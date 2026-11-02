/* SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
 * ui.c -- drawing primitives, text from the baked font, and widgets. */
#include "ui.h"
#include "font_data.h"
#include <string.h>
#include <math.h>
#include <stdio.h>

uint64_t ui_id(const char *s, int n) {
    uint64_t h = 1469598103934665603ull;
    for (; *s; s++) { h ^= (unsigned char)*s; h *= 1099511628211ull; }
    h ^= (uint64_t)(n + 1) * 0x9e3779b97f4a7c15ull;
    return h ? h : 1;
}
void ui_begin(UI *u) { u->used = 0; u->hot = 0; ui_noclip(u); }
void ui_end(UI *u) {
    u->pressed = u->released = u->dbl = u->right_pressed = 0; u->wheel = 0;
    u->n_text = 0; u->text[0] = 0; u->k_back = u->k_enter = u->k_esc = u->k_left = u->k_right = 0;
    if (!u->down) u->active = 0;
}
void ui_clip(UI *u, int x, int y, int w, int h) {
    u->cx0 = x < 0 ? 0 : x; u->cy0 = y < 0 ? 0 : y;
    u->cx1 = x + w > u->w ? u->w : x + w; u->cy1 = y + h > u->h ? u->h : y + h;
}
void ui_noclip(UI *u) { u->cx0 = 0; u->cy0 = 0; u->cx1 = u->w; u->cy1 = u->h; }
void ui_clear(UI *u) { memset(u->px, 0, (size_t)u->w * u->h * 4); }

static inline void put(UI *u, int x, int y, Col c, unsigned cov) {
    if (x < u->cx0 || y < u->cy0 || x >= u->cx1 || y >= u->cy1) return;
    unsigned a = ((c >> 24) * cov + 127) / 255;
    if (!a) return;
    uint8_t *p = u->px + ((size_t)y * u->w + x) * 4;
    unsigned r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
    if (a == 255 || p[3] == 0) { p[0] = (uint8_t)r; p[1] = (uint8_t)g; p[2] = (uint8_t)b; p[3] = (uint8_t)(a == 255 ? 255 : a); return; }
    unsigned da = p[3], oa = a + da * (255 - a) / 255;
    if (!oa) return;
    p[0] = (uint8_t)((r * a + p[0] * da * (255 - a) / 255) / oa);
    p[1] = (uint8_t)((g * a + p[1] * da * (255 - a) / 255) / oa);
    p[2] = (uint8_t)((b * a + p[2] * da * (255 - a) / 255) / oa);
    p[3] = (uint8_t)oa;
}
void ui_rect(UI *u, int x, int y, int w, int h, Col c) {
    int x0 = x < u->cx0 ? u->cx0 : x, y0 = y < u->cy0 ? u->cy0 : y;
    int x1 = x + w > u->cx1 ? u->cx1 : x + w, y1 = y + h > u->cy1 ? u->cy1 : y + h;
    if ((c >> 24) == 255) {
        uint8_t q[4] = { (c >> 16) & 255, (c >> 8) & 255, c & 255, 255 };
        for (int yy = y0; yy < y1; yy++) { uint8_t *p = u->px + ((size_t)yy * u->w + x0) * 4; for (int xx = x0; xx < x1; xx++, p += 4) memcpy(p, q, 4); }
        return;
    }
    for (int yy = y0; yy < y1; yy++) for (int xx = x0; xx < x1; xx++) put(u, xx, yy, c, 255);
}
void ui_frame(UI *u, int x, int y, int w, int h, Col c) {
    ui_rect(u, x, y, w, 1, c); ui_rect(u, x, y + h - 1, w, 1, c); ui_rect(u, x, y, 1, h, c); ui_rect(u, x + w - 1, y, 1, h, c);
}
void ui_round(UI *u, int x, int y, int w, int h, int r, Col c) {
    for (int yy = 0; yy < h; yy++) for (int xx = 0; xx < w; xx++) {
        float dx = 0, dy = 0;
        if (xx < r) dx = r - xx - 0.5f; else if (xx >= w - r) dx = xx - (w - r) + 0.5f;
        if (yy < r) dy = r - yy - 0.5f; else if (yy >= h - r) dy = yy - (h - r) + 0.5f;
        float dd = sqrtf(dx * dx + dy * dy);
        float cov = r - dd + 0.5f; if (cov <= 0) continue; if (cov > 1) cov = 1;
        put(u, x + xx, y + yy, c, (unsigned)(cov * 255));
    }
}
void ui_line(UI *u, float x0, float y0, float x1, float y1, Col c) {
    float dx = x1 - x0, dy = y1 - y0; int n = (int)(fmaxf(fabsf(dx), fabsf(dy)) * 2) + 1;
    for (int i = 0; i <= n; i++) { float t = (float)i / n; put(u, (int)(x0 + dx * t), (int)(y0 + dy * t), c, 255); }
}
void ui_circle(UI *u, float cx, float cy, float r, Col c) {
    int n = (int)(r * 6.3f) + 12;
    for (int i = 0; i < n; i++) { float a = i * 6.2831853f / n; put(u, (int)floorf(cx + r * cosf(a)), (int)floorf(cy + r * sinf(a)), c, 255); }
}
void ui_disc(UI *u, float cx, float cy, float r, Col c) {
    for (int y = (int)(cy - r - 1); y <= (int)(cy + r + 1); y++) for (int x = (int)(cx - r - 1); x <= (int)(cx + r + 1); x++) {
        float d = sqrtf((x + 0.5f - cx) * (x + 0.5f - cx) + (y + 0.5f - cy) * (y + 0.5f - cy));
        float cov = r - d + 0.5f; if (cov <= 0) continue; if (cov > 1) cov = 1;
        put(u, x, y, c, (unsigned)(cov * 255));
    }
}
void ui_checker(UI *u, int x, int y, int w, int h, int cell) {
    for (int yy = 0; yy < h; yy++) for (int xx = 0; xx < w; xx++)
        put(u, x + xx, y + yy, (((xx / cell) ^ (yy / cell)) & 1) ? RGB(150, 150, 150) : RGB(210, 210, 210), 255);
}

int ui_line_h(void) { return FONT_ATLAS_H; }
int ui_text_w(const char *s) {
    float w = 0;
    for (; *s; s++) { int c = (unsigned char)*s; if (c < 32 || c > 126) c = '?'; w += font_glyphs[c - 32].adv; }
    return (int)(w + 0.5f);
}
int ui_text(UI *u, int x, int y, const char *s, Col c) {
    float pen = (float)x;
    for (; *s; s++) {
        int ch = (unsigned char)*s; if (ch < 32 || ch > 126) ch = '?';
        const int gi = ch - 32;
        int gx = font_glyphs[gi].x, gw = font_glyphs[gi].w, ox = font_glyphs[gi].ox;
        int px0 = (int)(pen + 0.5f) + ox;
        for (int yy = 0; yy < FONT_ATLAS_H; yy++) for (int xx = 0; xx < gw; xx++) {
            unsigned cov = font_atlas[yy * FONT_ATLAS_W + gx + xx];
            if (cov) put(u, px0 + xx, y + yy, c, cov);
        }
        pen += font_glyphs[gi].adv;
    }
    return (int)(pen - x + 0.5f);
}
void ui_text_center(UI *u, int x, int y, int w, int h, const char *s, Col c) {
    ui_text(u, x + (w - ui_text_w(s)) / 2, y + (h - FONT_ATLAS_H) / 2, s, c);
}
void ui_text_right(UI *u, int x, int y, int w, const char *s, Col c) { ui_text(u, x + w - ui_text_w(s), y, s, c); }

int ui_hit(UI *u, int x, int y, int w, int h) {
    return u->enabled && u->mx >= x && u->my >= y && u->mx < x + w && u->my < y + h &&
           u->mx >= u->cx0 && u->my >= u->cy0 && u->mx < u->cx1 && u->my < u->cy1;
}
int ui_button(UI *u, uint64_t id, int x, int y, int w, int h, const char *label, int on) {
    int hit = ui_hit(u, x, y, w, h), click = 0;
    if (hit) u->hot = id;
    if (hit && u->pressed && !u->used) { u->active = id; u->used = 1; }
    if (u->active == id && u->released && hit) click = 1;
    Col bg = on ? T_ACCENT2 : (u->active == id && hit) ? T_ACCENT2 : hit ? T_HOVER : T_RAISED;
    ui_round(u, x, y, w, h, 4, bg);
    if (label) ui_text_center(u, x, y, w, h, label, on ? RGB(255, 255, 255) : T_TEXT);
    return click;
}
int ui_slider(UI *u, uint64_t id, int x, int y, int w, int h, const char *label, float *v,
              float lo, float hi, const char *fmt, int *began, int *ended) {
    int hit = ui_hit(u, x, y, w, h), changed = 0;
    if (began) *began = 0;
    if (ended) *ended = 0;
    if (hit && u->pressed && !u->used) { u->active = id; u->used = 1; if (began) *began = 1; }
    if (u->active == id) {
        float t = (u->mx - x) / (float)(w > 1 ? w - 1 : 1); t = t < 0 ? 0 : t > 1 ? 1 : t;
        float nv = lo + (hi - lo) * t;
        if (nv != *v) { *v = nv; changed = 1; }
        if (u->released || !u->down) { if (ended) *ended = 1; }
    }
    if (hit && u->wheel != 0 && u->active == 0) { *v += (hi - lo) * 0.02f * (u->wheel > 0 ? 1 : -1); if (*v < lo) *v = lo; if (*v > hi) *v = hi; changed = 1; }
    ui_round(u, x, y, w, h, 3, hit || u->active == id ? T_HOVER : T_RAISED);
    float t = (*v - lo) / (hi - lo); t = t < 0 ? 0 : t > 1 ? 1 : t;
    int fw = (int)((w - 2) * t);
    if (fw > 0) ui_round(u, x + 1, y + 1, fw, h - 2, 2, RGBA(0x2f, 0x81, 0xf7, 150));
    char val[48]; snprintf(val, sizeof val, fmt, *v);
    ui_text(u, x + 6, y + (h - FONT_ATLAS_H) / 2, label, T_TEXT);
    ui_text_right(u, x, y + (h - FONT_ATLAS_H) / 2, w - 6, val, T_TEXT);
    return changed;
}
int ui_field(UI *u, uint64_t id, int x, int y, int w, int h, char *buf, int cap) {
    int hit = ui_hit(u, x, y, w, h), commit = 0;
    if (u->pressed && !u->used) {
        if (hit) { u->focus = id; u->used = 1; u->caret = (int)strlen(buf); }
        else if (u->focus == id) { u->focus = 0; commit = 1; }
    }
    int focused = u->focus == id;
    if (focused) {
        int len = (int)strlen(buf);
        if (u->caret > len) u->caret = len;
        for (int i = 0; i < u->n_text && len < cap - 1; i++) {
            memmove(buf + u->caret + 1, buf + u->caret, (size_t)(len - u->caret + 1));
            buf[u->caret++] = u->text[i]; len++;
        }
        if (u->k_back && u->caret > 0) { memmove(buf + u->caret - 1, buf + u->caret, (size_t)(len - u->caret + 1)); u->caret--; }
        if (u->k_left && u->caret > 0) u->caret--;
        if (u->k_right && u->caret < (int)strlen(buf)) u->caret++;
        if (u->k_enter) { commit = 1; u->focus = 0; }
        if (u->k_esc) u->focus = 0;
    }
    ui_round(u, x, y, w, h, 3, focused ? T_BG : T_RAISED);
    ui_frame(u, x, y, w, h, focused ? T_ACCENT : T_BORDER);
    int ty = y + (h - FONT_ATLAS_H) / 2;
    ui_text(u, x + 5, ty, buf, T_TEXT);
    if (focused) {
        char tmp[256]; int k = u->caret < 255 ? u->caret : 255; memcpy(tmp, buf, (size_t)k); tmp[k] = 0;
        ui_rect(u, x + 5 + ui_text_w(tmp), ty + 1, 1, FONT_ATLAS_H - 2, T_TEXT);
    }
    return commit;
}
