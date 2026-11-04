import React, { useState } from 'react';
import { UserSummary } from '../services/api';
import { SideNav } from '../components/SideNav';
import { TopHeader } from '../components/TopHeader';
import { GlobalSearchModal } from '../components/GlobalSearchModal';

interface ForumsPageProps {
  currentUser: UserSummary | null;
  onLogout?: () => void;
}

export const ForumsPage: React.FC<ForumsPageProps> = ({ currentUser, onLogout }) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeChannel, setActiveChannel] = useState('# All discussions');
  const [activeFilter, setActiveFilter] = useState<'trending' | 'latest' | 'unanswered'>('trending');
  const [newDiscussionOpen, setNewDiscussionOpen] = useState(false);

  const channels = [
    '# All discussions',
    '# Physics lounge',
    '# Chemistry corner',
    '# Biology commons',
    '# Math circle',
    '# Campus conversations',
    '# Research & careers',
  ];

  const [discussions, setDiscussions] = useState([
    {
      id: 1,
      tag: 'Thermodynamics',
      title: 'Why does entropy increase in an isolated system?',
      snippet: 'I understand the equation, but I’m struggling with the intuition. Is it really just a question of probability?',
      author: 'Dev Patel',
      channel: '# Physics lounge',
      replies: 18,
      votes: 42,
      time: '2h ago',
      avatar: 'DP',
    },
    {
      id: 2,
      tag: 'Research',
      title: 'Summer research: how early should we email PIs?',
      snippet: 'For seniors who applied last year: what made a cold email actually work?',
      author: 'Sana Khan',
      channel: '# Research & careers',
      replies: 9,
      votes: 24,
      time: '5h ago',
      avatar: 'SK',
    },
    {
      id: 3,
      tag: 'MAT 201',
      title: 'A geometric way to understand eigenvectors',
      snippet: 'Sharing a visual explanation that helped our MAT 201 study group. Would love your feedback.',
      author: 'Arjun Nair',
      channel: '# Math circle',
      replies: 12,
      votes: 31,
      time: '4h ago',
      avatar: 'AN',
    },
  ]);

  const [newTitle, setNewTitle] = useState('');
  const [newTag, setNewTag] = useState('Physics');
  const [newSnippet, setNewSnippet] = useState('');

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setDiscussions([
      {
        id: Date.now(),
        tag: newTag,
        title: newTitle,
        snippet: newSnippet || 'Curious to hear thoughts from fellow students.',
        author: currentUser?.display_name || currentUser?.full_name || 'Ananya Rao',
        channel: '# Physics lounge',
        replies: 0,
        votes: 1,
        time: 'Just now',
        avatar: 'AR',
      },
      ...discussions,
    ]);
    setNewTitle('');
    setNewSnippet('');
    setNewDiscussionOpen(false);
  };

  if (!currentUser) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-canvas)' }}>
      <SideNav currentUser={currentUser} onLogout={onLogout} onOpenSearch={() => setSearchOpen(true)} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopHeader
          breadcrumb="Workspace / Discussion Forums"
          currentUser={currentUser}
          onOpenSearch={() => setSearchOpen(true)}
          actionButton={{
            label: 'Start a discussion',
            onClick: () => setNewDiscussionOpen(true),
            icon: '+',
          }}
        />

        <main style={{
          flex: 1,
          padding: '24px',
          maxWidth: 'none',
          width: '100%',
          margin: '0',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '24px',
          }}>
            <div>
              <h1 style={{ fontSize: '28px', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)' }}>
                Good questions live here.
              </h1>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Compare ideas, ask the obvious, follow your curiosity.
              </p>
            </div>
            <button
              onClick={() => setNewDiscussionOpen(true)}
              style={{
                background: 'var(--primary)',
                color: '#ffffff',
                padding: '9px 18px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 600,
                fontSize: '13.5px',
              }}
            >
              + Start a discussion
            </button>
          </div>

          {/* Subheader Filters: Trending, Latest, Unanswered */}
          <div style={{
            display: 'flex',
            gap: '24px',
            borderBottom: '1px solid var(--border)',
            marginBottom: '24px',
            fontSize: '14px',
            fontWeight: 500,
          }}>
            {['trending', 'latest', 'unanswered'].map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f as any)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '0 0 12px',
                  color: activeFilter === f ? 'var(--text-primary)' : 'var(--text-muted)',
                  borderBottom: activeFilter === f ? '2px solid var(--primary)' : '2px solid transparent',
                  fontWeight: activeFilter === f ? 600 : 500,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {f}
              </button>
            ))}
          </div>

          {/* 3-Column Grid: Channels | Threads | Community Sidebar */}
          <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 300px', gap: '28px', alignItems: 'flex-start' }}>
            {/* Channels Column */}
            <aside style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '18px',
            }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase', marginBottom: '12px' }}>
                Your channels
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {channels.map((ch) => {
                  const active = activeChannel === ch;
                  return (
                    <div
                      key={ch}
                      className={active ? 'forum-channel-active' : undefined}
                      onClick={() => setActiveChannel(ch)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '13px',
                        color: active ? '#ffffff' : 'var(--text-muted)',
                        background: active ? 'var(--bg-raised)' : 'transparent',
                        fontWeight: active ? 600 : 450,
                        cursor: 'pointer',
                      }}
                    >
                      {ch}
                    </div>
                  );
                })}
              </div>

              {/* Pinned thread preview */}
              <div style={{
                marginTop: '20px',
                paddingTop: '16px',
                borderTop: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--primary)', letterSpacing: '0.06em' }}>
                  PINNED FOR YOU
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>
                  The PHY 301 resource thread
                </div>
                <p style={{ fontSize: '11.5px', color: 'var(--text-subtle)', marginTop: '4px', lineHeight: 1.4 }}>
                  Notes, reading lists and useful simulations in one place.
                </p>
                <div style={{ fontSize: '12px', color: 'var(--primary)', marginTop: '6px', cursor: 'pointer' }}>
                  Open thread →
                </div>
              </div>
            </aside>

            {/* Threads List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {discussions
                .filter((d) => activeChannel === '# All discussions' || d.channel === activeChannel)
                .map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: '20px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      gap: '18px',
                      transition: 'border-color var(--transition)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-bright)')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                  >
                    {/* Upvote badge */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '44px',
                      height: '52px',
                      background: 'var(--bg-raised)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      flexShrink: 0,
                    }}>
                      <span style={{ fontSize: '12px', color: 'var(--primary)' }}>▲</span>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{item.votes}</span>
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span style={{
                          background: 'var(--primary-glow)',
                          color: 'var(--primary)',
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '4px',
                        }}>
                          {item.tag}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>{item.channel}</span>
                      </div>

                      <h3 style={{ fontSize: '15.5px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                        {item.title}
                      </h3>
                      <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: '12px' }}>
                        {item.snippet}
                      </p>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--text-subtle)' }}>
                        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{item.author}</span>
                        <span>·</span>
                        <span>{item.replies} replies</span>
                        <span>·</span>
                        <span>{item.time}</span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            {/* Right Community Sidebar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Active This Week */}
              <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '20px',
              }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px' }}>
                  Active this week
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>
                      MI
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Meera Iyer</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-subtle)' }}>28 helpful answers</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-raised)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>
                      AN
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Arjun Nair</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-subtle)' }}>21 helpful answers</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-raised)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>
                      DP
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Dev Patel</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-subtle)' }}>16 helpful answers</div>
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '12px', color: 'var(--secondary)', marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                  ● 36 students exploring ideas now
                </div>
              </div>

              {/* Community Guidelines */}
              <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '20px',
              }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  Community, with care
                </div>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                  Be curious. Be kind. Credit your sources. Disagree with ideas, not people.
                </p>
                <div style={{ fontSize: '12px', color: 'var(--primary)', marginTop: '8px', cursor: 'pointer' }}>
                  Read the guidelines ↗
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* New Discussion Modal */}
      {newDiscussionOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(5, 6, 8, 0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setNewDiscussionOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '540px',
              maxHeight: 'calc(100vh - 40px)',
              boxSizing: 'border-box',
              overflowY: 'auto',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-bright)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
              Start a new discussion
            </h3>
            <form onSubmit={handleCreatePost} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Question or Topic
                </label>
                <input
                  type="text"
                  placeholder="What would you like to explore?"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  style={{ width: '100%' }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Tag
                </label>
                <input
                  type="text"
                  placeholder="e.g. Thermodynamics, Optics, Algebra"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Details & Context
                </label>
                <textarea
                  rows={4}
                  placeholder="Give a bit of context or where you got stuck…"
                  value={newSnippet}
                  onChange={(e) => setNewSnippet(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setNewDiscussionOpen(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    color: 'var(--text-muted)',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 20px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--primary)',
                    color: '#ffffff',
                    fontWeight: 600,
                  }}
                >
                  Post Discussion
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
};
