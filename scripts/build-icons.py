#!/usr/bin/env python3
"""
App icon generator.

The mark is the product itself: six tiles in a ring around the wheel's
center — the Six on the Dial brand mark, matching docs/brand/icon.svg
value-for-value. Off-white tiles on panel carbon, the six-o'clock tile in
the selection amber (the one accent moment), a center dot for the puck.

Rendered at 4x and downsampled so the rounded corners stay clean.

Usage: python3 scripts/build-icons.py
"""
import math
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), "..", "public")
# Upload-only store art. Deliberately outside public/ — see main().
STORE = os.path.join(os.path.dirname(__file__), "..", "store")

CARBON_PANEL = (20, 21, 23)   # #141517 — the mark's ground, per icon.svg
TILE = (238, 240, 244)        # #eef0f4
AMBER = (242, 131, 28)        # #f2831c — six o'clock only

SS = 4  # supersample factor


def draw_icon(size, safe=1.0):
    """
    safe < 1 shrinks the mark for maskable icons, whose outer ~10% on each
    edge can be cropped to any shape by the launcher.

    Proportions are icon.svg's, expressed as fractions of its 1024 canvas:
    ring radius 300/1024, tile 196/1024, corner 0.32·tile, dot 44/1024.
    """
    s = size * SS
    img = Image.new("RGB", (s, s), CARBON_PANEL)
    d = ImageDraw.Draw(img)

    cx = cy = s / 2
    ring_r = s * (300 / 1024) * safe
    tile = s * (196 / 1024) * safe
    radius = tile * 0.32
    dot_r = s * (44 / 1024) * safe

    for i in range(6):
        # i == 0 is the top of the ring; i == 3 is six o'clock, which is the
        # tile the name points at and the only one allowed the accent.
        angle = (i / 6) * math.tau - math.pi / 2
        tx = cx + math.cos(angle) * ring_r
        ty = cy + math.sin(angle) * ring_r
        box = [tx - tile / 2, ty - tile / 2, tx + tile / 2, ty + tile / 2]
        d.rounded_rectangle(box, radius=radius, fill=AMBER if i == 3 else TILE)

    d.ellipse([cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r], fill=TILE)

    return img.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    targets = [
        ("icon-192.png", 192, 1.0),
        ("icon-512.png", 512, 1.0),
        # 192 maskable as well as 512: Android picks the maskable icon
        # nearest the launcher's density, and with only a 512 present it
        # downsamples that on every home screen it draws.
        ("icon-maskable-192.png", 192, 0.78),
        ("icon-maskable-512.png", 512, 0.78),
        ("apple-touch-icon.png", 180, 1.0),
    ]
    for name, size, safe in targets:
        path = os.path.join(OUT, name)
        draw_icon(size, safe).save(path, "PNG", optimize=True)
        print(f"  {name}  {size}x{size}  {os.path.getsize(path)} bytes")

    # Store listing art is UPLOADED, never served, so it does not belong in
    # public/ — that directory is the deploy artifact and every byte in it
    # ships to players who will never request this file.
    #
    # Play's 512 is already covered by icon-512.png above. Apple's is not:
    # App Store Connect wants 1024x1024, full-bleed, and it REJECTS an alpha
    # channel. draw_icon builds in "RGB" rather than "RGBA", so that holds by
    # construction — but it is the reason not to casually switch that mode.
    os.makedirs(STORE, exist_ok=True)
    store_path = os.path.join(STORE, "app-store-icon-1024.png")
    draw_icon(1024, 1.0).save(store_path, "PNG", optimize=True)
    print(
        f"  store/app-store-icon-1024.png  1024x1024  "
        f"{os.path.getsize(store_path)} bytes"
    )


if __name__ == "__main__":
    main()
