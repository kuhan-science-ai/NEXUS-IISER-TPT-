import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageCircle, MoreHorizontal, Plus, Search, UserPlus, Users } from 'lucide-react';
import { api, UserSummary } from '../services/api';
import { SideNav } from '../components/SideNav';
import { TopHeader } from '../components/TopHeader';
import { GlobalSearchModal } from '../components/GlobalSearchModal';
import './FriendsPage.css';

interface FriendsPageProps { currentUser: UserSummary | null; onLogout?: () => void; }

export const FriendsPage: React.FC<FriendsPageProps> = ({ currentUser, onLogout }) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'online' | 'all' | 'pending'>('all');
  const [query, setQuery] = useState('');
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const [friendRows, requestRows] = await Promise.all([api.listFriends(), api.listFriendRequests()]);
      setFriends(friendRows);
      setRequests(requestRows);
    } catch { setFriends([]); setRequests([]); }
  };
  useEffect(() => { void load(); }, []);

  useEffect(() => {
    let active = true;
    if (activeTab !== 'pending' && query.trim()) {
      api.searchUsers(query.trim()).then(rows => { if (active) setSearchResults(rows); }).catch(() => { if (active) setSearchResults([]); });
    } else setSearchResults([]);
    return () => { active = false; };
  }, [activeTab, query]);

  const visibleFriends = useMemo(() => (query.trim() ? searchResults.filter(person => friends.some(friend => friend.id === person.id)) : friends).filter(person => {
    const name = person.full_name || person.username || '';
    return name.toLowerCase().includes(query.toLowerCase()) && (activeTab !== 'online' || person.is_online);
  }), [activeTab, friends, query, searchResults]);

  if (!currentUser) return null;
  const initials = (person: any) => (person.full_name || person.username || '?').split(' ').map((part: string) => part[0]).join('').slice(0, 2).toUpperCase();
  const accept = async (id: string) => { setBusy(true); try { await api.acceptFriendRequest(id); await load(); } finally { setBusy(false); } };
  const sendRequest = async (id: string) => { setBusy(true); try { await api.sendFriendRequest(id); setSearchResults(items => items.filter(item => item.id !== id)); } finally { setBusy(false); } };

  return <div className="friends-route">
    <SideNav currentUser={currentUser} onLogout={onLogout} onOpenSearch={() => setSearchOpen(true)} />
    <div className="friends-app-column">
      <TopHeader breadcrumb="Workspace / Friends" currentUser={currentUser} onOpenSearch={() => setSearchOpen(true)} />
      <main className="friends-discord-layout">
        <aside className="friends-dm-sidebar">
          <button className="friends-start-conversation" onClick={() => navigate('/messaging')}><Search size={15} /> Find or start a conversation</button>
          <Link to="/friends" className="friends-side-active"><Users size={17} /> Friends <span>{friends.length}</span></Link>
          <div className="friends-dm-heading">Direct Messages <button aria-label="Start a direct message" onClick={() => navigate('/messaging')}><Plus size={17} /></button></div>
          <p className="friends-empty">No contacts yet. Add a friend to start chatting.</p>
          <div className="friends-own-profile">
            <span className="friends-avatar">{initials(currentUser)}</span>
            <span><strong>{currentUser.display_name || currentUser.full_name || currentUser.username}</strong><small>Verified student</small></span>
            <button aria-label="Open profile settings" onClick={() => navigate('/settings')}><MoreHorizontal size={18} /></button>
          </div>
        </aside>
        <section className="friends-main-panel">
          <header className="friends-page-toolbar">
            <div className="friends-title"><Users size={18} /><strong>Friends</strong></div>
            <div className="friends-tabs" role="tablist" aria-label="Friend filters">
              <button className={activeTab === 'online' ? 'active' : ''} onClick={() => setActiveTab('online')}>Online</button>
              <button className={activeTab === 'all' ? 'active' : ''} onClick={() => setActiveTab('all')}>All</button>
              <button className={activeTab === 'pending' ? 'active' : ''} onClick={() => setActiveTab('pending')}>Pending <span>{requests.length}</span></button>
            </div>
            <button className="friends-add-button" onClick={() => setSearchOpen(true)}><UserPlus size={15} /> Add Friend</button>
          </header>
          {activeTab === 'pending' ? <div className="friends-content-list">
            <div className="friends-list-heading">Friend requests — {requests.length}</div>
            {requests.map(request => <div className="friends-person-row" key={request.id}>
              <span className="friends-avatar">{(request.sender_name || request.sender_username || '?').split(' ').map((part: string) => part[0]).join('').slice(0, 2).toUpperCase()}</span><div className="friends-person-info"><strong>{request.sender_name || request.sender_username || 'Student'}</strong><small>Wants to connect with you</small></div>
              <button className="friends-accept" disabled={busy} onClick={() => void accept(request.id)}>Accept</button>
            </div>)}
            {!requests.length && <p className="friends-empty">No pending friend requests.</p>}
          </div> : <>
            <label className="friends-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search friends or students" /></label>
            <div className="friends-content-list">
              <div className="friends-list-heading">{activeTab === 'online' ? `Online — ${visibleFriends.length}` : `Friends — ${visibleFriends.length}`}</div>
              {visibleFriends.map(friend => <div className="friends-person-row" key={friend.id}>
                <span className="friends-avatar">{initials(friend)}</span><div className="friends-person-info"><strong>{friend.full_name || friend.username}</strong><small>{friend.department || friend.program || 'NEXUS student'}</small></div>
                <button className="friends-icon-button" aria-label={`Message ${friend.full_name || friend.username}`} onClick={() => navigate('/messaging')}><MessageCircle size={17} /></button>
              </div>)}
              {visibleFriends.length === 0 && <p className="friends-empty">{query ? 'No friends match your search. Student matches appear below.' : 'No friends added yet. Search for a student above and send a friend request.'}</p>}
              {query.trim() && searchResults.filter(person => !friends.some(friend => friend.id === person.id) && person.id !== currentUser.id).map(person => <div className="friends-person-row" key={person.id}>
                <span className="friends-avatar">{initials(person)}</span><div className="friends-person-info"><strong>{person.full_name || person.username}</strong><small>{person.department || person.program || 'NEXUS student'}</small></div>
                <button className="friends-accept" disabled={busy} onClick={() => void sendRequest(person.id)}>Add friend</button>
              </div>)}
            </div>
          </>}
        </section>
        <aside className="friends-active-panel"><h2>Active Now</h2><div className="friends-quiet-card"><strong>No friends online yet</strong><p>When you add friends, their activity will appear here.</p></div></aside>
      </main>
    </div>
    <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
  </div>;
};
