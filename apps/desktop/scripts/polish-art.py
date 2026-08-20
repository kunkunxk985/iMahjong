"""Art polish: 3D tile back, brass corners, calligraphic 万/字牌."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "public" / "assets"
OUT = ASSETS / "tiles"
BLANK_PATH = ASSETS / "tile-front.png"
FONT_PATH = ROOT / "build" / "MaShanZheng.ttf"

WELL = (92, 118, 592, 884)
W = H = 0
IX0, IY0, IX1, IY1 = WELL
CX = (IX0 + IX1) // 2
CY = (IY0 + IY1) // 2

RED = (196, 32, 28, 255)
BLUE = (24, 72, 150, 255)
GREEN = (18, 122, 46, 255)
GOLD = (212, 168, 64, 255)
GOLD_DARK = (140, 104, 32, 255)
IVORY = (255, 252, 243, 255)
INK = (28, 22, 16, 255)
NUMS = ["一", "二", "三", "四", "五", "六", "七", "八", "九"]


def font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_PATH), size)


def chisel(symbol: Image.Image, depth: int = 2) -> Image.Image:
    alpha = symbol.split()[3]
    if alpha.getextrema() == (0, 0):
        return symbol
    soft = alpha.filter(ImageFilter.GaussianBlur(0.9))
    shadow = Image.new("RGBA", symbol.size, (78, 48, 16, 0))
    shadow.putalpha(soft.point(lambda a: int(a * 0.24)))
    canvas = Image.new("RGBA", symbol.size, (0, 0, 0, 0))
    canvas.paste(shadow, (depth, depth), shadow)
    canvas.alpha_composite(symbol)
    return canvas


def draw_bold_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    cx: int,
    cy: int,
    face: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int, int],
    bold: int = 2,
) -> None:
    bbox = draw.textbbox((0, 0), text, font=face)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    ox = cx - tw / 2 - bbox[0]
    oy = cy - th / 2 - bbox[1]
    for dx in range(-bold, bold + 1):
        for dy in range(-bold, bold + 1):
            draw.text((ox + dx, oy + dy), text, font=face, fill=fill)


def render_wan(blank: Image.Image, rank: int) -> Image.Image:
    tile = blank.copy()
    layer = Image.new("RGBA", blank.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    ih = IY1 - IY0
    draw_bold_text(draw, NUMS[rank - 1], CX, IY0 + int(ih * 0.28), font(int(ih * 0.42)), BLUE, 2)
    draw_bold_text(draw, "萬", CX, IY0 + int(ih * 0.72), font(int(ih * 0.40)), RED, 2)
    tile.alpha_composite(chisel(layer))
    return tile


def render_dragon(blank: Image.Image, rank: int) -> Image.Image:
    tile = blank.copy()
    layer = Image.new("RGBA", blank.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    ih = IY1 - IY0
    if rank == 1:
        draw_bold_text(draw, "中", CX, CY, font(int(ih * 0.72)), RED, 3)
    else:
        draw_bold_text(draw, "發", CX, CY, font(int(ih * 0.70)), GREEN, 3)
    tile.alpha_composite(chisel(layer))
    return tile


def render_back(blank: Image.Image) -> Image.Image:
    tile = blank.copy()
    layer = Image.new("RGBA", blank.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    pad = 10
    well = (IX0 + pad, IY0 + pad, IX1 - pad, IY1 - pad)
    draw.rounded_rectangle(well, radius=28, fill=(18, 72, 48, 255))

    inner = (well[0] + 22, well[1] + 26, well[2] - 22, well[3] - 26)
    draw.rounded_rectangle(inner, radius=22, outline=GOLD_DARK, width=7)
    draw.rounded_rectangle(
        (inner[0] + 10, inner[1] + 10, inner[2] - 10, inner[3] - 10),
        radius=16,
        outline=GOLD,
        width=3,
    )

    # Fine carved lattice, not a playing-card back.
    gx0, gy0, gx1, gy1 = inner[0] + 28, inner[1] + 30, inner[2] - 28, inner[3] - 30
    step = 34
    for x in range(gx0, gx1, step):
        draw.line((x, gy0, x, gy1), fill=(12, 92, 58, 180), width=2)
    for y in range(gy0, gy1, step):
        draw.line((gx0, y, gx1, y), fill=(12, 92, 58, 180), width=2)
    for x in range(gx0, gx1, step):
        for y in range(gy0, gy1, step):
            r = 3
            draw.ellipse((x - r, y - r, x + r, y + r), fill=GOLD)

    cx, cy = CX, CY
    draw.ellipse((cx - 54, cy - 54, cx + 54, cy + 54), fill=(14, 58, 38, 255), outline=GOLD, width=4)
    draw.ellipse((cx - 28, cy - 28, cx + 28, cy + 28), outline=GOLD_DARK, width=3)
    draw.ellipse((cx - 8, cy - 8, cx + 8, cy + 8), fill=GOLD)

    tile.alpha_composite(chisel(layer, depth=2))
    return tile


def punch_corner(src: Path, dest: Path) -> None:
    im = Image.open(src).convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if g > 48 and g > r + 18 and g >= b and r < 100:
                px[x, y] = (0, 0, 0, 0)
    # Crop to ornament
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    im.save(dest)


def ivory_tong_rings() -> None:
    for rank in range(1, 10):
        path = OUT / f"tong-{rank}.png"
        if not path.exists():
            continue
        im = Image.open(path).convert("RGBA")
        px = im.load()
        w, h = im.size
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a > 200 and r > 246 and g > 246 and b > 246:
                    px[x, y] = IVORY
        im.save(path)


def main() -> None:
    blank = Image.open(BLANK_PATH).convert("RGBA")
    for rank in range(1, 10):
        render_wan(blank, rank).save(OUT / f"wan-{rank}.png")
        print("wan", rank)
    for rank in (1, 2):
        render_dragon(blank, rank).save(OUT / f"dragon-{rank}.png")
        print("dragon", rank)
    render_back(blank).save(ASSETS / "tile-back.png")
    print("tile-back")
    punch_corner(ASSETS / "corner.jpg", ASSETS / "corner.png")
    print("corner")
    ivory_tong_rings()
    print("tong ivory rings")
    print("done")


if __name__ == "__main__":
    main()
