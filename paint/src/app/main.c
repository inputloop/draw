/* SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
 *
 * main.c -- topology paint: the window, the pen, the actions.
 *
 * Pen input comes from SDL3's pen API, which speaks Windows Ink on Windows,
 * XInput2 (X11) and tablet-v2 (Wayland) on Linux, and NSEvent tablet events
 * on macOS.  Pressure and tilt arrive as SDL_EVENT_PEN_AXIS; position as
 * SDL_EVENT_PEN_MOTION; tip contact as SDL_EVENT_PEN_DOWN/UP.  SDL is told
 * not to turn the pen into a mouse, so a stroke is never drawn twice.
 */
#include <SDL3/SDL.h>
#include <SDL3/SDL_main.h>
#include "app.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdarg.h>
#include <math.h>

App A;

static void log_to_status(const char *m) { app_status(&A, "%s", m); }

void app_status(App *a, const char *fmt, ...) {
    va_list ap; va_start(ap, fmt); vsnprintf(a->status, sizeof a->status, fmt, ap); va_end(ap);
    a->status_t = SDL_GetTicks();
}
const char *tool_name(Tool t) {
    static const char *N[] = { "Brush", "Eraser", "Fill", "Picker", "Pan" };
    return t < TOOL_COUNT ? N[t] : "";
}

/* ------------------------------------------------------------ view */
void view_rect(App *a, int *x, int *y, int *w, int *h) {
    int l = a->panels ? TOOL_W + BRUSH_W : 0, r = a->panels ? PANEL_W : 0;
    *x = l; *y = MENU_H; *w = a->ww - l - r; *h = a->wh - MENU_H - STATUS_H;
    if (*w < 1) *w = 1; if (*h < 1) *h = 1;
}
static void view_center(App *a, float *cx, float *cy) {
    int x, y, w, h; view_rect(a, &x, &y, &w, &h);
    *cx = x + w * 0.5f + a->panx; *cy = y + h * 0.5f + a->pany;
}
void to_canvas(App *a, float sx, float sy, float *cx, float *cy) {
    float vx, vy; view_center(a, &vx, &vy);
    float dx = sx - vx, dy = sy - vy, r = -a->rot * 3.14159265f / 180, c = cosf(r), s = sinf(r);
    float ux = dx * c - dy * s, uy = dx * s + dy * c;
    if (a->mirror) ux = -ux;
    *cx = ux / a->zoom + a->doc->w * 0.5f; *cy = uy / a->zoom + a->doc->h * 0.5f;
}
void from_canvas(App *a, float cx, float cy, float *sx, float *sy) {
    float vx, vy; view_center(a, &vx, &vy);
    float ux = (cx - a->doc->w * 0.5f) * a->zoom, uy = (cy - a->doc->h * 0.5f) * a->zoom;
    if (a->mirror) ux = -ux;
    float r = a->rot * 3.14159265f / 180, c = cosf(r), s = sinf(r);
    *sx = vx + ux * c - uy * s; *sy = vy + ux * s + uy * c;
}
static void zoom_at(App *a, float factor, float sx, float sy) {
    float cx, cy; to_canvas(a, sx, sy, &cx, &cy);
    float z = a->zoom * factor; if (z < 0.02f) z = 0.02f; if (z > 64) z = 64;
    a->zoom = z;
    float nx, ny; from_canvas(a, cx, cy, &nx, &ny);
    a->panx += sx - nx; a->pany += sy - ny;
}
static void fit(App *a) {
    int x, y, w, h; view_rect(a, &x, &y, &w, &h);
    float z = fminf((float)w / a->doc->w, (float)h / a->doc->h) * 0.92f;
    a->zoom = z > 0 ? z : 1; a->panx = a->pany = 0;
}

/* ------------------------------------------------------------ the picture on screen */
void app_dirty_all(App *a) { a->dx0 = 0; a->dy0 = 0; a->dx1 = a->doc->w; a->dy1 = a->doc->h; }
static void dirty(App *a, int x, int y, int w, int h) {
    if (x < a->dx0) a->dx0 = x; if (y < a->dy0) a->dy0 = y;
    if (x + w > a->dx1) a->dx1 = x + w; if (y + h > a->dy1) a->dy1 = y + h;
}
static void ensure_texture(App *a) {
    if (a->tex && a->tex_w == a->doc->w && a->tex_h == a->doc->h) return;
    if (a->tex) SDL_DestroyTexture(a->tex);
    a->tex = SDL_CreateTexture(a->ren, SDL_PIXELFORMAT_RGBA32, SDL_TEXTUREACCESS_STREAMING, a->doc->w, a->doc->h);
    a->tex_w = a->doc->w; a->tex_h = a->doc->h;
    free(a->disp); a->disp = malloc((size_t)a->doc->w * a->doc->h * 4);
    app_dirty_all(a);
}
static void flush_picture(App *a) {
    ensure_texture(a);
    if (a->dx0 < 0) a->dx0 = 0; if (a->dy0 < 0) a->dy0 = 0;
    if (a->dx1 > a->doc->w) a->dx1 = a->doc->w; if (a->dy1 > a->doc->h) a->dy1 = a->doc->h;
    if (a->dx1 > a->dx0 && a->dy1 > a->dy0) {
        int w = a->dx1 - a->dx0, h = a->dy1 - a->dy0;
        tp_composite_display(a->doc, a->disp, a->dx0, a->dy0, w, h);
        SDL_Rect r = { a->dx0, a->dy0, w, h };
        SDL_UpdateTexture(a->tex, &r, a->disp + ((size_t)a->dy0 * a->doc->w + a->dx0) * 4, a->doc->w * 4);
    }
    a->dx0 = a->doc->w; a->dy0 = a->doc->h; a->dx1 = 0; a->dy1 = 0;
}
static void set_doc(App *a, TpDoc *d) {
    if (a->cap == CAP_STROKE) { tp_stroke_end(a->doc, &a->stroke); a->cap = CAP_NONE; }
    if (a->doc) tp_doc_free(a->doc);
    a->doc = d; a->have_last = 0;
    ensure_texture(a); app_dirty_all(a); fit(a);
}
static void update_title(App *a) {
    char t[1200]; const char *p = a->doc->path[0] ? a->doc->path : "Untitled";
    const char *b = strrchr(p, '/'), *bs = strrchr(p, '\\'); if (bs > b) b = bs;
    snprintf(t, sizeof t, "%s%s - topology paint", b ? b + 1 : p, a->doc->dirty ? " *" : "");
    SDL_SetWindowTitle(a->win, t);
}

/* ------------------------------------------------------------ colour and brushes */
void app_set_color(App *a, uint32_t c) {
    a->color = c | 0xff000000u;
    tp_rgb_to_hsv((c & 255) / 255.0f, ((c >> 8) & 255) / 255.0f, ((c >> 16) & 255) / 255.0f, &a->hue, &a->sat, &a->val);
}
void app_select_brush(App *a, int i) {
    if (i < 0 || i >= a->nbrushes) return;
    a->cur_brush = i; a->brush = a->brushes[i];
    if (a->tool != TOOL_BRUSH && a->tool != TOOL_ERASER) a->tool = TOOL_BRUSH;
    app_status(a, "Brush: %s", a->brush.name);
}
static void load_brushes(App *a) {
    a->nbrushes = 0;
    for (int i = 0; i < tp_brush_builtin_count(); i++) { tp_brush_builtin(i, &a->brushes[a->nbrushes]); a->brush_file[a->nbrushes][0] = 0; a->nbrushes++; }
    const char *dirs[2] = { a->base, a->pref };
    for (int k = 0; k < 2; k++) {
        char dir[1100]; snprintf(dir, sizeof dir, "%sbrushes", dirs[k]);
        static char names[128][256]; int n = tp_list_dir(dir, "brush", names, 128);
        for (int i = 0; i < n; i++) {
            char path[1400]; snprintf(path, sizeof path, "%s/%s", dir, names[i]);
            TpBrush b; if (tp_brush_load(&b, path)) { tp_log("brush %s: nothing readable", path); continue; }
            int slot = -1;
            for (int j = 0; j < a->nbrushes; j++) if (!strcmp(a->brushes[j].name, b.name)) slot = j;   /* same name: replaces */
            if (slot < 0) { if (a->nbrushes >= MAX_BRUSHES) break; slot = a->nbrushes++; }
            a->brushes[slot] = b; snprintf(a->brush_file[slot], 512, "%s", path);
        }
    }
}
static void load_palettes(App *a) {
    a->npals = 0;
    tp_palette_default(&a->pals[a->npals++]);
    const char *dirs[2] = { a->base, a->pref };
    for (int k = 0; k < 2; k++) {
        char dir[1100]; snprintf(dir, sizeof dir, "%spalettes", dirs[k]);
        static char names[32][256]; int n = tp_list_dir(dir, "gpl", names, 32);
        for (int i = 0; i < n && a->npals < MAX_PALETTES; i++) {
            char path[1400]; snprintf(path, sizeof path, "%s/%s", dir, names[i]);
            if (tp_palette_load(&a->pals[a->npals], path) == 0) a->npals++;
        }
    }
    if (a->cur_pal >= a->npals) a->cur_pal = 0;
}

/* ------------------------------------------------------------ settings */
static void settings_path(App *a, char *out, size_t n) { snprintf(out, n, "%ssettings.ini", a->pref); }
static void settings_load(App *a) {
    char p[1200]; settings_path(a, p, sizeof p);
    size_t n; char *t = tp_read_file(p, &n); if (!t) return;
    for (char *line = strtok(t, "\n"); line; line = strtok(NULL, "\n")) {
        char k[64]; char v[256];
        if (sscanf(line, " %63[^= ] = %255[^\r\n]", k, v) != 2) continue;
        if (!strcmp(k, "pressure_softness")) a->curve.softness = (float)atof(v);
        else if (!strcmp(k, "pressure_min")) a->curve.min_in = (float)atof(v);
        else if (!strcmp(k, "pressure_max")) a->curve.max_in = (float)atof(v);
        else if (!strcmp(k, "mouse_pressure")) a->mouse_pressure = (float)atof(v);
        else if (!strcmp(k, "color")) app_set_color(a, (uint32_t)strtoul(v, NULL, 16));
        else if (!strcmp(k, "color2")) a->color2 = (uint32_t)strtoul(v, NULL, 16) | 0xff000000u;
        else if (!strcmp(k, "brush")) { for (int i = 0; i < a->nbrushes; i++) if (!strcmp(a->brushes[i].name, v)) app_select_brush(a, i); }
        else if (!strcmp(k, "jpeg_quality")) tp_jpeg_quality = atoi(v) < 1 ? 1 : atoi(v) > 100 ? 100 : atoi(v);
        else if (!strcmp(k, "autosave_minutes")) a->autosave_min = atoi(v);
        else if (!strcmp(k, "fill_tolerance")) a->fill_tol = atoi(v);
        else if (!strcmp(k, "palette")) a->cur_pal = atoi(v);
    }
    free(t);
}
static void settings_save(App *a) {
    char p[1200]; settings_path(a, p, sizeof p);
    char b[2048];
    int n = snprintf(b, sizeof b,
        "# topology paint settings; written on quit, read on start\n"
        "pressure_softness = %.3f\npressure_min = %.3f\npressure_max = %.3f\nmouse_pressure = %.2f\n"
        "color = %08x\ncolor2 = %08x\nbrush = %s\njpeg_quality = %d\nautosave_minutes = %d\nfill_tolerance = %d\npalette = %d\n",
        a->curve.softness, a->curve.min_in, a->curve.max_in, a->mouse_pressure, a->color, a->color2,
        a->brushes[a->cur_brush].name, tp_jpeg_quality, a->autosave_min, a->fill_tol, a->cur_pal);
    tp_write_file(p, b, (size_t)n);
}

/* ------------------------------------------------------------ files */
enum { FD_OPEN = 1, FD_SAVE_AS, FD_EXPORT, FD_IMPORT };
static SDL_DialogFileFilter open_filters[2], save_filters[2], export_filters[24];
static char open_pat[512], export_pat[24][16], export_name[24][80];
static int nexport;
static void build_filters(void) {
    tp_format_patterns(0, open_pat, sizeof open_pat);
    open_filters[0].name = "Pictures"; open_filters[0].pattern = open_pat;
    open_filters[1].name = "All files"; open_filters[1].pattern = "*";
    save_filters[0].name = "OpenRaster, keeps layers (.ora)"; save_filters[0].pattern = "ora";
    save_filters[1].name = "Photoshop, keeps layers (.psd)"; save_filters[1].pattern = "psd";
    nexport = 0;
    for (int i = 0; i < tp_formats_count() && nexport < 24; i++) {
        const TpFileFormat *f = tp_format_at(i);
        if (!f->can_save || !strcmp(f->ext, "jpeg") || !strcmp(f->ext, "tiff")) continue;
        snprintf(export_pat[nexport], 16, "%s", f->ext);
        snprintf(export_name[nexport], 80, "%s (.%s)%s", f->name, f->ext, f->layered ? ", keeps layers" : "");
        export_filters[nexport].name = export_name[nexport]; export_filters[nexport].pattern = export_pat[nexport];
        nexport++;
    }
}
static void SDLCALL file_cb(void *ud, const char *const *list, int filter) {
    if (list && !list[0]) return;                /* cancelled */
    SDL_Event e; SDL_zero(e);
    e.type = A.ev_file; e.user.code = (int)(intptr_t)ud;
    char *path = list ? SDL_strdup(list[0]) : NULL;   /* NULL: no dialog could be shown */
    if (!list) filter = -2;
    e.user.data1 = path; e.user.data2 = (void *)(intptr_t)filter;
    if (!SDL_PushEvent(&e)) SDL_free(path);
}
static int confirm_discard(App *a) {
    if (!a->doc->dirty || a->screenshot) return 1;
    const SDL_MessageBoxButtonData bt[3] = {
        { SDL_MESSAGEBOX_BUTTON_RETURNKEY_DEFAULT, 0, "Save" }, { 0, 1, "Discard" },
        { SDL_MESSAGEBOX_BUTTON_ESCAPEKEY_DEFAULT, 2, "Cancel" } };
    const SDL_MessageBoxData md = { SDL_MESSAGEBOX_WARNING, a->win, "topology paint",
        "This drawing has changes that are not saved.", 3, bt, NULL };
    int which = 2;
    if (!SDL_ShowMessageBox(&md, &which)) return 0;
    if (which == 1) return 1;
    if (which == 0) {
        const char *e = tp_path_ext(a->doc->path);
        if (a->doc->path[0] && (!strcmp(e, "ora") || !strcmp(e, "psd"))) {
            char err[256];
            if (tp_save(a->doc, a->doc->path, err, sizeof err) == 0) { a->doc->dirty = 0; return 1; }
            app_status(a, "Not saved: %s", err); return 0;
        }
        app_action(a, ACT_SAVE_AS);
        app_status(a, "Save the drawing, then try again");
    }
    return 0;
}
static void with_ext(char *path, size_t n, const char *ext) {
    if (tp_path_ext(path)[0]) return;
    size_t k = strlen(path); snprintf(path + k, n - k, ".%s", ext);
}
static void on_file(App *a, int kind, char *path, int filter) {
    char err[256] = "";
    char p[1024];
    if (!path) {
        /* no file dialog on this system (Linux without zenity or xdg-desktop-portal) */
        if (kind == FD_OPEN || kind == FD_IMPORT) { app_status(a, "No file dialog here (install zenity or xdg-desktop-portal); drop a file on the window instead"); return; }
        const char *pics = SDL_GetUserFolder(SDL_FOLDER_PICTURES);
        SDL_Time now = 0; SDL_GetCurrentTime(&now);
        snprintf(p, sizeof p, "%stopology-paint-%lld.%s", pics ? pics : a->pref, (long long)(now / 1000000000), kind == FD_EXPORT ? "png" : "ora");
        filter = -1;
    } else snprintf(p, sizeof p, "%s", path);
    if (kind == FD_OPEN) {
        TpDoc *d = tp_load(p, err, sizeof err);
        if (!d) { app_status(a, "Could not open: %s", err); return; }
        set_doc(a, d); app_status(a, "Opened %s (%dx%d, %d layers)", p, d->w, d->h, d->nlayers);
    } else if (kind == FD_IMPORT) {
        TpDoc *d = tp_load(p, err, sizeof err);
        if (!d) { app_status(a, "Could not import: %s", err); return; }
        TpImage im = tp_flatten(d);
        const char *b = strrchr(p, '/'), *bs = strrchr(p, '\\'); if (bs > b) b = bs;
        tp_undo_push_state(a->doc);
        if (tp_layer_add_image(a->doc, b ? b + 1 : p, &im) < 0) app_status(a, "No room for another layer");
        else app_status(a, "Imported %s as a layer", b ? b + 1 : p);
        tp_image_free(&im); tp_doc_free(d); app_dirty_all(a);
    } else {
        const char *def = kind == FD_SAVE_AS ? (filter == 1 ? "psd" : "ora") : (filter >= 0 && filter < nexport ? export_pat[filter] : "png");
        with_ext(p, sizeof p, def);
        if (!tp_format_for_path(p, 1)) { app_status(a, "No format saves .%s; try .ora, .psd, .png or .jpg", tp_path_ext(p)); return; }
        if (tp_save(a->doc, p, err, sizeof err)) { app_status(a, "Not saved: %s", err); return; }
        const TpFileFormat *f = tp_format_for_path(p, 1);
        if (kind == FD_SAVE_AS || f->layered) { snprintf(a->doc->path, sizeof a->doc->path, "%s", p); a->doc->dirty = 0; }
        app_status(a, "%s %s%s", kind == FD_EXPORT ? "Exported" : "Saved", p, f->layered ? "" : " (flattened)");
    }
}

/* ------------------------------------------------------------ clipboard */
static void *clip_png; static int clip_len;
static const void *SDLCALL clip_cb(void *ud, const char *mime, size_t *size) {
    (void)ud;
    if (mime && !strcmp(mime, "image/png") && clip_png) { *size = (size_t)clip_len; return clip_png; }
    *size = 0; return NULL;
}
static void copy_merged(App *a) {
    TpImage im = tp_flatten(a->doc);
    free(clip_png); clip_png = tp_png_encode(&im, &clip_len);
    tp_image_free(&im);
    static const char *mimes[] = { "image/png" };
    if (clip_png && SDL_SetClipboardData(clip_cb, NULL, NULL, mimes, 1)) app_status(a, "Copied the picture");
    else app_status(a, "Copy failed: %s", SDL_GetError());
}
static void paste(App *a) {
    static const char *mimes[] = { "image/png", "image/bmp", "image/jpeg", "image/tiff" };
    for (int i = 0; i < 4; i++) {
        if (!SDL_HasClipboardData(mimes[i])) continue;
        size_t n = 0; void *data = SDL_GetClipboardData(mimes[i], &n);
        if (!data) continue;
        char err[256]; TpDoc *d = tp_load_memory(data, n, err, sizeof err);
        SDL_free(data);
        if (!d) continue;
        TpImage im = tp_flatten(d);
        tp_undo_push_state(a->doc);
        tp_layer_add_image(a->doc, "Pasted", &im);
        tp_image_free(&im); tp_doc_free(d); app_dirty_all(a);
        app_status(a, "Pasted as a new layer");
        return;
    }
    app_status(a, "The clipboard holds no picture");
}

/* ------------------------------------------------------------ actions */
static void save_brush(App *a) {
    char dir[1100]; snprintf(dir, sizeof dir, "%sbrushes", a->pref);
    SDL_CreateDirectory(dir);
    char path[1400], safe[TP_NAME_MAX]; size_t k = 0;
    for (const char *c = a->brush.name; *c && k < sizeof safe - 1; c++) safe[k++] = (char)((*c == '/' || *c == '\\' || *c == ':' || *c == '*' || *c == '?' || *c == '"' || *c == '<' || *c == '>' || *c == '|') ? '_' : *c);
    safe[k] = 0;
    snprintf(path, sizeof path, "%s/%s.brush", dir, safe);
    if (tp_brush_save(&a->brush, path)) { app_status(a, "Could not write %s", path); return; }
    a->brushes[a->cur_brush] = a->brush; snprintf(a->brush_file[a->cur_brush], 512, "%s", path);
    app_status(a, "Brush saved to %s", path);
}
void app_action(App *a, int act) {
    TpDoc *d = a->doc;
    a->menu_open = 0;
    if (act >= ACT_FILTER_0) {
        int i = act - ACT_FILTER_0;
        if (tp_filter_apply(d, i) == 0) { app_dirty_all(a); app_status(a, "%s applied to %s", tp_filter_at(i)->name, d->layers[d->active].name); }
        else app_status(a, "The filter declined");
        return;
    }
    switch (act) {
    case ACT_NEW: if (confirm_discard(a)) { a->dialog = DLG_NEW; snprintf(a->dlg_w, 16, "%d", d->w); snprintf(a->dlg_h, 16, "%d", d->h); a->dlg_white = 1; } break;
    case ACT_CANVAS_SIZE: a->dialog = DLG_CANVAS; snprintf(a->dlg_w, 16, "%d", d->w); snprintf(a->dlg_h, 16, "%d", d->h); break;
    case ACT_OPEN: if (confirm_discard(a)) SDL_ShowOpenFileDialog(file_cb, (void *)(intptr_t)FD_OPEN, a->win, open_filters, 2, NULL, false); break;
    case ACT_OPEN_RECOVERY: {
        if (!confirm_discard(a)) break;
        char err[256]; TpDoc *r = tp_load(a->recovery, err, sizeof err);
        if (r) { r->path[0] = 0; r->dirty = 1; set_doc(a, r); app_status(a, "Recovered the autosaved drawing; save it somewhere"); }
        else app_status(a, "No recovery file: %s", err);
        break; }
    case ACT_IMPORT_LAYER: SDL_ShowOpenFileDialog(file_cb, (void *)(intptr_t)FD_IMPORT, a->win, open_filters, 2, NULL, false); break;
    case ACT_SAVE: {
        const char *e = tp_path_ext(d->path);
        if (d->path[0] && (!strcmp(e, "ora") || !strcmp(e, "psd"))) {
            char err[256];
            if (tp_save(d, d->path, err, sizeof err)) app_status(a, "Not saved: %s", err);
            else { d->dirty = 0; app_status(a, "Saved %s", d->path); }
            break;
        }
    } /* fall through: no layered file yet */
    case ACT_SAVE_AS: SDL_ShowSaveFileDialog(file_cb, (void *)(intptr_t)FD_SAVE_AS, a->win, save_filters, 2, NULL); break;
    case ACT_EXPORT: SDL_ShowSaveFileDialog(file_cb, (void *)(intptr_t)FD_EXPORT, a->win, export_filters, nexport, NULL); break;
    case ACT_QUIT: if (confirm_discard(a)) a->quit = 1; break;
    case ACT_UNDO: if (tp_undo(d)) { app_dirty_all(a); app_status(a, "Undone"); } break;
    case ACT_REDO: if (tp_redo(d)) { app_dirty_all(a); app_status(a, "Redone"); } break;
    case ACT_COPY: copy_merged(a); break;
    case ACT_PASTE: paste(a); break;
    case ACT_CLEAR_LAYER: tp_undo_begin_pixels(d, d->active); memset(tp_layer_px_mut(d, &d->layers[d->active]), 0, (size_t)d->w * d->h * 4);
        tp_undo_touch(d, 0, 0, d->w, d->h); tp_undo_end_pixels(d); app_dirty_all(a); break;
    case ACT_SWAP_COLORS: { uint32_t t = a->color; app_set_color(a, a->color2); a->color2 = t; break; }
    case ACT_FLIP_H: tp_undo_push_state(d); tp_doc_flip(d, 1); app_dirty_all(a); break;
    case ACT_FLIP_V: tp_undo_push_state(d); tp_doc_flip(d, 0); app_dirty_all(a); break;
    case ACT_ROT_CW: tp_undo_push_state(d); tp_doc_rotate90(d, 1); ensure_texture(a); app_dirty_all(a); break;
    case ACT_ROT_CCW: tp_undo_push_state(d); tp_doc_rotate90(d, 0); ensure_texture(a); app_dirty_all(a); break;
    case ACT_LAYER_NEW: { tp_undo_push_state(d); char nm[32]; snprintf(nm, sizeof nm, "Layer %d", d->nlayers);
        if (tp_layer_add(d, d->active + 1, nm) < 0) app_status(a, "At most %d layers", TP_MAX_LAYERS); break; }
    case ACT_LAYER_DUP: tp_undo_push_state(d); tp_layer_duplicate(d, d->active); app_dirty_all(a); break;
    case ACT_LAYER_DEL: tp_undo_push_state(d); tp_layer_delete(d, d->active); app_dirty_all(a); break;
    case ACT_LAYER_MERGE: if (d->active > 0) { tp_undo_push_state(d); tp_layer_merge_down(d, d->active); app_dirty_all(a); } break;
    case ACT_LAYER_UP: tp_undo_push_state(d); tp_layer_move(d, d->active, 1); app_dirty_all(a); break;
    case ACT_LAYER_DOWN: tp_undo_push_state(d); tp_layer_move(d, d->active, -1); app_dirty_all(a); break;
    case ACT_LAYER_RENAME: a->renaming = 1; snprintf(a->rename_buf, sizeof a->rename_buf, "%s", d->layers[d->active].name);
        a->ui.focus = ui_id("rename", 0); a->ui.caret = (int)strlen(a->rename_buf); break;
    case ACT_LAYER_LOCK: tp_undo_push_state(d); d->layers[d->active].alpha_lock ^= 1; break;
    case ACT_LAYER_VIS: d->layers[d->active].visible ^= 1; d->dirty = 1; app_dirty_all(a); break;
    case ACT_ZOOM_IN: { int x, y, w, h; view_rect(a, &x, &y, &w, &h); zoom_at(a, 1.25f, x + w / 2.0f, y + h / 2.0f); break; }
    case ACT_ZOOM_OUT: { int x, y, w, h; view_rect(a, &x, &y, &w, &h); zoom_at(a, 0.8f, x + w / 2.0f, y + h / 2.0f); break; }
    case ACT_FIT: fit(a); break;
    case ACT_ZOOM_100: { int x, y, w, h; view_rect(a, &x, &y, &w, &h); zoom_at(a, 1.0f / (a->zoom * a->dpr), x + w / 2.0f, y + h / 2.0f); break; }
    case ACT_ROT_LEFT: a->rot = fmodf(a->rot - 15 + 360, 360); break;
    case ACT_ROT_RIGHT: a->rot = fmodf(a->rot + 15, 360); break;
    case ACT_ROT_RESET: a->rot = 0; break;
    case ACT_MIRROR: a->mirror ^= 1; app_status(a, a->mirror ? "View mirrored (the picture is not changed)" : "View not mirrored"); break;
    case ACT_PANELS: a->panels ^= 1; break;
    case ACT_HELP: a->help ^= 1; break;
    case ACT_ABOUT: app_status(a, "topology paint %s, by Bryant Frankford and Contributors; GPL-3.0-or-later OR LGPL-3.0-or-later", TPAINT_VERSION); break;
    case ACT_USER_FOLDER: {
        char dir[1100]; snprintf(dir, sizeof dir, "%smods", a->pref); SDL_CreateDirectory(dir);
        snprintf(dir, sizeof dir, "%sbrushes", a->pref); SDL_CreateDirectory(dir);
        char url[1200]; snprintf(url, sizeof url, "file://%s", a->pref);
        if (!SDL_OpenURL(url)) app_status(a, "Your folder: %s", a->pref);
        else app_status(a, "Opened %s (brushes/, mods/, palettes/ go here)", a->pref);
        break; }
    case ACT_SAVE_BRUSH: save_brush(a); break;
    case ACT_RELOAD: { char nm[TP_NAME_MAX]; snprintf(nm, sizeof nm, "%s", a->brush.name); load_brushes(a); load_palettes(a);
        for (int i = 0; i < a->nbrushes; i++) if (!strcmp(a->brushes[i].name, nm)) { a->cur_brush = i; a->brush = a->brushes[i]; }
        app_status(a, "%d brushes, %d palettes", a->nbrushes, a->npals); break; }
    }
}

/* ------------------------------------------------------------ painting */
static float pressure_now(App *a, int pen) { return pen ? tp_curve_apply(&a->curve, a->pen_raw) : a->mouse_pressure; }
static void take_dirty(App *a) {
    int x, y, w, h;
    if (tp_stroke_take_dirty(&a->stroke, &x, &y, &w, &h)) dirty(a, x, y, w, h);
}
static void canvas_down(App *a, float sx, float sy, int pen, int button, int eraser_tip) {
    float cx, cy; to_canvas(a, sx, sy, &cx, &cy);
    Tool t = a->tool;
    if (a->space || button == 2 || (pen && (a->pen_buttons & SDL_PEN_INPUT_BUTTON_2))) t = TOOL_PAN;
    else if (a->alt || button == 3 || (pen && (a->pen_buttons & SDL_PEN_INPUT_BUTTON_1))) t = TOOL_PICK;
    else if (eraser_tip && (t == TOOL_BRUSH || t == TOOL_FILL)) t = TOOL_ERASER;
    switch (t) {
    case TOOL_PAN: a->cap = CAP_PAN; a->pan_sx = sx; a->pan_sy = sy; a->pan_px = a->panx; a->pan_py = a->pany; break;
    case TOOL_PICK: a->cap = CAP_PICK; { uint32_t c = tp_pick(a->doc, (int)cx, (int)cy, 1); if (c >> 24) app_set_color(a, c); } break;
    case TOOL_FILL:
        if (tp_fill(a->doc, (int)cx, (int)cy, a->color, a->fill_tol, a->sample_merged)) app_dirty_all(a);
        break;
    default: {
        TpLayer *L = &a->doc->layers[a->doc->active];
        if (!L->visible) { app_status(a, "The layer \"%s\" is hidden: show it to paint on it", L->name); break; }
        TpBrush b = a->brush;
        if (t == TOOL_ERASER) b.mode = TP_MODE_ERASE;
        float p = pressure_now(a, pen);
        int shift = (SDL_GetModState() & SDL_KMOD_SHIFT) != 0;
        if (shift && a->have_last) {          /* a straight line from where the last stroke ended */
            b.smoothing = 0;
            tp_stroke_begin(a->doc, &a->stroke, &b, a->color, a->last_cx, a->last_cy, p, a->pen_tx, a->pen_ty);
            tp_stroke_to(a->doc, &a->stroke, cx, cy, p, a->pen_tx, a->pen_ty);
        } else tp_stroke_begin(a->doc, &a->stroke, &b, a->color, cx, cy, p, a->pen_tx, a->pen_ty);
        a->cap = CAP_STROKE;
        take_dirty(a);
    } }
    a->last_cx = cx; a->last_cy = cy; a->have_last = 1;
}
static void canvas_move(App *a, float sx, float sy, int pen) {
    float cx, cy; to_canvas(a, sx, sy, &cx, &cy);
    if (a->cap == CAP_STROKE) { tp_stroke_to(a->doc, &a->stroke, cx, cy, pressure_now(a, pen), a->pen_tx, a->pen_ty); take_dirty(a); a->last_cx = cx; a->last_cy = cy; }
    else if (a->cap == CAP_PAN) { a->panx = a->pan_px + sx - a->pan_sx; a->pany = a->pan_py + sy - a->pan_sy; }
    else if (a->cap == CAP_PICK) { uint32_t c = tp_pick(a->doc, (int)cx, (int)cy, 1); if (c >> 24) app_set_color(a, c); }
}
static void canvas_up(App *a) {
    if (a->cap == CAP_STROKE) { tp_stroke_end(a->doc, &a->stroke); take_dirty(a); }
    a->cap = CAP_NONE;
}
static int over_canvas(App *a, float x, float y) {
    int vx, vy, vw, vh; view_rect(a, &vx, &vy, &vw, &vh);
    return !a->menu_open && !a->help && a->dialog == DLG_NONE && x >= vx && y >= vy && x < vx + vw && y < vy + vh;
}
static void pointer_down(App *a, float x, float y, int pen, int button, int eraser, int clicks) {
    a->hx = x; a->hy = y;
    if (over_canvas(a, x, y) && !a->ui.focus) { canvas_down(a, x, y, pen, button, eraser); return; }
    if (a->ui.focus && over_canvas(a, x, y)) { a->ui.focus = 0; a->renaming = 0; }
    a->cap = CAP_UI;
    a->ui.mx = x; a->ui.my = y;
    if (button == 3) a->ui.right_pressed = 1; else { a->ui.down = 1; a->ui.pressed = 1; a->ui.dbl = clicks >= 2; }
}
static void pointer_move(App *a, float x, float y, int pen) {
    a->hx = x; a->hy = y;
    if (a->cap == CAP_STROKE || a->cap == CAP_PAN || a->cap == CAP_PICK) canvas_move(a, x, y, pen);
    else { a->ui.mx = x; a->ui.my = y; }
}
static void pointer_up(App *a, float x, float y) {
    a->hx = x; a->hy = y;
    if (a->cap == CAP_UI || a->cap == CAP_NONE) { a->ui.mx = x; a->ui.my = y; a->ui.down = 0; a->ui.released = 1; }
    else canvas_up(a);
    a->cap = CAP_NONE;
}

/* ------------------------------------------------------------ keys */
static int key_action(SDL_Keycode k, SDL_Keymod m) {
    int ctrl = (m & (SDL_KMOD_CTRL | SDL_KMOD_GUI)) != 0, shift = (m & SDL_KMOD_SHIFT) != 0, alt = (m & SDL_KMOD_ALT) != 0;
    if (ctrl) {
        switch (k) {
        case SDLK_N: return shift ? ACT_LAYER_NEW : ACT_NEW;
        case SDLK_O: return ACT_OPEN;
        case SDLK_S: return shift ? ACT_SAVE_AS : ACT_SAVE;
        case SDLK_E: return shift ? ACT_EXPORT : ACT_LAYER_MERGE;
        case SDLK_I: return ACT_IMPORT_LAYER;
        case SDLK_Z: return shift ? ACT_REDO : ACT_UNDO;
        case SDLK_Y: return ACT_REDO;
        case SDLK_C: return ACT_COPY;
        case SDLK_V: return ACT_PASTE;
        case SDLK_J: return ACT_LAYER_DUP;
        case SDLK_Q: return ACT_QUIT;
        case SDLK_0: return ACT_FIT;
        case SDLK_1: return ACT_ZOOM_100;
        case SDLK_EQUALS: case SDLK_PLUS: case SDLK_KP_PLUS: return ACT_ZOOM_IN;
        case SDLK_MINUS: case SDLK_KP_MINUS: return ACT_ZOOM_OUT;
        case SDLK_UP: case SDLK_RIGHTBRACKET: return ACT_LAYER_UP;
        case SDLK_DOWN: case SDLK_LEFTBRACKET: return ACT_LAYER_DOWN;
        }
        return ACT_NONE;
    }
    (void)alt;
    switch (k) {
    case SDLK_DELETE: case SDLK_BACKSPACE: return ACT_CLEAR_LAYER;
    case SDLK_X: return ACT_SWAP_COLORS;
    case SDLK_M: return ACT_MIRROR;
    case SDLK_R: return shift ? ACT_ROT_LEFT : ACT_ROT_RIGHT;
    case SDLK_0: return ACT_ROT_RESET;
    case SDLK_TAB: return ACT_PANELS;
    case SDLK_F1: return ACT_HELP;
    case SDLK_EQUALS: case SDLK_PLUS: case SDLK_KP_PLUS: return ACT_ZOOM_IN;
    case SDLK_MINUS: case SDLK_KP_MINUS: return ACT_ZOOM_OUT;
    case SDLK_F2: return ACT_LAYER_RENAME;
    case SDLK_SLASH: return ACT_LAYER_LOCK;
    }
    return ACT_NONE;
}
static void on_key(App *a, SDL_KeyboardEvent *e) {
    a->space = (e->key == SDLK_SPACE) ? e->down : a->space;
    a->alt = (SDL_GetModState() & SDL_KMOD_ALT) != 0;
    if (!e->down) return;
    if (a->ui.focus) {                     /* a text field has the keys */
        if (e->key == SDLK_BACKSPACE) a->ui.k_back = 1;
        else if (e->key == SDLK_RETURN || e->key == SDLK_KP_ENTER) a->ui.k_enter = 1;
        else if (e->key == SDLK_ESCAPE) a->ui.k_esc = 1;
        else if (e->key == SDLK_LEFT) a->ui.k_left = 1;
        else if (e->key == SDLK_RIGHT) a->ui.k_right = 1;
        return;
    }
    if (e->key == SDLK_ESCAPE) { a->menu_open = 0; a->help = 0; a->dialog = DLG_NONE; a->renaming = 0; return; }
    if (e->repeat && e->key != SDLK_LEFTBRACKET && e->key != SDLK_RIGHTBRACKET && e->key != SDLK_Z && e->key != SDLK_Y) return;
    SDL_Keymod m = e->mod;
    if (!(m & (SDL_KMOD_CTRL | SDL_KMOD_GUI))) {
        switch (e->key) {
        case SDLK_B: a->tool = TOOL_BRUSH; return;
        case SDLK_E: a->tool = a->tool == TOOL_ERASER ? TOOL_BRUSH : TOOL_ERASER; return;
        case SDLK_G: a->tool = TOOL_FILL; return;
        case SDLK_I: a->tool = TOOL_PICK; return;
        case SDLK_H: a->tool = TOOL_PAN; return;
        case SDLK_LEFTBRACKET: a->brush.size = fmaxf(0.5f, a->brush.size / 1.15f); app_status(a, "Size %.1f px", a->brush.size); return;
        case SDLK_RIGHTBRACKET: a->brush.size = fminf(2000, a->brush.size * 1.15f); app_status(a, "Size %.1f px", a->brush.size); return;
        case SDLK_1: case SDLK_2: case SDLK_3: case SDLK_4: case SDLK_5: case SDLK_6: case SDLK_7: case SDLK_8: case SDLK_9:
            if (!(m & SDL_KMOD_SHIFT)) { app_select_brush(a, (int)(e->key - SDLK_1)); return; }
            break;
        }
    }
    int act = key_action(e->key, m);
    if (act) app_action(a, act);
}

/* ------------------------------------------------------------ drawing a frame */
static void render(App *a) {
    flush_picture(a);
    int ow, oh; SDL_GetCurrentRenderOutputSize(a->ren, &ow, &oh);
    a->dpr = a->ww > 0 ? (float)ow / a->ww : 1;
    SDL_SetRenderDrawColor(a->ren, 0x0d, 0x11, 0x17, 255);
    SDL_RenderClear(a->ren);
    int vx, vy, vw, vh; view_rect(a, &vx, &vy, &vw, &vh);
    SDL_Rect clip = { (int)(vx * a->dpr), (int)(vy * a->dpr), (int)(vw * a->dpr), (int)(vh * a->dpr) };
    SDL_SetRenderClipRect(a->ren, &clip);
    SDL_SetRenderDrawColor(a->ren, 0x2a, 0x2f, 0x37, 255);
    SDL_FRect bgr = { (float)clip.x, (float)clip.y, (float)clip.w, (float)clip.h };
    SDL_RenderFillRect(a->ren, &bgr);
    float cx, cy; view_center(a, &cx, &cy);
    float w = a->doc->w * a->zoom, h = a->doc->h * a->zoom;
    SDL_FRect dst = { (cx - w / 2) * a->dpr, (cy - h / 2) * a->dpr, w * a->dpr, h * a->dpr };
    SDL_SetTextureScaleMode(a->tex, a->zoom * a->dpr >= 1.5f ? SDL_SCALEMODE_NEAREST : SDL_SCALEMODE_LINEAR);
    SDL_RenderTextureRotated(a->ren, a->tex, NULL, &dst, a->rot, NULL, a->mirror ? SDL_FLIP_HORIZONTAL : SDL_FLIP_NONE);
    SDL_SetRenderClipRect(a->ren, NULL);

    /* the interface, drawn in software at point size */
    if (!a->uitex || a->uiw != a->ww || a->uih != a->wh) {
        if (a->uitex) SDL_DestroyTexture(a->uitex);
        a->uiw = a->ww; a->uih = a->wh;
        a->uitex = SDL_CreateTexture(a->ren, SDL_PIXELFORMAT_RGBA32, SDL_TEXTUREACCESS_STREAMING, a->uiw, a->uih);
        SDL_SetTextureBlendMode(a->uitex, SDL_BLENDMODE_BLEND);
        free(a->uibuf); a->uibuf = malloc((size_t)a->uiw * a->uih * 4);
    }
    float frac = a->dpr - floorf(a->dpr);
    SDL_SetTextureScaleMode(a->uitex, frac < 0.01f ? SDL_SCALEMODE_NEAREST : SDL_SCALEMODE_LINEAR);
    a->ui.px = a->uibuf; a->ui.w = a->uiw; a->ui.h = a->uih;
    a->ui.enabled = a->cap == CAP_NONE || a->cap == CAP_UI;
    ui_begin(&a->ui);
    panels_draw(a);
    ui_end(&a->ui);
    SDL_UpdateTexture(a->uitex, NULL, a->uibuf, a->uiw * 4);
    SDL_RenderTexture(a->ren, a->uitex, NULL, NULL);
    SDL_RenderPresent(a->ren);
}

/* ------------------------------------------------------------ screenshots (README, and a smoke test) */
static float demo_size;
static void demo_line(App *a, int brush, uint32_t col, float x0, float y0, float x1, float y1, float bend, float p0, float pm, float p1) {
    TpBrush b; tp_brush_builtin(brush, &b); b.smoothing = 0;
    if (demo_size > 0) b.size = demo_size;
    TpStroke s; tp_stroke_begin(a->doc, &s, &b, col, x0, y0, p0, 0, 0);
    for (int i = 1; i <= 80; i++) {
        float t = i / 80.0f, mx = (x0 + x1) / 2 - (y1 - y0) * bend, my = (y0 + y1) / 2 + (x1 - x0) * bend;
        float x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * mx + t * t * x1, y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * my + t * t * y1;
        float p = t < 0.5f ? p0 + (pm - p0) * t * 2 : pm + (p1 - pm) * (t - 0.5f) * 2;
        tp_stroke_to(a->doc, &s, x, y, p, 0, 0);
    }
    tp_stroke_end(a->doc, &s);
}
static void demo_scene(App *a) {
    TpDoc *d = tp_doc_new(1600, 1000, 0xffffffffu);
    snprintf(d->layers[0].name, TP_NAME_MAX, "Sky");
    uint8_t *px = d->layers[0].buf->px;
    for (int y = 0; y < d->h; y++) for (int x = 0; x < d->w; x++) {
        float t = (float)y / d->h, gx = (float)x / d->w;
        uint8_t *q = px + ((size_t)y * d->w + x) * 4;
        q[0] = (uint8_t)(30 + 225 * powf(t, 1.6f) * (0.85f + 0.15f * gx)); q[1] = (uint8_t)(40 + 120 * powf(t, 2.0f)); q[2] = (uint8_t)(90 + 40 * (1 - t)); q[3] = 255;
    }
    snprintf(d->layers[1].name, TP_NAME_MAX, "Hills");
    uint8_t *hp = d->layers[1].buf->px;
    for (int x = 0; x < d->w; x++) {
        float f = (float)x;
        int h1 = (int)(640 + 60 * sinf(f * 0.004f) + 25 * sinf(f * 0.013f + 1));
        int h2 = (int)(760 + 45 * sinf(f * 0.006f + 2) + 15 * sinf(f * 0.03f));
        for (int y = h1; y < d->h; y++) { uint8_t *q = hp + ((size_t)y * d->w + x) * 4; q[0] = 52; q[1] = 38; q[2] = 70; q[3] = 255; }
        for (int y = h2; y < d->h; y++) { uint8_t *q = hp + ((size_t)y * d->w + x) * 4; q[0] = 22; q[1] = 18; q[2] = 34; q[3] = 255; }
    }
    a->doc = NULL; set_doc(a, d);
    int glow = tp_layer_add(d, 1, "Glow (Screen)"); d->layers[glow].blend = TP_BLEND_SCREEN;
    d->active = glow;
    demo_size = 420;
    demo_line(a, 3, 0xff3070ffu, 980, 600, 1180, 600, 0, 1, 1, 1);
    demo_size = 260;
    demo_line(a, 3, 0xff2050f0u, 600, 640, 1500, 630, 0.02f, 0.4f, 1, 0.4f);
    demo_size = 0;
    TpBrush sun; tp_brush_builtin(2, &sun); sun.size = 150; sun.hardness = 0.9f; sun.pressure_size = 0;
    TpStroke s; tp_stroke_begin(d, &s, &sun, 0xff90e0ffu, 1080, 560, 1, 0, 0); tp_stroke_end(d, &s);
    int ink = tp_layer_add(d, d->nlayers, "Ink (pressure)");
    d->active = ink;
    for (int i = 0; i < 7; i++) {     /* birds: two tapered strokes each, light-firm-light */
        float bx = 380 + i * 95 + (i % 2) * 30, by = 260 + (i * 37) % 120, sz = 34 - i * 2.5f;
        demo_line(a, 1, 0xff20141au, bx - sz, by - sz * 0.25f, bx, by + sz * 0.15f, 0.18f, 0.05f, 0.9f, 0.35f);
        demo_line(a, 1, 0xff20141au, bx, by + sz * 0.15f, bx + sz, by - sz * 0.35f, 0.18f, 0.35f, 0.9f, 0.05f);
    }
    demo_size = 5;
    for (int i = 0; i < 5; i++)        /* grass: firm at the root, light at the tip */
        for (int k = 0; k < 9; k++) {
            float gx = 160 + i * 290 + k * 14, gy = 900 + (k % 3) * 8;
            demo_line(a, 1, 0xff0e0a12u, gx, gy, gx + 12 - k * 2.5f, gy - 70 - (k * 13) % 40, 0.06f, 1, 0.6f, 0.02f);
        }
    demo_size = 0;
    demo_line(a, 5, 0xfff0f0ffu, 120, 120, 520, 110, 0.06f, 0.2f, 1, 0.1f);   /* calligraphy */
    demo_line(a, 0, 0xfff0e8ffu, 120, 160, 470, 150, -0.04f, 0.1f, 0.9f, 0.1f);
    d->dirty = 0;
    snprintf(d->path, sizeof d->path, "dusk.ora");
    app_select_brush(a, 1);
    a->pen_seen = 1; a->pen_raw = 0.62f; a->pen_tx = 18; a->pen_ty = -7;
    app_dirty_all(a);
}
static int screenshot(App *a, const char *path) {
    render(a); render(a);
    SDL_Surface *s = SDL_RenderReadPixels(a->ren, NULL);
    if (!s) { fprintf(stderr, "read pixels: %s\n", SDL_GetError()); return 1; }
    SDL_Surface *c = SDL_ConvertSurface(s, SDL_PIXELFORMAT_RGBA32);
    SDL_DestroySurface(s);
    if (!c) return 1;
    TpImage im = { c->w, c->h, c->pitch, c->pixels };
    for (int y = 0; y < c->h; y++) for (int x = 0; x < c->w; x++) ((uint8_t *)c->pixels)[(size_t)y * c->pitch + x * 4 + 3] = 255;
    int n = 0; void *png = tp_png_encode(&im, &n);
    int r = png ? tp_write_file(path, png, (size_t)n) : -1;
    free(png); SDL_DestroySurface(c);
    printf("screenshot %s: %s\n", path, r ? "failed" : "written");
    return r ? 1 : 0;
}

/* ------------------------------------------------------------ start, loop, end */
static void usage(void) {
    printf("Usage: topology-paint [FILE]\n"
           "       topology-paint --screenshot OUT.png [--scene 1|2|3] [--size WxH]\n"
           "       topology-paint --version | --help\n"
           "Opens FILE (any format it reads), or a new 1920x1080 drawing.\n");
}
int main(int argc, char **argv) {
    const char *open_path = NULL, *shot = NULL; int scene = 1, sw = 1500, sh = 900;
    for (int i = 1; i < argc; i++) {
        if (!strcmp(argv[i], "--version")) { printf("topology paint %s\n", TPAINT_VERSION); return 0; }
        else if (!strcmp(argv[i], "--help")) { usage(); return 0; }
        else if (!strcmp(argv[i], "--screenshot") && i + 1 < argc) shot = argv[++i];
        else if (!strcmp(argv[i], "--scene") && i + 1 < argc) scene = atoi(argv[++i]);
        else if (!strcmp(argv[i], "--size") && i + 1 < argc) sscanf(argv[++i], "%dx%d", &sw, &sh);
        else if (argv[i][0] != '-') open_path = argv[i];
    }
    App *a = &A;
    a->screenshot = shot != NULL;
    SDL_SetHint(SDL_HINT_PEN_MOUSE_EVENTS, "0");   /* the pen is a pen, not also a mouse */
    SDL_SetHint(SDL_HINT_PEN_TOUCH_EVENTS, "0");
    SDL_SetHint(SDL_HINT_APP_NAME, "topology paint");
    if (shot) SDL_SetHint(SDL_HINT_RENDER_DRIVER, "software");
    if (!SDL_Init(SDL_INIT_VIDEO)) { fprintf(stderr, "SDL_Init: %s\n", SDL_GetError()); return 1; }
    a->win = SDL_CreateWindow("topology paint", shot ? sw : 1400, shot ? sh : 860, SDL_WINDOW_RESIZABLE | SDL_WINDOW_HIGH_PIXEL_DENSITY);
    if (!a->win) { fprintf(stderr, "window: %s\n", SDL_GetError()); return 1; }
    a->ren = SDL_CreateRenderer(a->win, NULL);
    if (!a->ren) { fprintf(stderr, "renderer: %s\n", SDL_GetError()); return 1; }
    SDL_SetRenderVSync(a->ren, 1);
    SDL_SetWindowMinimumSize(a->win, 900, 600);
    if (!shot) SDL_MaximizeWindow(a->win);
    a->max_tex = (int)SDL_GetNumberProperty(SDL_GetRendererProperties(a->ren), SDL_PROP_RENDERER_MAX_TEXTURE_SIZE_NUMBER, 16384);
    a->ev_file = SDL_RegisterEvents(1);
    a->cur_cross = SDL_CreateSystemCursor(SDL_SYSTEM_CURSOR_CROSSHAIR);
    a->cur_arrow = SDL_CreateSystemCursor(SDL_SYSTEM_CURSOR_DEFAULT);
    a->cur_hand = SDL_CreateSystemCursor(SDL_SYSTEM_CURSOR_MOVE);

    const char *bp = SDL_GetBasePath();
    snprintf(a->base, sizeof a->base, "%s", bp ? bp : "./");
    char *pp = SDL_GetPrefPath("inputloop", "topology-paint");
    snprintf(a->pref, sizeof a->pref, "%s", pp ? pp : "./");
    SDL_free(pp);
    snprintf(a->recovery, sizeof a->recovery, "%sautosave.ora", a->pref);

    tp_set_log(log_to_status);
    tp_core_init();
    if (!shot) {
        char dir[1100];
        snprintf(dir, sizeof dir, "%smods", a->base); tp_mods_load_dir(dir);
        snprintf(dir, sizeof dir, "%smods", a->pref); tp_mods_load_dir(dir);
    } else {
        char dir[1100]; snprintf(dir, sizeof dir, "%smods", a->base); tp_mods_load_dir(dir);
    }
    build_filters();
    a->panels = 1; a->zoom = 1; a->tool = TOOL_BRUSH;
    a->curve.softness = 0.15f; a->curve.min_in = 0.02f; a->curve.max_in = 0.95f;
    a->mouse_pressure = 0.75f; a->fill_tol = 24; a->autosave_min = 3;
    app_set_color(a, 0xff2a1a12u); a->color2 = 0xffffffffu;
    load_brushes(a); load_palettes(a);
    app_select_brush(a, 2);
    if (!shot) settings_load(a);
    SDL_GetWindowSize(a->win, &a->ww, &a->wh);

    if (shot) demo_scene(a);
    else {
        TpDoc *d = NULL;
        if (open_path) {
            char err[256]; d = tp_load(open_path, err, sizeof err);
            if (!d) app_status(a, "Could not open %s: %s", open_path, err);
        }
        set_doc(a, d ? d : tp_doc_new(1920, 1080, 0xffffffffu));
        SDL_PathInfo info;
        if (SDL_GetPathInfo(a->recovery, &info)) app_status(a, "An autosaved drawing was kept: File > Open Recovery");
        else if (!a->status[0]) app_status(a, "Ready. F1 shows the keys and how to set up a pen tablet.");
    }
    if (shot) {
        if (scene == 2) { a->menu_open = 5; a->menu_x = 0; }
        if (scene == 3) a->help = 1;
        a->hx = 760; a->hy = 420; a->hover_canvas = 1;
        int r = screenshot(a, shot);
        SDL_Quit();
        return r;
    }
    SDL_StartTextInput(a->win);
    a->last_autosave = SDL_GetTicks();
    while (!a->quit) {
        SDL_Event e;
        int got = SDL_WaitEventTimeout(&e, 250);
        while (got) {
            switch (e.type) {
            case SDL_EVENT_QUIT: app_action(a, ACT_QUIT); break;
            case SDL_EVENT_WINDOW_RESIZED: case SDL_EVENT_WINDOW_PIXEL_SIZE_CHANGED: SDL_GetWindowSize(a->win, &a->ww, &a->wh); break;
            /* the pen */
            case SDL_EVENT_PEN_PROXIMITY_IN: a->pen_seen = 1; break;
            case SDL_EVENT_PEN_AXIS:
                a->pen_seen = 1;
                if (e.paxis.axis == SDL_PEN_AXIS_PRESSURE) a->pen_raw = e.paxis.value;
                else if (e.paxis.axis == SDL_PEN_AXIS_XTILT) a->pen_tx = e.paxis.value;
                else if (e.paxis.axis == SDL_PEN_AXIS_YTILT) a->pen_ty = e.paxis.value;
                break;
            case SDL_EVENT_PEN_DOWN:
                a->pen_seen = 1; a->pen_down = 1; a->pen_eraser = e.ptouch.eraser; a->pen_buttons = (int)e.ptouch.pen_state;
                pointer_down(a, e.ptouch.x, e.ptouch.y, 1, 1, e.ptouch.eraser, 1);
                break;
            case SDL_EVENT_PEN_MOTION:
                a->pen_buttons = (int)e.pmotion.pen_state;
                pointer_move(a, e.pmotion.x, e.pmotion.y, 1);
                break;
            case SDL_EVENT_PEN_UP: a->pen_down = 0; a->pen_raw = 0; pointer_up(a, e.ptouch.x, e.ptouch.y); break;
            case SDL_EVENT_PEN_BUTTON_DOWN: case SDL_EVENT_PEN_BUTTON_UP: a->pen_buttons = (int)e.pbutton.pen_state; break;
            /* the mouse (a pen's own mouse events are switched off above) */
            case SDL_EVENT_MOUSE_BUTTON_DOWN:
                if (e.button.which == SDL_PEN_MOUSEID || e.button.which == SDL_TOUCH_MOUSEID || a->pen_down) break;
                pointer_down(a, e.button.x, e.button.y, 0, e.button.button == SDL_BUTTON_MIDDLE ? 2 : e.button.button == SDL_BUTTON_RIGHT ? 3 : 1, 0, e.button.clicks);
                break;
            case SDL_EVENT_MOUSE_MOTION:
                if (e.motion.which == SDL_PEN_MOUSEID || e.motion.which == SDL_TOUCH_MOUSEID || a->pen_down) break;
                pointer_move(a, e.motion.x, e.motion.y, 0);
                break;
            case SDL_EVENT_MOUSE_BUTTON_UP:
                if (e.button.which == SDL_PEN_MOUSEID || e.button.which == SDL_TOUCH_MOUSEID || a->pen_down) break;
                pointer_up(a, e.button.x, e.button.y);
                break;
            case SDL_EVENT_MOUSE_WHEEL:
                if (over_canvas(a, e.wheel.mouse_x, e.wheel.mouse_y)) {
                    if (SDL_GetModState() & SDL_KMOD_CTRL) { a->brush.size = fmaxf(0.5f, fminf(2000, a->brush.size * (e.wheel.y > 0 ? 1.1f : 1 / 1.1f))); }
                    else zoom_at(a, e.wheel.y > 0 ? 1.15f : 1 / 1.15f, e.wheel.mouse_x, e.wheel.mouse_y);
                } else { a->ui.wheel += e.wheel.y; a->ui.mx = e.wheel.mouse_x; a->ui.my = e.wheel.mouse_y; }
                break;
            case SDL_EVENT_KEY_DOWN: case SDL_EVENT_KEY_UP: on_key(a, &e.key); break;
            case SDL_EVENT_TEXT_INPUT:
                if (a->ui.focus) { size_t k = strlen(e.text.text); if (a->ui.n_text + (int)k < 63) { memcpy(a->ui.text + a->ui.n_text, e.text.text, k); a->ui.n_text += (int)k; a->ui.text[a->ui.n_text] = 0; } }
                break;
            case SDL_EVENT_DROP_FILE: {
                char err[256];
                TpDoc *d = tp_load(e.drop.data, err, sizeof err);
                if (!d) { app_status(a, "Could not open %s: %s", e.drop.data, err); break; }
                if (!a->doc->dirty && !tp_undo_can(a->doc)) { set_doc(a, d); app_status(a, "Opened %s", e.drop.data); }
                else { TpImage im = tp_flatten(d); tp_undo_push_state(a->doc); tp_layer_add_image(a->doc, "Dropped", &im); tp_image_free(&im); tp_doc_free(d); app_dirty_all(a); app_status(a, "Added %s as a layer", e.drop.data); }
                break; }
            default:
                if (e.type == a->ev_file) { on_file(a, e.user.code, e.user.data1, (int)(intptr_t)e.user.data2); SDL_free(e.user.data1); }
            }
            got = SDL_PollEvent(&e);
        }
        a->hover_canvas = over_canvas(a, a->hx, a->hy);
        Tool shown = a->space ? TOOL_PAN : a->tool;
        SDL_SetCursor(a->hover_canvas ? (shown == TOOL_PAN ? a->cur_hand : a->cur_cross) : a->cur_arrow);
        if (a->hover_canvas && (shown == TOOL_BRUSH || shown == TOOL_ERASER)) SDL_HideCursor(); else SDL_ShowCursor();
        render(a);
        update_title(a);
        /* autosave, so a crash or a flat battery costs minutes, not a drawing */
        if (a->autosave_min > 0 && a->doc->dirty && a->cap == CAP_NONE && SDL_GetTicks() - a->last_autosave > (Uint64)a->autosave_min * 60000) {
            char err[256]; TpDoc *d = a->doc; char keep[1024]; snprintf(keep, sizeof keep, "%s", d->path);
            int was = d->dirty;
            if (tp_save(d, a->recovery, err, sizeof err) == 0) app_status(a, "Autosaved (a copy for recovery)");
            snprintf(d->path, sizeof d->path, "%s", keep); d->dirty = was;
            a->last_autosave = SDL_GetTicks();
        }
    }
    settings_save(a);
    remove(a->recovery);                   /* a clean exit needs no recovery */
    SDL_StopTextInput(a->win);
    SDL_Quit();
    return 0;
}
