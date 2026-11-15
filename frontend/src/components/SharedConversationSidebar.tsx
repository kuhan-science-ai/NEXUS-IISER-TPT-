import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, MessagesSquare, MoreHorizontal, Plus, Search, Users } from 'lucide-react';
import { UserSummary } from '../services/api';
import { ProfileAvatar } from './ProfileAvatar';

export type SidebarConversation = {
  id: string;
  type: string;
  title?: string;
  members?: any[];
  last_message?: { content?: string } | null;
};

type Props = {
  currentUser: UserSummary;
  section: 'friends' | 'messenger';
  conversations: SidebarConversation[];
  activeConversationId?: string | null;
  friendsCount?: number;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onAddConversation?: () => void;
};

export const readSharedConversationSidebarCollapsed = (userId?: string) => {
  if (!userId) return false;
  try { return localStorage.getItem(`nexus-conversation-sidebar-collapsed:${userId}`) === 'true'; }
  catch { return false; }
};

export const SharedConversationSidebar: React.FC<Props> = ({ currentUser, section, conversations, activeConversationId, friendsCount = 0, collapsed, onCollapsedChange, onAddConversation }) => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const displayName = (conversation: SidebarConversation) => conversation.title || conversation.members?.filter(member => member.user_id !== currentUser.id).map(member => member.full_name || member.username).join(', ') || 'Conversation';
  const initials = (conversation: SidebarConversation) => displayName(conversation).split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();
  const avatarFor = (conversation: SidebarConversation) => conversation.type.toLowerCase() === 'direct' ? conversation.members?.find(member => member.user_id !== currentUser.id) || conversation : conversation;
  const visibleConversations = useMemo(() => conversations.filter(conversation => displayName(conversation).toLowerCase().includes(query.trim().toLowerCase())), [conversations, query, currentUser.id]);

  const setCollapsed = (value: boolean) => {
    onCollapsedChange(value);
    try { localStorage.setItem(`nexus-conversation-sidebar-collapsed:${currentUser.id}`, String(value)); } catch { /* the sidebar still works without browser storage */ }
  };

  return <aside className={`friends-dm-sidebar shared-conversation-sidebar${section === 'messenger' ? ' messenger-dm-sidebar' : ''}`}>
    <div className="messenger-sidebar-top">
      <label className="friends-start-conversation messenger-conversation-search"><Search size={15} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Find or start a conversation" aria-label="Find or start a conversation" /></label>
      <button type="button" className="dm-sidebar-toggle" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expand conversations sidebar' : 'Collapse conversations sidebar'} aria-expanded={!collapsed} title={collapsed ? 'Expand conversations sidebar' : 'Collapse conversations sidebar'}>{collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</button>
    </div>
    <Link to={section === 'friends' ? '/friends' : '/messaging'} className={`friends-side-active${section === 'messenger' ? ' messenger-side-active' : ''}`}>
      {section === 'friends' ? <Users size={17} /> : <MessagesSquare size={17} />}{section === 'friends' ? 'Friends' : 'Messenger'}<span>{section === 'friends' ? friendsCount : conversations.length}</span>
    </Link>
    <div className="friends-dm-heading">Conversations <button type="button" aria-label="Start a conversation" onClick={onAddConversation || (() => navigate('/friends'))}><Plus size={17} /></button></div>
    <div className="friends-dm-list">
      {visibleConversations.map(conversation => <button type="button" key={conversation.id} className={`friends-dm-item ${conversation.id === activeConversationId ? 'is-selected' : ''}`} onClick={() => navigate(`/messaging?conversationId=${encodeURIComponent(conversation.id)}`)}>
        <ProfileAvatar className="friends-avatar" user={avatarFor(conversation)} label={initials(conversation)} />
        <span className="friends-dm-copy"><strong>{displayName(conversation)}</strong><small>{conversation.last_message?.content || 'No messages yet'}</small></span>
      </button>)}
      {!visibleConversations.length && <p className="friends-empty">{query ? 'No conversations match your search.' : 'No conversations yet. Add a friend to start a chat.'}</p>}
    </div>
    <div className="friends-own-profile">
      <ProfileAvatar className="friends-avatar" user={currentUser} />
      <span><strong>{currentUser.display_name || currentUser.full_name || currentUser.username}</strong><small>Verified student</small></span>
      <button type="button" aria-label="Open profile settings" onClick={() => navigate('/settings')}><MoreHorizontal size={18} /></button>
    </div>
  </aside>;
};
