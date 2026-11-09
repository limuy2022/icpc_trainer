CREATE TABLE statement_translations (
 cache_key TEXT PRIMARY KEY,
 problem_id TEXT NOT NULL,
 model_id TEXT NOT NULL,
 translation TEXT NOT NULL,
 created_at TEXT NOT NULL
);
