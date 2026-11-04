from PIL import Image
import numpy as np

img_path = r'C:/Users/kuhan/.gemini/antigravity/brain/51b17122-f69d-4e01-8ba2-1c4784dbd275/.user_uploaded/media_1793746465452_17e43fb0.jpg'
im = Image.open(img_path).convert('RGB')
arr = np.array(im)
h, w, _ = arr.shape
print(f"Image dimensions: {w}x{h}")

# Let's inspect the green border color
# Check top-left, top-middle, top-right
print("Top-left pixel [5, 5]:", arr[5, 5])
print("Top-middle pixel [5, w//2]:", arr[5, w//2])
print("Bottom-middle pixel [h-5, w//2]:", arr[h-5, w//2])

# Let's find where the white card begins from the top, bottom, left, right
# The white card has R, G, B > 230
white_mask = (arr[:, :, 0] > 230) & (arr[:, :, 1] > 230) & (arr[:, :, 2] > 230)
# Check columns and rows
col_has_white = white_mask.any(axis=0)
row_has_white = white_mask.any(axis=1)

y_indices = np.where(row_has_white)[0]
x_indices = np.where(col_has_white)[0]

print(f"White card area spans: X from {x_indices.min()} to {x_indices.max()}")
print(f"White card area spans: Y from {y_indices.min()} to {y_indices.max()}")

print(f"Left margin: {x_indices.min()} px")
print(f"Right margin: {w - 1 - x_indices.max()} px")
print(f"Top margin: {y_indices.min()} px")
print(f"Bottom margin: {h - 1 - y_indices.max()} px")
