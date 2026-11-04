import math
import random
import os
import shutil
import subprocess
from PIL import Image, ImageDraw, ImageFilter

WIDTH = 800
HEIGHT = 900
FPS = 36
DURATION = 3.4  # seconds
TOTAL_FRAMES = int(FPS * DURATION)
CENTER_X = WIDTH / 2
CENTER_Y = HEIGHT / 2

# Timeline (in seconds):
# 0.0 -> 1.0s: Gauntlet rises from bottom into center
# 1.0 -> 1.55s: Stones power up, cosmic energy arcs, fingers tense into snap position
# 1.55 -> 1.65s: THE SNAP!
# 1.65 -> 2.25s: Full screen blinding white flashbang with cosmic fringe
# 2.25 -> 3.4s: Cosmic disintegration dust floats away, gauntlet rests, fades to transparent

SNAP_TIME = 1.6
SNAP_FRAME = int(SNAP_TIME * FPS)
FLASH_START_FRAME = SNAP_FRAME
FLASH_PEAK_FRAME = SNAP_FRAME + 2
FLASH_END_FRAME = SNAP_FRAME + int(0.65 * FPS)

random.seed(42)

# Infinity Stone colors: (R, G, B, Glow_RGB)
STONES = {
    'mind':    {'color': (255, 230, 40),  'glow': (255, 215, 0),   'name': 'Mind (Yellow)'},
    'power':   {'color': (180, 50, 255),  'glow': (147, 51, 234),  'name': 'Power (Purple)'},
    'space':   {'color': (50, 160, 255),  'glow': (14, 165, 233),  'name': 'Space (Blue)'},
    'reality': {'color': (255, 40, 60),   'glow': (239, 68, 68),   'name': 'Reality (Red)'},
    'time':    {'color': (40, 255, 120),  'glow': (34, 197, 94),   'name': 'Time (Green)'},
    'soul':    {'color': (255, 140, 30),  'glow': (249, 115, 22),  'name': 'Soul (Orange)'},
}

class CosmicEmber:
    def __init__(self, x, y):
        angle = random.uniform(0, math.pi * 2)
        speed = random.uniform(2.0, 9.0)
        self.x = x
        self.y = y
        self.vx = math.cos(angle) * speed
        self.vy = math.sin(angle) * speed - random.uniform(1.0, 3.5)
        self.size = random.uniform(2.5, 6.0)
        self.drag = random.uniform(0.95, 0.98)
        self.lifespan = random.uniform(1.0, 1.8) * FPS
        self.age = 0
        stone_key = random.choice(list(STONES.keys()))
        self.color = STONES[stone_key]['color']

def draw_infinity_gem(draw, cx, cy, rx, ry, stone_key, glow_intensity=1.0):
    """Draws a multi-faceted glowing Infinity Stone."""
    stone = STONES[stone_key]
    r, g, b = stone['color']
    gr, gg, gb = stone['glow']

    # Outer ethereal halo glow if powered
    if glow_intensity > 0.1:
        glow_rad_x = rx * (1.6 + glow_intensity * 1.5)
        glow_rad_y = ry * (1.6 + glow_intensity * 1.5)
        glow_alpha = int(140 * min(1.0, glow_intensity))
        draw.ellipse([
            cx - glow_rad_x, cy - glow_rad_y,
            cx + glow_rad_x, cy + glow_rad_y
        ], fill=(gr, gg, gb, glow_alpha))

    # Dark gem setting socket ring
    draw.ellipse([cx - rx - 3, cy - ry - 3, cx + rx + 3, cy + ry + 3], fill=(70, 55, 20, 255))
    draw.ellipse([cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1], fill=(40, 30, 10, 255))

    # Gem body
    draw.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=(r, g, b, 255))

    # Inner bright core / facet reflections
    draw.ellipse([
        cx - rx * 0.55, cy - ry * 0.55,
        cx + rx * 0.55, cy + ry * 0.55
    ], fill=(min(255, r + 50), min(255, g + 50), min(255, b + 50), 255))

    # White specular glint
    glint_x = cx - rx * 0.3
    glint_y = cy - ry * 0.3
    draw.ellipse([glint_x - 2, glint_y - 2, glint_x + 3, glint_y + 3], fill=(255, 255, 255, 255))


def draw_gauntlet(draw, base_x, base_y, snap_state, gem_power=0.0):
    """
    Renders Thanos' Infinity Gauntlet.
    snap_state:
      0.0 -> Relaxed open hand rising
      0.5 -> Thumb & middle finger touching in snap tension
      1.0 -> Released snap position!
    gem_power: 0.0 to 1.0+ glow intensity
    """
    # Colors: Burnished Titan Gold with Bronze Shading
    GOLD_MAIN = (212, 160, 48)
    GOLD_LIGHT = (245, 210, 105)
    GOLD_DARK = (145, 100, 25)
    BRONZE = (100, 68, 18)
    SEAM_DARK = (55, 38, 12)

    # 1. Forearm & Bracer (Wide arm gauntlet base)
    arm_poly = [
        (base_x - 85, base_y + 260),
        (base_x - 70, base_y + 110),
        (base_x + 70, base_y + 110),
        (base_x + 85, base_y + 260),
    ]
    draw.polygon(arm_poly, fill=GOLD_MAIN)

    # Bracer shadow and armor plate division
    draw.polygon([
        (base_x - 85, base_y + 260),
        (base_x - 70, base_y + 110),
        (base_x - 20, base_y + 110),
        (base_x - 30, base_y + 260),
    ], fill=GOLD_DARK)

    # Filigree wrist cuffs
    draw.rectangle([base_x - 72, base_y + 105, base_x + 72, base_y + 120], fill=BRONZE)
    draw.rectangle([base_x - 70, base_y + 108, base_x + 70, base_y + 117], fill=GOLD_LIGHT)

    # 2. Palm & Back of Hand Armor Plate
    hand_poly = [
        (base_x - 68, base_y + 105),
        (base_x - 78, base_y + 10),
        (base_x - 65, base_y - 20),
        (base_x + 55, base_y - 20),
        (base_x + 72, base_y + 10),
        (base_x + 68, base_y + 105),
    ]
    draw.polygon(hand_poly, fill=GOLD_MAIN)

    # Armor plating bevels
    draw.polygon([
        (base_x - 68, base_y + 105),
        (base_x - 78, base_y + 10),
        (base_x - 25, base_y + 20),
        (base_x - 25, base_y + 105),
    ], fill=GOLD_DARK)

    # 3. Finger Segments (Articulated gold armor joints)
    # Fingers transition according to snap_state:
    # Index finger (extends slightly / curled)
    # Middle finger (tenses against thumb, then snaps down)
    # Ring & Pinky (curled tight into fist)
    # Thumb (slides down across middle finger)

    # Pinky finger (curled at right side)
    draw.rounded_rectangle([base_x + 46, base_y - 35, base_x + 64, base_y + 15], radius=6, fill=GOLD_DARK)
    draw.rounded_rectangle([base_x + 48, base_y - 33, base_x + 62, base_y - 10], radius=4, fill=GOLD_MAIN)

    # Ring finger (curled into palm)
    draw.rounded_rectangle([base_x + 20, base_y - 42, base_x + 42, base_y + 10], radius=7, fill=GOLD_DARK)
    draw.rounded_rectangle([base_x + 22, base_y - 40, base_x + 40, base_y - 12], radius=5, fill=GOLD_MAIN)

    # Middle finger (Snap finger)
    if snap_state < 0.6:
        # Tensed touching thumb tip
        mf_poly = [
            (base_x - 12, base_y - 20),
            (base_x - 24, base_y - 75),
            (base_x - 4, base_y - 82),
            (base_x + 12, base_y - 20)
        ]
        draw.polygon(mf_poly, fill=GOLD_MAIN)
        draw.ellipse([base_x - 26, base_y - 92, base_x + 2, base_y - 68], fill=GOLD_LIGHT)
    else:
        # Snapped down into palm!
        mf_poly = [
            (base_x - 8, base_y - 15),
            (base_x - 18, base_y - 48),
            (base_x + 6, base_y - 54),
            (base_x + 14, base_y - 15)
        ]
        draw.polygon(mf_poly, fill=GOLD_MAIN)
        draw.ellipse([base_x - 18, base_y - 58, base_x + 6, base_y - 38], fill=GOLD_DARK)

    # Index finger (pointing slightly up/curved)
    idx_poly = [
        (base_x - 42, base_y - 15),
        (base_x - 56, base_y - 70),
        (base_x - 38, base_y - 76),
        (base_x - 24, base_y - 15)
    ]
    draw.polygon(idx_poly, fill=GOLD_MAIN)
    draw.polygon([
        (base_x - 42, base_y - 15),
        (base_x - 56, base_y - 70),
        (base_x - 47, base_y - 72),
        (base_x - 33, base_y - 15)
    ], fill=GOLD_DARK)
    draw.ellipse([base_x - 58, base_y - 86, base_x - 36, base_y - 64], fill=GOLD_LIGHT)

    # Thumb (Snap trigger thumb)
    if snap_state < 0.6:
        # Reaching over to press firmly against middle fingertip
        thumb_poly = [
            (base_x - 68, base_y + 40),
            (base_x - 50, base_y - 10),
            (base_x - 18, base_y - 68),
            (base_x - 6, base_y - 58),
            (base_x - 34, base_y + 10),
            (base_x - 52, base_y + 55),
        ]
        draw.polygon(thumb_poly, fill=GOLD_MAIN)
        # Thumb pad tip
        draw.ellipse([base_x - 24, base_y - 78, base_x - 2, base_y - 52], fill=GOLD_LIGHT)
    else:
        # Snapped down across palm (motion finish)
        thumb_poly = [
            (base_x - 68, base_y + 40),
            (base_x - 48, base_y + 10),
            (base_x - 25, base_y - 15),
            (base_x - 10, base_y - 8),
            (base_x - 28, base_y + 35),
            (base_x - 52, base_y + 55),
        ]
        draw.polygon(thumb_poly, fill=GOLD_MAIN)
        draw.ellipse([base_x - 28, base_y - 22, base_x - 6, base_y + 2], fill=GOLD_LIGHT)

    # 4. Knuckle Armor Ridge
    draw.line([(base_x - 65, base_y - 18), (base_x + 55, base_y - 18)], fill=BRONZE, width=5)
    draw.line([(base_x - 65, base_y - 16), (base_x + 55, base_y - 16)], fill=GOLD_LIGHT, width=2)

    # 5. THE 6 INFINITY STONES
    # Knuckle stones:
    # Power (Purple) on Pinky knuckle
    draw_infinity_gem(draw, base_x + 52, base_y - 20, 6, 7, 'power', gem_power)
    # Space (Blue) on Ring knuckle
    draw_infinity_gem(draw, base_x + 28, base_y - 22, 7, 8, 'space', gem_power)
    # Reality (Red) on Middle knuckle
    draw_infinity_gem(draw, base_x + 2, base_y - 24, 7, 8, 'reality', gem_power)
    # Time (Green) on Index knuckle
    draw_infinity_gem(draw, base_x - 32, base_y - 20, 7, 8, 'time', gem_power)
    # Soul (Orange) on Thumb mount
    draw_infinity_gem(draw, base_x - 56, base_y + 25, 7, 9, 'soul', gem_power)

    # Mind Stone (Large central yellow stone on the back of the hand)
    draw_infinity_gem(draw, base_x - 5, base_y + 48, 14, 18, 'mind', gem_power * 1.3)

    # 6. Cosmic Lightning / Arcs between the stones when powered up
    if gem_power > 0.4:
        arc_pts = [
            (base_x - 56, base_y + 25), # Soul
            (base_x - 32, base_y - 20), # Time
            (base_x + 2, base_y - 24),  # Reality
            (base_x + 28, base_y - 22), # Space
            (base_x + 52, base_y - 20), # Power
            (base_x - 5, base_y + 48)   # Mind
        ]
        for a_i in range(len(arc_pts) - 1):
            p1 = arc_pts[a_i]
            p2 = arc_pts[a_i + 1]
            # Jagged lightning line
            mid_x = (p1[0] + p2[0]) / 2 + random.uniform(-8, 8)
            mid_y = (p1[1] + p2[1]) / 2 + random.uniform(-8, 8)
            lightning_alpha = int(220 * (gem_power - 0.4) / 0.6)
            draw.line([p1, (mid_x, mid_y), p2], fill=(255, 255, 255, lightning_alpha), width=2)
            draw.line([p1, (mid_x, mid_y), p2], fill=(180, 230, 255, int(lightning_alpha * 0.7)), width=4)


def render_thanos_snap():
    os.makedirs("temp_thanos_frames", exist_ok=True)
    frame_images = []
    cosmic_embers = []

    print(f"Rendering {TOTAL_FRAMES} frames of Thanos Infinity Gauntlet Snap + Flash...")

    for frame in range(TOTAL_FRAMES):
        t = frame / FPS
        img = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img, "RGBA")

        # -----------------------------------------------------------
        # 1. POSITION & TIMING CHOREOGRAPHY
        # -----------------------------------------------------------
        # Entrance: rises from bottom (y=750 down to y=430)
        if t < 0.9:
            rise_p = min(1.0, t / 0.9)
            # Smooth ease-out cubic
            eased_rise = 1.0 - math.pow(1.0 - rise_p, 3)
            gauntlet_y = 780 - 320 * eased_rise
            snap_state = 0.0
            gem_power = 0.2 * eased_rise
        elif t < 1.55:
            # Gauntlet in position, gem power charging to maximum!
            gauntlet_y = 460
            charge_p = (t - 0.9) / 0.65
            snap_state = min(0.5, charge_p * 0.5) # Fingers move into snap tension
            gem_power = 0.2 + 0.8 * (charge_p ** 1.5)
            # Slight vibration tension shake
            gauntlet_y += (random.random() - 0.5) * 3 * charge_p
        elif t < 1.65:
            # THE SNAP MOMENT!
            gauntlet_y = 460
            snap_state = 1.0
            gem_power = 1.8 # Maximum blinding surge
        else:
            # Post-snap: gauntlet relaxes and slowly lowers
            post_t = t - 1.65
            gauntlet_y = 460 + post_t * 60
            snap_state = 1.0
            gem_power = max(0.0, 1.0 - post_t * 1.2)

        # Draw the Gauntlet
        gauntlet_x = CENTER_X
        # Fade gauntlet out gently in the last 0.4s
        if t > 2.8:
            gauntlet_alpha = max(0.0, 1.0 - (t - 2.8) / 0.6)
        else:
            gauntlet_alpha = 1.0

        if gauntlet_alpha > 0.02:
            # Render to temporary layer to apply gauntlet alpha if needed
            draw_gauntlet(draw, gauntlet_x, gauntlet_y, snap_state, gem_power)

        # -----------------------------------------------------------
        # 2. SNAP IMPACT PULSE & COSMIC SHOCK RING
        # -----------------------------------------------------------
        if frame >= SNAP_FRAME:
            snap_f = frame - SNAP_FRAME
            snap_t = snap_f / FPS

            # Snap contact origin (between thumb & middle finger)
            snap_origin_x = gauntlet_x - 15
            snap_origin_y = gauntlet_y - 65

            # Spawn cosmic disintegration embers at snap
            if snap_f < 6:
                for _ in range(25):
                    cosmic_embers.append(CosmicEmber(snap_origin_x, snap_origin_y))

            # Expanding cosmic shockwave ring
            if snap_t < 0.6:
                sw_prog = snap_t / 0.6
                sw_rad = 380 * (sw_prog ** 0.7)
                sw_alpha = int(255 * (1 - sw_prog)**1.5)
                if sw_alpha > 0 and sw_rad > 2:
                    draw.ellipse([
                        snap_origin_x - sw_rad, snap_origin_y - sw_rad,
                        snap_origin_x + sw_rad, snap_origin_y + sw_rad
                    ], outline=(255, 230, 120, sw_alpha), width=max(1, int(10 * (1 - sw_prog))))

        # -----------------------------------------------------------
        # 3. COSMIC EMBERS & DISINTEGRATION DUST
        # -----------------------------------------------------------
        for emb in cosmic_embers:
            emb.age += 1
            if emb.age >= emb.lifespan:
                continue
            emb.x += emb.vx
            emb.y += emb.vy
            emb.vx *= emb.drag
            emb.vy = emb.vy * emb.drag - 0.05 # gentle float
            prog = emb.age / emb.lifespan
            alpha = int(255 * (1 - prog)**1.2)
            if alpha > 0:
                cur_sz = emb.size * (1 - prog * 0.5)
                r, g, b = emb.color
                draw.ellipse([
                    emb.x - cur_sz, emb.y - cur_sz,
                    emb.x + cur_sz, emb.y + cur_sz
                ], fill=(r, g, b, alpha))

        # -----------------------------------------------------------
        # 4. BLINDING FULL-SCREEN WHITE FLASHBANG
        # -----------------------------------------------------------
        if FLASH_START_FRAME <= frame <= FLASH_END_FRAME:
            if frame <= FLASH_PEAK_FRAME:
                # Instant jump to 100% whiteout
                flash_ratio = (frame - FLASH_START_FRAME) / max(1, FLASH_PEAK_FRAME - FLASH_START_FRAME)
                flash_alpha = int(255 * flash_ratio)
            else:
                # Smooth cosmic decay
                flash_ratio = (frame - FLASH_PEAK_FRAME) / (FLASH_END_FRAME - FLASH_PEAK_FRAME)
                flash_alpha = int(255 * math.pow(1.0 - flash_ratio, 1.4))

            if flash_alpha > 0:
                # Full screen pure whiteout
                draw.rectangle([0, 0, WIDTH, HEIGHT], fill=(255, 255, 255, flash_alpha))

        frame_path = f"temp_thanos_frames/frame_{frame:04d}.png"
        img.save(frame_path, "PNG")
        frame_images.append(img)

    print("All frames rendered.")

    # 1. Output WebM transparent video (VP9 with alpha channel)
    webm_path = "infinity_snap.webm"
    print(f"Encoding {webm_path} (Transparent VP9)...")
    subprocess.run([
        "ffmpeg", "-y",
        "-framerate", str(FPS),
        "-i", "temp_thanos_frames/frame_%04d.png",
        "-c:v", "libvpx-vp9",
        "-pix_fmt", "yuva420p",
        "-b:v", "3M",
        "-auto-alt-ref", "0",
        webm_path
    ], check=True)
    print(f"Saved {webm_path}")

    # 2. Output 32-bit APNG
    apng_path = "infinity_snap.png"
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

    # 3. Output Transparent GIF
    gif_path = "infinity_snap.gif"
    print(f"Encoding {gif_path}...")
    subprocess.run([
        "ffmpeg", "-y",
        "-framerate", str(FPS),
        "-i", "temp_thanos_frames/frame_%04d.png",
        "-filter_complex", "[0:v] split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=000000 [p]; [b][p] paletteuse=alpha_threshold=128",
        gif_path
    ], check=True)
    print(f"Saved {gif_path}")

    shutil.rmtree("temp_thanos_frames", ignore_errors=True)
    print("Done generating Thanos Infinity Snap animation!")

if __name__ == "__main__":
    render_thanos_snap()
