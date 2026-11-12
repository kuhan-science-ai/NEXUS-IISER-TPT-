import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, BookOpen, Clock3, Download, FileText, Search, Trash2, X } from 'lucide-react';
import { api, UserSummary } from '../services/api';
import { SideNav } from '../components/SideNav';
import { TopHeader } from '../components/TopHeader';
import { GlobalSearchModal } from '../components/GlobalSearchModal';
import { UploadResourceModal } from '../components/UploadResourceModal';
import { AcademicResourceMetadataModal, StagedAcademicResource } from '../components/AcademicResourceMetadataModal';

interface RepositoryPageProps { currentUser: UserSummary | null; onLogout?: () => void; }
type RepositoryTab = 'discover' | 'saved' | 'my' | 'recent';
type Resource = { id: string; title: string; subject_code: string; publisher_name: string; uploader_name: string; uploader_id: string; pages: number; size_bytes: number; download_count: number; created_at: string; is_saved: boolean; original_filename: string };
const tabs: Array<{ id: RepositoryTab; label: string }> = [{ id: 'discover', label: 'Discover' }, { id: 'saved', label: 'Saved resources' }, { id: 'my', label: 'My uploads' }, { id: 'recent', label: 'Recently viewed' }];
const flashStart = 1.35;
const flashEnd = 2.1;
const whiteFrameStart = 49 / 36;
const whiteFrameEnd = 71 / 36;
const fileSize = (size: number) => size >= 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(2)} MB` : `${(size / 1024).toFixed(1)} KB`;

export const RepositoryPage: React.FC<RepositoryPageProps> = ({ currentUser, onLogout }) => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const requestedResourceId = searchParams.get('resourceId');
  const [activeTab, setActiveTab] = useState<RepositoryTab>('discover');
  const [resources, setResources] = useState<Resource[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'downloads'>('recent');
  const [searchOpen, setSearchOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [staged, setStaged] = useState<StagedAcademicResource | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [clearPromptOpen, setClearPromptOpen] = useState(false);
  const [clearAnimationPlaying, setClearAnimationPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const flashRef = useRef<HTMLSpanElement>(null);
  const clearedAtFlash = useRef(false);

  useEffect(() => {
    const pending = (location.state as { stagedAcademicResource?: StagedAcademicResource } | null)?.stagedAcademicResource;
    if (!pending) return;
    setStaged(pending);
    navigate('/repository', { replace: true, state: null });
  }, [location.state, navigate]);

  const refresh = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true); setLoadError('');
    try {
      const next = activeTab === 'saved' ? await api.listSavedResources()
        : activeTab === 'my' ? await api.listMyResources()
          : activeTab === 'recent' ? await api.listRecentResources()
            : await api.listResources();
      setResources(Array.isArray(next) ? next : []);
    } catch (error) { setLoadError(error instanceof Error ? error.message : 'Could not load repository resources.'); setResources([]); }
    finally { setLoading(false); }
  }, [activeTab, currentUser?.id]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!clearAnimationPlaying) return;
    const video = videoRef.current;
    clearedAtFlash.current = false;
    if (flashRef.current) { flashRef.current.style.display = 'none'; flashRef.current.style.opacity = '0'; }
    const clearAtFlash = () => {
      if (clearedAtFlash.current) return;
      clearedAtFlash.current = true;
      void api.clearRecentResources().then(() => setResources([])).catch(error => setLoadError(error instanceof Error ? error.message : 'Could not clear recently viewed resources.'));
    };
    if (!video) { clearAtFlash(); setClearAnimationPlaying(false); return; }
    let stopped = false;
    let frame = 0;
    video.currentTime = 0; video.style.visibility = 'visible';
    const sync = () => {
      if (stopped) return;
      const time = video.currentTime;
      const active = time >= flashStart && time < flashEnd;
      if (flashRef.current) {
        flashRef.current.style.display = active ? 'block' : 'none';
        if (active) flashRef.current.style.opacity = String(Math.pow(1 - Math.min(1, Math.max(0, (time - flashStart) / (flashEnd - flashStart))), 1.3));
      }
      video.style.visibility = time >= whiteFrameStart && time < whiteFrameEnd ? 'hidden' : 'visible';
      if (time >= flashStart) clearAtFlash();
      if (!video.ended) frame = window.requestAnimationFrame(sync);
    };
    frame = window.requestAnimationFrame(sync);
    void video.play().catch(() => { clearAtFlash(); if (flashRef.current) flashRef.current.style.display = 'none'; setClearAnimationPlaying(false); });
    return () => { stopped = true; window.cancelAnimationFrame(frame); video.pause(); video.style.visibility = 'visible'; };
  }, [clearAnimationPlaying]);

  const toggleSave = async (resource: Resource) => {
    setWorkingId(resource.id);
    try {
      if (resource.is_saved) await api.unsaveResource(resource.id); else await api.saveResource(resource.id);
      await refresh();
    } catch (error) { setLoadError(error instanceof Error ? error.message : 'Could not update saved resources.'); }
    finally { setWorkingId(null); }
  };

  const download = async (resource: Resource) => {
    setWorkingId(resource.id);
    try {
      const blob = await api.downloadResource(resource.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = resource.original_filename || `${resource.title}.pdf`; link.click(); URL.revokeObjectURL(url);
      await refresh();
    } catch (error) { setLoadError(error instanceof Error ? error.message : 'Could not download this resource.'); }
    finally { setWorkingId(null); }
  };

  const removeResource = async (resource: Resource) => {
    if (!window.confirm(`Delete “${resource.title}” from the repository for everyone? This also removes its saved and recently viewed entries.`)) return;
    setWorkingId(resource.id);
    try { await api.deleteResource(resource.id); await refresh(); }
    catch (error) { setLoadError(error instanceof Error ? error.message : 'Could not delete this resource.'); }
    finally { setWorkingId(null); }
  };

  const visibleResources = useMemo(() => {
    const term = searchQuery.trim().toLocaleLowerCase();
    return resources.filter(resource => !term || [resource.title, resource.subject_code, resource.publisher_name, resource.uploader_name].some(value => value?.toLocaleLowerCase().includes(term)))
      .sort((a, b) => sortBy === 'downloads' ? b.download_count - a.download_count : Date.parse(b.created_at) - Date.parse(a.created_at));
  }, [resources, searchQuery, sortBy]);

  if (!currentUser) return null;
  return <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-canvas)' }}>
    <SideNav currentUser={currentUser} onLogout={onLogout} onOpenSearch={() => setSearchOpen(true)} />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <TopHeader breadcrumb="Workspace / Academic Repository" currentUser={currentUser} onOpenSearch={() => setSearchOpen(true)} onOpenUpload={() => setUploadOpen(true)} />
      <main style={{ flex: 1, padding: 24, width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
          <div><h1 style={{ margin: 0, fontSize: 28, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-.5px' }}>Academic Repository</h1><p style={{ margin: '5px 0 0', fontSize: 14, color: 'var(--text-muted)' }}>Share and discover academic resources.</p></div>
          <button type="button" onClick={() => setUploadOpen(true)} style={{ background: 'var(--primary)', color: '#fff', padding: '10px 20px', borderRadius: 'var(--radius-sm)', fontWeight: 650, fontSize: 13, boxShadow: 'var(--shadow-sm)' }}>↑ Upload resource</button>
        </header>
        <nav role="tablist" aria-label="Repository sections" style={{ display: 'flex', gap: 22, overflowX: 'auto', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
          {tabs.map(tab => <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} style={{ flex: 'none', padding: '0 0 11px', border: 0, borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent', background: 'transparent', color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: activeTab === tab.id ? 650 : 500, cursor: 'pointer' }}>{tab.label}{tab.id === 'saved' || tab.id === 'my' ? ` · ${resources.length}` : ''}</button>)}
        </nav>
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ display: 'flex', flex: '1 1 260px', alignItems: 'center', gap: 9, height: 40, padding: '0 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', color: 'var(--text-muted)' }}><Search size={15} /><input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Search title, subject code, or publisher" aria-label="Search resources" style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', color: 'var(--text-primary)' }} /></label>
            <select value={sortBy} onChange={event => setSortBy(event.target.value as 'recent' | 'downloads')} aria-label="Sort resources" style={{ height: 40 }}><option value="recent">Recently added</option><option value="downloads">Most downloaded</option></select>
            {activeTab === 'recent' && resources.length > 0 && <button type="button" onClick={() => setClearPromptOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', color: 'var(--text-muted)', cursor: 'pointer' }}><Trash2 size={14} /> Delete history</button>}
          </div>
          {requestedResourceId && <aside style={{ padding: 13, border: '1px solid var(--primary)', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', color: 'var(--text-muted)', fontSize: 12 }}>Requested resource: {resources.find(resource => resource.id === requestedResourceId)?.title || 'It may be in another repository section.'}</aside>}
          {loadError && <p role="alert" style={{ margin: 0, color: 'var(--danger, #e56b6b)', fontSize: 13 }}>{loadError}</p>}
          {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading resources…</div> : visibleResources.length ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,420px),1fr))', gap: 12 }}>
            {visibleResources.map(resource => <article key={resource.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 13, padding: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', minWidth: 0 }}>
              <span style={{ display: 'grid', placeItems: 'center', flex: 'none', width: 42, height: 42, borderRadius: 9, background: 'var(--primary-glow)', color: 'var(--primary)' }}><FileText size={19} /></span>
              <div style={{ flex: 1, minWidth: 0 }}><strong style={{ display: 'block', overflowWrap: 'anywhere', color: 'var(--text-primary)', fontSize: 14 }}>{resource.title}</strong><p style={{ margin: '5px 0', color: 'var(--text-muted)', fontSize: 12 }}>{resource.subject_code} · {resource.publisher_name}</p><div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', color: 'var(--text-subtle)', fontSize: 11 }}><span><BookOpen size={12} style={{ verticalAlign: '-2px' }} /> {resource.pages} pages</span><span>{fileSize(resource.size_bytes)}</span><span><Download size={12} style={{ verticalAlign: '-2px' }} /> {resource.download_count} downloads</span><span><Clock3 size={12} style={{ verticalAlign: '-2px' }} /> {new Date(resource.created_at).toLocaleDateString()}</span></div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}><button type="button" disabled={workingId === resource.id} onClick={() => void toggleSave(resource)} style={{ height: 32, padding: '0 11px', border: '1px solid var(--border)', borderRadius: 7, background: resource.is_saved ? 'var(--primary-glow)' : 'var(--bg-surface)', color: resource.is_saved ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', fontSize: 11 }}>{resource.is_saved ? 'Saved ✓' : 'Save'}</button><button type="button" disabled={workingId === resource.id} onClick={() => void download(resource)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 11px', border: 0, borderRadius: 7, background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontSize: 11 }}><Download size={13} />{workingId === resource.id ? 'Please wait…' : 'Download PDF'}</button>{resource.uploader_id === currentUser.id && <button type="button" disabled={workingId === resource.id} onClick={() => void removeResource(resource)} aria-label={`Delete ${resource.title}`} title="Delete this resource for everyone" style={{ display: 'grid', placeItems: 'center', width: 32, height: 32, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--bg-surface)', color: 'var(--danger, #d85c63)', cursor: 'pointer' }}><Trash2 size={14} /></button>}</div>
              </div>
            </article>)}
          </div> : <div style={{ display: 'grid', justifyItems: 'center', gap: 9, padding: '48px 18px', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', textAlign: 'center' }}><BookOpen size={22} /><strong style={{ color: 'var(--text-primary)', fontSize: 14 }}>{searchQuery ? 'No matching resources' : activeTab === 'discover' ? 'No resources yet' : activeTab === 'saved' ? 'No saved resources yet' : activeTab === 'my' ? 'You haven’t uploaded any resources' : 'No recently viewed resources'}</strong><span style={{ fontSize: 12 }}>{activeTab === 'discover' && !searchQuery ? 'Upload the first PDF to start the academic repository.' : 'Resources will appear here when available.'}</span></div>}
        </section>
      </main>
    </div>
    <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    <UploadResourceModal isOpen={uploadOpen} onClose={() => setUploadOpen(false)} currentUserId={currentUser.id} onStage={(file, pages) => setStaged({ file, pages })} />
    {staged && <AcademicResourceMetadataModal staged={staged} user={currentUser} onClose={() => setStaged(null)} onUploaded={() => { setStaged(null); setActiveTab('my'); void refresh(); }} />}
    {clearPromptOpen && <div className="history-clear-anchor" style={{ position: 'fixed', zIndex: 10003, inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(4,6,10,.48)' }}><section className="history-clear-warning" aria-label="Flashing animation confirmation" style={{ width: 'min(380px, calc(100vw - 32px))' }}><div className="history-clear-warning-title"><AlertTriangle size={15} /><strong>This animation contains bright flashes</strong><button type="button" className="history-clear-dismiss" onClick={() => setClearPromptOpen(false)} aria-label="Dismiss confirmation"><X size={14} /></button></div><p>Would you like to play it before clearing all history?</p><div className="history-clear-warning-actions"><button type="button" className="history-clear-choice" onClick={() => { setClearPromptOpen(false); void api.clearRecentResources().then(() => setResources([])).catch(error => setLoadError(error instanceof Error ? error.message : 'Could not clear recently viewed resources.')); }}>Clear without animation</button><button type="button" className="history-clear-choice primary" onClick={() => { setClearPromptOpen(false); setClearAnimationPlaying(true); }}>Play animation</button></div></section></div>}
    {clearAnimationPlaying && <div className="history-clear-animation" role="status" aria-label="Clearing recently viewed resources"><video ref={videoRef} src="/nuke-history-clear.webm" muted playsInline preload="auto" onEnded={() => { if (!clearedAtFlash.current) void api.clearRecentResources().then(() => setResources([])); if (flashRef.current) flashRef.current.style.display = 'none'; setClearAnimationPlaying(false); }} onError={() => { if (!clearedAtFlash.current) void api.clearRecentResources().then(() => setResources([])); setClearAnimationPlaying(false); }} /><span ref={flashRef} className="history-clear-white-flash" aria-hidden="true" /><span className="history-clear-sr-only">Recently viewed resources clear at the white flash.</span></div>}
  </div>;
};
