"""Prepare the companion's three actions and seamless transparent idle loop.

Requires ffmpeg/ffprobe, Pillow, numpy, and rembg with the u2netp model in
the local conversion environment. These are asset-preparation tools only; the
browser uses the generated VP9 alpha WebM files and gains no new dependencies.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from rembg import new_session, remove


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assistants waifus and hunsbandos"
OUTPUT = ROOT / "frontend" / "public" / "assistants" / "waifu-2"
FPS = 30
ACTION_CROP = (1800, 1850, 1020, 200)  # width, height, x, y in the 3840x2160 sources
ACTION_SCALE = (900, 925)
ACTION_CLIPS = {
    "ani-1": SOURCE / "ani-1.mov",
    "ani-2": SOURCE / "ani-2.mov",
    "ani-3": SOURCE / "ani-3.mov",
}
IDLE_SOURCE = SOURCE / "default ani.mp4"
IDLE_LOOP_END_SECONDS = 8.6  # Excludes the source's end fade to black.


def encode_png_sequence(folder: Path, output: Path) -> None:
    subprocess.run(
        [
            "ffmpeg", "-y", "-v", "error", "-framerate", str(FPS), "-start_number", "0",
            "-i", str(folder / "frame-%05d.png"), "-an",
            "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0",
            "-crf", "30", "-auto-alt-ref", "0", "-deadline", "good",
            "-cpu-used", "2", str(output),
        ],
        check=True,
    )


def extract_frames(source: Path, folder: Path, filters: str | None = None) -> list[Path]:
    folder.mkdir(parents=True, exist_ok=True)
    command = ["ffmpeg", "-y", "-v", "error", "-i", str(source), "-an"]
    if filters:
        command += ["-vf", filters]
    command += ["-r", str(FPS), str(folder / "frame-%05d.png")]
    subprocess.run(command, check=True)
    return sorted(folder.glob("frame-*.png"))


def matte_action_clip(source: Path, name: str, session, work: Path) -> dict:
    crop_w, crop_h, crop_x, crop_y = ACTION_CROP
    scale_w, scale_h = ACTION_SCALE
    raw = work / f"{name}-raw"
    processed = work / f"{name}-processed"
    cropped = work / f"{name}-cropped"
    filter_graph = (
        f"fps={FPS},crop={crop_w}:{crop_h}:{crop_x}:{crop_y},"
        f"scale={scale_w}:{scale_h}:flags=lanczos"
    )
    raw_frames = extract_frames(source, raw, filter_graph)
    processed.mkdir(parents=True, exist_ok=True)

    left, top = scale_w, scale_h
    right = bottom = -1
    for index, frame_path in enumerate(raw_frames):
        image = Image.open(frame_path).convert("RGB")
        rgba = remove(image, session=session).convert("RGBA")
        alpha = rgba.getchannel("A").filter(ImageFilter.GaussianBlur(0.45))
        rgba.putalpha(alpha)
        alpha_array = np.asarray(alpha) > 64
        columns = np.flatnonzero(alpha_array.sum(axis=0) >= 3)
        rows = np.flatnonzero(alpha_array.sum(axis=1) >= 3)
        if columns.size and rows.size:
            left = min(left, int(columns[0]))
            right = max(right, int(columns[-1]))
            top = min(top, int(rows[0]))
            bottom = max(bottom, int(rows[-1]))
        rgba.save(processed / f"frame-{index:05d}.png", optimize=False)
        if (index + 1) % 24 == 0:
            print(f"matted {name}: {index + 1}/{len(raw_frames)} frames", flush=True)

    if right < left or bottom < top:
        raise RuntimeError(f"No character matte was found in {source}")

    padding = max(24, round(max(right - left + 1, bottom - top + 1) * 0.14))
    bounds = (
        max(0, left - padding),
        max(0, top - padding),
        min(scale_w, right + padding + 1),
        min(scale_h, bottom + padding + 1),
    )
    crop_width = bounds[2] - bounds[0]
    crop_height = bounds[3] - bounds[1]
    if crop_width % 2:
        bounds = (bounds[0], bounds[1], bounds[2] - 1, bounds[3])
    if crop_height % 2:
        bounds = (bounds[0], bounds[1], bounds[2], bounds[3] - 1)

    cropped.mkdir(parents=True, exist_ok=True)
    for index in range(len(raw_frames)):
        with Image.open(processed / f"frame-{index:05d}.png") as image:
            image.crop(bounds).save(cropped / f"frame-{index:05d}.png", optimize=False)

    output = OUTPUT / f"{name}.webm"
    encode_png_sequence(cropped, output)
    return {
        "source": str(source.relative_to(ROOT)),
        "asset": str(output.relative_to(ROOT / "frontend" / "public")),
        "sourceFrames": len(raw_frames),
        "fps": FPS,
        "crop": list(bounds),
        "dimensions": [crop_width - crop_width % 2, crop_height - crop_height % 2],
        "bytes": output.stat().st_size,
    }


def matte_idle_clip(source: Path, work: Path) -> dict:
    raw = work / "idle-raw"
    processed = work / "idle-processed"
    raw_frames = extract_frames(source, raw)
    if not raw_frames:
        raise RuntimeError(f"No frames were decoded from {source}")

    first = np.asarray(Image.open(raw_frames[0]).convert("RGB"), dtype=np.float32)
    corner_samples = np.concatenate(
        [first[:24, :24].reshape(-1, 3), first[:24, -24:].reshape(-1, 3),
         first[-24:, :24].reshape(-1, 3), first[-24:, -24:].reshape(-1, 3)]
    )
    background = np.median(corner_samples, axis=0)
    processed.mkdir(parents=True, exist_ok=True)
    loop_end = min(len(raw_frames) - 1, round(IDLE_LOOP_END_SECONDS * FPS))
    loop_frames = raw_frames[: loop_end + 1]

    for index, frame_path in enumerate(loop_frames):
        pixels = np.asarray(Image.open(frame_path).convert("RGB"), dtype=np.float32)
        distance = np.sqrt(np.sum((pixels - background) ** 2, axis=2))
        alpha = np.clip((distance - 4.0) / 22.0, 0.0, 1.0)
        # Unmix partially transparent edges from the navy source backdrop.
        denominator = np.maximum(alpha[..., None], 0.02)
        foreground = (pixels - background * (1.0 - alpha[..., None])) / denominator
        foreground = np.clip(foreground, 0.0, 255.0)
        foreground[alpha < 0.02] = 0
        rgba = np.dstack((np.rint(foreground).astype(np.uint8), np.rint(alpha * 255).astype(np.uint8)))
        Image.fromarray(rgba, mode="RGBA").save(processed / f"frame-{index:05d}.png", optimize=False)

    # Play to the last active frame, then play back to the beginning. The
    # neighboring frames at each loop boundary match, so the cyclic clip does
    # not jump through the source's final fade-to-black.
    saved = len(loop_frames)
    for index in range(saved - 2, 0, -1):
        shutil.copyfile(processed / f"frame-{index:05d}.png", processed / f"frame-{saved:05d}.png")
        saved += 1

    output = OUTPUT / "default-ani.webm"
    encode_png_sequence(processed, output)
    return {
        "source": str(source.relative_to(ROOT)),
        "asset": str(output.relative_to(ROOT / "frontend" / "public")),
        "fps": FPS,
        "sourceFrames": len(raw_frames),
        "loopEndSeconds": loop_end / FPS,
        "playbackFrames": saved,
        "backgroundRgb": [round(float(channel)) for channel in background],
        "bytes": output.stat().st_size,
    }


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="nexus-assistant-assets-") as temp_name:
        work = Path(temp_name)
        session = new_session("u2netp")
        actions = {
            name: matte_action_clip(source, name, session, work)
            for name, source in ACTION_CLIPS.items()
        }
        idle = matte_idle_clip(IDLE_SOURCE, work)
    manifest = {"actions": actions, "idle": idle}
    with (OUTPUT / "animations.json").open("w", encoding="utf-8", newline="\n") as output_file:
        output_file.write(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
