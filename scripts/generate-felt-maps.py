"""Derive normal + roughness maps for the mahjong table felt.

Run once offline; outputs are committed to public/assets/. Keeping the felt
photograph as the only source of truth avoids hand-painted look and keeps the
runtime free of any image processing.
"""
from PIL import Image, ImageFilter, ImageOps
import os, math

ASSETS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..",
                      "apps", "desktop", "public", "assets")
src = Image.open(os.path.join(ASSETS, "felt.jpg")).convert("L")
# The felt photo is 1024px; half resolution is plenty for a tiling detail map
# and keeps the normal map smooth rather than noisy.
W = 512
src = src.resize((W, W), Image.LANCZOS)

def height_to_normal(height, strength=0.55):
    """Sobel gradient -> tangent-space normal map."""
    h = height.filter(ImageFilter.GaussianBlur(0.6))
    px = h.load()
    out = Image.new("RGB", (W, W))
    op = out.load()
    for y in range(W):
        for x in range(W):
            # wrap for seamless tiling
            l = px[(x - 1) % W, y]
            r = px[(x + 1) % W, y]
            u = px[x, (y - 1) % W]
            d = px[x, (y + 1) % W]
            dx = (l - r) * strength
            dy = (u - d) * strength
            nz = 1.0
            inv = 1.0 / math.sqrt(dx * dx + dy * dy + nz * nz)
            op[x, y] = (
                int(max(0, min(255, (dx * inv * 0.5 + 0.5) * 255))),
                int(max(0, min(255, (dy * inv * 0.5 + 0.5) * 255))),
                int(max(0, min(255, (nz * inv * 0.5 + 0.5) * 255))),
            )
    return out

normal = height_to_normal(src)
normal.save(os.path.join(ASSETS, "felt-normal.png"))
print("felt-normal.png", normal.size)

# Roughness: felt is uniformly matte. Encode a subtle variation so grazing
# light picks up the weave instead of a perfectly flat sheen.
rough = src.filter(ImageFilter.GaussianBlur(1.2))
rough = ImageOps.autocontrast(rough, cutoff=2)
# map mid-grey -> high roughness; narrow the range so it stays felt-like
lo, hi = rough.getextrema()
rough = rough.point(lambda v: int(196 + (v - lo) / max(hi - lo, 1) * 40))
rough.convert("L").save(os.path.join(ASSETS, "felt-rough.png"))
print("felt-rough.png", rough.size, "range", rough.getextrema())
