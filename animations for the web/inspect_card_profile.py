from PIL import Image
import numpy as np

img_path = r'C:/Users/kuhan/.gemini/antigravity/brain/51b17122-f69d-4e01-8ba2-1c4784dbd275/.user_uploaded/media_1793746465452_17e43fb0.jpg'
im = Image.open(img_path).convert('RGB')
arr = np.array(im)
h, w, _ = arr.shape

# Let's inspect along columns to find top edge of white card
# Across x from 0 to w: where does white begin?
top_edges = []
bottom_edges = []
left_edges = []
right_edges = []

for x in range(w):
    col = arr[:, x]
    # Check if white/card
    is_card = (col[:, 0] > 200) & (col[:, 1] > 200) & (col[:, 2] > 200)
    indices = np.where(is_card)[0]
    if len(indices) > 0:
        top_edges.append((x, indices.min()))
        bottom_edges.append((x, indices.max()))

print("Top edge at x=100 (inside QUIZ CARD tab):", [t for x, t in top_edges if x == 100])
print("Top edge at x=400 (main card body):", [t for x, t in top_edges if x == 400])
print("Top edge at x=700 (near question mark):", [t for x, t in top_edges if x == 700])
print("Bottom edge at x=400:", [b for x, b in bottom_edges if x == 400])

for y in range(h):
    row = arr[y, :]
    is_card = (row[:, 0] > 200) & (row[:, 1] > 200) & (row[:, 2] > 200)
    indices = np.where(is_card)[0]
    if len(indices) > 0:
        left_edges.append((y, indices.min()))
        right_edges.append((y, indices.max()))

print("Left edge at y=300:", [l for y, l in left_edges if y == 300])
print("Right edge at y=300:", [r for y, r in right_edges if y == 300])
