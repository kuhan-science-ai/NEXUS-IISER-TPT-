from PIL import Image

# Read frame 1, 50, 60
im = Image.open('all_video_frames/f_0001.png')
print("Frame 1:", im.size, im.mode)
im50 = Image.open('all_video_frames/f_0050.png')
print("Frame 50:", im50.size)
