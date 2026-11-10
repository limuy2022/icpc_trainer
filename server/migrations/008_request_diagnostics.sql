ALTER TABLE usage_log ADD COLUMN request_id TEXT;
ALTER TABLE usage_log ADD COLUMN duration_ms INTEGER;
ALTER TABLE usage_log ADD COLUMN error_code TEXT;
ALTER TABLE usage_log ADD COLUMN finish_reason TEXT;
CREATE INDEX usage_request_id ON usage_log(request_id);
