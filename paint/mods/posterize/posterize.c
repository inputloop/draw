/* SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
 * posterize -- an example filter mod: cut each channel to a few levels.
 * Build: see docs/MODDING.md (the build scripts build it for you). */
#include "tpaint_mod.h"

static int posterize(TpImage *img, void *user) {
    int levels = *(const int *)user, step = 255 / (levels - 1);
    for (int y = 0; y < img->h; y++) {
        uint8_t *p = img->px + (size_t)y * img->stride;
        for (int x = 0; x < img->w; x++, p += 4)
            for (int c = 0; c < 3; c++) p[c] = (uint8_t)(((p[c] + step / 2) / step) * step);
    }
    return 0;
}

static const int FOUR = 4, EIGHT = 8;
static const TpFilter POSTER4 = { "Posterize (4 levels)", posterize, (void *)&FOUR };
static const TpFilter POSTER8 = { "Posterize (8 levels)", posterize, (void *)&EIGHT };

TPAINT_MOD_EXPORT int tpaint_mod_init(const TpHost *host) {
    if (host->api_version < 1) return 1;
    host->register_filter(&POSTER4);
    host->register_filter(&POSTER8);
    host->log("posterize: two filters added");
    return 0;
}
