from PIL import Image
import numpy as np
from collections import deque

img_path = r'C:/Users/kuhan/.gemini/antigravity/brain/51b17122-f69d-4e01-8ba2-1c4784dbd275/.user_uploaded/media_1793746465452_17e43fb0.jpg'
im = Image.open(img_path).convert('RGB')
arr = np.array(im).copy()
h, w, _ = arr.shape

# 1. Identify Card Area vs Green Border Area
# Green border can be found by flood fill from image boundaries
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
    # Background is green border or yellow confetti, not white card (R>200, G>200, B>200)
    # Also in top-right near arrow, yellow is confetti
    if not (c[0] > 200 and c[1] > 200 and c[2] > 200):
        bg_mask[y, x] = True
        for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                visited[ny, nx] = True
                q.append((ny, nx))

card_mask = ~bg_mask

# 2. Clean White Card Background
# Inside the card:
# Text has dark colors (mean < 130)
# Green text "QUIZ CARD" has G > 140, R ~ 130, B < 40
# Question mark has R > 180, G > 190, B in [70, 150]
# Question mark dashed lines are dark (mean < 100)
# Everything else in card_mask is white background!
white_bg_mask = card_mask.copy()

# Exclude dark text & lines (mean < 150)
dark_mask = arr.mean(axis=2) < 150
white_bg_mask[dark_mask] = False

# Exclude "QUIZ CARD" green text (x < 350, y < 100, G > 120, B < 60)
quiz_card_text = (arr[:, :, 1] > 120) & (arr[:, :, 2] < 70) & (arr[:, :, 0] < 170) & (np.arange(w)[None, :] < 350) & (np.arange(h)[:, None] < 100)
white_bg_mask[quiz_card_text] = False

# Exclude question mark yellow fill (R > 180, G > 190, B in [60, 160])
qm_fill = (arr[:, :, 0] > 180) & (arr[:, :, 1] > 180) & (arr[:, :, 2] > 60) & (arr[:, :, 2] < 160) & (np.arange(w)[None, :] > 550)
white_bg_mask[qm_fill] = False

# Any pixel in white_bg_mask with high RGB should be pure 255, 255, 255
high_rgb = (arr[:, :, 0] > 200) & (arr[:, :, 1] > 200) & (arr[:, :, 2] > 200)
arr[white_bg_mask & high_rgb] = [255, 255, 255]

# 3. Clean Question Mark Fill
# The median color of the question mark fill is [224, 222, 113]
# Any pixel in qm_fill that was affected by watermark (e.g. brighter) should be set to [224, 222, 113]
# Also smooth out any watermark streaks in qm_fill
arr[qm_fill] = [224, 222, 113]

# 4. Clean Green Border Background
# In bg_mask:
# Confetti has R > 200, G > 170, B < 60
confetti_mask = bg_mask & (arr[:, :, 0] > 185) & (arr[:, :, 1] > 165) & (arr[:, :, 2] < 75)
# Green background pixels in bg_mask that are not confetti:
green_bg_mask = bg_mask & (~confetti_mask)
# Check border transition (anti-aliased edges of card and confetti)
# Only replace solid green area
# Median green is [155, 178, 0]
arr[green_bg_mask] = [155, 178, 0]

Image.fromarray(arr).save("cleaned_watermark_test.jpg", quality=98)
print("Saved cleaned_watermark_test.jpg")
