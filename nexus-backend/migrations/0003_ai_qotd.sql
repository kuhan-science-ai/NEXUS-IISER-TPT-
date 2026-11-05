PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ai_conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES ai_conversations(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New AI Conversation',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_updated ON ai_conversations(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_parent ON ai_conversations(parent_id);

CREATE TABLE IF NOT EXISTS ai_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user','assistant','system','tool')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_created ON ai_messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS daily_questions (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  question_latex TEXT NOT NULL,
  explanation_latex TEXT NOT NULL,
  options_json TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 10,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_question_answers (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES daily_questions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answer_latex TEXT NOT NULL,
  selected_option INTEGER NOT NULL DEFAULT 0 CHECK(selected_option BETWEEN 0 AND 3),
  attachment_file_id TEXT,
  points_awarded INTEGER NOT NULL DEFAULT 10,
  submitted_at TEXT NOT NULL,
  UNIQUE(question_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_daily_question_answers_question ON daily_question_answers(question_id, submitted_at);
CREATE INDEX IF NOT EXISTS idx_daily_question_answers_user ON daily_question_answers(user_id, submitted_at);

CREATE TABLE IF NOT EXISTS daily_question_answer_comments (
  id TEXT PRIMARY KEY,
  answer_id TEXT NOT NULL REFERENCES daily_question_answers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_comment_id TEXT REFERENCES daily_question_answer_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_daily_question_comments_answer ON daily_question_answer_comments(answer_id, created_at);

CREATE TABLE IF NOT EXISTS daily_question_proposals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  question_latex TEXT NOT NULL,
  options_json TEXT NOT NULL,
  correct_option INTEGER NOT NULL CHECK(correct_option BETWEEN 0 AND 3),
  explanation_latex TEXT NOT NULL,
  template_notes TEXT NOT NULL DEFAULT '',
  animation_notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_daily_question_proposals_submitted ON daily_question_proposals(submitted_at);

INSERT OR IGNORE INTO daily_questions(id,date,category,question_latex,explanation_latex,options_json,points,created_at)
VALUES(
  'qotd-seed-20261105', '2026-11-05', 'Physics',
  'State the time-dependent Schrodinger wave equation: $i\hbar \frac{\partial}{\partial t} \Psi(\mathbf{r}, t) = \hat{H}\Psi(\mathbf{r}, t)$.',
  'It describes how a quantum state changes over time under a Hamiltonian: $i\hbar \partial_t \Psi = \hat{H}\Psi$.',
  '["It describes time evolution of a quantum state","It gives the probability density directly","It defines the position operator","It states conservation of particle number"]',
  10, strftime('%Y-%m-%dT%H:%M:%f+00:00','now')
);
