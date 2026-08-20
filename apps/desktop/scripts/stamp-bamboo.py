"""Stamp one photographed bamboo onto the ivory tile in classic 条 layouts."""

from pathlib import Path

from PIL import Image

SRC = Path(
    r"C:\Users\14416\.grok\sessions\C%3A%5CUsers%5C14416%5CDesktop%5Cpizhou-mahjong-demo\01a0137d-5c0d-7032-9d1d-0b2fec57c7a2\images"
)
PROJECT = Path(__file__).resolve().parents[2]
ASSETS = PROJECT / "apps" / "desktop" / "public" / "assets"
SOURCE = PROJECT / "assets" / "source"
OUT = ASSETS / "tiles"
BLANK = Image.open(SOURCE / "tile-front.png").convert("RGBA")
W, H = BLANK.size


def isolate(cane: Image.Image) -> Image.Image:
    pix = cane.load()
    assert pix is not None
    width, height = cane.size
    for y in range(height):
        for x in range(width):
            r, g, b, _a = pix[x, y]
            if r > 200 and g > 188 and b > 160 and abs(r - g) < 28:
                pix[x, y] = (0, 0, 0, 0)
    return cane


def cut(name: str, box: tuple[int, int, int, int]) -> Image.Image:
    img = Image.open(SRC / name).convert("RGBA")
    return isolate(img.crop(box))


def stamp(cane: Image.Image, positions: list[tuple[float, float]], scale: float) -> Image.Image:
    tile = BLANK.copy()
    cw = max(1, int(cane.width * scale))
    ch = max(1, int(cane.height * scale))
    sprite = cane.resize((cw, ch), Image.Resampling.LANCZOS)
    for nx, ny in positions:
        x = int(W * nx / 100 - cw / 2)
        y = int(H * ny / 100 - ch / 2)
        tile.alpha_composite(sprite, (x, y))
    return tile


def main() -> None:
    # Left cane from 二条 photo.
    tall = cut("11.jpg", (228, 175, 418, 1068))
    # Top-left cane from 五条 photo.
    short = cut("16.jpg", (188, 150, 342, 548))
    tall.save(ASSETS / "_cane-tall.png")
    short.save(ASSETS / "_cane-short.png")

    def adopt(src_name: str, dest: str) -> None:
        img = Image.open(SRC / src_name).convert("RGBA").resize((W, H), Image.Resampling.LANCZOS)
        img.save(OUT / dest)

    adopt("11.jpg", "tiao-2.png")
    adopt("14.jpg", "tiao-3.png")
    adopt("16.jpg", "tiao-5.png")
    adopt("15.jpg", "tiao-7.png")
    adopt("17.jpg", "tiao-9.png")
    stamp(short, [(34, 32), (66, 32), (34, 70), (66, 70)], 0.95).save(OUT / "tiao-4.png")
    stamp(short, [(34, 26), (66, 26), (34, 50), (66, 50), (34, 74), (66, 74)], 0.82).save(OUT / "tiao-6.png")
    stamp(short, [(34, 18), (66, 18), (34, 40), (66, 40), (34, 62), (66, 62), (34, 84), (66, 84)], 0.62).save(OUT / "tiao-8.png")
    print("stamped 4/6/8, adopted 2/3/5/7/9")


if __name__ == "__main__":
    main()
