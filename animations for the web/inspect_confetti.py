from PIL import Image
import numpy as np

img_path = r'C:/Users/kuhan/.gemini/antigravity/brain/51b17122-f69d-4e01-8ba2-1c4784dbd275/.user_uploaded/media_1793746465452_17e43fb0.jpg'
im = Image.open(img_path).convert('RGB')
arr = np.array(im)
h, w, _ = arr.shape

# Yellow confetti in the green border:
# Green border has is_card == False
card_mask = (arr[:, :, 0] > 200) & (arr[:, :, 1] > 200) & (arr[:, :, 2] > 200)
# Confetti in non-card: yellow has R > 200, G > 180, B < 80
confetti_mask = (~card_mask) & (arr[:, :, 0] > 180) & (arr[:, :, 1] > 160) & (arr[:, :, 2] < 100)

y_c, x_c = np.where(confetti_mask)
print(f"Confetti pixels count: {len(x_c)}")
# Find clusters
from scipy.ndimage import label
# or simple bounding box
print("Confetti X range:", x_c.min() if len(x_c) else None, x_c.max() if len(x_c) else None)
print("Confetti Y range:", y_c.min() if len(y_c) else None, y_c.max() if len(y_c) else None)

for y in range(h):
    for x in range(w):
        if confetti_mask[y, x]:
            pass
