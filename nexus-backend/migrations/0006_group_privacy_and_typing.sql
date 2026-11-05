-- Migration 0006: Add is_public to campus_groups and group channel typing indicators

ALTER TABLE campus_groups ADD COLUMN is_public INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS campus_group_typing (
  group_id TEXT NOT NULL REFERENCES campus_groups(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL REFERENCES campus_group_channels(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(channel_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_group_typing_updated ON campus_group_typing(channel_id, updated_at);
