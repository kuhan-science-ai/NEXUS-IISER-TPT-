import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import type { EmojiCategory, MessengerEmoji } from './messengerEmojiCatalog';
import { rankEmoji } from './messengerEmojiShortcodes';

interface EmojiPickerButtonProps {
  onSelect: (emoji: string) => void;
  title?: string;
  ariaLabel?: string;
  className?: string;
  children: React.ReactNode;
}

type Position = { left: number; top: number; width: number };
const EMOJI_CATEGORIES: EmojiCategory[] = ['Smileys', 'People', 'Animals', 'Food', 'Activities', 'Travel', 'Objects', 'Symbols', 'Flags'];
let emojiCatalogPromise: Promise<MessengerEmoji[]> | undefined;
const loadEmojiCatalog = () => emojiCatalogPromise ||= import('./messengerEmojiCatalog').then(module => module.loadMessengerEmojiCatalog());

export const EmojiPickerButton: React.FC<EmojiPickerButtonProps> = ({ onSelect, title = 'Add reaction', ariaLabel = 'Add reaction', className, children }) => {
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<MessengerEmoji[] | null>(null);
  const [category, setCategory] = useState<'All' | EmojiCategory>('All');
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState<Position | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLElement | null>(null);

  const placePicker = () => {
    const anchor = triggerRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(360, window.innerWidth - 24);
    const height = Math.min(430, window.innerHeight - 24);
    setPosition({
      left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
      top: Math.max(12, Math.min(rect.top - height - 8, window.innerHeight - height - 12)),
      width,
    });
  };

  const toggle = () => {
    if (open) { setOpen(false); return; }
    void loadEmojiCatalog().then(setCatalog).catch(() => setCatalog([]));
    placePicker();
    setSearch('');
    setCategory('All');
    setOpen(true);
  };

  const items = useMemo(() => {
    if (!catalog) return [];
    const query = search.trim().toLowerCase();
    if (query) return catalog.map(emoji => ({ emoji, rank: rankEmoji(emoji, query) }))
      .filter(item => Number.isFinite(item.rank))
      .sort((left, right) => left.rank - right.rank || left.emoji.name.localeCompare(right.emoji.name))
      .map(item => item.emoji);
    return category === 'All' ? catalog : catalog.filter(emoji => emoji.category === category);
  }, [catalog, search, category]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || popupRef.current?.contains(target)) return;
      setOpen(false);
    };
    const reposition = () => placePicker();
    document.addEventListener('mousedown', closeOutside);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('mousedown', closeOutside);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open]);

  const choose = (emoji: MessengerEmoji) => { onSelect(emoji.unicode); setOpen(false); };

  return <>
    <button ref={triggerRef} type="button" className={className} title={title} aria-label={ariaLabel} aria-expanded={open} onClick={toggle}>{children}</button>
    {open && position && createPortal(<section ref={popupRef as React.RefObject<HTMLElement>} className="nexus-emoji-picker" style={{ left: position.left, top: position.top, width: position.width }} aria-label="Choose a reaction">
      <div className="nexus-emoji-picker-search"><Search size={15} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search all emoji" aria-label="Search emoji" autoComplete="off" /><button type="button" aria-label="Close emoji picker" onClick={() => setOpen(false)}><X size={14} /></button></div>
      <div className="nexus-emoji-category-tabs" role="tablist" aria-label="Emoji categories">
        <button type="button" role="tab" aria-label="Twemoji pack" title="Twemoji pack · all emoji" aria-selected={category === 'All' && !search} onClick={() => { setSearch(''); setCategory('All'); }}>✦</button>
        {EMOJI_CATEGORIES.map((item, index) => <button type="button" role="tab" key={item} aria-label={item} title={item} aria-selected={category === item && !search} onClick={() => { setSearch(''); setCategory(item); }}>{['☻', '♟', '♧', '🍴', '⚽', '✈', '▣', '⚙', '⚑'][index]}</button>)}
      </div>
      <div className="nexus-emoji-picker-scroll">
        <h3>{search ? 'Search results' : category === 'All' ? 'Twemoji pack' : category}<small>{items.length}</small></h3>
        <div className="nexus-emoji-grid">{items.map(emoji => <button type="button" key={`${emoji.unicode}-${emoji.shortcode}`} title={`${emoji.name} · :${emoji.shortcode}:`} aria-label={`${emoji.name}, :${emoji.shortcode}:`} onMouseDown={event => event.preventDefault()} onClick={() => choose(emoji)}><img src={emoji.asset} alt="" loading="lazy" /><span className="nexus-emoji-tooltip">{emoji.name}</span></button>)}</div>
        {!items.length && <p className="nexus-emoji-empty">{catalog ? 'No matching emoji found.' : 'Loading emoji…'}</p>}
      </div>
      <footer>Twemoji SVG · {catalog?.length.toLocaleString() || '…'} emoji</footer>
    </section>, document.body)}
  </>;
};
