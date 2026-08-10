#!/usr/bin/env python3
"""
Social card generator — public/og.png, 1200x630.

A static export cannot generate an OG image per request (next/og needs a
runtime), so the card is baked here and committed. Run it only when the mark
or the copy changes.

It is deliberately the product and not a logo on a gradient: the same six-tile
ring the app draws, with the letters of a real board on it, because the one
question a link preview has to answer is "what is this".

Usage: python3 scripts/build-og.py
"""
import importlib.util
import math
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "public", "og.png")

# Palette is shared with the icons, which already copy globals.css. Importing
# it keeps one drift risk instead of two.
_spec = importlib.util.spec_from_file_location(
    "build_icons", os.path.join(HERE, "build-icons.py")
)
_icons = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_icons)

CARBON_BODY = _icons.CARBON_BODY
CARBON_SURFACE_2 = _icons.CARBON_SURFACE_2
CARBON_STRONG = _icons.CARBON_STRONG
STEEL = _icons.STEEL
STEEL_MUTED = _icons.STEEL_MUTED
TEXT_PRIMARY = (238, 240, 244)
TEXT_SECONDARY = (169, 202, 235)
TEXT_MUTED = (154, 156, 160)

W, H = 1200, 630
SS = 2  # supersample; the ring and the tile corners alias badly at 1x

# The wheel in the card spells a real board rather than filler — a reader who
# knows the game should be able to start solving it from the preview.
LETTERS = ["T", "A", "P", "I", "N", "G"]


def font(size, bold=False):
    """
    Helvetica is present on every macOS box this is built from; DejaVu is the
    Linux fallback. A missing font must not silently downgrade to PIL's 11px
    bitmap default, which would render the wordmark unreadable, so this raises.
    """
    candidates = [
        ("/System/Library/Fonts/Helvetica.ttc", 1 if bold else 0),
        ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold
         else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 0),
    ]
    for path, index in candidates:
        if os.path.exists(path):
            return ImageFont.truetype(path, size, index=index)
    raise SystemExit("no usable font found; install DejaVu or run on macOS")


def draw_wheel(d, cx, cy, disc_r):
    """The app's wheel, lettered. Same geometry as scripts/build-icons.py."""
    d.ellipse(
        [cx - disc_r, cy - disc_r, cx + disc_r, cy + disc_r],
        fill=CARBON_SURFACE_2,
        outline=CARBON_STRONG,
        width=int(disc_r * 0.012),
    )

    ring_r = disc_r * 0.66
    tile = disc_r * 0.40
    radius = tile * 0.30
    f = font(int(tile * 0.52), bold=True)

    for i, ch in enumerate(LETTERS):
        angle = (i / 6) * math.tau - math.pi / 2
        tx = cx + math.cos(angle) * ring_r
        ty = cy + math.sin(angle) * ring_r
        lit = i == 0  # one accent moment, matching the icon
        d.rounded_rectangle(
            [tx - tile / 2, ty - tile / 2, tx + tile / 2, ty + tile / 2],
            radius=radius,
            fill=STEEL if lit else CARBON_BODY,
            outline=STEEL_MUTED if lit else CARBON_STRONG,
            width=max(2, int(disc_r * 0.014)),
        )
        d.text((tx, ty), ch, font=f, fill=TEXT_PRIMARY, anchor="mm")


def main():
    img = Image.new("RGB", (W * SS, H * SS), CARBON_BODY)
    d = ImageDraw.Draw(img)

    draw_wheel(d, 300 * SS, 315 * SS, 200 * SS)

    x = 600 * SS
    d.text((x, 214 * SS), "Wordy", font=font(112 * SS, bold=True),
           fill=TEXT_PRIMARY, anchor="ls")
    d.text((x, 268 * SS), "Six letters. How many words can you make?",
           font=font(30 * SS), fill=TEXT_SECONDARY, anchor="ls")
    d.text((x, 330 * SS),
           "397 hand-authored puzzles with written clues,",
           font=font(26 * SS), fill=TEXT_MUTED, anchor="ls")
    d.text((x, 368 * SS),
           "across 20 themes of Black American cultural life.",
           font=font(26 * SS), fill=TEXT_MUTED, anchor="ls")

    # Steel underline under the copy block: the single accent the Attention
    # System allows, used to bind the text column to the lit tile.
    d.rounded_rectangle(
        [x, 412 * SS, (x + 120 * SS), 418 * SS], radius=3 * SS, fill=STEEL
    )

    img = img.resize((W, H), Image.LANCZOS)
    img.save(OUT, "PNG", optimize=True)
    print(f"  og.png  {W}x{H}  {os.path.getsize(OUT)} bytes")


if __name__ == "__main__":
    main()
