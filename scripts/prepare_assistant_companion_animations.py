"""Prepare consistently framed, temporally stable companion animations.

Requires ffmpeg/ffprobe, Pillow, numpy, scipy, and rembg with the u2netp model
cached in the local conversion environment. These are asset-preparation tools;
the browser only uses the generated VP9 alpha WebM files.
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
from scipy import ndimage


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assistants waifus and hunsbandos"
OUTPUT = ROOT / "frontend" / "public" / "assistants" / "waifu-2"
FPS = 30
ACTION_CROP = (1800, 1850, 1020, 200)  # width, height, x, y in the 3840x2160 sources
ACTION_SCALE = (900, 925)
OUTPUT_SIZE = (900, 1328)  # Matches the companion's 210x310 display ratio.
TARGET_SUBJECT_HEIGHT = 1036
BOTTOM_MARGIN = 48
SIDE_MARGIN = 36
ALPHA_THRESHOLD = 32
MATTE_CORE_THRESHOLD = 192
IDLE_LOOP_END_SECONDS = 8.6  # Excludes the source's end fade to black.
ACTION_CLIPS = {
    "ani-1": SOURCE / "ani-1.mov",
    "ani-2": SOURCE / "ani-2.mov",
    "ani-3": SOURCE / "ani-3.mov",
}
IDLE_SOURCE = SOURCE / "default ani.mp4"


def encode_png_sequence(folder: Path, output: Path) -> None:
    subprocess.run(
        [
            "ffmpeg", "-y", "-v", "error", "-framerate", str(FPS), "-start_number", "0",
            "-i", str(folder / "frame-%05d.png"), "-an",
            "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0",
            "-crf", "29", "-auto-alt-ref", "0", "-deadline", "good",
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


def clean_matte(alpha: Image.Image, rgb: Image.Image, background: tuple[float, float, float]) -> np.ndarray:
    """Drop watermark edges, close shirt pinholes, and preserve soft character edges."""
    values = np.asarray(alpha, dtype=np.uint8)
    foreground = values >= MATTE_CORE_THRESHOLD
    labels, count = ndimage.label(foreground, structure=np.ones((3, 3), dtype=np.uint8))
    if count == 0:
        return np.zeros_like(values)

    areas = np.bincount(labels.ravel())
    areas[0] = 0
    main = labels == int(np.argmax(areas))
    filled = ndimage.binary_fill_holes(ndimage.binary_closing(main, structure=np.ones((3, 3), dtype=bool)))
    # Allow soft edges and thin pink features near the confident silhouette,
    # but reject low-contrast gray watermark strokes beyond the clothing edge.
    allowed = ndimage.binary_dilation(filled, iterations=16)
    colors = np.asarray(rgb, dtype=np.int16)
    chroma = colors.max(axis=2) - colors.min(axis=2)
    bg_distance = np.sqrt(np.sum((colors.astype(np.float32) - np.asarray(background, dtype=np.float32)) ** 2, axis=2))
    near_silhouette = ndimage.distance_transform_edt(~filled) <= 3
    real_edge_color = (chroma > 14) | (bg_distance > 130)
    result = np.where(allowed & (near_silhouette | real_edge_color) & (values >= 24), values, 0).astype(np.uint8)
    # The high-confidence interior stays solid to prevent the pale shirt from
    # showing pinholes when model confidence wavers from frame to frame.
    core = ndimage.binary_erosion(filled, structure=np.ones((3, 3), dtype=bool))
    result[core] = 255
    return np.asarray(Image.fromarray(result, mode="L").filter(ImageFilter.GaussianBlur(0.38)))


def stable_mattes(
    raw_frames: list[Path], folder: Path, session, background: tuple[float, float, float]
) -> tuple[list[Path], tuple[int, int, int, int]]:
    """Segment frames, temporally median-filter their mattes, and measure bounds."""
    folder.mkdir(parents=True, exist_ok=True)
    masks: list[np.ndarray] = []
    for index, frame_path in enumerate(raw_frames):
        image = Image.open(frame_path).convert("RGB")
        rgba = remove(image, session=session).convert("RGBA")
        masks.append(clean_matte(rgba.getchannel("A"), image, background))
        if (index + 1) % 24 == 0 or index + 1 == len(raw_frames):
            print(f"matted frames: {index + 1}/{len(raw_frames)}", flush=True)

    matte_paths: list[Path] = []
    left, top = 10**9, 10**9
    right = bottom = -1
    zero = np.zeros_like(masks[0])
    for index, current in enumerate(masks):
        previous = masks[index - 1] if index else current
        following = masks[index + 1] if index + 1 < len(masks) else current
        temporal = np.median(np.stack((previous, current, following)), axis=0).astype(np.uint8)
        ys, xs = np.nonzero(temporal >= ALPHA_THRESHOLD)
        if xs.size:
            left, right = min(left, int(xs.min())), max(right, int(xs.max()))
            top, bottom = min(top, int(ys.min())), max(bottom, int(ys.max()))
        path = folder / f"frame-{index:05d}.png"
        Image.fromarray(temporal, mode="L").save(path, optimize=False)
        matte_paths.append(path)

    if right < left or bottom < top:
        raise RuntimeError("No character matte was found in the animation frames")
    return matte_paths, (left, top, right + 1, bottom + 1)


def sample_background(image_path: Path) -> tuple[float, float, float]:
    image = np.asarray(Image.open(image_path).convert("RGB"), dtype=np.uint8)
    corner = 24
    samples = np.concatenate((
        image[:corner, :corner].reshape(-1, 3), image[:corner, -corner:].reshape(-1, 3),
        image[-corner:, :corner].reshape(-1, 3), image[-corner:, -corner:].reshape(-1, 3),
    ))
    return tuple(float(channel) for channel in np.median(samples, axis=0))


def write_normalized_frames(
    raw_frames: list[Path], matte_paths: list[Path], bounds: tuple[int, int, int, int],
    folder: Path, background: tuple[float, float, float],
) -> dict:
    """Crop only transparent source margins and fit the full pose into one shared canvas."""
    left, top, right, bottom = bounds
    raw_width, raw_height = Image.open(raw_frames[0]).size
    crop_pad = max(8, round((bottom - top) * 0.025))
    crop_left, crop_top = max(0, left - crop_pad), max(0, top - crop_pad)
    crop_right, crop_bottom = min(raw_width, right + crop_pad), min(raw_height, bottom + crop_pad)

    out_width, out_height = OUTPUT_SIZE
    subject_width, subject_height = right - left, bottom - top
    scale = min(TARGET_SUBJECT_HEIGHT / subject_height, (out_width - SIDE_MARGIN * 2) / subject_width)
    scaled_subject_width, scaled_subject_height = subject_width * scale, subject_height * scale
    if scaled_subject_height < TARGET_SUBJECT_HEIGHT * 0.985:
        print(f"note: frame width constrained subject height to {scaled_subject_height:.1f}px", flush=True)
    subject_center_x = (left + right) / 2
    destination_x = round(out_width / 2 - (subject_center_x - crop_left) * scale)
    destination_y = round(out_height - BOTTOM_MARGIN - (bottom - crop_top) * scale)
    folder.mkdir(parents=True, exist_ok=True)

    for index, (frame_path, matte_path) in enumerate(zip(raw_frames, matte_paths)):
        rgb = np.asarray(Image.open(frame_path).convert("RGB"), dtype=np.float32)
        alpha = np.asarray(Image.open(matte_path).convert("L"), dtype=np.float32) / 255.0
        bg = np.asarray(background, dtype=np.float32).reshape(1, 1, 3)
        safe_alpha = np.maximum(alpha[..., None], 0.12)
        foreground = np.clip((rgb - bg * (1.0 - alpha[..., None])) / safe_alpha, 0, 255)
        foreground[alpha < 0.12] = 0
        rgba = np.dstack((np.rint(foreground).astype(np.uint8), np.rint(alpha * 255).astype(np.uint8)))
        image = Image.fromarray(rgba, mode="RGBA").crop((crop_left, crop_top, crop_right, crop_bottom))
        resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", OUTPUT_SIZE, (0, 0, 0, 0))
        canvas.alpha_composite(resized, (destination_x, destination_y))
        canvas.save(folder / f"frame-{index:05d}.png", optimize=False)

    return {
        "sourceBounds": [left, top, right, bottom],
        "sourceSubjectSize": [subject_width, subject_height],
        "normalizedSubjectHeight": round(scaled_subject_height),
        "canvas": list(OUTPUT_SIZE),
        "scale": round(scale, 4),
    }


def prepare_clip(source: Path, name: str, session, work: Path, *, idle: bool = False) -> dict:
    raw = work / f"{name}-raw"
    matte_dir = work / f"{name}-matte"
    output_frames = work / f"{name}-normalized"
    if idle:
        raw_frames = extract_frames(source, raw)
        loop_end = min(len(raw_frames) - 1, round(IDLE_LOOP_END_SECONDS * FPS))
        raw_frames = raw_frames[:loop_end + 1]
    else:
        crop_w, crop_h, crop_x, crop_y = ACTION_CROP
        scale_w, scale_h = ACTION_SCALE
        filters = f"fps={FPS},crop={crop_w}:{crop_h}:{crop_x}:{crop_y},scale={scale_w}:{scale_h}:flags=lanczos"
        raw_frames = extract_frames(source, raw, filters)
        loop_end = None
    if not raw_frames:
        raise RuntimeError(f"No frames were decoded from {source}")

    background = sample_background(raw_frames[0])
    matte_paths, bounds = stable_mattes(raw_frames, matte_dir, session, background)
    normalized = write_normalized_frames(raw_frames, matte_paths, bounds, output_frames, background)
    if idle:
        saved = len(raw_frames)
        for index in range(saved - 2, 0, -1):
            shutil.copyfile(output_frames / f"frame-{index:05d}.png", output_frames / f"frame-{saved:05d}.png")
            saved += 1

    asset_name = "default-ani" if idle else name
    output = OUTPUT / f"{asset_name}.webm"
    encode_png_sequence(output_frames, output)
    result = {
        "source": str(source.relative_to(ROOT)),
        "asset": str(output.relative_to(ROOT / "frontend" / "public")),
        "sourceFrames": len(raw_frames),
        "fps": FPS,
        "backgroundRgb": [round(value) for value in background],
        "bytes": output.stat().st_size,
        **normalized,
    }
    if idle:
        result.update({"loopEndSeconds": loop_end / FPS, "playbackFrames": saved})
    return result


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="nexus-assistant-assets-") as temp_name:
        work = Path(temp_name)
        session = new_session("u2netp")
        actions = {
            name: prepare_clip(source, name, session, work)
            for name, source in ACTION_CLIPS.items()
        }
        idle = prepare_clip(IDLE_SOURCE, "idle", session, work, idle=True)
    manifest = {"actions": actions, "idle": idle}
    with (OUTPUT / "animations.json").open("w", encoding="utf-8", newline="\n") as output_file:
        output_file.write(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
