from PIL import Image
import numpy as np

arr = np.array(Image.open('gauntlet_open_clean.png'))
h, w, _ = arr.shape
print(f"Dimensions: {w}x{h}")

# Find stone centroids in this clean image
# Mind Stone (Yellow - large oval with white crescent in center)
# Knuckle stones:
# Orange (Pinky): left
# Red (Ring): mid-left
# Blue (Middle): center
# Purple (Index): mid-right
# Green (Time): on thumb (right side)

# Mind stone is near center x=160, y=250
# Let's inspect colors
for y_test in range(50, 400, 30):
    for x_test in range(30, 350, 40):
        c = arr[y_test, x_test]
        if c[3] > 100:
            pass

# Let's find stones by hue/color:
# Blue stone: B > 180, R < 80
by, bx = np.where((arr[:, :, 2] > 180) & (arr[:, :, 0] < 80))
if len(bx) > 0:
    print(f"Blue (Middle): ({bx.mean():.1f}, {by.mean():.1f})")

# Red stone: R > 180, G < 60, B < 60
ry, rx = np.where((arr[:, :, 0] > 180) & (arr[:, :, 1] < 60) & (arr[:, :, 2] < 60))
if len(rx) > 0:
    print(f"Red (Ring): ({rx.mean():.1f}, {ry.mean():.1f})")

# Purple stone: R > 120, B > 150, G < 100
py, px = np.where((arr[:, :, 0] > 120) & (arr[:, :, 2] > 150) & (arr[:, :, 1] < 100))
if len(px) > 0:
    print(f"Purple (Index): ({px.mean():.1f}, {py.mean():.1f})")

# Green stone: G > 180, R < 120, B < 120
gy, gx = np.where((arr[:, :, 1] > 180) & (arr[:, :, 0] < 120) & (arr[:, :, 2] < 120))
if len(gx) > 0:
    print(f"Green (Thumb): ({gx.mean():.1f}, {gy.mean():.1f})")

# Mind stone: bright yellow G > 200, R > 220, B < 80, in middle y > 180
my, mx = np.where((arr[:, :, 0] > 220) & (arr[:, :, 1] > 200) & (arr[:, :, 2] < 80) & (np.arange(h)[:, None] > 180) & (np.arange(h)[:, None] < 350))
if len(mx) > 0:
    print(f"Mind (Yellow): ({mx.mean():.1f}, {my.mean():.1f})")

# Orange stone: R > 200, G in [100, 180], B < 80, x < 100, y < 200
oy, ox = np.where((arr[:, :, 0] > 200) & (arr[:, :, 1] > 100) & (arr[:, :, 1] < 180) & (arr[:, :, 2] < 80) & (np.arange(w)[None, :] < 100) & (np.arange(h)[:, None] < 200))
if len(ox) > 0:
    print(f"Orange (Pinky): ({ox.mean():.1f}, {oy.mean():.1f})")
