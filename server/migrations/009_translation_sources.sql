ALTER TABLE statement_translations ADD COLUMN source_hash TEXT;
ALTER TABLE statement_translations ADD COLUMN model_name TEXT;
UPDATE statement_translations SET model_name=(SELECT model FROM models WHERE models.id=statement_translations.model_id);
CREATE INDEX translation_by_source ON statement_translations(problem_id,source_hash,created_at);
