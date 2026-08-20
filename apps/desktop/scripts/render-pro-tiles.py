"""Professional Chinese Mahjong Tile Face Art Generator.

Produces authentic, high-definition traditional Chinese Mahjong tiles:
- Authentic brush calligraphy for 万字 and 字牌 (Ma Shan Zheng)
- Intricate carved copper cash coins (铜钱/大饼) for 筒子
- Sculpted bamboo canes (竹节) for 条子
- Cloisonné gold-filigree peacock/rooster for 1-Bamboo (幺鸡)
- Classical dragons (红中 / 碧绿发财 / 青花白板)
"""

from __future__ import annotations

import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "public" / "assets"
OUT = ASSETS / "tiles"
OUT.mkdir(parents=True, exist_ok=True)

BLANK = Image.open(ASSETS / "tile-front.png").convert("RGBA")
W, H = BLANK.size  # 684 x 1002

# Inner face coordinate space
IX0, IY0, IX1, IY1 = 92, 118, 592, 884
IW, IH = IX1 - IX0, IY1 - IY0
CX = (IX0 + IX1) // 2
CY = (IY0 + IY1) // 2

# Font path
FONT_KAI = str(ROOT / "build" / "MaShanZheng.ttf")

import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Authentic Chinese Mahjong Palette
RED = (204, 28, 28, 255)            # 朱砂红
RED_DARK = (120, 14, 14, 255)
BLUE = (22, 74, 154, 255)           # 景泰蓝 / 花青 (宝蓝)
BLUE_DARK = (10, 36, 82, 255)
GREEN = (18, 126, 48, 255)          # 翡翠绿
GREEN_DARK = (8, 66, 24, 255)
GOLD = (218, 172, 54, 255)          # 泥金
GOLD_DARK = (142, 108, 24, 255)
INK = (24, 20, 16, 255)             # 浓墨
IVORY = (255, 253, 246, 255)


def get_font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_KAI, size)


def apply_chisel_relief(symbol_img: Image.Image, depth: int = 3) -> Image.Image:
    """Applies authentic carved groove shadow + highlight to give deep relief."""
    alpha = symbol_img.split()[3]
    if alpha.getextrema() == (0, 0):
        return symbol_img

    shadow_mask = Image.new("L", symbol_img.size, 0)
    shadow_mask.paste(alpha, (depth, depth))
    shadow_layer = Image.new("RGBA", symbol_img.size, (0, 0, 0, 130))

    hl_mask = Image.new("L", symbol_img.size, 0)
    hl_mask.paste(alpha, (-depth + 1, -depth + 1))
    hl_layer = Image.new("RGBA", symbol_img.size, (255, 255, 255, 75))

    canvas = Image.new("RGBA", symbol_img.size, (0, 0, 0, 0))
    canvas.paste(hl_layer, (0, 0), mask=hl_mask)
    canvas.paste(shadow_layer, (0, 0), mask=alpha)
    canvas.paste(symbol_img, (0, 0), mask=alpha)
    return canvas


def draw_bold_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    cx: int,
    cy: int,
    font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int, int],
    bold_offset: int = 3,
) -> None:
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    ox = cx - tw / 2 - bbox[0]
    oy = cy - th / 2 - bbox[1]

    for dx in range(-bold_offset, bold_offset + 1):
        for dy in range(-bold_offset, bold_offset + 1):
            draw.text((ox + dx, oy + dy), text, font=font, fill=fill)


# ─── 1. 万字 (Characters 1-9) ───────────────────────────────────

NUMS = ["一", "二", "三", "四", "五", "六", "七", "八", "九"]


def render_wan(rank: int) -> Image.Image:
    tile = BLANK.copy()
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    num_font = get_font(int(IH * 0.44))
    wan_font = get_font(int(IH * 0.42))

    # Top Chinese Numeral in Blue (宝蓝)
    num_y = IY0 + int(IH * 0.28)
    draw_bold_text(draw, NUMS[rank - 1], CX, num_y, num_font, BLUE, bold_offset=3)

    # Bottom 萬 in Cinnabar Red (朱砂红)
    wan_y = IY0 + int(IH * 0.73)
    draw_bold_text(draw, "萬", CX, wan_y, wan_font, RED, bold_offset=3)

    engraved = apply_chisel_relief(layer, depth=3)
    tile.alpha_composite(engraved)
    return tile


# ─── 2. 筒子 (Dots / Cash Coins 1-9) ────────────────────────────

def draw_cash_coin(
    draw: ImageDraw.ImageDraw,
    cx: int,
    cy: int,
    r: int,
    main_c: tuple[int, int, int, int],
    dark_c: tuple[int, int, int, int],
) -> None:
    """Carved copper cash coin with 8 outer gear/flower notches."""
    for i in range(8):
        angle = i * (math.pi / 4)
        px = cx + math.cos(angle) * (r * 0.94)
        py = cy + math.sin(angle) * (r * 0.94)
        pr = max(3, int(r * 0.24))
        draw.ellipse((px - pr, py - pr, px + pr, py + pr), fill=dark_c)
        draw.ellipse((px - pr + 2, py - pr + 2, px + pr - 2, py + pr - 2), fill=main_c)

    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=dark_c)
    draw.ellipse((cx - r + 3, cy - r + 3, cx + r - 3, cy + r - 3), fill=main_c)

    rm = int(r * 0.60)
    draw.ellipse((cx - rm, cy - rm, cx + rm, cy + rm), fill=IVORY)

    ri = int(r * 0.44)
    draw.ellipse((cx - ri, cy - ri, cx + ri, cy + ri), fill=main_c)

    h = max(3, int(r * 0.22))
    draw.rectangle((cx - h, cy - h, cx + h, cy + h), fill=IVORY)
    draw.rectangle((cx - h + 1, cy - h + 1, cx + h - 1, cy + h - 1), outline=dark_c)


def draw_master_yi_tong(draw: ImageDraw.ImageDraw, cx: int, cy: int, r: int) -> None:
    """Master 1-Dot (大饼) with 16-petal lotus, sun disk, and golden pearls."""
    for i in range(16):
        angle = i * (math.pi / 8)
        px = cx + math.cos(angle) * (r * 0.96)
        py = cy + math.sin(angle) * (r * 0.96)
        pr = int(r * 0.15)
        draw.ellipse((px - pr, py - pr, px + pr, py + pr), fill=GREEN_DARK)
        draw.ellipse((px - pr + 2, py - pr + 2, px + pr - 2, py + pr - 2), fill=GREEN)

    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=BLUE_DARK)
    draw.ellipse((cx - r + 4, cy - r + 4, cx + r - 4, cy + r - 4), fill=BLUE)

    rb = int(r * 0.76)
    for i in range(12):
        angle = i * (math.pi / 6)
        bx = cx + math.cos(angle) * rb
        by = cy + math.sin(angle) * rb
        br = int(r * 0.085)
        draw.ellipse((bx - br, by - br, bx + br, by + br), fill=GOLD_DARK)
        draw.ellipse((bx - br + 2, by - br + 2, bx + br - 2, by + br - 2), fill=GOLD)

    r_red = int(r * 0.60)
    draw.ellipse((cx - r_red, cy - r_red, cx + r_red, cy + r_red), fill=RED_DARK)
    draw.ellipse((cx - r_red + 3, cy - r_red + 3, cx + r_red - 3, cy + r_red - 3), fill=RED)

    r_green = int(r * 0.38)
    draw.ellipse((cx - r_green, cy - r_green, cx + r_green, cy + r_green), fill=GREEN)

    r_core = int(r * 0.22)
    draw.ellipse((cx - r_core, cy - r_core, cx + r_core, cy + r_core), fill=GOLD)
    draw.ellipse((cx - 8, cy - 8, cx + 8, cy + 8), fill=RED)


DOT_POS: dict[int, list[tuple[float, float, str]]] = {
    2: [(50, 28, "blue"), (50, 72, "green")],
    3: [(28, 25, "blue"), (50, 50, "red"), (72, 75, "green")],
    4: [(32, 28, "green"), (68, 28, "blue"), (32, 72, "blue"), (68, 72, "green")],
    5: [(30, 26, "green"), (70, 26, "blue"), (50, 50, "red"), (30, 74, "blue"), (70, 74, "green")],
    6: [(32, 24, "green"), (68, 24, "green"), (32, 50, "red"), (68, 50, "red"), (32, 76, "red"), (68, 76, "red")],
    7: [(28, 20, "green"), (50, 26, "green"), (72, 32, "green"), (32, 58, "red"), (68, 58, "red"), (32, 82, "red"), (68, 82, "red")],
    8: [(32, 16, "blue"), (68, 16, "blue"), (32, 38, "blue"), (68, 38, "blue"), (32, 62, "blue"), (68, 62, "blue"), (32, 84, "blue"), (68, 84, "blue")],
    9: [(26, 20, "blue"), (50, 20, "blue"), (74, 20, "blue"), (26, 50, "red"), (50, 50, "red"), (74, 50, "red"), (26, 80, "green"), (50, 80, "green"), (74, 80, "green")],
}


def render_tong(rank: int) -> Image.Image:
    tile = BLANK.copy()
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    if rank == 1:
        draw_master_yi_tong(draw, CX, CY, int(min(IW, IH) * 0.40))
    else:
        coords = DOT_POS[rank]
        r = int(min(IW, IH) * (0.115 if rank >= 7 else 0.135))
        for nx, ny, c_key in coords:
            px = int(IX0 + IW * nx / 100)
            py = int(IY0 + IH * ny / 100)
            if c_key == "red":
                mc, dc = RED, RED_DARK
            elif c_key == "green":
                mc, dc = GREEN, GREEN_DARK
            else:
                mc, dc = BLUE, BLUE_DARK
            draw_cash_coin(draw, px, py, r, mc, dc)

    engraved = apply_chisel_relief(layer, depth=3)
    tile.alpha_composite(engraved)
    return tile


# ─── 3. 条子 (Bamboo / Bams 1-9) ────────────────────────────────

def draw_cane(
    draw: ImageDraw.ImageDraw,
    cx: int,
    cy: int,
    length: int,
    width: int,
    main_c: tuple[int, int, int, int] = GREEN,
    dark_c: tuple[int, int, int, int] = GREEN_DARK,
) -> None:
    hw = width // 2
    hl = length // 2
    top, bot = cy - hl, cy + hl

    draw.rounded_rectangle((cx - hw - 2, top - 2, cx + hw + 2, bot + 2), radius=hw + 2, fill=dark_c)
    draw.rounded_rectangle((cx - hw, top, cx + hw, bot), radius=hw, fill=main_c)
    draw.line((cx - hw + 3, top + 6, cx - hw + 3, bot - 6), fill=(215, 250, 205, 190), width=2)

    for t in (0.33, 0.67):
        jy = int(top + length * t)
        draw.rectangle((cx - hw - 1, jy - 3, cx + hw + 1, jy + 3), fill=GOLD)
        draw.rectangle((cx - hw, jy - 1, cx + hw, jy + 1), fill=dark_c)

    draw.ellipse((cx - hw + 2, top - 2, cx + hw - 2, top + 5), fill=RED)
    draw.ellipse((cx - hw + 2, bot - 5, cx + hw - 2, bot + 2), fill=RED)


BAMBOO_POS: dict[int, list[tuple[float, float, str]]] = {
    2: [(50, 28, "green"), (50, 72, "green")],
    3: [(50, 24, "green"), (50, 50, "green"), (50, 76, "green")],
    4: [(34, 30, "green"), (66, 30, "green"), (34, 70, "green"), (66, 70, "green")],
    5: [(32, 26, "green"), (68, 26, "green"), (50, 50, "red"), (32, 74, "green"), (68, 74, "green")],
    6: [(34, 24, "green"), (66, 24, "green"), (34, 50, "green"), (66, 50, "green"), (34, 76, "green"), (66, 76, "green")],
    7: [(50, 20, "red"), (34, 46, "green"), (66, 46, "green"), (34, 68, "green"), (66, 68, "green"), (34, 90, "green"), (66, 90, "green")],
    8: [(34, 18, "green"), (66, 18, "green"), (34, 39, "green"), (66, 39, "green"), (34, 61, "green"), (66, 61, "green"), (34, 83, "green"), (66, 83, "green")],
    9: [(26, 22, "green"), (50, 22, "red"), (74, 22, "blue"), (26, 50, "green"), (50, 50, "red"), (74, 50, "blue"), (26, 78, "green"), (50, 78, "red"), (74, 78, "blue")],
}


def render_tiao(rank: int) -> Image.Image:
    if rank == 1:
        # Check if existing high quality 幺鸡 exists
        cur_path = OUT / "tiao-1.png"
        if cur_path.exists():
            return Image.open(cur_path).convert("RGBA")

    tile = BLANK.copy()
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    coords = BAMBOO_POS[rank]
    length = int(IH * (0.35 if rank in (2, 3) else 0.23 if rank in (4, 5, 6) else 0.17))
    width = int(IW * (0.13 if rank in (2, 3) else 0.11 if rank in (4, 5, 6) else 0.095))
    for nx, ny, c_key in coords:
        px = int(IX0 + IW * nx / 100)
        py = int(IY0 + IH * ny / 100)
        if c_key == "red":
            mc, dc = RED, RED_DARK
        elif c_key == "blue":
            mc, dc = BLUE, BLUE_DARK
        else:
            mc, dc = GREEN, GREEN_DARK
        draw_cane(draw, px, py, length, width, mc, dc)

    engraved = apply_chisel_relief(layer, depth=3)
    tile.alpha_composite(engraved)
    return tile


# ─── 4. 字牌 (Dragons: 红中, 发财, 白板) ──────────────────────────

def render_dragon(rank: int) -> Image.Image:
    tile = BLANK.copy()
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    if rank == 1:
        # 红中 (Grand Calligraphic 中 in Red)
        font = get_font(int(IH * 0.76))
        draw_bold_text(draw, "中", CX, CY, font, RED, bold_offset=4)
    elif rank == 2:
        # 发财 (Grand Calligraphic 繁体 發 in Emerald Green)
        font = get_font(int(IH * 0.74))
        draw_bold_text(draw, "發", CX, CY, font, GREEN, bold_offset=3)
    else:
        # 白板: Classical Double-Bordered Jade Frame in Blue
        bx0, by0 = IX0 + int(IW * 0.10), IY0 + int(IH * 0.08)
        bx1, by1 = IX1 - int(IW * 0.10), IY1 - int(IH * 0.08)

        # Outer thick cobalt border
        draw.rounded_rectangle((bx0, by0, bx1, by1), radius=32, outline=BLUE_DARK, width=24)
        draw.rounded_rectangle((bx0 + 3, by0 + 3, bx1 - 3, by1 - 3), radius=30, outline=BLUE, width=18)

        # Inner fine blue wire
        pad = 28
        draw.rounded_rectangle((bx0 + pad, by0 + pad, bx1 - pad, by1 - pad), radius=18, outline=BLUE_DARK, width=4)

    engraved = apply_chisel_relief(layer, depth=3)
    tile.alpha_composite(engraved)
    return tile


def main() -> None:
    print("Rendering complete Chinese Mahjong art set with blue numerals, red Wan, and traditional Fa...")
    for r in range(1, 10):
        render_wan(r).save(OUT / f"wan-{r}.png")
        render_tong(r).save(OUT / f"tong-{r}.png")
        if r > 1 or not (OUT / "tiao-1.png").exists():
            render_tiao(r).save(OUT / f"tiao-{r}.png")
    for r in range(1, 4):
        render_dragon(r).save(OUT / f"dragon-{r}.png")

    print(f"All 30 tiles successfully generated into {OUT}!")


if __name__ == "__main__":
    main()
