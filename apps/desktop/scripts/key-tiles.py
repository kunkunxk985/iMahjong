from collections import deque
from pathlib import Path

from PIL import Image

PROJECT = Path(__file__).resolve().parents[2]
SRC = Path(
    r"C:\Users\14416\.grok\sessions\C%3A%5CUsers%5C14416%5CDesktop%5Cpizhou-mahjong-demo\01a0137d-5c0d-7032-9d1d-0b2fec57c7a2\images"
)
OUT = PROJECT / "apps" / "desktop" / "public" / "assets"
SOURCE = PROJECT / "assets" / "source"
OUT.mkdir(parents=True, exist_ok=True)
SOURCE.mkdir(parents=True, exist_ok=True)


def is_green(r: int, g: int, b: int) -> bool:
    return g >= 95 and g >= r + 12 and g >= b + 12 and r + b < 340


def key_and_crop(src: Path, dest: Path) -> None:
    img = Image.open(src).convert("RGBA")
    width, height = img.size
    pix = img.load()
    assert pix is not None

    seen = [[False] * width for _ in range(height)]
    queue: deque[tuple[int, int]] = deque()
    for x, y in [(0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)]:
        queue.append((x, y))
        seen[y][x] = True

    while queue:
        x, y = queue.popleft()
        r, g, b, _a = pix[x, y]
        if not is_green(r, g, b):
            continue
        pix[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < width and 0 <= ny < height and not seen[ny][nx]:
                seen[ny][nx] = True
                queue.append((nx, ny))

    xs: list[int] = []
    ys: list[int] = []
    for y in range(height):
        for x in range(width):
            r, g, b, a = pix[x, y]
            if a == 0:
                continue
            if is_green(r, g, b):
                pix[x, y] = (0, 0, 0, 0)
                continue
            xs.append(x)
            ys.append(y)

    box = (min(xs), min(ys), max(xs) + 1, max(ys) + 1)
    cropped = img.crop(box)
    cropped.save(dest, "PNG")
    print(dest.name, cropped.size)


key_and_crop(SRC / "7.jpg", SOURCE / "tile-front.png")
key_and_crop(SRC / "8.jpg", OUT / "tile-back.png")
print("done")
