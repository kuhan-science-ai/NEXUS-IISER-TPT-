from PIL import Image
import numpy as np

img_path = r'C:/Users/kuhan/.gemini/antigravity/brain/51b17122-f69d-4e01-8ba2-1c4784dbd275/.user_uploaded/media_1793746465452_17e43fb0.jpg'
im = Image.open(img_path).convert('RGB')
arr = np.array(im)

# Inspect top-right corner of card: around x in [880, 920], y in [40, 70]
print("Top-right corner region:")
for y in range(45, 60, 2):
    print(f"y={y}: min_c={arr[y, 880:920].min()}, card_end_x={np.where((arr[y, 880:920] > 200).all(axis=1))[0].max() + 880 if (arr[y, 880:920] > 200).all(axis=1).any() else 'None'}")

# Inspect bottom-right corner: around x in [880, 920], y in [480, 510]
print("Bottom-right corner region:")
for y in range(490, 508, 2):
    print(f"y={y}: min_c={arr[y, 880:920].min()}, card_end_x={np.where((arr[y, 880:920] > 200).all(axis=1))[0].max() + 880 if (arr[y, 880:920] > 200).all(axis=1).any() else 'None'}")

# Inspect bottom-left corner: around x in [10, 40], y in [480, 510]
print("Bottom-left corner region:")
for y in range(490, 508, 2):
    print(f"y={y}: card_start_x={np.where((arr[y, 10:40] > 200).all(axis=1))[0].min() + 10 if (arr[y, 10:40] > 200).all(axis=1).any() else 'None'}")
