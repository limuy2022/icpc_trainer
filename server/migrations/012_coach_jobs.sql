CREATE TABLE coach_jobs (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 session_id TEXT NOT NULL,
 branch_hash TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('running','done','error','cancelled')),
 text TEXT NOT NULL DEFAULT '',
 reasoning TEXT NOT NULL DEFAULT '',
 result TEXT,
 context TEXT,
 error TEXT,
 request_id TEXT,
 acknowledged INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX coach_jobs_pending ON coach_jobs(user_id,acknowledged,created_at);
CREATE UNIQUE INDEX coach_jobs_one_running ON coach_jobs(user_id) WHERE status='running';
