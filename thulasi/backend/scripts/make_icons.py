"""Generate the app's PWA icons.

Pure standard library — no Pillow, no ImageMagick. Draws a soft blush-to-plum
gradient tile with a white heart, and writes real PNG files.

    python scripts/make_icons.py
"""

import struct
import zlib
from pathlib import Path

OUT_DIR = Path(__file__).resolve().parent.parent.parent / "frontend" / "public"

BLUSH = (255, 158, 196)
PLUM = (110, 42, 86)
HEART = (255, 255, 255)


def write_png(path: Path, width: int, height: int, pixels: bytearray) -> None:
    """pixels is RGBA row-major, 4 bytes per pixel."""
    raw = bytearray()
    stride = width * 4
    for y in range(height):
        raw.append(0)  # filter type 0 (None)
        raw.extend(pixels[y * stride : (y + 1) * stride])

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    header = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )
    path.write_bytes(png)


# The implicit heart curve (x²+y²-1)³ - x²y³ = 0 spans roughly
# x in [-1.13, 1.13] and y in [-1.32, 1.00], so its visual centre sits at
# y = -0.16 rather than the origin.
CURVE_HALF_WIDTH = 1.13
CURVE_TOP = 1.00
CURVE_BOTTOM = -1.32
CURVE_CENTRE_Y = (CURVE_TOP + CURVE_BOTTOM) / 2


def heart_contains(x: float, y: float) -> bool:
    """Classic implicit heart curve, pointing down, centred on the origin."""
    return (x * x + y * y - 1) ** 3 - x * x * y * y * y <= 0


def render(size: int, heart_fraction: float, transparent_bg: bool = False) -> bytearray:
    """Render one square icon with 3x supersampling for smooth edges.

    ``heart_fraction`` is the share of the icon width the heart should span,
    so the shape is centred and never clipped by the canvas.
    """
    pixels = bytearray(size * size * 4)
    samples = 3
    cx = (size - 1) / 2
    cy = (size - 1) / 2
    # Scale so the curve's full width equals heart_fraction of the icon.
    base = (size * heart_fraction) / (2 * CURVE_HALF_WIDTH)

    for py in range(size):
        for px in range(size):
            heart_hits = 0
            bg_r = bg_g = bg_b = 0

            for sy in range(samples):
                for sx in range(samples):
                    fx = px + (sx + 0.5) / samples
                    fy = py + (sy + 0.5) / samples

                    # Convert to curve space: flip y (screen grows downward) and
                    # re-centre on the shape's visual middle.
                    hx = (fx - cx) / base
                    hy = -(fy - cy) / base
                    if heart_contains(hx, hy + CURVE_CENTRE_Y):
                        heart_hits += 1

                    t = (fx / size + fy / size) / 2
                    bg_r += round(BLUSH[0] + (PLUM[0] - BLUSH[0]) * t)
                    bg_g += round(BLUSH[1] + (PLUM[1] - BLUSH[1]) * t)
                    bg_b += round(BLUSH[2] + (PLUM[2] - BLUSH[2]) * t)

            total = samples * samples
            coverage = heart_hits / total
            offset = (py * size + px) * 4

            if transparent_bg:
                alpha = round(255 * coverage)
                pixels[offset] = 255
                pixels[offset + 1] = 255
                pixels[offset + 2] = 255
                pixels[offset + 3] = alpha
                continue

            r = round((bg_r / total) * (1 - coverage) + HEART[0] * coverage)
            g = round((bg_g / total) * (1 - coverage) + HEART[1] * coverage)
            b = round((bg_b / total) * (1 - coverage) + HEART[2] * coverage)
            pixels[offset] = r
            pixels[offset + 1] = g
            pixels[offset + 2] = b
            pixels[offset + 3] = 255

    return pixels


def write_svg(path: Path) -> None:
    """A crisp vector icon for the browser tab and the launch screen."""
    svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ff9ec4"/>
      <stop offset="1" stop-color="#6e2a56"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#g)"/>
  <path fill="#ffffff" d="M256 402c-8 0-15-3-20-8-38-34-92-74-118-118-20-34-16-78 12-104 26-24 66-22 90 4l36 40 36-40c24-26 64-28 90-4 28 26 32 70 12 104-26 44-80 84-118 118-5 5-12 8-20 8z"/>
  <circle cx="196" cy="180" r="9" fill="#ffd9e6" opacity="0.85"/>
</svg>
"""
    path.write_text(svg)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    icons = [
        ("icon-192.png", 192, 0.66, False),
        ("icon-512.png", 512, 0.66, False),
        # Maskable icons must keep their art inside the centre 80% safe zone.
        ("icon-maskable-512.png", 512, 0.46, False),
        ("apple-touch-icon.png", 180, 0.66, False),
        # The notification badge must be a transparent monochrome silhouette.
        ("badge-96.png", 96, 0.72, True),
    ]

    for name, size, scale, transparent in icons:
        print(f"  rendering {name} ({size}x{size})")
        write_png(OUT_DIR / name, size, size, render(size, scale, transparent))

    write_svg(OUT_DIR / "icon.svg")
    print(f"Icons written to {OUT_DIR}")


if __name__ == "__main__":
    main()
