import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CornerUpLeft, Forward, MessagesSquare, MoreHorizontal, Phone, Plus, Rocket, Search, SmilePlus, Trash2, UserRound, Video, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, UserSummary } from '../services/api';
import { readUserPreference, writeUserPreference } from '../services/userPreferences';
import { wsClient } from '../services/websocket';
import { SideNav } from '../components/SideNav';
import { TopHeader } from '../components/TopHeader';
import { GlobalSearchModal } from '../components/GlobalSearchModal';
import './FriendsPage.css';
import './MessagingPage.css';

interface MessagingPageProps { currentUser: UserSummary | null; onLogout?: () => void; }
type Conversation = { id: string; type: string; title?: string; description?: string; members?: any[]; last_message?: Message | null };
type Message = { id: string; conversation_id: string; sender_id: string; sender_name?: string; sender_username?: string; content: string; created_at: string; reactions?: { emoji: string; count: number; user_ids: string[] }[]; reply_to_id?: string | null; reply_preview?: string | null; is_deleted?: boolean; is_pinned?: boolean };

export const MessagingPage: React.FC<MessagingPageProps> = ({ currentUser, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [conversationQuery, setConversationQuery] = useState('');
  const [inputText, setInputText] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [callPreview, setCallPreview] = useState<'voice' | 'video' | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [menuNotice, setMenuNotice] = useState('');
  const [typingNames, setTypingNames] = useState<string[]>([]);
  const conversationSearchRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<number | null>(null);

  const loadConversations = useCallback(async () => {
    try { const rows = await api.listConversations(); setConversations(rows); const requested = new URLSearchParams(location.search).get('conversationId'); setActiveConvId(current => requested && rows.some((row: Conversation) => row.id === requested) ? requested : current && rows.some((row: Conversation) => row.id === current) ? current : null); }
    catch { setConversations([]); }
  }, [location.search]);
  useEffect(() => { void loadConversations(); }, [loadConversations]);
  useEffect(() => {
    if (!activeConvId) { setChatMessages([]); return; }
    let alive = true; setLoading(true); setError('');
    api.getMessages(activeConvId).then(rows => { if (alive) setChatMessages(rows); }).catch(() => { if (alive) { setChatMessages([]); setError('Messages could not be loaded. Check your connection and try again.'); } }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [activeConvId]);
  useEffect(() => {
    if (!activeConvId) { setTypingNames([]); return; }
    let alive = true;
    const refresh = () => void api.getTyping(activeConvId).then(rows => { if (alive) setTypingNames(rows.map(row => row.name)); }).catch(() => undefined);
    refresh(); const timer = window.setInterval(refresh, 1800);
    return () => { alive = false; window.clearInterval(timer); };
  }, [activeConvId]);
  useEffect(() => () => { if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current); }, []);
  useEffect(() => {
    if (!activeConvId) return;
    let active = true;
    const refresh = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const rows = await api.getMessages(activeConvId);
        if (active) setChatMessages(current => JSON.stringify(current) === JSON.stringify(rows) ? current : rows);
      } catch { /* keep the current history visible during a brief connection interruption */ }
    };
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [activeConvId]);
  useEffect(() => {
    const removeListener = wsClient.addListener(event => {
    if (event.event === 'message.new' && event.message) {
      if (event.conversation_id === activeConvId) setChatMessages(items => items.some(item => item.id === event.message.id) ? items : [...items, event.message]);
      void loadConversations();
    } else if (event.event === 'message.deleted' && event.conversation_id === activeConvId) setChatMessages(items => items.map(item => item.id === event.message_id ? { ...item, is_deleted: true, content: 'This message was deleted.' } : item));
    else if (event.event === 'conversation.cleared' && event.conversation_id === activeConvId) setChatMessages(items => items.map(item => ({ ...item, is_deleted: true, content: 'This message was deleted.' })));
    else if (event.event === 'message.edited' && event.conversation_id === activeConvId && event.message) setChatMessages(items => items.map(item => item.id === event.message.id ? event.message : item));
    else if (event.event === 'message.reaction' && event.conversation_id === activeConvId) void api.getMessages(activeConvId).then(setChatMessages).catch(() => undefined);
    });
    return () => { removeListener(); };
  }, [activeConvId, loadConversations]);
  useEffect(() => { document.getElementById('messenger-bottom-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [chatMessages]);
  const jumpToMessage = (messageId: string) => {
    const target = document.getElementById(`message-${messageId}`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedMessageId(messageId);
    window.setTimeout(() => setHighlightedMessageId(current => current === messageId ? null : current), 1600);
  };
  const showMenuNotice = (text: string) => { setMenuNotice(text); window.setTimeout(() => setMenuNotice(''), 1800); };
  const copyMessageValue = async (text: string, label: string) => { await navigator.clipboard?.writeText(text); showMenuNotice(`${label} copied`); };
  const toggleMessageBookmark = (message: Message) => { const key = 'nexus-message-bookmarks-v1'; const userId = currentUser?.id || 'guest'; const saved = readUserPreference<any[]>(key, userId, []); const exists = saved.some((item: any) => item.id === message.id); const conversation = conversations.find(item => item.id === message.conversation_id); const next = exists ? saved.filter((item: any) => item.id !== message.id) : [...saved, { ...message, conversation: conversation ? displayName(conversation) : 'Conversation' }]; writeUserPreference(key, userId, next); showMenuNotice(exists ? 'Bookmark removed' : 'Message bookmarked in this browser'); };

  if (!currentUser) return null;
  const activeConv = conversations.find(conversation => conversation.id === activeConvId);
  const displayName = (conversation: Conversation) => conversation.title || conversation.members?.filter(member => member.user_id !== currentUser.id).map(member => member.full_name || member.username).join(', ') || 'Conversation';
  const initials = (conversation: Conversation) => displayName(conversation).split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();
  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault(); if (!activeConvId || !inputText.trim()) return;
    const content = inputText.trim(); setInputText('');
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    void api.setTyping(activeConvId, false).catch(() => undefined);
    try { const sent = await api.sendMessage(activeConvId, { content, reply_to_id: replyTo?.id || null }); setChatMessages(items => items.some(item => item.id === sent.id) ? items : [...items, sent]); setReplyTo(null); void loadConversations(); }
    catch { setInputText(content); setError('Message was not sent. Please try again.'); }
  };
  const clearHistory = async () => {
    if (!activeConvId || !window.confirm('Delete every message in this conversation? This permanently removes its stored history.')) return;
    try { await api.clearConversationHistory(activeConvId); setChatMessages(items => items.map(item => ({ ...item, is_deleted: true, content: 'This message was deleted.' }))); setError(''); }
    catch { setError('Some messages could not be deleted. Reloading conversation history.'); setChatMessages(await api.getMessages(activeConvId).catch(() => [])); }
  };
  const filteredConversations = conversations.filter(conversation => displayName(conversation).toLowerCase().includes(conversationQuery.toLowerCase()));

  return <div className="messenger-route" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-canvas)' }}>
    <SideNav currentUser={currentUser} onLogout={onLogout} onOpenSearch={() => setSearchOpen(true)} />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100vh' }}><TopHeader breadcrumb="Workspace / Messenger" currentUser={currentUser} onOpenSearch={() => setSearchOpen(true)} />
      <div className="messenger-discord-layout" style={{ flex: 1, display: 'grid', gridTemplateColumns: profileOpen ? '272px minmax(0, 1fr) 280px' : '272px minmax(0, 1fr)', overflow: 'hidden' }}>
        <aside className="friends-dm-sidebar messenger-dm-sidebar">
          <label className="friends-start-conversation messenger-conversation-search"><Search size={15} /><input ref={conversationSearchRef} value={conversationQuery} onChange={event => setConversationQuery(event.target.value)} placeholder="Find or start a conversation" aria-label="Find or start a conversation" /></label>
          <div className="friends-side-active messenger-side-active"><MessagesSquare size={17} /> Messenger <span>{conversations.length}</span></div>
          <div className="friends-dm-heading">Conversations <button aria-label="Start a conversation" onClick={() => navigate('/friends')}><Plus size={17} /></button></div>
          <div className="friends-dm-list">{filteredConversations.map(conversation => <button key={conversation.id} className={`friends-dm-item ${conversation.id === activeConvId ? 'is-selected' : ''}`} onClick={() => { setActiveConvId(conversation.id); setProfileOpen(false); }}><span className="friends-avatar">{initials(conversation)}</span><span className="friends-dm-copy"><strong>{displayName(conversation)}</strong><small>{conversation.last_message?.content || 'No messages yet'}</small></span></button>)}
            {!filteredConversations.length && <p className="friends-empty">{conversationQuery ? 'No conversations match your search.' : 'No conversations yet. Add a friend to start a chat.'}</p>}</div>
          <div className="friends-own-profile"><span className="friends-avatar">{(currentUser.display_name || currentUser.full_name || currentUser.username || '?').slice(0, 1).toUpperCase()}</span><span><strong>{currentUser.display_name || currentUser.full_name || currentUser.username}</strong><small>Verified student</small></span><button aria-label="Open profile settings" onClick={() => navigate('/settings')}><MoreHorizontal size={18} /></button></div>
        </aside>
        <section className="messenger-chat-panel" style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-canvas)', height: '100%', minWidth: 0, position: 'relative' }}>
          {activeConv ? <>
            <header className="messenger-chat-header" style={{ height: 56, borderBottom: '1px solid var(--border)', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: 'var(--bg-surface)' }}><div className="nexus-dm-heading"><span className="friends-avatar">{initials(activeConv)}</span><div><strong>{displayName(activeConv)}</strong><small>{activeConv.type === 'GROUP' ? 'Group conversation' : 'Direct conversation'}</small></div></div><div className="messenger-chat-actions"><button type="button" aria-label="Start voice call" title="Voice call" onClick={() => setCallPreview('voice')}><Phone size={17} /></button><button type="button" aria-label="Start video call" title="Video call" onClick={() => setCallPreview('video')}><Video size={17} /></button><button type="button" aria-label="Clear conversation history" title="Clear conversation history" onClick={() => void clearHistory()}><Trash2 size={17} /></button><button type="button" className={`messenger-profile-toggle ${profileOpen ? 'is-open' : ''}`} aria-label="Open conversation details" onClick={() => setProfileOpen(value => !value)}><UserRound size={17} /></button></div></header>
            {callPreview && <div className="messenger-call-notice" role="status"><span>{callPreview === 'voice' ? 'Voice' : 'Video'} calls are not connected yet.</span><button onClick={() => setCallPreview(null)} aria-label="Dismiss"><X size={15} /></button></div>}
            
            {error && <p className="nexus-message-error" role="alert">{error}</p>}{menuNotice && <div className="nexus-chat-toast" role="status">{menuNotice}</div>}
            <div className="messenger-chat-messages nexus-chat-messages" style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column' }}>
              {loading && <p className="friends-empty">Loading messages…</p>}
              {!loading && !chatMessages.length && <div className="nexus-dm-empty"><MessagesSquare size={30} /><strong>This is the start of your conversation.</strong><p>Send a message to get things going.</p></div>}
              {chatMessages.map(message => {
                const mine = message.sender_id === currentUser.id;
                const author = mine ? 'You' : message.sender_name || message.sender_username || 'Student';
                const previous = chatMessages[chatMessages.indexOf(message) - 1];
                const sameAuthor = previous && (previous.sender_id === currentUser.id ? 'You' : previous.sender_name || previous.sender_username || 'Student') === author;
                return <article id={`message-${message.id}`} className={`nexus-message-row nexus-chat-message${sameAuthor ? ' grouped' : ''} ${mine ? 'mine' : ''}${highlightedMessageId === message.id ? ' is-jump-target' : ''}`} key={message.id}>
                  <span className="nexus-chat-avatar-slot">{!sameAuthor && <span className="nexus-message-avatar nexus-chat-message-avatar">{author.slice(0, 1).toUpperCase()}</span>}</span>
                  <div className="nexus-message-main">
                    {!sameAuthor && <div className="nexus-message-meta"><strong>{author}</strong><time>{new Date(message.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</time></div>}
                    <div className="nexus-message-text-line"><p className={message.is_deleted ? 'deleted' : ''}>{message.content}</p><div className="nexus-message-hover-tools"><button title="React with laughing" onClick={() => void api.toggleReaction(message.id, '😂').then(() => api.getMessages(activeConvId).then(setChatMessages))}>😂</button><button title="React with thumbs up" onClick={() => void api.toggleReaction(message.id, '👍').then(() => api.getMessages(activeConvId).then(setChatMessages))}>👍</button><button title="React with heart" onClick={() => void api.toggleReaction(message.id, '❤️').then(() => api.getMessages(activeConvId).then(setChatMessages))}>❤️</button><button title="Add reaction" aria-label="Add reaction" onClick={() => void api.toggleReaction(message.id, '🙂').then(() => api.getMessages(activeConvId).then(setChatMessages))}><SmilePlus size={15} /></button><button title="Reply" onClick={() => setReplyTo(message)}><CornerUpLeft size={15} /></button><button title="Forward"><Forward size={14} /></button><div className="nexus-message-menu"><button aria-label="More message options"><MoreHorizontal size={16} /></button><div>
                        <div className="nexus-context-quick"><button onClick={() => void api.toggleReaction(message.id, '😂').then(() => api.getMessages(activeConvId).then(setChatMessages))}>😂</button><button onClick={() => void api.toggleReaction(message.id, '👍').then(() => api.getMessages(activeConvId).then(setChatMessages))}>👍</button><button onClick={() => void api.toggleReaction(message.id, '❤️').then(() => api.getMessages(activeConvId).then(setChatMessages))}>❤️</button><button onClick={() => void api.toggleReaction(message.id, '😮').then(() => api.getMessages(activeConvId).then(setChatMessages))}>😮</button></div>
                        <button onClick={() => void api.toggleReaction(message.id, '🙂').then(() => api.getMessages(activeConvId).then(setChatMessages))}>☻ <span>Add Reaction</span><i>›</i></button><hr />
                        <button onClick={() => setReplyTo(message)}>↶ <span>Reply</span></button><button onClick={() => showMenuNotice('Forward message: choose a conversation from Messenger.')}>↗ <span>Forward</span></button><button onClick={() => showMenuNotice('Message threads are not available yet.')}>▤ <span>Create Thread</span></button><hr />
                        <button onClick={() => void copyMessageValue(message.content, 'Message text')}>▢ <span>Copy Text</span></button><button onClick={() => void api.toggleMessagePin(message.id).then(() => api.getMessages(activeConvId).then(setChatMessages))}>⌖ <span>{message.is_pinned ? 'Unpin Message' : 'Pin Message'}</span></button><button onClick={() => toggleMessageBookmark(message)}>♧ <span>Bookmark Message</span></button><button onClick={() => { const minutes = Number(window.prompt('Remind me in how many minutes?', '30')); if (minutes > 0) { window.setTimeout(() => window.alert(`Reminder: ${message.content}`), minutes * 60_000); showMenuNotice(`Reminder set for ${minutes} minutes`); } }}>◷ <span>Create Reminder</span><i>›</i></button><button onClick={() => showMenuNotice('No message apps are connected.')}>✣ <span>Apps</span><i>›</i></button><button onClick={() => showMenuNotice('Conversation marked unread on this browser.')}>◉ <span>Mark Unread</span></button><button onClick={() => void copyMessageValue(`${window.location.origin}/messaging#${message.id}`, 'Message link')}>↗ <span>Copy Message Link</span></button><button onClick={() => { window.speechSynthesis?.cancel(); window.speechSynthesis?.speak(new SpeechSynthesisUtterance(message.content)); }}>◖ <span>Speak Message</span></button><hr />
                        {mine && !message.is_deleted && <button className="danger" onClick={() => void api.deleteMessage(message.id).then(() => setChatMessages(items => items.map(item => item.id === message.id ? { ...item, content: 'This message was deleted.', is_deleted: true } : item)))}>▣ <span>Delete Message</span></button>}<button className="danger" onClick={() => showMenuNotice('Report noted. Message reports are not connected to moderation yet.')}>⚑ <span>Report Message</span></button><hr /><button onClick={() => void copyMessageValue(message.id, 'Message ID')}>ID <span>Copy Message ID</span></button>
                      </div></div></div>
                    </div>
                    {message.reply_preview && message.reply_to_id && <button type="button" className="nexus-chat-reply-preview nexus-message-reply-preview" onClick={() => jumpToMessage(message.reply_to_id!)}>↪ {message.reply_preview}</button>}
                    <div className="nexus-message-reactions">{message.reactions?.map(reaction => <button className={reaction.user_ids.includes(currentUser.id) ? 'is-reacted' : ''} key={reaction.emoji} aria-pressed={reaction.user_ids.includes(currentUser.id)} title={reaction.user_ids.includes(currentUser.id) ? 'Remove your reaction' : 'Add your reaction'} onClick={() => void api.toggleReaction(message.id, reaction.emoji).then(() => api.getMessages(activeConvId).then(setChatMessages))}>{reaction.emoji} {reaction.count}</button>)}<button className="nexus-add-reaction" title="Add reaction" aria-label="Add reaction" onClick={() => void api.toggleReaction(message.id, '🙂').then(() => api.getMessages(activeConvId).then(setChatMessages))}><SmilePlus size={15} /></button></div>
                  </div>
                </article>;
              })}
              <div id="messenger-bottom-anchor" ref={messagesEndRef} />
            </div>
            {typingNames.length > 0 && <div className="nexus-typing-indicator" aria-live="polite"><span>{typingNames.length === 1 ? typingNames[0] : `${typingNames.slice(0, 2).join(' and ')}${typingNames.length > 2 ? ` and ${typingNames.length - 2} others` : ''}`} is typing</span><i /><i /><i /></div>}
            <form className="messenger-chat-composer nexus-real-composer" onSubmit={sendMessage}>{replyTo && <div className="nexus-replying"><span>Replying to <strong>{replyTo.sender_name || replyTo.sender_username}</strong><small>{replyTo.content.slice(0, 90)}</small></span><button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply"><X size={14} /></button></div>}<div><button type="button" title="Insert emoji" onClick={() => setInputText(value => `${value}🙂`)}>☺</button><input value={inputText} onChange={event => { const value = event.target.value; setInputText(value); if (!activeConvId) return; void api.setTyping(activeConvId, Boolean(value.trim())).catch(() => undefined); if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current); if (value.trim()) typingTimerRef.current = window.setTimeout(() => { void api.setTyping(activeConvId, false).catch(() => undefined); }, 3000); }} placeholder={`Message ${displayName(activeConv)}…`} /><button type="submit" aria-label="Send message" title="Send message"><Rocket size={17} /></button></div><small>Messages are saved to your conversation history.</small></form>
          </> : <div className="nexus-dm-empty"><MessagesSquare size={34} /><strong>{conversations.length ? 'Choose a conversation' : 'No conversations yet'}</strong><p>{conversations.length ? 'Select a chat from the list to see its messages.' : 'No contacts or chats here yet. Add a friend to start a conversation.'}</p><button onClick={() => navigate('/friends')}>Find people</button></div>}
        </section>
        {profileOpen && activeConv && <aside className="messenger-profile-panel nexus-conversation-details"><button type="button" className="messenger-profile-close" onClick={() => setProfileOpen(false)} aria-label="Close"><X size={17} /></button><div className="nexus-details-avatar">{initials(activeConv)}</div><h3>{displayName(activeConv)}</h3><p>{activeConv.description || `${activeConv.members?.length || 0} conversation members`}</p><div className="nexus-details-members"><strong>Members</strong>{activeConv.members?.map(member => <span key={member.user_id}>{member.full_name || member.username}</span>)}</div><button className="nexus-clear-history" onClick={() => void clearHistory()}><Trash2 size={15} /> Clear history</button><small>Clearing permanently removes messages from this conversation.</small></aside>}
      </div>
    </div>
    <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
  </div>;
};
