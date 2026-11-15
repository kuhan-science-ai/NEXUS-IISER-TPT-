"""Prepare transparent, cropped NEXUS brand animations from the supplied MP4s.

Requires ffmpeg/ffprobe, numpy, and Pillow in the conversion environment.
This only produces browser assets; none of those packages become frontend deps.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "frontend" / "public" / "media" / "brand"
FPS = 30
CANVAS = 1440

CLIPS = {
    "pink-nexus": (ROOT / "nexus symbol animation" / "NEXUS (neon pink).mp4", 3.0),
    "pink-nx": (ROOT / "nexus symbol animation" / "Nx (neon pink).mp4", 3.0),
    "soapy-nexus": (ROOT / "nexus symbol animation" / "NEXUS (soapy).mp4", 1.0),
    "soapy-nx": (ROOT / "nexus symbol animation" / "Nx (soapy).mp4", 1.0),
}
MATCHED_FRAME_COUNTS = {"pink-nexus": 535, "pink-nx": 535, "soapy-nexus": 300, "soapy-nx": 300}


def probe(source: Path) -> dict:
    result = subprocess.run(
        [
            "ffprobe", "-v", "error", "-select_streams", "v:0", "-count_frames",
            "-show_entries", "stream=width,height,avg_frame_rate,nb_read_frames,duration",
            "-of", "json", str(source),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)["streams"][0]


def decoded_frames(source: Path):
    command = [
        "ffmpeg", "-v", "error", "-i", str(source), "-an", "-sn", "-dn",
        "-vf", f"fps={FPS},scale={CANVAS}:{CANVAS}:flags=lanczos",
        "-pix_fmt", "rgb24", "-f", "rawvideo", "pipe:1",
    ]
    process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    frame_bytes = CANVAS * CANVAS * 3
    try:
        assert process.stdout is not None
        while data := process.stdout.read(frame_bytes):
            if len(data) != frame_bytes:
                raise RuntimeError(f"Incomplete decoded frame from {source}")
            yield np.frombuffer(data, dtype=np.uint8).reshape(CANVAS, CANVAS, 3)
    finally:
        if process.stdout:
            process.stdout.close()
        stderr = process.stderr.read().decode("utf-8", errors="replace") if process.stderr else ""
        status = process.wait()
        if status:
            raise RuntimeError(f"ffmpeg could not decode {source}: {stderr}")


def matte(frame: np.ndarray) -> np.ndarray:
    pixels = frame.astype(np.float32)
    luminance = pixels.mean(axis=2)
    chroma = pixels.max(axis=2) - pixels.min(axis=2)

    # Keep vivid logo colors and dark lettering/outlines. The baked checker is
    # neutral and bright; retaining neutral pixels would leave visible tiles.
    vivid = np.clip((chroma - 24.0) / 36.0, 0.0, 1.0)
    dark = np.clip((125.0 - luminance) / 35.0, 0.0, 1.0)
    return np.maximum(vivid, dark)


def encode(name: str, source: Path, intro_seconds: float) -> dict:
    if not source.exists():
        raise FileNotFoundError(source)
    metadata = probe(source)
    intro_frame = max(1, round(intro_seconds * FPS))

    left, top = CANVAS, CANVAS
    right = bottom = -1
    frame_count = 0
    for frame in decoded_frames(source):
        alpha = matte(frame)
        ys, xs = np.nonzero(alpha > 0.08)
        if xs.size:
            left = min(left, int(xs.min()))
            right = max(right, int(xs.max()))
            top = min(top, int(ys.min()))
            bottom = max(bottom, int(ys.max()))
        frame_count += 1

    if right < left or frame_count <= intro_frame + 2:
        raise RuntimeError(f"No usable animation or loop segment found in {source}")

    pad = max(6, round(max(right - left + 1, bottom - top + 1) * 0.055))
    left, top = max(0, left - pad), max(0, top - pad)
    right, bottom = min(CANVAS - 1, right + pad), min(CANVAS - 1, bottom + pad)
    width, height = right - left + 1, bottom - top + 1
    # VP9 alpha with 4:2:0 chroma needs even dimensions.
    width += width % 2
    height += height % 2
    right, bottom = min(CANVAS - 1, left + width - 1), min(CANVAS - 1, top + height - 1)
    width, height = right - left + 1, bottom - top + 1

    OUTPUT.mkdir(parents=True, exist_ok=True)
    output = OUTPUT / f"{name}.webm"
    with tempfile.TemporaryDirectory(prefix=f"nexus-{name}-") as temp_name:
        frames_dir = Path(temp_name)
        saved = 0
        for frame in decoded_frames(source):
            alpha = matte(frame)
            rgba = np.dstack((frame, np.rint(alpha * 255).astype(np.uint8)))
            image = Image.fromarray(rgba, mode="RGBA").crop((left, top, right + 1, bottom + 1))
            image.save(frames_dir / f"frame-{saved:05d}.png", optimize=False)
            saved += 1

        # Match each pair's timeline exactly when a source differs by a frame.
        target_frames = MATCHED_FRAME_COUNTS[name]
        if saved < target_frames:
            last_frame = frames_dir / f"frame-{saved - 1:05d}.png"
            while saved < target_frames:
                shutil.copyfile(last_frame, frames_dir / f"frame-{saved:05d}.png")
                saved += 1

        # The original forward clip supplies the one-time intro. The appended
        # reverse frames create a seamless ping-pong loop after that intro.
        for index in range(saved - 2, intro_frame - 1, -1):
            shutil.copyfile(
                frames_dir / f"frame-{index:05d}.png",
                frames_dir / f"frame-{saved:05d}.png",
            )
            saved += 1

        subprocess.run(
            [
                "ffmpeg", "-y", "-v", "error", "-framerate", str(FPS),
                "-i", str(frames_dir / "frame-%05d.png"), "-an",
                "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0",
                "-crf", "23", "-auto-alt-ref", "0", "-deadline", "good",
                "-cpu-used", "3", str(output),
            ],
            check=True,
        )

    return {
        "source": str(source.relative_to(ROOT)),
        "asset": str(output.relative_to(ROOT / "frontend" / "public")),
        "width": width,
        "height": height,
        "fps": FPS,
        "sourceFrames": frame_count,
        "matchedSourceFrames": MATCHED_FRAME_COUNTS[name],
        "loopStartSeconds": intro_frame / FPS,
        "durationSeconds": saved / FPS,
        "sourceDurationSeconds": float(metadata.get("duration", 0)),
        "bytes": output.stat().st_size,
    }


def main() -> None:
    results = {name: encode(name, source, intro) for name, (source, intro) in CLIPS.items()}
    manifest = OUTPUT / "brand-animations.json"
    with manifest.open("w", encoding="utf-8", newline="\n") as manifest_file:
        manifest_file.write(json.dumps(results, indent=2) + "\n")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
