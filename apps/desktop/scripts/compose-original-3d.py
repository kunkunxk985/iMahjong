"""Seat the original GitHub face art in the 3D ivory body.

Does not redraw glyphs or change fonts. Only strips the flat black card
frame and insets the original picture into tile-front.png.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

DESKTOP = Path(__file__).resolve().parents[1]
ASSETS = DESKTOP / "public" / "assets"
FACES = ASSETS / "tile-faces"
OUT = ASSETS / "tiles"
BLANK = Image.open(ASSETS / "tile-front.png").convert("RGBA")

WELL = (92, 118, 592, 884)
NAMES = [
    *(f"wan-{r}" for r in range(1, 10)),
    *(f"tong-{r}" for r in range(1, 10)),
    *(f"tiao-{r}" for r in range(1, 10)),
    *(f"dragon-{r}" for r in range(1, 4)),
]


def rounded_plate(im: Image.Image, radius: int) -> Image.Image:
    plate = im.convert("RGBA")
    mask = Image.new("L", plate.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, plate.size[0] - 1, plate.size[1] - 1), radius=radius, fill=255)
    plate.putalpha(mask)
    return plate


def compose_face(src: Path) -> Image.Image:
    tile = BLANK.copy()
    face = Image.open(src).convert("RGBA")
    w, h = face.size
    margin = int(min(w, h) * 0.048)
    inner = face.crop((margin, margin, w - margin, h - margin))
    x0, y0, x1, y1 = WELL
    pad = 4
    fitted = inner.resize((x1 - x0 - pad * 2, y1 - y0 - pad * 2), Image.Resampling.LANCZOS)
    plate = rounded_plate(fitted, radius=max(12, (x1 - x0) // 20))
    tile.alpha_composite(plate, (x0 + pad, y0 + pad))
    shade = Image.new("RGBA", tile.size, (0, 0, 0, 0))
    ImageDraw.Draw(shade).rounded_rectangle(
        (x0 + pad, y0 + pad, x1 - pad, y1 - pad),
        radius=max(12, (x1 - x0) // 20),
        outline=(70, 46, 18, 42),
        width=3,
    )
    tile.alpha_composite(shade.filter(ImageFilter.GaussianBlur(1.0)))
    return tile


def compose_back() -> None:
    src = FACES / "tile-back.png"
    if not src.exists():
        return
    tile = BLANK.copy()
    back = Image.open(src).convert("RGBA")
    w, h = back.size
    margin = int(min(w, h) * 0.04)
    inner = back.crop((margin, margin, w - margin, h - margin))
    x0, y0, x1, y1 = WELL
    pad = 4
    fitted = inner.resize((x1 - x0 - pad * 2, y1 - y0 - pad * 2), Image.Resampling.LANCZOS)
    tile.alpha_composite(rounded_plate(fitted, radius=22), (x0 + pad, y0 + pad))
    tile.save(ASSETS / "tile-back.png")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name in NAMES:
        src = FACES / f"{name}.png"
        if not src.exists():
            print("missing", src)
            continue
        compose_face(src).save(OUT / f"{name}.png")
        print("wrote", name)
    compose_back()
    print("done")


if __name__ == "__main__":
    main()
