from PIL import Image
import numpy as np

# Find background color in the video
# In Google Easter egg, background is white (255, 255, 255)
# Let's check which frames have motion
diffs = []
for i in range(1, 336):
    im1 = np.array(Image.open(f'all_video_frames/f_{i:04d}.png'))
    im2 = np.array(Image.open(f'all_video_frames/f_{i+1:04d}.png'))
    diff = np.abs(im2.astype(float) - im1.astype(float)).mean()
    diffs.append((i, diff))

# Print intervals of motion
active_frames = [i for i, d in diffs if d > 0.5]
print("Active frames count:", len(active_frames))
if active_frames:
    print(f"Motion starts around frame {active_frames[0]} (t = {active_frames[0]/30:.2f}s)")
    print(f"Motion ends around frame {active_frames[-1]} (t = {active_frames[-1]/30:.2f}s)")

# Let's inspect largest frame changes
sorted_diffs = sorted(diffs, key=lambda x: x[1], reverse=True)
print("Top 10 largest frame changes:")
for i, d in sorted_diffs[:10]:
    print(f"Frame {i} -> {i+1}: diff = {d:.2f}")
