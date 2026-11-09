ALTER TABLE users ADD COLUMN cf_rating INTEGER CHECK(cf_rating IS NULL OR (cf_rating>=0 AND cf_rating<=5000));
