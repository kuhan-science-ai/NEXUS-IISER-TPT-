from PIL import Image
import numpy as np

# Print descriptions of frames 1 to 70
for i in range(1, 75, 5):
    im = Image.open(f'all_video_frames/f_{i:04d}.png')
    arr = np.array(im)
    # Check pixels around fingers / top
    # top is y < 40, middle is y 40..70, bottom is y > 70
    c_top = (arr[:40, :, :] < 200).sum()
    c_mid = (arr[40:70, :, :] < 200).sum()
    c_bot = (arr[70:, :, :] < 200).sum()
    print(f"Frame {i:03d}: top_pixels={c_top}, mid_pixels={c_mid}, bot_pixels={c_bot}")
