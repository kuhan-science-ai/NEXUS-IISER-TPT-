import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, MessageCircle, MessagesSquare, Plus, Search, Send, X } from 'lucide-react';
import { api, UserSummary } from '../services/api';
import { SideNav } from '../components/SideNav';
import { TopHeader } from '../components/TopHeader';
import { GlobalSearchModal } from '../components/GlobalSearchModal';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { MessageReplyPreview } from '../components/MessageReplyPreview';
import { MessengerEmojiInput } from '../components/MessengerEmojiInput';
import { TwemojiText } from '../components/TwemojiText';
import { wsClient } from '../services/websocket';
import './FriendsPage.css';
import './MessagingPage.css';
import './ForumsPage.css';

interface ForumsPageProps { currentUser: UserSummary | null; onLogout?: () => void; }
type ForumFilter = 'trending' | 'latest' | 'unanswered';
type ForumPost = {
  id: string; title: string; content_latex: string; category: string; author_id?: string | null;
  author_name?: string; author_username?: string; avatar_url?: string | null; avatar_mime_type?: string | null;
  upvotes: number; downvotes: number; user_vote?: number | null; comments_count: number;
  is_solved?: boolean; is_locked?: boolean; is_pinned?: boolean; created_at: string;
};
type ForumComment = {
  id: string; post_id: string; parent_comment_id?: string | null; author_id?: string | null;
  author_name?: string; author_username?: string; avatar_url?: string | null; avatar_mime_type?: string | null;
  content_latex: string; created_at: string; is_accepted?: boolean;
};
type ForumDetail = ForumPost & { comments: ForumComment[] };

const channels = [
  'All discussions', 'Physics lounge', 'Chemistry corner', 'Biology commons', 'Math circle',
  'Campus conversations', 'Research & careers',
];

const relativeTime = (value: string) => {
  const stamp = new Date(value).getTime();
  if (!Number.isFinite(stamp)) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - stamp) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days}d ago` : new Date(value).toLocaleDateString();
};

const authorLabel = (item: { author_name?: string; author_username?: string; author_id?: string | null }, currentUser: UserSummary) =>
  item.author_id === currentUser.id ? 'You' : item.author_name || item.author_username || 'NEXUS member';
const readForumDetailCache = (userId: string, postId: string): ForumDetail | null => {
  try { return JSON.parse(sessionStorage.getItem(`nexus-forum-detail:${userId}:${postId}`) || 'null') as ForumDetail | null; }
  catch { return null; }
};

export const ForumsPage: React.FC<ForumsPageProps> = ({ currentUser, onLogout }) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeChannel, setActiveChannel] = useState('All discussions');
  const [activeFilter, setActiveFilter] = useState<ForumFilter>('trending');
  const [query, setQuery] = useState('');
  const [discussions, setDiscussions] = useState<ForumPost[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState('');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ForumDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [newDiscussionOpen, setNewDiscussionOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('Physics lounge');
  const [creating, setCreating] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ForumComment | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [voteBusy, setVoteBusy] = useState<string | null>(null);

  const loadPosts = useCallback(async () => {
    if (!currentUser) return;
    try {
      const category = activeChannel === 'All discussions' ? undefined : activeChannel;
      const rows = await api.listForumPosts(category, query.trim() || undefined, activeFilter, 100);
      let visible = rows as ForumPost[];
      if (activeFilter === 'unanswered') visible = visible.filter(post => Number(post.comments_count || 0) === 0);
      if (activeFilter === 'latest') visible = [...visible].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
      if (activeFilter === 'trending') visible = [...visible].sort((a, b) => ((b.upvotes || 0) - (b.downvotes || 0) + (b.comments_count || 0) * 2) - ((a.upvotes || 0) - (a.downvotes || 0) + (a.comments_count || 0) * 2));
      setDiscussions(visible);
      setFeedError('');
    } catch {
      setFeedError('The global discussion feed could not be loaded. Check your connection and try again.');
    } finally { setFeedLoading(false); }
  }, [activeChannel, activeFilter, currentUser, query]);

  const loadDetail = useCallback(async (postId: string) => {
    try {
      const result = await api.getForumPostDetails(postId) as ForumDetail;
      setDetail(result);
      try { sessionStorage.setItem(`nexus-forum-detail:${currentUser?.id}:${postId}`, JSON.stringify(result)); } catch { /* Keep the in-memory thread when session storage is unavailable. */ }
      setDetailError('');
    } catch {
      setDetailError(current => current || 'This discussion could not be loaded. It may have been removed.');
    } finally { setDetailLoading(false); }
  }, [currentUser?.id]);

  useEffect(() => {
    setFeedLoading(true);
    const timer = window.setTimeout(() => void loadPosts(), 160);
    return () => window.clearTimeout(timer);
  }, [loadPosts]);

  useEffect(() => {
    if (!selectedPostId) return;
    const cached = readForumDetailCache(currentUser?.id || 'guest', selectedPostId);
    if (cached) { setDetail(cached); setDetailLoading(false); }
    else { setDetail(null); setDetailLoading(true); }
    setDetailError('');
    setReplyTarget(null);
    void loadDetail(selectedPostId);
  }, [selectedPostId, loadDetail, currentUser?.id]);

  useEffect(() => {
    if (!currentUser) return;
    let polling = false;
    const refresh = (event: Event) => {
      const payload = (event as CustomEvent).detail;
      if (payload?.event !== 'forum.changed') return;
      void loadPosts();
      if (selectedPostId && payload.post_id === selectedPostId) void loadDetail(selectedPostId);
    };
    const syncIfOffline = () => {
      if (wsClient.isConnected() || polling) return;
      polling = true;
      void loadPosts().finally(() => { if (selectedPostId) void loadDetail(selectedPostId); polling = false; });
    };
    window.addEventListener('nexus-realtime-event', refresh);
    const timer = window.setInterval(syncIfOffline, 8000);
    return () => { window.removeEventListener('nexus-realtime-event', refresh); window.clearInterval(timer); };
  }, [currentUser, loadDetail, loadPosts, selectedPostId]);

  const visiblePosts = useMemo(() => discussions, [discussions]);

  const openComposer = () => {
    setNewCategory(activeChannel === 'All discussions' ? 'Physics lounge' : activeChannel);
    setNewDiscussionOpen(true);
  };

  const createPost = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newTitle.trim() || !newContent.trim() || creating) return;
    setCreating(true);
    try {
      const created = await api.createForumPost({ title: newTitle.trim(), content_latex: newContent.trim(), category: newCategory });
      setNewDiscussionOpen(false);
      setNewTitle(''); setNewContent('');
      setActiveChannel('All discussions'); setActiveFilter('latest');
      setSelectedPostId(created.post_id || created.id);
      await loadPosts();
    } catch (cause) {
      setFeedError(cause instanceof Error ? cause.message : 'Your discussion could not be published.');
    } finally { setCreating(false); }
  };

  const vote = async (post: ForumPost, voteType: 1 | -1, event?: React.MouseEvent) => {
    event?.stopPropagation();
    if (voteBusy) return;
    setVoteBusy(post.id);
    try {
      await api.voteForumPost(post.id, voteType);
      await loadPosts();
      if (selectedPostId === post.id) await loadDetail(post.id);
    } catch (cause) {
      setFeedError(cause instanceof Error ? cause.message : 'Your vote could not be saved.');
    } finally { setVoteBusy(null); }
  };

  const sendReply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!detail || !replyText.trim() || detail.is_locked || sendingReply) return;
    setSendingReply(true);
    try {
      await api.addForumComment(detail.id, replyText.trim(), replyTarget?.id);
      setReplyText(''); setReplyTarget(null);
      await Promise.all([loadDetail(detail.id), loadPosts()]);
    } catch (cause) {
      setDetailError(cause instanceof Error ? cause.message : 'Your reply could not be sent.');
    } finally { setSendingReply(false); }
  };

  if (!currentUser) return null;

  return <div className="forums-route">
    <SideNav currentUser={currentUser} onLogout={onLogout} onOpenSearch={() => setSearchOpen(true)} />
    <div className="forums-page-shell">
      <TopHeader breadcrumb="Workspace / Discussion Forums" currentUser={currentUser} onOpenSearch={() => setSearchOpen(true)} actionButton={{ label: 'Start a discussion', onClick: openComposer, icon: '+' }} />
      <main className={`forums-workspace${selectedPostId ? ' has-open-thread' : ' is-thread-closed'}`}>
        <aside className="forums-channels">
          <div className="forums-section-heading"><span>Global forums</span><button type="button" onClick={openComposer} title="Start a discussion" aria-label="Start a discussion"><Plus size={16} /></button></div>
          <div className="forums-channel-list">
            {channels.map(channel => <button key={channel} type="button" className={activeChannel === channel ? 'is-active' : ''} onClick={() => setActiveChannel(channel)}><span className="forums-channel-hash">#</span><span>{channel}</span>{channel === 'All discussions' && <small>{discussions.length}</small>}</button>)}
          </div>
          <div className="forums-guidelines"><strong>Community, with care</strong><p>Be curious. Be kind. Credit your sources. Disagree with ideas, not people.</p></div>
        </aside>

        <section className="forums-feed-column">
          <header className="forums-feed-toolbar">
            <div><h1>Discussions</h1><p>Questions and ideas from across the NEXUS community.</p></div>
            <label className="forums-search"><Search size={15} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search discussions" aria-label="Search discussions" /></label>
          </header>
          <nav className="forums-filter-tabs" aria-label="Filter discussions">
            {(['trending', 'latest', 'unanswered'] as ForumFilter[]).map(filter => <button type="button" key={filter} className={activeFilter === filter ? 'is-active' : ''} onClick={() => setActiveFilter(filter)}>{filter === 'trending' ? 'Trending' : filter === 'latest' ? 'Latest' : 'Unanswered'}</button>)}
            <button type="button" className="forums-new-post" onClick={openComposer}><Plus size={15} /> Start a discussion</button>
          </nav>
          <div className="forums-feed-list">
            {feedLoading && !visiblePosts.length && <div className="forums-state">Loading global discussions…</div>}
            {!feedLoading && feedError && !visiblePosts.length && <div className="forums-state is-error">{feedError}<button onClick={() => void loadPosts()}>Retry</button></div>}
            {!feedLoading && !feedError && !visiblePosts.length && <div className="forums-state"><MessagesSquare size={26} /><strong>No discussions here yet</strong><span>Start the first conversation in this forum.</span><button onClick={openComposer}>Start a discussion</button></div>}
            {visiblePosts.map(post => <article key={post.id} className={`forum-post-card${selectedPostId === post.id ? ' is-selected' : ''}`} role="button" tabIndex={0} onClick={() => setSelectedPostId(post.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedPostId(post.id); } }}>
              <div className="forum-post-votes"><button type="button" className={Number(post.user_vote) === 1 ? 'is-active' : ''} title="Upvote" aria-label={`Upvote ${post.title}`} disabled={voteBusy === post.id} onClick={event => void vote(post, 1, event)}><ArrowUp size={15} /></button><strong>{Number(post.upvotes || 0) - Number(post.downvotes || 0)}</strong><button type="button" className={Number(post.user_vote) === -1 ? 'is-active' : ''} title="Downvote" aria-label={`Downvote ${post.title}`} disabled={voteBusy === post.id} onClick={event => void vote(post, -1, event)}><ArrowDown size={15} /></button></div>
              <div className="forum-post-copy"><div className="forum-post-labels"><span className="forum-category-pill">{post.category}</span>{post.is_solved && <span className="forum-solved-pill">Solved</span>}{post.is_pinned && <span className="forum-pinned-pill">Pinned</span>}</div><h2>{post.title}</h2><p className="forum-post-excerpt"><TwemojiText>{post.content_latex}</TwemojiText></p><div className="forum-post-meta"><ProfileAvatar className="forum-post-avatar" user={post} label={post.author_name} size={22} /><strong>{authorLabel(post, currentUser)}</strong><span>·</span><MessageCircle size={13} /><span>{post.comments_count || 0} replies</span><span>·</span><time>{relativeTime(post.created_at)}</time></div></div>
            </article>)}
          </div>
        </section>

        {selectedPostId && <section className="messenger-chat-panel forum-thread-panel">
          {detail?.id === selectedPostId ? <>
            <header className="messenger-chat-header forum-thread-header"><div className="nexus-dm-heading"><MessagesSquare size={18} /><div><strong>{detail.title}</strong><small>#{detail.category} · {detail.comments?.length || 0} replies</small></div></div><div className="messenger-chat-actions"><button type="button" aria-label="Upvote discussion" title="Upvote discussion" className={Number(detail.user_vote) === 1 ? 'is-selected' : ''} onClick={() => void vote(detail, 1)}><ArrowUp size={17} /></button><button type="button" aria-label="Close discussion" title="Close discussion" onClick={() => setSelectedPostId(null)}><X size={17} /></button></div></header>
            {detailError && <p className="nexus-message-error" role="alert">{detailError}</p>}
            <div className="messenger-chat-messages nexus-chat-messages forum-thread-messages">
              {detailLoading && <p className="friends-empty">Refreshing discussion…</p>}
              <article className="nexus-message-row nexus-chat-message forum-root-post">
                <span className="nexus-chat-avatar-slot"><ProfileAvatar className="nexus-message-avatar nexus-chat-message-avatar" user={detail} label={detail.author_name} /></span>
                <div className="nexus-message-main"><div className="nexus-message-meta"><strong>{authorLabel(detail, currentUser)}</strong><time>{new Date(detail.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</time></div><h2>{detail.title}</h2><div className="nexus-message-text-line"><p><TwemojiText>{detail.content_latex}</TwemojiText></p></div><div className="forum-root-actions"><button type="button" className={Number(detail.user_vote) === 1 ? 'is-active' : ''} onClick={() => void vote(detail, 1)}><ArrowUp size={14} /> {detail.upvotes || 0}</button><button type="button" className={Number(detail.user_vote) === -1 ? 'is-active' : ''} onClick={() => void vote(detail, -1)}><ArrowDown size={14} /> {detail.downvotes || 0}</button></div></div>
              </article>
              {detail.comments?.map(comment => {
                const parent = comment.parent_comment_id ? detail.comments.find(item => item.id === comment.parent_comment_id) : undefined;
                return <article id={`forum-comment-${comment.id}`} key={comment.id} className={`nexus-message-row nexus-chat-message forum-comment${comment.parent_comment_id ? ' is-reply' : ''}`}>
                  <span className="nexus-chat-avatar-slot"><ProfileAvatar className="nexus-message-avatar nexus-chat-message-avatar" user={comment} label={comment.author_name} /></span>
                  <div className="nexus-message-main">{parent && <MessageReplyPreview author={parent.author_name || parent.author_username || 'NEXUS member'} content={parent.content_latex} user={parent} onClick={() => document.getElementById(`forum-comment-${parent.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} ariaLabel={`Jump to reply from ${parent.author_name || parent.author_username || 'member'}`} />}<div className="nexus-message-meta"><strong>{authorLabel(comment, currentUser)}</strong><time>{new Date(comment.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</time></div><div className="nexus-message-text-line"><p><TwemojiText>{comment.content_latex}</TwemojiText></p></div><button className="forum-reply-button" type="button" onClick={() => setReplyTarget(comment)}>Reply</button></div>
                </article>;
              })}
              {!detailLoading && !detail.comments?.length && <div className="forum-thread-empty"><MessageCircle size={21} /><span>No replies yet. Start the discussion.</span></div>}
            </div>
            {detail.is_locked ? <div className="forum-locked-note">This discussion is locked.</div> : <form className="messenger-chat-composer nexus-real-composer forum-thread-composer" onSubmit={sendReply}>
              {replyTarget && <div className="nexus-replying"><span>Replying to <strong>{replyTarget.author_name || replyTarget.author_username || 'NEXUS member'}</strong><small>{replyTarget.content_latex.slice(0, 90)}</small></span><button type="button" onClick={() => setReplyTarget(null)} aria-label="Cancel reply"><X size={14} /></button></div>}
              <div className="nexus-composer-input-row"><MessengerEmojiInput key={currentUser.id} value={replyText} onChange={setReplyText} placeholder="Message this discussion…" userId={currentUser.id} /><button type="submit" aria-label="Send reply" title="Send reply" disabled={!replyText.trim() || sendingReply}><Send size={16} /></button></div><small>Replies are shared with the NEXUS community.</small>
            </form>}
          </> : <div className="forum-thread-placeholder"><MessagesSquare size={30} /><strong>Choose a discussion</strong><p>Open a post to read its thread and join the conversation.</p></div>}
        </section>}
      </main>
    </div>

    {newDiscussionOpen && <div className="forum-modal-backdrop" role="presentation" onClick={() => setNewDiscussionOpen(false)}><section className="forum-create-modal" role="dialog" aria-modal="true" aria-labelledby="forum-create-title" onClick={event => event.stopPropagation()}><header><div><h2 id="forum-create-title">Start a discussion</h2><p>Share a question or idea with the global community.</p></div><button type="button" onClick={() => setNewDiscussionOpen(false)} aria-label="Close"><X size={18} /></button></header><form onSubmit={createPost}><label>Forum<select value={newCategory} onChange={event => setNewCategory(event.target.value)}>{channels.filter(channel => channel !== 'All discussions').map(channel => <option key={channel} value={channel}>{channel}</option>)}</select></label><label>Title<input required minLength={5} maxLength={255} value={newTitle} onChange={event => setNewTitle(event.target.value)} placeholder="What would you like to discuss?" /></label><label>Details<textarea required minLength={1} maxLength={20_000} rows={6} value={newContent} onChange={event => setNewContent(event.target.value)} placeholder="Add the context, question, or idea…" /></label><footer><button type="button" className="forum-cancel-button" onClick={() => setNewDiscussionOpen(false)}>Cancel</button><button type="submit" disabled={creating || !newTitle.trim() || !newContent.trim()}>{creating ? 'Publishing…' : <><Plus size={15} /> Publish discussion</>}</button></footer></form></section></div>}
    <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
  </div>;
};
