from PIL import Image
import numpy as np

# Check background color across frames 1 to 70
frames_arr = []
for i in range(1, 75):
    im = Image.open(f'all_video_frames/f_{i:04d}.png').convert('RGB')
    arr = np.array(im)
    frames_arr.append(arr)

# Background color is white (255, 255, 255)
# Let's verify top-left, top-right, bottom-left, bottom-right
print("Corner pixels in frame 1:", frames_arr[0][0, 0], frames_arr[0][0, -1], frames_arr[0][-1, 0], frames_arr[0][-1, -1])
print("Corner pixels in frame 30:", frames_arr[29][0, 0], frames_arr[29][0, -1], frames_arr[29][-1, 0], frames_arr[29][-1, -1])
print("Corner pixels in frame 52:", frames_arr[51][0, 0], frames_arr[51][0, -1], frames_arr[51][-1, 0], frames_arr[51][-1, -1])
