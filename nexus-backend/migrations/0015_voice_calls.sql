CREATE TABLE IF NOT EXISTS voice_call_sessions (
  id TEXT PRIMARY KEY,
  room_name TEXT NOT NULL UNIQUE,
  room_type TEXT NOT NULL CHECK (room_type IN ('direct', 'group_channel')),
  conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
  group_id TEXT REFERENCES campus_groups(id) ON DELETE CASCADE,
  channel_id TEXT REFERENCES campus_group_channels(id) ON DELETE CASCADE,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  created_at TEXT NOT NULL,
  ended_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_voice_calls_conversation ON voice_call_sessions(conversation_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_voice_calls_channel ON voice_call_sessions(channel_id, status, created_at);

CREATE TABLE IF NOT EXISTS voice_channel_messages (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES campus_groups(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL REFERENCES campus_group_channels(id) ON DELETE CASCADE,
  sender_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL DEFAULT '',
  reply_to_id TEXT REFERENCES voice_channel_messages(id) ON DELETE SET NULL,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_voice_messages_channel_created ON voice_channel_messages(channel_id, created_at);
