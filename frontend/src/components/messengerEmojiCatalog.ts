import type { EmojiMartData, Emoji as EmojiMartEmoji } from '@emoji-mart/data';
import assetIndex from '../data/twemojiAssetIndex.json';

export const EMOJI_CATEGORIES = ['Smileys', 'People', 'Animals', 'Food', 'Activities', 'Travel', 'Objects', 'Symbols', 'Flags'] as const;
export type EmojiCategory = typeof EMOJI_CATEGORIES[number];
export interface MessengerEmoji { unicode: string; shortcode: string; aliases: string[]; name: string; keywords: string[]; category: EmojiCategory; asset: string; }
type UnicodeEntry = { name: string; slug: string; group: string; skin_tone_support: boolean };
type UnicodeEmojiData = Record<string, UnicodeEntry>;
type RawEmoji = Omit<MessengerEmoji, 'asset'>;

let catalogPromise: Promise<MessengerEmoji[]> | undefined;
const assetByUnicode = assetIndex as Record<string, string>;
const assetBase = '/twemoji/svg/';
const normalizeUnicode = (emoji: string) => emoji.replace(/\ufe0f/g, '');
const unicodeCategory = (group: string): EmojiCategory => ({
  'Smileys & Emotion': 'Smileys', 'People & Body': 'People', 'Animals & Nature': 'Animals', 'Food & Drink': 'Food', Activities: 'Activities', 'Travel & Places': 'Travel', Objects: 'Objects', Symbols: 'Symbols', Flags: 'Flags',
} as Record<string, EmojiCategory>)[group] || 'Objects';
const martCategory = (id: string): EmojiCategory => ({ people: 'People', nature: 'Animals', foods: 'Food', activity: 'Activities', places: 'Travel', objects: 'Objects', symbols: 'Symbols', flags: 'Flags' } as Record<string, EmojiCategory>)[id] || 'Objects';
const getAsset = (unicode: string) => assetByUnicode[unicode] || assetByUnicode[normalizeUnicode(unicode)];
const keyTerms = (...values: (string | string[] | undefined)[]) => [...new Set(values.flatMap(value => Array.isArray(value) ? value : value ? [value] : []).map(value => value.toLowerCase()))];

const createCatalog = async (): Promise<MessengerEmoji[]> => {
  const [martModule, unicodeModule] = await Promise.all([import('@emoji-mart/data'), import('unicode-emoji-json')]);
  const mart = ((martModule as unknown as { default?: EmojiMartData }).default || martModule) as EmojiMartData;
  const unicodeData = ((unicodeModule as unknown as { default?: UnicodeEmojiData }).default || unicodeModule) as UnicodeEmojiData;
  const martEntries = new Map<string, { emoji: EmojiMartEmoji; category: EmojiCategory }>();
  const martIdsByNative = new Map<string, string>();
  for (const category of mart.categories) {
    for (const id of category.emojis) {
      const emoji = mart.emojis[id];
      const skin = emoji?.skins[0];
      if (!skin) continue;
      const emojiCategory = category.id === 'people' && category.emojis.indexOf(id) < 114 ? 'Smileys' : martCategory(category.id);
      martEntries.set(normalizeUnicode(skin.native), { emoji, category: emojiCategory });
      martIdsByNative.set(normalizeUnicode(skin.native), id);
    }
  }

  const entries = new Map<string, RawEmoji>();
  for (const [unicode, metadata] of Object.entries(unicodeData)) {
    const martMatch = martEntries.get(normalizeUnicode(unicode));
    entries.set(unicode, {
      unicode,
      shortcode: martMatch?.emoji.id || metadata.slug,
      aliases: [metadata.slug, ...(martMatch ? [martMatch.emoji.id] : [])],
      name: martMatch?.emoji.name || metadata.name,
      keywords: keyTerms(metadata.name, metadata.slug, martMatch?.emoji.name, martMatch?.emoji.keywords),
      category: martMatch?.category || unicodeCategory(metadata.group),
    });
  }

  const skinToneNames = ['light_skin_tone', 'medium_light_skin_tone', 'medium_skin_tone', 'medium_dark_skin_tone', 'dark_skin_tone'];
  for (const category of mart.categories) {
    for (const id of category.emojis) {
      const emoji = mart.emojis[id];
      if (!emoji) continue;
      for (const skin of emoji.skins.slice(1)) {
        if (entries.has(skin.native)) continue;
        const toneCodepoint = skin.unified.split('-').find(part => /^1f3f[bcdef]$/.test(part));
        const toneNumber = toneCodepoint ? parseInt(toneCodepoint.slice(-1), 16) - 10 : 0;
        const tone = skinToneNames[toneNumber - 1];
        const toneLabel = tone ? tone.replace(/_/g, ' ') : 'skin tone';
        entries.set(skin.native, {
          unicode: skin.native,
          shortcode: `${emoji.id}_tone${toneNumber || 2}`,
          aliases: [`${emoji.id}_tone${toneNumber || 2}`, `${emoji.id}_${tone || 'skin_tone'}`],
          name: `${emoji.name} ${toneLabel}`,
          keywords: keyTerms(emoji.id, emoji.name, emoji.keywords, toneLabel, tone),
          category: category.id === 'people' && category.emojis.indexOf(id) < 114 ? 'Smileys' : martCategory(category.id),
        });
      }
    }
  }

  const aliasesById = new Map<string, string[]>();
  for (const [alias, target] of Object.entries(mart.aliases)) aliasesById.set(target, [...(aliasesById.get(target) || []), alias]);
  const indexedEntries = [...entries.values()];
  for (const entry of indexedEntries) {
    const martId = martIdsByNative.get(normalizeUnicode(entry.unicode));
    if (martId) entry.aliases.push(...(aliasesById.get(martId) || []));
  }

  const filenames = new Set(Object.values(assetByUnicode));
  const knownAssets = new Set(indexedEntries.map(entry => getAsset(entry.unicode)).filter(Boolean));
  for (const filename of filenames) {
    if (knownAssets.has(filename)) continue;
    const codepoints = filename.slice(0, -4).split('-');
    if (codepoints.length === 1 && (/^1f1[ef][0-9a-f]$/.test(codepoints[0]) || /^1f3f[bcdef]$/.test(codepoints[0]))) continue;
    const unicode = codepoints.map(codepoint => String.fromCodePoint(parseInt(codepoint, 16))).join('');
    const category: EmojiCategory = codepoints.some(codepoint => /^1f1[ef][0-9a-f]$/.test(codepoint)) ? 'Flags'
      : codepoints.some(codepoint => /^1f[0-9a-f]{4}$/.test(codepoint) && parseInt(codepoint, 16) >= 0x1f300 && parseInt(codepoint, 16) <= 0x1faff) ? 'People'
        : 'Symbols';
    indexedEntries.push({ unicode, shortcode: `unicode_${codepoints.join('_')}`, aliases: [], name: `Emoji ${codepoints.map(codepoint => `U+${codepoint.toUpperCase()}`).join(' ')}`, keywords: keyTerms(...codepoints, 'emoji'), category });
  }

  return indexedEntries.flatMap(entry => {
    const filename = getAsset(entry.unicode);
    return filename ? [{ ...entry, aliases: [...new Set(entry.aliases)], asset: `${assetBase}${filename}` }] : [];
  });
};

export const loadMessengerEmojiCatalog = () => catalogPromise ||= createCatalog();
