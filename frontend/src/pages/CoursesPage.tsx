import React, { useState } from 'react';
import { UserSummary } from '../services/api';
import { SideNav } from '../components/SideNav';
import { TopHeader } from '../components/TopHeader';
import { GlobalSearchModal } from '../components/GlobalSearchModal';
import { Clock3, Pin } from 'lucide-react';

interface CoursesPageProps {
  currentUser: UserSummary | null;
  onLogout?: () => void;
}

export const CoursesPage: React.FC<CoursesPageProps> = ({ currentUser, onLogout }) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'current' | 'archive' | 'timetable'>('current');

  const courses = [
    {
      code: 'PHY 301',
      name: 'Quantum Mechanics I',
      instructor: 'Dr. S. Krishnan',
      credits: '4 credits',
      schedule: 'Mon, Wed, Fri · 10:00 · LH 204',
      status: 'Problem set 04 due tomorrow',
      resources: '42 resources ↗',
      tagColor: 'var(--primary)',
    },
    {
      code: 'CHM 301',
      name: 'Organic Spectroscopy',
      instructor: 'Dr. P. Reddy',
      credits: '4 credits',
      schedule: 'Mon, Thu · 11:15 · LH 102',
      status: 'Lab report due 5 Nov',
      resources: '28 resources ↗',
      tagColor: 'var(--text-muted)',
    },
    {
      code: 'MAT 201',
      name: 'Linear Algebra',
      instructor: 'Dr. A. Menon',
      credits: '4 credits',
      schedule: 'Tue, Thu · 09:00 · LH 201',
      status: 'Tutorial 07 on Friday',
      resources: '35 resources ↗',
      tagColor: 'var(--text-muted)',
    },
    {
      code: 'BIO 303',
      name: 'Ecology & Evolution',
      instructor: 'Dr. R. Das',
      credits: '4 credits',
      schedule: 'Mon, Wed · 14:00 · Lab B',
      status: 'Field notebook review 9 Nov',
      resources: '21 resources ↗',
      tagColor: 'var(--text-muted)',
    },
    {
      code: 'PHY 305',
      name: 'Experimental Physics',
      instructor: 'Dr. V. Kumar',
      credits: '4 credits',
      schedule: 'Tue · 14:00 – 17:00 · Lab A',
      status: 'Lab session tomorrow',
      resources: '18 resources ↗',
      tagColor: 'var(--text-muted)',
    },
    {
      code: 'HSS 301',
      name: 'Science & Society',
      instructor: 'Dr. N. Sharma',
      credits: '4 credits',
      schedule: 'Fri · 15:00 · LH 105',
      status: 'Reading circle 6 Nov',
      resources: '12 resources ↗',
      tagColor: 'var(--text-muted)',
    },
  ];

  if (!currentUser) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-canvas)' }}>
      <SideNav currentUser={currentUser} onLogout={onLogout} onOpenSearch={() => setSearchOpen(true)} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopHeader
          breadcrumb="Workspace / My Courses"
          currentUser={currentUser}
          onOpenSearch={() => setSearchOpen(true)}
          actionButton={{
            label: 'Manage courses',
            onClick: () => alert('Course enrollment settings'),
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
              My Courses
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Semester V · August – December 2026
            </p>
          </div>

          {/* Quick Metrics Bar (Page 7) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px',
            marginBottom: '28px',
          }}>
            <div style={{ padding: '20px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Enrolled courses</div>
              <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>06</div>
              <div style={{ fontSize: '12px', color: 'var(--text-subtle)', marginTop: '2px' }}>22 credits this semester</div>
            </div>
            <div style={{ padding: '20px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>This week</div>
              <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--secondary)', marginTop: '4px' }}>18 classes</div>
              <div style={{ fontSize: '12px', color: 'var(--text-subtle)', marginTop: '2px' }}>4 labs · 14 lectures</div>
            </div>
            <div style={{ padding: '20px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Assignments</div>
              <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--warning)', marginTop: '4px' }}>03 pending</div>
              <div style={{ fontSize: '12px', color: 'var(--text-subtle)', marginTop: '2px' }}>Next deadline tomorrow</div>
            </div>
          </div>

          {/* Sub Navigation */}
          <div style={{
            display: 'flex',
            gap: '24px',
            borderBottom: '1px solid var(--border)',
            marginBottom: '24px',
            fontSize: '14px',
          }}>
            <button
              onClick={() => setActiveTab('current')}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '0 0 12px',
                color: activeTab === 'current' ? 'var(--text-primary)' : 'var(--text-muted)',
                borderBottom: activeTab === 'current' ? '2px solid var(--primary)' : '2px solid transparent',
                fontWeight: activeTab === 'current' ? 600 : 500,
                cursor: 'pointer',
              }}
            >
              Current semester
            </button>
            <button
              onClick={() => setActiveTab('archive')}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '0 0 12px',
                color: activeTab === 'archive' ? 'var(--text-primary)' : 'var(--text-muted)',
                borderBottom: activeTab === 'archive' ? '2px solid var(--primary)' : '2px solid transparent',
                fontWeight: activeTab === 'archive' ? 600 : 500,
                cursor: 'pointer',
              }}
            >
              Course archive
            </button>
            <button
              onClick={() => setActiveTab('timetable')}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '0 0 12px',
                color: activeTab === 'timetable' ? 'var(--text-primary)' : 'var(--text-muted)',
                borderBottom: activeTab === 'timetable' ? '2px solid var(--primary)' : '2px solid transparent',
                fontWeight: activeTab === 'timetable' ? 600 : 500,
                cursor: 'pointer',
              }}
            >
              Weekly timetable
            </button>
          </div>

          {/* Courses Cards Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '20px',
          }}>
            {courses.map((course) => (
              <div
                key={course.code}
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '22px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'border-color var(--transition)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-bright)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: 'var(--primary)',
                      background: 'var(--primary-glow)',
                      padding: '3px 8px',
                      borderRadius: '4px',
                    }}>
                      {course.code}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>{course.credits}</span>
                  </div>

                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {course.name}
                  </h3>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                    {course.instructor}
                  </div>

                  <div style={{
                    padding: '10px 12px',
                    background: 'var(--bg-raised)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    marginBottom: '12px',
                  }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Clock3 size={14} /> {course.schedule}</span>
                  </div>

                  <div style={{ fontSize: '12.5px', color: 'var(--warning)', fontWeight: 500, marginBottom: '14px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Pin size={14} /> {course.status}</span>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderTop: '1px solid var(--border)',
                  paddingTop: '14px',
                }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>
                    {course.resources}
                  </span>
                  <button style={{
                    background: 'var(--primary)',
                    color: '#ffffff',
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '12.5px',
                    fontWeight: 600,
                  }}>
                    Open course →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>

      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
};
