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

IMPACT_TIME = 0.95  # seconds when bomb hits ground
IMPACT_FRAME = int(IMPACT_TIME * FPS)

# Smoke formation time: 0.95s to 1.35s
# Entire screen flashes AFTER smoke is formed: at t = 1.4s
FLASH_START_TIME = 1.35
FLASH_START_FRAME = int(FLASH_START_TIME * FPS)
FLASH_PEAK_FRAME = FLASH_START_FRAME + 2
FLASH_END_FRAME = FLASH_START_FRAME + int(0.65 * FPS) # lasts ~0.65s

GROUND_Y = 650
CENTER_X = WIDTH / 2

random.seed(2026)

# -------------------------------------------------------------
# FAT NUCLEAR BOMB DRAWING WITH RADIATION SYMBOL
# -------------------------------------------------------------
def draw_fat_nuke_bomb(draw, x, y, angle_rad=0):
    """Draws a bulbous, fat-nosed nuclear bomb (Fat Man inspired) with a sharp radiation trefoil symbol."""
    cos_a = math.cos(angle_rad)
    sin_a = math.sin(angle_rad)

    def rot(lx, ly):
        rx = lx * cos_a - ly * sin_a + x
        ry = lx * sin_a + ly * cos_a + y
        return (rx, ry)

    # Scale: chubby teardrop
    bw = 36  # half-width (total width 72)
    bl = 52  # half-length (total length 104)

    # 1. Boxy Tail Fins (Rear stabilizer assembly)
    fin_w = bw * 1.05
    fin_top = -bl * 0.95
    fin_bot = -bl * 0.45

    # Tail box struts
    box_pts = [rot(-fin_w, fin_top), rot(fin_w, fin_top), rot(fin_w, fin_top + 10), rot(-fin_w, fin_top + 10)]
    draw.polygon(box_pts, fill=(40, 48, 45, 255))

    # Left & Right fin wings
    fin_l = [rot(-bw * 0.4, fin_bot), rot(-fin_w, fin_top), rot(-fin_w * 0.85, fin_top), rot(-bw * 0.2, fin_bot)]
    fin_r = [rot(bw * 0.4, fin_bot), rot(fin_w, fin_top), rot(fin_w * 0.85, fin_top), rot(bw * 0.2, fin_bot)]
    draw.polygon(fin_l, fill=(35, 42, 38, 255))
    draw.polygon(fin_r, fill=(35, 42, 38, 255))

    # 2. Bulbous Chubby Fuselage (Teardrop contour with fat nose)
    body_poly = []
    # Right side down to nose
    steps = 20
    for i in range(steps + 1):
        t_param = i / steps
        # Y goes from -bl * 0.6 to +bl * 0.85
        cur_y = -bl * 0.55 + (bl * 1.45) * t_param
        # Teardrop fatness formula: wide belly, bulbous dome nose
        if t_param < 0.35:
            # tapering to tail
            w_factor = 0.55 + 0.45 * math.sin(t_param / 0.35 * (math.pi / 2))
        elif t_param < 0.8:
            # max fat belly
            w_factor = 1.0 + 0.08 * math.sin((t_param - 0.35) / 0.45 * math.pi)
        else:
            # blunt round nose dome
            sub_t = (t_param - 0.8) / 0.2
            w_factor = 1.05 * math.sqrt(max(0, 1.0 - sub_t * sub_t))
        
        cur_w = bw * w_factor
        body_poly.append(rot(cur_w, cur_y))

    # Left side back up to tail
    for i in range(steps, -1, -1):
        t_param = i / steps
        cur_y = -bl * 0.55 + (bl * 1.45) * t_param
        if t_param < 0.35:
            w_factor = 0.55 + 0.45 * math.sin(t_param / 0.35 * (math.pi / 2))
        elif t_param < 0.8:
            w_factor = 1.0 + 0.08 * math.sin((t_param - 0.35) / 0.45 * math.pi)
        else:
            sub_t = (t_param - 0.8) / 0.2
            w_factor = 1.05 * math.sqrt(max(0, 1.0 - sub_t * sub_t))
        cur_w = -bw * w_factor
        body_poly.append(rot(cur_w, cur_y))

    # Base fuselage color: Military Dark Olive Drab
    draw.polygon(body_poly, fill=(58, 68, 54, 255))

    # 3. Metallic 3D Highlight curve along the side
    hl_poly = []
    for i in range(4, steps - 3):
        t_param = i / steps
        cur_y = -bl * 0.55 + (bl * 1.45) * t_param
        w_factor = 1.0 + 0.08 * math.sin((t_param - 0.35) / 0.45 * math.pi) if t_param >= 0.35 else 0.8
        hl_poly.append(rot(-bw * w_factor * 0.65, cur_y))
    for i in range(steps - 4, 3, -1):
        t_param = i / steps
        cur_y = -bl * 0.55 + (bl * 1.45) * t_param
        w_factor = 1.0 + 0.08 * math.sin((t_param - 0.35) / 0.45 * math.pi) if t_param >= 0.35 else 0.8
        hl_poly.append(rot(-bw * w_factor * 0.45, cur_y))
    if hl_poly:
        draw.polygon(hl_poly, fill=(105, 122, 100, 200))

    # 4. Nuclear Radiation Trefoil Badge (☢) in the center of the belly
    badge_lx = 0
    badge_ly = bl * 0.1
    badge_rad = 17

    # Center circle for the badge (Yellow warning disk)
    badge_center = rot(badge_lx, badge_ly)
    draw.ellipse([
        badge_center[0] - badge_rad, badge_center[1] - badge_rad,
        badge_center[0] + badge_rad, badge_center[1] + badge_rad
    ], fill=(245, 190, 11, 255), outline=(20, 25, 22, 255), width=2)

    # 3 Black fan blades (60 degrees each, spaced 120 degrees apart)
    for b_idx in range(3):
        blade_angle = angle_rad + (b_idx * 2 * math.pi / 3) - math.pi / 2
        blade_pts = [badge_center]
        # arc points
        for arc_s in range(7):
            sub_a = blade_angle - 0.45 + (0.9 * arc_s / 6)
            bx = badge_center[0] + math.cos(sub_a) * (badge_rad * 0.78)
            by = badge_center[1] + math.sin(sub_a) * (badge_rad * 0.78)
            blade_pts.append((bx, by))
        draw.polygon(blade_pts, fill=(20, 24, 22, 255))

    # Yellow inner ring cut
    inner_rad = badge_rad * 0.38
    draw.ellipse([
        badge_center[0] - inner_rad, badge_center[1] - inner_rad,
        badge_center[0] + inner_rad, badge_center[1] + inner_rad
    ], fill=(245, 190, 11, 255))

    # Center black core dot
    core_rad = badge_rad * 0.22
    draw.ellipse([
        badge_center[0] - core_rad, badge_center[1] - core_rad,
        badge_center[0] + core_rad, badge_center[1] + core_rad
    ], fill=(20, 24, 22, 255))

    # Nose sensor tip
    nose_tip = rot(0, bl * 0.88)
    draw.ellipse([nose_tip[0] - 3, nose_tip[1] - 3, nose_tip[0] + 3, nose_tip[1] + 3], fill=(20, 20, 20, 255))


# -------------------------------------------------------------
# LAND BREAKAGE / JAGGED GROUND CRACKS
# -------------------------------------------------------------
class LandCrackFissure:
    def __init__(self, start_x, start_y, angle_deg, length, branches=2):
        self.segments = []
        cur_x = start_x
        cur_y = start_y
        rad = math.radians(angle_deg)
        steps = random.randint(6, 10)
        seg_len = length / steps

        pts = [(cur_x, cur_y)]
        for s in range(steps):
            rad += random.uniform(-0.35, 0.35)
            # bias downward/horizontal for ground
            cur_x += math.cos(rad) * seg_len
            cur_y += math.sin(rad) * seg_len * 0.45 # flatten into ground plane
            pts.append((cur_x, cur_y))

        self.pts = pts
        self.width = random.uniform(3.5, 7.0)
        self.branches = []

        # Sub branches
        if branches > 0 and len(pts) > 4:
            for _ in range(branches):
                branch_idx = random.randint(2, len(pts) - 2)
                bx, by = pts[branch_idx]
                b_ang = angle_deg + random.choice([-50, 50])
                self.branches.append(LandCrackFissure(bx, by, b_ang, length * 0.5, branches - 1))

    def draw(self, draw_obj, progress, alpha_mult=1.0):
        if progress <= 0:
            return
        num_visible = max(2, int(len(self.pts) * progress))
        active_pts = self.pts[:num_visible]

        if len(active_pts) >= 2:
            # 1. Glowing molten fissure core
            molten_alpha = int(240 * alpha_mult)
            draw_obj.line(active_pts, fill=(255, 120, 20, molten_alpha), width=max(1, int(self.width * 0.55)))
            # 2. Dark jagged torn earth outline
            earth_alpha = int(255 * alpha_mult)
            draw_obj.line(active_pts, fill=(35, 25, 20, earth_alpha), width=max(2, int(self.width)))

        for br in self.branches:
            if progress > 0.4:
                br.draw(draw_obj, (progress - 0.4) / 0.6, alpha_mult)


# -------------------------------------------------------------
# MAIN RENDERER
# -------------------------------------------------------------
def render_nuke_animation():
    os.makedirs("temp_nuke_v2", exist_ok=True)

    # 1. Ground cracks (Crater fissures breaking open upon impact)
    cracks = [
        LandCrackFissure(CENTER_X, GROUND_Y, 0, 320, branches=2),      # Right main fissure
        LandCrackFissure(CENTER_X, GROUND_Y, 180, 320, branches=2),    # Left main fissure
        LandCrackFissure(CENTER_X, GROUND_Y, 25, 240, branches=1),     # Down-right
        LandCrackFissure(CENTER_X, GROUND_Y, 155, 240, branches=1),    # Down-left
        LandCrackFissure(CENTER_X, GROUND_Y, -20, 180, branches=1),    # Up-right
        LandCrackFissure(CENTER_X, GROUND_Y, -160, 180, branches=1),   # Up-left
    ]

    # 2. Ground chunks & shatter debris
    earth_debris = []
    for _ in range(75):
        angle = random.uniform(-math.pi * 0.95, -math.pi * 0.05)
        speed = random.uniform(5.0, 18.0)
        size = random.uniform(4.0, 11.0)
        earth_debris.append({
            'x': CENTER_X + random.uniform(-30, 30),
            'y': GROUND_Y + random.uniform(-10, 10),
            'vx': math.cos(angle) * speed,
            'vy': math.sin(angle) * speed - random.uniform(2.0, 6.0),
            'size': size,
            'drag': random.uniform(0.96, 0.98),
            'gravity': random.uniform(0.25, 0.45),
            'rot': random.uniform(0, 360),
            'rot_v': random.uniform(-25, 25),
            'color': (random.randint(45, 75), random.randint(35, 55), random.randint(25, 45)),
            'lifespan': random.uniform(1.8, 2.5) * FPS,
            'age': 0
        })

    # 3. Rising Mushroom Stem (Thermal fire & smoke column)
    stem_smoke = []
    for _ in range(120):
        vx = random.uniform(-1.8, 1.8)
        vy = -random.uniform(4.0, 9.5)
        stem_smoke.append({
            'x': CENTER_X + random.uniform(-20, 20),
            'y': GROUND_Y,
            'vx': vx,
            'vy': vy,
            'size': random.uniform(18, 35),
            'lifespan': random.uniform(1.8, 2.6) * FPS,
            'age': 0,
            'seed': random.random()
        })

    # 4. Rolling Mushroom Cap (Toroidal doughnut top)
    cap_smoke = []
    for _ in range(150):
        curl_dir = 1 if random.random() < 0.5 else -1
        vx = curl_dir * random.uniform(3.0, 8.5)
        vy = -random.uniform(3.5, 7.5)
        cap_smoke.append({
            'x': CENTER_X,
            'y': GROUND_Y - 40,
            'vx': vx,
            'vy': vy,
            'size': random.uniform(26, 48),
            'lifespan': random.uniform(2.0, 2.6) * FPS,
            'age': 0,
            'curl_dir': curl_dir
        })

    frame_images = []
    print(f"Rendering {TOTAL_FRAMES} frames of fat-nose nuke with radiation symbol, land breakage, and late full-screen flash...")

    for frame in range(TOTAL_FRAMES):
        t = frame / FPS
        img = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img, "RGBA")

        # ========================================================
        # 1. FALLING FAT NUKE (frame <= IMPACT_FRAME)
        # ========================================================
        if frame <= IMPACT_FRAME:
            drop_p = frame / IMPACT_FRAME
            # Accelerate down: y0 = -110, y_impact = GROUND_Y
            bomb_y = -110 + (GROUND_Y - (-110)) * (drop_p ** 1.9)
            # Aerodynamic stabilizer sway
            wobble = math.sin(drop_p * math.pi * 3.5) * 0.035
            draw_fat_nuke_bomb(draw, CENTER_X, bomb_y, wobble)

        # ========================================================
        # 2. EXPLOSION & SMOKE FORMATION (frame >= IMPACT_FRAME)
        # ========================================================
        if frame >= IMPACT_FRAME:
            blast_f = frame - IMPACT_FRAME
            blast_t = blast_f / FPS

            # A. Land Breakage Fissures (No circles/shockwave lines!)
            fissure_prog = min(1.0, blast_t / 0.45) # fissures crack open in 0.45s
            # Fissures slowly fade into the background at the very end
            fissure_alpha = 1.0 if blast_t < 2.0 else max(0.0, 1.0 - (blast_t - 2.0) / 0.7)
            for crack in cracks:
                crack.draw(draw, fissure_prog, fissure_alpha)

            # B. Shattered Earth Chunks (Throwing up broken land)
            for deb in earth_debris:
                deb['age'] += 1
                if deb['age'] >= deb['lifespan']:
                    continue
                deb['x'] += deb['vx']
                deb['y'] += deb['vy']
                deb['vx'] *= deb['drag']
                deb['vy'] = deb['vy'] * deb['drag'] + deb['gravity']
                deb['rot'] += deb['rot_v']

                d_prog = deb['age'] / deb['lifespan']
                alpha = int(255 * (1 - d_prog)**1.3)
                if alpha <= 0:
                    continue

                # Draw jagged rock chunk
                rad = math.radians(deb['rot'])
                sz = deb['size']
                pts = [
                    (deb['x'] + math.cos(rad) * sz, deb['y'] + math.sin(rad) * sz),
                    (deb['x'] + math.cos(rad + 1.6) * sz * 0.8, deb['y'] + math.sin(rad + 1.6) * sz * 0.8),
                    (deb['x'] + math.cos(rad + 3.2) * sz * 1.2, deb['y'] + math.sin(rad + 3.2) * sz * 1.2),
                    (deb['x'] + math.cos(rad + 4.8) * sz * 0.7, deb['y'] + math.sin(rad + 4.8) * sz * 0.7)
                ]
                draw.polygon(pts, fill=deb['color'] + (alpha,))

            # C. Rising Mushroom Stem (Thermal fire & smoke column)
            for sp in stem_smoke:
                sp['age'] += 1
                if sp['age'] >= sp['lifespan']:
                    continue
                sp['x'] += sp['vx']
                sp['y'] += sp['vy']
                sp['vx'] *= 0.95
                sp['vy'] = sp['vy'] * 0.95 - 0.07 # upward thermal suction

                prog = sp['age'] / sp['lifespan']
                cur_sz = sp['size'] * (0.8 + 2.0 * (prog ** 0.6))
                alpha = int(240 * (prog / 0.1)) if prog < 0.1 else int(240 * (1 - (prog - 0.1) / 0.9)**1.6)
                if alpha <= 0:
                    continue

                # Color: Bright fiery core -> Orange flame -> Volumetric dark smoke
                if prog < 0.2:
                    r, g, b = 255, int(230 - prog * 300), 50
                elif prog < 0.5:
                    p2 = (prog - 0.2) / 0.3
                    r, g, b = int(255 - p2 * 60), int(140 - p2 * 90), int(40 - p2 * 20)
                else:
                    p3 = (prog - 0.5) / 0.5
                    c = int(75 * (1 - p3) + 35 * p3)
                    r, g, b = c + 15, c, c

                draw.ellipse([sp['x'] - cur_sz, sp['y'] - cur_sz, sp['x'] + cur_sz, sp['y'] + cur_sz], fill=(r, g, b, alpha))

            # D. Rolling Mushroom Cloud Cap (Doughnut billowing head)
            for cp in cap_smoke:
                cp['age'] += 1
                if cp['age'] >= cp['lifespan']:
                    continue
                cp['x'] += cp['vx']
                cp['y'] += cp['vy']
                cp['vx'] *= 0.97
                cp['vy'] = cp['vy'] * 0.96 - 0.04
                # Curl downwards on the outer perimeter
                if abs(cp['x'] - CENTER_X) > 75:
                    cp['vy'] += 0.14

                prog = cp['age'] / cp['lifespan']
                cur_sz = cp['size'] * (0.7 + 2.3 * (prog ** 0.65))
                alpha = int(255 * (prog / 0.12)) if prog < 0.12 else int(255 * (1 - (prog - 0.12) / 0.88)**1.5)
                if alpha <= 0:
                    continue

                if prog < 0.18:
                    r, g, b = 255, 220, 90
                elif prog < 0.45:
                    p2 = (prog - 0.18) / 0.27
                    r, g, b = int(255 - p2 * 75), int(130 - p2 * 80), 30
                else:
                    p3 = (prog - 0.45) / 0.55
                    c = int(70 * (1 - p3) + 35 * p3)
                    r, g, b = c + 20, c + 5, c

                draw.ellipse([cp['x'] - cur_sz, cp['y'] - cur_sz, cp['x'] + cur_sz, cp['y'] + cur_sz], fill=(r, g, b, alpha))

        # ========================================================
        # 3. ENTIRE SCREEN FLASH (AFTER SMOKE HAS FORMED!)
        # Frame: FLASH_START_FRAME to FLASH_END_FRAME
        # ========================================================
        if FLASH_START_FRAME <= frame <= FLASH_END_FRAME:
            # Rise quickly to 100% full screen whiteout, then decay smoothly
            if frame <= FLASH_PEAK_FRAME:
                flash_ratio = (frame - FLASH_START_FRAME) / max(1, FLASH_PEAK_FRAME - FLASH_START_FRAME)
                flash_alpha = int(255 * flash_ratio)
            else:
                flash_ratio = (frame - FLASH_PEAK_FRAME) / (FLASH_END_FRAME - FLASH_PEAK_FRAME)
                flash_alpha = int(255 * (1.0 - flash_ratio)**1.3)

            if flash_alpha > 0:
                # 100% full-screen flashbang covering the entire canvas
                draw.rectangle([0, 0, WIDTH, HEIGHT], fill=(255, 255, 255, flash_alpha))

        frame_path = f"temp_nuke_v2/frame_{frame:04d}.png"
        img.save(frame_path, "PNG")
        frame_images.append(img)

    print("All frames rendered successfully.")

    # 1. Output WebM with transparent VP9 video
    webm_path = "nuke_explosion.webm"
    print(f"Encoding {webm_path} (Transparent VP9)...")
    subprocess.run([
        "ffmpeg", "-y",
        "-framerate", str(FPS),
        "-i", "temp_nuke_v2/frame_%04d.png",
        "-c:v", "libvpx-vp9",
        "-pix_fmt", "yuva420p",
        "-b:v", "2.8M",
        "-auto-alt-ref", "0",
        webm_path
    ], check=True)
    print(f"Saved {webm_path}")

    # 2. Output 32-bit APNG
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

    # 3. Output GIF
    gif_path = "nuke_explosion.gif"
    print(f"Encoding {gif_path}...")
    subprocess.run([
        "ffmpeg", "-y",
        "-framerate", str(FPS),
        "-i", "temp_nuke_v2/frame_%04d.png",
        "-filter_complex", "[0:v] split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=000000 [p]; [b][p] paletteuse=alpha_threshold=128",
        gif_path
    ], check=True)
    print(f"Saved {gif_path}")

    shutil.rmtree("temp_nuke_v2", ignore_errors=True)
    print("Done generating updated nuke animation!")

if __name__ == "__main__":
    render_nuke_animation()
