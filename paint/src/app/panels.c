/* SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
 * panels.c -- what is drawn where: the menu bar, the tools, the brush and
 * pen panel on the left, colour and layers on the right, the status bar,
 * dialogs and the help sheet.  Immediate mode: called once per frame. */
#include "app.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

typedef struct { const char *label, *keys; int act; } Item;
static const Item M_FILE[] = { {"New...", "Ctrl+N", ACT_NEW}, {"Open...", "Ctrl+O", ACT_OPEN}, {"Open Recovery", "", ACT_OPEN_RECOVERY},
    {"Save", "Ctrl+S", ACT_SAVE}, {"Save As...", "Ctrl+Shift+S", ACT_SAVE_AS}, {"Export...", "Ctrl+Shift+E", ACT_EXPORT},
    {"Import as Layer...", "Ctrl+I", ACT_IMPORT_LAYER}, {"Quit", "Ctrl+Q", ACT_QUIT}, {0, 0, 0} };
static const Item M_EDIT[] = { {"Undo", "Ctrl+Z", ACT_UNDO}, {"Redo", "Ctrl+Shift+Z", ACT_REDO}, {"Copy Picture", "Ctrl+C", ACT_COPY},
    {"Paste as Layer", "Ctrl+V", ACT_PASTE}, {"Clear Layer", "Del", ACT_CLEAR_LAYER}, {"Swap Colours", "X", ACT_SWAP_COLORS},
    {"Save Brush", "", ACT_SAVE_BRUSH}, {"Reload Brushes and Palettes", "", ACT_RELOAD}, {0, 0, 0} };
static const Item M_IMAGE[] = { {"Flip Horizontal", "", ACT_FLIP_H}, {"Flip Vertical", "", ACT_FLIP_V}, {"Rotate 90 Clockwise", "", ACT_ROT_CW},
    {"Rotate 90 Counter-clockwise", "", ACT_ROT_CCW}, {"Canvas Size...", "", ACT_CANVAS_SIZE}, {0, 0, 0} };
static const Item M_LAYER[] = { {"New Layer", "Ctrl+Shift+N", ACT_LAYER_NEW}, {"Duplicate", "Ctrl+J", ACT_LAYER_DUP}, {"Delete", "", ACT_LAYER_DEL},
    {"Merge Down", "Ctrl+E", ACT_LAYER_MERGE}, {"Move Up", "Ctrl+]", ACT_LAYER_UP}, {"Move Down", "Ctrl+[", ACT_LAYER_DOWN},
    {"Rename", "F2", ACT_LAYER_RENAME}, {"Lock Alpha", "/", ACT_LAYER_LOCK}, {"Show / Hide", "", ACT_LAYER_VIS}, {0, 0, 0} };
static const Item M_VIEW[] = { {"Zoom In", "+", ACT_ZOOM_IN}, {"Zoom Out", "-", ACT_ZOOM_OUT}, {"Fit to Window", "Ctrl+0", ACT_FIT},
    {"Actual Pixels", "Ctrl+1", ACT_ZOOM_100}, {"Rotate Left", "Shift+R", ACT_ROT_LEFT}, {"Rotate Right", "R", ACT_ROT_RIGHT},
    {"Reset Rotation", "0", ACT_ROT_RESET}, {"Mirror View", "M", ACT_MIRROR}, {"Show / Hide Panels", "Tab", ACT_PANELS}, {0, 0, 0} };
static const Item M_HELP[] = { {"Keys and Tablet Setup", "F1", ACT_HELP}, {"Open My Folder (brushes, mods)", "", ACT_USER_FOLDER},
    {"About", "", ACT_ABOUT}, {0, 0, 0} };
static const char *MENU_NAMES[] = { "File", "Edit", "Image", "Layer", "Filter", "View", "Help" };
static const Item *MENUS[] = { M_FILE, M_EDIT, M_IMAGE, M_LAYER, NULL, M_VIEW, M_HELP };
int panels_menu_count(void) { return 7; }

static void section(UI *u, int x, int y, int w, const char *title) {
    ui_text(u, x, y + 3, title, T_MUTED);
    ui_rect(u, x + ui_text_w(title) + 8, y + 11, w - ui_text_w(title) - 8, 1, T_BORDER);
}
static Col to_col(uint32_t rgba) { return RGB(rgba & 255, (rgba >> 8) & 255, (rgba >> 16) & 255); }

/* ------------------------------------------------------------ menu bar and dropdowns */
static int menu_x[8];
static void menu_bar(App *a, UI *u) {
    ui_rect(u, 0, 0, a->ww, MENU_H, T_PANEL);
    ui_rect(u, 0, MENU_H - 1, a->ww, 1, T_BORDER);
    int x = 8;
    ui_text(u, x, 5, "topology paint", T_ACCENT); x += ui_text_w("topology paint") + 18;
    for (int i = 0; i < 7; i++) {
        int w = ui_text_w(MENU_NAMES[i]) + 18;
        menu_x[i] = x;
        int hit = ui_hit(u, x, 0, w, MENU_H);
        if (hit && u->pressed && !u->used) { a->menu_open = a->menu_open == i + 1 ? 0 : i + 1; u->used = 1; }
        if (hit && a->menu_open && a->menu_open < 100 && a->menu_open != i + 1) a->menu_open = i + 1;   /* slide along the bar */
        if (a->menu_open == i + 1 || hit) ui_round(u, x, 3, w, MENU_H - 6, 4, a->menu_open == i + 1 ? T_ACCENT2 : T_HOVER);
        ui_text_center(u, x, 0, w, MENU_H, MENU_NAMES[i], T_TEXT);
        x += w;
    }
    /* the drawing's name, right-aligned */
    char nm[300]; const char *p = a->doc->path[0] ? a->doc->path : "Untitled";
    const char *b = strrchr(p, '/'), *bs = strrchr(p, '\\'); if (bs > b) b = bs;
    snprintf(nm, sizeof nm, "%s%s  %dx%d", b ? b + 1 : p, a->doc->dirty ? " *" : "", a->doc->w, a->doc->h);
    ui_text_right(u, 0, 5, a->ww - 10, nm, T_MUTED);
}
static void dropdown(App *a, UI *u) {
    if (!a->menu_open || a->menu_open >= 100) return;
    int m = a->menu_open - 1, x = menu_x[m], y = MENU_H, n = 0;
    Item filt[64 + 1];
    const Item *items = MENUS[m];
    if (!items) {          /* Filter: built from the registry, so mods show up */
        for (int i = 0; i < tp_filters_count() && n < 64; i++) { filt[n].label = tp_filter_at(i)->name; filt[n].keys = ""; filt[n].act = ACT_FILTER_0 + i; n++; }
        filt[n].label = NULL; items = filt;
    }
    n = 0; int w = 200;
    for (const Item *it = items; it->label; it++, n++) { int tw = ui_text_w(it->label) + ui_text_w(it->keys) + 60; if (tw > w) w = tw; }
    ui_rect(u, x + 3, y + 3, w, n * 24 + 8, RGBA(0, 0, 0, 90));
    ui_round(u, x, y, w, n * 24 + 8, 6, T_RAISED); ui_frame(u, x, y, w, n * 24 + 8, T_BORDER);
    int i = 0;
    for (const Item *it = items; it->label; it++, i++) {
        int iy = y + 4 + i * 24;
        int hit = ui_hit(u, x + 4, iy, w - 8, 24);
        int disabled = (it->act == ACT_OPEN_RECOVERY && !SDL_GetPathInfo(a->recovery, NULL)) ||
                       (it->act == ACT_UNDO && !tp_undo_can(a->doc)) || (it->act == ACT_REDO && !tp_redo_can(a->doc)) ||
                       (it->act == ACT_LAYER_MERGE && a->doc->active == 0);
        if (hit && !disabled) ui_round(u, x + 4, iy, w - 8, 24, 4, T_ACCENT2);
        ui_text(u, x + 12, iy + 4, it->label, disabled ? T_MUTED : T_TEXT);
        ui_text_right(u, x, iy + 4, w - 12, it->keys, hit && !disabled ? T_TEXT : T_MUTED);
        if (hit && u->released && !disabled && u->active == 0) { int act = it->act; a->menu_open = 0; app_action(a, act); return; }
        if (hit && u->pressed) u->used = 1;
    }
    if (u->pressed && !u->used && !ui_hit(u, x, y, w, n * 24 + 8)) { a->menu_open = 0; u->used = 1; }
}

/* ------------------------------------------------------------ tools */
static void toolbar(App *a, UI *u) {
    int x = 0, y = MENU_H, h = a->wh - MENU_H - STATUS_H;
    ui_rect(u, x, y, TOOL_W, h, T_PANEL);
    ui_rect(u, TOOL_W - 1, y, 1, h, T_BORDER);
    static const char *keys[] = { "B", "E", "G", "I", "H" };
    for (int t = 0; t < TOOL_COUNT; t++) {
        int by = y + 8 + t * 44;
        if (ui_button(u, ui_id("tool", t), 5, by, TOOL_W - 10, 38, NULL, a->tool == (Tool)t)) a->tool = (Tool)t;
        ui_text_center(u, 5, by + 2, TOOL_W - 10, 20, tool_name((Tool)t), T_TEXT);
        ui_text_center(u, 5, by + 18, TOOL_W - 10, 18, keys[t], a->tool == (Tool)t ? T_TEXT : T_MUTED);
    }
    /* colour wells: front and back; click the back one (or X) to swap */
    int cy = y + 8 + TOOL_COUNT * 44 + 10;
    ui_rect(u, 22, cy + 18, 30, 30, T_BORDER); ui_rect(u, 23, cy + 19, 28, 28, to_col(a->color2));
    ui_rect(u, 8, cy + 4, 30, 30, T_TEXT); ui_rect(u, 9, cy + 5, 28, 28, to_col(a->color));
    if (ui_hit(u, 38, cy + 18, 14, 30) && u->pressed && !u->used) { u->used = 1; app_action(a, ACT_SWAP_COLORS); }
    if (ui_button(u, ui_id("undo", 0), 5, cy + 60, TOOL_W - 10, 26, "Undo", 0)) app_action(a, ACT_UNDO);
    if (ui_button(u, ui_id("redo", 0), 5, cy + 90, TOOL_W - 10, 26, "Redo", 0)) app_action(a, ACT_REDO);
}

/* ------------------------------------------------------------ brushes and pen */
static void pct_slider(App *a, UI *u, const char *id, int x, int *y, int w, const char *label, float *v) {
    float p = *v * 100;
    if (ui_slider(u, ui_id(id, 0), x, *y, w, 20, label, &p, 0, 100, "%.0f%%", NULL, NULL)) *v = p / 100;
    (void)a; *y += 23;
}
static void brush_panel(App *a, UI *u) {
    int x0 = TOOL_W, y0 = MENU_H, h = a->wh - MENU_H - STATUS_H, w = BRUSH_W;
    ui_rect(u, x0, y0, w, h, T_PANEL);
    ui_rect(u, x0 + w - 1, y0, 1, h, T_BORDER);
    int x = x0 + 8, iw = w - 16;
    const int fixed = 6 + 22 + 6 + 378 + 22 + 92 + 69 + 6;   /* headers, settings, pen box */
    int list_h = h - fixed; if (list_h < 60) list_h = 60;
    int y = y0 + 6;
    section(u, x, y, iw, "Brushes"); y += 22;
    /* the preset list, scrollable */
    int rows = list_h / 20, n = a->nbrushes;
    if (ui_hit(u, x, y, iw, list_h) && u->wheel != 0) { a->brush_scroll -= u->wheel * 2; }
    if (a->brush_scroll > n - rows) a->brush_scroll = (float)(n - rows); if (a->brush_scroll < 0) a->brush_scroll = 0;
    ui_clip(u, x, y, iw, list_h);
    for (int i = 0; i < n; i++) {
        int ry = y + (int)((i - a->brush_scroll) * 20);
        if (ry + 20 < y || ry > y + list_h) continue;
        int sel = i == a->cur_brush, hit = ui_hit(u, x, ry, iw, 20);
        if (sel || hit) ui_round(u, x, ry, iw, 19, 4, sel ? T_ACCENT2 : T_HOVER);
        char lab[80]; snprintf(lab, sizeof lab, "%s%s", a->brushes[i].name, a->brush_file[i][0] ? "  (file)" : "");
        if (i < 9) { char k[4]; snprintf(k, sizeof k, "%d", i + 1); ui_text_right(u, x, ry + 2, iw - 6, k, sel ? T_TEXT : T_MUTED); }
        ui_text(u, x + 6, ry + 2, lab, T_TEXT);
        if (hit && u->pressed && !u->used) { u->used = 1; app_select_brush(a, i); }
    }
    ui_noclip(u);
    y += list_h + 6;
    /* the working brush's settings */
    section(u, x, y, iw, "Brush settings"); y += 22;
    TpBrush *b = &a->brush;
    int bw = (iw - 8) / 3;
    if (ui_button(u, ui_id("mode", 0), x, y, bw, 22, "Paint", b->mode == TP_MODE_PAINT)) b->mode = TP_MODE_PAINT;
    if (ui_button(u, ui_id("mode", 1), x + bw + 4, y, bw, 22, "Erase", b->mode == TP_MODE_ERASE)) b->mode = TP_MODE_ERASE;
    if (ui_button(u, ui_id("mode", 2), x + 2 * (bw + 4), y, bw, 22, "Smudge", b->mode == TP_MODE_SMUDGE)) b->mode = TP_MODE_SMUDGE;
    y += 27;
    float st = sqrtf((b->size - 0.5f) / 999.5f);
    char sl[32]; snprintf(sl, sizeof sl, "%.1f px", b->size);
    if (ui_slider(u, ui_id("size", 0), x, y, iw, 20, "Size", &st, 0, 1, sl[0] ? "" : "", NULL, NULL)) b->size = 0.5f + st * st * 999.5f;
    ui_text_right(u, x, y + 2, iw - 6, sl, T_TEXT); y += 23;
    pct_slider(a, u, "op", x, &y, iw, "Opacity", &b->opacity);
    pct_slider(a, u, "flow", x, &y, iw, "Flow", &b->flow);
    pct_slider(a, u, "hard", x, &y, iw, "Hardness", &b->hardness);
    pct_slider(a, u, "space", x, &y, iw, "Spacing", &b->spacing);
    pct_slider(a, u, "smooth", x, &y, iw, "Stabilizer", &b->smoothing);
    pct_slider(a, u, "psize", x, &y, iw, "Pressure > size", &b->pressure_size);
    pct_slider(a, u, "pmin", x, &y, iw, "Thinnest", &b->min_size);
    pct_slider(a, u, "pop", x, &y, iw, "Pressure > opacity", &b->pressure_opacity);
    pct_slider(a, u, "pflow", x, &y, iw, "Pressure > flow", &b->pressure_flow);
    pct_slider(a, u, "round", x, &y, iw, "Roundness", &b->roundness);
    if (b->roundness < 0.05f) b->roundness = 0.05f;
    if (ui_slider(u, ui_id("angle", 0), x, y, iw, 20, b->tilt_angle ? "Angle (tilt)" : "Angle", &b->angle, -90, 90, "%.0f", NULL, NULL)) {}
    y += 23;
    if (b->mode == TP_MODE_SMUDGE) { pct_slider(a, u, "smudge", x, &y, iw, "Smudge", &b->smudge); }
    else y += 23;
    int hw = (iw - 4) / 2;
    if (ui_button(u, ui_id("savebrush", 0), x, y, hw, 22, "Save brush", 0)) app_action(a, ACT_SAVE_BRUSH);
    if (ui_button(u, ui_id("resetbrush", 0), x + hw + 4, y, hw, 22, "Reset", 0)) a->brush = a->brushes[a->cur_brush];
    y += 30;

    /* the pen: what the tablet sends, what the curve makes of it */
    section(u, x, y, iw, "Pen pressure"); y += 22;
    int gx = x, gy = y, gw = 86, gh = 86;
    ui_rect(u, gx, gy, gw, gh, T_BG); ui_frame(u, gx, gy, gw, gh, T_BORDER);
    for (int k = 1; k < 4; k++) { ui_rect(u, gx + k * gw / 4, gy + 1, 1, gh - 2, RGB(0x1c, 0x22, 0x2a)); ui_rect(u, gx + 1, gy + k * gh / 4, gw - 2, 1, RGB(0x1c, 0x22, 0x2a)); }
    float px_ = gx + 1, py_ = gy + gh - 2;
    for (int i = 1; i <= 60; i++) {
        float t = i / 60.0f, o = tp_curve_apply(&a->curve, t);
        float nx = gx + 1 + t * (gw - 3), ny = gy + gh - 2 - o * (gh - 3);
        ui_line(u, px_, py_, nx, ny, T_ACCENT); px_ = nx; py_ = ny;
    }
    float out = tp_curve_apply(&a->curve, a->pen_raw);
    ui_disc(u, gx + 1 + a->pen_raw * (gw - 3), gy + gh - 2 - out * (gh - 3), 3.5f, T_WARN);
    int tx = gx + gw + 8;
    char l[96];
    ui_text(u, tx, gy, a->pen_seen ? "Pen: found" : "Pen: none yet", a->pen_seen ? T_OK : T_MUTED);
    snprintf(l, sizeof l, "in   %.3f", a->pen_raw); ui_text(u, tx, gy + 18, l, T_TEXT);
    snprintf(l, sizeof l, "out %.3f", out); ui_text(u, tx, gy + 34, l, T_TEXT);
    snprintf(l, sizeof l, "tilt %.0f, %.0f", a->pen_tx, a->pen_ty); ui_text(u, tx, gy + 50, l, T_MUTED);
    ui_rect(u, tx, gy + 72, iw - gw - 8, 8, T_BG);
    ui_rect(u, tx, gy + 72, (int)((iw - gw - 8) * out), 8, T_WARN);
    y += gh + 6;
    float soft = a->curve.softness;
    if (ui_slider(u, ui_id("soft", 0), x, y, iw, 20, "Soft < > Firm", &soft, 1, -1, "", NULL, NULL)) a->curve.softness = soft;
    {   char v[16]; snprintf(v, sizeof v, "%+.2f", a->curve.softness); ui_text_right(u, x, y + 2, iw - 6, v, T_TEXT); }
    y += 23;
    pct_slider(a, u, "dead", x, &y, iw, "Ignore below", &a->curve.min_in);
    if (a->curve.min_in > 0.5f) a->curve.min_in = 0.5f;
    pct_slider(a, u, "full", x, &y, iw, "Full pressure at", &a->curve.max_in);
    if (a->curve.max_in < a->curve.min_in + 0.05f) a->curve.max_in = a->curve.min_in + 0.05f;
}

/* ------------------------------------------------------------ colour and layers */
static void color_panel(App *a, UI *u, int x, int *py, int iw) {
    int y = *py;
    section(u, x, y, iw, "Colour"); y += 22;
    int sw = iw - 30, sh = 132;
    /* saturation (left to right) and value (top to bottom) for the current hue */
    float hr, hg, hb; tp_hsv_to_rgb(a->hue, 1, 1, &hr, &hg, &hb);
    for (int yy = 0; yy < sh; yy++) for (int xx = 0; xx < sw; xx++) {
        float s = (float)xx / (sw - 1), v = 1 - (float)yy / (sh - 1);
        float r = v * (1 - s + s * hr), g = v * (1 - s + s * hg), bb = v * (1 - s + s * hb);
        ui_rect(u, x + xx, y + yy, 1, 1, RGB((int)(r * 255), (int)(g * 255), (int)(bb * 255)));
    }
    uint64_t sv = ui_id("sv", 0), hu = ui_id("hue", 0);
    if (ui_hit(u, x, y, sw, sh) && u->pressed && !u->used) { u->active = sv; u->used = 1; }
    if (u->active == sv) {
        a->sat = fminf(1, fmaxf(0, (u->mx - x) / (sw - 1))); a->val = fminf(1, fmaxf(0, 1 - (u->my - y) / (sh - 1)));
        float r, g, bb; tp_hsv_to_rgb(a->hue, a->sat, a->val, &r, &g, &bb);
        a->color = 0xff000000u | (uint32_t)(r * 255 + 0.5f) | (uint32_t)(g * 255 + 0.5f) << 8 | (uint32_t)(bb * 255 + 0.5f) << 16;
    }
    float mx = x + a->sat * (sw - 1), my = y + (1 - a->val) * (sh - 1);
    ui_circle(u, mx, my, 5, RGB(0, 0, 0)); ui_circle(u, mx, my, 4, RGB(255, 255, 255));
    int hx = x + sw + 8;
    for (int yy = 0; yy < sh; yy++) { float r, g, bb; tp_hsv_to_rgb((float)yy / sh, 1, 1, &r, &g, &bb); ui_rect(u, hx, y + yy, 22, 1, RGB((int)(r * 255), (int)(g * 255), (int)(bb * 255))); }
    if (ui_hit(u, hx, y, 22, sh) && u->pressed && !u->used) { u->active = hu; u->used = 1; }
    if (u->active == hu) {
        a->hue = fminf(0.999f, fmaxf(0, (u->my - y) / sh));
        float r, g, bb; tp_hsv_to_rgb(a->hue, a->sat, a->val, &r, &g, &bb);
        a->color = 0xff000000u | (uint32_t)(r * 255 + 0.5f) | (uint32_t)(g * 255 + 0.5f) << 8 | (uint32_t)(bb * 255 + 0.5f) << 16;
    }
    int hy = y + (int)(a->hue * sh);
    ui_frame(u, hx - 2, hy - 2, 26, 5, RGB(255, 255, 255));
    y += sh + 8;
    ui_rect(u, x, y, 44, 22, to_col(a->color)); ui_frame(u, x, y, 44, 22, T_BORDER);
    ui_rect(u, x + 48, y, 22, 22, to_col(a->color2)); ui_frame(u, x + 48, y, 22, 22, T_BORDER);
    if (ui_hit(u, x + 48, y, 22, 22) && u->pressed && !u->used) { u->used = 1; app_action(a, ACT_SWAP_COLORS); }
    char hex[16]; snprintf(hex, sizeof hex, "#%02X%02X%02X", a->color & 255, (a->color >> 8) & 255, (a->color >> 16) & 255);
    ui_text(u, x + 80, y + 3, hex, T_TEXT);
    y += 30;
    /* palette: click to pick, cycle with < > */
    TpPalette *p = &a->pals[a->cur_pal];
    if (ui_button(u, ui_id("palprev", 0), x, y, 20, 18, "<", 0)) a->cur_pal = (a->cur_pal + a->npals - 1) % a->npals;
    if (ui_button(u, ui_id("palnext", 0), x + iw - 20, y, 20, 18, ">", 0)) a->cur_pal = (a->cur_pal + 1) % a->npals;
    ui_text_center(u, x, y, iw, 18, p->name, T_MUTED);
    y += 22;
    int cols = 10, cw = iw / cols, ch = 16;
    int shown = p->n < 60 ? p->n : 60;
    for (int i = 0; i < shown; i++) {
        int cx = x + (i % cols) * cw, cy = y + (i / cols) * ch;
        ui_rect(u, cx, cy, cw - 2, ch - 2, to_col(p->c[i]));
        if (ui_hit(u, cx, cy, cw - 2, ch - 2)) {
            ui_frame(u, cx, cy, cw - 2, ch - 2, RGB(255, 255, 255));
            if (u->pressed && !u->used) { u->used = 1; app_set_color(a, p->c[i]); }
        }
    }
    y += ((shown + cols - 1) / cols) * ch + 8;
    *py = y;
}
static void layer_thumb(App *a, UI *u, int layer, int x, int y, int w, int h) {
    TpDoc *d = a->doc;
    float s = fminf((float)w / d->w, (float)h / d->h);
    int tw = (int)(d->w * s), th = (int)(d->h * s), ox = x + (w - tw) / 2, oy = y + (h - th) / 2;
    if (tw < 1) tw = 1; if (th < 1) th = 1;
    ui_checker(u, ox, oy, tw, th, 4);
    const uint8_t *px = d->layers[layer].buf->px;
    for (int yy = 0; yy < th; yy++) for (int xx = 0; xx < tw; xx++) {
        int sx = (int)((xx + 0.5f) / s), sy = (int)((yy + 0.5f) / s);
        if (sx >= d->w) sx = d->w - 1; if (sy >= d->h) sy = d->h - 1;
        const uint8_t *q = px + ((size_t)sy * d->w + sx) * 4;
        if (!q[3]) continue;
        int r = q[0] * 255 / q[3], g = q[1] * 255 / q[3], b = q[2] * 255 / q[3];
        ui_rect(u, ox + xx, oy + yy, 1, 1, RGBA(r > 255 ? 255 : r, g > 255 ? 255 : g, b > 255 ? 255 : b, q[3]));
    }
    ui_frame(u, ox - 1, oy - 1, tw + 2, th + 2, T_BORDER);
}
static int blend_x, blend_y;
static void layers_panel(App *a, UI *u, int x, int y, int iw, int bottom) {
    TpDoc *d = a->doc;
    section(u, x, y, iw, "Layers"); y += 22;
    static const char *lab[] = { "+", "Dup", "Del", "Up", "Down", "Merge" };
    static const int act[] = { ACT_LAYER_NEW, ACT_LAYER_DUP, ACT_LAYER_DEL, ACT_LAYER_UP, ACT_LAYER_DOWN, ACT_LAYER_MERGE };
    int bw = (iw - 5 * 3) / 6;
    for (int i = 0; i < 6; i++) if (ui_button(u, ui_id("lb", i), x + i * (bw + 3), y, bw, 22, lab[i], 0)) app_action(a, act[i]);
    y += 27;
    TpLayer *L = &d->layers[d->active];
    float op = L->opacity * 100; int began = 0, ended = 0;
    if (ui_slider(u, ui_id("lop", 0), x, y, iw, 20, "Opacity", &op, 0, 100, "%.0f%%", &began, &ended) || began) {
        if (began && !a->slider_undo) { tp_undo_push_state(d); a->slider_undo = 1; }
        L->opacity = op / 100; d->dirty = 1; app_dirty_all(a);
    }
    if (ended) a->slider_undo = 0;
    y += 25;
    int half = (iw - 4) / 2;
    char bl[48]; snprintf(bl, sizeof bl, "%s  v", tp_blend_name(L->blend));
    if (ui_button(u, ui_id("blend", 0), x, y, half + 30, 22, bl, a->menu_open == 100)) { a->menu_open = a->menu_open == 100 ? 0 : 100; blend_x = x; blend_y = y + 24; }
    if (ui_button(u, ui_id("alock", 0), x + half + 34, y, iw - half - 34, 22, "Lock alpha", L->alpha_lock)) app_action(a, ACT_LAYER_LOCK);
    y += 28;
    /* the list, top layer first */
    int rh = 36, list_h = bottom - y - 4;
    int rows = list_h / rh;
    if (ui_hit(u, x, y, iw, list_h) && u->wheel != 0) a->layer_scroll -= u->wheel;
    if (a->layer_scroll > d->nlayers - rows) a->layer_scroll = (float)(d->nlayers - rows);
    if (a->layer_scroll < 0) a->layer_scroll = 0;
    ui_clip(u, x, y, iw, list_h);
    for (int r = 0; r < d->nlayers; r++) {
        int i = d->nlayers - 1 - r;
        int ry = y + (int)((r - a->layer_scroll) * rh);
        if (ry + rh < y || ry > y + list_h) continue;
        TpLayer *l = &d->layers[i];
        int sel = i == d->active, hit = ui_hit(u, x, ry, iw, rh - 2);
        ui_round(u, x, ry, iw, rh - 2, 4, sel ? T_ACCENT2 : hit ? T_HOVER : T_RAISED);
        /* eye */
        int ex = x + 4, ey = ry + (rh - 2) / 2;
        int eye_hit = ui_hit(u, ex - 2, ry, 22, rh - 2);
        if (l->visible) { ui_disc(u, ex + 8, ey, 5, T_TEXT); ui_disc(u, ex + 8, ey, 2.5f, sel ? T_ACCENT2 : T_RAISED); }
        else ui_circle(u, ex + 8, ey, 5, T_MUTED);
        layer_thumb(a, u, i, x + 26, ry + 3, 40, rh - 8);
        if (a->renaming && sel) {
            if (ui_field(u, ui_id("rename", 0), x + 72, ry + 6, iw - 76, 22, a->rename_buf, TP_NAME_MAX) || u->focus != ui_id("rename", 0)) {
                if (a->rename_buf[0] && strcmp(a->rename_buf, l->name)) { tp_undo_push_state(d); snprintf(l->name, TP_NAME_MAX, "%s", a->rename_buf); }
                a->renaming = 0; if (u->focus == ui_id("rename", 0)) u->focus = 0;
            }
        } else {
            ui_text(u, x + 72, ry + 3, l->name, l->visible ? T_TEXT : T_MUTED);
            char info[64]; snprintf(info, sizeof info, "%s %.0f%%%s", tp_blend_name(l->blend), l->opacity * 100, l->alpha_lock ? "  a-lock" : "");
            ui_text(u, x + 72, ry + 17, info, sel ? T_TEXT : T_MUTED);
        }
        if (hit && u->pressed && !u->used) {
            u->used = 1;
            if (eye_hit) { l->visible ^= 1; d->dirty = 1; app_dirty_all(a); }
            else { if (d->active != i) a->renaming = 0; d->active = i; if (u->dbl) app_action(a, ACT_LAYER_RENAME); }
        }
    }
    ui_noclip(u);
}
static void blend_menu(App *a, UI *u) {
    if (a->menu_open != 100) return;
    int x = blend_x, y = blend_y, w = 170, n = TP_BLEND_COUNT;
    ui_round(u, x, y, w, n * 22 + 8, 6, T_RAISED); ui_frame(u, x, y, w, n * 22 + 8, T_BORDER);
    TpLayer *L = &a->doc->layers[a->doc->active];
    for (int i = 0; i < n; i++) {
        int iy = y + 4 + i * 22, hit = ui_hit(u, x + 4, iy, w - 8, 22);
        if (hit || (int)L->blend == i) ui_round(u, x + 4, iy, w - 8, 22, 4, hit ? T_ACCENT2 : T_HOVER);
        ui_text(u, x + 12, iy + 3, tp_blend_name((TpBlend)i), T_TEXT);
        if (hit && u->pressed && !u->used) { u->used = 1; tp_undo_push_state(a->doc); L->blend = (TpBlend)i; app_dirty_all(a); a->menu_open = 0; }
    }
    if (u->pressed && !u->used) { a->menu_open = 0; u->used = 1; }
}
static void right_panel(App *a, UI *u) {
    int x0 = a->ww - PANEL_W, y0 = MENU_H, h = a->wh - MENU_H - STATUS_H;
    ui_rect(u, x0, y0, PANEL_W, h, T_PANEL);
    ui_rect(u, x0, y0, 1, h, T_BORDER);
    int x = x0 + 10, iw = PANEL_W - 20, y = y0 + 6;
    color_panel(a, u, x, &y, iw);
    layers_panel(a, u, x, y, iw, y0 + h);
}

/* ------------------------------------------------------------ status, cursor, dialogs, help */
static void status_bar(App *a, UI *u) {
    int y = a->wh - STATUS_H;
    ui_rect(u, 0, y, a->ww, STATUS_H, T_PANEL);
    ui_rect(u, 0, y, a->ww, 1, T_BORDER);
    float cx, cy; to_canvas(a, a->hx, a->hy, &cx, &cy);
    char s[200];
    snprintf(s, sizeof s, "%s  |  %.0f%%%s%s  |  %d, %d", tool_name(a->tool), a->zoom * a->dpr * 100,
             a->rot != 0 ? "  rotated" : "", a->mirror ? "  mirrored" : "", (int)floorf(cx), (int)floorf(cy));
    int w = ui_text(u, 10, y + 4, s, T_MUTED);
    if (a->status[0]) ui_text(u, 10 + w + 24, y + 4, a->status, SDL_GetTicks() - a->status_t < 6000 ? T_TEXT : T_MUTED);
}
static void brush_cursor(App *a, UI *u) {
    Tool t = a->space ? TOOL_PAN : a->tool;
    if (!a->hover_canvas || (t != TOOL_BRUSH && t != TOOL_ERASER)) return;
    int vx, vy, vw, vh; view_rect(a, &vx, &vy, &vw, &vh);
    ui_clip(u, vx, vy, vw, vh);
    float r = a->brush.size * 0.5f * a->zoom;
    if (r >= 2) { ui_circle(u, a->hx, a->hy, r + 1, RGBA(0, 0, 0, 200)); ui_circle(u, a->hx, a->hy, r, RGBA(255, 255, 255, 230)); }
    ui_rect(u, (int)a->hx - 4, (int)a->hy, 9, 1, RGBA(255, 255, 255, 230)); ui_rect(u, (int)a->hx, (int)a->hy - 4, 1, 9, RGBA(255, 255, 255, 230));
    ui_rect(u, (int)a->hx - 4, (int)a->hy + 1, 9, 1, RGBA(0, 0, 0, 160));
    ui_noclip(u);
}
static void dialog(App *a, UI *u) {
    if (a->dialog == DLG_NONE) return;
    ui_rect(u, 0, 0, a->ww, a->wh, RGBA(0, 0, 0, 140));
    int w = 420, h = a->dialog == DLG_NEW ? 260 : 190, x = (a->ww - w) / 2, y = (a->wh - h) / 2;
    ui_round(u, x, y, w, h, 8, T_PANEL); ui_frame(u, x, y, w, h, T_BORDER);
    ui_text(u, x + 16, y + 14, a->dialog == DLG_NEW ? "New drawing" : "Canvas size (the picture stays centred)", T_TEXT);
    ui_text(u, x + 16, y + 48, "Width", T_MUTED); ui_field(u, ui_id("dlgw", 0), x + 70, y + 44, 90, 24, a->dlg_w, 8);
    ui_text(u, x + 180, y + 48, "Height", T_MUTED); ui_field(u, ui_id("dlgh", 0), x + 236, y + 44, 90, 24, a->dlg_h, 8);
    ui_text(u, x + 336, y + 48, "pixels", T_MUTED);
    int yy = y + 82;
    if (a->dialog == DLG_NEW) {
        static const struct { const char *n; int w, h; } P[] = { {"1920 x 1080", 1920, 1080}, {"2560 x 1440", 2560, 1440}, {"3840 x 2160", 3840, 2160},
            {"A4 300 dpi", 2480, 3508}, {"Square 2048", 2048, 2048}, {"Square 4096", 4096, 4096} };
        for (int i = 0; i < 6; i++) {
            int bx = x + 16 + (i % 3) * 130, by = yy + (i / 3) * 30;
            if (ui_button(u, ui_id("preset", i), bx, by, 124, 26, P[i].n, 0)) { snprintf(a->dlg_w, 16, "%d", P[i].w); snprintf(a->dlg_h, 16, "%d", P[i].h); }
        }
        yy += 70;
        if (ui_button(u, ui_id("bgw", 0), x + 16, yy, 124, 26, "White", a->dlg_white)) a->dlg_white = 1;
        if (ui_button(u, ui_id("bgt", 0), x + 146, yy, 124, 26, "Transparent", !a->dlg_white)) a->dlg_white = 0;
        yy += 40;
    } else yy += 24;
    int W = atoi(a->dlg_w), H = atoi(a->dlg_h);
    int lim = a->max_tex < TP_MAX_SIDE ? a->max_tex : TP_MAX_SIDE;
    int ok = W >= 1 && H >= 1 && W <= lim && H <= lim;
    if (!ok) { char m[80]; snprintf(m, sizeof m, "1 to %d pixels a side", lim); ui_text(u, x + 16, yy + 5, m, T_WARN); }
    if (ui_button(u, ui_id("dlgcancel", 0), x + w - 200, yy, 88, 28, "Cancel", 0) || u->k_esc) { a->dialog = DLG_NONE; u->focus = 0; }
    if ((ui_button(u, ui_id("dlgok", 0), x + w - 104, yy, 88, 28, a->dialog == DLG_NEW ? "Create" : "Resize", 1) || (u->k_enter && !u->focus)) && ok) {
        if (a->dialog == DLG_NEW) {
            TpDoc *d = tp_doc_new(W, H, a->dlg_white ? 0xffffffffu : 0);
            tp_doc_free(a->doc); a->doc = d; a->have_last = 0;
            float z = fminf((float)(a->ww - TOOL_W - BRUSH_W - PANEL_W) / W, (float)(a->wh - MENU_H - STATUS_H) / H) * 0.92f;
            a->zoom = z; a->panx = a->pany = 0; a->rot = 0;
        } else { tp_undo_push_state(a->doc); tp_doc_resize_canvas(a->doc, W, H, 1, 1); }
        a->dialog = DLG_NONE; u->focus = 0; app_dirty_all(a);
    }
    if (u->pressed && !u->used) u->used = 1;   /* modal */
}
static void help(App *a, UI *u) {
    if (!a->help) return;
    ui_rect(u, 0, 0, a->ww, a->wh, RGBA(0, 0, 0, 150));
    int w = 860, h = 560; if (w > a->ww - 20) w = a->ww - 20; if (h > a->wh - 20) h = a->wh - 20;
    int x = (a->ww - w) / 2, y = (a->wh - h) / 2;
    ui_round(u, x, y, w, h, 8, T_PANEL); ui_frame(u, x, y, w, h, T_BORDER);
    ui_text(u, x + 18, y + 14, "Keys", T_ACCENT);
    static const char *K[][2] = {
        {"B / E / G / I / H", "brush, eraser, fill, picker, pan"}, {"[  ]", "brush smaller, bigger"},
        {"1 - 9", "brush preset"}, {"Space + drag", "pan (also middle button)"}, {"Alt + click", "pick a colour (also right button)"},
        {"Shift + click", "straight line from the last stroke"}, {"Ctrl + wheel", "brush size; the wheel alone zooms"},
        {"R / Shift+R / 0", "rotate view right, left, reset"}, {"M", "mirror the view (not the picture)"},
        {"X", "swap front and back colours"}, {"Ctrl+Z / Ctrl+Shift+Z", "undo, redo"}, {"Ctrl+S / Ctrl+Shift+E", "save (.ora/.psd), export"},
        {"Ctrl+Shift+N / Ctrl+J", "new layer, duplicate layer"}, {"Ctrl+E", "merge down"}, {"Tab", "hide or show the panels"},
        {"Del", "clear the layer"}, {"F2", "rename the layer"}, {"Esc", "close a menu, a dialog, this sheet"} };
    for (int i = 0; i < (int)(sizeof K / sizeof *K); i++) {
        ui_text(u, x + 18, y + 40 + i * 20, K[i][0], T_TEXT);
        ui_text(u, x + 190, y + 40 + i * 20, K[i][1], T_MUTED);
    }
    int cx = x + 470;
    ui_text(u, cx, y + 14, "Pen tablets (XP-Pen Artist 13.3 Pro V2 and the like)", T_ACCENT);
    static const char *T[] = {
        "Pressure and tilt come straight from the tablet driver:",
        "  Windows: Windows Ink. In the XP-Pen driver (Pentablet),",
        "    tick \"Windows Ink\" for this program or for all.",
        "  Linux: X11 (XInput2) or Wayland; the kernel driver or",
        "    XP-Pen's own both work. Map the pen to the screen.",
        "  macOS: allow the driver under Privacy > Accessibility.",
        "Watch the Pen pressure box (left): \"Pen: found\" and the",
        "  dot moving on the curve mean the tablet is heard.",
        "Light hand? Move Soft < > Firm toward Soft. Ghost lines",
        "  when hovering? Raise \"Ignore below\".",
        "Express keys and the dial send keys: map them in the",
        "  driver to B, E, [, ], Ctrl+Z, Space, R, M and so on.",
        "Pen buttons: hold button 1 to pick colours, button 2 to",
        "  pan, unless the driver maps them to keys or clicks.",
        "Tilt: the Tilt Pencil preset turns its tip with the pen.",
        "",
        "Mods, brushes and palettes: Help > Open My Folder.",
    };
    for (int i = 0; i < (int)(sizeof T / sizeof *T); i++) ui_text(u, cx, y + 40 + i * 20, T[i], i == 0 || T[i][0] != ' ' ? T_TEXT : T_MUTED);
    char mods[256]; int k = snprintf(mods, sizeof mods, "Mods loaded: %d", tp_mods_loaded());
    for (int i = 0; i < tp_mods_loaded() && k < 200; i++) k += snprintf(mods + k, sizeof mods - k, "%s%s", i ? ", " : " (", tp_mod_name(i));
    if (tp_mods_loaded()) snprintf(mods + k, sizeof mods - k, ")");
    ui_text(u, x + 18, y + h - 30, mods, T_MUTED);
    if (u->pressed && !u->used) { u->used = 1; a->help = 0; }
}

void panels_draw(App *a) {
    UI *u = &a->ui;
    ui_clear(u);
    int en = u->enabled;
    if (a->menu_open || a->dialog != DLG_NONE || a->help) u->enabled = 0;   /* what is on top takes the click */
    if (a->panels) { toolbar(a, u); brush_panel(a, u); right_panel(a, u); }
    status_bar(a, u);
    brush_cursor(a, u);
    u->enabled = en && a->dialog == DLG_NONE && !a->help;
    menu_bar(a, u);
    u->enabled = en;
    blend_menu(a, u);
    dropdown(a, u);
    dialog(a, u);
    help(a, u);
    if (u->pressed && !u->used) a->menu_open = 0;
}
