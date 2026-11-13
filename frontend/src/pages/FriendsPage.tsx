import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, MessageCircle, MoreHorizontal, Plus, Search, UserPlus, Users } from 'lucide-react';
import { api, UserSummary } from '../services/api';
import { SideNav } from '../components/SideNav';
import { TopHeader } from '../components/TopHeader';
import { GlobalSearchModal } from '../components/GlobalSearchModal';
import { ProfileAvatar } from '../components/ProfileAvatar';
import './FriendsPage.css';

interface FriendsPageProps { currentUser: UserSummary | null; onLogout?: () => void; }
const readFriendsCache = (userId: string, slot: string) => { try { return JSON.parse(sessionStorage.getItem(`nexus-friends:${userId}:${slot}`) || '[]'); } catch { return []; } };

export const FriendsPage: React.FC<FriendsPageProps> = ({ currentUser, onLogout }) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [friendsSidebarCollapsed, setFriendsSidebarCollapsed] = useState(true);
  const [activeTab, setActiveTab] = useState<'online' | 'all' | 'pending'>('all');
  const [query, setQuery] = useState('');
  const [friends, setFriends] = useState<any[]>(() => readFriendsCache(currentUser?.id || 'guest', 'friends'));
  const [requests, setRequests] = useState<any[]>(() => readFriendsCache(currentUser?.id || 'guest', 'requests'));
  const [sentRequests, setSentRequests] = useState<any[]>(() => readFriendsCache(currentUser?.id || 'guest', 'sent'));
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<any | null>(null);
  const [profileTab, setProfileTab] = useState<'activity' | 'friends' | 'groups'>('activity');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const [friendRows, requestRows, sentRows] = await Promise.all([api.listFriends(), api.listFriendRequests(), api.listSentFriendRequests()]);
      setFriends(friendRows);
      setRequests(requestRows);
      setSentRequests(sentRows);
      sessionStorage.setItem(`nexus-friends:${currentUser?.id}:friends`, JSON.stringify(friendRows));
      sessionStorage.setItem(`nexus-friends:${currentUser?.id}:requests`, JSON.stringify(requestRows));
      sessionStorage.setItem(`nexus-friends:${currentUser?.id}:sent`, JSON.stringify(sentRows));
    } catch { setFriends([]); setRequests([]); setSentRequests([]); }
  };
  useEffect(() => { void load(); const onRealtime = (event: Event) => { if ((event as CustomEvent).detail?.event === 'friends.changed') { void load(); if (query.trim()) void api.searchUsers(query.trim()).then(setSearchResults).catch(() => undefined); if (selectedProfile) void api.getPublicProfile(selectedProfile.username).then(setSelectedProfile).catch(() => undefined); } }; window.addEventListener('nexus-realtime-event', onRealtime); return () => window.removeEventListener('nexus-realtime-event', onRealtime); }, [currentUser?.id, currentUser?.avatar_url, currentUser?.avatar_file_id, query, selectedProfile?.username]);

  useEffect(() => {
    let active = true;
    if (query.trim()) {
      const refreshSearch = () => void api.searchUsers(query.trim()).then(rows => { if (active) setSearchResults(rows); }).catch(() => { if (active) setSearchResults([]); });
      const timer = window.setTimeout(refreshSearch, 180);
      return () => { active = false; window.clearTimeout(timer); };
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
  const sendRequest = async (id: string) => { setBusy(true); try { await api.sendFriendRequest(id); await load(); if (selectedProfile) setSelectedProfile({ ...selectedProfile, relationship_status: 'outgoing_pending' }); setSearchResults(items => items.map(item => item.id === id ? { ...item, relationship_status: 'outgoing_pending' } : item)); } finally { setBusy(false); } };
  const openProfile = async (person: any) => { try { setSelectedProfile(await api.getPublicProfile(person.username)); setProfileTab('activity'); } catch { setSelectedProfile(person); } };
  const openDm = async (person: any) => { setBusy(true); try { const conversation = await api.openDirectMessage(person.id); navigate(`/messaging?conversationId=${encodeURIComponent(conversation.id)}`); } catch { /* unavailable until request accepted */ } finally { setBusy(false); } };
  const handlePendingAction = async (request: any, action: 'accept' | 'reject' | 'cancel') => { setBusy(true); try { if (action === 'accept') { const result = await api.acceptFriendRequest(request.id); await load(); if (result.conversation_id) navigate(`/messaging?conversationId=${encodeURIComponent(result.conversation_id)}`); } else if (action === 'reject') { await api.rejectFriendRequest(request.id); await load(); } else { await api.cancelFriendRequest(request.id); await load(); } } finally { setBusy(false); } };

  return <div className="friends-route">
    <SideNav currentUser={currentUser} onLogout={onLogout} onOpenSearch={() => setSearchOpen(true)} />
    <div className="friends-app-column">
      <TopHeader breadcrumb="Workspace / Friends" currentUser={currentUser} onOpenSearch={() => setSearchOpen(true)} />
      <main className={`friends-discord-layout${friendsSidebarCollapsed ? ' is-dm-sidebar-collapsed' : ''}`}>
        <aside className="friends-dm-sidebar">
          <div className="dm-sidebar-toggle-row"><button type="button" className="dm-sidebar-toggle" onClick={() => setFriendsSidebarCollapsed(value => !value)} aria-label={friendsSidebarCollapsed ? 'Expand Friends sidebar' : 'Collapse Friends sidebar'} aria-expanded={!friendsSidebarCollapsed} title={friendsSidebarCollapsed ? 'Expand Friends sidebar' : 'Collapse Friends sidebar'}>{friendsSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</button></div>
          <Link to="/friends" className="friends-side-active"><Users size={17} /> Friends <span>{friends.length}</span></Link>
          <div className="friends-dm-heading">Direct Messages <button aria-label="Start a direct message" onClick={() => navigate('/messaging')}><Plus size={17} /></button></div>
          <p className="friends-empty">No contacts yet. Add a friend to start chatting.</p>
          <div className="friends-own-profile">
            <ProfileAvatar className="friends-avatar" user={currentUser} />
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
              <button className="friends-profile-open" onClick={() => void openProfile({ id: request.sender_id, username: request.sender_username })}><ProfileAvatar className="friends-avatar" user={{ username: request.sender_username, full_name: request.sender_name, avatar_url: request.sender_avatar_url, avatar_mime_type: request.sender_avatar_mime_type }} /><span className="friends-person-info"><strong>{request.sender_name || request.sender_username || 'Student'}</strong><small>@{request.sender_username} · Wants to connect</small></span></button>
              <div className="friends-request-actions"><button title="Accept friend request" aria-label={`Accept ${request.sender_name || request.sender_username}`} disabled={busy} onClick={() => void handlePendingAction(request, 'accept')}>✓</button><button title="Decline friend request" aria-label={`Decline ${request.sender_name || request.sender_username}`} disabled={busy} onClick={() => void handlePendingAction(request, 'reject')}>×</button></div>
            </div>)}
            {sentRequests.map(request => <div className="friends-person-row" key={request.id}><button className="friends-profile-open" onClick={() => void openProfile(request)}><ProfileAvatar className="friends-avatar" user={request} /><span className="friends-person-info"><strong>{request.full_name || request.username}</strong><small>@{request.username} · Request sent</small></span></button><button className="friends-accept is-pending" disabled={busy} onClick={() => void handlePendingAction(request, 'cancel')}>Pending · Cancel</button></div>)}
            {!requests.length && !sentRequests.length && <p className="friends-empty">No pending friend requests.</p>}
          </div> : <>
            <div className="friends-search-wrap"><label className="friends-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search friends or students" /></label>{query.trim() && searchResults.length > 0 && <div className="friends-search-suggestions">{searchResults.map(person => <button key={person.id} onClick={() => { setQuery(''); void openProfile(person); }}><ProfileAvatar className="friends-avatar" user={person} /><span><strong>{person.full_name || person.username}</strong><small>@{person.username}</small></span><span className="friends-suggestion-status">{person.relationship_status === 'friends' ? 'Friend' : person.relationship_status === 'outgoing_pending' ? 'Pending' : person.relationship_status === 'incoming_pending' ? 'Respond' : 'View profile'}</span></button>)}</div>}</div>
            <div className="friends-content-list">
              <div className="friends-list-heading">{activeTab === 'online' ? `Online — ${visibleFriends.length}` : `Friends — ${visibleFriends.length}`}</div>
              {visibleFriends.map(friend => <div className="friends-person-row" key={friend.id}>
                <button className="friends-profile-open" onClick={() => void openProfile(friend)}><ProfileAvatar className="friends-avatar" user={friend} /><span className="friends-person-info"><strong>{friend.full_name || friend.username}</strong><small>{friend.department || friend.program || 'NEXUS student'}</small></span></button>
                <button className="friends-icon-button" aria-label={`Message ${friend.full_name || friend.username}`} onClick={() => void openDm(friend)}><MessageCircle size={17} /></button>
              </div>)}
              {visibleFriends.length === 0 && <p className="friends-empty">{query ? 'No friends match your search. Student matches appear below.' : 'No friends added yet. Search for a student above and send a friend request.'}</p>}
            </div>
          </>}
        </section>
        <aside className="friends-active-panel"><h2>Active Now</h2><div className="friends-quiet-card"><strong>No friends online yet</strong><p>When you add friends, their activity will appear here.</p></div></aside>
      </main>
    </div>
    <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    {selectedProfile && <div className="nexus-public-profile-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedProfile(null); }}><section className="nexus-public-profile" role="dialog" aria-modal="true" aria-label={`${selectedProfile.full_name || selectedProfile.username} profile`}><button className="nexus-profile-close" onClick={() => setSelectedProfile(null)} aria-label="Close profile">×</button><div className="nexus-profile-left"><div className="nexus-profile-banner" style={{ background: selectedProfile.accent_color || 'linear-gradient(135deg,#253e39,#18221f)' }}>{selectedProfile.banner_url && (selectedProfile.banner_mime_type?.startsWith('video/') ? <video src={selectedProfile.banner_url} autoPlay loop muted playsInline preload="auto" /> : <img src={selectedProfile.banner_url} alt="" />)}</div><div className="nexus-profile-avatar" style={{ outlineColor: selectedProfile.accent_color || '#292a2e' }}>{selectedProfile.avatar_url ? selectedProfile.avatar_mime_type?.startsWith('video/') ? <video src={selectedProfile.avatar_url} autoPlay loop muted playsInline preload="auto" /> : <img src={selectedProfile.avatar_url} alt="" /> : initials(selectedProfile)}<i /></div><h2>{selectedProfile.display_name || selectedProfile.full_name || selectedProfile.username}</h2><strong className="nexus-profile-handle">@{selectedProfile.username}</strong>{selectedProfile.status_text && <p className="nexus-profile-status">{selectedProfile.status_text}</p>}<div className="nexus-profile-actions">{selectedProfile.relationship_status === 'friends' ? <button className="primary" onClick={() => void openDm(selectedProfile)}><MessageCircle size={15} /> Message</button> : selectedProfile.relationship_status === 'incoming_pending' ? <><button className="primary" onClick={() => void handlePendingAction({ id: selectedProfile.friend_request_id }, 'accept')}>✓ Accept</button><button onClick={() => void handlePendingAction({ id: selectedProfile.friend_request_id }, 'reject')}>×</button></> : selectedProfile.relationship_status === 'outgoing_pending' ? <button disabled>Request sent</button> : selectedProfile.relationship_status === 'none' ? <button className="primary" onClick={() => void sendRequest(selectedProfile.id)}><UserPlus size={15} /> Add Friend</button> : null}<button aria-label="More profile options" title="More options">···</button></div><dl><dt>Member Since</dt><dd>{selectedProfile.member_since ? new Date(selectedProfile.member_since).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'NEXUS student'}</dd>{selectedProfile.friends_since && <><dt>Friends Since</dt><dd>{new Date(selectedProfile.friends_since).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</dd></>}<dt>Program</dt><dd>{selectedProfile.program || 'NEXUS student'}</dd><dt>Department</dt><dd>{selectedProfile.department || 'Not provided'}</dd></dl><p className="nexus-profile-bio">{selectedProfile.bio || 'No profile description yet.'}</p></div><div className="nexus-profile-right"><nav><button className={profileTab === 'activity' ? 'active' : ''} onClick={() => setProfileTab('activity')}>Activity</button><button className={profileTab === 'friends' ? 'active' : ''} onClick={() => setProfileTab('friends')}>Friends</button><button className={profileTab === 'groups' ? 'active' : ''} onClick={() => setProfileTab('groups')}>Groups</button></nav><h3>{profileTab === 'activity' ? 'Current activity' : profileTab === 'friends' ? 'Mutual friends' : 'Mutual groups'}</h3><div className="nexus-profile-empty">{profileTab === 'activity' ? 'No public activity to show yet.' : profileTab === 'friends' ? 'Mutual friend details are not available yet.' : 'Mutual group details are not available yet.'}</div></div></section></div>}
  </div>;
};
