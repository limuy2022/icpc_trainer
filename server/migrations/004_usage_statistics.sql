ALTER TABLE usage_log ADD COLUMN kind TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE usage_log ADD COLUMN model_name TEXT;
ALTER TABLE usage_log ADD COLUMN total_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usage_log ADD COLUMN usage_reported INTEGER NOT NULL DEFAULT 0;
UPDATE usage_log SET total_tokens=input_tokens+output_tokens,
 usage_reported=CASE WHEN input_tokens>0 OR output_tokens>0 THEN 1 ELSE 0 END;
CREATE INDEX usage_by_user_time ON usage_log(user_id,created_at);
