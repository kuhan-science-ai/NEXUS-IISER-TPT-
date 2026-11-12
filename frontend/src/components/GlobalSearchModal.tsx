import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { api } from '../services/api';
import { ProfileAvatar } from './ProfileAvatar';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [resources, setResources] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // open handled externally if needed
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    api.listResources(query.trim() || undefined).then(results => { if (active) setResources(Array.isArray(results) ? results : []); }).catch(() => { if (active) setResources([]); });
    return () => { active = false; };
  }, [isOpen, query]);

  useEffect(() => {
    if (!isOpen || !query.trim()) { setPeople([]); return; }
    let active = true;
    const refresh = () => void api.searchUsers(query.trim()).then(rows => { if (active) setPeople(rows); }).catch(() => { if (active) setPeople([]); });
    const timer = window.setTimeout(refresh, 180);
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 15000);
    return () => { active = false; window.clearTimeout(timer); window.clearInterval(interval); };
  }, [isOpen, query]);

  if (!isOpen) return null;

  const mockPeopleGroups = [
    { name: 'Quantum Collective', desc: 'Study group · 12 students · PHY 301', type: 'Group', path: '/studygroups' },
    { name: 'Skywatchers Club', desc: 'Campus club · 148 students · Astronomy night Fri', type: 'Club', path: '/campus?tab=events' },
  ];

  const filteredPeople = query
    ? mockPeopleGroups.filter(p => p.name.toLowerCase().includes(query.toLowerCase()) || p.desc.toLowerCase().includes(query.toLowerCase()))
    : mockPeopleGroups;

  return (
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
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: 'max(16px, 6vh) 12px 16px',
        boxSizing: 'border-box',
        overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '620px',
          maxHeight: '88vh',
          boxSizing: 'border-box',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-bright)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-modal)',
          overflowY: 'auto',
          animation: 'fadeIn 0.15s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          gap: '12px',
          background: 'var(--bg-raised)',
        }}>
          <Search size={18} color="var(--primary)" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes, people, clubs, study sessions…"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              boxShadow: 'none',
              padding: 0,
              fontSize: '16px',
              color: 'var(--text-primary)',
            }}
          />
          <kbd
            onClick={onClose}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div style={{ maxHeight: '420px', overflowY: 'auto', padding: '16px 20px' }}>
          {/* Resources Section */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: 'var(--text-subtle)',
              marginBottom: '10px',
              textTransform: 'uppercase',
            }}>
              Academic Resources
            </div>
            {resources.map((res, i) => (
              <div
                key={i}
                onClick={() => {
                  navigate(`/repository?resourceId=${encodeURIComponent(res.id)}`);
                  onClose();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  transition: 'background var(--transition)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-raised)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {res.title}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {res.subject_code || res.subject || 'Academic resource'} · {res.publisher_name || res.uploader_name || 'Publisher'} · {res.pages || 1} pages
                  </div>
                </div>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--primary)',
                  background: 'var(--primary-glow)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                }}>
                  PDF
                </span>
              </div>
            ))}
            {!resources.length && <p style={{ padding: '8px 12px', color: 'var(--text-subtle)', fontSize: 12 }}>{query ? 'No matching academic resources.' : 'No academic resources have been uploaded yet.'}</p>}
          </div>

          {/* Groups & People Section */}
          <div>
            <div style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: 'var(--text-subtle)',
              marginBottom: '10px',
              textTransform: 'uppercase',
            }}>
              Groups & People
            </div>
            {filteredPeople.map((p, i) => (
              <div
                key={i}
                onClick={() => {
                  navigate(p.path);
                  onClose();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  transition: 'background var(--transition)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-raised)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {p.desc}
                  </div>
                </div>
                <span style={{
                  fontSize: '11px',
                  color: 'var(--secondary)',
                  background: 'var(--secondary-glow)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontWeight: 500,
                }}>
                  {p.type}
                </span>
              </div>
            ))}
            {people.map(person => <div key={person.id} onClick={() => { navigate('/friends'); onClose(); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }} onMouseEnter={event => { event.currentTarget.style.background = 'var(--bg-raised)'; }} onMouseLeave={event => { event.currentTarget.style.background = 'transparent'; }}><ProfileAvatar className="friends-avatar" user={person} /><div style={{ minWidth: 0 }}><div style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>{person.full_name || person.username}</div><div style={{ color: 'var(--text-muted)', fontSize: 11 }}>@{person.username}{person.department ? ` · ${person.department}` : ''}</div></div><span style={{ marginLeft: 'auto', color: 'var(--secondary)', fontSize: 11 }}>Student</span></div>)}
          </div>
        </div>

        {/* Footer Hint */}
        <div style={{
          padding: '10px 20px',
          background: 'var(--bg-raised)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px',
          color: 'var(--text-subtle)',
        }}>
          <div>
            <span style={{ color: 'var(--text-primary)' }}>↑ ↓</span> to navigate ·{' '}
            <span style={{ color: 'var(--text-primary)' }}>Enter</span> to open ·{' '}
            <span style={{ color: 'var(--text-primary)' }}>Esc</span> to close
          </div>
          <div>IISER Tirupati Campus Network</div>
        </div>
      </div>
    </div>
  );
};
