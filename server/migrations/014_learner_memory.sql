ALTER TABLE users ADD COLUMN learner_memory TEXT NOT NULL DEFAULT '{"enabled":true,"background":"","goal":"","algorithms":[]}';
ALTER TABLE users ADD COLUMN learner_memory_revision INTEGER NOT NULL DEFAULT 0;
