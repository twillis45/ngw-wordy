#!/usr/bin/env python3
"""
App icon generator.

The mark is the product itself: six tiles in a ring, one lit in steel-blue.
Studio Matte palette, same values as globals.css.

Rendered at 4x and downsampled so the rounded corners stay clean.

Usage: python3 scripts/build-icons.py
"""
import math
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), "..", "public")
# Upload-only store art. Deliberately outside public/ — see main().
STORE = os.path.join(os.path.dirname(__file__), "..", "store")

CARBON_BODY = (7, 8, 9)
CARBON_SURFACE_2 = (23, 27, 31)
CARBON_STRONG = (43, 48, 57)
STEEL = (78, 104, 119)
STEEL_MUTED = (111, 135, 148)

SS = 4  # supersample factor


def draw_icon(size, safe=1.0, rounded=False):
    """
    safe < 1 shrinks the mark for maskable icons, whose outer ~10% on each
    edge can be cropped to any shape by the launcher.
    """
    s = size * SS
    img = Image.new("RGB", (s, s), CARBON_BODY)
    d = ImageDraw.Draw(img)

    cx = cy = s / 2
    # Disc the tiles sit on — the same one-step lift the wheel has in-app.
    disc_r = s * 0.42 * safe
    d.ellipse(
        [cx - disc_r, cy - disc_r, cx + disc_r, cy + disc_r],
        fill=CARBON_SURFACE_2,
    )

    ring_r = disc_r * 0.66
    tile = disc_r * 0.40
    radius = tile * 0.30

    for i in range(6):
        angle = (i / 6) * math.tau - math.pi / 2
        tx = cx + math.cos(angle) * ring_r
        ty = cy + math.sin(angle) * ring_r
        box = [tx - tile / 2, ty - tile / 2, tx + tile / 2, ty + tile / 2]
        lit = i == 0  # one accent moment, top tile
        d.rounded_rectangle(
            box,
            radius=radius,
            fill=STEEL if lit else CARBON_BODY,
            outline=STEEL_MUTED if lit else CARBON_STRONG,
            width=max(1, int(s * 0.006)),
        )

    if rounded:
        # Apple applies its own mask, but a square source with our own carbon
        # field avoids a white halo in older launchers.
        pass

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
