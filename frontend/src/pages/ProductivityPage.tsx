import React, { useState, useEffect } from 'react';
import { UserSummary } from '../services/api';
import { SideNav } from '../components/SideNav';
import { TopHeader } from '../components/TopHeader';
import { GlobalSearchModal } from '../components/GlobalSearchModal';

interface ProductivityPageProps {
  currentUser: UserSummary | null;
  onLogout?: () => void;
}

export const ProductivityPage: React.FC<ProductivityPageProps> = ({ currentUser, onLogout }) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);

  useEffect(() => {
    let interval: any = null;
    if (timerRunning && timerSeconds > 0) {
      interval = setInterval(() => setTimerSeconds((s) => s - 1), 1000);
    } else if (timerSeconds === 0) {
      setTimerRunning(false);
    }
    return () => clearInterval(interval);
  }, [timerRunning, timerSeconds]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const [todoTasks, setTodoTasks] = useState([
    { id: 1, title: 'Problem set 04', meta: 'PHY 301 · Due tomorrow', tag: 'High priority', color: 'var(--danger)' },
    { id: 2, title: 'Read chapter 6 · Griffiths', meta: 'PHY 301 · Wed, 4 Nov', tag: 'Reading', color: 'var(--primary)' },
    { id: 3, title: 'Email research mentor', meta: 'Summer fellowship · Fri, 6 Nov', tag: 'Application', color: 'var(--secondary)' },
  ]);

  const [inProgressTasks, setInProgressTasks] = useState([
    { id: 4, title: 'Spectroscopy lab report', meta: 'CHM 301 · Thu, 5 Nov', tag: 'Lab work', color: 'var(--warning)' },
    { id: 5, title: 'Fellowship statement', meta: 'Draft 1 · 350 / 800 words', tag: 'Application', color: 'var(--secondary)' },
  ]);

  const [doneTasks, setDoneTasks] = useState([
    { id: 6, title: 'Upload QM notes', meta: 'Academic Repository · Today', tag: 'Shared ✓', color: 'var(--secondary)' },
    { id: 7, title: 'Book library room', meta: 'Quantum Collective · Tomorrow', tag: 'Complete ✓', color: 'var(--secondary)' },
  ]);

  if (!currentUser) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-canvas)' }}>
      <SideNav currentUser={currentUser} onLogout={onLogout} onOpenSearch={() => setSearchOpen(true)} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopHeader
          breadcrumb="Workspace / Productivity"
          currentUser={currentUser}
          onOpenSearch={() => setSearchOpen(true)}
          actionButton={{
            label: 'Add task',
            onClick: () => {
              const text = prompt('Task title:');
              if (text) {
                setTodoTasks([
                  ...todoTasks,
                  { id: Date.now(), title: text, meta: 'General · Today', tag: 'To do', color: 'var(--primary)' },
                ]);
              }
            },
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
          <div style={{ marginBottom: '24px' }}>
            <h1 style={{ fontSize: '28px', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)' }}>
              A little structure. A clearer head.
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Your work, at your pace. Monday, 2 November.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '28px' }}>
            {/* Kanban Board (Page 18) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '18px' }}>
              {/* Column 1: To do */}
              <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>To do</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-subtle)', background: 'var(--bg-raised)', padding: '2px 6px', borderRadius: '4px' }}>
                    {todoTasks.length}
                  </span>
                </div>

                {todoTasks.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      padding: '14px',
                      background: 'var(--bg-raised)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <span style={{
                      fontSize: '10.5px',
                      fontWeight: 700,
                      color: t.color,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}>
                      {t.tag}
                    </span>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>
                      {t.title}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-subtle)', marginTop: '4px' }}>
                      {t.meta}
                    </div>
                  </div>
                ))}
              </div>

              {/* Column 2: In progress */}
              <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>In progress</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-subtle)', background: 'var(--bg-raised)', padding: '2px 6px', borderRadius: '4px' }}>
                    {inProgressTasks.length}
                  </span>
                </div>

                {inProgressTasks.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      padding: '14px',
                      background: 'var(--bg-raised)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <span style={{
                      fontSize: '10.5px',
                      fontWeight: 700,
                      color: t.color,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}>
                      {t.tag}
                    </span>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>
                      {t.title}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-subtle)', marginTop: '4px' }}>
                      {t.meta}
                    </div>
                  </div>
                ))}
              </div>

              {/* Column 3: Done */}
              <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Done</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-subtle)', background: 'var(--bg-raised)', padding: '2px 6px', borderRadius: '4px' }}>
                    {doneTasks.length}
                  </span>
                </div>

                {doneTasks.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      padding: '14px',
                      background: 'var(--bg-raised)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      opacity: 0.85,
                    }}
                  >
                    <span style={{
                      fontSize: '10.5px',
                      fontWeight: 700,
                      color: t.color,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}>
                      {t.tag}
                    </span>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px', textDecoration: 'line-through' }}>
                      {t.title}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-subtle)', marginTop: '4px' }}>
                      {t.meta}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Focus Timer & Weekly Perspective (Page 18) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Focus Session Pomodoro */}
              <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '24px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  FOCUS SESSION
                </div>
                <div style={{
                  fontSize: '48px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  margin: '14px 0',
                }}>
                  {formatTimer(timerSeconds)}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '18px' }}>
                  25 min focus · 5 min break · Session 1 of 4
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                  <button
                    onClick={() => setTimerRunning(!timerRunning)}
                    style={{
                      background: timerRunning ? 'var(--warning)' : 'var(--primary)',
                      color: '#ffffff',
                      padding: '8px 24px',
                      borderRadius: 'var(--radius-sm)',
                      fontWeight: 600,
                      fontSize: '13.5px',
                    }}
                  >
                    {timerRunning ? 'Pause session' : 'Start focus session'}
                  </button>
                  <button
                    onClick={() => {
                      setTimerRunning(false);
                      setTimerSeconds(25 * 60);
                    }}
                    style={{
                      background: 'var(--bg-raised)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-muted)',
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '13px',
                    }}
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Your Week in Perspective */}
              <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '22px',
              }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  Your week, in perspective
                </div>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: '14px' }}>
                  Steady progress. Leave some room for a break. Done is better than perfect.
                </p>

                <div style={{
                  padding: '12px 14px',
                  background: 'var(--bg-raised)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    18 / 24 tasks
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--secondary)', fontWeight: 600 }}>
                    completed this week
                  </span>
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
