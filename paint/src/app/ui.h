/* SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
 * ui.h -- a small immediate-mode UI drawn in software into an RGBA buffer.
 * Every frame the app calls the widget functions in drawing order; each one
 * draws itself and says whether it was used.  No retained widget tree. */
#ifndef TP_UI_H
#define TP_UI_H
#include <stdint.h>

typedef uint32_t Col;                    /* 0xAARRGGBB */
#define RGB(r, g, b) (0xff000000u | (uint32_t)(r) << 16 | (uint32_t)(g) << 8 | (uint32_t)(b))
#define RGBA(r, g, b, a) ((uint32_t)(a) << 24 | (uint32_t)(r) << 16 | (uint32_t)(g) << 8 | (uint32_t)(b))

/* the house colours (GitHub-dark tokens; every text pair is WCAG AA on its panel) */
#define T_BG      RGB(0x0d, 0x11, 0x17)
#define T_PANEL   RGB(0x16, 0x1b, 0x22)
#define T_RAISED  RGB(0x21, 0x26, 0x2d)
#define T_HOVER   RGB(0x30, 0x36, 0x3d)
#define T_BORDER  RGB(0x30, 0x36, 0x3d)
#define T_TEXT    RGB(0xe6, 0xed, 0xf3)
#define T_MUTED   RGB(0x9d, 0xa7, 0xb3)
#define T_ACCENT  RGB(0x2f, 0x81, 0xf7)
#define T_ACCENT2 RGB(0x1f, 0x6f, 0xeb)
#define T_WARN    RGB(0xd2, 0x99, 0x22)
#define T_OK      RGB(0x3f, 0xb9, 0x50)

typedef struct UI {
    uint8_t *px; int w, h;               /* the buffer, RGBA bytes */
    int cx0, cy0, cx1, cy1;              /* clip */
    /* pointer, in UI points */
    float mx, my; int down, pressed, released, dbl, right_pressed;
    float wheel;
    int enabled;                         /* 0 while the canvas owns the pointer */
    uint64_t hot, active, focus;
    int used;                            /* a widget took this frame's click */
    /* keys for the focused text field */
    char text[64]; int n_text;
    int k_back, k_enter, k_esc, k_left, k_right;
    int caret;
} UI;

uint64_t ui_id(const char *s, int n);
void ui_begin(UI *u);                    /* call before drawing a frame */
void ui_end(UI *u);                      /* resets per-frame input */
void ui_clip(UI *u, int x, int y, int w, int h);
void ui_noclip(UI *u);
void ui_clear(UI *u);                    /* everything transparent */
void ui_rect(UI *u, int x, int y, int w, int h, Col c);
void ui_frame(UI *u, int x, int y, int w, int h, Col c);
void ui_round(UI *u, int x, int y, int w, int h, int r, Col c);
void ui_line(UI *u, float x0, float y0, float x1, float y1, Col c);
void ui_circle(UI *u, float cx, float cy, float r, Col c);     /* outline */
void ui_disc(UI *u, float cx, float cy, float r, Col c);       /* filled, anti-aliased */
void ui_checker(UI *u, int x, int y, int w, int h, int cell);
int  ui_text(UI *u, int x, int y, const char *s, Col c);       /* returns width */
int  ui_text_w(const char *s);
void ui_text_center(UI *u, int x, int y, int w, int h, const char *s, Col c);
void ui_text_right(UI *u, int x, int y, int w, const char *s, Col c);
int  ui_line_h(void);

int  ui_hit(UI *u, int x, int y, int w, int h);
int  ui_button(UI *u, uint64_t id, int x, int y, int w, int h, const char *label, int on);
/* slider: returns 1 when the value moved; *began / *ended say a drag started or stopped */
int  ui_slider(UI *u, uint64_t id, int x, int y, int w, int h, const char *label, float *v,
               float lo, float hi, const char *fmt, int *began, int *ended);
/* single-line text field; returns 1 when Enter is pressed (commit) */
int  ui_field(UI *u, uint64_t id, int x, int y, int w, int h, char *buf, int cap);
#endif
