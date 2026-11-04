from PIL import Image
import numpy as np

img_path = r'C:/Users/kuhan/.gemini/antigravity/brain/51b17122-f69d-4e01-8ba2-1c4784dbd275/.user_uploaded/media_1793746465452_17e43fb0.jpg'
im = Image.open(img_path).convert('RGB')
arr = np.array(im)
h, w, _ = arr.shape

# Card mask
# Let's define the card area precisely
is_card = (arr[:, :, 0] > 190) & (arr[:, :, 1] > 190) & (arr[:, :, 2] > 190)
# Flood fill green background from borders
from collections import deque
bg = np.zeros((h, w), dtype=bool)
visited = np.zeros((h, w), dtype=bool)
q = deque()
for x in range(w):
    q.append((0, x))
    q.append((h-1, x))
    visited[0, x] = True
    visited[h-1, x] = True
for y in range(h):
    q.append((y, 0))
    q.append((y, w-1))
    visited[y, 0] = True
    visited[y, w-1] = True

while q:
    y, x = q.popleft()
    c = arr[y, x].astype(int)
    # Background is green or yellow confetti
    # Green is roughly R in [140, 180], G in [160, 200], B < 40
    # Yellow confetti is R > 200, G > 180, B < 60
    # Neither is white card (which is > 210, 210, 210)
    if not (c[0] > 200 and c[1] > 200 and c[2] > 200):
        bg[y, x] = True
        for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                visited[ny, nx] = True
                q.append((ny, nx))

print("Total border/background pixels:", bg.sum())
# Confetti in bg
confetti = bg & (arr[:, :, 0] > 180) & (arr[:, :, 1] > 160) & (arr[:, :, 2] < 80)
print("Confetti pixels in border:", confetti.sum())
# Where is confetti?
for y in range(0, h, 20):
    for x in range(0, w, 20):
        sub = confetti[y:y+20, x:x+20]
        if sub.sum() > 10:
            print(f"Confetti cluster near x={x}, y={y}")
