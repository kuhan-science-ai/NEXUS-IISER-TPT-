import math
import random
import os
import shutil
import subprocess
import numpy as np
from PIL import Image, ImageDraw

WIDTH = 800
HEIGHT = 900
FPS = 36
DURATION = 3.2  # seconds
TOTAL_FRAMES = int(FPS * DURATION)

CENTER_X = WIDTH / 2
BASE_TARGET_Y = 480  # Final Y position of the gauntlet base

# Load the cleanly isolated gauntlet base image
gauntlet_img = Image.open('gauntlet_isolated.png').convert('RGBA')
gw, gh = gauntlet_img.size

# Separate the body (wrist + palm + knuckle line + mind stone + thumb base)
# In gauntlet_isolated.png:
# y >= 110 is palm, knuckles, thumb base, and forearm
# y < 110 in the original image is the closed fist top
gauntlet_body = gauntlet_img.copy()
body_arr = np.array(gauntlet_body)
# Erase the closed fingers above knuckle line (y < 105)
for y in range(min(115, gh)):
    for x in range(gw):
        # Keep thumb base (x > 280, y > 150)
        if y < 105:
            body_arr[y, x] = [0, 0, 0, 0]
gauntlet_body = Image.fromarray(body_arr)

# Finger anchor points relative to gauntlet top-left (gw=361, gh=642):
# Pinky (Orange stone):   x = 63,  y = 125
# Ring (Red stone):       x = 113, y = 118
# Middle (Blue stone):    x = 174, y = 110
# Index (Purple stone):   x = 237, y = 114
# Thumb (Green stone):    x = 335, y = 200

OUTLINE_COLOR = (78, 51, 17, 255)    # #4e3311
GOLD_MAIN = (222, 155, 40, 255)      # #de9b28
GOLD_SHADOW = (178, 116, 24, 255)    # #b27418
GOLD_LIGHT = (245, 204, 107, 255)    # #f5cc6b

def draw_armored_finger_segment(draw, x1, y1, x2, y2, width1, width2):
    """Draws an armored golden finger segment matching the asset style with dark outline and shading."""
    dx = x2 - x1
    dy = y2 - y1
    dist = math.hypot(dx, dy)
    if dist < 1:
        return
    nx = -dy / dist
    ny = dx / dist

    p1 = (x1 + nx * (width1 / 2), y1 + ny * (width1 / 2))
    p2 = (x2 + nx * (width2 / 2), y2 + ny * (width2 / 2))
    p3 = (x2 - nx * (width2 / 2), y2 - ny * (width2 / 2))
    p4 = (x1 - nx * (width1 / 2), y1 - ny * (width1 / 2))

    # Outer dark outline
    draw.polygon([p1, p2, p3, p4], fill=OUTLINE_COLOR)

    # Inner gold body
    inset1 = 3.0
    inset2 = 2.5
    ip1 = (x1 + nx * (width1 / 2 - inset1), y1 + ny * (width1 / 2 - inset1))
    ip2 = (x2 + nx * (width2 / 2 - inset2), y2 + ny * (width2 / 2 - inset2))
    ip3 = (x2 - nx * (width2 / 2 - inset2), y2 - ny * (width2 / 2 - inset2))
    ip4 = (x1 - nx * (width1 / 2 - inset1), y1 - ny * (width1 / 2 - inset1))
    draw.polygon([ip1, ip2, ip3, ip4], fill=GOLD_MAIN)

    # Shadow edge on one side
    sp1 = (x1 - nx * (width1 / 2 - inset1), y1 - ny * (width1 / 2 - inset1))
    sp2 = (x2 - nx * (width2 / 2 - inset2), y2 - ny * (width2 / 2 - inset2))
    sp3 = (x2 - nx * (width2 * 0.1), y2 - ny * (width2 * 0.1))
    sp4 = (x1 - nx * (width1 * 0.1), y1 - ny * (width1 * 0.1))
    draw.polygon([sp1, sp2, sp3, sp4], fill=GOLD_SHADOW)

    # Highlight line on opposite side
    draw.line([
        (x1 + nx * (width1 * 0.25), y1 + ny * (width1 * 0.25)),
        (x2 + nx * (width2 * 0.25), y2 + ny * (width2 * 0.25))
    ], fill=GOLD_LIGHT, width=2)


def draw_rigged_finger(draw, base_x, base_y, angle_deg, length, curl_ratio, base_w=28, tip_w=18):
    """
    Renders an articulated 3-joint armored finger.
    curl_ratio: 0.0 = completely straight / open
                1.0 = curled into fist / snap
    """
    rad = math.radians(angle_deg)
    # Segment 1 (proximal)
    l1 = length * 0.38
    # Segment 2 (intermediate)
    l2 = length * 0.34
    # Segment 3 (distal / tip)
    l3 = length * 0.32

    # Incurvation angle per joint when curling
    curl_ang = math.radians(curl_ratio * 75)

    a1 = rad - curl_ang * 0.4
    j1_x = base_x + math.cos(a1) * l1
    j1_y = base_y + math.sin(a1) * l1

    a2 = a1 - curl_ang * 0.7
    j2_x = j1_x + math.cos(a2) * l2
    j2_y = j1_y + math.sin(a2) * l2

    a3 = a2 - curl_ang * 0.9
    tip_x = j2_x + math.cos(a3) * l3
    tip_y = j2_y + math.sin(a3) * l3

    # Draw segments
    w_mid1 = base_w * 0.88
    w_mid2 = base_w * 0.72
    draw_armored_finger_segment(draw, base_x, base_y, j1_x, j1_y, base_w, w_mid1)
    draw_armored_finger_segment(draw, j1_x, j1_y, j2_x, j2_y, w_mid1, w_mid2)
    draw_armored_finger_segment(draw, j2_x, j2_y, tip_x, tip_y, w_mid2, tip_w)

    # Round tip cap
    draw.ellipse([tip_x - tip_w * 0.45, tip_y - tip_w * 0.45, tip_x + tip_w * 0.45, tip_y + tip_w * 0.45], fill=OUTLINE_COLOR)
    draw.ellipse([tip_x - tip_w * 0.35, tip_y - tip_w * 0.35, tip_x + tip_w * 0.35, tip_y + tip_w * 0.35], fill=GOLD_MAIN)

    return (tip_x, tip_y)


def draw_rigged_thumb(draw, base_x, base_y, pose_ratio, snap_state):
    """
    Renders the rigged thumb:
    pose_ratio: 0.0 = open wide to the right
                1.0 = curled across palm towards middle finger
    snap_state: 0.0 = pre-snap, 1.0 = snapped down across palm
    """
    # Base is at thumb knuckle (green stone area)
    # When open (pose_ratio=0): points diagonally up-right (~ -30 deg)
    # When snapping (pose_ratio=1.0): curls across palm to x ~ 180, y ~ 70
    if snap_state < 0.5:
        # Pre-snap transition
        start_ang = -25
        target_ang = -140
        current_ang = start_ang + (target_ang - start_ang) * pose_ratio
        curl_curve = pose_ratio * 40
        length = 100
        tip = draw_rigged_finger(draw, base_x, base_y, current_ang, length, curl_ratio=pose_ratio * 0.7, base_w=32, tip_w=22)
    else:
        # Snapped down across the palm (slid past middle finger)
        tip = draw_rigged_finger(draw, base_x, base_y, -165, 88, curl_ratio=1.1, base_w=32, tip_w=20)
    return tip


def render_all():
    os.makedirs("temp_rigged_frames", exist_ok=True)
    frame_images = []

    SNAP_FRAME = int(1.55 * FPS)
    FLASH_START = SNAP_FRAME
    FLASH_PEAK = SNAP_FRAME + 2
    FLASH_END = SNAP_FRAME + int(0.65 * FPS)

    print(f"Rendering {TOTAL_FRAMES} frames of rigged Infinity Gauntlet Snap + Flash...")

    # Pre-calculate cosmic sparks
    sparks = []

    for frame in range(TOTAL_FRAMES):
        t = frame / FPS
        img = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img, "RGBA")

        # -------------------------------------------------------------
        # 1. ENTRANCE & MOTION TIMELINE
        # -------------------------------------------------------------
        # Stage 1 (0.0s -> 0.85s): Gauntlet rises from bottom with ALL 5 FINGERS OPEN
        if t < 0.85:
            rise_p = t / 0.85
            # Ease out cubic
            ease = 1.0 - math.pow(1.0 - rise_p, 3)
            current_y = (HEIGHT + 180) - ((HEIGHT + 180) - (BASE_TARGET_Y - 200)) * ease
            curl_progress = 0.0 # ALL 5 FINGERS WIDE OPEN!
            snap_state = 0.0
            gem_power = 0.15 * ease
        # Stage 2 (0.85s -> 1.55s): Fingers curl into SNAP tension posture!
        elif t < 1.55:
            current_y = BASE_TARGET_Y - 200
            charge_p = (t - 0.85) / 0.70
            curl_progress = min(1.0, charge_p ** 1.3) # Fingers smoothly curl into snap pose
            snap_state = 0.0
            gem_power = 0.15 + 0.85 * (charge_p ** 1.6)
            # Vibration tension shake
            current_y += (random.random() - 0.5) * 4 * charge_p
        # Stage 3 (1.55s -> 1.65s): THE SNAP!
        elif t < 1.65:
            current_y = BASE_TARGET_Y - 200
            curl_progress = 1.0
            snap_state = 1.0 # Thumb snaps down!
            gem_power = 1.8
        # Stage 4 (1.65s -> 3.2s): Post-snap hold & fade
        else:
            post_t = t - 1.65
            current_y = (BASE_TARGET_Y - 200) + post_t * 30
            curl_progress = 1.0
            snap_state = 1.0
            gem_power = max(0.0, 1.0 - post_t * 1.5)

        # Scale factor for gauntlet
        scale = 0.95
        render_w = int(gw * scale)
        render_h = int(gh * scale)
        gauntlet_pos_x = int(CENTER_X - render_w / 2)
        gauntlet_pos_y = int(current_y)

        # Gauntlet surface for drawing rigged fingers + body
        g_layer = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
        g_draw = ImageDraw.Draw(g_layer, "RGBA")

        # Absolute coordinates of knuckle anchors on the screen:
        # In asset: Pinky (63, 125), Ring (113, 118), Middle (174, 110), Index (237, 114), Thumb (335, 200)
        p_base = (gauntlet_pos_x + int(63 * scale), gauntlet_pos_y + int(125 * scale))
        r_base = (gauntlet_pos_x + int(113 * scale), gauntlet_pos_y + int(118 * scale))
        m_base = (gauntlet_pos_x + int(174 * scale), gauntlet_pos_y + int(110 * scale))
        i_base = (gauntlet_pos_x + int(237 * scale), gauntlet_pos_y + int(114 * scale))
        t_base = (gauntlet_pos_x + int(335 * scale), gauntlet_pos_y + int(200 * scale))

        # -------------------------------------------------------------
        # DRAW RIGGED FINGERS
        # -------------------------------------------------------------
        # Finger curl parameters:
        # When curl_progress = 0: All fingers straight up / open!
        # When curl_progress = 1: Pinky/Ring curl into palm (1.0), Index curves (0.35), Middle touches thumb (0.85)

        # 1. Pinky Finger (Orange knuckle)
        draw_rigged_finger(g_draw, p_base[0], p_base[1], angle_deg=-105, length=85 * scale, curl_ratio=curl_progress * 1.0, base_w=24 * scale, tip_w=16 * scale)

        # 2. Ring Finger (Red knuckle)
        draw_rigged_finger(g_draw, r_base[0], r_base[1], angle_deg=-95, length=108 * scale, curl_ratio=curl_progress * 1.0, base_w=27 * scale, tip_w=18 * scale)

        # 3. Middle Finger (Blue knuckle - Snap finger)
        if snap_state < 0.5:
            # Reaches down to meet thumb
            mf_curl = curl_progress * 0.85
            m_tip = draw_rigged_finger(g_draw, m_base[0], m_base[1], angle_deg=-88, length=122 * scale, curl_ratio=mf_curl, base_w=29 * scale, tip_w=19 * scale)
        else:
            # Snapped firmly into palm!
            m_tip = draw_rigged_finger(g_draw, m_base[0], m_base[1], angle_deg=-75, length=95 * scale, curl_ratio=1.1, base_w=29 * scale, tip_w=18 * scale)

        # 4. Index Finger (Purple knuckle)
        draw_rigged_finger(g_draw, i_base[0], i_base[1], angle_deg=-82, length=112 * scale, curl_ratio=curl_progress * 0.35, base_w=28 * scale, tip_w=18 * scale)

        # 5. Composite Gauntlet Body (palm + armor + stones) OVER the base of the fingers so the knuckle armor overlaps naturally!
        resized_body = gauntlet_body.resize((render_w, render_h), Image.Resampling.LANCZOS)
        g_layer.paste(resized_body, (gauntlet_pos_x, gauntlet_pos_y), resized_body)

        # 6. Thumb (Green knuckle) - Drawn in front so it reaches across the palm
        t_tip = draw_rigged_thumb(g_draw, t_base[0], t_base[1], pose_ratio=curl_progress, snap_state=snap_state)

        # -------------------------------------------------------------
        # GLOWING INFINITY STONES & COSMIC LIGHTNING
        # -------------------------------------------------------------
        if gem_power > 0.2:
            stone_screen_coords = [
                (gauntlet_pos_x + int(63 * scale), gauntlet_pos_y + int(129 * scale), (255, 140, 30)),   # Soul (Orange)
                (gauntlet_pos_x + int(113 * scale), gauntlet_pos_y + int(121 * scale), (255, 40, 50)),   # Reality (Red)
                (gauntlet_pos_x + int(174 * scale), gauntlet_pos_y + int(112 * scale), (40, 160, 255)),  # Space (Blue)
                (gauntlet_pos_x + int(237 * scale), gauntlet_pos_y + int(116 * scale), (180, 50, 255)),  # Power (Purple)
                (gauntlet_pos_x + int(335 * scale), gauntlet_pos_y + int(201 * scale), (40, 255, 100)),  # Time (Green)
                (gauntlet_pos_x + int(155 * scale), gauntlet_pos_y + int(241 * scale), (255, 230, 40)),  # Mind (Yellow)
            ]
            for sx, sy, sc in stone_screen_coords:
                r, g, b = sc
                glow_r = int(22 * gem_power * scale)
                alpha = int(140 * min(1.0, gem_power))
                g_draw.ellipse([sx - glow_r, sy - glow_r, sx + glow_r, sy + glow_r], fill=(r, g, b, alpha))

            # Lightning arcs connecting stones
            if gem_power > 0.5:
                for a_i in range(len(stone_screen_coords) - 1):
                    p1 = stone_screen_coords[a_i]
                    p2 = stone_screen_coords[a_i + 1]
                    mx = (p1[0] + p2[0]) / 2 + random.uniform(-10, 10)
                    my = (p1[1] + p2[1]) / 2 + random.uniform(-10, 10)
                    arc_alpha = int(220 * (gem_power - 0.5) / 0.5)
                    g_draw.line([(p1[0], p1[1]), (mx, my), (p2[0], p2[1])], fill=(255, 255, 255, arc_alpha), width=2)
                    g_draw.line([(p1[0], p1[1]), (mx, my), (p2[0], p2[1])], fill=(160, 220, 255, int(arc_alpha * 0.6)), width=4)

        # Paste gauntlet layer onto final frame
        # Apply gentle fade-out at the very end (t > 2.7s)
        if t > 2.7:
            gauntlet_alpha = max(0.0, 1.0 - (t - 2.7) / 0.5)
            # modulate alpha
            g_arr = np.array(g_layer)
            g_arr[:, :, 3] = (g_arr[:, :, 3].astype(float) * gauntlet_alpha).astype(np.uint8)
            img = Image.fromarray(g_arr)
            draw = ImageDraw.Draw(img, "RGBA")
        else:
            img.paste(g_layer, (0, 0), g_layer)
            draw = ImageDraw.Draw(img, "RGBA")

        # -------------------------------------------------------------
        # SNAP SHOCKWAVE PULSE & SPARKS
        # -------------------------------------------------------------
        if frame >= SNAP_FRAME:
            snap_f = frame - SNAP_FRAME
            snap_t = snap_f / FPS
            snap_origin = (gauntlet_pos_x + int(185 * scale), gauntlet_pos_y + int(70 * scale))

            # Spawn sparks
            if snap_f < 5:
                for _ in range(25):
                    sparks.append({
                        'x': snap_origin[0], 'y': snap_origin[1],
                        'vx': math.cos(random.uniform(0, math.pi * 2)) * random.uniform(3, 11),
                        'vy': math.sin(random.uniform(0, math.pi * 2)) * random.uniform(3, 11),
                        'size': random.uniform(2, 6),
                        'life': 1.0,
                        'decay': 1 / (60 * random.uniform(0.8, 1.4)),
                        'color': random.choice([(255, 220, 40), (180, 50, 255), (40, 160, 255), (255, 40, 50)])
                    })

            # Shockwave ring
            if snap_t < 0.55:
                sw_prog = snap_t / 0.55
                sw_rad = 360 * (sw_prog ** 0.7)
                sw_alpha = int(255 * (1 - sw_prog)**1.5)
                if sw_alpha > 0 and sw_rad > 2:
                    draw.ellipse([
                        snap_origin[0] - sw_rad, snap_origin[1] - sw_rad,
                        snap_origin[0] + sw_rad, snap_origin[1] + sw_rad
                    ], outline=(255, 230, 120, sw_alpha), width=max(1, int(10 * (1 - sw_prog))))

        # Update and render sparks
        for sp in sparks:
            sp['x'] += sp['vx']
            sp['y'] += sp['vy']
            sp['vx'] *= 0.96
            sp['vy'] = sp['vy'] * 0.96 - 0.04
            sp['life'] -= sp['decay']
            if sp['life'] <= 0:
                continue
            alpha = int(255 * sp['life'])
            r, g, b = sp['color']
            sz = sp['size'] * sp['life']
            draw.ellipse([sp['x'] - sz, sp['y'] - sz, sp['x'] + sz, sp['y'] + sz], fill=(r, g, b, alpha))

        # -------------------------------------------------------------
        # FULL-SCREEN WHITE SCREEN FLASH!
        # -------------------------------------------------------------
        if FLASH_START <= frame <= FLASH_END:
            if frame <= FLASH_PEAK:
                flash_ratio = (frame - FLASH_START) / max(1, FLASH_PEAK - FLASH_START)
                flash_alpha = int(255 * flash_ratio)
            else:
                flash_ratio = (frame - FLASH_PEAK) / (FLASH_END - FLASH_PEAK)
                flash_alpha = int(255 * math.pow(1.0 - flash_ratio, 1.4))

            if flash_alpha > 0:
                # 100% full-screen pure whiteout flash
                draw.rectangle([0, 0, WIDTH, HEIGHT], fill=(255, 255, 255, flash_alpha))

        frame_path = f"temp_rigged_frames/frame_{frame:04d}.png"
        img.save(frame_path, "PNG")
        frame_images.append(img)

    print("All frames rendered.")

    # 1. Output WebM transparent video
    webm_path = "infinity_snap.webm"
    print(f"Encoding {webm_path} (Transparent VP9)...")
    subprocess.run([
        "ffmpeg", "-y",
        "-framerate", str(FPS),
        "-i", "temp_rigged_frames/frame_%04d.png",
        "-c:v", "libvpx-vp9",
        "-pix_fmt", "yuva420p",
        "-b:v", "3.2M",
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

    # 3. Output GIF
    gif_path = "infinity_snap.gif"
    print(f"Encoding {gif_path}...")
    subprocess.run([
        "ffmpeg", "-y",
        "-framerate", str(FPS),
        "-i", "temp_rigged_frames/frame_%04d.png",
        "-filter_complex", "[0:v] split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=000000 [p]; [b][p] paletteuse=alpha_threshold=128",
        gif_path
    ], check=True)
    print(f"Saved {gif_path}")

    shutil.rmtree("temp_rigged_frames", ignore_errors=True)
    print("Done! Perfectly rigged Thanos Gauntlet snap animation created!")

if __name__ == "__main__":
    render_all()
