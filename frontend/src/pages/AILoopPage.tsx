import React, { useState, useEffect } from 'react';
import { api, UserSummary } from '../services/api';
import { MathRenderer } from '../components/MathRenderer';
import { readUserPreference } from '../services/userPreferences';
import { SideNav } from '../components/SideNav';
import { Activity, Ban, BarChart3, Bot, BrainCircuit, Circle, CircleCheck, CircleX, Copy, Database, GitFork, Radio, Reply, Save, Search, Settings2, ShieldCheck, Target, Trash2, Wrench, Zap, type LucideIcon } from 'lucide-react';

interface AILoopPageProps {
  currentUser: UserSummary | null;
  onLogout?: () => void;
}

const STAGE_ICONS: Record<string, LucideIcon> = {
  validation: Search, conversation_load: Database, context_build: BrainCircuit,
  intent_routing: Target, tool_selection: Wrench, permission_check: ShieldCheck,
  execution: Zap, result_collection: BarChart3, response_processing: Settings2,
  stream_response: Radio, save_conversation: Save, completed: CircleCheck,
  error: CircleX, cancelled: Ban,
};

const stageBadgeColor = (stage: string) => {
  if (stage === 'completed') return 'rgba(16,185,129,0.15)';
  if (stage === 'error') return 'rgba(239,68,68,0.15)';
  if (stage === 'permission_check') return 'rgba(245,158,11,0.15)';
  if (stage === 'stream_response') return 'rgba(56,189,248,0.15)';
  return 'rgba(139,92,246,0.10)';
};

const stageBorderColor = (stage: string) => {
  if (stage === 'completed') return 'rgba(16,185,129,0.3)';
  if (stage === 'error') return 'rgba(239,68,68,0.3)';
  if (stage === 'permission_check') return 'rgba(245,158,11,0.3)';
  if (stage === 'stream_response') return 'rgba(56,189,248,0.3)';
  return 'rgba(139,92,246,0.2)';
};

const readAssistantName = (userId: string) => readUserPreference('nexus-ai-name', userId, 'NEXUS').trim().slice(0, 10) || 'NEXUS';

export const AILoopPage: React.FC<AILoopPageProps> = ({ currentUser, onLogout }) => {
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [stages, setStages] = useState<any[]>([]);
  const [streamedText, setStreamedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [pendingConfirmation, setPendingConfirmation] = useState<any | null>(null);
  const [tools, setTools] = useState<any[]>([]);
  const [conversationMessages, setConversationMessages] = useState<any[]>([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [messageOffset, setMessageOffset] = useState(0);
  const [loadingEarlierMessages, setLoadingEarlierMessages] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [assistantName, setAssistantName] = useState(() => readAssistantName(currentUser?.id || 'guest'));

  const copyMessage = async (content: string) => { try { await navigator.clipboard.writeText(content); } catch { setRequestError('Could not copy this message in this browser.'); } };
  const quoteMessage = (content: string) => { setPrompt(value => `${value}${value ? '\n' : ''}> ${content.split('\n').join('\n> ')}\n\n`); document.querySelector<HTMLInputElement>('[data-ai-prompt]')?.focus(); };
  const renderChatMessage = (message: any, index: number, messages: any[], content = message.content) => {
    const role = message.role === 'user' ? 'user' : 'assistant';
    const grouped = index > 0 && (messages[index - 1].role === 'user' ? 'user' : 'assistant') === role;
    const name = role === 'user' ? (currentUser.display_name || currentUser.full_name || currentUser.username) : assistantName;
    return <article className={`nexus-ai-chat-message${grouped ? ' grouped' : ''}`} key={message.id || index}>
      <span className="nexus-ai-chat-avatar-slot">{!grouped && (role === 'user' && currentUser.avatar_url ? currentUser.avatar_mime_type?.startsWith('video/') ? <video className="nexus-ai-chat-avatar" src={currentUser.avatar_url} autoPlay loop muted playsInline /> : <img className="nexus-ai-chat-avatar" src={currentUser.avatar_url} alt="" /> : <span className="nexus-ai-chat-avatar">{role === 'user' ? name.slice(0, 1).toUpperCase() : <Bot size={15} />}</span>)}</span>
      <div className="nexus-ai-chat-body">{!grouped && <div className="nexus-ai-chat-meta"><strong>{name}</strong><time>{message.created_at ? new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'now'}</time></div>}<div className="nexus-ai-chat-text">{content ? <MathRenderer content={content} /> : message.status || (isProcessing ? <span className="nexus-ai-thinking" role="status">{assistantName} is thinking<span className="nexus-ai-thinking-dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span></span> : '')}</div><div className="nexus-ai-chat-actions"><button type="button" title="Copy message" onClick={() => void copyMessage(content)}><Copy size={13} /></button><button type="button" title="Reply to message" onClick={() => quoteMessage(content)}><Reply size={14} /></button></div></div>
    </article>;
  };

  useEffect(() => {
    const updateAssistantName = (event?: Event) => {
      const name = (event as CustomEvent<{ name?: string }> | undefined)?.detail?.name;
      setAssistantName(name?.trim().slice(0, 10) || readAssistantName(currentUser?.id || 'guest'));
    };
    window.addEventListener('nexus-ai-name-updated', updateAssistantName);
    window.addEventListener('storage', updateAssistantName);
    return () => { window.removeEventListener('nexus-ai-name-updated', updateAssistantName); window.removeEventListener('storage', updateAssistantName); };
  }, [currentUser?.id]);

  const getPageContext = () => ({
    path: window.location.pathname + window.location.search,
    title: document.title,
    selected_text: window.getSelection()?.toString().slice(0, 2500) || '',
    visible_page_text: (document.querySelector('main')?.innerText || document.body.innerText).slice(0, 10000),
  });

  useEffect(() => {
    loadConversations();
    api.listAITools().then(setTools);
  }, []);

  const loadConversations = async () => {
    try {
      const convs = await api.listAIConversations();
      setConversations(convs);
      if (convs.length > 0 && !activeConvId) setActiveConvId(convs[0].id);
      return convs;
    } catch (e) { console.error(e); }
    return [];
  };

  const loadMessages = async (id: string, offset = 0, append = false): Promise<boolean> => {
    try {
      if (append) setLoadingEarlierMessages(true);
      const data = await api.getAIMessages(id, offset);
      const messages = data.messages || [];
      setConversationMessages(prev => append ? [...messages, ...prev] : messages);
      setHasMoreMessages(Boolean(data.has_more));
      setMessageOffset(data.next_offset ?? offset + messages.length);
      return true;
    } catch (e) { console.error(e); if (!append) setConversationMessages([]); return false; }
    finally { if (append) setLoadingEarlierMessages(false); }
  };

  useEffect(() => {
    setConversationMessages([]);
    setHasMoreMessages(false);
    setMessageOffset(0);
    if (activeConvId) void loadMessages(activeConvId);
  }, [activeConvId]);

  const handleCreateConversation = async () => {
    try {
      const nc = await api.createAIConversation('Session ' + new Date().toLocaleTimeString());
      await loadConversations();
      setActiveConvId(nc.id); setStages([]); setStreamedText(''); setConversationMessages([]);
    } catch (e: any) { alert(e.message); }
  };

  const handleCreateThread = async (parent: any) => {
    try {
      const thread = await api.createAIThread(parent.id, `Thread · ${new Date().toLocaleTimeString()}`);
      await loadConversations();
      setActiveConvId(thread.id); setStages([]); setStreamedText(''); setConversationMessages([]);
    } catch (e: any) { alert(e.message); }
  };

  const handleDeleteConversation = async (conversation: any) => {
    if (!window.confirm(`Delete “${conversation.title}” and its subthreads? This cannot be undone.`)) return;
    try {
      const result = await api.deleteAIConversation(conversation.id);
      const remaining = await api.listAIConversations();
      setConversations(remaining);
      window.dispatchEvent(new CustomEvent('nexus-ai-conversations-deleted', { detail: { ids: result.deleted_ids || [conversation.id] } }));
      if ((result.deleted_ids || [conversation.id]).includes(activeConvId)) {
        setActiveConvId(remaining[0]?.id || null); setStages([]); setStreamedText(''); setConversationMessages([]); setPendingConfirmation(null);
      }
    } catch (e: any) { alert(e.message); }
  };

  const renderConversation = (conversation: any, depth = 0): React.ReactNode => {
    const children = conversations.filter(item => item.parent_id === conversation.id);
    return <React.Fragment key={conversation.id}>
      <div onClick={() => { setActiveConvId(conversation.id); setStages([]); setStreamedText(''); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '8px 6px 8px 10px', paddingLeft: 10 + depth * 14,
          borderRadius: 'var(--radius-sm)', marginBottom: 3, cursor: 'pointer',
          background: activeConvId === conversation.id ? 'rgba(139,92,246,0.12)' : 'transparent',
          border: `1px solid ${activeConvId === conversation.id ? 'rgba(139,92,246,0.3)' : 'transparent'}`,
          color: activeConvId === conversation.id ? 'var(--text-primary)' : 'var(--text-muted)',
        }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: activeConvId === conversation.id ? 600 : 400, overflowWrap: 'anywhere' }}><Bot size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />{conversation.title}</span>
        <button type="button" title="Create a subthread" aria-label={`Create subthread for ${conversation.title}`} onClick={event => { event.stopPropagation(); void handleCreateThread(conversation); }} style={{ border: 0, background: 'transparent', color: 'var(--text-faint)', padding: 5, cursor: 'pointer' }}><GitFork size={14} /></button>
        <button type="button" title="Delete chat and its subthreads" aria-label={`Delete ${conversation.title}`} onClick={event => { event.stopPropagation(); void handleDeleteConversation(conversation); }} style={{ border: 0, background: 'transparent', color: 'var(--text-faint)', padding: 5, cursor: 'pointer' }}><Trash2 size={14} /></button>
      </div>
      {children.map(child => renderConversation(child, depth + 1))}
    </React.Fragment>;
  };

  const handleSendPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    const submittedPrompt = prompt.trim();
    if (!submittedPrompt || !activeConvId || isProcessing) return;
    setIsProcessing(true); setStages([]); setStreamedText(''); setPendingConfirmation(null); setRequestError('');
    setPrompt('');
    setConversationMessages(prev => [...prev, { id: `optimistic-${Date.now()}`, role: 'user', content: submittedPrompt, created_at: new Date().toISOString() }]);
    const token = api.getToken();
    try {
      const response = await fetch(`/api/v1/ai/conversations/${activeConvId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ prompt: submittedPrompt, page_context: getPageContext() }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.detail || `Assistant request failed (${response.status})`);
      }
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('Streaming is unavailable in this browser.');
      let buffer = '';
      let completedResponse = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            setStages(prev => [...prev, data]);
            if (data.stage === 'stream_response' && data.token) { completedResponse += data.token; setStreamedText(prev => prev + data.token); }
            if (data.stage === 'permission_check' && data.requires_confirmation) setPendingConfirmation(data);
            if (data.stage === 'error') setRequestError(data.message || 'The assistant encountered an error.');
          }
        }
      }
      const persisted = await loadMessages(activeConvId);
      if (!persisted && completedResponse) setConversationMessages(prev => [...prev, { id: `stream-fallback-${Date.now()}`, role: 'assistant', content: completedResponse, created_at: new Date().toISOString() }]);
      setStreamedText('');
    } catch (err: any) {
      const message = err.message || 'The assistant could not complete the request.';
      setRequestError(message);
      setStages(prev => [...prev, { stage: 'error', message }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmTool = async (approved: boolean) => {
    if (!pendingConfirmation || !activeConvId) return;
    try {
      const res = await api.confirmAITool(activeConvId, pendingConfirmation.execution_id, approved);
      if (approved) window.dispatchEvent(new CustomEvent('nexus-ai-action-completed', { detail: { tool_name: pendingConfirmation.tool_name, tool_result: res.tool_result } }));
      setStages(prev => [...prev, { stage: 'confirmation_result', result: res }]);
      setPendingConfirmation(null);
      void loadMessages(activeConvId);
    } catch (err: any) { alert(err.message); }
  };

  const handleCancel = async () => {
    if (!activeConvId) return;
    await api.cancelAI(activeConvId); setIsProcessing(false);
  };

  if (!currentUser) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)' }}>
      <SideNav currentUser={currentUser} onLogout={onLogout} />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', height: '100vh' }}>

        {/* ── Left sidebar ── */}
        <div style={{
          width: '280px', background: 'var(--bg-surface)',
          borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ fontWeight: '700', fontSize: '15px', marginBottom: '12px' }}>NEXUS AI Assistant</h2>
            <button onClick={handleCreateConversation} style={{
              width: '100%', padding: '9px',
              background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
              color: 'white', border: 'none', borderRadius: 'var(--radius-sm)',
              fontWeight: '600', fontSize: '13px',
            }}>+ New Chat</button>
          </div>

          {/* Sessions */}
          <div style={{ padding: '12px 8px', flex: 1, overflowY: 'auto' }}>
            <p style={{ fontSize: '11px', color: 'var(--text-faint)', fontWeight: '600', padding: '4px 8px', marginBottom: '4px', letterSpacing: '0.5px' }}>SESSIONS</p>
            {conversations.filter(c => !c.parent_id).map(c => renderConversation(c))}
          </div>

          {/* Tools section */}
          <div style={{ borderTop: '1px solid var(--border)' }}>
            <button onClick={() => setShowTools(!showTools)} style={{
              width: '100%', padding: '12px 16px', background: 'none', border: 'none',
              color: 'var(--text-muted)', fontSize: '12px', fontWeight: '600',
              display: 'flex', justifyContent: 'space-between', cursor: 'pointer',
              letterSpacing: '0.5px',
            }}>
              REGISTERED TOOLS ({tools.length}) <span>{showTools ? '▲' : '▼'}</span>
            </button>
            {showTools && (
              <div style={{ maxHeight: '200px', overflowY: 'auto', padding: '0 12px 12px' }}>
                {tools.map(t => (
                  <div key={t.name} style={{
                    padding: '8px 10px', borderRadius: 'var(--radius-xs)',
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    marginBottom: '4px',
                  }}>
                    <p style={{ fontWeight: '600', fontSize: '12px', marginBottom: '2px', fontFamily: 'monospace', color: 'var(--accent-cyan)' }}>
                      {t.name}
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--text-faint)' }}>{t.description}</p>
                    <span style={{
                      padding: '1px 6px', borderRadius: '100px', fontSize: '10px',
                      background: 'rgba(139,92,246,0.1)', color: 'var(--accent)',
                    }}>{t.safety_tier}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Main area ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{
            padding: '16px 28px', borderBottom: '1px solid var(--border)',
            background: 'var(--bg-surface)',
            display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <div>
              <h3 style={{ fontWeight: '700', fontSize: '16px', marginBottom: '2px' }}>AI Study Companion</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-faint)' }}>
                'Qwen3 14B · your laptop GPU'
              </p>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
              {isProcessing && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--accent-green)' }}>
                  <span className="nx-spinner" /> Processing…
                </span>
              )}
            </div>
          </div>

          {/* Content area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {(conversationMessages.length > 0 || streamedText || isProcessing) && <section className="nexus-ai-chat-history" aria-label="Conversation history">
              {hasMoreMessages && <button type="button" disabled={loadingEarlierMessages} onClick={() => activeConvId && void loadMessages(activeConvId, messageOffset, true)} style={{ alignSelf: 'center', padding: '7px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-raised)', color: 'var(--text-muted)', fontSize: 12 }}>{loadingEarlierMessages ? 'Loading…' : 'Load earlier messages'}</button>}
              {conversationMessages.map((message, index, messages) => renderChatMessage(message, index, messages))}
              {isProcessing && !streamedText && <div aria-live="polite">{renderChatMessage({ id: 'thinking-response', role: 'assistant', created_at: new Date().toISOString() }, 0, [])}</div>}
              {streamedText && <div aria-live="polite">{renderChatMessage({ id: 'streaming-response', role: 'assistant', created_at: new Date().toISOString() }, conversationMessages.length, [...conversationMessages, { role: 'assistant' }], streamedText)}</div>}
            </section>}

            {/* Safety confirmation gate */}
            {pendingConfirmation && (
              <div style={{
                padding: '20px 24px',
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.4)',
                borderRadius: 'var(--radius-lg)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <ShieldCheck size={20} />
                  <h4 style={{ fontWeight: '700', color: 'var(--accent-amber)' }}>Safety Gate: Confirmation Required</h4>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>{pendingConfirmation.message}</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '16px' }}>
                  Tool: <code style={{ color: 'var(--accent-cyan)' }}>{pendingConfirmation.tool_name}</code>
                  {' '}· Tier: <span style={{ color: 'var(--accent-amber)' }}>{pendingConfirmation.tier}</span>
                  <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: 'var(--text-faint)', marginTop: 8 }}>{JSON.stringify(pendingConfirmation.args || {}, null, 2)}</pre>
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => handleConfirmTool(true)} style={{
                    padding: '8px 20px', borderRadius: 'var(--radius-sm)',
                    background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)',
                    color: 'var(--accent-green)', fontWeight: '600', fontSize: '13px',
                  }}>✓ Approve & Execute</button>
                  <button onClick={() => handleConfirmTool(false)} style={{
                    padding: '8px 20px', borderRadius: 'var(--radius-sm)',
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                    color: 'var(--accent-red)', fontWeight: '600', fontSize: '13px',
                  }}>✕ Reject Operation</button>
                </div>
              </div>
            )}

            {requestError && <p role="alert" style={{ color: 'var(--accent-red)', fontSize: 13, margin: 0 }}>{requestError}</p>}

            {/* Execution log */}
            <details style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
              <summary style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13, listStyle: 'none' }}>
                <Activity size={15} /> Execution details ({stages.length} stages)
              </summary>
              <div style={{ paddingTop: 12 }}>
              {stages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-faint)', fontSize: '13px' }}>
                  No execution running. Submit a prompt below to observe the 14-stage pipeline.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {stages.map((st, i) => (
                    <div key={i} style={{
                      padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                      background: stageBadgeColor(st.stage),
                      border: `1px solid ${stageBorderColor(st.stage)}`,
                      fontSize: '12px', fontFamily: 'monospace',
                      display: 'flex', gap: '10px', alignItems: 'flex-start',
                    }}>
                      <span>{React.createElement(STAGE_ICONS[st.stage] || Circle, { size: 14 })}</span>
                      <span style={{ color: 'var(--accent)', fontWeight: '600' }}>[{st.stage}]</span>
                      <span style={{ color: 'var(--text-muted)', flex: 1, wordBreak: 'break-all', fontSize: '11px' }}>
                        {st.message || st.token || JSON.stringify(st).slice(0, 120)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              </div>
            </details>
          </div>

          {/* Prompt input */}
          <div style={{ padding: '12px 28px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
            <form onSubmit={handleSendPrompt} style={{ display: 'flex', gap: '10px' }}>
              <input data-ai-prompt type="text" maxLength={4000}
                placeholder="Ask a question or get help studying…"
                value={prompt} onChange={e => setPrompt(e.target.value)}
                disabled={isProcessing}
                style={{ flex: 1, padding: '12px 16px', fontSize: '14px', borderRadius: 'var(--radius-md)', opacity: isProcessing ? 0.6 : 1 }}
              />
              {isProcessing ? (
                <button type="button" onClick={handleCancel} style={{
                  padding: '12px 20px', borderRadius: 'var(--radius-md)',
                  background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                  color: 'var(--accent-red)', fontWeight: '600', fontSize: '14px',
                }}>Cancel</button>
              ) : (
                <button type="submit" disabled={!activeConvId} style={{
                  padding: '12px 28px', borderRadius: 'var(--radius-md)',
                  background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                  color: 'white', border: 'none', fontWeight: '600', fontSize: '14px',
                  boxShadow: '0 0 16px rgba(139,92,246,0.3)',
                  opacity: !activeConvId ? 0.5 : 1,
                }}>Run →</button>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
