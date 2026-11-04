import wave
import subprocess
import numpy as np

# Extract audio to wav
subprocess.run(['ffmpeg', '-y', '-i', r'C:/Users/kuhan/.gemini/antigravity/brain/51b17122-f69d-4e01-8ba2-1c4784dbd275/.user_uploaded/media_1793743840800_05f23336.mp4', '-vn', '-ac', '1', '-ar', '16000', 'temp_audio.wav'], check=True)

with wave.open('temp_audio.wav', 'rb') as w:
    frames = w.readframes(w.getnframes())
    rate = w.getframerate()
    samples = np.frombuffer(frames, dtype=np.int16)

# Find peaks in audio (where the snap sound occurs)
time = np.arange(len(samples)) / rate
abs_s = np.abs(samples)

# Print peaks above 20% max
thresh = abs_s.max() * 0.3
peak_indices = np.where(abs_s > thresh)[0]
if len(peak_indices) > 0:
    peak_times = time[peak_indices]
    print(f"Max audio amplitude: {abs_s.max()}")
    print(f"First major audio peak at t = {peak_times[0]:.3f}s (Frame ~ {int(peak_times[0]*30)})")
else:
    print("No audio peaks found (audio might be silent)")
