"""Build the screenshot header with Pillow: python manifesto/build_header.py."""
from pathlib import Path
import random

from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent
SIZE = (1200, 480)
# Crop centres retain the relevant app UI inside the landscape banner.
SOURCES = [
    ("agent1c-ai.jpg", "AGENT1C.AI / BROWSER WORKSPACE", (0.5, 0.6)),
    ("agent1c-me.jpg", "AGENT1C.ME / LOCAL-FIRST WORKSPACE", (0.5, 0.8)),
    ("hitomi-android.jpg", "OPEN HITOMI / ANDROID COMPANION", (0.5, 0.25)),
    ("hitomi-termux.jpg", "HITOMI / TERMUX ENVIRONMENT", (0.5, 0.52)),
    ("hedgeyos-desktop.jpg", "HEDGEYOS / LINUX IN AN APK", (0.5, 0.86)),
    ("hedgeytty-source.jpg", "HEDGEYTTY / DEVELOPMENT DOCUMENTATION", (0.3, 0.5)),
    ("hitomi-google-play.jpg", "HITOMI / GOOGLE PLAY DISTRIBUTION", (0.3, 0.12)),
    ("open-hitomi-fdroid.jpg", "OPEN HITOMI / F-DROID DISTRIBUTION", (0.2, 0.25)),
]


def label(image, text, index):
    image = image.copy().convert("RGBA")
    overlay = Image.new("RGBA", SIZE)
    draw = ImageDraw.Draw(overlay)
    draw.rectangle((0, 0, SIZE[0], 46), fill=(19, 17, 23, 235))
    draw.rectangle((0, 45, SIZE[0], 47), fill=(200, 100, 133, 255))
    try:
        font = ImageFont.truetype("DejaVuSansMono.ttf", 17)
    except OSError:
        font = ImageFont.load_default()
    draw.text((22, 13), text, font=font, fill=(252, 250, 247, 255))
    draw.text((1100, 13), f"{index + 1:02d} / 08", font=font, fill=(228, 150, 174, 255))
    return Image.alpha_composite(image, overlay).convert("RGB")


def glitch(old, new, step, seed):
    rng = random.Random(seed)
    frame = Image.blend(old, new, (step + 1) / 4)
    # Horizontal tears and displaced colour channels, without white-out flashes.
    for _ in range(7):
        y = rng.randrange(48, SIZE[1] - 30)
        h = rng.randrange(4, 26)
        strip = (new if rng.random() < (step + 1) / 4 else old).crop((0, y, SIZE[0], y + h))
        frame.paste(ImageChops.offset(strip, rng.randrange(-42, 43), 0), (0, y))
    red, green, blue = frame.split()
    frame = Image.merge("RGB", (ImageChops.offset(red, 5 - 2 * step, 0), green, ImageChops.offset(blue, -5 + 2 * step, 0)))
    draw = ImageDraw.Draw(frame)
    for y in range(48, SIZE[1], 8):
        draw.line((0, y, SIZE[0], y), fill=(44, 35, 48), width=1)
    return frame


def main():
    shots = [label(ImageOps.fit(Image.open(ROOT / name).convert("RGB"), SIZE,
                               method=Image.Resampling.LANCZOS, centering=centre), text, n)
             for n, (name, text, centre) in enumerate(SOURCES)]
    frames, durations = [], []
    for n, shot in enumerate(shots):
        frames.append(shot)
        durations.append(2100)
        for step in range(3):
            frames.append(glitch(shot, shots[(n + 1) % len(shots)], step, n * 10 + step))
            durations.append(90)
    # One shared palette keeps the screenshot colours stable across transitions.
    palette_source = Image.new("RGB", (600 * 4, 240 * 2))
    for n, shot in enumerate(shots):
        palette_source.paste(shot.resize((600, 240)), ((n % 4) * 600, (n // 4) * 240))
    palette = palette_source.quantize(colors=256)
    indexed = [f.quantize(palette=palette, dither=Image.Dither.NONE) for f in frames]
    indexed[0].save(ROOT / "header-glitch.gif", save_all=True, append_images=indexed[1:],
                    duration=durations, loop=0, optimize=True, disposal=2)
    # The reduced-motion image still includes every source screenshot.
    poster = Image.new("RGB", SIZE, (19, 17, 23))
    for n, (name, _, centre) in enumerate(SOURCES):
        tile = ImageOps.fit(Image.open(ROOT / name).convert("RGB"), (298, 238),
                            method=Image.Resampling.LANCZOS, centering=centre)
        poster.paste(tile, ((n % 4) * 300 + 1, (n // 4) * 240 + 1))
    poster.save(ROOT / "header-still.jpg", quality=90, optimize=True)
    with Image.open(ROOT / "header-glitch.gif") as result:
        assert result.n_frames == 32 and result.size == SIZE
        assert sum(result.seek(n) or result.info["duration"] for n in range(result.n_frames)) == 18960
    print("Built 32 frames, eight screenshot crops, 18.96-second loop.")


if __name__ == "__main__":
    main()
