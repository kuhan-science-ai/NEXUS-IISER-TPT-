import wave
import numpy as np

with wave.open('temp_audio.wav', 'rb') as w:
    frames = w.readframes(w.getnframes())
    rate = w.getframerate()
    samples = np.frombuffer(frames, dtype=np.int16)

time = np.arange(len(samples)) / rate
# Find all sound events
chunk_size = int(rate * 0.05) # 50ms chunks
for i in range(0, len(samples) - chunk_size, chunk_size):
    chunk = samples[i:i+chunk_size]
    rms = np.sqrt(np.mean(chunk.astype(float)**2))
    t = i / rate
    if rms > 200:
        print(f"t={t:.2f}s (Frame ~{int(t*30)}): RMS={rms:.0f}, max={np.abs(chunk).max()}")
