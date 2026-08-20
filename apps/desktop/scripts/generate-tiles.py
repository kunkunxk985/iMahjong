"""Render traditional Chinese mahjong faces onto the ivory tile body."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "public" / "assets"
OUT = ASSETS / "tiles"
OUT.mkdir(parents=True, exist_ok=True)

BLANK = Image.open(ROOT.parent.parent / "assets" / "source" / "tile-front.png").convert("RGBA")
W, H = BLANK.size
FONT = Path(r"C:\Windows\Fonts\simkai.ttf")

# Inner recessed face of the photographed tile.
IX0, IY0, IX1, IY1 = 92, 118, 592, 882
IW, IH = IX1 - IX0, IY1 - IY0

NUMS = ["一", "二", "三", "四", "五", "六", "七", "八", "九"]

# Normalized 0-100 layouts inside the inner face.
DOTS: dict[int, list[tuple[float, float]]] = {
    2: [(32, 28), (68, 72)],
    3: [(32, 24), (50, 50), (68, 76)],
    4: [(32, 28), (68, 28), (32, 72), (68, 72)],
    5: [(32, 26), (68, 26), (50, 50), (32, 74), (68, 74)],
    6: [(32, 22), (68, 22), (32, 50), (68, 50), (32, 78), (68, 78)],
    7: [(28, 20), (50, 20), (72, 20), (50, 50), (28, 80), (50, 80), (72, 80)],
    8: [(32, 16), (68, 16), (32, 39), (68, 39), (32, 61), (68, 61), (32, 84), (68, 84)],
    9: [(26, 18), (50, 18), (74, 18), (26, 50), (50, 50), (74, 50), (26, 82), (50, 82), (74, 82)],
}

# 2/3 条 must stand side-by-side, not stacked.
BAMBOO: dict[int, list[tuple[float, float]]] = {
    2: [(34, 50), (66, 50)],
    3: [(26, 50), (50, 50), (74, 50)],
    4: [(34, 30), (66, 30), (34, 70), (66, 70)],
    5: [(34, 26), (66, 26), (50, 50), (34, 74), (66, 74)],
    6: [(34, 24), (66, 24), (34, 50), (66, 50), (34, 76), (66, 76)],
    7: [(26, 24), (50, 24), (74, 24), (50, 50), (26, 76), (50, 76), (74, 76)],
    8: [(34, 16), (66, 16), (34, 39), (66, 39), (34, 62), (66, 62), (34, 85), (66, 85)],
    9: [(26, 18), (50, 18), (74, 18), (26, 50), (50, 50), (74, 50), (26, 82), (50, 82), (74, 82)],
}

BLUE = (22, 78, 160, 255)
BLUE_DARK = (10, 40, 90, 255)
RED = (196, 28, 28, 255)
RED_DARK = (120, 12, 12, 255)
GREEN = (18, 122, 48, 255)
GREEN_DARK = (8, 70, 28, 255)
GOLD = (214, 176, 72, 255)
INK = (22, 18, 14, 255)
WHITE = (255, 252, 245, 255)


def xy(nx: float, ny: float) -> tuple[int, int]:
    return (int(IX0 + IW * nx / 100), int(IY0 + IH * ny / 100))


def load_font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT), size)


def draw_centered(draw: ImageDraw.ImageDraw, text: str, cx: int, cy: int, font: ImageFont.FreeTypeFont, fill: tuple[int, ...]) -> None:
    box = draw.textbbox((0, 0), text, font=font)
    tw, th = box[2] - box[0], box[3] - box[1]
    draw.text((cx - tw / 2 - box[0], cy - th / 2 - box[1]), text, font=font, fill=fill)


def coin(draw: ImageDraw.ImageDraw, cx: int, cy: int, r: int, color: tuple[int, int, int, int], dark: tuple[int, int, int, int]) -> None:
    """Traditional 筒: stacked concentric rings, like a copper coin / 大饼."""
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=dark)
    draw.ellipse((cx - r + 3, cy - r + 3, cx + r - 3, cy + r - 3), fill=color)
    mid = int(r * 0.58)
    draw.ellipse((cx - mid, cy - mid, cx + mid, cy + mid), fill=WHITE)
    mid2 = int(r * 0.42)
    draw.ellipse((cx - mid2, cy - mid2, cx + mid2, cy + mid2), fill=color)
    hole = max(3, int(r * 0.18))
    draw.rectangle((cx - hole, cy - hole, cx + hole, cy + hole), fill=WHITE)
    draw.rectangle((cx - hole + 1, cy - hole + 1, cx + hole - 1, cy + hole - 1), outline=dark)


def bamboo(draw: ImageDraw.ImageDraw, cx: int, cy: int, length: int, width: int, accent: bool = False) -> None:
    """Traditional 索: three bamboo segments with gold knots and red tips."""
    half_h = length // 2
    half_w = width // 2
    body = (36, 132, 58, 255) if not accent else (176, 46, 40, 255)
    dark = (12, 64, 28, 255) if not accent else (110, 20, 18, 255)
    top, bot = cy - half_h, cy + half_h
    draw.rounded_rectangle((cx - half_w - 1, top - 1, cx + half_w + 1, bot + 1), radius=half_w + 1, fill=dark)
    draw.rounded_rectangle((cx - half_w, top, cx + half_w, bot), radius=half_w, fill=body)
    # thin highlight, not a half-and-half split
    draw.line((cx - half_w + 3, top + 8, cx - half_w + 3, bot - 8), fill=(210, 235, 180, 160), width=2)
    for t in (0.33, 0.67):
        y = int(top + length * t)
        draw.rectangle((cx - half_w - 1, y - 3, cx + half_w + 1, y + 3), fill=GOLD)
        draw.rectangle((cx - half_w, y - 1, cx + half_w, y + 1), fill=dark)
    tip = max(4, width // 3 + 1)
    draw.ellipse((cx - tip, top - 2, cx + tip, top + tip * 2 - 2), fill=RED)
    draw.ellipse((cx - tip, bot - tip * 2 + 2, cx + tip, bot + 2), fill=RED)


def paint_wan(img: Image.Image, rank: int) -> None:
    draw = ImageDraw.Draw(img)
    num_font = load_font(int(IH * 0.36))
    wan_font = load_font(int(IH * 0.34))
    cx = (IX0 + IX1) // 2
    draw_centered(draw, NUMS[rank - 1], cx, IY0 + int(IH * 0.30), num_font, INK)
    draw_centered(draw, "万", cx, IY0 + int(IH * 0.70), wan_font, RED)


def paint_tong(img: Image.Image, rank: int) -> None:
    draw = ImageDraw.Draw(img)
    if rank == 1:
        cx, cy = xy(50, 50)
        r = int(min(IW, IH) * 0.30)
        coin(draw, cx, cy, r, BLUE, BLUE_DARK)
        ring = int(r * 0.82)
        draw.ellipse((cx - ring, cy - ring, cx + ring, cy + ring), outline=WHITE, width=3)
        return
    positions = DOTS[rank]
    r = int(min(IW, IH) * (0.105 if rank >= 8 else 0.12))
    for index, (nx, ny) in enumerate(positions):
        color, dark = BLUE, BLUE_DARK
        if rank == 5 and index == 2:
            color, dark = RED, RED_DARK
        coin(draw, *xy(nx, ny), r, color, dark)


def paint_tiao(img: Image.Image, rank: int) -> None:
    draw = ImageDraw.Draw(img)
    positions = BAMBOO[rank]
    if rank in (2, 3):
        length, width = int(IH * 0.70), int(IW * 0.12)
    elif rank == 4:
        length, width = int(IH * 0.34), int(IW * 0.11)
    elif rank in (5, 6):
        length, width = int(IH * 0.24), int(IW * 0.10)
    elif rank == 8:
        length, width = int(IH * 0.16), int(IW * 0.09)
    else:
        length, width = int(IH * 0.20), int(IW * 0.095)
    for index, (nx, ny) in enumerate(positions):
        accent = rank == 5 and index == 2
        bamboo(draw, *xy(nx, ny), length, width, accent=accent)


def paint_dragon(img: Image.Image, rank: int) -> None:
    draw = ImageDraw.Draw(img)
    cx, cy = (IX0 + IX1) // 2, (IY0 + IY1) // 2
    if rank == 1:
        draw_centered(draw, "中", cx, cy, load_font(int(IH * 0.62)), RED)
        return
    if rank == 2:
        draw_centered(draw, "发", cx, cy, load_font(int(IH * 0.62)), GREEN)
        return
    pad_x, pad_y = int(IW * 0.20), int(IH * 0.18)
    box = (IX0 + pad_x, IY0 + pad_y, IX1 - pad_x, IY1 - pad_y)
    draw.rounded_rectangle(box, radius=22, outline=INK, width=18)
    inset = 10
    draw.rounded_rectangle(
        (box[0] + inset, box[1] + inset, box[2] - inset, box[3] - inset),
        radius=14,
        outline=(70, 62, 52, 255),
        width=3,
    )


def render(suit: str, rank: int) -> Image.Image:
    tile = BLANK.copy()
    if suit == "wan":
        paint_wan(tile, rank)
    elif suit == "tong":
        paint_tong(tile, rank)
    elif suit == "tiao":
        paint_tiao(tile, rank)
    else:
        paint_dragon(tile, rank)
    return tile.filter(ImageFilter.SMOOTH)


def import_yaoji() -> None:
    src = Path(
        r"C:\Users\14416\.grok\sessions\C%3A%5CUsers%5C14416%5CDesktop%5Cpizhou-mahjong-demo\01a0137d-5c0d-7032-9d1d-0b2fec57c7a2\images\10.jpg"
    )
    bird = Image.open(src).convert("RGBA")
    bird = bird.resize((W, H), Image.Resampling.LANCZOS)
    bird.save(OUT / "tiao-1.png")


def main() -> None:
    import_yaoji()
    for rank in range(1, 10):
        render("wan", rank).save(OUT / f"wan-{rank}.png")
        render("tong", rank).save(OUT / f"tong-{rank}.png")
    for rank in range(1, 4):
        render("dragon", rank).save(OUT / f"dragon-{rank}.png")
    print("wrote", len(list(OUT.glob("*.png"))), "tiles")


if __name__ == "__main__":
    main()
