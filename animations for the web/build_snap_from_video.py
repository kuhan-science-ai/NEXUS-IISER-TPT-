import math
import os
import shutil
import subprocess
import numpy as np
from PIL import Image, ImageDraw
from collections import deque

WIDTH = 600
HEIGHT = 650
FPS = 30

TARGET_X = WIDTH / 2
TARGET_Y = 240  # Y position where gauntlet rests

# 1. Process and extract transparent frames 1 to 65 from the uploaded video
print("Extracting transparent frames from video...")
transparent_frames = []

for fi in range(1, 65):
    fpath = f'all_video_frames/f_{fi:04d}.png'
    im = Image.open(fpath).convert('RGB')
    arr = np.array(im)
    h, w, _ = arr.shape

    # Flood fill from borders to identify white background
    bg_mask = np.zeros((h, w), dtype=bool)
    visited = np.zeros((h, w), dtype=bool)
    q = deque()

    for x in range(w):
        q.append((0, x))
        q.append((h - 1, x))
        visited[0, x] = True
        visited[h - 1, x] = True
    for y in range(h):
        q.append((y, 0))
        q.append((y, w - 1))
        visited[y, 0] = True
        visited[y, w - 1] = True

    while q:
        y, x = q.popleft()
        c = arr[y, x].astype(int)
        if c[0] > 235 and c[1] > 235 and c[2] > 235:
            bg_mask[y, x] = True
            for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                    visited[ny, nx] = True
                    q.append((ny, nx))

    alpha = np.where(bg_mask, 0, 255).astype(np.uint8)

    # Soften outer boundary
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            if alpha[y, x] > 0 and bg_mask[y-1:y+2, x-1:x+2].any():
                b = arr[y, x].mean()
                if b > 210:
                    alpha[y, x] = int(255 * (1.0 - (b - 210) / 45))

    rgba = np.dstack([arr, alpha])
    # Upscale 3x with high quality LANCZOS for sharp display
    trans_im = Image.fromarray(rgba).resize((w * 3, h * 3), Image.Resampling.LANCZOS)
    transparent_frames.append(trans_im)

print(f"Processed {len(transparent_frames)} transparent frames.")

# Spritesheet dimensions
sw, sh = transparent_frames[0].size

# 2. Build complete animation timeline
# Total frames:
# Phase 1: Rise from bottom (frames 0 to 24 = 0.8s)
# Phase 2: Play snap video frames 1 to 64 (frames 25 to 88 = 2.1s)
# Phase 3: White screen flash at snap (frames 74 to 88)
# Phase 4: Stationary gauntlet holding pose (frames 89 to 115 = 0.9s)
TOTAL_FRAMES = 115

os.makedirs("temp_final_snap", exist_ok=True)
all_rendered_images = []

print(f"Compositing {TOTAL_FRAMES} frames...")

for frame in range(TOTAL_FRAMES):
    t = frame / FPS
    img = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img, "RGBA")

    # A. Calculate Position & Active Frame
    if frame < 25:
        # Phase 1: Rising from bottom into the screen
        rise_p = frame / 25
        # Cubic ease-out
        ease = 1.0 - math.pow(1.0 - rise_p, 3)
        cur_y = (HEIGHT + 80) - ((HEIGHT + 80) - TARGET_Y) * ease
        cur_sprite = transparent_frames[0]
    elif frame < 25 + len(transparent_frames):
        # Phase 2: Play snap animation from the video
        video_idx = frame - 25
        cur_y = TARGET_Y
        cur_sprite = transparent_frames[video_idx]
    else:
        # Phase 4: Stationary Gauntlet after the snap!
        cur_y = TARGET_Y
        cur_sprite = transparent_frames[-1]

    # B. Paste transparent gauntlet
    pos_x = int(TARGET_X - sw / 2)
    pos_y = int(cur_y)
    img.paste(cur_sprite, (pos_x, pos_y), cur_sprite)

    # C. Full-Screen White Flash at the Snap!
    # Snap happens at video frame ~49 (timeline frame 74)
    SNAP_TIMELINE_FRAME = 74
    FLASH_PEAK_FRAME = 76
    FLASH_END_FRAME = 89

    if SNAP_TIMELINE_FRAME <= frame <= FLASH_END_FRAME:
        if frame <= FLASH_PEAK_FRAME:
            f_ratio = (frame - SNAP_TIMELINE_FRAME) / max(1, FLASH_PEAK_FRAME - SNAP_TIMELINE_FRAME)
            f_alpha = int(255 * f_ratio)
        else:
            f_ratio = (frame - FLASH_PEAK_FRAME) / (FLASH_END_FRAME - FLASH_PEAK_FRAME)
            f_alpha = int(255 * math.pow(1.0 - f_ratio, 1.4))

        if f_alpha > 0:
            draw.rectangle([0, 0, WIDTH, HEIGHT], fill=(255, 255, 255, f_alpha))

    frame_path = f"temp_final_snap/frame_{frame:04d}.png"
    img.save(frame_path, "PNG")
    all_rendered_images.append(img)

print("Frames rendered. Encoding output formats...")

# 3. Extract and align snap audio from original video
# The snap audio starts around t=0.0s to 2.2s in the original video
# In our timeline, video frames start playing at frame 25 (0.833s)
subprocess.run([
    "ffmpeg", "-y",
    "-ss", "0.0", "-t", "2.5",
    "-i", r"C:/Users/kuhan/.gemini/antigravity/brain/51b17122-f69d-4e01-8ba2-1c4784dbd275/.user_uploaded/media_1793743840800_05f23336.mp4",
    "-vn", "-c:a", "libvorbis",
    "snap_sound.ogg"
], check=True)

# 4. Encode WebM with Alpha + Audio
webm_path = "infinity_snap.webm"
print(f"Encoding {webm_path} (Transparent VP9)...")
subprocess.run([
    "ffmpeg", "-y",
    "-framerate", str(FPS),
    "-i", "temp_final_snap/frame_%04d.png",
    "-itsoffset", "0.833",
    "-i", "snap_sound.ogg",
    "-c:v", "libvpx-vp9",
    "-pix_fmt", "yuva420p",
    "-b:v", "3M",
    "-auto-alt-ref", "0",
    "-c:a", "libopus",
    webm_path
], check=True)
print(f"Saved {webm_path}")

# 5. Encode 32-bit APNG
apng_path = "infinity_snap.png"
print(f"Saving {apng_path} (32-bit APNG)...")
all_rendered_images[0].save(
    apng_path,
    save_all=True,
    append_images=all_rendered_images[1:],
    duration=int(1000 / FPS),
    loop=0,
    optimize=True
)
print(f"Saved {apng_path}")

# 6. Encode Transparent GIF
gif_path = "infinity_snap.gif"
print(f"Encoding {gif_path}...")
subprocess.run([
    "ffmpeg", "-y",
    "-framerate", str(FPS),
    "-i", "temp_final_snap/frame_%04d.png",
    "-filter_complex", "[0:v] split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=000000 [p]; [b][p] paletteuse=alpha_threshold=128",
    gif_path
], check=True)
print(f"Saved {gif_path}")

# Clean up
shutil.rmtree("temp_final_snap", ignore_errors=True)
print("All transparent video and image formats generated successfully!")
