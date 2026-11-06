import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, UserSummary } from '../services/api';
import { SideNav } from '../components/SideNav';
import { TopHeader } from '../components/TopHeader';
import { GlobalSearchModal } from '../components/GlobalSearchModal';
import { UploadResourceModal } from '../components/UploadResourceModal';

interface RepositoryPageProps {
  currentUser: UserSummary | null;
  onLogout?: () => void;
}

export const RepositoryPage: React.FC<RepositoryPageProps> = ({ currentUser, onLogout }) => {
  const [searchParams] = useSearchParams();
  const requestedResourceId = searchParams.get('resourceId');
  const [requestedResource, setRequestedResource] = useState<any | null>(null);
  const [requestedResourceStatus, setRequestedResourceStatus] = useState('');
  const [activeTab, setActiveTab] = useState<'discover' | 'saved' | 'my' | 'recent'>('discover');
  const [selectedDiscipline, setSelectedDiscipline] = useState('All');
  const [selectedCourse, setSelectedCourse] = useState('PHY 301');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('Recently added');
  const [searchOpen, setSearchOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [savedIds, setSavedIds] = useState<number[]>([1, 3]);

  useEffect(() => {
    if (!requestedResourceId) { setRequestedResource(null); setRequestedResourceStatus(''); return; }
    let active = true;
    setRequestedResourceStatus('Finding your uploaded resource…');
    api.listResources().then(resources => {
      if (!active) return;
      const found = resources.find((resource: any) => String(resource.id) === requestedResourceId);
      setRequestedResource(found || null);
      setRequestedResourceStatus(found ? '' : 'This resource is not available in the current repository feed.');
    }).catch(() => { if (active) setRequestedResourceStatus('Could not load this resource from the repository.'); });
    return () => { active = false; };
  }, [requestedResourceId]);

  // Design resources matching Page 6 & Page 22 of Figma PDF
  const defaultResources = [
    {
      id: 1,
      title: 'Quantum Mechanics — Complete Notes',
      course: 'PHY 301',
      author: 'Meera Iyer',
      pages: 42,
      size: '2.4 MB',
      downloads: 248,
      rating: 4.9,
      type: 'Lecture notes',
      discipline: 'Physics',
    },
    {
      id: 2,
      title: 'Perturbation theory · Worked examples',
      course: 'PHY 301',
      author: 'Ananya Rao',
      pages: 18,
      size: '1.2 MB',
      downloads: 132,
      rating: 4.9,
      type: 'Tutorial',
      discipline: 'Physics',
    },
    {
      id: 3,
      title: 'Mid-semester question paper 2025',
      course: 'PHY 301',
      author: 'Arjun Nair',
      pages: 6,
      size: '840 KB',
      downloads: 196,
      rating: 4.9,
      type: 'Past paper',
      discipline: 'Physics',
    },
    {
      id: 4,
      title: 'Angular momentum cheat sheet',
      course: 'PHY 301',
      author: 'Dev Patel',
      pages: 4,
      size: '420 KB',
      downloads: 89,
      rating: 4.9,
      type: 'Quick reference',
      discipline: 'Physics',
    },
    {
      id: 5,
      title: 'Hydrogen atom · Tutorial 06',
      course: 'PHY 301',
      author: 'Meera Iyer',
      pages: 12,
      size: '1.8 MB',
      downloads: 74,
      rating: 4.9,
      type: 'Tutorial',
      discipline: 'Physics',
    },
    {
      id: 6,
      title: 'Organic Spectroscopy Problem Clinic',
      course: 'CHM 301',
      author: 'Priya Shah',
      pages: 28,
      size: '3.1 MB',
      downloads: 142,
      rating: 4.8,
      type: 'Lecture notes',
      discipline: 'Chemistry',
    },
  ];

  const disciplines = [
    { name: 'All', count: '2,436' },
    { name: 'Physics', count: '684' },
    { name: 'Chemistry', count: '512' },
    { name: 'Biology', count: '621' },
    { name: 'Mathematics', count: '408' },
    { name: 'Earth sciences', count: '211' },
  ];

  const userCourses = [
    { code: 'PHY 301', name: 'Quantum Mechanics' },
    { code: 'CHM 301', name: 'Spectroscopy' },
    { code: 'MAT 201', name: 'Linear Algebra' },
    { code: 'BIO 303', name: 'Ecology' },
  ];

  const toggleSave = (id: number) => {
    setSavedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const filtered = defaultResources.filter(r => {
    if (activeTab === 'saved') return savedIds.includes(r.id);
    if (activeTab === 'my') return r.author === 'Ananya Rao';
    if (selectedDiscipline !== 'All' && r.discipline !== selectedDiscipline) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return r.title.toLowerCase().includes(q) || r.course.toLowerCase().includes(q) || r.author.toLowerCase().includes(q);
    }
    return true;
  });

  if (!currentUser) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-canvas)' }}>
      <SideNav currentUser={currentUser} onLogout={onLogout} onOpenSearch={() => setSearchOpen(true)} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopHeader
          breadcrumb="Workspace / Academic Repository"
          currentUser={currentUser}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenUpload={() => setUploadOpen(true)}
        />

        <main style={{
          flex: 1,
          padding: '24px',
          maxWidth: 'none',
          width: '100%',
          margin: '0',
        }}>
          {requestedResourceId && <section style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18, padding: 16, border: '1px solid var(--primary)', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)' }}>
            <div><strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: 13 }}>{requestedResource?.title || requestedResourceStatus || 'Opening uploaded resource'}</strong><span style={{ display: 'block', marginTop: 4, color: 'var(--text-subtle)', fontSize: 11 }}>{requestedResource?.file?.filename || 'Selected from your browsing history'}</span></div>
            {requestedResource?.file?.download_url && <a href={requestedResource.file.download_url} target="_blank" rel="noreferrer" style={{ padding: '8px 12px', borderRadius: 6, background: 'var(--primary)', color: '#fff', fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>Open file</a>}
          </section>}
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '24px',
            flexWrap: 'wrap',
            gap: '16px',
          }}>
            <div>
              <h1 style={{
                fontSize: '28px',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '-0.5px',
              }}>
                Academic Repository
              </h1>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Good knowledge deserves to be passed on.
              </p>
            </div>
            <button
              onClick={() => setUploadOpen(true)}
              style={{
                background: 'var(--primary)',
                color: '#ffffff',
                padding: '10px 20px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 600,
                fontSize: '13.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: 'var(--shadow-sm)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--primary-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--primary)')}
            >
              <span>↑</span> Upload resource
            </button>
          </div>

          {/* Navigation Tabs */}
          <div style={{
            display: 'flex',
            gap: '24px',
            borderBottom: '1px solid var(--border)',
            marginBottom: '24px',
            fontSize: '14px',
            fontWeight: 500,
          }}>
            <button
              onClick={() => setActiveTab('discover')}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '0 0 12px',
                color: activeTab === 'discover' ? 'var(--text-primary)' : 'var(--text-muted)',
                borderBottom: activeTab === 'discover' ? '2px solid var(--primary)' : '2px solid transparent',
                fontWeight: activeTab === 'discover' ? 600 : 500,
                cursor: 'pointer',
              }}
            >
              Discover
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '0 0 12px',
                color: activeTab === 'saved' ? 'var(--text-primary)' : 'var(--text-muted)',
                borderBottom: activeTab === 'saved' ? '2px solid var(--primary)' : '2px solid transparent',
                fontWeight: activeTab === 'saved' ? 600 : 500,
                cursor: 'pointer',
              }}
            >
              Saved resources · {savedIds.length}
            </button>
            <button
              onClick={() => setActiveTab('my')}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '0 0 12px',
                color: activeTab === 'my' ? 'var(--text-primary)' : 'var(--text-muted)',
                borderBottom: activeTab === 'my' ? '2px solid var(--primary)' : '2px solid transparent',
                fontWeight: activeTab === 'my' ? 600 : 500,
                cursor: 'pointer',
              }}
            >
              My uploads · 1
            </button>
            <button
              onClick={() => setActiveTab('recent')}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '0 0 12px',
                color: activeTab === 'recent' ? 'var(--text-primary)' : 'var(--text-muted)',
                borderBottom: activeTab === 'recent' ? '2px solid var(--primary)' : '2px solid transparent',
                fontWeight: activeTab === 'recent' ? 600 : 500,
                cursor: 'pointer',
              }}
            >
              Recently viewed
            </button>
          </div>

          {/* Main Layout: Left Filters + Right Content */}
          <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '28px', alignItems: 'flex-start' }}>
            {/* Left Filter Column */}
            <aside style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Disciplines */}
              <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '18px',
              }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
                  Browse by discipline
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {disciplines.map((d) => {
                    const active = selectedDiscipline === d.name;
                    return (
                      <div
                        key={d.name}
                        onClick={() => setSelectedDiscipline(d.name)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '7px 10px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '13px',
                          color: active ? '#ffffff' : 'var(--text-muted)',
                          background: active ? 'var(--bg-raised)' : 'transparent',
                          cursor: 'pointer',
                          fontWeight: active ? 600 : 450,
                          border: active ? '1px solid var(--border)' : '1px solid transparent',
                        }}
                      >
                        <span>{d.name}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>{d.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Your Courses */}
              <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '18px',
              }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
                  Your courses
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {userCourses.map((c) => {
                    const active = selectedCourse === c.code;
                    return (
                      <div
                        key={c.code}
                        onClick={() => setSelectedCourse(c.code)}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '13px',
                          color: active ? 'var(--primary)' : 'var(--text-muted)',
                          background: active ? 'var(--primary-glow)' : 'transparent',
                          cursor: 'pointer',
                          border: active ? '1px solid rgba(149, 106, 255, 0.4)' : '1px solid transparent',
                        }}
                      >
                        <strong>{c.code}</strong> · {c.name}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Campus Ethics Note */}
              <div style={{
                padding: '14px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '12px',
                color: 'var(--text-subtle)',
                lineHeight: 1.4,
              }}>
                Share responsibly. Credit the author. Flag material that needs a second look.
              </div>
            </aside>

            {/* Right Resource Content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Search & Active Filter Chips Bar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
              }}>
                <div style={{ flex: '1', minWidth: '260px' }}>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search notes, papers or topics…"
                    style={{ width: '100%', height: '40px' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    fontSize: '12px',
                    color: 'var(--primary)',
                    background: 'var(--primary-glow)',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    fontWeight: 600,
                  }}>
                    {selectedCourse} ×
                  </span>
                  <span style={{
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    padding: '6px 10px',
                    borderRadius: '6px',
                  }}>
                    Semester V ×
                  </span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    style={{ height: '40px', fontSize: '13px' }}
                  >
                    <option value="Recently added">Sort: Recently added ⌄</option>
                    <option value="Most downloaded">Sort: Most downloaded</option>
                    <option value="Highest rated">Sort: Highest rated</option>
                  </select>
                </div>
              </div>

              <div style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0' }}>
                Showing {filtered.length} resources in {selectedCourse}
              </div>

              {/* Resource Cards List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filtered.map((item) => {
                  const isSaved = savedIds.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      style={{
                        padding: '18px 20px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '16px',
                        transition: 'border-color var(--transition), transform var(--transition)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-bright)';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '8px',
                          background: 'var(--bg-raised)',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--primary)',
                          fontSize: '13px',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}>
                          PDF
                        </div>

                        <div>
                          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {item.title}
                          </div>
                          <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            {item.course} · {item.author} · {item.pages} pages
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-subtle)', marginTop: '4px', display: 'flex', gap: '12px' }}>
                            <span>{item.size}</span>
                            <span>↓ {item.downloads} downloads</span>
                            <span style={{ color: 'var(--warning)' }}>★ {item.rating}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{
                          fontSize: '12px',
                          color: 'var(--text-muted)',
                          background: 'var(--bg-raised)',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-subtle)',
                        }}>
                          {item.type}
                        </span>

                        <button
                          onClick={() => toggleSave(item.id)}
                          style={{
                            background: isSaved ? 'var(--primary-glow)' : 'transparent',
                            color: isSaved ? 'var(--primary)' : 'var(--text-muted)',
                            border: '1px solid',
                            borderColor: isSaved ? 'var(--primary)' : 'var(--border)',
                            padding: '6px 12px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '12.5px',
                            fontWeight: 500,
                          }}
                        >
                          {isSaved ? 'Saved ✓' : 'Save'}
                        </button>

                        <button
                          onClick={() => alert(`Downloading ${item.title}`)}
                          style={{
                            background: 'var(--primary)',
                            color: '#ffffff',
                            padding: '6px 14px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '12.5px',
                            fontWeight: 600,
                          }}
                        >
                          Download
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 0',
                borderTop: '1px solid var(--border)',
                marginTop: '12px',
                fontSize: '13px',
                color: 'var(--text-muted)',
              }}>
                <div>Showing 1 – {filtered.length} of {filtered.length} resources</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button style={{
                    padding: '6px 12px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-subtle)',
                    borderRadius: 'var(--radius-sm)',
                  }}>
                    Previous
                  </button>
                  <button style={{
                    padding: '6px 12px',
                    background: 'var(--primary)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 600,
                  }}>
                    1
                  </button>
                  <button style={{
                    padding: '6px 12px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-muted)',
                    borderRadius: 'var(--radius-sm)',
                  }}>
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      <UploadResourceModal isOpen={uploadOpen} onClose={() => setUploadOpen(false)} currentUserId={currentUser.id} />
    </div>
  );
};
