import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Smile, Search, X } from 'lucide-react';
import type { EmojiCategory, MessengerEmoji } from './messengerEmojiCatalog';
import { activeShortcodeAt, convertCompletedShortcodes, type ShortcodeMatch, rankEmoji } from './messengerEmojiShortcodes';
import './MessengerEmojiInput.css';

interface MessengerEmojiInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  userId: string;
}

interface FloatingPosition { left: number; top: number; width: number; }

const RECENT_LIMIT = 24;
const EMOJI_CATEGORIES: EmojiCategory[] = ['Smileys', 'People', 'Animals', 'Food', 'Activities', 'Travel', 'Objects', 'Symbols', 'Flags'];
let catalogLoad: Promise<MessengerEmoji[]> | undefined;
const ensureEmojiCatalog = () => catalogLoad ||= import('./messengerEmojiCatalog').then(module => module.loadMessengerEmojiCatalog());

const recentStorageKey = (userId: string) => `nexus-messenger-recent-emojis-v1:${userId}`;

export const MessengerEmojiInput: React.FC<MessengerEmojiInputProps> = ({ value, onChange, placeholder, userId }) => {
  const [catalog, setCatalog] = useState<MessengerEmoji[] | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'Recent' | EmojiCategory>('Smileys');
  const [pickerSearch, setPickerSearch] = useState('');
  const [suggestionsOpen, setSuggestionsOpen] = useState(true);
  const [highlightedSuggestion, setHighlightedSuggestion] = useState(0);
  const [caret, setCaret] = useState(value.length);
  const [recentUnicode, setRecentUnicode] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(recentStorageKey(userId)) || '[]'); } catch { return []; }
  });
  const [pickerPosition, setPickerPosition] = useState<FloatingPosition | null>(null);
  const [suggestionPosition, setSuggestionPosition] = useState<FloatingPosition | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const selectionRef = useRef({ start: value.length, end: value.length });
  const rootRef = useRef<HTMLDivElement>(null);

  const shortcodeLookup = useMemo(() => {
    const lookup = new Map<string, MessengerEmoji>();
    for (const emoji of catalog || []) {
      for (const shortcode of [emoji.shortcode, ...emoji.aliases]) if (!lookup.has(shortcode.toLowerCase())) lookup.set(shortcode.toLowerCase(), emoji);
    }
    return lookup;
  }, [catalog]);

  const rememberEmoji = (emoji: MessengerEmoji) => {
    setRecentUnicode(current => {
      const next = [emoji.unicode, ...current.filter(item => item !== emoji.unicode)].slice(0, RECENT_LIMIT);
      try { localStorage.setItem(recentStorageKey(userId), JSON.stringify(next)); } catch { /* recent emoji history is optional */ }
      return next;
    });
  };

  const updateFloatingPosition = (kind: 'picker' | 'suggestions') => {
    const anchor = kind === 'picker' ? emojiButtonRef.current : inputRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(kind === 'picker' ? 360 : 310, window.innerWidth - 24);
    const height = kind === 'picker' ? Math.min(430, window.innerHeight - 24) : Math.min(340, window.innerHeight - 24);
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    const top = Math.max(12, Math.min(rect.top - height - 8, window.innerHeight - height - 12));
    const position = { left, top, width };
    if (kind === 'picker') setPickerPosition(position); else setSuggestionPosition(position);
  };

  const requestCatalog = () => {
    if (catalog) return;
    void ensureEmojiCatalog().then(setCatalog).catch(() => setCatalog([]));
  };

  const selectEmoji = (emoji: MessengerEmoji, replacement?: ShortcodeMatch) => {
    const input = inputRef.current;
    const start = replacement?.start ?? selectionRef.current.start;
    const end = replacement?.end ?? selectionRef.current.end;
    const next = `${value.slice(0, start)}${emoji.unicode}${value.slice(end)}`;
    const caret = start + emoji.unicode.length;
    onChange(next);
    selectionRef.current = { start: caret, end: caret };
    setCaret(caret);
    rememberEmoji(emoji);
    setPickerOpen(false);
    setSuggestionsOpen(false);
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(caret, caret);
    });
  };

  const togglePicker = () => {
    if (pickerOpen) { setPickerOpen(false); return; }
    requestCatalog();
    updateFloatingPosition('picker');
    setPickerOpen(true);
    setPickerSearch('');
    setActiveCategory('Recent');
  };

  const shortcode = activeShortcodeAt(value, caret);
  const suggestions = useMemo(() => {
    if (!catalog || !shortcode || shortcode.query.length === 0 || !suggestionsOpen) return [];
    return catalog.map(emoji => ({ emoji, rank: rankEmoji(emoji, shortcode.query) }))
      .filter(result => Number.isFinite(result.rank))
      .sort((left, right) => left.rank - right.rank || left.emoji.name.localeCompare(right.emoji.name))
      .slice(0, 8)
      .map(result => result.emoji);
  }, [catalog, shortcode?.query, suggestionsOpen, caret]);

  const pickerItems = useMemo(() => {
    if (!catalog) return [];
    const query = pickerSearch.trim().toLowerCase();
    if (query) return catalog.map(emoji => ({ emoji, rank: rankEmoji(emoji, query) }))
      .filter(result => Number.isFinite(result.rank))
      .sort((left, right) => left.rank - right.rank || left.emoji.name.localeCompare(right.emoji.name))
      .map(result => result.emoji);
    if (activeCategory === 'Recent') {
      const recentByUnicode = new Map(catalog.map(emoji => [emoji.unicode, emoji]));
      const recentItems = recentUnicode.map(unicode => recentByUnicode.get(unicode)).filter((emoji): emoji is MessengerEmoji => Boolean(emoji));
      return recentItems.length ? recentItems : catalog.filter(emoji => emoji.category === 'Smileys');
    }
    return catalog.filter(emoji => emoji.category === activeCategory);
  }, [catalog, pickerSearch, activeCategory, recentUnicode]);

  useEffect(() => {
    if (!catalog) return;
    const converted = convertCompletedShortcodes(value, selectionRef.current.start, shortcodeLookup);
    if (converted.value !== value) {
      onChange(converted.value);
      selectionRef.current = { start: converted.caret, end: converted.caret };
      setCaret(converted.caret);
      requestAnimationFrame(() => inputRef.current?.setSelectionRange(converted.caret, converted.caret));
    }
  }, [catalog, value, shortcodeLookup, onChange]);

  useEffect(() => {
    if (value.includes(':') && !catalog) requestCatalog();
    const current = activeShortcodeAt(value, caret);
    if (current?.query) {
      setSuggestionsOpen(true);
      requestCatalog();
      requestAnimationFrame(() => updateFloatingPosition('suggestions'));
    } else setSuggestionsOpen(false);
  }, [value, catalog, caret]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setPickerOpen(false);
      setSuggestionsOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  useEffect(() => {
    if (!pickerOpen && !suggestions.length) return;
    const reposition = () => {
      if (pickerOpen) updateFloatingPosition('picker');
      if (suggestions.length) updateFloatingPosition('suggestions');
    };
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [pickerOpen, suggestions.length]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const nextValue = input.value;
    const caret = input.selectionStart ?? nextValue.length;
    selectionRef.current = { start: caret, end: input.selectionEnd ?? caret };
    setCaret(caret);
    const converted = convertCompletedShortcodes(nextValue, caret, shortcodeLookup);
    onChange(converted.value);
    if (converted.value !== nextValue) {
      selectionRef.current = { start: converted.caret, end: converted.caret };
      requestAnimationFrame(() => input.setSelectionRange(converted.caret, converted.caret));
    }
    setHighlightedSuggestion(0);
    if (nextValue.includes(':')) requestCatalog();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      setHighlightedSuggestion(current => (current + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length);
    } else if (suggestions.length && event.key === 'Enter') {
      event.preventDefault();
      selectEmoji(suggestions[highlightedSuggestion] || suggestions[0], shortcode || undefined);
    } else if (event.key === 'Escape') {
      if (pickerOpen) { event.preventDefault(); setPickerOpen(false); }
      else if (suggestions.length) { event.preventDefault(); setSuggestionsOpen(false); }
    }
  };

  return <div className="nexus-emoji-composer-control" ref={rootRef}>
    <button ref={emojiButtonRef} type="button" className={`nexus-emoji-trigger${pickerOpen ? ' is-open' : ''}`} title="Choose emoji" aria-label="Choose emoji" aria-expanded={pickerOpen} onClick={togglePicker}><Smile size={17} /></button>
    <input
      ref={inputRef}
      value={value}
      onChange={handleInputChange}
      onKeyDown={handleKeyDown}
      onSelect={event => { const input = event.currentTarget; const start = input.selectionStart ?? value.length; selectionRef.current = { start, end: input.selectionEnd ?? value.length }; setCaret(start); }}
      onClick={event => { const input = event.currentTarget; const start = input.selectionStart ?? value.length; selectionRef.current = { start, end: input.selectionEnd ?? value.length }; setCaret(start); }}
      placeholder={placeholder}
      aria-label="Message"
      autoComplete="off"
      spellCheck
    />
    {pickerOpen && pickerPosition && <section className="nexus-emoji-picker" style={{ left: pickerPosition.left, top: pickerPosition.top, width: pickerPosition.width }} aria-label="Emoji picker">
      <div className="nexus-emoji-picker-search"><Search size={15} /><input value={pickerSearch} onChange={event => setPickerSearch(event.target.value)} placeholder="Search all emoji" aria-label="Search emoji" autoComplete="off" /><button type="button" aria-label="Close emoji picker" onClick={() => setPickerOpen(false)}><X size={14} /></button></div>
      <div className="nexus-emoji-category-tabs" role="tablist" aria-label="Emoji categories">
        <button type="button" role="tab" aria-selected={activeCategory === 'Recent' && !pickerSearch} onClick={() => { setPickerSearch(''); setActiveCategory('Recent'); }} title="Recently used">◷</button>
        {EMOJI_CATEGORIES.map((category, index) => <button type="button" role="tab" key={category} aria-label={category} aria-selected={activeCategory === category && !pickerSearch} title={category} onClick={() => { setPickerSearch(''); setActiveCategory(category); }}>{['☻', '♟', '♧', '🍴', '⚽', '✈', '▣', '⚙', '⚑'][index]}</button>)}
      </div>
      <div className="nexus-emoji-picker-scroll" key={`${activeCategory}-${pickerSearch}`}>
        {pickerSearch && <h3>Search results <small>{pickerItems.length}</small></h3>}
        {!pickerSearch && <h3>{activeCategory === 'Recent' && !pickerItems.length ? 'Smileys' : activeCategory} <small>{pickerItems.length}</small></h3>}
        <div className="nexus-emoji-grid">{pickerItems.map(emoji => <button type="button" key={`${emoji.unicode}-${emoji.shortcode}`} title={`${emoji.name} · :${emoji.shortcode}:`} aria-label={`${emoji.name}, :${emoji.shortcode}:`} onMouseDown={event => event.preventDefault()} onClick={() => selectEmoji(emoji)}><img src={emoji.asset} alt="" loading="lazy" /><span className="nexus-emoji-tooltip">{emoji.name}</span></button>)}</div>
        {!pickerItems.length && <p className="nexus-emoji-empty">{catalog ? 'No matching emoji found.' : 'Loading emoji…'}</p>}
      </div>
      <footer>Twemoji SVG · {catalog?.length.toLocaleString() || '…'} emoji</footer>
    </section>}
    {suggestions.length > 0 && suggestionPosition && !pickerOpen && <div className="nexus-emoji-suggestions" style={{ left: suggestionPosition.left, top: suggestionPosition.top, width: suggestionPosition.width }} role="listbox" aria-label="Emoji shortcode suggestions">
      {suggestions.map((emoji, index) => <button type="button" role="option" aria-selected={highlightedSuggestion === index} key={`${emoji.unicode}-${emoji.shortcode}`} onMouseDown={event => event.preventDefault()} onMouseEnter={() => setHighlightedSuggestion(index)} onClick={() => selectEmoji(emoji, shortcode || undefined)}><img src={emoji.asset} alt="" /><span className="nexus-emoji-suggestion-name">:{emoji.shortcode}:</span><span className="nexus-emoji-suggestion-description">{emoji.name}</span></button>)}
    </div>}
  </div>;
};
