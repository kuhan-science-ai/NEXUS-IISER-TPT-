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
DURATION = 3.6  # seconds
TOTAL_FRAMES = int(FPS * DURATION)

CENTER_X = WIDTH / 2
TARGET_Y = 490  # Stationary resting Y position after rising

# Load the clean gauntlet image (379 x 714)
gauntlet_full = Image.open('gauntlet_open_clean.png').convert('RGBA')
gw, gh = gauntlet_full.size
print(f"Loaded gauntlet: {gw}x{gh}")

# We will cut out the gauntlet body below the knuckle line for the folded states:
# Knuckle line is approximately y = 145
body_arr = np.array(gauntlet_full).copy()
for y in range(145):
    for x in range(gw):
        # Keep thumb base on right if y > 200
        if y < 145:
            body_arr[y, x] = [0, 0, 0, 0]
gauntlet_body_only = Image.fromarray(body_arr)

# Finger knuckle anchor positions in original image (379x714):
# Pinky:  x = 91,  y = 145
# Ring:   x = 139, y = 156
# Middle: x = 210, y = 156
# Index:  x = 262, y = 164
# Thumb:  x = 333, y = 300

# The art style colors from the image:
OUTLINE_COLOR = (30, 20, 10, 255)
GOLD_MAIN = (235, 175, 45, 255)
GOLD_SHADOW = (185, 125, 20, 255)
GOLD_LIGHT = (255, 220, 110, 255)

def draw_finger_joint(draw, x1, y1, x2, y2, w1, w2):
    dx = x2 - x1
    dy = y2 - y1
    dist = math.hypot(dx, dy)
    if dist < 1:
        return
    nx = -dy / dist
    ny = dx / dist

    # Outline
    p1 = (x1 + nx * (w1 / 2), y1 + ny * (w1 / 2))
    p2 = (x2 + nx * (w2 / 2), y2 + ny * (w2 / 2))
    p3 = (x2 - nx * (w2 / 2), y2 - ny * (w2 / 2))
    p4 = (x1 - nx * (w1 / 2), y1 - ny * (w1 / 2))
    draw.polygon([p1, p2, p3, p4], fill=OUTLINE_COLOR)

    # Gold body
    ip1 = (x1 + nx * (w1 / 2 - 2.5), y1 + ny * (w1 / 2 - 2.5))
    ip2 = (x2 + nx * (w2 / 2 - 2.5), y2 + ny * (w2 / 2 - 2.5))
    ip3 = (x2 - nx * (w2 / 2 - 2.5), y2 - ny * (w2 / 2 - 2.5))
    ip4 = (x1 - nx * (w1 / 2 - 2.5), y1 - ny * (w1 / 2 - 2.5))
    draw.polygon([ip1, ip2, ip3, ip4], fill=GOLD_MAIN)

    # Shadow line
    sp1 = (x1 - nx * (w1 / 2 - 2.5), y1 - ny * (w1 / 2 - 2.5))
    sp2 = (x2 - nx * (w2 / 2 - 2.5), y2 - ny * (w2 / 2 - 2.5))
    sp3 = (x2 - nx * (w2 * 0.1), y2 - ny * (w2 * 0.1))
    sp4 = (x1 - nx * (w1 * 0.1), y1 - ny * (w1 * 0.1))
    draw.polygon([sp1, sp2, sp3, sp4], fill=GOLD_SHADOW)

    # Highlight line
    draw.line([
        (x1 + nx * (w1 * 0.25), y1 + ny * (w1 * 0.25)),
        (x2 + nx * (w2 * 0.25), y2 + ny * (w2 * 0.25))
    ], fill=GOLD_LIGHT, width=2)


def draw_folding_finger(draw, bx, by, angle_deg, length, curl_ratio, bw=28, tw=18):
    rad = math.radians(angle_deg)
    l1 = length * 0.38
    l2 = length * 0.34
    l3 = length * 0.32
    curl_ang = math.radians(curl_ratio * 80)

    a1 = rad - curl_ang * 0.4
    j1x = bx + math.cos(a1) * l1
    j1y = by + math.sin(a1) * l1

    a2 = a1 - curl_ang * 0.7
    j2x = j1x + math.cos(a2) * l2
    j2y = j1y + math.sin(a2) * l2

    a3 = a2 - curl_ang * 0.9
    tip_x = j2x + math.cos(a3) * l3
    tip_y = j2y + math.sin(a3) * l3

    draw_finger_joint(draw, bx, by, j1x, j1y, bw, bw * 0.88)
    draw_finger_joint(draw, j1x, j1y, j2x, j2y, bw * 0.88, bw * 0.72)
    draw_finger_joint(draw, j2x, j2y, tip_x, tip_y, bw * 0.72, tw)

    draw.ellipse([tip_x - tw * 0.45, tip_y - tw * 0.45, tip_x + tw * 0.45, tip_y + tw * 0.45], fill=OUTLINE_COLOR)
    draw.ellipse([tip_x - tw * 0.35, tip_y - tw * 0.35, tip_x + tw * 0.35, tip_y + tw * 0.35], fill=GOLD_MAIN)
    return (tip_x, tip_y)


def render_all_frames():
    os.makedirs("temp_user_snap_frames", exist_ok=True)
    frame_images = []

    # Timeline:
    # 0.0s -> 0.85s: Glove rises from bottom with ALL FIVE FINGERS OPEN
    # 0.85s -> 1.55s: The folding! Fingers fold down, stones power up with glowing halos & lightning arcs, thumb and middle finger touch in snap posture
    # 1.55s -> 1.62s: THE SNAP! Thumb snaps down, shockwave pulse
    # 1.62s -> 2.25s: A WHITE SCREEN APPEARS! Blinding 100% white flash covering the entire screen
    # 2.25s -> 3.6s: THE STATIONARY GAUNTLET AFTER THE SNAP! (Gauntlet stays in place, does not vanish!)

    SNAP_FRAME = int(1.55 * FPS)
    FLASH_START = SNAP_FRAME
    FLASH_PEAK = SNAP_FRAME + 2
    FLASH_END = SNAP_FRAME + int(0.65 * FPS)

    sparks = []
    scale = 0.95
    rw = int(gw * scale)
    rh = int(gh * scale)

    resized_full_gauntlet = gauntlet_full.resize((rw, rh), Image.Resampling.LANCZOS)
    resized_body_only = gauntlet_body_only.resize((rw, rh), Image.Resampling.LANCZOS)

    print(f"Rendering {TOTAL_FRAMES} frames...")

    for frame in range(TOTAL_FRAMES):
        t = frame / FPS
        img = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img, "RGBA")

        # 1. TIMING & MOTION
        if t < 0.85:
            # Glove comes into the screen from the bottom with ALL FIVE FINGERS OPEN
            rise_p = t / 0.85
            ease = 1.0 - math.pow(1.0 - rise_p, 3)
            current_y = (HEIGHT + 150) - ((HEIGHT + 150) - (TARGET_Y - 240)) * ease
            curl_progress = 0.0  # 100% OPEN FINGERS (Original asset image!)
            snap_state = 0.0
            gem_power = 0.1 * ease
        elif t < 1.55:
            # The folding!
            current_y = TARGET_Y - 240
            charge_p = (t - 0.85) / 0.70
            curl_progress = min(1.0, math.pow(charge_p, 1.25))
            snap_state = 0.0
            gem_power = 0.15 + 0.85 * math.pow(charge_p, 1.6)
            # Tension shake
            current_y += (random.random() - 0.5) * 3 * charge_p
        elif t < 1.65:
            # THE SNAP!
            current_y = TARGET_Y - 240
            curl_progress = 1.0
            snap_state = 1.0
            gem_power = 1.8
        else:
            # STATIONARY GAUNTLET AFTER THE SNAP!
            # Stays in place, resting stationary on screen
            current_y = TARGET_Y - 240
            curl_progress = 1.0
            snap_state = 1.0
            gem_power = max(0.0, 1.0 - (t - 1.65) * 1.5)

        gx = int(CENTER_X - rw / 2)
        gy = int(current_y)

        # 2. DRAWING GAUNTLET (OPEN OR FOLDING)
        g_layer = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
        g_draw = ImageDraw.Draw(g_layer, "RGBA")

        if curl_progress < 0.05:
            # Pure original asset with ALL FIVE FINGERS OPEN!
            g_layer.paste(resized_full_gauntlet, (gx, gy), resized_full_gauntlet)
        else:
            # Render articulated folded fingers
            p_base = (gx + int(91 * scale), gy + int(145 * scale))
            r_base = (gx + int(139 * scale), gy + int(156 * scale))
            m_base = (gx + int(210 * scale), gy + int(156 * scale))
            i_base = (gx + int(262 * scale), gy + int(164 * scale))
            t_base = (gx + int(333 * scale), gy + int(295 * scale))

            # Pinky
            draw_folding_finger(g_draw, p_base[0], p_base[1], -105, 100 * scale, curl_progress * 1.0, 24 * scale, 16 * scale)
            # Ring
            draw_folding_finger(g_draw, r_base[0], r_base[1], -95, 125 * scale, curl_progress * 1.0, 27 * scale, 18 * scale)
            # Middle (Snap finger)
            if snap_state < 0.5:
                draw_folding_finger(g_draw, m_base[0], m_base[1], -90, 140 * scale, curl_progress * 0.85, 29 * scale, 19 * scale)
            else:
                draw_folding_finger(g_draw, m_base[0], m_base[1], -75, 105 * scale, 1.15, 29 * scale, 18 * scale)
            # Index
            draw_folding_finger(g_draw, i_base[0], i_base[1], -82, 128 * scale, curl_progress * 0.35, 28 * scale, 18 * scale)

            # Paste Gauntlet Body (palm + armor + stones) over the knuckle base
            g_layer.paste(resized_body_only, (gx, gy), resized_body_only)

            # Thumb (sweeps across front of palm to middle finger tip)
            if snap_state < 0.5:
                start_a = -25
                target_a = -140
                cur_a = start_a + (target_a - start_a) * curl_progress
                draw_folding_finger(g_draw, t_base[0], t_base[1], cur_a, 110 * scale, curl_progress * 0.75, 32 * scale, 22 * scale)
            else:
                draw_folding_finger(g_draw, t_base[0], t_base[1], -165, 95 * scale, 1.15, 32 * scale, 20 * scale)

        # 3. INFINITY STONES GLOW & LIGHTNING
        if gem_power > 0.2:
            stones = [
                (gx + int(91 * scale), gy + int(135 * scale), (255, 140, 30)),   # Orange (Soul)
                (gx + int(139 * scale), gy + int(156 * scale), (255, 40, 50)),   # Red (Reality)
                (gx + int(210 * scale), gy + int(156 * scale), (40, 160, 255)),  # Blue (Space)
                (gx + int(262 * scale), gy + int(164 * scale), (180, 50, 255)),  # Purple (Power)
                (gx + int(333 * scale), gy + int(328 * scale), (40, 255, 100)),  # Green (Time)
                (gx + int(219 * scale), gy + int(259 * scale), (255, 230, 40)),  # Yellow (Mind)
            ]
            for sx, sy, sc in stones:
                r, g, b = sc
                glow_r = int(24 * gem_power * scale)
                alpha = int(140 * min(1.0, gem_power))
                g_draw.ellipse([sx - glow_r, sy - glow_r, sx + glow_r, sy + glow_r], fill=(r, g, b, alpha))

            # Lightning arcs
            if gem_power > 0.5:
                for a_i in range(len(stones) - 1):
                    p1 = stones[a_i]
                    p2 = stones[a_i + 1]
                    mx = (p1[0] + p2[0]) / 2 + random.uniform(-10, 10)
                    my = (p1[1] + p2[1]) / 2 + random.uniform(-10, 10)
                    arc_alpha = int(220 * (gem_power - 0.5) / 0.5)
                    g_draw.line([(p1[0], p1[1]), (mx, my), (p2[0], p2[1])], fill=(255, 255, 255, arc_alpha), width=2)
                    g_draw.line([(p1[0], p1[1]), (mx, my), (p2[0], p2[1])], fill=(160, 220, 255, int(arc_alpha * 0.6)), width=4)

        img.paste(g_layer, (0, 0), g_layer)

        # 4. SNAP SHOCKWAVE & SPARKS
        if frame >= SNAP_FRAME:
            snap_f = frame - SNAP_FRAME
            snap_t = snap_f / FPS
            snap_origin = (gx + int(210 * scale), gy + int(156 * scale))

            if snap_f < 5:
                for _ in range(25):
                    sparks.append({
                        'x': snap_origin[0], 'y': snap_origin[1],
                        'vx': math.cos(random.uniform(0, math.pi * 2)) * random.uniform(3, 10),
                        'vy': math.sin(random.uniform(0, math.pi * 2)) * random.uniform(3, 10),
                        'size': random.uniform(2, 5),
                        'life': 1.0,
                        'decay': 1 / (60 * random.uniform(0.7, 1.2)),
                        'color': random.choice([(255, 220, 40), (180, 50, 255), (40, 160, 255), (255, 40, 50)])
                    })

            if snap_t < 0.5:
                sw_prog = snap_t / 0.5
                sw_rad = 340 * (sw_prog ** 0.7)
                sw_alpha = int(255 * (1 - sw_prog)**1.5)
                if sw_alpha > 0 and sw_rad > 2:
                    draw.ellipse([
                        snap_origin[0] - sw_rad, snap_origin[1] - sw_rad,
                        snap_origin[0] + sw_rad, snap_origin[1] + sw_rad
                    ], outline=(255, 230, 120, sw_alpha), width=max(1, int(10 * (1 - sw_prog))))

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

        # 5. WHITE SCREEN FLASH!
        if FLASH_START <= frame <= FLASH_END:
            if frame <= FLASH_PEAK:
                flash_ratio = (frame - FLASH_START) / max(1, FLASH_PEAK - FLASH_START)
                flash_alpha = int(255 * flash_ratio)
            else:
                flash_ratio = (frame - FLASH_PEAK) / (FLASH_END - FLASH_PEAK)
                flash_alpha = int(255 * math.pow(1.0 - flash_ratio, 1.4))

            if flash_alpha > 0:
                draw.rectangle([0, 0, WIDTH, HEIGHT], fill=(255, 255, 255, flash_alpha))

        frame_path = f"temp_user_snap_frames/frame_{frame:04d}.png"
        img.save(frame_path, "PNG")
        frame_images.append(img)

    print("All frames rendered successfully.")

    # 1. Output WebM transparent video
    webm_path = "infinity_snap.webm"
    print(f"Encoding {webm_path} (Transparent VP9)...")
    subprocess.run([
        "ffmpeg", "-y",
        "-framerate", str(FPS),
        "-i", "temp_user_snap_frames/frame_%04d.png",
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
        "-i", "temp_user_snap_frames/frame_%04d.png",
        "-filter_complex", "[0:v] split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=000000 [p]; [b][p] paletteuse=alpha_threshold=128",
        gif_path
    ], check=True)
    print(f"Saved {gif_path}")

    shutil.rmtree("temp_user_snap_frames", ignore_errors=True)
    print("Done! Perfectly rigged animation matching your exact asset created!")

if __name__ == "__main__":
    render_all_frames()
