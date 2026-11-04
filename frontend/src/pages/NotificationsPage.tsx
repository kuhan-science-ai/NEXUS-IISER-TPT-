import React, { useState } from 'react';
import { UserSummary } from '../services/api';
import { SideNav } from '../components/SideNav';
import { TopHeader } from '../components/TopHeader';
import { GlobalSearchModal } from '../components/GlobalSearchModal';

interface NotificationsPageProps {
  currentUser: UserSummary | null;
  onLogout?: () => void;
}

export const NotificationsPage: React.FC<NotificationsPageProps> = ({ currentUser, onLogout }) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'academic' | 'community' | 'campus'>('all');

  const notifications = [
    {
      id: 1,
      sender: 'Meera Iyer',
      initials: 'MI',
      title: 'Meera Iyer sent you a message',
      body: '“Library after lunch?”',
      time: '2 minutes ago · Messenger',
      action: 'Reply →',
      unread: true,
      category: 'community',
    },
    {
      id: 2,
      sender: 'Quantum Collective',
      initials: 'QC',
      title: 'Your study session is tomorrow',
      body: 'Quantum Collective · Perturbation theory · 18:00',
      time: '15 minutes ago · Study Groups',
      action: 'View session →',
      unread: true,
      category: 'academic',
    },
    {
      id: 3,
      sender: 'Meera Iyer',
      initials: 'MI',
      title: 'New notes in PHY 301',
      body: 'Meera uploaded Quantum Mechanics — Complete Notes.',
      time: '20 minutes ago · Academic Repository',
      action: 'Open resource →',
      unread: true,
      category: 'academic',
    },
    {
      id: 4,
      sender: 'Physics Office',
      initials: 'PHY',
      title: 'Problem set 04 is due tomorrow',
      body: 'PHY 301 · Submit before 23:59 on 3 November.',
      time: '1 hour ago · My Courses',
      action: 'View assignment →',
      unread: true,
      category: 'academic',
    },
    {
      id: 5,
      sender: 'Academic Office',
      initials: 'AO',
      title: 'Library hours extended for mid-sems',
      body: 'Open until 01:00 from 2–13 November.',
      time: '2 hours ago · Academic Office',
      action: 'Read notice →',
      unread: true,
      category: 'campus',
    },
    {
      id: 6,
      sender: 'Arjun Nair',
      initials: 'AN',
      title: 'Arjun Nair found your answer helpful',
      body: 'Question #040 · 1 November · 18:42',
      time: 'Yesterday · QOTD',
      action: 'View response →',
      unread: false,
      category: 'community',
    },
  ];

  if (!currentUser) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-canvas)' }}>
      <SideNav currentUser={currentUser} onLogout={onLogout} onOpenSearch={() => setSearchOpen(true)} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopHeader
          breadcrumb="Workspace / Notifications"
          currentUser={currentUser}
          onOpenSearch={() => setSearchOpen(true)}
          actionButton={{
            label: 'Mark all as read',
            onClick: () => alert('All notifications marked as read.'),
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
          <div style={{ marginBottom: '24px' }}>
            <h1 style={{ fontSize: '28px', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)' }}>
              You're in the loop.
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>
              The updates that matter, all in one place.
            </p>
          </div>

          {/* Sub Navigation */}
          <div style={{
            display: 'flex',
            gap: '24px',
            borderBottom: '1px solid var(--border)',
            marginBottom: '28px',
            fontSize: '14px',
          }}>
            {[
              { id: 'all', label: 'All updates' },
              { id: 'unread', label: 'Unread · 5' },
              { id: 'academic', label: 'Academic' },
              { id: 'community', label: 'Community' },
              { id: 'campus', label: 'Campus' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '0 0 12px',
                  color: activeTab === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
                  borderBottom: activeTab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
                  fontWeight: activeTab === t.id ? 600 : 500,
                  cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '28px' }}>
            {/* Notifications List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                TODAY · 2 NOVEMBER
              </div>

              {notifications
                .filter((n) => {
                  if (activeTab === 'unread') return n.unread;
                  if (activeTab === 'academic') return n.category === 'academic';
                  if (activeTab === 'community') return n.category === 'community';
                  if (activeTab === 'campus') return n.category === 'campus';
                  return true;
                })
                .map((n) => (
                  <div
                    key={n.id}
                    style={{
                      padding: '16px 20px',
                      background: n.unread ? 'var(--bg-surface)' : 'transparent',
                      border: '1px solid',
                      borderColor: n.unread ? 'var(--border)' : 'var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '16px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        background: 'var(--bg-raised)',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 700,
                      }}>
                        {n.initials}
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {n.title}
                          </span>
                          {n.unread && (
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary)' }} />
                          )}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {n.body}
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-subtle)', marginTop: '4px' }}>
                          {n.time}
                        </div>
                      </div>
                    </div>

                    <button style={{
                      background: 'transparent',
                      color: 'var(--primary)',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                    }}>
                      {n.action}
                    </button>
                  </div>
                ))}
            </div>

            {/* Right Column: Quiet Hours & Intentional settings */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '22px',
              }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  Keep it intentional
                </div>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: '14px' }}>
                  Choose what reaches you. Academic deadlines and direct messages are on; the rest is up to you.
                </p>
                <div style={{ fontSize: '12.5px', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>
                  Notification preferences →
                </div>
              </div>

              <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '22px',
              }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  YOUR QUIET HOURS
                </div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  22:00 – 07:00
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-subtle)', marginTop: '6px', lineHeight: 1.4 }}>
                  Push notifications pause during quiet hours. Your updates will be here when you’re back.
                </p>
                <div style={{ fontSize: '12px', color: 'var(--primary)', marginTop: '12px', cursor: 'pointer' }}>
                  Edit quiet hours →
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
};
