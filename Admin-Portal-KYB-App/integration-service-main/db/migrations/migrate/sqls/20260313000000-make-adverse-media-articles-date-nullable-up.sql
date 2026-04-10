/* Allow NULL dates in adverse_media_articles for providers that do not supply article publish dates (e.g. Trulioo) */
ALTER TABLE integration_data.adverse_media_articles ALTER COLUMN date DROP NOT NULL;
