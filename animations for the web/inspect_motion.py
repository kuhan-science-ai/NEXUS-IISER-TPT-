from PIL import Image
import numpy as np

# Let's inspect the bounding box of the gauntlet and its colors at different frames
frames_to_check = [1, 15, 30, 48, 51, 55, 60, 100, 140, 150, 175, 178, 185, 202, 242, 260]

for fi in frames_to_check:
    arr = np.array(Image.open(f'all_video_frames/f_{fi:04d}.png'))
    # Background is white (255, 255, 255)
    bg_diff = np.max(np.abs(arr.astype(int) - 255), axis=2)
    mask = bg_diff > 20
    if mask.sum() > 0:
        y_idx, x_idx = np.where(mask)
        mean_c = arr[mask].mean(axis=0).astype(int)
        print(f"Frame {fi:03d} (t={fi/30:.2f}s): bbox=({x_idx.min()},{y_idx.min()}) to ({x_idx.max()},{y_idx.max()}), w={x_idx.max()-x_idx.min()}, h={y_idx.max()-y_idx.min()}, mean_color={mean_c}")
    else:
        print(f"Frame {fi:03d}: empty")
