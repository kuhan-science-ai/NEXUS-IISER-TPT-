import React from 'react';
import { Link } from 'react-router-dom';
import { Bell, Search } from 'lucide-react';
import { UserSummary } from '../services/api';

interface TopHeaderProps {
  breadcrumb: string;
  currentUser?: UserSummary | null;
  onOpenSearch: () => void;
  onOpenUpload?: () => void;
  actionButton?: {
    label: string;
    onClick: () => void;
    icon?: string;
  };
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  breadcrumb,
  currentUser,
  onOpenSearch,
  onOpenUpload,
  actionButton,
}) => {
  const displayName = currentUser?.display_name || currentUser?.full_name || currentUser?.username || 'Ananya Rao';
  const initials = displayName
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'AR';

  return (
    <header className="discord-top-header" style={{
      height: '72px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg-navigation)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      position: 'sticky',
      top: 0,
      zIndex: 30,
      gap: '16px',
    }}>
      {/* Breadcrumb path */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '13.5px',
        color: 'var(--text-muted)',
      }}>
        <span style={{ color: 'var(--text-subtle)' }}>N</span>
        <span style={{ color: 'var(--text-faint)' }}>/</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{breadcrumb}</span>
      </div>

      {/* Middle Search trigger (Page 24 Figma specs) */}
      <div
        onClick={onOpenSearch}
        style={{
          flex: '1',
          maxWidth: '460px',
          height: '38px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 14px',
          cursor: 'pointer',
          color: 'var(--text-subtle)',
          fontSize: '13px',
          transition: 'all var(--transition)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-bright)';
          e.currentTarget.style.background = 'var(--bg-raised)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.background = 'var(--bg-surface)';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Search size={15} strokeWidth={1.7} />
          <span>Search resources, people, conversations…</span>
        </div>
        <kbd style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '11px',
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
        }}>
          ⌘ K
        </kbd>
      </div>

      {/* Right Actions & User Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Link
          to="/notifications"
          aria-label="Notifications"
          title="Notifications"
          style={{ color: 'var(--text-muted)', display: 'inline-flex', padding: '6px', borderRadius: '6px' }}
        >
          <Bell size={16} strokeWidth={1.7} />
        </Link>
        {onOpenUpload && (
          <button
            onClick={onOpenUpload}
            style={{
              background: 'var(--primary)',
              color: '#ffffff',
              padding: '7px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: 'var(--shadow-sm)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--primary-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--primary)')}
          >
            <span>↑</span> Upload resource
          </button>
        )}

        {actionButton && (
          <button
            onClick={actionButton.onClick}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              padding: '7px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-raised)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-surface)')}
          >
            {actionButton.icon && <span>{actionButton.icon}</span>}
            {actionButton.label}
          </button>
        )}

        <button type="button" aria-label="Open my profile" title="My profile" onClick={() => window.dispatchEvent(new Event('nexus-open-profile-editor'))} style={{
          width: '30px',
          height: '30px',
          borderRadius: '50%',
          background: 'var(--bg-raised)',
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: 700,
          color: 'var(--primary)',
          padding: 0,
          cursor: 'pointer',
        }}>
          {initials}
        </button>
      </div>
    </header>
  );
};
