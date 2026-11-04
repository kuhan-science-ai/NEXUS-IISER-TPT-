import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Crosshair, X, Send, Check, Ban, Move, ScanLine, Sparkles, ArrowRight } from 'lucide-react';
import { api, UserSummary } from '../services/api';
import { MathRenderer } from './MathRenderer';

type ChatLine = { role: 'user' | 'assistant'; content: string; status?: string };
const AI_LAUNCHER_POSITION_KEY = 'nexus-ai-launcher-position-v1';
const AI_LAUNCHER_DOCK_KEY = 'nexus-ai-launcher-dock-v1';

function readLauncherPosition(): { left: number; top: number } | null {
  try {
    const value = JSON.parse(localStorage.getItem(AI_LAUNCHER_POSITION_KEY) || 'null');
    if (!value || !Number.isFinite(value.left) || !Number.isFinite(value.top)) return null;
    return { left: Math.max(15, Math.min(window.innerWidth - 57, value.left)), top: Math.max(12, Math.min(window.innerHeight - 54, value.top)) };
  } catch { return null; }
}

function readLauncherDock(): 'left' | 'right' {
  try { return localStorage.getItem(AI_LAUNCHER_DOCK_KEY) === 'right' ? 'right' : 'left'; }
  catch { return 'left'; }
}

/** Small, route-persistent assistant. Conversation state is in memory and the existing AI API. */
export const AIQuickPanel: React.FC<{ currentUser: UserSummary | null }> = ({ currentUser }) => {
  const [open, setOpen] = useState(false);
  const [pointMode, setPointMode] = useState(false);
  const [pointedText, setPointedText] = useState('');
  const [annotationMode, setAnnotationMode] = useState(false);
  const [annotationText, setAnnotationText] = useState('');
  const [annotationRect, setAnnotationRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [panelPosition, setPanelPosition] = useState<{ left: number; top: number } | null>(null);
  const [launcherPosition, setLauncherPosition] = useState<{ left: number; top: number } | null>(readLauncherPosition);
  const [launcherDock, setLauncherDock] = useState<'left' | 'right'>(readLauncherDock);
  const [launcherIsDragging, setLauncherIsDragging] = useState(false);
  const [input, setInput] = useState('');
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<any>(null);
  const [error, setError] = useState('');
  const [assistantName, setAssistantName] = useState(() => {
    try { return (localStorage.getItem('nexus-ai-name') || 'NEXUS').slice(0, 10); } catch { return 'NEXUS'; }
  });
  const launcherDisplayName = assistantName.toUpperCase().endsWith(' AI') ? assistantName : `${assistantName} AI`;
  const convId = useRef<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerX: number; pointerY: number; left: number; top: number; width: number; height: number } | null>(null);
  const annotationStart = useRef<{ x: number; y: number } | null>(null);
  const launcherDragging = useRef(false);
  const launcherWasDragged = useRef(false);

  const toggle = useCallback(() => { setOpen(value => !value); setPointMode(false); }, []);
  useEffect(() => {
    const updateName = (event?: Event) => {
      const detail = (event as CustomEvent<{ name?: string }> | undefined)?.detail?.name;
      try { setAssistantName((detail || localStorage.getItem('nexus-ai-name') || 'NEXUS').trim().slice(0, 10) || 'NEXUS'); }
      catch { setAssistantName(detail?.trim().slice(0, 10) || 'NEXUS'); }
    };
    window.addEventListener('nexus-ai-name-updated', updateName);
    window.addEventListener('storage', updateName);
    return () => { window.removeEventListener('nexus-ai-name-updated', updateName); window.removeEventListener('storage', updateName); };
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        toggle();
      }
      if (event.key === 'Escape') { setOpen(false); setPointMode(false); setAnnotationMode(false); setAnnotationRect(null); annotationStart.current = null; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  useEffect(() => {
    const handleDeleted = (event: Event) => {
      const ids = (event as CustomEvent<{ ids?: string[] }>).detail?.ids || [];
      if (convId.current && ids.includes(convId.current)) {
        convId.current = null;
        setLines([]); setPending(null); setError('');
      }
    };
    window.addEventListener('nexus-ai-conversations-deleted', handleDeleted);
    return () => window.removeEventListener('nexus-ai-conversations-deleted', handleDeleted);
  }, []);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      if (launcherDragging.current && !launcherWasDragged.current && (Math.abs(event.clientX - drag.pointerX) > 4 || Math.abs(event.clientY - drag.pointerY) > 4)) {
        launcherWasDragged.current = true;
        setLauncherIsDragging(true);
      }
      const nextPosition = {
        left: Math.max(0, Math.min(window.innerWidth - drag.width, drag.left + event.clientX - drag.pointerX)),
        top: Math.max(0, Math.min(window.innerHeight - drag.height, drag.top + event.clientY - drag.pointerY)),
      };
      if (launcherDragging.current) setLauncherPosition(nextPosition);
      else setPanelPosition(nextPosition);
    };
    const end = () => {
      if (launcherDragging.current && launcherWasDragged.current) {
        const launcher = document.querySelector<HTMLElement>('.nexus-ai-launcher');
        const rect = launcher?.getBoundingClientRect();
        if (rect) {
          const dock = rect.left + rect.width / 2 < window.innerWidth / 2 ? 'left' : 'right';
          const left = dock === 'left' ? 15 : Math.max(15, window.innerWidth - 57);
          const top = Math.max(12, Math.min(window.innerHeight - 54, rect.top));
          setLauncherDock(dock);
          setLauncherPosition({ left, top });
          try {
            localStorage.setItem(AI_LAUNCHER_POSITION_KEY, JSON.stringify({ left, top }));
            localStorage.setItem(AI_LAUNCHER_DOCK_KEY, dock);
          } catch { /* keep the launcher movable when storage is unavailable */ }
        }
      }
      dragRef.current = null;
      launcherDragging.current = false;
      setLauncherIsDragging(false);
    };
    const resize = () => {
      setPanelPosition(position => {
        if (!position) return null;
        const panel = document.querySelector('[data-nexus-ai-panel]') as HTMLElement | null;
        const rect = panel?.getBoundingClientRect();
        if (!rect) return position;
        return { left: Math.max(0, Math.min(window.innerWidth - rect.width, position.left)), top: Math.max(0, Math.min(window.innerHeight - rect.height, position.top)) };
      });
      setLauncherPosition(position => {
        if (!position) return null;
        const next = {
          left: launcherDock === 'right' ? Math.max(15, window.innerWidth - 57) : Math.max(15, Math.min(window.innerWidth - 57, position.left)),
          top: Math.max(12, Math.min(window.innerHeight - 54, position.top)),
        };
        try { localStorage.setItem(AI_LAUNCHER_POSITION_KEY, JSON.stringify(next)); } catch { /* storage may be unavailable */ }
        return next;
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); window.removeEventListener('resize', resize); };
  }, [launcherDock]);

  useEffect(() => {
    if (!open) return;
    let frame = 0;
    const clampPanel = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const panel = document.querySelector<HTMLElement>('[data-nexus-ai-panel] > section');
        if (!panel) return;
        const bounds = panel.getBoundingClientRect();
        const left = Math.max(8, Math.min(window.innerWidth - bounds.width - 8, bounds.left));
        const top = Math.max(8, Math.min(window.innerHeight - bounds.height - 8, bounds.top));
        if (Math.abs(left - bounds.left) > 1 || Math.abs(top - bounds.top) > 1) setPanelPosition({ left, top });
      });
    };
    clampPanel();
    window.addEventListener('resize', clampPanel);
    const panel = document.querySelector<HTMLElement>('[data-nexus-ai-panel] > section');
    const observer = panel && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(clampPanel) : null;
    if (panel && observer) observer.observe(panel);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', clampPanel);
      observer?.disconnect();
    };
  }, [open]);

  useEffect(() => {
    if (!pointMode) return;
    const onPoint = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || target.closest('[data-nexus-ai-panel]')) return;
      event.preventDefault();
      event.stopPropagation();
      const text = (target.innerText || target.getAttribute('aria-label') || target.getAttribute('title') || target.tagName).trim().slice(0, 2500);
      const parentText = (target.parentElement?.innerText || '').trim().slice(0, 3500);
      setAnnotationText('');
      setPointedText([`Selected page element: ${text}`, parentText && parentText !== text ? `Nearby content: ${parentText}` : ''].filter(Boolean).join('\n'));
      setPointMode(false);
      setOpen(true);
    };
    document.addEventListener('click', onPoint, true);
    return () => document.removeEventListener('click', onPoint, true);
  }, [pointMode]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [lines, busy]);

  const pageContext = () => ({
    path: window.location.pathname + window.location.search,
    title: document.title,
    selected_text: window.getSelection()?.toString().slice(0, 2500) || '',
    pointed_element: pointedText.slice(0, 2500),
    annotated_region: annotationText.slice(0, 4000),
    visible_page_text: (document.querySelector('main')?.innerText || document.body.innerText).slice(0, 7000),
  });

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const prompt = input.trim();
    if (!prompt || busy || !currentUser) return;
    setInput(''); setError(''); setBusy(true);
    setLines(prev => [...prev, { role: 'user', content: prompt }, { role: 'assistant', content: '' }]);
    try {
      if (!convId.current) {
        const conversation = await api.createAIConversation('Quick assistant · ' + new Date().toLocaleString());
        convId.current = conversation.id;
      }
      const response = await fetch(`/api/v1/ai/conversations/${convId.current}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api.getToken()}` },
        body: JSON.stringify({ prompt, page_context: pageContext() }),
      });
      if (!response.ok) throw new Error(`Assistant request failed (${response.status})`);
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Streaming is unavailable in this browser.');
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n'); buffer = events.pop() || '';
        for (const raw of events) {
          const dataLine = raw.split('\n').find(line => line.startsWith('data: '));
          if (!dataLine) continue;
          const data = JSON.parse(dataLine.slice(6));
          if (data.stage === 'stream_response' && data.token) {
            setLines(prev => prev.map((line, index) => index === prev.length - 1 ? { ...line, status: undefined, content: line.content + data.token } : line));
          }
          if (data.stage === 'accepted') setLines(prev => prev.map((line, index) => index === prev.length - 1 ? { ...line, status: data.message } : line));
          if (data.stage === 'permission_check' && data.requires_confirmation) setPending(data);
          if (data.stage === 'error') {
            const message = data.message || 'The assistant encountered an error.';
            setError(message);
            setLines(prev => prev.map((line, index) => index === prev.length - 1 && !line.content ? { ...line, status: message } : line));
          }
        }
      }
    } catch (err: any) {
      const message = err.message || 'The assistant could not complete the request.';
      setError(message);
      setLines(prev => prev.map((line, index) => index === prev.length - 1 && !line.content ? { ...line, status: message } : line));
    } finally { setBusy(false); setPointedText(''); setAnnotationText(''); setAnnotationRect(null); }
  };

  const confirm = async (approved: boolean) => {
    if (!pending || !convId.current) return;
    try {
      const result = await api.confirmAITool(convId.current, pending.execution_id, approved);
      if (approved) window.dispatchEvent(new CustomEvent('nexus-ai-action-completed', { detail: { tool_name: pending.tool_name, tool_result: result.tool_result } }));
      setLines(prev => [...prev, { role: 'assistant', content: result.status === 'executed' ? `Done: ${JSON.stringify(result.tool_result)}` : 'I cancelled that change.' }]);
    } catch (err: any) { setError(err.message || 'Could not confirm this action.'); }
    finally { setPending(null); }
  };

  if (!currentUser) return null;
  const buttonStyle: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '7px 9px', color: 'var(--text-secondary)', background: 'var(--bg-elevated)', cursor: 'pointer' };

  const beginDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
    const section = (event.currentTarget as HTMLElement).closest('section');
    const rect = section?.getBoundingClientRect() || event.currentTarget.getBoundingClientRect();
    setPanelPosition({ left: rect.left, top: rect.top });
    launcherDragging.current = false;
    dragRef.current = { pointerX: event.clientX, pointerY: event.clientY, left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  };

  const beginLauncherDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const left = launcherDock === 'right' ? rect.right - 42 : rect.left;
    setLauncherPosition({ left, top: rect.top });
    launcherDragging.current = true;
    launcherWasDragged.current = false;
    dragRef.current = { pointerX: event.clientX, pointerY: event.clientY, left, top: rect.top, width: 42, height: 42 };
  };

  const finishAnnotation = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!annotationStart.current) return;
    const start = annotationStart.current;
    const end = { x: event.clientX, y: event.clientY };
    const rect = { left: Math.min(start.x, end.x), top: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) };
    setAnnotationRect(rect);
    annotationStart.current = null;
    const x2 = rect.left + Math.max(rect.width, 8), y2 = rect.top + Math.max(rect.height, 8);
    const selected: string[] = [];
    const pageRoot = document.querySelector('main') || document.body;
    const elements = pageRoot.querySelectorAll('*');
    elements.forEach(element => {
      const el = element as HTMLElement;
      if (el.closest('[data-nexus-ai-panel]')) return;
      const bounds = el.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0 || bounds.right < rect.left || bounds.left > x2 || bounds.bottom < rect.top || bounds.top > y2) return;
      const directText = Array.from(el.childNodes).filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent || '').join(' ').trim();
      const label = directText || el.getAttribute('aria-label') || el.getAttribute('title') || '';
      if (label && !selected.includes(label)) selected.push(label);
    });
    if (rect.width < 5 && rect.height < 5) {
      const target = document.elementFromPoint(end.x, end.y) as HTMLElement | null;
      if (target) selected.unshift((target.innerText || target.getAttribute('aria-label') || target.tagName).trim().slice(0, 1000));
    }
    const text = selected.join(' ').replace(/\s+/g, ' ').slice(0, 3500);
    setAnnotationText(`Marked region on ${window.location.pathname} at x=${Math.round(rect.left)}, y=${Math.round(rect.top)}, w=${Math.round(rect.width)}, h=${Math.round(rect.height)}. Visible text: ${text || 'No selectable text was found in the marked region.'}`);
    setAnnotationMode(false);
    setOpen(true);
  };

  return <div data-nexus-ai-panel style={{ position: 'fixed', zIndex: 1200, ...(open ? (panelPosition || { right: 20, bottom: 20 }) : launcherPosition ? (launcherDock === 'right' ? { right: window.innerWidth - launcherPosition.left - 42, top: launcherPosition.top } : { left: launcherPosition.left, top: launcherPosition.top }) : { left: 15, bottom: 62 }), fontFamily: 'inherit' }}>
    {annotationMode && <div
      onPointerDown={event => { annotationStart.current = { x: event.clientX, y: event.clientY }; setAnnotationRect({ left: event.clientX, top: event.clientY, width: 0, height: 0 }); event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={event => { if (!annotationStart.current) return; const start = annotationStart.current; setAnnotationRect({ left: Math.min(start.x, event.clientX), top: Math.min(start.y, event.clientY), width: Math.abs(event.clientX - start.x), height: Math.abs(event.clientY - start.y) }); }}
      onPointerUp={finishAnnotation}
      style={{ position: 'fixed', inset: 0, zIndex: 1300, cursor: 'crosshair', touchAction: 'none', background: 'rgba(10,12,20,.08)' }}
    >
      <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', width: 'max-content', maxWidth: 'calc(100vw - 24px)', boxSizing: 'border-box', padding: '9px 13px', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: '0 6px 22px rgba(0,0,0,.25)', fontSize: 12, textAlign: 'center', pointerEvents: 'none' }}>Drag around the page content you want to ask about · Esc to cancel</div>
      {annotationRect && <div style={{ position: 'fixed', left: annotationRect.left, top: annotationRect.top, width: annotationRect.width, height: annotationRect.height, border: '2px solid #8b5cf6', background: 'rgba(139,92,246,.12)', pointerEvents: 'none' }} />}
    </div>}
    {!open ? <button type="button" data-dragging={launcherIsDragging ? 'true' : undefined} className="nexus-ai-launcher" onPointerDown={beginLauncherDrag} onClick={event => {
      if (launcherWasDragged.current) { launcherWasDragged.current = false; return; }
      const bounds = event.currentTarget.getBoundingClientRect();
      const panelHeight = Math.min(560, window.innerHeight - 90);
      const top = Math.max(12, Math.min(window.innerHeight - panelHeight - 16, bounds.top - panelHeight - 12));
      setPanelPosition({ left: Math.max(12, Math.min(window.innerWidth - 402, bounds.left)), top });
      setOpen(true);
    }} title={`Drag to move · Click or press Alt+A to ask ${launcherDisplayName}`} aria-label={`Ask ${launcherDisplayName}`} style={{ ...buttonStyle, width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, borderRadius: '50%', color: '#f7f5ff', cursor: 'grab', touchAction: 'none' }}><Sparkles className="nexus-ai-launcher-icon" size={18} /><span className="nexus-ai-launcher-label">Ask {launcherDisplayName}<ArrowRight size={14} /></span><kbd className="nexus-ai-launcher-shortcut">Alt+A</kbd></button> :
      <section className="nexus-ai-panel" style={{ width: 'min(390px, calc(100vw - 28px))', height: 'min(560px, calc(100dvh - 32px))', maxHeight: 'calc(100dvh - 32px)', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}>
        <header onPointerDown={beginDrag} title="Drag to move the assistant" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 12px', borderBottom: '1px solid var(--border)', cursor: 'move', touchAction: 'none', userSelect: 'none' }}><Move size={14} color="var(--text-faint)" /><Sparkles size={17} /><strong style={{ flex: 1 }}>{assistantName}</strong><span className="nexus-ai-beta">(Beta)</span><button onClick={() => { setPointMode(true); setAnnotationMode(false); setAnnotationText(''); }} title="Point to page content" style={{ ...buttonStyle, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Crosshair size={14} /> Point</button><button onClick={() => { setOpen(false); setAnnotationMode(true); setPointMode(false); setPointedText(''); setAnnotationRect(null); }} title="Mark a region to ask about" style={{ ...buttonStyle, display: 'inline-flex', alignItems: 'center', gap: 5 }}><ScanLine size={14} /> Annotate</button><button onClick={() => setOpen(false)} aria-label="Close assistant" style={buttonStyle}><X size={15} /></button></header>
        {pointMode && <div style={{ padding: '8px 14px', background: 'rgba(139,92,246,.12)', fontSize: 12 }}>Click any page content to give it to the assistant.</div>}
        <div style={{ flex: 1, overflowY: 'auto', padding: 13, display: 'flex', flexDirection: 'column', gap: 9 }}>
          {!lines.length && <p style={{ color: 'var(--text-faint)', fontSize: 13, lineHeight: 1.55 }}>Ask about this page or request a supported change, such as adding a calendar event. Changes require your approval.</p>}
          {pointedText && <div style={{ fontSize: 11, color: 'var(--text-faint)', padding: 8, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>{pointedText.slice(0, 260)}</div>}
          {annotationText && <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 11, color: 'var(--text-faint)', padding: 8, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}><ScanLine size={14} /><span style={{ flex: 1 }}>{annotationText.slice(0, 320)}</span><button onClick={() => setAnnotationText('')} aria-label="Remove annotation" style={{ ...buttonStyle, padding: 2 }}><X size={12} /></button></div>}
          {lines.map((line, index) => <div key={index} style={{ alignSelf: line.role === 'user' ? 'flex-end' : 'stretch', maxWidth: line.role === 'user' ? '88%' : '100%', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', padding: '9px 11px', borderRadius: 'var(--radius-md)', background: line.role === 'user' ? 'rgba(139,92,246,.15)' : 'var(--bg-elevated)', border: '1px solid var(--border)', fontSize: 13, lineHeight: 1.55 }}>{line.content ? <MathRenderer content={line.content} /> : line.status || (busy && index === lines.length - 1 ? 'Thinking…' : '')}</div>)}
          {pending && <div style={{ padding: 10, borderRadius: 'var(--radius-md)', border: '1px solid rgba(245,158,11,.45)', background: 'rgba(245,158,11,.08)', fontSize: 12 }}><strong>Confirm change</strong><p style={{ margin: '6px 0 10px' }}>{pending.message}<br /><code>{pending.tool_name}</code></p><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: 'var(--text-faint)', fontSize: 10 }}>{JSON.stringify(pending.args || {}, null, 2)}</pre><div style={{ display: 'flex', gap: 8 }}><button onClick={() => void confirm(true)} style={buttonStyle}><Check size={13} /> Approve</button><button onClick={() => void confirm(false)} style={buttonStyle}><Ban size={13} /> Reject</button></div></div>}
          {error && <p role="alert" style={{ color: 'var(--accent-red)', fontSize: 12 }}>{error}</p>}
          <div ref={endRef} />
        </div>
        <form onSubmit={send} style={{ display: 'flex', gap: 7, padding: 10, borderTop: '1px solid var(--border)' }}><input autoFocus maxLength={12000} value={input} onChange={e => setInput(e.target.value)} placeholder="Ask about this page…" disabled={busy} style={{ minWidth: 0, flex: 1, padding: '10px 11px', borderRadius: 'var(--radius-sm)' }} /><button type="submit" disabled={busy || !input.trim()} aria-label="Send" style={{ ...buttonStyle, opacity: busy || !input.trim() ? .55 : 1 }}><Send size={15} /></button></form>
      </section>}
  </div>;
};
