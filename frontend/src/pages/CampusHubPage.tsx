import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UserSummary } from '../services/api';
import { SideNav } from '../components/SideNav';
import { TopHeader } from '../components/TopHeader';
import { GlobalSearchModal } from '../components/GlobalSearchModal';
import { Zap, CalendarDays, Search, BriefcaseBusiness, MessageCircle } from 'lucide-react';

interface CampusHubPageProps {
  currentUser: UserSummary | null;
  onLogout?: () => void;
}

export const CampusHubPage: React.FC<CampusHubPageProps> = ({ currentUser, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);

  // Parse active tab from URL query params (e.g. ?tab=events)
  const getInitialTab = () => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'events') return 'events';
    if (tabParam === 'lostfound') return 'lostfound';
    if (tabParam === 'opportunities') return 'opportunities';
    return 'pulse';
  };

  const [activeTab, setActiveTab] = useState<'pulse' | 'events' | 'lostfound' | 'opportunities'>(getInitialTab);

  useEffect(() => {
    setActiveTab(getInitialTab());
  }, [location.search]);

  const handleTabChange = (tab: 'pulse' | 'events' | 'lostfound' | 'opportunities') => {
    setActiveTab(tab);
    navigate(tab === 'pulse' ? '/campus' : `/campus?tab=${tab}`);
  };

  if (!currentUser) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-canvas)' }}>
      <SideNav currentUser={currentUser} onLogout={onLogout} onOpenSearch={() => setSearchOpen(true)} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopHeader
          breadcrumb={
            activeTab === 'pulse' ? 'Campus / Campus Pulse' :
            activeTab === 'events' ? 'Campus / Events' :
            activeTab === 'lostfound' ? 'Campus / Lost & Found' : 'Campus / Opportunities'
          }
          currentUser={currentUser}
          onOpenSearch={() => setSearchOpen(true)}
        />

        <main style={{
          flex: 1,
          padding: '24px',
          maxWidth: 'none',
          width: '100%',
          margin: '0',
        }}>
          {/* Hub Navigation Tabs */}
          <div style={{
            display: 'flex',
            gap: '24px',
            borderBottom: '1px solid var(--border)',
            marginBottom: '28px',
            fontSize: '14px',
            fontWeight: 500,
          }}>
            <button
              onClick={() => handleTabChange('pulse')}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '0 0 12px',
                color: activeTab === 'pulse' ? 'var(--text-primary)' : 'var(--text-muted)',
                borderBottom: activeTab === 'pulse' ? '2px solid var(--primary)' : '2px solid transparent',
                fontWeight: activeTab === 'pulse' ? 600 : 500,
                cursor: 'pointer',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Zap size={15} /> Campus Pulse</span>
            </button>
            <button
              onClick={() => handleTabChange('events')}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '0 0 12px',
                color: activeTab === 'events' ? 'var(--text-primary)' : 'var(--text-muted)',
                borderBottom: activeTab === 'events' ? '2px solid var(--primary)' : '2px solid transparent',
                fontWeight: activeTab === 'events' ? 600 : 500,
                cursor: 'pointer',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><CalendarDays size={15} /> Events</span>
            </button>
            <button
              onClick={() => handleTabChange('lostfound')}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '0 0 12px',
                color: activeTab === 'lostfound' ? 'var(--text-primary)' : 'var(--text-muted)',
                borderBottom: activeTab === 'lostfound' ? '2px solid var(--primary)' : '2px solid transparent',
                fontWeight: activeTab === 'lostfound' ? 600 : 500,
                cursor: 'pointer',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Search size={15} /> Lost & Found</span>
            </button>
            <button
              onClick={() => handleTabChange('opportunities')}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '0 0 12px',
                color: activeTab === 'opportunities' ? 'var(--text-primary)' : 'var(--text-muted)',
                borderBottom: activeTab === 'opportunities' ? '2px solid var(--primary)' : '2px solid transparent',
                fontWeight: activeTab === 'opportunities' ? 600 : 500,
                cursor: 'pointer',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><BriefcaseBusiness size={15} /> Opportunities</span>
            </button>
          </div>

          {/* TAB 1: CAMPUS PULSE (Page 12) */}
          {activeTab === 'pulse' && (
            <div>
              <div style={{ marginBottom: '24px' }}>
                <h1 style={{ fontSize: '28px', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)' }}>
                  The campus, in the moment.
                </h1>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Small updates, big plans, and everything in between.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '28px' }}>
                {/* Main Feed */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Share an update card */}
                  <div style={{
                    padding: '16px 20px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                  }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: 'var(--primary)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}>
                      AR
                    </div>
                    <input
                      type="text"
                      placeholder="What's happening on campus, Ananya?"
                      style={{ flex: 1, background: 'var(--bg-raised)' }}
                    />
                    <button style={{
                      background: 'var(--primary)',
                      color: '#ffffff',
                      padding: '8px 16px',
                      borderRadius: 'var(--radius-sm)',
                      fontWeight: 600,
                      fontSize: '13px',
                    }}>
                      Share
                    </button>
                  </div>

                  {/* Official Notice Pinned */}
                  <div style={{
                    padding: '20px',
                    background: 'var(--bg-surface)',
                    borderLeft: '4px solid var(--primary)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase' }}>
                        OFFICIAL NOTICE · PINNED
                      </span>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-subtle)' }}>Posted today · 08:30</span>
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                      Library hours extended for mid-semester exams
                    </div>
                    <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      Open until 01:00 from 2–13 November for mid-semester preparation. Student ID required after 22:00.
                    </p>
                    <div style={{ fontSize: '12px', color: 'var(--text-subtle)', marginTop: '10px' }}>
                      Academic Office · IISER Tirupati
                    </div>
                  </div>

                  {/* Post 1: Skywatchers Club */}
                  <div style={{
                    padding: '22px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                      <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '8px',
                        background: 'var(--bg-raised)',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '13px',
                      }}>
                        SC
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Skywatchers Club</span>
                          <span style={{ color: 'var(--secondary)', fontSize: '13px' }}>✓</span>
                        </div>
                        <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>2 hours ago · Campus clubs</span>
                      </div>
                    </div>
                    <p style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: '14px' }}>
                      Clear skies are on the forecast. Bring your curiosity (and a light jacket) for Astronomy Night this Friday. First-time stargazers welcome. 🔭
                    </p>
                    <div style={{
                      padding: '12px 16px',
                      background: 'var(--bg-raised)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '14px',
                    }}>
                      <div>
                        <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>Astronomy Night</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>6 Nov · 19:00 · Academic rooftop</div>
                      </div>
                      <button
                        onClick={() => handleTabChange('events')}
                        style={{
                          background: 'var(--primary)',
                          color: '#ffffff',
                          padding: '6px 14px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        View event →
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '20px', fontSize: '13px', color: 'var(--text-muted)' }}>
                      <span>♡ 64</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><MessageCircle size={14} /> 12 comments</span>
                      <span>↗ Share</span>
                    </div>
                  </div>

                  {/* Post 2: Sana Khan */}
                  <div style={{
                    padding: '22px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                      <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        background: 'var(--bg-raised)',
                        color: 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '12px',
                      }}>
                        SK
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Sana Khan</div>
                        <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>BS–MS 2024 · 3 hours ago</span>
                      </div>
                    </div>
                    <p style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: '14px' }}>
                      Found a tiny sunbird nest near the library walkway. A gentle reminder to keep that corner quiet this week 🌿
                    </p>
                    <div style={{ display: 'flex', gap: '20px', fontSize: '13px', color: 'var(--text-muted)' }}>
                      <span>♡ 38</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><MessageCircle size={14} /> 6 comments</span>
                      <span style={{ color: 'var(--primary)' }}>#CampusWildlife</span>
                    </div>
                  </div>
                </div>

                {/* Right Sidebar: Campus Radar & Clubs to follow */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* On the Campus Radar */}
                  <div style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '20px',
                  }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px' }}>
                      On the campus radar
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div>
                        <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--primary)' }}>#MidSemMode</div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-subtle)' }}>42 conversations</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--primary)' }}>#AstronomyNight</div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-subtle)' }}>28 conversations</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--primary)' }}>#ResearchDiaries</div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-subtle)' }}>16 conversations</div>
                      </div>
                    </div>
                  </div>

                  {/* Clubs to follow */}
                  <div style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '20px',
                  }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px' }}>
                      Clubs to follow
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Prakriti · Nature Club</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>214 students</div>
                        </div>
                        <button style={{
                          background: 'var(--bg-raised)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-primary)',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '12px',
                        }}>
                          Follow
                        </button>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Chemistry Society</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>186 students</div>
                        </div>
                        <button style={{
                          background: 'var(--bg-raised)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-primary)',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '12px',
                        }}>
                          Follow
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EVENTS (Page 13) */}
          {activeTab === 'events' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                  <h1 style={{ fontSize: '28px', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Clear your calendar for the good stuff.
                  </h1>
                  <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Discover what’s happening across IISER Tirupati.
                  </p>
                </div>
                <button style={{
                  background: 'var(--primary)',
                  color: '#ffffff',
                  padding: '9px 18px',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 600,
                  fontSize: '13.5px',
                }}>
                  + Create event
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '28px' }}>
                {/* Event Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {/* Featured Event: Astronomy Night */}
                  <div style={{
                    padding: '24px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--primary)',
                    borderRadius: 'var(--radius-lg)',
                    position: 'relative',
                  }}>
                    <div style={{
                      display: 'inline-block',
                      background: 'var(--primary-glow)',
                      color: 'var(--primary)',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '4px',
                      marginBottom: '12px',
                      textTransform: 'uppercase',
                    }}>
                      FEATURED · SKYWATERS CLUB
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                          Astronomy night
                        </h3>
                        <div style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                          Friday, 6 Nov · 19:00 – 21:00 · Academic Block rooftop
                        </div>
                        <p style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: '16px' }}>
                          A guided tour of Jupiter, Saturn and a sky full of questions.
                        </p>
                        <div style={{ fontSize: '12.5px', color: 'var(--text-subtle)' }}>
                          48 going · Meera, Arjun and 6 friends
                        </div>
                      </div>
                      <span style={{
                        background: 'var(--secondary-glow)',
                        color: 'var(--secondary)',
                        padding: '6px 14px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '12px',
                        fontWeight: 700,
                      }}>
                        Going ✓
                      </span>
                    </div>
                  </div>

                  {/* Event 2: Research over chai */}
                  <div style={{
                    padding: '20px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 700 }}>04 NOV</span>
                      <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                        Research over chai
                      </h4>
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Wed, 4 Nov · 17:00 · Student Activity Centre · 32 going
                      </div>
                    </div>
                    <button style={{
                      background: 'var(--bg-raised)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                      padding: '8px 16px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '13px',
                      fontWeight: 600,
                    }}>
                      RSVP
                    </button>
                  </div>

                  {/* Event 3: Campus biodiversity walk */}
                  <div style={{
                    padding: '20px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 700 }}>07 NOV</span>
                      <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                        Campus biodiversity walk
                      </h4>
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Sat, 7 Nov · 06:30 · Main gate · Prakriti Nature Club · 24 going
                      </div>
                    </div>
                    <button style={{
                      background: 'var(--bg-raised)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                      padding: '8px 16px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '13px',
                      fontWeight: 600,
                    }}>
                      RSVP
                    </button>
                  </div>
                </div>

                {/* Mini Calendar Widget */}
                <div style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '20px',
                  alignSelf: 'flex-start',
                }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px' }}>
                    November 2026
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    textAlign: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    color: 'var(--text-subtle)',
                    marginBottom: '10px',
                  }}>
                    <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    textAlign: 'center',
                    gap: '6px',
                    fontSize: '12.5px',
                  }}>
                    <span style={{ color: 'var(--text-faint)' }}>1</span>
                    <span style={{ color: 'var(--primary)', fontWeight: 700 }}>2</span>
                    <span>3</span>
                    <span style={{ color: 'var(--secondary)', fontWeight: 700 }}>4</span>
                    <span>5</span>
                    <span style={{ background: 'var(--primary)', color: '#ffffff', borderRadius: '50%', fontWeight: 700 }}>6</span>
                    <span style={{ color: 'var(--secondary)', fontWeight: 700 }}>7</span>
                    <span>8</span><span>9</span><span>10</span><span>11</span><span>12</span><span>13</span><span>14</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                    ● 3 events on your calendar
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: LOST & FOUND (Page 14) */}
          {activeTab === 'lostfound' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                  <h1 style={{ fontSize: '28px', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Lost it? Let's find it.
                  </h1>
                  <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    A little campus kindness goes a long way.
                  </p>
                </div>
                <button style={{
                  background: 'var(--primary)',
                  color: '#ffffff',
                  padding: '9px 18px',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 600,
                  fontSize: '13.5px',
                }}>
                  + Report an item
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '28px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Item 1 */}
                  <div style={{
                    padding: '20px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{
                        background: 'var(--secondary-glow)',
                        color: 'var(--secondary)',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '4px',
                      }}>
                        FOUND
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>Today, 09:15 · Meera Iyer</span>
                    </div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      Black prescription glasses
                    </h3>
                    <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                      Black frame in a grey case. Left on the window-side table in Library Reading Room 2.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>⌖ Library · Reading room 2</span>
                      <button style={{
                        background: 'var(--primary-glow)',
                        color: 'var(--primary)',
                        padding: '6px 14px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}>
                        This might be mine
                      </button>
                    </div>
                  </div>

                  {/* Item 2 */}
                  <div style={{
                    padding: '20px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{
                        background: 'rgba(240, 141, 152, 0.15)',
                        color: 'var(--danger)',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '4px',
                      }}>
                        LOST
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>Today, 08:40 · Arjun Nair</span>
                    </div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      Hostel keys with blue tag
                    </h3>
                    <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                      Two keys on a blue fabric keychain. Please message if spotted between Hostel B and Academic Block.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>⌖ Hostel B → Academic Block</span>
                      <button style={{
                        background: 'var(--bg-raised)',
                        color: 'var(--text-primary)',
                        padding: '6px 14px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '12px',
                        fontWeight: 600,
                        border: '1px solid var(--border)',
                      }}>
                        I have information
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Rules & Reunion Counter */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '20px',
                  }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
                      A few good rules
                    </div>
                    <ol style={{ fontSize: '12.5px', color: 'var(--text-muted)', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '8px', lineHeight: 1.4 }}>
                      <li>Keep one identifying detail private so the owner can confirm it.</li>
                      <li>Meet in a public campus space when returning an item.</li>
                      <li>Mark your post resolved when it finds its way home.</li>
                    </ol>
                  </div>

                  <div style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '20px',
                  }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>
                      38 HAPPY REUNIONS
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>
                      Calculator returned
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-subtle)' }}>LH 204 · Resolved today</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: OPPORTUNITIES (Page 15) */}
          {activeTab === 'opportunities' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                  <h1 style={{ fontSize: '28px', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Your next chapter starts with a look.
                  </h1>
                  <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Research, internships and experiences worth making time for.
                  </p>
                </div>
                <button style={{
                  background: 'var(--primary)',
                  color: '#ffffff',
                  padding: '9px 18px',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 600,
                  fontSize: '13.5px',
                }}>
                  + Share opportunity
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '28px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Opportunity 1 */}
                  <div style={{
                    padding: '22px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>National Science Academies · India</span>
                      <span style={{ fontSize: '12px', color: 'var(--warning)', fontWeight: 600 }}>Apply by 15 Nov 2026</span>
                    </div>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                      Summer Research Fellowship 2027
                    </h3>
                    <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '14px' }}>
                      8-week research placement with a faculty mentor. Open to BS–MS students in years II–IV across all sciences.
                    </p>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{
                        background: 'var(--primary-glow)',
                        color: 'var(--primary)',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                      }}>
                        Fellowship
                      </span>
                      <span style={{
                        background: 'var(--secondary-glow)',
                        color: 'var(--secondary)',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                      }}>
                        Stipend available
                      </span>
                    </div>
                  </div>

                  {/* Opportunity 2 */}
                  <div style={{
                    padding: '22px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>National Centre for Scientific Research</span>
                      <span style={{ fontSize: '12px', color: 'var(--warning)', fontWeight: 600 }}>Apply by 20 Nov 2026</span>
                    </div>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                      Winter School in Condensed Matter
                    </h3>
                    <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '14px' }}>
                      Lectures and hands-on sessions in many-body physics for advanced undergraduates. Travel and accommodation covered.
                    </p>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{
                        background: 'var(--bg-raised)',
                        color: 'var(--text-muted)',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                      }}>
                        Winter school
                      </span>
                      <span style={{
                        background: 'var(--secondary-glow)',
                        color: 'var(--secondary)',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                      }}>
                        Travel support
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Tracker Card */}
                <div style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '20px',
                  alignSelf: 'flex-start',
                }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px' }}>
                    Your application board · 3 in progress
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ padding: '10px 12px', background: 'var(--bg-raised)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Summer fellowship</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-subtle)' }}>Draft · Statement of purpose</div>
                    </div>
                    <div style={{ padding: '10px 12px', background: 'var(--bg-raised)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Winter school</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-subtle)' }}>Preparing · Request reference</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
};
