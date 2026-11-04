from PIL import Image
import numpy as np

img_path = r'C:/Users/kuhan/.gemini/antigravity/brain/51b17122-f69d-4e01-8ba2-1c4784dbd275/.user_uploaded/media_1793746465452_17e43fb0.jpg'
im = Image.open(img_path).convert('RGB')
arr = np.array(im)

# Let's inspect the question mark fill
# Question mark is roughly x in [600, 900], y in [50, 450]
# Yellow fill has B < 150, R > 170, G > 190
qm_mask = (arr[:, :, 0] > 170) & (arr[:, :, 1] > 190) & (arr[:, :, 2] < 150) & (arr[:, :, 2] > 60)
print("Question mark pixels count:", qm_mask.sum())
if qm_mask.sum() > 0:
    qm_pixels = arr[qm_mask]
    print("QM min RGB:", qm_pixels.min(axis=0))
    print("QM max RGB:", qm_pixels.max(axis=0))
    print("QM mean RGB:", qm_pixels.mean(axis=0).astype(int))
    print("QM median RGB:", np.median(qm_pixels, axis=0).astype(int))

# Check the black text "Lorem Ipsum..."
# Black text has R < 120, G < 120, B < 120 in x in [50, 600], y in [180, 450]
text_mask = (arr[:, :, 0] < 120) & (arr[:, :, 1] < 120) & (arr[:, :, 2] < 120) & (np.arange(arr.shape[1])[None, :] < 580) & (np.arange(arr.shape[0])[:, None] > 180)
print("Text pixels count:", text_mask.sum())
if text_mask.sum() > 0:
    text_pixels = arr[text_mask]
    print("Text min RGB:", text_pixels.min(axis=0))
    print("Text max RGB:", text_pixels.max(axis=0))
    print("Text mean RGB:", text_pixels.mean(axis=0).astype(int))
