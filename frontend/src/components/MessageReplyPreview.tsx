import React from 'react';
import { AvatarUser, ProfileAvatar } from './ProfileAvatar';
import { TwemojiText } from './TwemojiText';
import './MessageReplyPreview.css';

interface MessageReplyPreviewProps {
  author: string;
  content: string;
  user?: AvatarUser | null;
  onClick: () => void;
  ariaLabel: string;
}

export const MessageReplyPreview: React.FC<MessageReplyPreviewProps> = ({ author, content, user, onClick, ariaLabel }) => (
  <button type="button" className="nexus-message-reply-preview" onClick={onClick} aria-label={ariaLabel} title={content}>
    <span className="nexus-reply-connector" aria-hidden="true" />
    <span className="nexus-reply-preview-content">
      <ProfileAvatar className="nexus-reply-avatar" user={user} label={author} size={16} />
      <span className="nexus-reply-preview-copy">
        <span className="nexus-reply-author" title={author}>{author}</span>
        <TwemojiText className="nexus-reply-quoted-message">{content}</TwemojiText>
      </span>
    </span>
  </button>
);
