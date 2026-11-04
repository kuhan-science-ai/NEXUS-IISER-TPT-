from PIL import Image
import numpy as np

im = Image.open('gauntlet_isolated.png')
arr = np.array(im)

# Stones colors:
# Orange (left): R high, G medium, B low
# Red: R high, G low, B low
# Blue: R low, G medium/high, B high
# Purple: R high, G low, B high
# Green (thumb): R low, G high, B low
# Yellow (Mind): R high, G high, B low (center)

h, w, _ = arr.shape
print(f'Isolated gauntlet dimensions: {w}x{h}')

# Let's find centroids of the stones
# Mind Stone (Yellow): ~ center
mind_mask = (arr[:, :, 0] > 200) & (arr[:, :, 1] > 180) & (arr[:, :, 2] < 50)
my, mx = np.where(mind_mask)
print(f'Mind stone centroid: ({mx.mean():.1f}, {my.mean():.1f})')

# Green Stone (Time):
green_mask = (arr[:, :, 1] > 150) & (arr[:, :, 0] < 100) & (arr[:, :, 2] < 120)
gy, gx = np.where(green_mask)
print(f'Green stone centroid: ({gx.mean():.1f}, {gy.mean():.1f})')

# Blue Stone (Space):
blue_mask = (arr[:, :, 2] > 200) & (arr[:, :, 0] < 60)
by, bx = np.where(blue_mask)
print(f'Blue stone centroid: ({bx.mean():.1f}, {by.mean():.1f})')

# Purple Stone (Power):
purple_mask = (arr[:, :, 0] > 160) & (arr[:, :, 2] > 180) & (arr[:, :, 1] < 100)
py, px = np.where(purple_mask)
print(f'Purple stone centroid: ({px.mean():.1f}, {py.mean():.1f})')

# Red Stone (Reality):
red_mask = (arr[:, :, 0] > 180) & (arr[:, :, 1] < 50) & (arr[:, :, 2] < 50)
ry, rx = np.where(red_mask)
print(f'Red stone centroid: ({rx.mean():.1f}, {ry.mean():.1f})')

# Orange Stone (Soul):
orange_mask = (arr[:, :, 0] > 220) & (arr[:, :, 1] > 100) & (arr[:, :, 1] < 180) & (arr[:, :, 2] < 50) & (mx[0] is not None)
# Filter by y < 200 and x < 100
oy, ox = np.where(orange_mask & (np.arange(h)[:, None] < 200) & (np.arange(w)[None, :] < 100))
print(f'Orange stone centroid: ({ox.mean():.1f}, {oy.mean():.1f})')
