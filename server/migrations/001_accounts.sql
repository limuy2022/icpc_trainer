CREATE TABLE users (
 id TEXT PRIMARY KEY,
 username TEXT NOT NULL UNIQUE COLLATE NOCASE,
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('admin','member')),
 disabled INTEGER NOT NULL DEFAULT 0,
 must_change_password INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL,
 last_login TEXT
);
CREATE TABLE login_sessions (
 token_hash TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL
);
CREATE INDEX login_sessions_user ON login_sessions(user_id);
CREATE TABLE training_data (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 payload TEXT NOT NULL DEFAULT '[]',
 revision INTEGER NOT NULL DEFAULT 0,
 updated_at TEXT NOT NULL
);
CREATE TABLE models (
 id TEXT PRIMARY KEY,
 label TEXT NOT NULL,
 provider TEXT NOT NULL CHECK(provider IN ('glm','openai-compatible')),
 base_url TEXT NOT NULL,
 model TEXT NOT NULL,
 encrypted_key TEXT,
 env_key INTEGER NOT NULL DEFAULT 0,
 enabled INTEGER NOT NULL DEFAULT 1,
 is_default INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX one_default_model ON models(is_default) WHERE is_default=1;
CREATE TABLE auth_throttle (
 key TEXT PRIMARY KEY,
 attempts INTEGER NOT NULL,
 window_start INTEGER NOT NULL
);
CREATE TABLE usage_log (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id TEXT NOT NULL REFERENCES users(id),
 model_id TEXT,
 status INTEGER NOT NULL,
 input_tokens INTEGER NOT NULL DEFAULT 0,
 output_tokens INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL
);
CREATE TABLE audit_log (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 actor_id TEXT,
 action TEXT NOT NULL,
 target TEXT,
 created_at TEXT NOT NULL
);
