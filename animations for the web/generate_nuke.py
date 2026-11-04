import math
import random
import os
import shutil
import subprocess
from PIL import Image, ImageDraw

WIDTH = 800
HEIGHT = 900
FPS = 36
DURATION = 3.6  # seconds
TOTAL_FRAMES = int(FPS * DURATION)

IMPACT_TIME = 0.95  # seconds when bomb hits ground zero
IMPACT_FRAME = int(IMPACT_TIME * FPS)
GROUND_Y = 620
CENTER_X = WIDTH / 2

random.seed(1337)

class SmokePuff:
    def __init__(self, x, y, vx, vy, size, lifespan, is_stem=False):
        self.x = x
        self.y = y
        self.vx = vx
        self.vy = vy
        self.size = size
        self.initial_size = size
        self.lifespan = lifespan
        self.age = 0
        self.is_stem = is_stem
        self.color_seed = random.random()

class Shockwave:
    def __init__(self, start_frame, speed, max_radius, max_width, color):
        self.start_frame = start_frame
        self.speed = speed
        self.max_radius = max_radius
        self.max_width = max_width
        self.color = color

class FlyingDebris:
    def __init__(self):
        angle = random.uniform(-math.pi * 0.95, -math.pi * 0.05) # upward and sideways
        speed = random.uniform(8.0, 24.0)
        self.x = CENTER_X
        self.y = GROUND_Y
        self.vx = math.cos(angle) * speed
        self.vy = math.sin(angle) * speed
        self.size = random.uniform(3, 8)
        self.drag = random.uniform(0.96, 0.985)
        self.gravity = random.uniform(0.2, 0.35)
        self.lifespan = random.uniform(1.2, 2.3) * FPS
        self.age = 0
        self.color = (random.randint(220, 255), random.randint(120, 200), random.randint(30, 80))
        self.pts = []
        num_pts = random.randint(4, 6)
        for i in range(num_pts):
            a = i * (2 * math.pi / num_pts) + random.uniform(-0.3, 0.3)
            r = self.size * random.uniform(0.6, 1.3)
            self.pts.append((math.cos(a) * r, math.sin(a) * r))
        self.rotation = random.uniform(0, 360)
        self.rot_speed = random.uniform(-20, 20)

def draw_nuclear_bomb(draw, x, y, angle_rad=0):
    """Draws a detailed classic nuclear bomb (Fat Man / Little Boy hybrid silhouette)."""
    # Bomb dimensions
    length = 75
    width = 30
    
    # Create bomb surface with local coordinates
    # Nose points down (towards +Y)
    cos_a = math.cos(angle_rad)
    sin_a = math.sin(angle_rad)

    def rot(lx, ly):
        rx = lx * cos_a - ly * sin_a + x
        ry = lx * sin_a + ly * cos_a + y
        return (rx, ry)

    # 1. Tail fins (Stabilizers at top)
    fin_pts_left = [rot(-width * 0.4, -length * 0.4), rot(-width * 1.1, -length * 0.55), rot(-width * 0.9, -length * 0.25), rot(-width * 0.4, -length * 0.2)]
    fin_pts_right = [rot(width * 0.4, -length * 0.4), rot(width * 1.1, -length * 0.55), rot(width * 0.9, -length * 0.25), rot(width * 0.4, -length * 0.2)]
    fin_ring = [rot(-width * 0.8, -length * 0.52), rot(width * 0.8, -length * 0.52), rot(width * 0.7, -length * 0.47), rot(-width * 0.7, -length * 0.47)]

    draw.polygon(fin_pts_left, fill=(45, 52, 58, 255))
    draw.polygon(fin_pts_right, fill=(45, 52, 58, 255))
    draw.polygon(fin_ring, fill=(70, 80, 90, 255))

    # 2. Main body fuselage
    body_pts = [
        rot(-width * 0.45, -length * 0.35),
        rot(-width * 0.5, 0),
        rot(-width * 0.45, length * 0.25),
        rot(0, length * 0.52), # Nose tip
        rot(width * 0.45, length * 0.25),
        rot(width * 0.5, 0),
        rot(width * 0.45, -length * 0.35),
    ]
    draw.polygon(body_pts, fill=(55, 65, 60, 255))

    # 3. Yellow hazard stripe band near nose
    band_pts = [
        rot(-width * 0.46, length * 0.12),
        rot(-width * 0.42, length * 0.24),
        rot(width * 0.42, length * 0.24),
        rot(width * 0.46, length * 0.12),
    ]
    draw.polygon(band_pts, fill=(234, 179, 8, 255))

    # 4. Highlight reflection
    hl_pts = [
        rot(-width * 0.25, -length * 0.3),
        rot(-width * 0.28, length * 0.2),
        rot(-width * 0.15, length * 0.22),
        rot(-width * 0.15, -length * 0.3),
    ]
    draw.polygon(hl_pts, fill=(120, 140, 135, 180))


def render_all_frames():
    os.makedirs("temp_nuke_frames", exist_ok=True)

    # Initialize simulation objects
    shockwaves = [
        Shockwave(start_frame=IMPACT_FRAME, speed=22.0, max_radius=420, max_width=12, color=(255, 240, 200)),
        Shockwave(start_frame=IMPACT_FRAME + 2, speed=16.0, max_radius=360, max_width=8, color=(255, 170, 70)),
        Shockwave(start_frame=IMPACT_FRAME + 6, speed=10.0, max_radius=280, max_width=6, color=(255, 90, 20)),
    ]

    # Mushroom cloud components:
    # Stem particles (rush upwards into the column)
    stem_particles = []
    for _ in range(110):
        # Starts near impact point, shoots straight up with slight spread
        angle = random.uniform(-math.pi * 0.65, -math.pi * 0.35)
        speed = random.uniform(3.0, 9.0)
        vx = math.cos(angle) * speed * 0.35
        vy = math.sin(angle) * speed - random.uniform(2.0, 5.0)
        size = random.uniform(16, 32)
        lifespan = random.uniform(1.8, 2.5) * FPS
        stem_particles.append(SmokePuff(CENTER_X + random.uniform(-15, 15), GROUND_Y, vx, vy, size, lifespan, is_stem=True))

    # Mushroom cap particles (curl outwards into doughnut mushroom top)
    cap_particles = []
    for _ in range(140):
        # Starts slightly higher and curls out horizontally
        curl_dir = 1 if random.random() < 0.5 else -1
        vx = curl_dir * random.uniform(2.5, 7.5)
        vy = -random.uniform(3.5, 7.5)
        size = random.uniform(25, 45)
        lifespan = random.uniform(2.0, 2.6) * FPS
        cap_particles.append(SmokePuff(CENTER_X, GROUND_Y - 40, vx, vy, size, lifespan, is_stem=False))

    debris_list = [FlyingDebris() for _ in range(90)]

    frame_images = []
    print(f"Rendering {TOTAL_FRAMES} frames of falling nuclear bomb + flashbang...")

    for frame in range(TOTAL_FRAMES):
        t = frame / FPS
        img = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img, "RGBA")

        # ----------------------------------------------------
        # PHASE 1: Bomb Falling from the Sky (frame < IMPACT_FRAME)
        # ----------------------------------------------------
        if frame <= IMPACT_FRAME:
            # Quadratic acceleration down: y(t)
            drop_prog = frame / IMPACT_FRAME
            bomb_y = -80 + (GROUND_Y + 40 - (-80)) * (drop_prog ** 1.85)
            # Slight aerodynamic wobble/stabilization
            angle = math.sin(drop_prog * math.pi * 3) * 0.04

            # Subtle falling trail / air friction lines
            if drop_prog > 0.15:
                for trail_i in range(3):
                    tx = CENTER_X + (trail_i - 1) * 8
                    ty1 = bomb_y - 60 - random.uniform(10, 30)
                    ty2 = bomb_y - 20
                    draw.line([(tx, ty1), (tx, ty2)], fill=(255, 255, 255, int(120 * drop_prog)), width=2)

            draw_nuclear_bomb(draw, CENTER_X, bomb_y, angle)

        # ----------------------------------------------------
        # PHASE 2 & 3: FLASHBANG & NUCLEAR DETONATION
        # ----------------------------------------------------
        if frame >= IMPACT_FRAME:
            blast_frame = frame - IMPACT_FRAME
            blast_t = blast_frame / FPS

            # 1. FLASH BANG: Massive whiteout / blinding radial glow
            if blast_t < 0.65:
                # Instant 100% whiteout bloom then decaying
                flash_p = blast_t / 0.65
                flash_alpha = int(255 * (1 - flash_p)**1.4)
                
                # Blinding radial flare across the entire screen
                flash_rad = min(WIDTH, HEIGHT) * (0.8 + flash_p * 0.4)
                draw.ellipse([
                    CENTER_X - flash_rad, GROUND_Y - flash_rad,
                    CENTER_X + flash_rad, GROUND_Y + flash_rad
                ], fill=(255, 255, 255, min(255, int(flash_alpha * 0.95))))

                # Secondary golden warm halo
                halo_rad = flash_rad * 1.3
                draw.ellipse([
                    CENTER_X - halo_rad, GROUND_Y - halo_rad,
                    CENTER_X + halo_rad, GROUND_Y + halo_rad
                ], fill=(255, 220, 140, int(flash_alpha * 0.4)))

                # Blinding Rays of light bursting out
                num_rays = 16
                for r_idx in range(num_rays):
                    r_angle = (r_idx * (2 * math.pi / num_rays)) + blast_t * 0.5
                    ray_len = 500 * (1 - flash_p * 0.5)
                    rx = CENTER_X + math.cos(r_angle) * ray_len
                    ry = GROUND_Y + math.sin(r_angle) * ray_len
                    draw.line([(CENTER_X, GROUND_Y), (rx, ry)], fill=(255, 255, 240, int(flash_alpha * 0.6)), width=int(14 * (1 - flash_p)))

            # 2. Shockwave Blast Rings
            for sw in shockwaves:
                if frame >= sw.start_frame:
                    sf = frame - sw.start_frame
                    radius_x = sf * sw.speed
                    radius_y = radius_x * 0.65  # Elliptical ground reflection
                    if radius_x < sw.max_radius:
                        sw_p = radius_x / sw.max_radius
                        alpha = int(255 * (1 - sw_p)**1.6)
                        lw = max(1, int(sw.max_width * (1 - sw_p * 0.7)))
                        if alpha > 0:
                            draw.ellipse([
                                CENTER_X - radius_x, GROUND_Y - radius_y,
                                CENTER_X + radius_x, GROUND_Y + radius_y
                            ], outline=sw.color + (alpha,), width=lw)

            # 3. Ground Fire Skirt (Base ring expanding along ground)
            ground_prog = min(1.0, blast_t / 1.8)
            ground_radius_x = 240 * (ground_prog ** 0.6)
            ground_radius_y = ground_radius_x * 0.35
            ground_alpha = max(0, int(220 * (1 - ground_prog)**1.5))
            if ground_alpha > 0 and ground_radius_x > 2:
                draw.ellipse([
                    CENTER_X - ground_radius_x, GROUND_Y - ground_radius_y,
                    CENTER_X + ground_radius_x, GROUND_Y + ground_radius_y
                ], fill=(255, 120, 20, ground_alpha))

            # 4. Nuclear Stem (Rising Fire/Smoke Column)
            for sp in stem_particles:
                sp.age += 1
                if sp.age >= sp.lifespan:
                    continue

                sp.x += sp.vx
                sp.y += sp.vy
                sp.vx *= 0.94
                sp.vy = sp.vy * 0.95 - 0.08  # Strong thermal updraft
                
                prog = sp.age / sp.lifespan
                cur_size = sp.initial_size * (0.8 + 2.0 * (prog ** 0.6))
                
                if prog < 0.1:
                    alpha = int(240 * (prog / 0.1))
                else:
                    alpha = int(240 * (1 - (prog - 0.1) / 0.9)**1.6)

                if alpha <= 0:
                    continue

                # Thermal color evolution: brilliant yellow/white -> orange -> deep red -> dark ash
                if prog < 0.2:
                    r, g, b = 255, int(240 - prog * 300), 60
                elif prog < 0.5:
                    p2 = (prog - 0.2) / 0.3
                    r = int(255 - p2 * 50)
                    g = int(140 - p2 * 90)
                    b = int(40 - p2 * 20)
                else:
                    p3 = (prog - 0.5) / 0.5
                    c = int(75 * (1 - p3) + 30 * p3)
                    r, g, b = c + 15, c, c

                draw.ellipse([
                    sp.x - cur_size, sp.y - cur_size,
                    sp.x + cur_size, sp.y + cur_size
                ], fill=(r, g, b, alpha))

            # 5. Mushroom Cloud Cap (Rolling toroidal mushroom head)
            for cp in cap_particles:
                cp.age += 1
                if cp.age >= cp.lifespan:
                    continue

                cp.x += cp.vx
                cp.y += cp.vy
                cp.vx *= 0.97
                cp.vy = cp.vy * 0.96 - 0.04  # Upward buoyancy

                # Curl downwards at edges (doughnut effect)
                dist_from_center = abs(cp.x - CENTER_X)
                if dist_from_center > 70:
                    cp.vy += 0.12

                prog = cp.age / cp.lifespan
                cur_size = cp.size * (0.7 + 2.4 * (prog ** 0.65))

                if prog < 0.12:
                    alpha = int(255 * (prog / 0.12))
                else:
                    alpha = int(255 * (1 - (prog - 0.12) / 0.88)**1.5)

                if alpha <= 0:
                    continue

                # Color: Fire turns to massive billowing dark smoke cap
                if prog < 0.18:
                    r, g, b = 255, 230, 100
                elif prog < 0.45:
                    p2 = (prog - 0.18) / 0.27
                    r = int(255 - p2 * 70)
                    g = int(130 - p2 * 80)
                    b = int(30)
                else:
                    p3 = (prog - 0.45) / 0.55
                    c = int(70 * (1 - p3) + 35 * p3)
                    r, g, b = c + 20, c + 5, c

                draw.ellipse([
                    cp.x - cur_size, cp.y - cur_size,
                    cp.x + cur_size, cp.y + cur_size
                ], fill=(r, g, b, alpha))

            # 6. Flying Molten Debris & Sparks
            for deb in debris_list:
                deb.age += 1
                if deb.age >= deb.lifespan:
                    continue

                deb.x += deb.vx
                deb.y += deb.vy
                deb.vx *= deb.drag
                deb.vy = deb.vy * deb.drag + deb.gravity
                deb.rotation += deb.rot_speed

                prog = deb.age / deb.lifespan
                alpha = int(255 * (1 - prog)**1.3)
                if alpha <= 0:
                    continue

                rad = math.radians(deb.rotation)
                cos_a = math.cos(rad)
                sin_a = math.sin(rad)
                poly = []
                for px, py in deb.pts:
                    rx = px * cos_a - py * sin_a + deb.x
                    ry = px * sin_a + py * cos_a + deb.y
                    poly.append((rx, ry))

                draw.polygon(poly, fill=deb.color + (alpha,))

        frame_path = f"temp_nuke_frames/frame_{frame:04d}.png"
        img.save(frame_path, "PNG")
        frame_images.append(img)

    print("Frames successfully rendered.")

    # 1. Encode WebM with Alpha (VP9)
    webm_path = "nuke_explosion.webm"
    print(f"Encoding {webm_path} (Transparent VP9)...")
    subprocess.run([
        "ffmpeg", "-y",
        "-framerate", str(FPS),
        "-i", "temp_nuke_frames/frame_%04d.png",
        "-c:v", "libvpx-vp9",
        "-pix_fmt", "yuva420p",
        "-b:v", "2.5M",
        "-auto-alt-ref", "0",
        webm_path
    ], check=True)
    print(f"Saved {webm_path}")

    # 2. Encode 32-bit APNG (Animated PNG with true alpha)
    apng_path = "nuke_explosion.png"
    print(f"Saving {apng_path} (32-bit APNG)...")
    frame_images[0].save(
        apng_path,
        save_all=True,
        append_images=frame_images[1:],
        duration=int(1000 / FPS),
        loop=0,
        optimize=True
    )
    print(f"Saved {apng_path}")

    # 3. Encode Transparent GIF
    gif_path = "nuke_explosion.gif"
    print(f"Encoding {gif_path}...")
    subprocess.run([
        "ffmpeg", "-y",
        "-framerate", str(FPS),
        "-i", "temp_nuke_frames/frame_%04d.png",
        "-filter_complex", "[0:v] split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=000000 [p]; [b][p] paletteuse=alpha_threshold=128",
        gif_path
    ], check=True)
    print(f"Saved {gif_path}")

    # Clean up temporary frames
    shutil.rmtree("temp_nuke_frames", ignore_errors=True)
    print("All nuclear explosion assets generated successfully!")

if __name__ == "__main__":
    render_all_frames()
