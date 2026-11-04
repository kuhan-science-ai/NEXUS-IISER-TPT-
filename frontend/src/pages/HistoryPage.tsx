import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock3, FileText, History, Trash2, X } from 'lucide-react';
import { UserSummary } from '../services/api';
import { SideNav } from '../components/SideNav';
import { TopHeader } from '../components/TopHeader';
import { GlobalSearchModal } from '../components/GlobalSearchModal';
import { clearDashboardHistory, DashboardHistoryEntry, DASHBOARD_HISTORY_EVENT, HISTORY_PAGE_SIZE, HISTORY_MAX_PAGES, readDashboardHistory, readDashboardSessionHistory } from '../services/dashboard';

interface HistoryPageProps { currentUser: UserSummary | null; onLogout?: () => void; }
type ClearHistoryChoice = 'animation' | 'normal';
interface ClearHistorySessionPreference { choice: ClearHistoryChoice; dontAskAgain: boolean; }
const clearHistoryPreferencePrefix = 'nexus-history-clear-confirmation-v1-';
const clearAnimationFlashStart = 1.35;
const clearAnimationFlashEnd = 2.1;
const clipWhiteFrameStart = 49 / 36;
const clipWhiteFrameEnd = 71 / 36;

const clearHistoryNavigation = typeof performance !== 'undefined' ? performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined : undefined;
if (clearHistoryNavigation?.type === 'reload' && typeof sessionStorage !== 'undefined') {
  try {
    for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = sessionStorage.key(index);
      if (key?.startsWith(clearHistoryPreferencePrefix)) sessionStorage.removeItem(key);
    }
  } catch { /* confirmation will be asked again if session storage is unavailable */ }
}

const clearHistoryPreferenceKey = (userId: string) => `${clearHistoryPreferencePrefix}${userId}`;
const readClearHistoryPreference = (userId: string): ClearHistorySessionPreference | null => {
  try {
    const stored = JSON.parse(sessionStorage.getItem(clearHistoryPreferenceKey(userId)) || 'null');
    return stored && (stored.choice === 'animation' || stored.choice === 'normal')
      ? { choice: stored.choice, dontAskAgain: stored.dontAskAgain === true }
      : null;
  } catch { return null; }
};

export const HistoryPage: React.FC<HistoryPageProps> = ({ currentUser, onLogout }) => {
  const clearAnimationRef = useRef<HTMLVideoElement>(null);
  const clearFlashOverlayRef = useRef<HTMLSpanElement>(null);
  const historyClearedForAnimation = useRef(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scope, setScope] = useState<'session' | 'all'>('session');
  const [entries, setEntries] = useState<DashboardHistoryEntry[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [clearPromptOpen, setClearPromptOpen] = useState(false);
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const [clearPreference, setClearPreference] = useState<ClearHistorySessionPreference | null>(() => readClearHistoryPreference(currentUser?.id || ''));
  const [clearAnimationPlaying, setClearAnimationPlaying] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    const refresh = () => {
      const nextEntries = scope === 'session' ? readDashboardSessionHistory(currentUser.id) : readDashboardHistory(currentUser.id);
      setEntries(nextEntries);
      setCurrentPage(page => Math.min(page, Math.max(1, Math.ceil(nextEntries.length / HISTORY_PAGE_SIZE))));
    };
    refresh();
    window.addEventListener(DASHBOARD_HISTORY_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener(DASHBOARD_HISTORY_EVENT, refresh); window.removeEventListener('storage', refresh); };
  }, [currentUser?.id, scope]);

  useEffect(() => {
    if (!currentUser) return;
    setClearPreference(readClearHistoryPreference(currentUser.id));
  }, [currentUser?.id]);

  useEffect(() => {
    if (!clearAnimationPlaying) return;
    const video = clearAnimationRef.current;
    if (!video) {
      clearDashboardHistory(currentUser!.id);
      setCurrentPage(1);
      setClearAnimationPlaying(false);
      return;
    }
    let stopped = false;
    let animationFrameHandle = 0;
    historyClearedForAnimation.current = false;
    video.currentTime = 0;
    video.style.visibility = 'visible';
    if (clearFlashOverlayRef.current) {
      clearFlashOverlayRef.current.style.display = 'none';
      clearFlashOverlayRef.current.style.opacity = '0';
    }
    const syncToVideoTime = () => {
      if (stopped) return;
      const time = video.currentTime;
      const flashActive = time >= clearAnimationFlashStart && time < clearAnimationFlashEnd;
      if (clearFlashOverlayRef.current) {
        clearFlashOverlayRef.current.style.display = flashActive ? 'block' : 'none';
        if (flashActive) {
          const progress = Math.min(1, Math.max(0, (time - clearAnimationFlashStart) / (clearAnimationFlashEnd - clearAnimationFlashStart)));
          clearFlashOverlayRef.current.style.opacity = String(Math.pow(1 - progress, 1.3));
        }
      }
      video.style.visibility = time >= clipWhiteFrameStart && time < clipWhiteFrameEnd ? 'hidden' : 'visible';
      if (time >= clearAnimationFlashStart) clearHistoryAtFlash();
      if (!video.ended) animationFrameHandle = window.requestAnimationFrame(syncToVideoTime);
    };
    animationFrameHandle = window.requestAnimationFrame(syncToVideoTime);
    void video.play().catch(() => {
      if (!historyClearedForAnimation.current) {
        historyClearedForAnimation.current = true;
        clearDashboardHistory(currentUser!.id);
        setCurrentPage(1);
      }
      if (clearFlashOverlayRef.current) clearFlashOverlayRef.current.style.display = 'none';
      setClearAnimationPlaying(false);
    });
    return () => {
      stopped = true;
      if (animationFrameHandle) window.cancelAnimationFrame(animationFrameHandle);
      video.pause();
      video.style.visibility = 'visible';
    };
  }, [clearAnimationPlaying, currentUser?.id]);

  const clearHistoryAtFlash = () => {
    if (!currentUser || historyClearedForAnimation.current) return;
    historyClearedForAnimation.current = true;
    clearDashboardHistory(currentUser.id);
    setCurrentPage(1);
  };

  const saveClearPreference = (preference: ClearHistorySessionPreference) => {
    setClearPreference(preference);
    try { sessionStorage.setItem(clearHistoryPreferenceKey(currentUser!.id), JSON.stringify(preference)); } catch { /* keep the current page choice in memory */ }
  };

  const executeHistoryClear = (choice: ClearHistoryChoice, rememberForSession = dontAskAgain) => {
    if (!currentUser) return;
    const preference = { choice, dontAskAgain: rememberForSession };
    saveClearPreference(preference);
    setClearPromptOpen(false);
    if (choice === 'normal') {
      historyClearedForAnimation.current = true;
      clearDashboardHistory(currentUser.id);
      setCurrentPage(1);
      return;
    }
    historyClearedForAnimation.current = false;
    setClearAnimationPlaying(true);
  };

  const requestHistoryClear = () => {
    if (clearPreference?.dontAskAgain) {
      executeHistoryClear(clearPreference.choice, true);
      return;
    }
    setDontAskAgain(false);
    setClearPromptOpen(true);
  };

  const resetClearPreference = () => {
    setClearPreference(null);
    try { sessionStorage.removeItem(clearHistoryPreferenceKey(currentUser!.id)); } catch { /* preference will reset when this page reloads */ }
  };

  if (!currentUser) return null;
  const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  const pageCount = Math.max(1, Math.ceil(entries.length / HISTORY_PAGE_SIZE));
  const visibleEntries = entries.slice((currentPage - 1) * HISTORY_PAGE_SIZE, currentPage * HISTORY_PAGE_SIZE);
  const changeScope = (nextScope: 'session' | 'all') => { setScope(nextScope); setCurrentPage(1); };

  return <div className="dashboard-history-layout">
    <SideNav currentUser={currentUser} onLogout={onLogout} onOpenSearch={() => setSearchOpen(true)} />
    <div className="dashboard-history-shell">
      <TopHeader breadcrumb="Workspace / Browsing history" currentUser={currentUser} onOpenSearch={() => setSearchOpen(true)} />
      <main className="dashboard-history-main">
        <section className="dashboard-card dashboard-history-page">
          <header className="dashboard-card-heading"><div><span className="dashboard-eyebrow">YOUR ACTIVITY</span><h1>Browsing history</h1><p>Page visits and resource uploads recorded in this browser.</p></div>{scope === 'all' && entries.length > 0 && <div className="history-clear-anchor"><button type="button" className="dashboard-quiet-button" onClick={requestHistoryClear}><Trash2 size={14} /> Clear history</button>{clearPromptOpen && <section className="history-clear-warning" aria-label="Flashing animation confirmation"><div className="history-clear-warning-title"><AlertTriangle size={15} /><strong>This animation contains bright flashes</strong><button type="button" className="history-clear-dismiss" onClick={() => setClearPromptOpen(false)} aria-label="Dismiss confirmation"><X size={14} /></button></div><p>Would you like to play it before clearing all history?</p><label><input type="checkbox" checked={dontAskAgain} onChange={event => setDontAskAgain(event.target.checked)} /> Don’t ask me again in this session</label><div className="history-clear-warning-actions"><button type="button" className={`history-clear-choice${clearPreference?.choice === 'normal' ? ' selected' : ''}`} onClick={() => executeHistoryClear('normal')}>Clear without animation</button><button type="button" className={`history-clear-choice primary${clearPreference?.choice === 'animation' ? ' selected' : ''}`} onClick={() => executeHistoryClear('animation')}>Play animation</button></div></section>}{!clearPromptOpen && clearPreference?.dontAskAgain && <div className="history-clear-saved-choice"><span>Saved for this session: {clearPreference.choice === 'animation' ? 'play animation' : 'clear normally'}.</span><button type="button" onClick={resetClearPreference}>Ask me again</button></div>}</div>}</header>
          <div className="dashboard-history-tabs" role="tablist" aria-label="History range">
            <button type="button" role="tab" aria-selected={scope === 'session'} className={scope === 'session' ? 'active' : ''} onClick={() => changeScope('session')}>This session</button>
            <button type="button" role="tab" aria-selected={scope === 'all'} className={scope === 'all' ? 'active' : ''} onClick={() => changeScope('all')}>All history</button>
          </div>
          {entries.length ? <>
            <div className={`dashboard-history-list${visibleEntries.length === HISTORY_PAGE_SIZE ? ' fills-viewport' : ''}`}>
            {visibleEntries.map(entry => <Link className="dashboard-history-row" to={entry.path} key={entry.id}>
              <span className="dashboard-history-icon">{entry.kind === 'upload' ? <FileText size={17} /> : <History size={17} />}</span>
              <span className="dashboard-history-info"><strong>{entry.title}</strong><small>{entry.kind === 'upload' ? 'Resource upload' : 'Page visit'}</small></span>
              <span className="dashboard-history-date"><Clock3 size={13} />{formatDate(entry.visitedAt)}</span>
            </Link>)}
            </div>
            {pageCount > 1 && <nav className="dashboard-history-pagination" aria-label="History pages">
              <button type="button" onClick={() => setCurrentPage(page => Math.max(1, page - 1))} disabled={currentPage === 1}>Previous</button>
              <span>Page {currentPage} of {Math.min(pageCount, HISTORY_MAX_PAGES)} · up to {HISTORY_MAX_PAGES} pages</span>
              <button type="button" onClick={() => setCurrentPage(page => Math.min(pageCount, page + 1))} disabled={currentPage >= pageCount}>Next</button>
            </nav>}
            <p className="dashboard-history-retention-note">History is stored in this browser: up to 5 pages of 15 entries (75 total). New visits replace the oldest entries; session history resets when the browser session ends.</p>
          </> : <div className="dashboard-empty"><History size={20} /><p>No activity recorded in {scope === 'session' ? 'this session' : 'all history'} yet.</p></div>}
        </section>
      </main>
      {clearAnimationPlaying && <div className="history-clear-animation" role="status" aria-label="Clearing browsing history">
        <video ref={clearAnimationRef} src="/nuke-history-clear.webm" muted playsInline preload="auto" onEnded={() => { clearHistoryAtFlash(); clearAnimationRef.current?.style.setProperty('visibility', 'visible'); if (clearFlashOverlayRef.current) clearFlashOverlayRef.current.style.display = 'none'; setClearAnimationPlaying(false); }} onError={() => { clearHistoryAtFlash(); clearAnimationRef.current?.style.setProperty('visibility', 'visible'); if (clearFlashOverlayRef.current) clearFlashOverlayRef.current.style.display = 'none'; setClearAnimationPlaying(false); }} />
        <span ref={clearFlashOverlayRef} className="history-clear-white-flash" aria-hidden="true" />
        <span className="history-clear-sr-only">The animation is playing. Browsing history clears at the white flash.</span>
      </div>}
    </div>
    <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
  </div>;
};
