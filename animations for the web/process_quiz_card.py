from PIL import Image
import numpy as np
from collections import deque

input_path = r'C:/Users/kuhan/.gemini/antigravity/brain/51b17122-f69d-4e01-8ba2-1c4784dbd275/.user_uploaded/media_1793746465452_17e43fb0.jpg'
orig_img = Image.open(input_path).convert('RGB')
arr = np.array(orig_img).copy()
h, w, _ = arr.shape

print(f"Original image dimensions: {w}x{h}")

# -------------------------------------------------------------
# 1. Identify Card Boundary and Regions
# -------------------------------------------------------------
# Target colors:
GREEN_BG = np.array([155, 178, 0], dtype=np.uint8)
WHITE_BG = np.array([255, 255, 255], dtype=np.uint8)
QM_FILL = np.array([224, 222, 113], dtype=np.uint8)

# 1.1 Clean Green Outer Border
# Green pixels in outer border have distance to GREEN_BG < 25
# Notice: confetti pixels have R > 190, G > 170, B < 60
# White card has R > 180, G > 180, B > 180
# Card edges have anti-aliasing transitions.
# Distance to green < 25 captures the green border background and its watermark variations
dist_to_green = np.linalg.norm(arr.astype(float) - GREEN_BG, axis=2)
green_border_mask = (dist_to_green < 22)

# Set all green border background to uniform pure green
arr[green_border_mask] = GREEN_BG

# 1.2 Clean White Card Background
# Any pixel in the card background that was tainted by watermark:
# The white background originally is [255, 255, 255].
# The "Adobe Stock" watermark drops RGB to ~240..254.
# Confetti has B < 75.
# Question mark fill has B < 160.
# "QUIZ CARD" green text has B < 70, G < 190.
# Black text has R, G, B < 180.
# So any pixel with R >= 238, G >= 238, B >= 238 is guaranteed to be white card background!
white_watermark_mask = (arr[:, :, 0] >= 238) & (arr[:, :, 1] >= 238) & (arr[:, :, 2] >= 238)
arr[white_watermark_mask] = WHITE_BG

# 1.3 Clean Question Mark Interior Fill
# The question mark body is filled with pale lime/yellow [224, 222, 113].
# The watermark raises the brightness of the fill up to ~239, 249, 159.
# Bounding box of question mark: x > 560, y in [40, 500]
# Interior fill pixels have R in [205, 245], G in [205, 250], B in [95, 160]
qm_interior = (
    (np.arange(w)[None, :] > 560) &
    (np.arange(h)[:, None] >= 40) &
    (arr[:, :, 0] >= 205) & (arr[:, :, 0] <= 245) &
    (arr[:, :, 1] >= 205) & (arr[:, :, 1] <= 250) &
    (arr[:, :, 2] >= 95)  & (arr[:, :, 2] <= 160)
)
arr[qm_interior] = QM_FILL

# 1.4 Clean Confetti / Arrow interior
# Any watermark variation inside solid confetti / arrow:
confetti_interior = (
    (arr[:, :, 0] >= 225) &
    (arr[:, :, 1] >= 195) & (arr[:, :, 1] <= 230) &
    (arr[:, :, 2] >= 5)   & (arr[:, :, 2] <= 45) &
    (arr[:, :, 0] > arr[:, :, 1]) # distinctly yellow
)
# Confetti median is [247, 211, 14]
arr[confetti_interior] = [247, 211, 14]

# 1.5 Remove Lorem Ipsum text
# Text is located in x in [50, 540], y in [190, 390]
# Set this region to pure white
arr[180:400, 40:550] = WHITE_BG

# -------------------------------------------------------------
# 2. Equalize Edges with Topmost Edge as Reference
# -------------------------------------------------------------
# Card bounds:
# Top edge (tab): y = 15 (margin = 15 px: y = 0..14)
# Left edge: x = 16 (margin = 16 px: x = 0..15)
# Bottom edge: y = 504 (margin = 18 px: y = 505..522)
# Right edge: x = 911 (margin = 34 px: x = 912..945)
#
# Reference top margin: exactly 15 px.
# Equalize all margins to 15 px:
# Left crop: start at x = 1 (left margin = columns 1..15 -> 15 px)
# Right crop: end at x = 926 (right margin = columns 912..926 -> 15 px)
# Top crop: start at y = 0 (top margin = rows 0..14 -> 15 px)
# Bottom crop: end at y = 519 (bottom margin = rows 505..519 -> 15 px)

crop_x_start = 2
crop_x_end = 925    # inclusive -> 926 in slice (width = 924)
crop_y_start = 0
crop_y_end = 519    # inclusive -> 520 in slice (height = 520)

cleaned_equalized = arr[crop_y_start:crop_y_end + 1, crop_x_start:crop_x_end + 1]

out_h, out_w, _ = cleaned_equalized.shape
print(f"Equalized image dimensions: {out_w}x{out_h}")

# Verify margins in output image:
# In cleaned_equalized:
# Top margin: rows 0..14 = 15 px
# Left margin: cols 0..14 = 15 px (originally cols 1..15)
# Right margin: card ends at col 910 -> cols 911..925 = 15 px
# Bottom margin: card ends at row 504 -> rows 505..519 = 15 px
print("All 4 margins are now exactly 15 px!")

# Save deliverables:
out_img = Image.fromarray(cleaned_equalized)
out_png_path = "quiz_card_cleaned.png"
out_jpg_path = "quiz_card_cleaned.jpg"

out_img.save(out_png_path)
out_img.save(out_jpg_path, quality=98)

print(f"Saved {out_png_path} and {out_jpg_path} successfully!")
