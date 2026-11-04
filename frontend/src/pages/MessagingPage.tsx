import React, { useEffect, useRef, useState } from 'react';
import { MessagesSquare, MoreHorizontal, Phone, Plus, Rocket, Search, UserRound, Video, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { UserSummary } from '../services/api';
import { SideNav } from '../components/SideNav';
import { TopHeader } from '../components/TopHeader';
import { GlobalSearchModal } from '../components/GlobalSearchModal';
import './FriendsPage.css';
import './MessagingPage.css';

interface MessagingPageProps {
  currentUser: UserSummary | null;
  onLogout?: () => void;
}

export const MessagingPage: React.FC<MessagingPageProps> = ({ currentUser, onLogout }) => {
  const navigate = useNavigate();
  const isOperaGX = typeof navigator !== 'undefined' && /OPR\//.test(navigator.userAgent);
  const [searchOpen, setSearchOpen] = useState(false);
  const [conversationQuery, setConversationQuery] = useState('');
  const [inputText, setInputText] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [callPreview, setCallPreview] = useState<'voice' | 'video' | null>(null);
  const conversationSearchRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAfterSendRef = useRef(false);

  const conversations = [
    {
      id: 'meera',
      name: 'Meera Iyer',
      initials: 'MI',
      time: '10:45',
      snippet: 'Library after lunch?',
      unread: true,
      online: true,
      major: 'Physics · BS–MS 2023',
    },
    {
      id: 'qc',
      name: 'Quantum Collective',
      initials: 'QC',
      time: '10:32',
      snippet: 'Arjun: Uploaded the solutions',
      unread: true,
      online: true,
      major: 'Study group · 12 members',
    },
    {
      id: 'arjun',
      name: 'Arjun Nair',
      initials: 'AN',
      time: '09:41',
      snippet: 'Astronomy night this Friday?',
      unread: true,
      online: true,
      major: 'Mathematics · BS–MS 2023',
    },
    {
      id: 'sana',
      name: 'Sana Khan',
      initials: 'SK',
      time: 'Yesterday',
      snippet: 'Thanks for sharing the notes!',
      unread: false,
      online: false,
      major: 'Biology · BS–MS 2024',
    },
    {
      id: 'skywatchers',
      name: 'Skywatchers Club',
      initials: 'SC',
      time: 'Yesterday',
      snippet: 'Rooftop access confirmed 🔭',
      unread: false,
      online: true,
      major: 'Campus club · 148 members',
    },
    {
      id: 'dev',
      name: 'Dev Patel',
      initials: 'DP',
      time: 'Sunday',
      snippet: 'See you at the lab',
      unread: false,
      online: false,
      major: 'Chemistry · BS–MS 2023',
    },
  ];

  const [activeConvId, setActiveConvId] = useState('meera');

  const [chatMessages, setChatMessages] = useState([
    {
      sender: 'Meera',
      text: 'Hey! Did you get the last step in the perturbation proof? I think we missed a minus sign 😅',
      time: '10:42',
      isMe: false,
    },
    {
      sender: 'You',
      text: 'Yes! The second term should be negative. I marked it in my notes.',
      time: '10:43',
      isMe: true,
      status: 'Read ✓✓',
    },
    {
      sender: 'You',
      attachment: {
        name: 'Perturbation_theory.pdf',
        meta: 'PDF · 1.2 MB · 18 pages',
      },
      time: '10:43',
      isMe: true,
    },
    {
      sender: 'Meera',
      text: 'Let’s work through the rest at the library after lunch?',
      time: '10:44',
      isMe: false,
    },
  ]);

  const activeConv = conversations.find((c) => c.id === activeConvId) || conversations[0];

  useEffect(() => {
    if (!scrollAfterSendRef.current) return;
    scrollAfterSendRef.current = false;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chatMessages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    scrollAfterSendRef.current = true;
    setChatMessages((messages) => [
      ...messages,
      {
        sender: 'You',
        text: inputText,
        time: 'Just now',
        isMe: true,
        status: 'Delivered ✓✓',
      },
    ]);
    setInputText('');
  };

  if (!currentUser) return null;

  return (
    <div className={`messenger-route${isOperaGX ? ' is-opera-gx' : ''}`} style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-canvas)' }}>
      <SideNav currentUser={currentUser} onLogout={onLogout} onOpenSearch={() => setSearchOpen(true)} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100vh' }}>
        <TopHeader
          breadcrumb="Workspace / Messenger"
          currentUser={currentUser}
          onOpenSearch={() => setSearchOpen(true)}
        />

        {/* 3-Column Messenger Layout (Page 9) */}
        <div className="messenger-discord-layout" style={{ flex: 1, display: 'grid', gridTemplateColumns: profileOpen ? '272px minmax(0, 1fr) 280px' : '272px minmax(0, 1fr)', overflow: 'hidden' }}>
          {/* Column 1: Conversations List */}
          <aside className="friends-dm-sidebar messenger-dm-sidebar">
            <label className="friends-start-conversation messenger-conversation-search">
              <Search size={15} />
              <input ref={conversationSearchRef} value={conversationQuery} onChange={(event) => setConversationQuery(event.target.value)} placeholder="Find or start a conversation" aria-label="Find or start a conversation" />
            </label>
            <div className="friends-side-active messenger-side-active"><MessagesSquare size={17} /> Messenger <span>{conversations.filter((conv) => conv.unread).length}</span></div>
            <div className="friends-dm-heading">Direct Messages <button aria-label="Find a conversation" onClick={() => conversationSearchRef.current?.focus()}><Plus size={17} /></button></div>
            <div className="friends-dm-list">
              {conversations.filter((conv) => conv.name.toLowerCase().includes(conversationQuery.toLowerCase())).map((conv) => (
                <button key={conv.id} className={`friends-dm-item ${conv.id === activeConvId ? 'is-selected' : ''}`} onClick={() => setActiveConvId(conv.id)}>
                  <span className={`friends-avatar ${conv.online ? 'is-online' : ''}`}>{conv.initials}</span>
                  <span className="friends-dm-copy"><strong>{conv.name}</strong><small>{conv.snippet}</small></span>
                </button>
              ))}
              {conversations.every((conv) => !conv.name.toLowerCase().includes(conversationQuery.toLowerCase())) && <p className="friends-empty">No conversations match your search.</p>}
            </div>
            <div className="friends-own-profile">
              <span className="friends-avatar">{(currentUser.display_name || currentUser.full_name || currentUser.username || 'AR').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span>
              <span><strong>{currentUser.display_name || currentUser.full_name || currentUser.username || 'Student'}</strong><small>Verified student</small></span>
              <button aria-label="Open profile settings" onClick={() => navigate('/settings')}><MoreHorizontal size={18} /></button>
            </div>
          </aside>

          {/* Column 2: Active Chat */}
          <div className="messenger-chat-panel" style={{
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-canvas)',
            height: '100%',
            minWidth: 0,
            position: 'relative',
          }}>
            {/* Chat Header */}
            <div className="messenger-chat-header" style={{
              height: '56px',
              borderBottom: '1px solid var(--border)',
              padding: '0 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              background: 'var(--bg-surface)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'var(--primary)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 700,
                }}>
                  {activeConv.initials}
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {activeConv.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>●</span> Online · {activeConv.major}
                  </div>
                </div>
              </div>
              <div className="messenger-chat-actions">
                <button type="button" aria-label="Start voice call" title="Voice call" onClick={() => setCallPreview('voice')}><Phone size={17} /></button>
                <button type="button" aria-label="Start video call" title="Video call" onClick={() => setCallPreview('video')}><Video size={17} /></button>
                <button type="button" className={`messenger-profile-toggle ${profileOpen ? 'is-open' : ''}`} aria-label={profileOpen ? 'Close profile panel' : 'Open profile panel'} aria-pressed={profileOpen} title={profileOpen ? 'Close profile' : 'Open profile'} onClick={() => setProfileOpen((open) => !open)}><UserRound size={17} />{profileOpen && <i aria-hidden="true" />}</button>
              </div>
            </div>

            {callPreview && <div className="messenger-call-notice" role="status"><span>{callPreview === 'voice' ? 'Voice' : 'Video'} calls are not connected in this preview yet.</span><button type="button" aria-label="Dismiss call notice" onClick={() => setCallPreview(null)}><X size={15} /></button></div>}

            {/* Chat Messages */}
            <div className="messenger-chat-messages" style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="messenger-date-divider" style={{ textAlign: 'center', margin: '8px 0 16px' }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--text-subtle)',
                  letterSpacing: '0.06em',
                  background: 'var(--bg-surface)',
                  padding: '4px 12px',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                }}>
                  MONDAY, 2 NOVEMBER
                </span>
              </div>

              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`messenger-message-row ${msg.isMe ? 'is-outgoing' : 'is-incoming'}`}
                  style={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: msg.isMe ? 'flex-end' : 'flex-start',
                  }}
                >
                  {msg.attachment ? (
                    <div className="messenger-bubble messenger-attachment-bubble" style={{
                      padding: '12px 16px',
                      background: 'var(--bg-raised)',
                      border: '1px solid var(--border-bright)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      maxWidth: '380px',
                    }}>
                      <div style={{ fontSize: '24px' }}>📄</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {msg.attachment.name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {msg.attachment.meta}
                        </div>
                      </div>
                      <button style={{
                        background: 'var(--primary)',
                        color: '#ffffff',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                      }}>
                        Download ↓
                      </button>
                    </div>
                  ) : (
                    <div className="messenger-bubble" style={{
                      maxWidth: '480px',
                      padding: '12px 16px',
                      borderRadius: msg.isMe ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                      background: msg.isMe ? 'var(--primary)' : 'var(--bg-surface)',
                      color: msg.isMe ? '#ffffff' : 'var(--text-primary)',
                      border: msg.isMe ? 'none' : '1px solid var(--border)',
                      fontSize: '13.5px',
                      lineHeight: 1.45,
                    }}>
                      {msg.text}
                    </div>
                  )}

                  <div style={{ fontSize: '11px', color: 'var(--text-subtle)', marginTop: '4px', display: 'flex', gap: '6px' }}>
                    <span>{msg.time}</span>
                    {msg.status && <span>· {msg.status}</span>}
                  </div>
                </div>
              ))}

              <div className="messenger-typing-indicator" style={{ width: '100%', fontSize: '12px', color: 'var(--text-subtle)', fontStyle: 'italic', marginTop: '6px' }}>
                Meera is typing…
              </div>
              <div ref={messagesEndRef} aria-hidden="true" />
            </div>

            {/* Message Input Box */}
            <form className="messenger-chat-composer" onSubmit={handleSendMessage} style={{
              padding: '16px 20px',
              borderTop: '1px solid var(--border)',
              background: 'var(--bg-surface)',
            }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={`Message ${activeConv.name}…`}
                  style={{ flex: 1, background: 'var(--bg-raised)' }}
                />
                <button
                  type="submit"
                  aria-label="Send message"
                  title="Send message"
                  style={{
                    background: 'var(--primary)',
                    color: '#ffffff',
                    padding: '8px 18px',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 600,
                    fontSize: '13px',
                  }}
                >
                  <Rocket size={17} />
                </button>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-subtle)', marginTop: '6px' }}>
                Enter to send · Shift + Enter for a new line
              </div>
            </form>
          </div>

          {/* Column 3: Shared Context & Profile Sidebar */}
          {profileOpen && <aside className="messenger-profile-panel" style={{
            borderLeft: '1px solid var(--border)',
            background: 'var(--bg-navigation)',
            padding: '24px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}>
            <button type="button" className="messenger-profile-close" aria-label="Close profile panel" title="Close profile" onClick={() => setProfileOpen(false)}><X size={17} /></button>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'var(--bg-raised)',
                border: '2px solid var(--primary)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                fontWeight: 800,
                margin: '0 auto 12px',
              }}>
                {activeConv.initials}
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {activeConv.name}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {activeConv.major}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-subtle)', marginTop: '2px' }}>
                IISER Tirupati
              </div>
              <button style={{
                marginTop: '12px',
                padding: '6px 14px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '12px',
              }}>
                View profile
              </button>
            </div>

            {/* Shared Files */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase', marginBottom: '10px' }}>
                Shared files
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ padding: '8px 10px', background: 'var(--bg-surface)', borderRadius: '6px', fontSize: '12.5px', color: 'var(--text-primary)' }}>
                  📄 Perturbation_theory.pdf
                </div>
                <div style={{ padding: '8px 10px', background: 'var(--bg-surface)', borderRadius: '6px', fontSize: '12.5px', color: 'var(--text-primary)' }}>
                  📄 QM_complete_notes.pdf
                </div>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--primary)', marginTop: '8px', cursor: 'pointer' }}>
                View all 12 files →
              </div>
            </div>

            {/* Connected Info */}
            <div style={{
              fontSize: '12px',
              color: 'var(--text-subtle)',
              borderTop: '1px solid var(--border)',
              paddingTop: '16px',
              lineHeight: 1.4,
            }}>
              Connected through PHY 301 and Quantum Collective.
            </div>
          </aside>}
        </div>
      </div>

      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
};
