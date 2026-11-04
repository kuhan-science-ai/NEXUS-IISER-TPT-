import math
import random
import numpy as np
from PIL import Image, ImageDraw
import subprocess
import os
import shutil

WIDTH = 800
HEIGHT = 800
FPS = 36
DURATION = 2.4  # seconds
TOTAL_FRAMES = int(FPS * DURATION)
CENTER_X = WIDTH / 2
CENTER_Y = HEIGHT / 2

random.seed(42)

# Particle types:
# 1. Shockwaves
# 2. Flash
# 3. Fireballs / Smoke
# 4. Flying debris / jagged rocks (tumbling)
# 5. Glowing sparks / embers

class Shockwave:
    def __init__(self, start_frame, max_radius, speed, color, max_line_width):
        self.start_frame = start_frame
        self.max_radius = max_radius
        self.speed = speed
        self.color = color  # (r, g, b)
        self.max_line_width = max_line_width

class Debris:
    def __init__(self):
        angle = random.uniform(0, 2 * math.pi)
        speed = random.uniform(4.5, 14.0)
        self.x = CENTER_X
        self.y = CENTER_Y
        self.vx = math.cos(angle) * speed
        self.vy = math.sin(angle) * speed - random.uniform(1.0, 3.5) # upward kick
        self.size = random.uniform(5, 14)
        self.rotation = random.uniform(0, 360)
        self.rot_speed = random.uniform(-18, 18)
        self.drag = random.uniform(0.965, 0.985)
        self.gravity = random.uniform(0.12, 0.22)
        # Jagged polygon points relative to center
        num_pts = random.randint(4, 7)
        self.pts = []
        for i in range(num_pts):
            a = i * (2 * math.pi / num_pts) + random.uniform(-0.3, 0.3)
            r = self.size * random.uniform(0.6, 1.3)
            self.pts.append((math.cos(a) * r, math.sin(a) * r))
        # Color: dark charcoal / molten rock
        is_molten = random.random() < 0.4
        if is_molten:
            self.color = (random.randint(220, 255), random.randint(100, 160), random.randint(20, 40))
        else:
            c = random.randint(35, 65)
            self.color = (c + 20, c + 10, c)
        self.trail = []

class FireParticle:
    def __init__(self):
        angle = random.uniform(0, 2 * math.pi)
        speed = random.uniform(2.5, 11.5)
        self.x = CENTER_X
        self.y = CENTER_Y
        self.vx = math.cos(angle) * speed
        self.vy = math.sin(angle) * speed - random.uniform(0.5, 2.0)
        self.size = random.uniform(18, 38)
        self.drag = random.uniform(0.93, 0.96)
        self.buoyancy = random.uniform(-0.06, -0.02)
        self.birth = random.randint(0, 4)
        self.lifespan = random.uniform(1.4, 2.2) * FPS
        self.age = 0

class Spark:
    def __init__(self):
        angle = random.uniform(0, 2 * math.pi)
        speed = random.uniform(8.0, 22.0) # very fast shooting sparks
        self.x = CENTER_X
        self.y = CENTER_Y
        self.vx = math.cos(angle) * speed
        self.vy = math.sin(angle) * speed - random.uniform(1.0, 4.0)
        self.size = random.uniform(2.0, 5.0)
        self.drag = random.uniform(0.955, 0.98)
        self.gravity = random.uniform(0.12, 0.25)
        self.birth = random.randint(0, 6)
        self.lifespan = random.uniform(1.2, 2.3) * FPS
        self.age = 0
        self.history = []

def generate_animation():
    os.makedirs("temp_frames", exist_ok=True)

    # Initialize actors
    shockwaves = [
        Shockwave(start_frame=0, max_radius=380, speed=16.0, color=(255, 200, 100), max_line_width=8),
        Shockwave(start_frame=3, max_radius=320, speed=12.0, color=(255, 130, 40), max_line_width=6),
        Shockwave(start_frame=8, max_radius=260, speed=9.0, color=(255, 80, 20), max_line_width=4),
    ]

    debris_list = [Debris() for _ in range(85)]
    fire_list = [FireParticle() for _ in range(120)]
    spark_list = [Spark() for _ in range(160)]

    frame_images = []

    print(f"Rendering {TOTAL_FRAMES} transparent frames...")

    for frame in range(TOTAL_FRAMES):
        t = frame / FPS
        # Create transparent RGBA image
        img = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img, "RGBA")

        # 1. Central Core Flash (t < 0.25s)
        if t < 0.28:
            flash_p = t / 0.28
            flash_radius = 180 * math.sin(flash_p * math.pi * 0.5)
            flash_alpha = int(255 * (1 - flash_p)**1.2)
            if flash_alpha > 0 and flash_radius > 1:
                # Core bright white/yellow glow
                draw.ellipse([
                    CENTER_X - flash_radius, CENTER_Y - flash_radius,
                    CENTER_X + flash_radius, CENTER_Y + flash_radius
                ], fill=(255, 250, 220, int(flash_alpha * 0.85)))
                # Hot center
                c_rad = flash_radius * 0.5
                draw.ellipse([
                    CENTER_X - c_rad, CENTER_Y - c_rad,
                    CENTER_X + c_rad, CENTER_Y + c_rad
                ], fill=(255, 255, 255, flash_alpha))

        # 2. Shockwaves
        for sw in shockwaves:
            if frame >= sw.start_frame:
                sf = frame - sw.start_frame
                radius = sf * sw.speed
                if radius < sw.max_radius:
                    prog = radius / sw.max_radius
                    alpha = int(255 * (1 - prog)**1.5)
                    lw = max(1, int(sw.max_line_width * (1 - prog * 0.7)))
                    if alpha > 0 and radius > 2:
                        color = sw.color + (alpha,)
                        draw.ellipse([
                            CENTER_X - radius, CENTER_Y - radius,
                            CENTER_X + radius, CENTER_Y + radius
                        ], outline=color, width=lw)

        # 3. Fireballs & Expanding Smoke Plumes
        for fp in fire_list:
            if frame < fp.birth:
                continue
            fp.age += 1
            if fp.age >= fp.lifespan:
                continue

            # Update physics
            fp.x += fp.vx
            fp.y += fp.vy
            fp.vx *= fp.drag
            fp.vy = fp.vy * fp.drag + fp.buoyancy

            life_p = fp.age / fp.lifespan
            # Expands over time
            cur_radius = fp.size * (0.8 + 2.2 * (life_p ** 0.7))
            # Alpha curves: quick fade in, lingering fade out
            if life_p < 0.1:
                alpha = int(240 * (life_p / 0.1))
            else:
                alpha = int(240 * (1 - (life_p - 0.1) / 0.9)**1.6)

            if alpha <= 0:
                continue

            # Color shift: white/yellow -> vivid orange -> dark red -> charcoal smoke
            if life_p < 0.2:
                r, g, b = 255, int(220 - life_p * 400), 40
            elif life_p < 0.5:
                p2 = (life_p - 0.2) / 0.3
                r = int(255 - p2 * 60)
                g = int(140 - p2 * 100)
                b = int(40 - p2 * 20)
            else:
                p3 = (life_p - 0.5) / 0.5
                c = int(80 * (1 - p3) + 30 * p3)
                r, g, b = c + 15, c, c

            draw.ellipse([
                fp.x - cur_radius, fp.y - cur_radius,
                fp.x + cur_radius, fp.y + cur_radius
            ], fill=(r, g, b, alpha))

        # 4. Jagged Debris Chunks (rock/shrapnel)
        for deb in debris_list:
            deb.x += deb.vx
            deb.y += deb.vy
            deb.vx *= deb.drag
            deb.vy = deb.vy * deb.drag + deb.gravity
            deb.rotation += deb.rot_speed

            # Fade out towards the end of duration (2.0s to 2.4s)
            if t > 1.8:
                deb_alpha = max(0, int(255 * (1 - (t - 1.8) / 0.6)))
            else:
                deb_alpha = 255

            if deb_alpha <= 0:
                continue

            # Rotate polygon
            rad = math.radians(deb.rotation)
            cos_a = math.cos(rad)
            sin_a = math.sin(rad)
            poly = []
            for px, py in deb.pts:
                rx = px * cos_a - py * sin_a + deb.x
                ry = px * sin_a + py * cos_a + deb.y
                poly.append((rx, ry))

            color_with_alpha = deb.color + (deb_alpha,)
            draw.polygon(poly, fill=color_with_alpha)

        # 5. Glowing High-Velocity Sparks & Embers
        for sp in spark_list:
            if frame < sp.birth:
                continue
            sp.age += 1
            if sp.age >= sp.lifespan:
                continue

            # Record history for streak trail
            sp.history.append((sp.x, sp.y))
            if len(sp.history) > 4:
                sp.history.pop(0)

            sp.x += sp.vx
            sp.y += sp.vy
            sp.vx *= sp.drag
            sp.vy = sp.vy * sp.drag + sp.gravity

            life_p = sp.age / sp.lifespan
            spark_alpha = int(255 * (1 - life_p)**1.4)
            if spark_alpha <= 0:
                continue

            # Spark trail line
            if len(sp.history) >= 2:
                for h_idx in range(len(sp.history) - 1):
                    p1 = sp.history[h_idx]
                    p2 = sp.history[h_idx + 1]
                    t_alpha = int(spark_alpha * ((h_idx + 1) / len(sp.history)) * 0.7)
                    draw.line([p1, p2], fill=(255, 200, 80, t_alpha), width=max(1, int(sp.size * 0.6)))

            # Spark head glow
            draw.ellipse([
                sp.x - sp.size, sp.y - sp.size,
                sp.x + sp.size, sp.y + sp.size
            ], fill=(255, 240, 180, spark_alpha))

        frame_path = f"temp_frames/frame_{frame:04d}.png"
        img.save(frame_path, "PNG")
        frame_images.append(img)

    print("Frames successfully rendered.")
    
    # 1. Output APNG (Animated PNG with 32-bit true alpha)
    apng_path = "explosion.png"
    print(f"Saving {apng_path} (32-bit alpha APNG)...")
    frame_duration_ms = int(1000 / FPS)
    frame_images[0].save(
        apng_path,
        save_all=True,
        append_images=frame_images[1:],
        duration=frame_duration_ms,
        loop=0,
        optimize=True
    )
    print(f"Saved {apng_path}")

    # 2. Output WebM with transparent VP9 video using ffmpeg
    webm_path = "explosion.webm"
    print(f"Encoding {webm_path} (VP9 transparent alpha video)...")
    ffmpeg_cmd = [
        "ffmpeg", "-y",
        "-framerate", str(FPS),
        "-i", "temp_frames/frame_%04d.png",
        "-c:v", "libvpx-vp9",
        "-pix_fmt", "yuva420p",
        "-b:v", "2M",
        "-auto-alt-ref", "0",
        webm_path
    ]
    subprocess.run(ffmpeg_cmd, check=True)
    print(f"Saved {webm_path}")

    # 3. Output transparent GIF
    gif_path = "explosion.gif"
    print(f"Encoding {gif_path}...")
    ffmpeg_gif_cmd = [
        "ffmpeg", "-y",
        "-framerate", str(FPS),
        "-i", "temp_frames/frame_%04d.png",
        "-filter_complex", "[0:v] split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=000000 [p]; [b][p] paletteuse=alpha_threshold=128",
        gif_path
    ]
    subprocess.run(ffmpeg_gif_cmd, check=True)
    print(f"Saved {gif_path}")

    # Clean up temp frames
    shutil.rmtree("temp_frames", ignore_errors=True)
    print("Done!")

if __name__ == "__main__":
    generate_animation()
