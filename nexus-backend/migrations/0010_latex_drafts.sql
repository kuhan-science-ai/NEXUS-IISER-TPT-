CREATE TABLE IF NOT EXISTS latex_drafts (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  engine TEXT NOT NULL CHECK(engine IN ('katex', 'tectonic')),
  source TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id, engine)
);
