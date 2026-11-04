from PIL import Image
import numpy as np

img_path = r'C:/Users/kuhan/.gemini/antigravity/brain/51b17122-f69d-4e01-8ba2-1c4784dbd275/.user_uploaded/media_1793746465452_17e43fb0.jpg'
im = Image.open(img_path).convert('RGB')
arr = np.array(im)
h, w, _ = arr.shape

# Let's inspect rows 0 to 25 at x=100
for y in range(25):
    print(f"y={y:2d}: RGB={arr[y, 100]}")
