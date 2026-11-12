CREATE TABLE IF NOT EXISTS academic_resources (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subject_code TEXT NOT NULL,
  publisher_name TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  size_bytes INTEGER NOT NULL CHECK(size_bytes > 0),
  pages INTEGER NOT NULL CHECK(pages > 0),
  download_count INTEGER NOT NULL DEFAULT 0 CHECK(download_count >= 0),
  uploader_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS academic_resource_chunks (
  resource_id TEXT NOT NULL REFERENCES academic_resources(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  data_base64 TEXT NOT NULL,
  PRIMARY KEY(resource_id, chunk_index)
);

CREATE TABLE IF NOT EXISTS saved_academic_resources (
  resource_id TEXT NOT NULL REFERENCES academic_resources(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY(resource_id, user_id)
);

CREATE TABLE IF NOT EXISTS academic_resource_views (
  resource_id TEXT NOT NULL REFERENCES academic_resources(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at TEXT NOT NULL,
  PRIMARY KEY(resource_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_academic_resources_created ON academic_resources(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_academic_resources_uploader ON academic_resources(uploader_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_academic_resource_views_user ON academic_resource_views(user_id, viewed_at DESC);
