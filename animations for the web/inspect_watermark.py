from PIL import Image
import numpy as np

img_path = r'C:/Users/kuhan/.gemini/antigravity/brain/51b17122-f69d-4e01-8ba2-1c4784dbd275/.user_uploaded/media_1793746465452_17e43fb0.jpg'
im = Image.open(img_path).convert('RGB')
arr = np.array(im)
h, w, _ = arr.shape

# Let's inspect the watermarks
# Where are the "Adobe Stock" watermarks?
# They are translucent white/grey overlay text across the image.
# On the white background: "Adobe Stock" is light grey (~ 240..250)
# On the green background: "Adobe Stock" is lighter green
# On the yellow question mark: "Adobe Stock" is lighter yellow
# On the text: "Adobe Stock" intersects text and question mark lines

print("Image shape:", h, w)
