from PIL import Image
import numpy as np

img_path = r'C:/Users/kuhan/.gemini/antigravity/brain/51b17122-f69d-4e01-8ba2-1c4784dbd275/.user_uploaded/media_1793743523990_0aaae566.jpg'
im = Image.open(img_path).convert('RGB')
arr = np.array(im)

# Crop out the bottom artifact lines (y < 714)
h, w, _ = arr.shape
arr = arr[:714, :]
h, w, _ = arr.shape

# Threshold for white background:
# Notice the background is (255, 255, 255)
# Some faint glow halos around stones can be kept or blended, but pure background is > 240
# Let's do BFS from borders on the 714x600 image:
from collections import deque

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
    # Check if pixel is white background (near 255)
    # Allow slightly soft threshold (R>230, G>230, B>230, or diff < 20 from 255)
    if c[0] > 232 and c[1] > 232 and c[2] > 232:
        bg_mask[y, x] = True
        for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                visited[ny, nx] = True
                q.append((ny, nx))

fg_mask = (~bg_mask).astype(np.uint8) * 255

# Feather the edge slightly for smooth anti-aliased transparency
# Clean any watermark in right area
# Watermark is "Enderstrill" in pink
for y in range(400, 480):
    for x in range(330, 480):
        if fg_mask[y, x] > 0:
            r, g, b = arr[y, x]
            if r > 215 and b > 190 and g > 190:
                # Replace with surrounding gold
                arr[y, x] = arr[y, 310]

rgba = np.dstack([arr, fg_mask])

# Find gauntlet bounding box
y_idx, x_idx = np.where(fg_mask > 0)
x1, y1, x2, y2 = x_idx.min(), y_idx.min(), x_idx.max(), y_idx.max()

print(f"Clean Gauntlet BBox: ({x1}, {y1}) to ({x2}, {y2}) -> {x2-x1+1} x {y2-y1+1}")
clean_gauntlet = Image.fromarray(rgba[y1:y2+1, x1:x2+1])
clean_gauntlet.save("gauntlet_open_clean.png")
print("Saved clean_gauntlet as gauntlet_open_clean.png")
