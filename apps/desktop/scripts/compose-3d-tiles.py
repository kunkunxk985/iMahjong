"""Stamp traditional face glyphs onto the 3D ivory tile body.

Source faces (white card + black frame) live in public/assets/tile-faces/.
Output 3D tiles are written to public/assets/tiles/.
"""
from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "public" / "assets"
FACES = ASSETS / "tile-faces"
OUT = ASSETS / "tiles"
BLANK_PATH = ASSETS / "tile-front.png"

WELL = (92, 118, 592, 884)
NAMES = [*(f"wan-{r}" for r in range(1, 10)), *(f"tong-{r}" for r in range(1, 10)), *(f"tiao-{r}" for r in range(1, 10)), *(f"dragon-{r}" for r in range(1, 4))]


def _near_white(r: int, g: int, b: int) -> bool:
    mx, mn = max(r, g, b), min(r, g, b)
    return mn > 168 and mx - mn < 48


def _near_black(r: int, g: int, b: int) -> bool:
    mx, mn = max(r, g, b), min(r, g, b)
    return mx < 78 and mx - mn < 28


def punch_card(im: Image.Image, keep_enclosed_white: bool = False) -> Image.Image:
    """Drop the white card and black frame; keep only painted glyphs."""
    rgba = im.convert("RGBA")
    w, h = rgba.size
    margin = int(min(w, h) * 0.05)
    rgba = rgba.crop((margin, margin, w - margin, h - margin))
    px = rgba.load()
    ww, hh = rgba.size

    if keep_enclosed_white:
        flat = Image.new("RGBA", (ww, hh), (255, 255, 255, 255))
        dst = flat.load()
        for y in range(hh):
            for x in range(ww):
                r, g, b, _a = px[x, y]
                if _near_white(r, g, b) or _near_black(r, g, b):
                    dst[x, y] = (255, 255, 255, 255)
                else:
                    dst[x, y] = (r, g, b, 255)
        for origin in ((0, 0), (ww - 1, 0), (0, hh - 1), (ww - 1, hh - 1)):
            ImageDraw.floodfill(flat, origin, (0, 0, 0, 0), thresh=6)
        rgba = flat
    else:
        for y in range(hh):
            for x in range(ww):
                r, g, b, _a = px[x, y]
                if _near_white(r, g, b) or _near_black(r, g, b):
                    px[x, y] = (0, 0, 0, 0)

    return crop_to_paint(rgba)


def crop_to_paint(im: Image.Image) -> Image.Image:
    px = im.load()
    w, h = im.size
    minx, miny, maxx, maxy = w, h, -1, -1
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 20:
                continue
            chroma = max(r, g, b) - min(r, g, b)
            if chroma < 30:
                continue
            minx = min(minx, x)
            miny = min(miny, y)
            maxx = max(maxx, x)
            maxy = max(maxy, y)
    if maxx < minx:
        return im
    pad = 6
    return im.crop((max(0, minx - pad), max(0, miny - pad), min(w, maxx + 1 + pad), min(h, maxy + 1 + pad)))


def chisel(symbol: Image.Image, depth: int = 2) -> Image.Image:
    alpha = symbol.split()[3]
    if alpha.getextrema() == (0, 0):
        return symbol
    soft = alpha.filter(ImageFilter.GaussianBlur(0.8))
    shadow = Image.new("RGBA", symbol.size, (86, 54, 18, 0))
    shadow.putalpha(soft.point(lambda a: int(a * 0.22)))
    canvas = Image.new("RGBA", symbol.size, (0, 0, 0, 0))
    canvas.paste(shadow, (depth, depth), shadow)
    canvas.alpha_composite(symbol)
    return canvas


def fit_into_well(glyph: Image.Image, well: tuple[int, int, int, int], body: Image.Image) -> None:
    bbox = glyph.getbbox()
    if not bbox:
        return
    cropped = glyph.crop(bbox)
    x0, y0, x1, y1 = well
    well_w, well_h = x1 - x0, y1 - y0
    pad_x = int(well_w * 0.055)
    pad_y = int(well_h * 0.06)
    avail_w = well_w - pad_x * 2
    avail_h = well_h - pad_y * 2
    scale = min(avail_w / cropped.width, avail_h / cropped.height)
    size = (max(1, int(cropped.width * scale)), max(1, int(cropped.height * scale)))
    resized = cropped.resize(size, Image.Resampling.LANCZOS)
    engraved = chisel(resized, depth=2)
    x = x0 + pad_x + (avail_w - size[0]) // 2
    y = y0 + pad_y + (avail_h - size[1]) // 2
    body.alpha_composite(engraved, (x, y))


def compose_face(src: Path, blank: Image.Image) -> Image.Image:
    tile = blank.copy()
    face = Image.open(src)
    keep_white = src.stem.startswith("tong-")
    glyph = punch_card(face, keep_enclosed_white=keep_white)
    glyph = glyph.filter(ImageFilter.UnsharpMask(radius=1.1, percent=70, threshold=3))
    fit_into_well(glyph, WELL, tile)
    return tile


def ensure_faces() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    if FACES.exists() and any(FACES.glob("*.png")):
        return
    FACES.mkdir(parents=True, exist_ok=True)
    for name in NAMES:
        src = OUT / f"{name}.png"
        if src.exists():
            shutil.copy2(src, FACES / f"{name}.png")


def main() -> None:
    ensure_faces()
    blank = Image.open(BLANK_PATH).convert("RGBA")
    for name in NAMES:
        src = FACES / f"{name}.png"
        if not src.exists():
            print("missing", src)
            continue
        compose_face(src, blank).save(OUT / f"{name}.png")
        print("wrote", name)

    print("done")


if __name__ == "__main__":
    main()
