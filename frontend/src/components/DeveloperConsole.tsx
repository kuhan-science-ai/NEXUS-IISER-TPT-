import React, { useEffect, useState } from 'react';
import { Search, ShieldAlert, Trash2, X } from 'lucide-react';
import { UserSummary, api } from '../services/api';

type Tab = 'groups' | 'messages';

export const DeveloperConsole: React.FC<{ currentUser: UserSummary | null }> = ({ currentUser }) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('groups');
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [error, setError] = useState('');
  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isAdmin && event.altKey && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        setOpen(value => !value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isAdmin]);

  useEffect(() => {
    if (!open || !isAdmin) return;
    let active = true;
    setError('');
    const load = tab === 'groups'
      ? api.adminListGroups().then(rows => { if (active) setGroups(rows); })
      : api.adminListMessages(query).then(rows => { if (active) setMessages(rows); });
    void load.catch(err => { if (active) setError(err instanceof Error ? err.message : 'Could not load admin data.'); });
    return () => { active = false; };
  }, [open, isAdmin, tab, query]);

  if (!open || !isAdmin) return null;

  const deleteGroup = async (group: any) => {
    if (!window.confirm(`Permanently delete “${group.name}” and all its channels and messages?`)) return;
    try { await api.adminDeleteGroup(group.id); setGroups(rows => rows.filter(row => row.id !== group.id)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not delete this group.'); }
  };
  const deleteMessage = async (message: any) => {
    if (!window.confirm(`Delete this message from ${message.username || 'unknown user'}?`)) return;
    try { await api.adminDeleteMessage(message.id); setMessages(rows => rows.filter(row => row.id !== message.id)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not delete this message.'); }
  };

  return <div style={backdrop} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
    <section style={panel} role="dialog" aria-modal="true" aria-labelledby="dev-console-title">
      <header style={header}><div><span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ShieldAlert size={17} /> ADMIN CONSOLE · ALT+C</span><h2 id="dev-console-title">Developer tools</h2></div><button style={iconButton} aria-label="Close developer tools" onClick={() => setOpen(false)}><X size={18} /></button></header>
      <p style={note}>Authorized account: {currentUser?.email}. Changes are applied to the shared server.</p>
      <nav style={tabs}><button style={tabStyle(tab === 'groups')} onClick={() => setTab('groups')}>Groups</button><button style={tabStyle(tab === 'messages')} onClick={() => setTab('messages')}>Messages</button></nav>
      {tab === 'messages' && <label style={search}><Search size={15} /><input aria-label="Search messages or usernames" placeholder="Search message text or username" value={query} onChange={event => setQuery(event.target.value)} /></label>}
      {error && <p role="alert" style={{ color: '#ff8b8b', fontSize: 12 }}>{error}</p>}
      <div style={list}>
        {tab === 'groups' ? groups.map(group => <article style={row} key={group.id}><div><strong>{group.name}</strong><small>Owner {group.owner_id} · {group.created_at}</small></div><button style={danger} aria-label={`Delete group ${group.name}`} onClick={() => void deleteGroup(group)}><Trash2 size={15} /> Delete</button></article>) : messages.map(message => <article style={row} key={message.id}><div><strong>{message.username || 'Deleted account'} · {message.conversation_title || 'Conversation'}</strong><small>{message.content} · {message.created_at}</small></div><button style={danger} aria-label="Delete message" onClick={() => void deleteMessage(message)}><Trash2 size={15} /> Delete</button></article>)}
        {tab === 'groups' && !groups.length && !error && <p style={note}>No groups found.</p>}
        {tab === 'messages' && !messages.length && !error && <p style={note}>No matching messages.</p>}
      </div>
      <footer style={footer}>Admin role is verified by the API. Shortcut knowledge alone grants no access.</footer>
    </section>
  </div>;
};

const backdrop: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 10000, display: 'grid', placeItems: 'center', padding: 20, background: '#07070bd9' };
const panel: React.CSSProperties = { display: 'flex', flexDirection: 'column', width: 'min(760px, 100%)', maxHeight: 'min(760px, 90vh)', padding: 20, border: '1px solid #393a44', borderRadius: 12, background: '#14151a', color: '#f2f1f5', boxShadow: '0 24px 80px #0009' };
const header: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', color: '#a9f1d5', fontSize: 10, fontWeight: 800, letterSpacing: 1 };
const iconButton: React.CSSProperties = { border: 0, background: 'transparent', color: '#ddd', cursor: 'pointer' };
const note: React.CSSProperties = { color: '#aaaab4', fontSize: 11, lineHeight: 1.5 };
const tabs: React.CSSProperties = { display: 'flex', gap: 8, margin: '6px 0 12px' };
const tabStyle = (active: boolean): React.CSSProperties => ({ padding: '8px 14px', border: `1px solid ${active ? '#54d7a8' : '#383942'}`, borderRadius: 6, background: active ? '#17372c' : '#1b1c22', color: '#eee', cursor: 'pointer' });
const search: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid #383942', borderRadius: 6, color: '#aaa' };
const list: React.CSSProperties = { flex: 1, minHeight: 120, overflowY: 'auto', marginTop: 8 };
const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 2px', borderBottom: '1px solid #2b2c33', fontSize: 12 };
const danger: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto', padding: '7px 9px', border: '1px solid #673d40', borderRadius: 6, background: '#301e20', color: '#ffaaaa', cursor: 'pointer' };
const footer: React.CSSProperties = { paddingTop: 10, color: '#888992', fontSize: 10 };
