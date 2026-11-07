ALTER TABLE user_profiles ADD COLUMN avatar_mime_type TEXT;
ALTER TABLE user_profiles ADD COLUMN banner_mime_type TEXT;
CREATE TABLE IF NOT EXISTS profile_media_chunks (
  media_id TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('avatar', 'banner')),
  mime_type TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  data_base64 TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(media_id, chunk_index)
);
CREATE INDEX IF NOT EXISTS idx_profile_media_owner ON profile_media_chunks(owner_id, created_at);
