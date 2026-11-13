import type { MessengerEmoji } from './messengerEmojiCatalog';

export interface ShortcodeMatch { start: number; end: number; query: string; }

export const activeShortcodeAt = (text: string, caret: number): ShortcodeMatch | null => {
  const prefix = text.slice(0, caret);
  const match = prefix.match(/(^|[^\p{L}\p{N}_:]):([a-z0-9_+-]*)$/iu);
  if (!match) return null;
  const start = prefix.length - match[2].length - 1;
  return { start, end: caret, query: match[2].toLowerCase() };
};

export const convertCompletedShortcodes = (text: string, caret: number, lookup: Map<string, MessengerEmoji>) => {
  const pattern = /(^|[^\p{L}\p{N}_:]):([a-z0-9_+-]+):/giu;
  let next = '';
  let lastIndex = 0;
  let adjustment = 0;
  let cursorInsideReplacement: number | undefined;
  for (const match of text.matchAll(pattern)) {
    const item = lookup.get(match[2].toLowerCase());
    if (!item || match.index === undefined) continue;
    const tokenStart = match.index + match[1].length;
    const tokenEnd = tokenStart + match[2].length + 2;
    next += text.slice(lastIndex, tokenStart) + item.unicode;
    lastIndex = tokenEnd;
    if (tokenEnd <= caret) adjustment += item.unicode.length - (tokenEnd - tokenStart);
    else if (tokenStart < caret) cursorInsideReplacement = next.length;
  }
  if (lastIndex === 0) return { value: text, caret };
  next += text.slice(lastIndex);
  return { value: next, caret: cursorInsideReplacement ?? caret + adjustment };
};

export const rankEmoji = (emoji: MessengerEmoji, query: string) => {
  const needle = query.toLowerCase();
  const shortcodes = [emoji.shortcode, ...emoji.aliases].map(value => value.toLowerCase());
  if (shortcodes.includes(needle)) return 0;
  if (shortcodes.some(value => value.startsWith(needle))) return 1;
  if (emoji.name.toLowerCase().startsWith(needle)) return 2;
  if (emoji.keywords.some(value => value.startsWith(needle))) return 3;
  if (shortcodes.some(value => value.includes(needle)) || emoji.name.toLowerCase().includes(needle)) return 4;
  return emoji.keywords.some(value => value.includes(needle)) ? 5 : Number.POSITIVE_INFINITY;
};
