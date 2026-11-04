import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, ChevronDown, Compass, Gamepad2, Music2, Plus, Search, Users, UsersRound } from 'lucide-react';
import { UserSummary } from '../services/api';
import { SideNav } from '../components/SideNav';
import { TopHeader } from '../components/TopHeader';
import { GlobalSearchModal } from '../components/GlobalSearchModal';
import './StudyGroupsPage.css';

interface StudyGroupsPageProps { currentUser: UserSummary | null; onLogout?: () => void; }
type GroupKind = 'study' | 'hangout' | 'community';
type StudyGroup = { name: string; description: string; members: number; online: number; category: GroupKind; tag: string; initials: string; icon: string; banner: string; badge?: string };

const groups: StudyGroup[] = [
  { name: 'Quantum Collective', description: 'A friendly corner for quantum physics, problem sets, and late-night derivations.', members: 128, online: 24, category: 'study', tag: 'Physics · PHY 301', initials: 'QC', icon: '✦', banner: 'quantum', badge: 'Popular' },
  { name: 'The Algebra Circle', description: 'Work through proofs together, compare notes, and make abstract algebra click.', members: 84, online: 13, category: 'study', tag: 'Mathematics · MAT 201', initials: 'AC', icon: '∑', banner: 'algebra' },
  { name: 'Spectra Squad', description: 'Chemistry students sharing lab tips, spectra puzzles, and exam prep.', members: 67, online: 9, category: 'study', tag: 'Chemistry · CHM 301', initials: 'SS', icon: '⚗', banner: 'spectra' },
  { name: 'Ecology Field Notes', description: 'Swap observations, plan field walks, and talk about life beyond the lab.', members: 93, online: 17, category: 'study', tag: 'Biology · BIO 303', initials: 'EF', icon: '❋', banner: 'ecology' },
  { name: 'Common Room', description: 'A relaxed place to meet people, share playlists, and take a break between classes.', members: 216, online: 38, category: 'hangout', tag: 'Chill · All campuses', initials: 'CR', icon: '☕', banner: 'common' },
  { name: 'Campus After Hours', description: 'Find people for coffee, board games, walks, and spontaneous plans.', members: 154, online: 21, category: 'hangout', tag: 'Hangout · Tirupati', initials: 'AH', icon: '☾', banner: 'afterhours' },
  { name: 'NEXUS Creators', description: 'A community for makers, artists, builders, and curious people across campus.', members: 302, online: 46, category: 'community', tag: 'Community · Creative', initials: 'NC', icon: '✳', banner: 'creators', badge: 'Featured' },
  { name: 'Open Source Lab', description: 'Build useful things together, learn git, and find collaborators for your next idea.', members: 187, online: 29, category: 'community', tag: 'Community · Technology', initials: 'OS', icon: '</>', banner: 'opensource' },
  { name: 'The Reading Nook', description: 'Trade book recommendations and find company for a quiet reading hour.', members: 73, online: 11, category: 'hangout', tag: 'Chill · Reading', initials: 'RN', icon: '▤', banner: 'readers' },
  { name: 'Data Science Forum', description: 'Discuss datasets, experiment ideas, and practical ways to learn machine learning.', members: 141, online: 26, category: 'community', tag: 'Community · Data', initials: 'DS', icon: '⌘', banner: 'data' },
  { name: 'Organic Chemistry Desk', description: 'Draw mechanisms together and help each other through reaction practice.', members: 59, online: 8, category: 'study', tag: 'Chemistry · CHM 202', initials: 'OD', icon: '⌬', banner: 'organic' },
  { name: 'Weekend Wanderers', description: 'Plan low-key campus walks, photo stops, and little weekend adventures.', members: 112, online: 18, category: 'hangout', tag: 'Hangout · Outdoors', initials: 'WW', icon: '↗', banner: 'wanderers' },
];

const formatCount = (value: number) => new Intl.NumberFormat('en', { notation: value >= 1000 ? 'compact' : 'standard' }).format(value);

export const StudyGroupsPage: React.FC<StudyGroupsPageProps> = ({ currentUser, onLogout }) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [studentType, setStudentType] = useState<'all' | 'study' | 'hangout'>('all');
  const [communityType, setCommunityType] = useState<'all' | 'community'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  if (!currentUser) return null;

  const visibleGroups = useMemo(() => groups.filter(group => {
    const selectedCategoryMatches = communityType === 'community'
      ? group.category === 'community'
      : studentType === 'all' || group.category === studentType;
    const textMatches = `${group.name} ${group.description} ${group.tag}`.toLowerCase().includes(query.trim().toLowerCase());
    return selectedCategoryMatches && textMatches;
  }), [studentType, communityType, query]);
  const pageCount = Math.max(1, Math.ceil(visibleGroups.length / 8));
  const pageGroups = visibleGroups.slice((currentPage - 1) * 8, currentPage * 8);

  const changeFilters = (update: () => void) => {
    update();
    setCurrentPage(1);
  };

  return <div className="study-groups-layout">
    <SideNav currentUser={currentUser} onLogout={onLogout} onOpenSearch={() => setSearchOpen(true)} />
    <div className="study-groups-shell">
      <TopHeader breadcrumb="Workspace / Study Groups" currentUser={currentUser} onOpenSearch={() => setSearchOpen(true)} />
      <main className="study-groups-main">
        <div className="study-groups-discover-rail">
          <div className="study-groups-rail-title"><Compass size={17} /><strong>Discover</strong></div>
          <button type="button" className="study-groups-rail-item active"><UsersRound size={16} /><span>Groups</span></button>
          <button type="button" className="study-groups-rail-item" onClick={() => setCreateOpen(true)}><Plus size={16} /><span>Create a group</span></button>
          <div className="study-groups-apps-title">APPS (BETA)</div>
          <button type="button" className="study-groups-rail-item"><BookOpen size={16} /><span>Study rooms</span><small>Beta</small></button>
          <button type="button" className="study-groups-rail-item"><Music2 size={16} /><span>Campus radio</span><small>Beta</small></button>
          <button type="button" className="study-groups-rail-item"><Gamepad2 size={16} /><span>Study breaks</span><small>Beta</small></button>
          <div className="study-groups-rail-note">Apps are small campus tools, in beta and coming soon.</div>
        </div>

        <section className="study-groups-content">
          <header className="study-groups-topbar">
            <div className="study-groups-top-tabs"><span className="selected"><Compass size={14} /> Discover</span><span>Groups</span><span>For students</span></div>
            <label className="study-groups-search"><Search size={15} /><input aria-label="Search groups" value={query} onChange={event => { setQuery(event.target.value); setCurrentPage(1); }} placeholder="Search groups" /></label>
          </header>

          <section className="study-groups-hero">
            <div className="study-groups-hero-copy"><span className="study-groups-eyebrow">FIND YOUR PEOPLE AT NEXUS</span><h1>Good groups make<br />great campus days.</h1><p>Study together, hang out, and find your campus community.</p></div>
            <div className="study-groups-hero-art" aria-hidden="true"><span className="hero-orbit orbit-one" /><span className="hero-orbit orbit-two" /><span className="hero-star">✦</span><span className="hero-person person-one">N</span><span className="hero-person person-two">K</span><span className="hero-person person-three">A</span></div>
          </section>

          <section className="study-groups-listing" aria-label="Discover groups">
            <div className="study-groups-listing-heading"><div className="study-groups-heading-copy"><span className="study-groups-eyebrow">YOUR NEXT COMMUNITY</span><h2>Find your group</h2><p>Meet students who share your interests, courses, and campus life.</p></div><button type="button" className="study-groups-create" onClick={() => setCreateOpen(true)}><Plus size={15} /> Create group</button></div>
            <div className="study-groups-filters">
              <label className="study-groups-select-wrap"><span>Students</span><select aria-label="Filter student groups" value={studentType} onChange={event => changeFilters(() => setStudentType(event.target.value as typeof studentType))}><option value="all">All students</option><option value="study">Study</option><option value="hangout">Chill &amp; hangout</option></select><ChevronDown size={13} /></label>
              <label className="study-groups-select-wrap"><span>Community</span><select aria-label="Filter community groups" value={communityType} onChange={event => changeFilters(() => setCommunityType(event.target.value as typeof communityType))}><option value="all">All communities</option><option value="community">Community groups</option></select><ChevronDown size={13} /></label>
              <span className="study-groups-demo-note">Sample groups · demo counts</span>
            </div>
            <div className="study-groups-card-grid">
              {pageGroups.map(group => <article className="study-group-card" key={group.name}>
                <div className={`study-group-banner banner-${group.banner}`} />
                <div className="study-group-card-body"><div className="study-group-card-identity"><div className={`study-group-avatar avatar-${group.banner}`}>{group.icon}</div><span className="study-group-tag">{group.tag}</span></div>{group.badge && <span className="study-group-badge">{group.badge}</span>}<div className="study-group-card-title"><h3>{group.name}</h3><p>{group.description}</p></div>
                  <div className="study-group-card-meta"><span><i className="online-dot" /> {formatCount(group.online)} online</span><span><i className="member-dot" /> {formatCount(group.members)} members</span></div>
                  <button className="study-group-open" type="button" onClick={() => alert(`${group.name}\n\n${group.description}\n\n${group.members} members · ${group.online} online`)}>View group <ArrowRight size={14} /></button>
                </div>
              </article>)}
              {pageGroups.length === 0 && <div className="study-groups-empty"><Users size={19} /><strong>No groups found</strong><span>Try another category or search term.</span></div>}
            </div>
            <nav className="study-groups-pagination" aria-label="Group directory pages"><button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage(page => Math.max(1, page - 1))}><ArrowLeft size={13} /> Previous</button><span>Page {currentPage} of {pageCount} <i /> {visibleGroups.length} groups</span><button type="button" disabled={currentPage >= pageCount} onClick={() => setCurrentPage(page => Math.min(pageCount, page + 1))}>Next <ArrowRight size={13} /></button></nav>
          </section>
        </section>
      </main>
    </div>
    {createOpen && <div className="study-group-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setCreateOpen(false); }}><section className="study-group-modal" role="dialog" aria-modal="true" aria-labelledby="study-group-modal-title"><button type="button" className="study-group-modal-close" onClick={() => setCreateOpen(false)} aria-label="Close">×</button><span className="study-groups-eyebrow">COMING SOON</span><h2 id="study-group-modal-title">Create your group</h2><p>Group creation is in beta planning. Real groups will have a profile icon, cover banner, description, member total, and live online count.</p><button type="button" onClick={() => setCreateOpen(false)}>Got it</button></section></div>}
    <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
  </div>;
};
