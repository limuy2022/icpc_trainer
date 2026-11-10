ALTER TABLE models ADD COLUMN max_output_tokens INTEGER CHECK(max_output_tokens IS NULL OR max_output_tokens BETWEEN 1 AND 1048576);
ALTER TABLE models ADD COLUMN output_token_parameter TEXT NOT NULL DEFAULT 'max_tokens' CHECK(output_token_parameter IN ('max_tokens','max_completion_tokens'));
