#!/usr/bin/env python
"""
STANZ G — Android app icon & splash screen generator.

Regenerates the adaptive icon, legacy icon and splash screen images straight
from the game's own in-world color palette (the --bg/--accent/etc custom
properties in www/index.html) and a bold "G" letterform, so none of this
depends on an external design file or network access.

Run from the project root:

    python tools/gen-icons.py

Requires Pillow (already installed here: `pip install pillow` otherwise)
and a bold TTF font on disk — defaults to Windows' bundled Impact/Arial
Bold; edit FONT_BOLD/FONT_UI below if running on macOS/Linux.
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')

# palette lifted straight from www/index.html's :root custom properties
BG0 = (12, 17, 11)         # --bg
BG1 = (28, 36, 24)         # --panel2
ACCENT = (240, 164, 40)    # --accent
ACCENT2 = (255, 210, 122)  # --accent2
CREAM = (232, 236, 223)    # --fg

FONT_BOLD = r"C:\Windows\Fonts\impact.ttf"
FONT_UI = r"C:\Windows\Fonts\arialbd.ttf"
for _p in (FONT_BOLD, FONT_UI):
    if not os.path.exists(_p):
        raise SystemExit(
            'Font not found: %s\n'
            'Edit FONT_BOLD/FONT_UI at the top of tools/gen-icons.py to point '
            'at a bold TTF available on this machine.' % _p)


def grad_bg(size, c_in, c_out):
    """Small radial gradient upsampled to `size` px — fast and smooth."""
    base = 96
    g = Image.new('RGB', (base, base))
    px = g.load()
    cx = cy = base / 2.0
    maxd = (base / 2.0) * 1.5
    for y in range(base):
        for x in range(base):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            t = min(1.0, d / maxd)
            px[x, y] = tuple(int(c_in[i] + (c_out[i] - c_in[i]) * t) for i in range(3))
    return g.resize((size, size), Image.BICUBIC)


def font_fit(path, text, target_h):
    """Load `path` at whatever point size makes `text` render target_h px tall."""
    size = max(8, int(target_h * 1.55))
    font = ImageFont.truetype(path, size)
    tmp = ImageDraw.Draw(Image.new('L', (4, 4)))
    bbox = tmp.textbbox((0, 0), text, font=font)
    h = bbox[3] - bbox[1]
    if h > 0:
        size = max(8, int(size * target_h / h))
        font = ImageFont.truetype(path, size)
    return font


def draw_badge(size, ring=True, glyph=True):
    """Transparent RGBA logo mark: an accent ring + bold 'G', sized to sit
    inside the adaptive-icon safe zone (~60% of the canvas)."""
    ss = 2  # supersample for anti-aliased edges
    s = size * ss
    im = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx = cy = s / 2
    safe_r = s * 0.30
    if ring:
        ring_w = max(2, int(s * 0.045))
        d.ellipse([cx - safe_r, cy - safe_r, cx + safe_r, cy + safe_r],
                  outline=ACCENT2, width=ring_w)
    if glyph:
        font = font_fit(FONT_BOLD, 'G', int(safe_r * 1.5))
        bbox = d.textbbox((0, 0), 'G', font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        tx, ty = cx - tw / 2 - bbox[0], cy - th / 2 - bbox[1]
        d.text((tx, ty), 'G', font=font, fill=ACCENT,
               stroke_width=max(1, int(s * 0.006)), stroke_fill=BG0)
    return im.resize((size, size), Image.LANCZOS)


def flatten(bg, fg):
    out = bg.convert('RGBA').copy()
    out.alpha_composite(fg)
    return out.convert('RGB')


ANDROID_SIZES = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
LEGACY_BASE = 48   # mdpi legacy icon px
FG_BASE = 108      # mdpi adaptive-icon foreground canvas px (108dp)


def gen_icons():
    for dpi, mult in ANDROID_SIZES.items():
        legacy_sz = int(LEGACY_BASE * mult)
        fg_sz = int(FG_BASE * mult)
        flat = flatten(grad_bg(legacy_sz, BG1, BG0), draw_badge(legacy_sz))
        d = os.path.join(RES, 'mipmap-' + dpi)
        flat.save(os.path.join(d, 'ic_launcher.png'))
        flat.save(os.path.join(d, 'ic_launcher_round.png'))
        draw_badge(fg_sz).save(os.path.join(d, 'ic_launcher_foreground.png'))
        print('icon  %-7s legacy %dpx  foreground %dpx' % (dpi, legacy_sz, fg_sz))


SPLASH = {
    'drawable-land-mdpi':    (480, 320),
    'drawable-land-hdpi':    (800, 480),
    'drawable-land-xhdpi':   (1280, 720),
    'drawable-land-xxhdpi':  (1600, 960),
    'drawable-land-xxxhdpi': (1920, 1280),
    'drawable-port-mdpi':    (320, 480),
    'drawable-port-hdpi':    (480, 800),
    'drawable-port-xhdpi':   (720, 1280),
    'drawable-port-xxhdpi':  (960, 1600),
    'drawable-port-xxxhdpi': (1280, 1920),
}


def draw_splash(w, h):
    bg = grad_bg(max(w, h), BG1, BG0).resize((w, h), Image.BICUBIC)
    im = bg.convert('RGBA')
    logo_d = int(min(w, h) * 0.46)
    bx = (w - logo_d) // 2
    by = (h - logo_d) // 2 - int(min(w, h) * 0.06)
    im.alpha_composite(draw_badge(logo_d), (bx, by))
    d = ImageDraw.Draw(im)
    label_h = max(14, int(min(w, h) * 0.085))
    font = font_fit(FONT_BOLD, 'STANZ G', label_h)
    bbox = d.textbbox((0, 0), 'STANZ G', font=font)
    tw = bbox[2] - bbox[0]
    tx = (w - tw) / 2 - bbox[0]
    ty = by + logo_d + int(min(w, h) * 0.02) - bbox[1]
    d.text((tx, ty), 'STANZ G', font=font, fill=CREAM,
           stroke_width=max(1, int(min(w, h) * 0.004)), stroke_fill=BG0)
    return im.convert('RGB')


def gen_splash():
    for name, (w, h) in SPLASH.items():
        d = os.path.join(RES, name)
        os.makedirs(d, exist_ok=True)
        draw_splash(w, h).save(os.path.join(d, 'splash.png'))
        print('splash %-24s %dx%d' % (name, w, h))
    draw_splash(480, 800).save(os.path.join(RES, 'drawable', 'splash.png'))  # default fallback


def gen_adaptive_background_color():
    path = os.path.join(RES, 'values', 'ic_launcher_background.xml')
    with open(path, 'w', encoding='utf-8') as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
                '    <color name="ic_launcher_background">#%02x%02x%02x</color>\n'
                '</resources>\n' % BG0)
    print('adaptive icon background color -> #%02x%02x%02x' % BG0)


if __name__ == '__main__':
    gen_icons()
    gen_splash()
    gen_adaptive_background_color()
    print('Done.')
