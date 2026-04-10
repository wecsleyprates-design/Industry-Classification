/* Revert: re-apply NOT NULL constraint on date column (existing NULL values will need manual backfill first) */
UPDATE integration_data.adverse_media_articles SET date = created_at WHERE date IS NULL;
ALTER TABLE integration_data.adverse_media_articles ALTER COLUMN date SET NOT NULL;
