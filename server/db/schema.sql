-- One row per generation attempt (Generate button click).
-- status: 'in_progress' while running, then 'completed' | 'cancelled' | 'failed'.
-- 'cancelled' means the Cancel button was used before the request finished.
CREATE TABLE IF NOT EXISTS generation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  format TEXT NOT NULL,
  source_filename TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress',
  duration_ms INTEGER,
  html_content TEXT
);
