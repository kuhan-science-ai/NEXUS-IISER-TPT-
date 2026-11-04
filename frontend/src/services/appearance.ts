export const UI_PALETTE_STORAGE_KEY = 'nexus-interior-ui-palette';
export const CUSTOM_UI_PALETTES_STORAGE_KEY = 'nexus-custom-interior-ui-palettes';

export interface CustomUiPalette {
  id: `custom-${string}`;
  name: string;
  background: string;
  surface: string;
  primary: string;
  secondary: string;
  animated: boolean;
  backgroundImage?: string;
}

export const UI_PALETTES = {
  slate: { name: 'Slate', colors: ['#36393f', '#5865f2', '#3ba55c'] },
  ocean: { name: 'Ocean', colors: ['#12263b', '#4ca9e8', '#4dc8bd'] },
  forest: { name: 'Forest', colors: ['#172b22', '#55c990', '#b7d66e'] },
  plum: { name: 'Plum', colors: ['#2b2034', '#b07bea', '#e58bb4'] },
  rose: { name: 'Rose', colors: ['#35232d', '#ee83a8', '#f0b36e'] },
  aurora: { name: 'Aurora', colors: ['#182b35', '#68d7c4', '#9c9af8'] },
  ember: { name: 'Ember', colors: ['#30251f', '#f39a58', '#e36e73'] },
  lavender: { name: 'Lavender', colors: ['#29263a', '#a99af7', '#79cce0'] },
} as const;

export type UiPaletteId = keyof typeof UI_PALETTES | `custom-${string}`;

export function readCustomUiPalettes(): CustomUiPalette[] {
  try {
    const stored = JSON.parse(localStorage.getItem(CUSTOM_UI_PALETTES_STORAGE_KEY) || '[]');
    if (!Array.isArray(stored)) return [];
    return stored.filter((palette): palette is CustomUiPalette =>
      palette && typeof palette.id === 'string' && palette.id.startsWith('custom-')
      && typeof palette.name === 'string' && /^#[\da-f]{6}$/i.test(palette.background)
      && /^#[\da-f]{6}$/i.test(palette.surface) && /^#[\da-f]{6}$/i.test(palette.primary)
      && /^#[\da-f]{6}$/i.test(palette.secondary) && typeof palette.animated === 'boolean'
      && (palette.backgroundImage === undefined || (typeof palette.backgroundImage === 'string' && palette.backgroundImage.length <= 1_400_000 && /^data:image\/(jpeg|webp);base64,/i.test(palette.backgroundImage)))
    );
  } catch {
    return [];
  }
}

export function readUiPalette(): UiPaletteId {
  try {
    const stored = localStorage.getItem(UI_PALETTE_STORAGE_KEY);
    if (stored && stored in UI_PALETTES) return stored as UiPaletteId;
    if (stored && readCustomUiPalettes().some(palette => palette.id === stored)) return stored as UiPaletteId;
    return 'slate';
  } catch {
    return 'slate';
  }
}

const colorIsLight = (hex: string) => {
  const value = hex.slice(1);
  const [r, g, b] = [0, 2, 4].map(index => parseInt(value.slice(index, index + 2), 16) / 255);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.48;
};

export function customPaletteStyle(id: UiPaletteId, theme: 'dark' | 'light', preview?: CustomUiPalette): CSSProperties | undefined {
  const palette = preview || readCustomUiPalettes().find(item => item.id === id);
  if (!palette) return undefined;

  const canvas = theme === 'light' ? `color-mix(in srgb, ${palette.background} 8%, #ffffff)` : palette.background;
  const surface = theme === 'light' ? `color-mix(in srgb, ${palette.surface} 5%, #ffffff)` : palette.surface;
  const navigation = theme === 'light'
    ? `color-mix(in srgb, ${palette.background} 12%, #ffffff)`
    : `color-mix(in srgb, ${palette.background} 82%, ${palette.surface})`;
  const raised = theme === 'light'
    ? `color-mix(in srgb, ${palette.surface} 10%, #ffffff)`
    : `color-mix(in srgb, ${palette.surface} 88%, #ffffff)`;
  const elevated = theme === 'light'
    ? `color-mix(in srgb, ${palette.surface} 16%, #ffffff)`
    : `color-mix(in srgb, ${palette.surface} 80%, #ffffff)`;
  const isLight = theme === 'light' || colorIsLight(palette.background);
  const primary = theme === 'light' ? `color-mix(in srgb, ${palette.primary} 78%, #000000)` : palette.primary;
  const secondary = theme === 'light' ? `color-mix(in srgb, ${palette.secondary} 78%, #000000)` : palette.secondary;
  const text = isLight ? '#252b3a' : '#f2f3f5';
  const muted = isLight ? '#536071' : '#b9bbbe';
  const subtle = isLight ? '#68748a' : '#8e9297';

  return {
    '--ui-background-image': palette.backgroundImage ? `url("${palette.backgroundImage}")` : 'none',
    '--bg-canvas': canvas,
    '--bg-navigation': navigation,
    '--bg-surface': surface,
    '--bg-raised': raised,
    '--bg-elevated': elevated,
    '--border': `color-mix(in srgb, ${surface} 72%, ${text})`,
    '--border-subtle': `color-mix(in srgb, ${surface} 86%, ${text})`,
    '--border-bright': `color-mix(in srgb, ${surface} 58%, ${text})`,
    '--primary': primary,
    '--primary-hover': `color-mix(in srgb, ${primary} 82%, ${text})`,
    '--primary-pressed': `color-mix(in srgb, ${primary} 78%, #000000)`,
    '--primary-glow': `color-mix(in srgb, ${primary} 24%, transparent)`,
    '--primary-glow-strong': `color-mix(in srgb, ${primary} 38%, transparent)`,
    '--secondary': secondary,
    '--secondary-glow': `color-mix(in srgb, ${secondary} 22%, transparent)`,
    '--accent-cyan': secondary,
    '--text-primary': text,
    '--text-muted': muted,
    '--text-subtle': subtle,
    '--text-faint': `color-mix(in srgb, ${subtle} 70%, ${surface})`,
  } as CSSProperties;
}
import type { CSSProperties } from 'react';

