import React, { useEffect, useRef, useState } from 'react';
import { api, UserSummary } from '../services/api';
import { SideNav } from '../components/SideNav';
import { TopHeader } from '../components/TopHeader';
import { GlobalSearchModal } from '../components/GlobalSearchModal';
import { Bell, Palette, ShieldCheck, UserRound, Check, Sparkles, ImagePlus, LayoutDashboard, Trash2, Zap } from 'lucide-react';
import { CustomUiPalette, readCustomUiPalettes, UI_PALETTES, UiPaletteId, writeCustomUiPalettes } from '../services/appearance';
import { analyzePaletteImage, PaletteImageAnalysis } from '../services/paletteImage';
import { DASHBOARD_WIDGETS, DashboardPreferences, DashboardWidgetId, PersonalTimetable, readDashboardPreferences, readPersonalTimetable, savePersonalTimetable, writeDashboardPreferences, readStickyNotePreferences, writeStickyNotePreferences, StickyNotePreferences } from '../services/dashboard';
import { readUserPreference, writeUserPreference } from '../services/userPreferences';

interface SettingsPageProps {
  currentUser: UserSummary | null;
  onLogout?: () => void;
  onProfileUpdated?: () => void | Promise<void>;
  theme: 'dark' | 'light';
  onThemeChange: (theme: 'dark' | 'light') => void;
  uiPalette: UiPaletteId;
  onUiPaletteChange: (palette: UiPaletteId) => void;
  onUiPalettePreview: (palette: CustomUiPalette | null) => void;
}

function readPreference(key: string, userId: string, fallback: boolean): boolean {
  const values = readUserPreference<Record<string, unknown>>('nexus-settings-preferences', userId, {});
  return typeof values[key] === 'boolean' ? values[key] as boolean : fallback;
}

function normalizeProgramme(value: string): string {
  return value.trim().replace(/[–—]/g, '-').toLowerCase() === 'bs-ms' ? 'BS-MS' : value;
}

const DASHBOARD_WIDGET_GROUPS: Record<'core' | 'study' | 'more', DashboardWidgetId[]> = {
  core: ['events', 'clubs', 'question', 'history', 'continue'],
  study: ['timetable', 'exams', 'todo'],
  more: ['messages', 'announcements', 'uploads'],
};

const PROFILE_LAUNCH_EFFECT_KEY = 'nexus-profile-launch-effect';
type ProfileLaunchEffect = 'classic' | 'fireball';

export const SettingsPage: React.FC<SettingsPageProps> = ({ currentUser, onLogout, onProfileUpdated, theme, onThemeChange, uiPalette, onUiPaletteChange, onUiPalettePreview }) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('account');
  const [assistantHasCompleted, setAssistantHasCompleted] = useState(() => readUserPreference('nexus-ai-completed', currentUser?.id || 'guest', false));
  const [appearanceTab, setAppearanceTab] = useState<'interface' | 'theme' | 'effects' | 'notes'>('interface');
  const [stickyNotePreferences, setStickyNotePreferences] = useState<StickyNotePreferences>(() => readStickyNotePreferences(currentUser?.id || 'guest'));
  const [profileLaunchEffect, setProfileLaunchEffect] = useState<ProfileLaunchEffect>(() => {
    return readUserPreference<ProfileLaunchEffect>(PROFILE_LAUNCH_EFFECT_KEY, currentUser?.id || 'guest', 'classic') === 'fireball' ? 'fireball' : 'classic';
  });
  const [interfaceSubTab, setInterfaceSubTab] = useState<'presets' | 'builder'>('presets');
  const [dashboardSettingsTab, setDashboardSettingsTab] = useState<'core' | 'study' | 'more' | 'clubs' | 'timetable'>('core');

  useEffect(() => {
    const updateCompletion = (event: Event) => {
      const userId = (event as CustomEvent<{ userId?: string }>).detail?.userId;
      if (userId === currentUser?.id) setAssistantHasCompleted(true);
    };
    setAssistantHasCompleted(readUserPreference('nexus-ai-completed', currentUser?.id || 'guest', false));
    window.addEventListener('nexus-ai-response-completed', updateCompletion);
    return () => window.removeEventListener('nexus-ai-response-completed', updateCompletion);
  }, [currentUser?.id]);
  const [customPalettes, setCustomPalettes] = useState<CustomUiPalette[]>(() => readCustomUiPalettes(currentUser?.id || 'guest'));
  const [customPaletteName, setCustomPaletteName] = useState('');
  const [customBackground, setCustomBackground] = useState('#17212c');
  const [customSurface, setCustomSurface] = useState('#263747');
  const [customPrimary, setCustomPrimary] = useState('#73bdf0');
  const [customSecondary, setCustomSecondary] = useState('#65d5be');
  const [customPaletteBackgroundImage, setCustomPaletteBackgroundImage] = useState<string | undefined>();
  const [customAnimation, setCustomAnimation] = useState(false);
  const [customPaletteEditing, setCustomPaletteEditing] = useState(false);
  const [editingCustomPaletteId, setEditingCustomPaletteId] = useState<CustomUiPalette['id'] | null>(null);
  const [paletteSaveMessage, setPaletteSaveMessage] = useState('');
  const [paletteImageStep, setPaletteImageStep] = useState<'idle' | 'ask' | 'review' | 'name'>('idle');
  const [paletteImageAnalysis, setPaletteImageAnalysis] = useState<PaletteImageAnalysis | null>(null);
  const [paletteImageBusy, setPaletteImageBusy] = useState(false);
  const [paletteImageError, setPaletteImageError] = useState('');
  const paletteImageInput = useRef<HTMLInputElement>(null);
  const [onlineStatus, setOnlineStatus] = useState(() => readPreference('onlineStatus', currentUser?.id || 'guest', true));
  const [allowRequests, setAllowRequests] = useState(() => readPreference('allowRequests', currentUser?.id || 'guest', true));
  const [showEmail, setShowEmail] = useState(() => readPreference('showEmail', currentUser?.id || 'guest', false));
  const [messageNotifications, setMessageNotifications] = useState(() => readPreference('messageNotifications', currentUser?.id || 'guest', true));
  const [campusNotifications, setCampusNotifications] = useState(() => readPreference('campusNotifications', currentUser?.id || 'guest', true));
  const [deadlineNotifications, setDeadlineNotifications] = useState(() => readPreference('deadlineNotifications', currentUser?.id || 'guest', true));
  const [savedToast, setSavedToast] = useState(false);
  const [assistantName, setAssistantName] = useState(() => {
    return readUserPreference('nexus-ai-name', currentUser?.id || 'guest', 'NEXUS').slice(0, 10);
  });
  const [assistantNameSaved, setAssistantNameSaved] = useState(false);
  const [dashboardPreferences, setDashboardPreferences] = useState<DashboardPreferences>(() => readDashboardPreferences(currentUser?.id || 'guest'));
  const [dashboardTimetable, setDashboardTimetable] = useState<PersonalTimetable | null>(() => readPersonalTimetable(currentUser?.id || 'guest'));
  const [timetableMessage, setTimetableMessage] = useState('');

  const [fullName, setFullName] = useState(() => currentUser?.full_name || currentUser?.username || '');
  const [batch, setBatch] = useState(() => currentUser?.academic_year || '');
  const [programme, setProgramme] = useState(() => normalizeProgramme(currentUser?.program || ''));
  const [major, setMajor] = useState(() => currentUser?.department || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState('');

  useEffect(() => {
    const userId = currentUser?.id || 'guest';
    setDashboardPreferences(readDashboardPreferences(userId));
    setDashboardTimetable(readPersonalTimetable(userId));
  }, [currentUser?.id]);

  useEffect(() => {
    const userId = currentUser?.id || 'guest';
    setOnlineStatus(readPreference('onlineStatus', userId, true));
    setAllowRequests(readPreference('allowRequests', userId, true));
    setShowEmail(readPreference('showEmail', userId, false));
    setMessageNotifications(readPreference('messageNotifications', userId, true));
    setCampusNotifications(readPreference('campusNotifications', userId, true));
    setDeadlineNotifications(readPreference('deadlineNotifications', userId, true));
    setAssistantName(readUserPreference('nexus-ai-name', userId, 'NEXUS').slice(0, 10));
    setProfileLaunchEffect(readUserPreference<ProfileLaunchEffect>(PROFILE_LAUNCH_EFFECT_KEY, userId, 'classic') === 'fireball' ? 'fireball' : 'classic');
    setCustomPalettes(readCustomUiPalettes(userId));
  }, [currentUser?.id]);

  useEffect(() => {
    setFullName(currentUser?.full_name || currentUser?.username || '');
    setBatch(currentUser?.academic_year || '');
    setProgramme(normalizeProgramme(currentUser?.program || ''));
    setMajor(currentUser?.department || '');
    setProfileSaveError('');
    setSavedToast(false);
  }, [currentUser?.id, currentUser?.full_name, currentUser?.academic_year, currentUser?.program, currentUser?.department]);

  const updateDashboardPreferences = (next: DashboardPreferences) => {
    if (!currentUser) return;
    setDashboardPreferences(next);
    writeDashboardPreferences(currentUser.id, next);
  };

  const setDashboardWidget = (id: DashboardWidgetId, enabled: boolean) => {
    updateDashboardPreferences({ ...dashboardPreferences, widgets: { ...dashboardPreferences.widgets, [id]: enabled } });
  };

  const handleDashboardClubs = (value: string) => {
    const clubs = [...new Set(value.split(/[,\n]/).map(club => club.trim()).filter(Boolean))].slice(0, 30);
    updateDashboardPreferences({ ...dashboardPreferences, clubs });
  };

  const handleTimetableUpload = (file?: File) => {
    if (!file || !currentUser) return;
    if (!['application/pdf', 'image/png', 'image/jpeg'].includes(file.type)) { setTimetableMessage('Choose a PDF, PNG, or JPEG timetable.'); return; }
    if (file.size > 1_500_000) { setTimetableMessage('Choose a file smaller than 1.5 MB so it can be kept in this browser.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const timetable: PersonalTimetable = { name: file.name, mimeType: file.type, dataUrl: String(reader.result) };
      if (!savePersonalTimetable(currentUser.id, timetable)) { setTimetableMessage('Browser storage is full. Choose a smaller file or remove saved items.'); return; }
      setDashboardTimetable(timetable);
      updateDashboardPreferences({ ...dashboardPreferences, widgets: { ...dashboardPreferences.widgets, timetable: true } });
      setTimetableMessage('Timetable saved in this browser and added to your dashboard.');
    };
    reader.onerror = () => setTimetableMessage('Could not read that file.');
    reader.readAsDataURL(file);
  };

  const removeDashboardTimetable = () => {
    if (!currentUser) return;
    savePersonalTimetable(currentUser.id, null);
    setDashboardTimetable(null);
    updateDashboardPreferences({ ...dashboardPreferences, widgets: { ...dashboardPreferences.widgets, timetable: false } });
    setTimetableMessage('Your saved timetable was removed.');
  };

  useEffect(() => {
    if (activeSection !== 'appearance' || appearanceTab !== 'interface' || !customPaletteEditing) {
      onUiPalettePreview(null);
      return;
    }
    onUiPalettePreview({
      id: 'custom-preview',
      name: customPaletteName.trim() || 'Preview',
      background: customBackground,
      surface: customSurface,
      primary: customPrimary,
      secondary: customSecondary,
      animated: customAnimation,
      backgroundImage: customPaletteBackgroundImage,
    });
  }, [activeSection, appearanceTab, customPaletteEditing, customPaletteName, customBackground, customSurface, customPrimary, customSecondary, customAnimation, customPaletteBackgroundImage, onUiPalettePreview]);

  useEffect(() => () => onUiPalettePreview(null), [onUiPalettePreview]);

  const updateBooleanPreference = (key: string, setter: React.Dispatch<React.SetStateAction<boolean>>, value: boolean) => {
    setter(value);
    if (!currentUser) return;
    const existing = readUserPreference<Record<string, unknown>>('nexus-settings-preferences', currentUser.id, {});
    writeUserPreference('nexus-settings-preferences', currentUser.id, { ...existing, [key]: value });
  };

  const handleSave = async () => {
    const normalizedName = fullName.trim();
    if (!normalizedName) { setProfileSaveError('Enter your full name before saving.'); return; }
    setSavingProfile(true);
    setProfileSaveError('');
    setSavedToast(false);
    try {
      await api.updateProfile({
        full_name: normalizedName,
        program: programme,
        academic_year: batch,
        department: major,
      });
      await onProfileUpdated?.();
      setFullName(normalizedName);
      setSavedToast(true);
      window.setTimeout(() => setSavedToast(false), 3000);
    } catch (error) {
      setProfileSaveError(error instanceof Error ? error.message : 'Could not save your account settings. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveAssistantName = () => {
    const name = assistantName.trim().slice(0, 10) || 'NEXUS';
    setAssistantName(name);
    if (currentUser) writeUserPreference('nexus-ai-name', currentUser.id, name);
    window.dispatchEvent(new CustomEvent('nexus-ai-name-updated', { detail: { name } }));
    setAssistantNameSaved(true);
    setTimeout(() => setAssistantNameSaved(false), 3000);
  };

  const saveCustomPalette = () => {
    if (paletteImageStep === 'review') {
      setPaletteImageStep('name');
      setPaletteSaveMessage('Name your palette before saving and applying it.');
      return;
    }
    const name = customPaletteName.trim().slice(0, 28);
    if (!name) {
      setPaletteSaveMessage('Add a name for your palette first.');
      return;
    }
    const id = editingCustomPaletteId || (`custom-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Date.now().toString(36)}` as const);
    const palette: CustomUiPalette = {
      id,
      name,
      background: customBackground,
      surface: customSurface,
      primary: customPrimary,
      secondary: customSecondary,
      animated: customAnimation,
      backgroundImage: customPaletteBackgroundImage,
    };
    const nextPalettes = editingCustomPaletteId
      ? customPalettes.map(existing => existing.id === editingCustomPaletteId ? palette : existing)
      : [...customPalettes, palette];
    try {
      if (!currentUser) throw new Error('Sign in to save a personal palette.');
      writeCustomUiPalettes(currentUser.id, nextPalettes);
      setCustomPalettes(nextPalettes);
      setCustomPaletteEditing(false);
      setEditingCustomPaletteId(null);
      setPaletteImageStep('idle');
      setPaletteImageAnalysis(null);
      setCustomPaletteBackgroundImage(undefined);
      onUiPalettePreview(null);
      onUiPaletteChange(id);
      setPaletteSaveMessage(`“${name}” ${editingCustomPaletteId ? 'updated' : 'saved'} and applied.`);
      setCustomPaletteName('');
    } catch {
      setPaletteSaveMessage('Could not save this palette in browser storage.');
    }
  };

  const discardCustomPalettePreview = () => {
    setCustomPaletteEditing(false);
    setEditingCustomPaletteId(null);
    onUiPalettePreview(null);
    setCustomPaletteName('');
    setCustomBackground('#17212c');
    setCustomSurface('#263747');
    setCustomPrimary('#73bdf0');
    setCustomSecondary('#65d5be');
    setCustomPaletteBackgroundImage(undefined);
    setCustomAnimation(false);
    setPaletteImageStep('idle');
    setPaletteImageAnalysis(null);
    setPaletteImageError('');
    setPaletteSaveMessage('Preview discarded. Your saved palette is restored.');
  };

  const editCustomPalette = (palette: CustomUiPalette) => {
    setEditingCustomPaletteId(palette.id);
    setCustomPaletteName(palette.name);
    setCustomBackground(palette.background);
    setCustomSurface(palette.surface);
    setCustomPrimary(palette.primary);
    setCustomSecondary(palette.secondary);
    setCustomPaletteBackgroundImage(palette.backgroundImage);
    setCustomAnimation(palette.animated);
    setCustomPaletteEditing(true);
    setPaletteSaveMessage('');
  };

  const selectUiPalette = (id: UiPaletteId) => {
    setCustomPaletteEditing(false);
    setEditingCustomPaletteId(null);
    setPaletteImageStep('idle');
    setPaletteImageAnalysis(null);
    setCustomPaletteBackgroundImage(undefined);
    onUiPalettePreview(null);
    onUiPaletteChange(id);
  };

  const handlePaletteImageUpload = async (file?: File) => {
    if (!file) return;
    setPaletteImageBusy(true);
    setPaletteImageError('');
    setPaletteImageAnalysis(null);
    try {
      const analysis = await analyzePaletteImage(file);
      setPaletteImageAnalysis(analysis);
      setPaletteImageStep('ask');
    } catch (error) {
      setPaletteImageError(error instanceof Error ? error.message : 'Could not read this image.');
    } finally {
      setPaletteImageBusy(false);
    }
  };

  const createPaletteFromImage = () => {
    if (!paletteImageAnalysis) return;
    setEditingCustomPaletteId(null);
    setCustomPaletteName('');
    setCustomBackground(paletteImageAnalysis.background);
    setCustomSurface(paletteImageAnalysis.surface);
    setCustomPrimary(paletteImageAnalysis.primary);
    setCustomSecondary(paletteImageAnalysis.secondary);
    setCustomPaletteBackgroundImage(paletteImageAnalysis.dataUrl);
    setCustomPaletteEditing(true);
    setPaletteImageStep('review');
    setPaletteSaveMessage('Colors sampled from your image. You can fine-tune them before saving.');
  };

  const skipPaletteFromImage = () => {
    setPaletteImageStep('idle');
    setPaletteImageAnalysis(null);
    setPaletteImageError('');
    setPaletteSaveMessage('Kept your current palette. The uploaded image was not saved.');
  };

  const handleCancel = () => {
    setFullName(currentUser?.full_name || currentUser?.username || '');
    setBatch(currentUser?.academic_year || '');
    setProgramme(normalizeProgramme(currentUser?.program || ''));
    setMajor(currentUser?.department || '');
    setSavedToast(false);
    setProfileSaveError('');
  };

  if (!currentUser) return null;

  return (
    <div className="discord-settings-page" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-canvas)' }}>
      <SideNav currentUser={currentUser} onLogout={onLogout} onOpenSearch={() => setSearchOpen(true)} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopHeader
          breadcrumb="Workspace / Settings"
          currentUser={currentUser}
          onOpenSearch={() => setSearchOpen(true)}
        />

        <main className="discord-settings-main" style={{
          flex: 1,
          padding: '24px',
          maxWidth: 'none',
          width: '100%',
          margin: '0',
        }}>
          {/* Header */}
          <div className="settings-page-heading" style={{ marginBottom: '22px' }}>
            <h1 style={{ fontSize: '24px', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)' }}>
              User Settings
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Your colors and personal preferences are saved separately for this account in this browser. Groups and chats remain shared with NEXUS members.
            </p>
          </div>

          <div className="discord-settings-layout" style={{ display: 'grid', gridTemplateColumns: '210px 1fr', gap: '30px', alignItems: 'flex-start' }}>
            {/* Left Settings Sidebar */}
            <nav className="discord-settings-nav" aria-label="Settings sections" style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingRight: 14, borderRight: '1px solid var(--border)', boxSizing: 'border-box' }}>
              {[
                { id: 'account', label: 'My Account', icon: UserRound },
                { id: 'appearance', label: 'Appearance', icon: Palette },
                { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
                { id: 'assistant', label: 'AI Assistant', icon: Sparkles },
                { id: 'notifications', label: 'Notifications', icon: Bell },
                { id: 'privacy', label: 'Privacy & Safety', icon: ShieldCheck },
              ].map((item) => {
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => { if (customPaletteEditing && item.id !== 'appearance') discardCustomPalettePreview(); setActiveSection(item.id); if (item.id === 'assistant') { setAssistantHasCompleted(false); writeUserPreference('nexus-ai-completed', currentUser?.id || 'guest', false); } }}
                    className={`discord-settings-nav-item${active ? ' active' : ''}${item.id === 'assistant' ? ' ai-assistant-tab' : ''}${item.id === 'assistant' && assistantHasCompleted ? ' ai-assistant-completed' : ''}${active && item.id === 'assistant' ? ' ai-assistant-active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '4px',
                      fontSize: '13px',
                      fontWeight: active ? 600 : 500,
                      color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                      background: active ? 'var(--bg-raised)' : 'transparent',
                      cursor: 'pointer',
                      border: '1px solid transparent',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '9px',
                      textAlign: 'left',
                    }}
                  >
                    <item.icon size={16} strokeWidth={1.8} />{item.label}{item.id === 'assistant' && <span className="ai-assistant-beta">(Beta)</span>}
                  </button>
                );
              })}
            </nav>

            {/* Right Settings Content */}
            <div className="discord-settings-content" style={{ display: 'flex', flexDirection: 'column', gap: '18px', minWidth: 0 }}>
              {activeSection === 'account' && <>
              {/* Campus Verified Card */}
              <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '20px',
              }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: 'var(--bg-raised)',
                  border: '2px solid var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  fontWeight: 700,
                  color: 'var(--primary)',
                }}>
                  AR
                </div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Campus verified · IISER TIRUPATI
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.4 }}>
                    Your profile is part of a verified student community. Only institute students can view it.
                  </p>
                  <div style={{ fontSize: '12px', color: 'var(--primary)', marginTop: '8px', cursor: 'pointer' }}>
                    Manage profile photos and banners in Main Profile. Photos support images, GIFs, and videos up to 8 MB; banners up to 20 MB.
                  </div>
                </div>
              </div>

              {/* Account Form */}
              <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px',
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                      Full name
                    </label>
                    <input
                      type="text"
                      maxLength={120}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                      Batch
                    </label>
                    <select value={batch} onChange={(e) => setBatch(e.target.value)} style={{ width: '100%' }}>
                      {!batch && <option value="">Choose your batch</option>}
                      {batch && !['2021', '2022', '2023', '2024', '2025', '2026'].includes(batch) && <option value={batch}>{batch}</option>}
                      <option value="2023">2023</option>
                      <option value="2024">2024</option>
                      <option value="2022">2022</option>
                      <option value="2021">2021</option>
                      <option value="2025">2025</option>
                      <option value="2026">2026</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                      Programme
                    </label>
                    <select value={programme} onChange={(e) => setProgramme(e.target.value)} style={{ width: '100%' }}>
                      {!programme && <option value="">Choose your programme</option>}
                      {programme && !['BS-MS', 'M.Sc.', 'Ph.D.', 'I-Ph.D.'].includes(programme) && <option value={programme}>{programme}</option>}
                      <option value="BS-MS">BS–MS</option>
                      <option value="M.Sc.">M.Sc.</option>
                      <option value="Ph.D.">Ph.D.</option>
                      <option value="I-Ph.D.">I-Ph.D.</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                      Major interest
                    </label>
                    <select value={major} onChange={(e) => setMajor(e.target.value)} style={{ width: '100%' }}>
                      {!major && <option value="">Choose your major</option>}
                      {major && !['Physics', 'Chemistry', 'Biology', 'Mathematics', 'Earth Sciences'].includes(major) && <option value={major}>{major}</option>}
                      <option value="Physics">Physics</option>
                      <option value="Chemistry">Chemistry</option>
                      <option value="Biology">Biology</option>
                      <option value="Mathematics">Mathematics</option>
                      <option value="Earth Sciences">Earth Sciences</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Institute email · Verified
                  </label>
                  <input
                    type="email"
                    disabled
                    value={currentUser.email || 'ananya23@students.iisertirupati.ac.in'}
                    style={{ width: '100%', opacity: 0.7 }}
                  />
                  <div style={{ fontSize: '11.5px', color: 'var(--text-subtle)', marginTop: '4px' }}>
                    Your institute email keeps NEXUS campus-only and cannot be changed here.
                  </div>
                </div>
              </div>

              </>}

              {activeSection === 'privacy' && <>
              {/* Privacy controls that matter for a campus community */}
              <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Visibility & campus presence
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Show my online status
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>
                      Let friends know when you’re around.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={onlineStatus}
                    onChange={(e) => updateBooleanPreference('onlineStatus', setOnlineStatus, e.target.checked)}
                    style={{ accentColor: 'var(--primary)', transform: 'scale(1.2)' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Allow friend requests
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>
                      Other verified students can send you a connection request.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowRequests}
                    onChange={(e) => updateBooleanPreference('allowRequests', setAllowRequests, e.target.checked)}
                    style={{ accentColor: 'var(--primary)', transform: 'scale(1.2)' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Show email on my profile
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>
                      Keep your institute email private from other students.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={showEmail}
                    onChange={(e) => updateBooleanPreference('showEmail', setShowEmail, e.target.checked)}
                    style={{ accentColor: 'var(--primary)', transform: 'scale(1.2)' }}
                  />
                </div>
              </div>
              </>}

              {activeSection === 'dashboard' && <section className="discord-settings-card discord-dashboard-settings-card">
                <div>
                  <h2>Dashboard settings</h2>
                  <p>Manage the overview, study tools, and other dashboard cards by category.</p>
                </div>
                <div className="discord-settings-subtabs" role="tablist" aria-label="Dashboard setting categories">
                  {([
                    ['core', 'Overview cards'], ['study', 'Study tools'], ['more', 'More cards'], ['clubs', 'Club interests'], ['timetable', 'My timetable'],
                  ] as const).map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={dashboardSettingsTab === id} className={dashboardSettingsTab === id ? 'active' : ''} onClick={() => setDashboardSettingsTab(id)}>{label}</button>)}
                </div>
                {(['core', 'study', 'more'] as const).includes(dashboardSettingsTab as 'core' | 'study' | 'more') && <div className="discord-dashboard-widget-options">
                  {DASHBOARD_WIDGETS.filter(widget => DASHBOARD_WIDGET_GROUPS[dashboardSettingsTab as 'core' | 'study' | 'more'].includes(widget.id)).map(widget => (
                    <label className="discord-settings-toggle-row" key={widget.id}>
                      <span><strong>{widget.label}{widget.optional && <small className="discord-beta-badge" style={{ display: 'inline-block', marginLeft: 7 }}>OPTIONAL</small>}</strong><small>{widget.description}</small></span>
                      <input type="checkbox" checked={dashboardPreferences.widgets[widget.id]} onChange={event => setDashboardWidget(widget.id, event.target.checked)} />
                    </label>
                  ))}
                </div>}
                {dashboardSettingsTab === 'clubs' && <div className="discord-dashboard-tab-panel">
                  <h3>Club activity preferences</h3>
                  <p>Enter the clubs you want to follow, separated by commas. You can change them later.</p>
                  <label className="discord-custom-palette-name">Clubs to follow
                    <textarea value={dashboardPreferences.clubs.join(', ')} onChange={event => handleDashboardClubs(event.target.value)} placeholder="e.g. Astronomy Club, Football, Dance Society" rows={3} maxLength={600} />
                  </label>
                  <small>Club cards match these names against events and notifications available to your account.</small>
                </div>}
                {dashboardSettingsTab === 'timetable' && <div className="discord-dashboard-tab-panel">
                  <h3>Your semester timetable</h3>
                  <p>Upload a personal timetable file to show it on your dashboard. It stays in this browser.</p>
                  <input aria-label="Upload semester timetable" type="file" accept="application/pdf,image/png,image/jpeg" onChange={event => { handleTimetableUpload(event.target.files?.[0]); event.currentTarget.value = ''; }} />
                  {dashboardTimetable && <div className="discord-dashboard-timetable-file"><a href={dashboardTimetable.dataUrl} target="_blank" rel="noreferrer">{dashboardTimetable.name}</a><button type="button" onClick={removeDashboardTimetable} aria-label="Remove saved timetable"><Trash2 size={14} /> Remove</button></div>}
                  {timetableMessage && <p role="status" className="discord-dashboard-timetable-status">{timetableMessage}</p>}
                </div>}
              </section>}

              {activeSection === 'appearance' && <div className="discord-appearance-settings">
                <div className="discord-appearance-tabs" role="tablist" aria-label="Appearance settings">
                  <button type="button" role="tab" aria-selected={appearanceTab === 'interface'} className={appearanceTab === 'interface' ? 'active' : ''} onClick={() => setAppearanceTab('interface')}>
                    User Interface <span className="discord-beta-badge">BETA</span>
                  </button>
                    <button type="button" role="tab" aria-selected={appearanceTab === 'theme'} className={appearanceTab === 'theme' ? 'active' : ''} onClick={() => { if (customPaletteEditing) discardCustomPalettePreview(); setAppearanceTab('theme'); }}>Theme</button>
                    <button type="button" role="tab" aria-selected={appearanceTab === 'effects'} className={appearanceTab === 'effects' ? 'active' : ''} onClick={() => { if (customPaletteEditing) discardCustomPalettePreview(); setAppearanceTab('effects'); }}>Effects</button>
                    <button type="button" role="tab" aria-selected={appearanceTab === 'notes'} className={appearanceTab === 'notes' ? 'active' : ''} onClick={() => { if (customPaletteEditing) discardCustomPalettePreview(); setAppearanceTab('notes'); }}>Sticky notes</button>
                </div>

                {appearanceTab === 'interface' && <section className="discord-settings-card">
                  <div>
                    <h2>User interface colors</h2>
                    <p>Choose the workspace palette for your account. Your profile colors stay separate.</p>
                  </div>
                  <div className="discord-settings-subtabs" role="tablist" aria-label="User interface palette sections">
                    <button type="button" role="tab" aria-selected={interfaceSubTab === 'presets'} className={interfaceSubTab === 'presets' ? 'active' : ''} onClick={() => setInterfaceSubTab('presets')}>Choose palette</button>
                    <button type="button" role="tab" aria-selected={interfaceSubTab === 'builder'} className={interfaceSubTab === 'builder' ? 'active' : ''} onClick={() => setInterfaceSubTab('builder')}>Create or edit</button>
                  </div>
                  {interfaceSubTab === 'presets' && <div className="discord-ui-palette-options" role="group" aria-label="Your interface color palette">
                    {(Object.entries(UI_PALETTES) as [keyof typeof UI_PALETTES, (typeof UI_PALETTES)[keyof typeof UI_PALETTES]][]).map(([id, palette]) => (
                      <button key={id} type="button" className={`discord-ui-palette-option${uiPalette === id && !customPaletteEditing ? ' selected' : ''}`} aria-pressed={uiPalette === id && !customPaletteEditing} onClick={() => selectUiPalette(id)}>
                        <span className="discord-ui-palette-swatches">{palette.colors.map(color => <i key={color} style={{ background: color }} />)}</span>
                        <span className="discord-ui-palette-name">{palette.name}</span>
                        <span className="discord-ui-palette-status">{uiPalette === id && !customPaletteEditing ? <><Check size={13} /> Selected</> : 'Select palette'}</span>
                      </button>
                    ))}
                    {customPalettes.map(palette => (
                      <div className="discord-ui-custom-palette" key={palette.id}>
                        <button type="button" className={`discord-ui-palette-option${uiPalette === palette.id && !customPaletteEditing ? ' selected' : ''}`} aria-pressed={uiPalette === palette.id && !customPaletteEditing} onClick={() => selectUiPalette(palette.id)}>
                          <span className="discord-ui-palette-swatches">{[palette.background, palette.surface, palette.primary, palette.secondary].map(color => <i key={color} style={{ background: color }} />)}</span>
                          <span className="discord-ui-palette-name">{palette.name}{palette.animated && <span className="discord-beta-badge">DRIFT</span>}</span>
                          <span className="discord-ui-palette-status">{uiPalette === palette.id && !customPaletteEditing ? <><Check size={13} /> Selected</> : 'Select palette'}</span>
                        </button>
                        <button type="button" className="discord-ui-palette-edit" onClick={() => { setInterfaceSubTab('builder'); editCustomPalette(palette); }}>Edit</button>
                      </div>
                    ))}
                  </div>}
                  {interfaceSubTab === 'builder' && <>
                  <section className="discord-image-palette-tool" aria-label="Create a palette from an image">
                    <div className="discord-image-palette-heading"><div><h3>Build a palette from a picture</h3><p>Choose a background image and get a matching, editable palette.</p></div><span className="discord-beta-badge">BETA</span></div>
                    <p className="discord-image-palette-privacy">Your picture is analyzed in this browser and is not uploaded.</p>
                    <input ref={paletteImageInput} className="discord-image-palette-file" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => { void handlePaletteImageUpload(event.target.files?.[0]); event.currentTarget.value = ''; }} />
                    <button type="button" className="discord-image-palette-upload" disabled={paletteImageBusy} onClick={() => paletteImageInput.current?.click()}><ImagePlus size={15} />{paletteImageBusy ? 'Analyzing image…' : 'Choose background image'}</button>
                    {paletteImageError && <p role="alert" className="discord-image-palette-error">{paletteImageError}</p>}
                    {paletteImageAnalysis && <div className="discord-image-palette-source"><img src={paletteImageAnalysis.dataUrl} alt="Selected palette background preview" /><span>{paletteImageStep === 'ask' ? 'Image ready. Want a matching custom UI palette?' : paletteImageStep === 'review' ? 'Live preview: your UI is using colors sampled from this image.' : 'Give your palette a name to save and apply it.'}</span></div>}
                    {paletteImageStep === 'ask' && <div className="discord-image-palette-actions"><button type="button" onClick={createPaletteFromImage}>Yes, create a palette</button><button type="button" className="secondary" onClick={skipPaletteFromImage}>No, keep current colors</button></div>}
                    {paletteImageStep === 'review' && <div className="discord-image-palette-save-prompt"><p>Save and apply this palette?</p><div className="discord-image-palette-actions"><button type="button" onClick={saveCustomPalette}>Yes, save and apply</button><button type="button" className="secondary" onClick={discardCustomPalettePreview}>No, discard preview</button></div></div>}
                    {paletteImageStep === 'name' && <div className="discord-image-palette-name-step"><label className="discord-custom-palette-name">Name your palette<input autoFocus value={customPaletteName} maxLength={28} onChange={event => setCustomPaletteName(event.target.value)} placeholder="e.g. Mountain dusk" /></label><div className="discord-image-palette-actions"><button type="button" onClick={saveCustomPalette} disabled={!customPaletteName.trim()}>Save and apply</button><button type="button" className="secondary" onClick={discardCustomPalettePreview}>Cancel</button></div></div>}
                  </section>
                  <div className="discord-custom-palette-builder">
                    <div className="discord-custom-palette-heading">
                      <div><h3>{editingCustomPaletteId ? `Edit ${customPaletteName || 'your palette'}` : 'Create your palette'}</h3><p>Name it, choose your colors, and save it for this browser.</p></div>
                      <span className="discord-beta-badge">BETA</span>
                    </div>
                    {paletteImageStep === 'idle' && <label className="discord-custom-palette-name">Palette name
                      <input value={customPaletteName} maxLength={28} onChange={event => { setCustomPaletteName(event.target.value); setPaletteSaveMessage(''); }} placeholder="e.g. Arctic sunrise" />
                    </label>}
                    <div className="discord-custom-palette-colors">
                      {([
                        { label: 'Background', value: customBackground, set: setCustomBackground },
                        { label: 'Panels', value: customSurface, set: setCustomSurface },
                        { label: 'Primary accent', value: customPrimary, set: setCustomPrimary },
                        { label: 'Secondary accent', value: customSecondary, set: setCustomSecondary },
                      ]).map(color => <label key={color.label}>{color.label}<span><i style={{ background: color.value }} /><input type="color" value={color.value} onChange={event => { setCustomPaletteEditing(true); color.set(event.target.value); setPaletteSaveMessage(''); }} /></span></label>)}
                    </div>
                    <div className="discord-custom-palette-preview" style={{ '--palette-background': customBackground, '--palette-surface': customSurface, '--palette-primary': customPrimary } as React.CSSProperties}>
                      <span>{customPaletteName.trim() || 'Your palette preview'}</span><i style={{ background: customPrimary }} /><i style={{ background: customSecondary }} />
                    </div>
                    <label className="discord-custom-palette-motion"><input type="checkbox" checked={customAnimation} onChange={event => { setCustomPaletteEditing(true); setCustomAnimation(event.target.checked); }} />
                      <span><strong>Slow color drift</strong><small>Gently move the background colors over time.</small></span>
                      <span className="discord-beta-badge">BETA</span>
                    </label>
                    <div className="discord-custom-palette-actions"><span role="status">{customPaletteEditing ? `Live preview · ${editingCustomPaletteId ? 'unsaved edits' : 'unsaved palette'}` : paletteSaveMessage}</span><div><button type="button" className="discord-custom-palette-cancel" onClick={discardCustomPalettePreview} disabled={!customPaletteEditing}>Discard</button>{paletteImageStep === 'idle' && <button type="button" onClick={saveCustomPalette} disabled={!customPaletteName.trim()}>{editingCustomPaletteId ? 'Save changes' : 'Save palette'}</button>}</div></div>
                  </div>
                  </>}
                </section>}

                {appearanceTab === 'theme' && <section className="discord-settings-card">
                  <div>
                    <h2>Theme</h2>
                    <p>Choose light or dark mode. Your selected color palette works with either mode.</p>
                  </div>
                  <div className="discord-theme-options" role="group" aria-label="Theme">
                    {(['dark', 'light'] as const).map((option) => (
                      <button key={option} type="button" className={`discord-theme-option${theme === option ? ' selected' : ''}`} aria-pressed={theme === option} onClick={() => onThemeChange(option)}>
                        <span className={`discord-theme-swatch ${option}`} />
                        <span>{option === 'dark' ? 'Dark' : 'Light'}</span>
                        {theme === option && <Check size={15} />}
                      </button>
                    ))}
                  </div>
                </section>}

                {appearanceTab === 'effects' && <section className="discord-settings-card discord-profile-effects-card">
                  <div>
                    <h2>Profile opening effect</h2>
                    <p>Choose the burst that plays when you open your profile from the account bar. Both effects are sped up for a quicker impact.</p>
                  </div>
                  <div className="discord-profile-effects-options" role="radiogroup" aria-label="Profile opening effect">
                    {([
                      { id: 'classic', name: 'Classic burst', detail: 'The original cleaned, transparent burst · 1.45× speed', src: '/profile-launch-explosion.webm' },
                      { id: 'fireball', name: 'Fireball', detail: 'The new transparent explosion animation · 1.7× speed', src: '/profile-launch-fireball.webm' },
                    ] as const).map(effect => <label key={effect.id} className={`discord-profile-effect-option${profileLaunchEffect === effect.id ? ' selected' : ''}`}>
                      <input type="radio" name="profile-launch-effect" value={effect.id} checked={profileLaunchEffect === effect.id} onChange={() => {
                        setProfileLaunchEffect(effect.id);
                        if (currentUser) writeUserPreference(PROFILE_LAUNCH_EFFECT_KEY, currentUser.id, effect.id);
                      }} />
                      <span className="discord-profile-effect-preview"><video src={effect.src} muted playsInline loop autoPlay aria-hidden="true" /></span>
                      <span className="discord-profile-effect-copy"><strong>{effect.name}</strong><small>{effect.detail}</small></span>
                      {profileLaunchEffect === effect.id && <Check size={16} aria-label="Selected" />}
                    </label>)}
                  </div>
                  <p className="discord-profile-effects-note"><Zap size={14} /> Selection saves immediately in this browser.</p>
                </section>}

                {appearanceTab === 'notes' && <section className="discord-settings-card discord-sticky-settings-card">
                  <div><h2>Dashboard sticky notes</h2><p>Customize how Institute and campus messages look on your dashboard. “Match workspace” follows the current UI palette.</p></div>
                  <label className="discord-sticky-setting-row">Note color
                    <select value={stickyNotePreferences.palette} onChange={event => {
                      const next = { ...stickyNotePreferences, palette: event.target.value as StickyNotePreferences['palette'] };
                      setStickyNotePreferences(next); writeStickyNotePreferences(currentUser?.id || 'guest', next);
                    }}>
                      <option value="match">Match workspace</option><option value="blue">Sky blue</option><option value="teal">Teal</option><option value="pink">Rose pink</option><option value="yellow">Warm yellow</option>
                    </select>
                  </label>
                  <label className="discord-sticky-setting-row">Note angle
                    <select value={stickyNotePreferences.angle} onChange={event => {
                      const next = { ...stickyNotePreferences, angle: event.target.value as StickyNotePreferences['angle'] };
                      setStickyNotePreferences(next); writeStickyNotePreferences(currentUser?.id || 'guest', next);
                    }}><option value="tilt">Slight tilt</option><option value="straight">Straight</option></select>
                  </label>
                  <label className="discord-sticky-motion-setting"><input type="checkbox" checked={stickyNotePreferences.sway} onChange={event => {
                    const next = { ...stickyNotePreferences, sway: event.target.checked };
                    setStickyNotePreferences(next); writeStickyNotePreferences(currentUser?.id || 'guest', next);
                  }} /><span><strong>Gentle pinned movement</strong><small>Let notes sway softly as the dashboard moves. Respects reduced-motion settings.</small></span></label>
                  <div className={`discord-sticky-demo discord-sticky-${stickyNotePreferences.palette} ${stickyNotePreferences.angle === 'tilt' ? 'tilted' : ''}`}><span className="discord-sticky-demo-pin" /><span className="discord-sticky-demo-fold" /><strong>Preview note</strong><small>Appearance updates immediately and is saved in this browser.</small></div>
                </section>}
              </div>}

              {activeSection === 'assistant' && <section className="discord-settings-card">
                <div>
                  <h2>AI assistant</h2>
                  <p>Choose a short name for the assistant launcher and chat panel.</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 420px) auto', gap: 12, alignItems: 'end' }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                    Assistant name <span style={{ fontWeight: 400, color: 'var(--text-subtle)' }}>({assistantName.trim().length}/10)</span>
                    <input
                      type="text"
                      value={assistantName}
                      maxLength={10}
                      onChange={event => { setAssistantName(event.target.value); setAssistantNameSaved(false); }}
                      onKeyDown={event => { if (event.key === 'Enter') handleSaveAssistantName(); }}
                      placeholder="NEXUS"
                      style={{ width: '100%', display: 'block', marginTop: 7 }}
                      aria-label="AI assistant name"
                    />
                  </label>
                  <button type="button" onClick={handleSaveAssistantName} style={{ padding: '9px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>Save name</button>
                </div>
                <p role="status" style={{ color: assistantNameSaved ? 'var(--accent-green)' : 'var(--text-subtle)', fontSize: 12, margin: 0 }}>
                  {assistantNameSaved ? `Saved. The launcher now says “Ask ${assistantName}${assistantName.toUpperCase().endsWith(' AI') ? '' : ' AI'}”.` : 'The name is saved in this browser and updates the launcher immediately.'}
                </p>
              </section>}

              {activeSection === 'notifications' && <section className="discord-settings-card">
                <div>
                  <h2>Notifications</h2>
                  <p>Keep the updates that help you stay on top of campus life.</p>
                </div>
                {[
                  { key: 'messageNotifications', label: 'Direct and group messages', description: 'Get notified when someone messages you.', value: messageNotifications, change: setMessageNotifications },
                  { key: 'campusNotifications', label: 'Campus updates and events', description: 'Announcements, event changes, and opportunities.', value: campusNotifications, change: setCampusNotifications },
                  { key: 'deadlineNotifications', label: 'Assignment reminders', description: 'Upcoming deadlines for your courses.', value: deadlineNotifications, change: setDeadlineNotifications },
                ].map((item) => (
                  <label className="discord-settings-toggle-row" key={item.label}>
                    <span><strong>{item.label}</strong><small>{item.description}</small></span>
                    <input type="checkbox" checked={item.value} onChange={(event) => updateBooleanPreference(item.key, item.change, event.target.checked)} />
                  </label>
                ))}
              </section>}

              {/* Save Bar */}
              {activeSection === 'account' && <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '8px',
              }}>
                <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>
                  {profileSaveError ? <span role="alert" style={{ color: 'var(--danger, #e45b5b)' }}>{profileSaveError}</span> : savedToast ? '✓ Changes saved to your NEXUS account.' : 'Profile settings are saved to your NEXUS account.'}
                </span>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={handleCancel} style={{
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    color: 'var(--text-muted)',
                  }}>
                    Cancel
                  </button>
                  <button
                    onClick={() => void handleSave()}
                    disabled={savingProfile}
                    style={{
                      padding: '8px 22px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--primary)',
                      color: '#ffffff',
                      fontWeight: 600,
                      fontSize: '13.5px',
                    }}
                  >
                    {savingProfile ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </div>}
            </div>
          </div>
        </main>
      </div>

      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
};
