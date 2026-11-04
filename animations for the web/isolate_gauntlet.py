from PIL import Image
import numpy as np
from collections import deque

orig_path = r'C:/Users/kuhan/.gemini/antigravity/brain/51b17122-f69d-4e01-8ba2-1c4784dbd275/.user_uploaded/media_1793739505370_adc0ae1d.webp'
im = Image.open(orig_path).convert('RGB')
arr = np.array(im)
h, w, _ = arr.shape

# BFS floodfill from (0, 0)
# Background color is ~ (232, 232, 232)
# Gauntlet boundary is thick dark line (RGB < 120)
bg_mask = np.zeros((h, w), dtype=bool)
visited = np.zeros((h, w), dtype=bool)

q = deque([(0, 0), (0, w-1), (h-1, 0)])
for y, x in q:
    visited[y, x] = True

# Target color
bg_ref = np.array([232, 232, 232], dtype=np.int32)

while q:
    y, x = q.popleft()
    bg_mask[y, x] = True

    for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
        ny, nx = y + dy, x + dx
        if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
            visited[ny, nx] = True
            color = arr[ny, nx].astype(np.int32)
            # Check if this pixel is background (near 232, and not dark boundary)
            diff = np.max(np.abs(color - bg_ref))
            # Also dark outline is color < 100
            if diff < 22:
                q.append((ny, nx))

fg_mask = (~bg_mask).astype(np.uint8) * 255
# Remove any watermark residue in bottom-right (x > 750)
fg_mask[:, 750:] = 0

rgba = np.dstack([arr, fg_mask])

# Find bounding box
y_indices, x_indices = np.where(fg_mask > 0)
x1, y1, x2, y2 = x_indices.min(), y_indices.min(), x_indices.max(), y_indices.max()

cropped = rgba[y1:y2+1, x1:x2+1]
Image.fromarray(cropped).save('gauntlet_isolated.png')
print(f'Gauntlet cleanly isolated: {x2-x1+1}x{y2-y1+1} at bbox ({x1}, {y1}) - ({x2}, {y2})')
