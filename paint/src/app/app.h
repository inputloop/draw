/* SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
 * app.h -- the state of the running program, shared by main.c (events,
 * actions, rendering) and panels.c (what is drawn where). */
#ifndef TP_APP_H
#define TP_APP_H
#include <SDL3/SDL.h>
#include "tpaint.h"
#include "ui.h"

/* layout, in UI points */
#define MENU_H    26
#define TOOL_W    60
#define BRUSH_W   214
#define PANEL_W   268
#define STATUS_H  24

typedef enum { TOOL_BRUSH, TOOL_ERASER, TOOL_FILL, TOOL_PICK, TOOL_PAN, TOOL_COUNT } Tool;
typedef enum { CAP_NONE, CAP_STROKE, CAP_PAN, CAP_PICK, CAP_UI } Capture;
typedef enum { DLG_NONE, DLG_NEW, DLG_CANVAS } Dialog;

typedef enum {
    ACT_NONE,
    ACT_NEW, ACT_OPEN, ACT_OPEN_RECOVERY, ACT_SAVE, ACT_SAVE_AS, ACT_EXPORT, ACT_IMPORT_LAYER, ACT_QUIT,
    ACT_UNDO, ACT_REDO, ACT_COPY, ACT_PASTE, ACT_CLEAR_LAYER, ACT_SWAP_COLORS,
    ACT_FLIP_H, ACT_FLIP_V, ACT_ROT_CW, ACT_ROT_CCW, ACT_CANVAS_SIZE,
    ACT_LAYER_NEW, ACT_LAYER_DUP, ACT_LAYER_DEL, ACT_LAYER_MERGE, ACT_LAYER_UP, ACT_LAYER_DOWN,
    ACT_LAYER_RENAME, ACT_LAYER_LOCK, ACT_LAYER_VIS,
    ACT_ZOOM_IN, ACT_ZOOM_OUT, ACT_FIT, ACT_ZOOM_100, ACT_ROT_LEFT, ACT_ROT_RIGHT, ACT_ROT_RESET,
    ACT_MIRROR, ACT_PANELS,
    ACT_HELP, ACT_USER_FOLDER, ACT_ABOUT, ACT_SAVE_BRUSH, ACT_RELOAD,
    ACT_FILTER_0 = 1000          /* + filter index */
} Action;

#define MAX_BRUSHES 160
#define MAX_PALETTES 16

typedef struct App {
    SDL_Window *win; SDL_Renderer *ren;
    SDL_Texture *tex, *uitex;
    int tex_w, tex_h, max_tex;
    uint8_t *disp;                       /* the picture on the checkerboard, doc-sized */
    int ww, wh; float dpr;               /* window in points, pixels per point */
    UI ui; uint8_t *uibuf; int uiw, uih;

    TpDoc *doc;
    int dx0, dy0, dx1, dy1;              /* part of disp out of date */

    float zoom, panx, pany, rot; int mirror;

    Tool tool;
    TpBrush brushes[MAX_BRUSHES]; int nbrushes, cur_brush;
    char brush_file[MAX_BRUSHES][512];
    TpBrush brush;                       /* the working copy the sliders change */
    float hue, sat, val; uint32_t color, color2;
    TpPalette pals[MAX_PALETTES]; int npals, cur_pal;
    TpCurve curve;
    float mouse_pressure;
    int fill_tol, sample_merged;

    Capture cap;
    TpStroke stroke;
    float pen_raw, pen_tx, pen_ty; int pen_seen, pen_down, pen_eraser, pen_buttons;
    float last_cx, last_cy; int have_last;
    float pan_sx, pan_sy, pan_px, pan_py;
    int space, alt;
    float hx, hy;                        /* pointer, window points */
    int hover_canvas;

    int menu_open;                       /* 0 none, 1.. top menus, 100 blend list */
    int menu_x;
    int panels, help;
    Dialog dialog; char dlg_w[16], dlg_h[16]; int dlg_white;
    int renaming; char rename_buf[TP_NAME_MAX];
    float brush_scroll, layer_scroll;
    char status[256]; Uint64 status_t;
    char pref[1024], base[1024], recovery[1024];
    Uint64 last_autosave; int autosave_min;
    int slider_undo;
    Uint32 ev_file;
    int quit, screenshot;
    SDL_Cursor *cur_cross, *cur_arrow, *cur_hand;
} App;

extern App A;

/* main.c */
void app_action(App *a, int act);
void app_status(App *a, const char *fmt, ...);
void app_dirty_all(App *a);
void app_set_color(App *a, uint32_t straight);
void app_select_brush(App *a, int i);
void view_rect(App *a, int *x, int *y, int *w, int *h);
void to_canvas(App *a, float sx, float sy, float *cx, float *cy);
void from_canvas(App *a, float cx, float cy, float *sx, float *sy);
const char *tool_name(Tool t);

/* panels.c */
void panels_draw(App *a);
int  panels_menu_count(void);
#endif
