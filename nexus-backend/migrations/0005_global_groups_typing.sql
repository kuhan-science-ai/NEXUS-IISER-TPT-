PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS campus_groups (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '✦',
  banner TEXT NOT NULL DEFAULT '#7c5cff',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_campus_groups_updated ON campus_groups(updated_at DESC);

CREATE TABLE IF NOT EXISTS campus_group_members (
  group_id TEXT NOT NULL REFERENCES campus_groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('owner','member')),
  joined_at TEXT NOT NULL,
  PRIMARY KEY(group_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_campus_group_members_user ON campus_group_members(user_id,group_id);

CREATE TABLE IF NOT EXISTS campus_group_channels (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES campus_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE(group_id,name)
);
CREATE INDEX IF NOT EXISTS idx_campus_group_channels_group ON campus_group_channels(group_id,position);

CREATE TABLE IF NOT EXISTS campus_group_messages (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES campus_groups(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL REFERENCES campus_group_channels(id) ON DELETE CASCADE,
  sender_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  reply_to_id TEXT REFERENCES campus_group_messages(id) ON DELETE SET NULL,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_campus_group_messages_channel ON campus_group_messages(channel_id,created_at);

CREATE TABLE IF NOT EXISTS campus_group_message_reactions (
  message_id TEXT NOT NULL REFERENCES campus_group_messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(message_id,user_id,emoji)
);

CREATE TABLE IF NOT EXISTS typing_indicators (
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(conversation_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_typing_indicators_updated ON typing_indicators(conversation_id,updated_at);
