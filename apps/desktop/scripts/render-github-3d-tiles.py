"""Render official GitHub tile art onto the 3D ivory body.

Source of truth: assets/tiles + assets/reference/tile-sheets/mahjong-tile-sheet.svg
- 条 = solid bamboo with gold joints (no bird, no debug captions)
- 筒 = green dots with gold cores
- 万/中/發 = YaHei glyphs matching the repo sheet
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[3]
DESKTOP = Path(__file__).resolve().parents[1]
BLANK = Image.open(DESKTOP / "public" / "assets" / "tile-front.png").convert("RGBA")
OUT = DESKTOP / "public" / "assets" / "tiles"
FONT = r"C:\Windows\Fonts\msyhbd.ttc"

W, H = BLANK.size
IX0, IY0, IX1, IY1 = 92, 118, 592, 884
IW, IH = IX1 - IX0, IY1 - IY0

# SVG tile space is 140 x 220; skip the baked-in "条 1" caption band.
SVG_W, SVG_H = 140.0, 196.0
SCALE = min(IW / SVG_W, IH / SVG_H) * 1.02
OX = IX0 + (IW - SVG_W * SCALE) / 2
OY = IY0 + (IH - SVG_H * SCALE) / 2

WAN_RED = (186, 48, 50, 255)
ZHONG_RED = (196, 37, 44, 255)
FA_GREEN = (22, 130, 76, 255)
BAI_TEAL = (59, 123, 115, 255)
BAI_SOFT = (177, 199, 189, 255)
JOINT = (229, 199, 108, 255)
HIGHLIGHT = (240, 232, 176, 160)
BAMBOO_EDGE = (31, 109, 73, 255)
DOT_EDGE = (33, 107, 99, 255)
DOT_CORE = (245, 230, 161, 255)
NUMS = ["一", "二", "三", "四", "五", "六", "七", "八", "九"]

TIAO_POS: dict[int, list[tuple[float, float]]] = {
    1: [(62, 86)],
    2: [(39, 44), (85, 128)],
    3: [(39, 36), (62, 86), (85, 136)],
    4: [(37, 38), (87, 38), (37, 134), (87, 134)],
    5: [(37, 38), (87, 38), (62, 86), (37, 134), (87, 134)],
    6: [(34, 36), (62, 36), (90, 36), (34, 136), (62, 136), (90, 136)],
    7: [(34, 28), (62, 28), (90, 28), (62, 86), (34, 144), (62, 144), (90, 144)],
    8: [(34, 28), (62, 28), (90, 28), (34, 86), (90, 86), (34, 144), (62, 144), (90, 144)],
    9: [(34, 28), (62, 28), (90, 28), (34, 86), (62, 86), (90, 86), (34, 144), (62, 144), (90, 144)],
}

TONG_POS: dict[int, list[tuple[float, float]]] = {
    1: [(70, 120)],
    2: [(47, 78), (93, 162)],
    3: [(47, 70), (70, 120), (93, 170)],
    4: [(45, 72), (95, 72), (45, 168), (95, 168)],
    5: [(45, 72), (95, 72), (70, 120), (45, 168), (95, 168)],
    6: [(42, 70), (70, 70), (98, 70), (42, 170), (70, 170), (98, 170)],
    7: [(42, 62), (70, 62), (98, 62), (70, 120), (42, 178), (70, 178), (98, 178)],
    8: [(42, 62), (70, 62), (98, 62), (42, 120), (98, 120), (42, 178), (70, 178), (98, 178)],
    9: [(42, 62), (70, 62), (98, 62), (42, 120), (70, 120), (98, 120), (42, 178), (70, 178), (98, 178)],
}


def xy(x: float, y: float) -> tuple[float, float]:
    return OX + x * SCALE, OY + y * SCALE


def box(x: float, y: float, w: float, h: float) -> tuple[float, float, float, float]:
    x0, y0 = xy(x, y)
    return x0, y0, x0 + w * SCALE, y0 + h * SCALE


def font(size_svg: float) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT, max(12, int(size_svg * SCALE)), index=0)


def chisel(layer: Image.Image) -> Image.Image:
    alpha = layer.split()[3]
    if alpha.getextrema() == (0, 0):
        return layer
    soft = alpha.filter(ImageFilter.GaussianBlur(1.1))
    shadow = Image.new("RGBA", layer.size, (70, 44, 16, 0))
    shadow.putalpha(soft.point(lambda a: int(a * 0.22)))
    out = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    out.paste(shadow, (2, 3), shadow)
    out.alpha_composite(layer)
    return out


def draw_centered(draw: ImageDraw.ImageDraw, text: str, cx: float, cy: float, size: float, fill: tuple[int, int, int, int]) -> None:
    face = font(size)
    px, py = xy(cx, cy)
    bbox = draw.textbbox((0, 0), text, font=face)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    ox = px - tw / 2 - bbox[0]
    oy = py - th / 2 - bbox[1]
    shadow = (70, 36, 16, 90)
    draw.text((ox + 2, oy + 3), text, font=face, fill=shadow)
    draw.text((ox - 1, oy - 1), text, font=face, fill=(255, 255, 255, 50))
    draw.text((ox, oy), text, font=face, fill=fill)


def make_bamboo_sprite(width: int, height: int) -> Image.Image:
    pad = 4
    size = (width + pad * 2, height + pad * 2)
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((pad, pad, pad + width, pad + height), radius=width // 2, fill=255)
    im = Image.new("RGBA", size, (0, 0, 0, 0))
    px = im.load()
    mx = mask.load()
    cx = pad + width / 2
    radius = max(1.0, width / 2)
    joints = [pad + int(height * t) for t in (0.23, 0.5, 0.77)]
    band = max(2, width // 8)
    for y in range(size[1]):
        for x in range(size[0]):
            a = mx[x, y]
            if a < 8:
                continue
            dx = (x - cx) / radius
            shade = 0.34 + 0.52 * max(0.0, 1.0 - (dx + 0.22) ** 2)
            shade += 0.18 * max(0.0, 1.0 - ((dx + 0.32) ** 2) / 0.12)
            red = int(14 + 28 * shade)
            green = int(40 + 148 * shade)
            blue = int(26 + 68 * shade)
            for jy in joints:
                if abs(y - jy) <= band:
                    wrap = 0.55 + 0.45 * max(0.0, 1.0 - dx * dx)
                    red = int(168 * wrap + 90 * (1 - wrap))
                    green = int(140 * wrap + 96 * (1 - wrap))
                    blue = int(52 * wrap + 30 * (1 - wrap))
            px[x, y] = (min(230, red), min(210, green), min(120, blue), a)
    return im


def make_dot_sprite(radius: int, master: bool = False) -> Image.Image:
    size = radius * 2 + 10
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = im.load()
    cx = cy = (size - 1) / 2
    for y in range(size):
        for x in range(size):
            dx = (x - cx) / radius
            dy = (y - cy) / radius
            dist = (dx * dx + dy * dy) ** 0.5
            if dist > 1.03:
                continue
            rim = 1.0 if dist < 0.94 else max(0.0, (1.03 - dist) / 0.09)
            light = 0.32 + 0.68 * max(0.0, 1.0 - ((dx + 0.26) ** 2 + (dy + 0.2) ** 2))
            # concentric coin: outer green, ivory ring, inner green, gold eye
            if dist < 0.22:
                red, green, blue = 245, 228, 150
                light = 0.75 + 0.25 * light
            elif dist < 0.38:
                red, green, blue = 28, 92, 62
            elif dist < 0.58:
                red, green, blue = 244, 236, 204
                light = 0.82 + 0.18 * light
            else:
                red, green, blue = 22, 118, 72
            red = int(red * (0.55 + 0.45 * light))
            green = int(green * (0.55 + 0.45 * light))
            blue = int(blue * (0.55 + 0.45 * light))
            if master and 0.68 < dist < 0.80:
                red, green, blue = 214, 176, 72
            px[x, y] = (min(255, red), min(255, green), min(255, blue), int(255 * min(1.0, rim)))
    return im


_BAMBOO: Image.Image | None = None
_DOT: Image.Image | None = None
_DOT_MASTER: Image.Image | None = None


def bamboo_sprite() -> Image.Image:
    global _BAMBOO
    if _BAMBOO is None:
        _BAMBOO = make_bamboo_sprite(max(20, int(18.5 * SCALE)), max(62, int(62 * SCALE)))
    return _BAMBOO


def paste_center(layer: Image.Image, sprite: Image.Image, cx: float, cy: float) -> None:
    px, py = xy(cx, cy)
    layer.alpha_composite(sprite, (int(px - sprite.size[0] / 2), int(py - sprite.size[1] / 2)))


def draw_bamboo(layer: Image.Image, x: float, y: float) -> None:
    sprite = bamboo_sprite()
    px, py = xy(x + 8, y + 30.5)
    layer.alpha_composite(sprite, (int(px - sprite.size[0] / 2), int(py - sprite.size[1] / 2)))


def draw_dot(layer: Image.Image, cx: float, cy: float, master: bool = False) -> None:
    global _DOT, _DOT_MASTER
    if master:
        if _DOT_MASTER is None:
            _DOT_MASTER = make_dot_sprite(max(28, int(36 * SCALE)), master=True)
        sprite = _DOT_MASTER
    else:
        if _DOT is None:
            _DOT = make_dot_sprite(max(16, int(15.5 * SCALE)), master=False)
        sprite = _DOT
    paste_center(layer, sprite, cx, cy)


def render_wan(rank: int) -> Image.Image:
    layer = Image.new("RGBA", BLANK.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    draw_centered(draw, NUMS[rank - 1], 70, 90, 90, WAN_RED)
    draw_centered(draw, "萬", 70, 158, 44, WAN_RED)
    tile = BLANK.copy()
    tile.alpha_composite(chisel(layer))
    return tile


def render_tiao(rank: int) -> Image.Image:
    layer = Image.new("RGBA", BLANK.size, (0, 0, 0, 0))
    if rank == 1:
        sprite = make_bamboo_sprite(max(26, int(26 * SCALE)), max(96, int(92 * SCALE)))
        px, py = xy(70, 118)
        layer.alpha_composite(sprite, (int(px - sprite.size[0] / 2), int(py - sprite.size[1] / 2)))
    else:
        for x, y in TIAO_POS[rank]:
            draw_bamboo(layer, x, y)
    tile = BLANK.copy()
    tile.alpha_composite(chisel(layer))
    return tile


def render_tong(rank: int) -> Image.Image:
    layer = Image.new("RGBA", BLANK.size, (0, 0, 0, 0))
    if rank == 1:
        draw_dot(layer, 70, 118, master=True)
    else:
        for cx, cy in TONG_POS[rank]:
            draw_dot(layer, cx, cy)
    tile = BLANK.copy()
    tile.alpha_composite(chisel(layer))
    return tile


def draw_zhong_stamp(draw: ImageDraw.ImageDraw) -> None:
    cx, cy = xy(70, 114)
    s = 52 * SCALE
    t = 15 * SCALE
    red = ZHONG_RED
    # vertical spine
    draw.rounded_rectangle((cx - t / 2, cy - s, cx + t / 2, cy + s), radius=t / 4, fill=red)
    # outer box
    draw.rounded_rectangle((cx - s, cy - s * 0.52, cx + s, cy + s * 0.52), radius=t / 5, outline=red, width=int(t))
    # fill left / right walls of 口
    draw.rectangle((cx - s, cy - s * 0.38, cx - s + t, cy + s * 0.38), fill=red)
    draw.rectangle((cx + s - t, cy - s * 0.38, cx + s, cy + s * 0.38), fill=red)


def render_dragon(rank: int) -> Image.Image:
    layer = Image.new("RGBA", BLANK.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    if rank == 1:
        draw_zhong_stamp(draw)
    elif rank == 2:
        draw_centered(draw, "發", 70, 114, 116, FA_GREEN)
    else:
        x0, y0, x1, y1 = box(22, 32, 96, 156)
        w = max(5, int(6.5 * SCALE))
        draw.rounded_rectangle((x0, y0, x1, y1), radius=9 * SCALE, outline=BAI_TEAL, width=w)
        ix0, iy0, ix1, iy1 = box(34, 48, 72, 124)
        draw.rounded_rectangle((ix0, iy0, ix1, iy1), radius=5 * SCALE, outline=BAI_SOFT, width=max(2, int(2.6 * SCALE)))
        # corner ticks, like the official 白板
        tick = 11 * SCALE
        for px, py, sx, sy in (
            (ix0, iy0, 1, 1),
            (ix1, iy0, -1, 1),
            (ix0, iy1, 1, -1),
            (ix1, iy1, -1, -1),
        ):
            draw.line((px, py, px + sx * tick, py), fill=BAI_TEAL, width=max(2, int(2.2 * SCALE)))
            draw.line((px, py, px, py + sy * tick), fill=BAI_TEAL, width=max(2, int(2.2 * SCALE)))
    tile = BLANK.copy()
    tile.alpha_composite(chisel(layer))
    return tile


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for r in range(1, 10):
        render_wan(r).save(OUT / f"wan-{r}.png")
        render_tiao(r).save(OUT / f"tiao-{r}.png")
        render_tong(r).save(OUT / f"tong-{r}.png")
        print("wrote", r)
    for r in range(1, 4):
        render_dragon(r).save(OUT / f"dragon-{r}.png")
        print("dragon", r)
    print("done", OUT)


if __name__ == "__main__":
    main()
