import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api, UserSummary } from './services/api';
import { Navigation } from './components/Navigation';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProfileEditor } from './pages/ProfileEditor';
import { MessagingPage } from './pages/MessagingPage';
import { AILoopPage } from './pages/AILoopPage';
import { LaTeXEditorPage } from './pages/LaTeXEditorPage';
import { ForumsPage } from './pages/ForumsPage';
import { RepositoryPage } from './pages/RepositoryPage';
import { CampusHubPage } from './pages/CampusHubPage';
import { CoursesPage } from './pages/CoursesPage';
import { StudyGroupsPage } from './pages/StudyGroupsPage';
import { ProductivityPage } from './pages/ProductivityPage';
import { FriendsPage } from './pages/FriendsPage';
import { QOTDPage } from './pages/QOTDPage';
import { QOTDArchivePage } from './pages/QOTDArchivePage';
import { QOTDCreatePage } from './pages/QOTDCreatePage';
import { QOTDProposalReviewPage } from './pages/QOTDProposalReviewPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { SettingsPage } from './pages/SettingsPage';
import { HistoryPage } from './pages/HistoryPage';
import { EventsArchivePage } from './pages/EventsArchivePage';
import { VisualEditor } from './components/VisualEditor';
import { AIQuickPanel } from './components/AIQuickPanel';
import { DeveloperConsole } from './components/DeveloperConsole';
import { firebaseAuth } from './services/firebase';
import { signOut } from 'firebase/auth';
import { customPaletteStyle, CustomUiPalette, readCustomUiPalettes, readUiPalette, UiPaletteId, writeUiPalette } from './services/appearance';
import { recordDashboardHistory } from './services/dashboard';
import { readUserPreference, writeUserPreference } from './services/userPreferences';
import { wsClient } from './services/websocket';

const queryClient = new QueryClient();

const PROFILE_LAUNCH_EFFECT_KEY = 'nexus-profile-launch-effect';
type ProfileLaunchEffect = 'classic' | 'fireball';
interface ProfileLaunchAnimation {
  layer: HTMLDivElement;
  ghost: HTMLElement;
  source: HTMLElement;
  translateX: number;
  translateY: number;
  destination: string;
  timers: number[];
  explosion?: HTMLVideoElement;
}

const RouteShell: React.FC<React.PropsWithChildren<{ theme: 'dark' | 'light'; uiPalette: UiPaletteId; uiPalettePreview: CustomUiPalette | null; currentUser: UserSummary | null; onProfileUpdated: () => void | Promise<void> }>> = ({ children, theme, uiPalette, uiPalettePreview, currentUser, onProfileUpdated }) => {
  const { pathname, search } = useLocation();
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const profileLaunch = useRef<ProfileLaunchAnimation | null>(null);
  const isInterior = pathname !== '/' && pathname !== '/landing' && pathname !== '/auth';
  const customPalette = uiPalettePreview || (currentUser ? readCustomUiPalettes(currentUser.id).find(palette => palette.id === uiPalette) : undefined);
  const paletteClass = customPalette ? 'discord-ui-palette-custom' : `discord-ui-palette-${uiPalette}`;
  useEffect(() => {
    if (!currentUser || !isInterior) return;
    const pageNames: Record<string, string> = {
      '/dashboard': 'Dashboard', '/repository': 'Academic Repository', '/courses': 'My Courses', '/studygroups': 'Study Groups',
      '/productivity': 'Productivity', '/friends': 'Friends', '/messaging': 'Messenger', '/forums': 'Discussion Forums',
      '/qotd': 'Question of the Day', '/qotd/archive': 'Previous Questions', '/qotd/create': 'QOTD creator application', '/qotd/review': 'QOTD proposals', '/campus': 'Campus Hub', '/settings': 'User Settings', '/history': 'Browsing History',
      '/ai': 'AI Study Companion', '/latex': 'LaTeX Studio', '/notifications': 'Notifications',
    };
    const title = pageNames[pathname] || pathname.split('/').filter(Boolean).pop()?.replace(/[-_]/g, ' ') || 'NEXUS page';
    recordDashboardHistory(currentUser.id, { title, path: `${pathname}${search}`, kind: 'page' });
  }, [currentUser?.id, isInterior, pathname, search]);

  useEffect(() => {
    if (!currentUser) return;
    const onResourceUploaded = (event: Event) => {
      const detail = (event as CustomEvent<{ title?: string; resourceId?: string }>).detail;
      if (detail?.title) recordDashboardHistory(currentUser.id, { title: `Uploaded: ${detail.title}`, path: detail.resourceId ? `/repository?resourceId=${encodeURIComponent(detail.resourceId)}` : '/repository', kind: 'upload' });
    };
    window.addEventListener('nexus-resource-uploaded', onResourceUploaded);
    return () => window.removeEventListener('nexus-resource-uploaded', onResourceUploaded);
  }, [currentUser?.id]);

  useEffect(() => {
    const openProfileEditor = (event: Event) => {
      const source = (event as CustomEvent<{ source?: HTMLElement | null }>).detail?.source;
      if (!source || !source.isConnected || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setProfileEditorOpen(true);
        return;
      }
      if (profileLaunch.current) return;
      const scope = source.closest('.discord-interior-scope') as HTMLElement | null;
      const rect = source.getBoundingClientRect();
      if (!scope || rect.width < 1 || rect.height < 1) {
        setProfileEditorOpen(true);
        return;
      }

      const layer = document.createElement('div');
      layer.className = 'profile-launch-layer';
      const explosion = document.createElement('video');
      explosion.className = 'profile-launch-explosion';
      const launchEffect: ProfileLaunchEffect = currentUser && readUserPreference<ProfileLaunchEffect>(PROFILE_LAUNCH_EFFECT_KEY, currentUser.id, 'classic') === 'fireball' ? 'fireball' : 'classic';
      explosion.src = launchEffect === 'fireball' ? '/profile-launch-fireball.webm' : '/profile-launch-explosion.webm';
      explosion.preload = 'auto';
      explosion.muted = true;
      explosion.playsInline = true;
      explosion.playbackRate = launchEffect === 'fireball' ? 1.7 : 1.45;
      explosion.setAttribute('aria-hidden', 'true');
      const ghost = source.cloneNode(true) as HTMLElement;
      ghost.classList.add('profile-launch-ghost');
      ghost.querySelectorAll('button').forEach(button => { button.tabIndex = -1; });
      ghost.style.setProperty('position', 'fixed', 'important');
      ghost.style.setProperty('left', `${rect.left}px`, 'important');
      ghost.style.setProperty('top', `${rect.top}px`, 'important');
      ghost.style.setProperty('width', `${rect.width}px`, 'important');
      ghost.style.setProperty('height', `${rect.height}px`, 'important');
      ghost.style.setProperty('margin', '0', 'important');
      ghost.style.setProperty('z-index', '1', 'important');
      ghost.style.setProperty('transform-origin', 'center center', 'important');
      ghost.style.setProperty('pointer-events', 'none', 'important');
      layer.appendChild(explosion);
      layer.appendChild(ghost);
      scope.appendChild(layer);
      source.classList.add('profile-launch-source-hidden');

      const translateX = window.innerWidth / 2 - (rect.left + rect.width / 2);
      const translateY = window.innerHeight / 2 - (rect.top + rect.height / 2);
      const destination = `translate3d(${translateX}px, ${translateY}px, 0) scale(1.34) rotate(720deg)`;
      const launch: ProfileLaunchAnimation = { layer, ghost, source, translateX, translateY, destination, timers: [], explosion };
      profileLaunch.current = launch;
      const flight = ghost.animate([
        { transform: 'translate3d(0, 0, 0) scale(1) rotate(0deg)', offset: 0 },
        { transform: `translate3d(${translateX * .72}px, ${translateY * .72}px, 0) scale(1.22) rotate(500deg)`, offset: .72 },
        { transform: destination, offset: 1 },
      ], { duration: 760, easing: 'cubic-bezier(.18,.78,.22,1)', fill: 'forwards' });
      void flight.finished.then(() => {
        if (profileLaunch.current !== launch) return;
        explosion.style.opacity = '1';
        const pop = ghost.animate([
          { transform: destination, opacity: 1 },
          { transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(1.55) rotate(748deg)`, opacity: 0 },
        ], { duration: 210, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
        const openProfileAfterExplosion = () => {
          if (profileLaunch.current !== launch) return;
          explosion.pause();
          explosion.remove();
          launch.explosion = undefined;
          ghost.style.visibility = 'hidden';
          setProfileEditorOpen(true);
        };
        explosion.addEventListener('ended', openProfileAfterExplosion, { once: true });
        void explosion.play().catch(() => {
          explosion.removeEventListener('ended', openProfileAfterExplosion);
          openProfileAfterExplosion();
        });
        return pop.finished;
      }).then(() => {
        // Keep the complete supplied burst visible before the editor arrives.
      }).catch(() => { /* A canceled launch is cleaned up by the close/unmount path. */ });
    };
    window.addEventListener('nexus-open-profile-editor', openProfileEditor);
    return () => {
      window.removeEventListener('nexus-open-profile-editor', openProfileEditor);
      const launch = profileLaunch.current;
      if (launch) {
        launch.timers.forEach(window.clearTimeout);
        launch.explosion?.pause();
        launch.explosion?.remove();
        launch.source.classList.remove('profile-launch-source-hidden');
        launch.layer.remove();
        profileLaunch.current = null;
      }
    };
  }, [currentUser?.id]);

  const closeProfileEditor = () => {
    setProfileEditorOpen(false);
    const launch = profileLaunch.current;
    if (!launch) return;
    launch.timers.forEach(window.clearTimeout);
    launch.explosion?.pause();
    launch.explosion?.remove();
    launch.explosion = undefined;
    launch.ghost.style.visibility = 'visible';
    const { translateX, translateY } = launch;
    const returnAnimation = launch.ghost.animate([
      { transform: launch.destination, opacity: 0, offset: 0 },
      { transform: `translate3d(${translateX * .92}px, ${translateY * .92}px, 0) scale(1.43) rotate(650deg)`, opacity: 1, offset: .16 },
      { transform: `translate3d(${translateX * .72}px, ${translateY * .72}px, 0) scale(1.17) rotate(500deg)`, offset: .38 },
      { transform: `translate3d(${translateX * .14}px, ${translateY * .14}px, 0) scale(1.02) rotate(90deg)`, offset: .86 },
      { transform: 'translate3d(7px, -3px, 0) scale(1.045) rotate(-3deg)', offset: .94 },
      { transform: 'translate3d(-2px, 1px, 0) scale(.99) rotate(1deg)', offset: .975 },
      { transform: 'translate3d(0, 0, 0) scale(1) rotate(0deg)', opacity: 1, offset: 1 },
    ], { duration: 720, easing: 'cubic-bezier(.2,.72,.26,1)', fill: 'forwards' });
    void returnAnimation.finished.then(() => {
      if (profileLaunch.current !== launch) return;
      launch.source.classList.remove('profile-launch-source-hidden');
      launch.layer.remove();
      profileLaunch.current = null;
    }).catch(() => { /* Clean up on interrupted return motion. */ });
  };

  useEffect(() => {
    if (!currentUser) setProfileEditorOpen(false);
  }, [currentUser?.id]);
  return <div className={isInterior ? `discord-interior-scope ${paletteClass}${customPalette?.animated ? ' discord-ui-palette-animated' : ''}${theme === 'light' ? ' discord-theme-light' : ''}` : 'nexus-route-scope'} data-ui-custom-palette={customPalette ? 'true' : undefined} data-ui-palette-wallpaper={customPalette?.backgroundImage ? 'true' : undefined} data-profile-editor-open={profileEditorOpen ? 'true' : undefined} style={isInterior && currentUser ? customPaletteStyle(uiPalette, theme, currentUser.id, uiPalettePreview || undefined) : undefined}>
    {children}
    {isInterior && currentUser && profileEditorOpen && <ProfileEditor currentUser={currentUser} onProfileUpdated={onProfileUpdated} onClose={closeProfileEditor} />}
    {isInterior && currentUser && <VisualEditor currentUser={currentUser} />}
    {isInterior && <AIQuickPanel currentUser={currentUser} />}
    {isInterior && <DeveloperConsole currentUser={currentUser} />}
  </div>;
};

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserSummary | null>(null);
  const currentUserRef = useRef<UserSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [uiPalette, setUiPalette] = useState<UiPaletteId>('slate');
  const [uiPalettePreview, setUiPalettePreview] = useState<CustomUiPalette | null>(null);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) { wsClient.disconnect(); return; }
    const token = api.getToken();
    if (token) wsClient.connect(token);
    const remove = wsClient.addListener(event => window.dispatchEvent(new CustomEvent('nexus-realtime-event', { detail: event })));
    return () => { remove(); wsClient.disconnect(); };
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser) return;
    writeUserPreference('nexus-interior-theme', currentUser.id, theme);
    writeUiPalette(currentUser.id, uiPalette);
  }, [currentUser?.id, theme, uiPalette]);

  const fetchUser = async () => {
    try {
      if (api.getToken()) {
        const u = await api.getMe();
        const savedTheme = readUserPreference<string>('nexus-interior-theme', u.id, 'dark');
        setTheme(savedTheme === 'light' ? 'light' : 'dark');
        setUiPalette(readUiPalette(u.id));
        setUiPalettePreview(null);
        setCurrentUser(u);
      } else {
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
      api.setToken(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const onAIActionCompleted = (event: Event) => {
      const detail = (event as CustomEvent<{ tool_name?: string; tool_result?: any }>).detail;
      if (detail?.tool_name === 'update_my_profile') void fetchUser();
      if (detail?.tool_name === 'update_my_settings' && detail.tool_result?.status === 'success') {
        const preference = detail.tool_result.settings?.theme_preference;
        const userId = currentUserRef.current?.id;
        const nextTheme = preference === 'dark' || preference === 'light' ? preference : preference === 'system' ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : null;
        if (userId && nextTheme) {
          setTheme(nextTheme);
          writeUserPreference('nexus-interior-theme', userId, nextTheme);
        }
      }
    };
    window.addEventListener('nexus-ai-action-completed', onAIActionCompleted);
    return () => window.removeEventListener('nexus-ai-action-completed', onAIActionCompleted);
  }, []);

  useEffect(() => {
    if (api.getToken()) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogout = () => {
    setCurrentUser(null);
    setTheme('dark');
    setUiPalette('slate');
    setUiPalettePreview(null);
    api.setToken(null);
    if (firebaseAuth) void signOut(firebaseAuth);
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#09090c',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '16px',
      }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '12px',
          background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: '900', fontSize: '24px', color: 'white',
          boxShadow: '0 0 32px rgba(139,92,246,0.6)',
          animation: 'float 2s ease-in-out infinite',
        }}>N</div>
        <p style={{ color: '#8b8a9b', fontSize: '14px' }}>Connecting to NEXUS…</p>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Navigation user={currentUser} onLogout={handleLogout} />
        <RouteShell theme={theme} uiPalette={uiPalette} uiPalettePreview={uiPalettePreview} currentUser={currentUser} onProfileUpdated={fetchUser}>
        <Routes>
          {/* Landing page — always accessible */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/landing" element={<LandingPage />} />

          {/* Auth page supports switching accounts even when the guest session is active */}
          <Route path="/auth" element={<AuthPage onLoginSuccess={fetchUser} />} />

          {/* Inner pages — currentUser is always set (guest auto-login) */}
          <Route path="/dashboard" element={
            currentUser
              ? <DashboardPage currentUser={currentUser} onLogout={handleLogout} />
              : <Navigate to="/" />
          } />
          <Route path="/events/archive" element={
            currentUser
              ? <EventsArchivePage currentUser={currentUser} onLogout={handleLogout} />
              : <Navigate to="/" />
          } />
          <Route path="/history" element={
            currentUser
              ? <HistoryPage currentUser={currentUser} onLogout={handleLogout} />
              : <Navigate to="/" />
          } />
          <Route path="/messaging" element={
            currentUser
              ? <MessagingPage currentUser={currentUser} onLogout={handleLogout} />
              : <Navigate to="/" />
          } />
          <Route path="/ai" element={
            currentUser
              ? <AILoopPage currentUser={currentUser} onLogout={handleLogout} />
              : <Navigate to="/" />
          } />
          <Route path="/latex" element={
            currentUser
              ? <LaTeXEditorPage currentUser={currentUser} onLogout={handleLogout} />
              : <Navigate to="/" />
          } />
          <Route path="/forums" element={
            currentUser
              ? <ForumsPage currentUser={currentUser} onLogout={handleLogout} />
              : <Navigate to="/" />
          } />
          <Route path="/repository" element={
            currentUser
              ? <RepositoryPage currentUser={currentUser} onLogout={handleLogout} />
              : <Navigate to="/" />
          } />
          <Route path="/campus" element={
            currentUser
              ? <CampusHubPage currentUser={currentUser} onLogout={handleLogout} />
              : <Navigate to="/" />
          } />
          <Route path="/courses" element={
            currentUser
              ? <CoursesPage currentUser={currentUser} onLogout={handleLogout} />
              : <Navigate to="/" />
          } />
          <Route path="/studygroups" element={
            currentUser
              ? <StudyGroupsPage currentUser={currentUser} onLogout={handleLogout} />
              : <Navigate to="/" />
          } />
          <Route path="/productivity" element={
            currentUser
              ? <ProductivityPage currentUser={currentUser} onLogout={handleLogout} />
              : <Navigate to="/" />
          } />
          <Route path="/friends" element={
            currentUser
              ? <FriendsPage currentUser={currentUser} onLogout={handleLogout} />
              : <Navigate to="/" />
          } />
          <Route path="/qotd" element={
            currentUser
              ? <QOTDPage currentUser={currentUser} onLogout={handleLogout} defaultTab="question" />
              : <Navigate to="/" />
          } />
          <Route path="/qotd/create" element={
            currentUser
              ? <QOTDCreatePage currentUser={currentUser} onLogout={handleLogout} />
              : <Navigate to="/" />
          } />
          <Route path="/qotd/review" element={
            currentUser
              ? <QOTDProposalReviewPage currentUser={currentUser} onLogout={handleLogout} />
              : <Navigate to="/" />
          } />
          <Route path="/qotd/archive" element={
            currentUser
              ? <QOTDArchivePage currentUser={currentUser} onLogout={handleLogout} />
              : <Navigate to="/" />
          } />
          <Route path="/aotd" element={
            currentUser
              ? <QOTDPage currentUser={currentUser} onLogout={handleLogout} defaultTab="answer" />
              : <Navigate to="/" />
          } />
          <Route path="/notifications" element={
            currentUser
              ? <NotificationsPage currentUser={currentUser} onLogout={handleLogout} />
              : <Navigate to="/" />
          } />
          <Route path="/settings" element={
            currentUser
              ? <SettingsPage currentUser={currentUser} onLogout={handleLogout} onProfileUpdated={fetchUser} theme={theme} onThemeChange={setTheme} uiPalette={uiPalette} onUiPaletteChange={setUiPalette} onUiPalettePreview={setUiPalettePreview} />
              : <Navigate to="/" />
          } />
          <Route path="/profile" element={<Navigate to="/dashboard" replace />} />

          {/* Default: go to landing */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        </RouteShell>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
