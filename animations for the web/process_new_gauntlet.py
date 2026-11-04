from PIL import Image
import numpy as np

img_path = r'C:/Users/kuhan/.gemini/antigravity/brain/51b17122-f69d-4e01-8ba2-1c4784dbd275/.user_uploaded/media_1793743523990_0aaae566.jpg'
im = Image.open(img_path).convert('RGB')
arr = np.array(im)

h, w, _ = arr.shape
print(f"Image dimensions: {w}x{h}")

# Background is pure white (255, 255, 255)
# Check threshold: pixels that are white or very close to white
# In the drawing, dark outlines are black/brown (RGB < 120), gold is ~ (230, 180, 40)
# Outer glow around stones: orange, red, blue, purple, green halos
# Let's do flood fill from the edges to only remove the outside white background
from collections import deque

bg_mask = np.zeros((h, w), dtype=bool)
visited = np.zeros((h, w), dtype=bool)

# Start queue from all borders
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
    # Check if pixel is white or light background
    c = arr[y, x].astype(int)
    # Background threshold: white is (255, 255, 255)
    # The stone glow halos are faint colors, but the outer background is > 248
    if c[0] > 245 and c[1] > 245 and c[2] > 245:
        bg_mask[y, x] = True
        for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                visited[ny, nx] = True
                q.append((ny, nx))

fg_mask = (~bg_mask).astype(np.uint8) * 255

# Create transparent RGBA
rgba = np.dstack([arr, fg_mask])

# Remove the faint pink watermark "Enderstrill" near x=340..480, y=420..480
# Pink text has high red, low green/blue on the gold background
for y in range(410, 480):
    for x in range(330, 480):
        r, g, b = arr[y, x]
        # Pinkish watermark: R > 200, G in 180..220, B in 190..230 and B significantly higher than gold
        if r > 210 and b > 180 and abs(int(r) - int(b)) < 40 and g > 180:
            # Replace with nearby gold tone
            gold_color = arr[y, 310]
            rgba[y, x, :3] = gold_color

clean_im = Image.fromarray(rgba)
clean_im.save("gauntlet_open_clean.png")

# Find bbox of the gauntlet
y_idx, x_idx = np.where(fg_mask > 0)
print(f"Gauntlet BBox: x=[{x_idx.min()}, {x_idx.max()}], y=[{y_idx.min()}, {y_idx.max()}]")
print(f"Gauntlet Size: {x_idx.max() - x_idx.min()} x {y_idx.max() - y_idx.min()}")
