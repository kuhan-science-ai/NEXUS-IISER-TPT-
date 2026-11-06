import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Activity, Bell, BookOpen, BriefcaseBusiness, CalendarDays, Check, CircleHelp, Home,
  FileText, FolderOpen, LayoutDashboard, LogOut, MessageCircle,
  MessagesSquare, Radio, Search, Settings, Sparkles, UserRound,
  Users, type LucideIcon,
} from 'lucide-react';
import { api, UserSummary } from '../services/api';
import { readUserPreference, writeUserPreference } from '../services/userPreferences';

interface SideNavProps {
  currentUser: UserSummary;
  onLogout?: () => void;
  onOpenSearch?: () => void;
}

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
}

export const SideNav: React.FC<SideNavProps> = ({ currentUser, onLogout, onOpenSearch }) => {
  const loc = useLocation();
  const [collapsed, setCollapsed] = useState(() => readUserPreference('nexus-sidebar-collapsed', currentUser.id, false));

  React.useEffect(() => {
    setCollapsed(readUserPreference('nexus-sidebar-collapsed', currentUser.id, false));
  }, [currentUser.id]);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      writeUserPreference('nexus-sidebar-collapsed', currentUser.id, next);
      return next;
    });
  };

  const handleLogout = async () => {
    await api.logout();
    onLogout?.();
  };

  const openMyProfile = (event: React.MouseEvent<HTMLElement>) => {
    const source = event.currentTarget.closest('.discord-profile-footer') as HTMLElement | null;
    window.dispatchEvent(new CustomEvent('nexus-open-profile-editor', { detail: { source } }));
  };

  const displayName = currentUser.display_name || currentUser.full_name || currentUser.username || 'Ananya Rao';
  const initials = displayName
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'AR';

  const workspaceItems: NavItem[] = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/repository', label: 'Academic Repository', icon: FolderOpen },
    { to: '/courses', label: 'My Courses', icon: BookOpen },
    { to: '/studygroups', label: 'Study Groups', icon: Users },
    { to: '/productivity', label: 'Productivity', icon: Check },
  ];

  const communityItems: NavItem[] = [
    { to: '/friends', label: 'Friends', icon: UserRound },
    { to: '/messaging', label: 'Messenger', icon: MessageCircle, badge: 3 },
    { to: '/forums', label: 'Discussion Forums', icon: MessagesSquare },
    { to: '/qotd', label: 'Question of the Day', icon: CircleHelp },
    { to: '/aotd', label: 'Answer of the Day', icon: Sparkles },
  ];

  const campusItems: NavItem[] = [
    { to: '/campus', label: 'Campus Pulse', icon: Radio },
    { to: '/campus?tab=events', label: 'Events', icon: CalendarDays },
    { to: '/campus?tab=lostfound', label: 'Lost & Found', icon: Search },
    { to: '/campus?tab=opportunities', label: 'Opportunities', icon: BriefcaseBusiness },
  ];

  const toolsItems: NavItem[] = [
    { to: '/ai', label: 'AI Study Companion', icon: Activity },
    { to: '/latex', label: 'LaTeX Studio', icon: FileText },
  ];

  const renderSection = (title: string, items: NavItem[]) => (
    <div style={{ marginBottom: '16px' }}>
      {!collapsed && (
        <div style={{
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: 'var(--text-subtle)',
          padding: '0 12px 6px',
          textTransform: 'uppercase',
        }}>
          {title}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {items.map((item) => {
          const active = loc.pathname === item.to || (item.to.includes('?') && loc.pathname + loc.search === item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={active ? 'active' : undefined}
              title={collapsed ? item.label : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: collapsed ? '10px 0' : '8px 12px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: 'var(--radius-sm)',
                color: active ? '#ffffff' : 'var(--text-muted)',
                background: active ? 'var(--bg-raised)' : 'transparent',
                border: active ? '1px solid var(--border)' : '1px solid transparent',
                fontSize: '12px',
                fontWeight: active ? 600 : 450,
                textDecoration: 'none',
                transition: 'all var(--transition)',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }
              }}
            >
              <span style={{
                width: '18px',
                display: 'inline-flex',
                justifyContent: 'center',
                color: active ? 'var(--primary)' : 'inherit',
              }}>
                <item.icon size={15} strokeWidth={1.7} aria-hidden="true" />
              </span>
              {!collapsed && (
                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.label}
                </span>
              )}
              {!collapsed && item.badge && (
                <span style={{
                  background: 'var(--primary)',
                  color: '#ffffff',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: '10px',
                  lineHeight: '14px',
                }}>
                  {item.badge}
                </span>
              )}
              {collapsed && item.badge && (
                <span style={{
                  position: 'absolute',
                  top: '4px',
                  right: '6px',
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: 'var(--primary)',
                }} />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );

  return (
    <aside className={`discord-channel-sidebar${collapsed ? ' is-collapsed' : ''}`} style={{
      width: collapsed ? '72px' : '232px',
      minHeight: '100vh',
      background: 'var(--bg-navigation)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '12px 10px',
      position: 'sticky',
      top: 0,
      flexShrink: 0,
      transition: 'width var(--transition)',
      zIndex: 40,
    }}>
      <nav className="discord-server-rail" aria-label="Quick navigation">
        <Link to="/dashboard" className="discord-rail-home" aria-label="NEXUS home" title="NEXUS">N</Link>
        <span className="discord-rail-divider" />
        {[workspaceItems, communityItems, campusItems, toolsItems].map((group, groupIndex) => (
          <React.Fragment key={groupIndex}>
            {groupIndex > 0 && <span className="discord-rail-divider" />}
            <div className="discord-rail-group" aria-label={['Workspace', 'Community', 'Campus', 'Tools'][groupIndex]}>
              {group.map((item) => {
                const active = loc.pathname === item.to || (item.to.includes('?') && loc.pathname + loc.search === item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={active ? 'active' : ''}
                    aria-label={item.label}
                    title={item.label}
                  >
                    <item.icon size={17} strokeWidth={1.9} aria-hidden="true" />
                    {item.badge && <span className="discord-rail-badge" aria-label={`${item.badge} unread`}>{item.badge}</span>}
                  </Link>
                );
              })}
            </div>
          </React.Fragment>
        ))}
        <span className="discord-rail-divider" />
        <div className="discord-rail-group" aria-label="Account">
          <button type="button" aria-label="Open my profile" title="My profile" onClick={openMyProfile}><UserRound size={17} /></button>
          <Link to="/notifications" className={loc.pathname === '/notifications' ? 'active' : ''} aria-label="Notifications" title="Notifications"><Bell size={17} /></Link>
          <Link to="/settings" className={loc.pathname === '/settings' ? 'active' : ''} aria-label="Settings" title="Settings"><Settings size={17} /></Link>
        </div>
        <button className="discord-rail-collapse" onClick={toggleCollapsed} aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'} title={collapsed ? 'Expand navigation' : 'Collapse navigation'}>
          {collapsed ? '›' : '‹'}
        </button>
      </nav>
      <div className="discord-channel-panel">
      {/* Brand Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        paddingBottom: '12px',
        borderBottom: '1px solid var(--border)',
        marginBottom: '16px',
      }}>
        <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '6px',
            background: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '15px',
            color: '#ffffff',
            boxShadow: 'none',
            letterSpacing: '-0.5px',
            flexShrink: 0,
          }}>
            N
          </div>
          {!collapsed && (
            <div>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: '14px',
                letterSpacing: '0.08em',
                color: 'var(--text-primary)',
                lineHeight: 1.1,
              }}>
                NEXUS
              </div>
              <div style={{
                fontSize: '8px',
                color: 'var(--text-subtle)',
                fontWeight: 500,
                marginTop: '2px',
              }}>
                IISER Tirupati · Students only
              </div>
            </div>
          )}
        </Link>
        <button
          onClick={toggleCollapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            background: 'transparent',
            color: 'var(--text-subtle)',
            padding: '4px 6px',
            borderRadius: '6px',
            fontSize: '12px',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-subtle)')}
        >
          {collapsed ? '▶' : '◀'}
        </button>
      </div>

      {/* Nav Sections Scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingRight: '2px' }}>
        {renderSection('Workspace', workspaceItems)}
        {renderSection('Community', communityItems)}
        {renderSection('Campus', campusItems)}
        {renderSection('Tools', toolsItems)}
      </div>

      {/* Footer Profile & Preferences */}
      <div className="discord-profile-footer" style={{
        borderTop: '1px solid var(--border)',
        paddingTop: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      }}>
        <button
          type="button"
          className="discord-profile-link"
          aria-label="Open my profile settings"
          onClick={openMyProfile}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: collapsed ? '8px 0' : '8px 10px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            borderRadius: 'var(--radius-sm)',
            textDecoration: 'none',
            background: 'transparent',
            transition: 'background var(--transition)',
            border: 0,
            color: 'inherit',
            font: 'inherit',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-raised)')}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <div className="discord-profile-avatar" style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #1C1E26, #2A2C36)',
            border: '1.5px solid var(--primary)',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: 700,
            flexShrink: 0,
          }}>
            {currentUser.avatar_file_id || currentUser.avatar_url
              ? <img src={currentUser.avatar_url || `/api/v1/files/${currentUser.avatar_file_id}/download`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
              : initials}
          </div>
          {!collapsed && (
            <div className="discord-profile-identity" style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {displayName}
              </div>
              <div style={{
                fontSize: '11px',
                color: 'var(--secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <span>✓</span> Verified student
              </div>
            </div>
          )}
        </button>

        {/* Quick Utility Links (Notifications, Settings, Logout) */}
        <div className="discord-profile-utility" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          padding: '4px 6px',
        }}>
          {!collapsed ? (
            <>
              <Link
                to="/notifications"
                title="Notifications"
                style={{
                  color: loc.pathname === '/notifications' ? 'var(--primary)' : 'var(--text-subtle)',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 6px',
                  borderRadius: '6px',
                }}
              >
                <Bell size={14} strokeWidth={1.7} /> <span style={{ fontSize: '11px' }}>Updates</span>
              </Link>
              <Link
                to="/settings"
                title="Settings"
                style={{
                  color: loc.pathname === '/settings' ? 'var(--primary)' : 'var(--text-subtle)',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 6px',
                  borderRadius: '6px',
                }}
              >
                <Settings size={14} strokeWidth={1.7} /> <span style={{ fontSize: '11px' }}>Settings</span>
              </Link>
              <button
                onClick={handleLogout}
                title="Sign out"
                style={{
                  background: 'transparent',
                  color: 'var(--text-subtle)',
                  fontSize: '11.5px',
                  padding: '4px 6px',
                  borderRadius: '6px',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-subtle)')}
              >
                <LogOut size={14} strokeWidth={1.7} />
              </button>
            </>
          ) : (
            <button
              onClick={handleLogout}
              title="Sign out"
              style={{
                background: 'transparent',
                color: 'var(--text-subtle)',
                fontSize: '14px',
                padding: '6px',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-subtle)')}
            >
              ⎋
            </button>
          )}
        </div>
      </div>
      </div>
    </aside>
  );
};
