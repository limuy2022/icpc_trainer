ALTER TABLE users ADD COLUMN site_model_access INTEGER NOT NULL DEFAULT 0 CHECK(site_model_access IN (0,1));
-- Preserve access for accounts that existed before public registration.
UPDATE users SET site_model_access=1;
ALTER TABLE models ADD COLUMN owner_user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX models_owner ON models(owner_user_id);
