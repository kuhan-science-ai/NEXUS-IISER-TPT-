import React from 'react';

export interface AvatarUser {
  username?: string | null;
  full_name?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  avatar_file_id?: string | null;
  avatar_mime_type?: string | null;
}

export const ProfileAvatar: React.FC<{ user?: AvatarUser | null; className: string; label?: string; size?: number }> = ({ user, className, label, size }) => {
  const name = user?.display_name || user?.full_name || user?.username || label || '?';
  const initials = name.split(/\s+/).filter(Boolean).map(part => part[0]).join('').slice(0, 2).toUpperCase();
  const src = user?.avatar_url || (user?.avatar_file_id ? `/api/v1/files/${user.avatar_file_id}/download` : '');
  const style = { overflow: 'hidden', borderRadius: '50%', ...(size ? { width: size, height: size, flexBasis: size } : {}) };
  return <span className={className} style={style} aria-label={`${name} profile picture`}>
    {src ? user?.avatar_mime_type?.startsWith('video/')
      ? <video src={src} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      : <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      : initials}
  </span>;
};
