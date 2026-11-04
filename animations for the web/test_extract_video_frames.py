from PIL import Image
import numpy as np
from collections import deque

def extract_transparent_frame(frame_path):
    im = Image.open(frame_path).convert('RGB')
    arr = np.array(im)
    h, w, _ = arr.shape

    # Flood fill from borders to identify white background
    bg_mask = np.zeros((h, w), dtype=bool)
    visited = np.zeros((h, w), dtype=bool)
    q = deque()

    for x in range(w):
        q.append((0, x))
        q.append((h - 1, x))
        visited[0, x] = True
        visited[h - 1, x] = True
    for y in range(h):
        q.append((y, 0))
        q.append((y, w - 1))
        visited[y, 0] = True
        visited[y, w - 1] = True

    while q:
        y, x = q.popleft()
        c = arr[y, x].astype(int)
        # White background is > 245 in all channels
        if c[0] > 240 and c[1] > 240 and c[2] > 240:
            bg_mask[y, x] = True
            for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                    visited[ny, nx] = True
                    q.append((ny, nx))

    # Calculate alpha with smooth anti-aliased edge
    alpha = np.where(bg_mask, 0, 255).astype(np.uint8)

    # For pixels on the border of the mask that are light, soften the alpha
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            if alpha[y, x] > 0 and bg_mask[y-1:y+2, x-1:x+2].any():
                c = arr[y, x].astype(float)
                brightness = c.mean()
                if brightness > 210:
                    alpha[y, x] = int(255 * (1.0 - (brightness - 210) / 45))

    rgba = np.dstack([arr, alpha])
    return Image.fromarray(rgba)

# Test on frame 1, 30, 52
t1 = extract_transparent_frame('all_video_frames/f_0001.png')
t1.save('test_trans_f1.png')
t52 = extract_transparent_frame('all_video_frames/f_0052.png')
t52.save('test_trans_f52.png')
print("Successfully extracted test transparent frames:", t1.size, t52.size)
