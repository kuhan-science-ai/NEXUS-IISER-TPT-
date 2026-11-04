export interface PaletteImageAnalysis {
  dataUrl: string;
  background: string;
  surface: string;
  primary: string;
  secondary: string;
}

type ColorBucket = { count: number; r: number; g: number; b: number };

const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
const toHex = (r: number, g: number, b: number) => `#${[r, g, b].map(value => clamp(value).toString(16).padStart(2, '0')).join('')}`;
const mix = (color: string, other: string, amount: number) => {
  const a = color.slice(1).match(/.{2}/g)!.map(value => parseInt(value, 16));
  const b = other.slice(1).match(/.{2}/g)!.map(value => parseInt(value, 16));
  return toHex(...a.map((value, index) => value * (1 - amount) + b[index] * amount) as [number, number, number]);
};
const luminance = (color: string) => {
  const [r, g, b] = color.slice(1).match(/.{2}/g)!.map(value => parseInt(value, 16));
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};
const saturation = (color: string) => {
  const channels = color.slice(1).match(/.{2}/g)!.map(value => parseInt(value, 16) / 255);
  return Math.max(...channels) - Math.min(...channels);
};
const distance = (left: string, right: string) => {
  const a = left.slice(1).match(/.{2}/g)!.map(value => parseInt(value, 16));
  const b = right.slice(1).match(/.{2}/g)!.map(value => parseInt(value, 16));
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
};

function dominantColors(bitmap: ImageBitmap): string[] {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Your browser could not analyze this image.');
  context.drawImage(bitmap, 0, 0, 64, 64);
  const pixels = context.getImageData(0, 0, 64, 64).data;
  const buckets = new Map<number, ColorBucket>();

  for (let index = 0; index < pixels.length; index += 16) {
    const alpha = pixels[index + 3];
    if (alpha < 150) continue;
    const r = pixels[index], g = pixels[index + 1], b = pixels[index + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 };
    bucket.count += 1;
    bucket.r += r; bucket.g += g; bucket.b += b;
    buckets.set(key, bucket);
  }

  return [...buckets.values()]
    .sort((left, right) => right.count - left.count)
    .map(bucket => toHex(bucket.r / bucket.count, bucket.g / bucket.count, bucket.b / bucket.count))
    .filter((color, index, colors) => colors.slice(0, index).every(previous => distance(color, previous) > 42))
    .slice(0, 8);
}

function colorsFromImage(bitmap: ImageBitmap): Pick<PaletteImageAnalysis, 'background' | 'surface' | 'primary' | 'secondary'> {
  const colors = dominantColors(bitmap);
  if (!colors.length) throw new Error('No usable colors were found in this image.');

  const darkCandidates = colors.filter(color => luminance(color) < 0.58);
  const base = darkCandidates[0] || [...colors].sort((left, right) => luminance(left) - luminance(right))[0];
  const colorful = colors.filter(color => saturation(color) > 0.2).sort((left, right) => saturation(right) - saturation(left));
  const primarySource = colorful[0] || colors[0];
  const secondarySource = colorful.find(color => distance(color, primarySource) > 78) || colors.find(color => distance(color, primarySource) > 78) || '#65d5be';
  const background = mix(base, '#101722', 0.62);
  const surface = mix(colors.find(color => distance(color, background) > 45) || base, '#172330', 0.46);
  const vividAccent = (color: string) => luminance(color) < 0.28 ? mix(color, '#ffffff', 0.52) : luminance(color) > 0.86 ? mix(color, '#15202b', 0.28) : color;

  return { background, surface, primary: vividAccent(primarySource), secondary: vividAccent(secondarySource) };
}

export async function analyzePaletteImage(file: File): Promise<PaletteImageAnalysis> {
  const supportedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!supportedTypes.includes(file.type)) throw new Error('Choose a JPEG, PNG, or WebP image.');
  if (file.size > 8 * 1024 * 1024) throw new Error('Choose an image smaller than 8 MB.');

  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error('This image could not be opened. Try another picture.'); }

  try {
    const colors = colorsFromImage(bitmap);
    let maxSide = 1200;
    let quality = 0.76;
    let dataUrl = '';
    while (maxSide >= 640) {
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Your browser could not prepare this image.');
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      dataUrl = canvas.toDataURL('image/jpeg', quality);
      if (dataUrl.length <= 1_000_000) break;
      maxSide -= 200;
      quality -= 0.04;
    }
    if (dataUrl.length > 1_000_000) throw new Error('This image is too detailed to save as a background. Try a smaller picture.');
    return { dataUrl, ...colors };
  } finally {
    bitmap.close();
  }
}
