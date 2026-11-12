CREATE TABLE IF NOT EXISTS academic_resource_artwork (
  resource_id TEXT NOT NULL REFERENCES academic_resources(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('thumbnail', 'banner')),
  mime_type TEXT NOT NULL CHECK(mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  chunk_index INTEGER NOT NULL,
  data_base64 TEXT NOT NULL,
  PRIMARY KEY(resource_id, kind, chunk_index)
);
