import React, { useEffect, useState } from 'react';
import emojiRegex from 'emoji-regex';

type TwemojiIndex = Record<string, string>;
let indexPromise: Promise<TwemojiIndex> | undefined;
const loadIndex = () => indexPromise ||= import('../data/twemojiAssetIndex.json').then(module => module.default as TwemojiIndex);
const emojiPattern = emojiRegex();
const normalizeEmoji = (value: string) => value.replace(/\uFE0F/g, '');

export const isEmojiOnly = (value: string) => {
  const matches = [...value.matchAll(emojiRegex())];
  return matches.length > 0 && value.replace(emojiRegex(), '').trim() === '';
};

interface TwemojiTextProps {
  children: string;
  className?: string;
  eager?: boolean;
}

export const TwemojiText: React.FC<TwemojiTextProps> = ({ children, className, eager = false }) => {
  const [assetIndex, setAssetIndex] = useState<TwemojiIndex | null>(null);
  useEffect(() => {
    if (emojiPattern.test(children)) void loadIndex().then(setAssetIndex);
    emojiPattern.lastIndex = 0;
  }, [children]);

  const segments: React.ReactNode[] = [];
  let cursor = 0;
  for (const match of children.matchAll(emojiRegex())) {
    const start = match.index ?? 0;
    const emoji = match[0];
    const filename = assetIndex?.[emoji] || assetIndex?.[normalizeEmoji(emoji)];
    if (start > cursor) segments.push(children.slice(cursor, start));
    if (filename) segments.push(<img key={`${start}-${emoji}`} className="nexus-twemoji" src={`/twemoji/svg/${filename}`} alt={emoji} draggable={false} loading={eager ? 'eager' : 'lazy'} />);
    else segments.push(emoji);
    cursor = start + emoji.length;
  }
  if (cursor < children.length) segments.push(children.slice(cursor));
  return <span className={className}>{segments}</span>;
};
