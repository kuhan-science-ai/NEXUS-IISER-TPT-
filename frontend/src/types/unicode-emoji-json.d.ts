declare module 'unicode-emoji-json' {
  interface UnicodeEmojiEntry {
    name: string;
    slug: string;
    group: string;
    emoji_version: string;
    skin_tone_support: boolean;
  }

  const data: Record<string, UnicodeEmojiEntry>;
  export default data;
}
