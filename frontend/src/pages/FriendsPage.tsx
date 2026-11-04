import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageCircle, MoreHorizontal, Plus, Search, UserPlus, Users } from 'lucide-react';
import { UserSummary } from '../services/api';
import { SideNav } from '../components/SideNav';
import { TopHeader } from '../components/TopHeader';
import { GlobalSearchModal } from '../components/GlobalSearchModal';
import './FriendsPage.css';

interface FriendsPageProps {
  currentUser: UserSummary | null;
  onLogout?: () => void;
}

const friends = [
  { name: 'Meera Iyer', initials: 'MI', status: 'Online', details: 'Physics · BS–MS 2023', online: true, activity: 'Studying in the library' },
  { name: 'Arjun Nair', initials: 'AN', status: 'Online', details: 'Mathematics · BS–MS 2023', online: true, activity: 'Exploring the repository' },
  { name: 'Dev Patel', initials: 'DP', status: 'Idle', details: 'Chemistry · BS–MS 2023', online: false, activity: '' },
  { name: 'Sana Khan', initials: 'SK', status: 'Online', details: 'Biology · BS–MS 2024', online: true, activity: 'In Quantum Collective' },
  { name: 'Rohan Nair', initials: 'RN', status: 'Offline', details: 'Physics · BS–MS 2022', online: false, activity: '' },
  { name: 'Priya Shah', initials: 'PS', status: 'Offline', details: 'Chemistry · BS–MS 2024', online: false, activity: '' },
];

const requests = [
  { name: 'Kavya Reddy', batch: 'BS–MS 2024 · 6 mutual friends', initials: 'KR' },
  { name: 'Aditya Sen', batch: 'BS–MS 2023 · 4 mutual friends', initials: 'AS' },
];

const directMessages = [
  { name: 'Meera Iyer', initials: 'MI', preview: 'Library after lunch?', online: true },
  { name: 'Quantum Collective', initials: 'QC', preview: 'Arjun: Uploaded the solutions', online: true },
  { name: 'Arjun Nair', initials: 'AN', preview: 'Astronomy night this Friday?', online: true },
  { name: 'Sana Khan', initials: 'SK', preview: 'Thanks for sharing the notes!', online: false },
  { name: 'Skywatchers Club', initials: 'SC', preview: 'Rooftop access confirmed 🔭', online: true },
  { name: 'Dev Patel', initials: 'DP', preview: 'See you at the lab', online: false },
];

export const FriendsPage: React.FC<FriendsPageProps> = ({ currentUser, onLogout }) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'online' | 'all' | 'pending'>('online');
  const [query, setQuery] = useState('');
  const [accepted, setAccepted] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const navigate = useNavigate();

  const visibleFriends = useMemo(() => friends.filter((friend) =>
    (activeTab !== 'online' || friend.online) && friend.name.toLowerCase().includes(query.toLowerCase()),
  ), [activeTab, query]);

  if (!currentUser) return null;

  return (
    <div className="friends-route">
      <SideNav currentUser={currentUser} onLogout={onLogout} onOpenSearch={() => setSearchOpen(true)} />
      <div className="friends-app-column">
        <TopHeader breadcrumb="Workspace / Friends" currentUser={currentUser} onOpenSearch={() => setSearchOpen(true)} />
        <main className="friends-discord-layout">
          <aside className="friends-dm-sidebar">
            <button className="friends-start-conversation" onClick={() => navigate('/messaging')}><Search size={15} /> Find or start a conversation</button>
            <Link to="/friends" className="friends-side-active"><Users size={17} /> Friends <span>6</span></Link>
            <div className="friends-dm-heading">Direct Messages <button aria-label="Start a direct message" onClick={() => navigate('/messaging')}><Plus size={17} /></button></div>
            <div className="friends-dm-list">
              {directMessages.map((person) => (
                <button key={person.name} className="friends-dm-item" onClick={() => navigate('/messaging')}>
                  <span className={`friends-avatar ${person.online ? 'is-online' : ''}`}>{person.initials}</span>
                  <span className="friends-dm-copy"><strong>{person.name}</strong><small>{person.preview}</small></span>
                </button>
              ))}
            </div>
            <div className="friends-own-profile">
              <span className="friends-avatar">{(currentUser.display_name || currentUser.full_name || currentUser.username || 'AR').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span>
              <span><strong>{currentUser.display_name || currentUser.full_name || currentUser.username || 'Student'}</strong><small>Verified student</small></span>
              <button aria-label="Open profile settings" onClick={() => navigate('/settings')}><MoreHorizontal size={18} /></button>
            </div>
          </aside>

          <section className="friends-main-panel">
            <header className="friends-page-toolbar">
              <div className="friends-title"><Users size={18} /><strong>Friends</strong></div>
              <div className="friends-tabs" role="tablist" aria-label="Friend filters">
                <button className={activeTab === 'online' ? 'active' : ''} onClick={() => setActiveTab('online')}>Online</button>
                <button className={activeTab === 'all' ? 'active' : ''} onClick={() => setActiveTab('all')}>All</button>
                <button className={activeTab === 'pending' ? 'active' : ''} onClick={() => setActiveTab('pending')}>Pending <span>{Math.max(0, requests.length - accepted.length - dismissed.length)}</span></button>
              </div>
              <button className="friends-add-button" onClick={() => setSearchOpen(true)}><UserPlus size={15} /> Add Friend</button>
            </header>

            {activeTab === 'pending' ? (
              <div className="friends-content-list">
                <div className="friends-list-heading">Friend requests — {Math.max(0, requests.length - accepted.length - dismissed.length)}</div>
                {requests.filter((request) => !accepted.includes(request.name) && !dismissed.includes(request.name)).map((request) => (
                  <div className="friends-person-row" key={request.name}>
                    <span className="friends-avatar">{request.initials}</span>
                    <div className="friends-person-info"><strong>{request.name}</strong><small>{request.batch}</small></div>
                    <button className="friends-accept" onClick={() => setAccepted((items) => [...items, request.name])}>Accept</button>
                    <button className="friends-ignore" onClick={() => setDismissed((items) => [...items, request.name])}>Ignore</button>
                  </div>
                ))}
                {!requests.some((request) => !accepted.includes(request.name) && !dismissed.includes(request.name)) && <p className="friends-empty">You’re all caught up on friend requests.</p>}
              </div>
            ) : (
              <>
                <label className="friends-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" /></label>
                <div className="friends-content-list">
                  <div className="friends-list-heading">{activeTab === 'online' ? `Online — ${visibleFriends.length}` : `All friends — ${visibleFriends.length}`}</div>
                  {visibleFriends.map((friend) => (
                    <div className="friends-person-row" key={friend.name}>
                      <span className={`friends-avatar ${friend.online ? 'is-online' : ''}`}>{friend.initials}</span>
                      <div className="friends-person-info"><strong>{friend.name}</strong><small>{friend.status}{friend.online ? ` · ${friend.details}` : ''}</small></div>
                      <button className="friends-icon-button" aria-label={`Message ${friend.name}`} onClick={() => navigate('/messaging')}><MessageCircle size={17} /></button>
                      <button className="friends-icon-button" aria-label={`More options for ${friend.name}`}><MoreHorizontal size={18} /></button>
                    </div>
                  ))}
                  {visibleFriends.length === 0 && <p className="friends-empty">No friends match your search.</p>}
                </div>
              </>
            )}
          </section>

          <aside className="friends-active-panel">
            <h2>Active Now</h2>
            {friends.some((friend) => friend.online) ? friends.filter((friend) => friend.online).map((friend) => (
              <button className="friends-activity-card" key={friend.name} onClick={() => navigate('/messaging')}>
                <span className="friends-avatar is-online">{friend.initials}</span><span><strong>{friend.name}</strong><small>{friend.activity}</small></span>
              </button>
            )) : <div className="friends-quiet-card"><strong>It’s quiet for now...</strong><p>When a friend starts an activity, it’ll show here.</p></div>}
          </aside>
        </main>
      </div>
      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
};
