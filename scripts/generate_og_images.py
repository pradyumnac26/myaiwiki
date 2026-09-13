#!/usr/bin/env python3
"""Generate per-note Open Graph PNGs (1200x630) for social sharing."""

from __future__ import annotations

import re
import textwrap
import urllib.request
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError as exc:
    raise SystemExit(
        "Pillow is required. Install with: pip3 install Pillow"
    ) from exc

ROOT = Path(__file__).resolve().parents[1]
NOTES_DIR = ROOT / "_notes" / "Public"
OUTPUT_DIR = ROOT / "assets" / "og"
FONT_CACHE = ROOT / ".cache" / "og-fonts" / "Inter-Medium.ttf"
FONT_URL = "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-500-normal.ttf"
FALLBACK_PNG = ROOT / "assets" / "img" / "og-image.png"

WIDTH = 1200
HEIGHT = 630
BG = "#FFFCF0"
TITLE_COLOR = "#343331"
BRAND = "#3AA99F"
SITE_TITLE = "MyAIWiki"

# San Francisco on macOS; Inter Medium on Linux/Netlify (closest open match)
SYSTEM_FONTS = [
    Path("/System/Library/Fonts/SFNS.ttf"),
    Path("/System/Library/Fonts/SFCompact.ttf"),
    FONT_CACHE,
    Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    Path("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"),
]


def slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_-]+", "-", slug)
    return slug.strip("-")


def parse_note(path: Path) -> tuple[str, str] | None:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---"):
        return None

    parts = text.split("---", 2)
    if len(parts) < 3:
        return None

    front_matter = parts[1]
    title_match = re.search(r"^title:\s*(.+)$", front_matter, re.MULTILINE)
    feed_match = re.search(r"^feed:\s*(.+)$", front_matter, re.MULTILINE)
    if not title_match:
        return None
    if feed_match and feed_match.group(1).strip() != "show":
        return None

    title = title_match.group(1).strip().strip('"').strip("'")
    slug = slugify(path.stem)
    return slug, title


def ensure_font() -> Path | None:
    for candidate in SYSTEM_FONTS:
        if candidate.exists():
            return candidate

    FONT_CACHE.parent.mkdir(parents=True, exist_ok=True)
    try:
        urllib.request.urlretrieve(FONT_URL, FONT_CACHE)
    except OSError:
        return None

    return FONT_CACHE if FONT_CACHE.exists() else None


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    font_path = ensure_font()
    if font_path:
        return ImageFont.truetype(str(font_path), size)
    return ImageFont.load_default()


def wrap_title(title: str, max_chars: int = 28, max_lines: int = 3) -> list[str]:
    lines = textwrap.wrap(title, width=max_chars)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        lines[-1] = lines[-1][: max_chars - 1] + "…"
    return lines or [title[:max_chars]]


def font_size(lines: list[str]) -> int:
    longest = max(len(line) for line in lines)
    if len(lines) > 2 or longest > 24:
        return 52
    if longest > 18:
        return 60
    return 68


def draw_card(title: str, output_path: Path) -> None:
    lines = wrap_title(title)
    size = font_size(lines)
    font = load_font(size)

    image = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(image)

    line_height = int(size * 1.3)
    block_height = line_height * len(lines)
    start_y = (HEIGHT - block_height) // 2

    for index, line in enumerate(lines):
        y = start_y + index * line_height
        bbox = draw.textbbox((0, 0), line, font=font)
        text_width = bbox[2] - bbox[0]
        x = (WIDTH - text_width) // 2
        draw.text((x, y), line, fill=TITLE_COLOR, font=font)

    accent_y = min(start_y + block_height + 40, HEIGHT - 100)
    draw.rounded_rectangle((520, accent_y, 680, accent_y + 3), radius=2, fill=BRAND)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(output_path, format="PNG", optimize=True)


def copy_fallback(output_path: Path) -> None:
    if not FALLBACK_PNG.exists():
        raise FileNotFoundError(f"Missing fallback image: {FALLBACK_PNG}")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(FALLBACK_PNG.read_bytes())


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    notes: dict[str, str] = {}
    if NOTES_DIR.exists():
        for note_path in sorted(NOTES_DIR.glob("*.md")):
            parsed = parse_note(note_path)
            if parsed:
                slug, title = parsed
                notes[slug] = title

    for slug, title in notes.items():
        output = OUTPUT_DIR / f"{slug}.png"
        try:
            draw_card(title, output)
            print(f"OG Images: Generated {slug}.png")
        except OSError as exc:
            print(f"OG Images: Failed {slug}.png ({exc}), using fallback")
            copy_fallback(output)

    site_output = OUTPUT_DIR / "site.png"
    try:
        draw_card(SITE_TITLE, site_output)
        print("OG Images: Generated site.png")
    except OSError as exc:
        print(f"OG Images: Failed site.png ({exc}), using fallback")
        copy_fallback(site_output)


if __name__ == "__main__":
    main()
