/* SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
 * star-tip -- an example brush-tip mod: a five-pointed star.  A brush file
 * uses it with   tip = star   (brushes/Star Stamp.brush does). */
#include "tpaint_mod.h"
#include <math.h>

static float star(float x, float y, void *user) {
    (void)user;
    float r = sqrtf(x * x + y * y);
    if (r > 1) return 0;
    float a = atan2f(y, x) + 1.5707963f;                 /* a point straight up */
    float k = cosf(2.5f * a);                             /* five lobes */
    float edge = 0.45f + 0.55f * k * k * k * k;           /* the star's radius at this angle */
    float d = (edge - r) * 12;                            /* soft by a little, so it anti-aliases */
    return d <= 0 ? 0 : d >= 1 ? 1 : d;
}

static const TpTip STAR = { "star", star, 0 };

TPAINT_MOD_EXPORT int tpaint_mod_init(const TpHost *host) {
    if (host->api_version < 1) return 1;
    return host->register_tip(&STAR);
}
