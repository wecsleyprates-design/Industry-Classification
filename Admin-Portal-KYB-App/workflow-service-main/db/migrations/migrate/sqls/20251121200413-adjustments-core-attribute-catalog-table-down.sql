-- Rollback migration: Revert core_attribute_catalog table changes
-- This migration removes constraints, indexes and renames source back to category

-- Drop unique index
DROP INDEX IF EXISTS uniq_attribute_catalog_source_path;

-- Restore allowed_operators column (if it was dropped)
ALTER TABLE core_attribute_catalog
ADD COLUMN IF NOT EXISTS allowed_operators JSONB;

-- Restore default_value column (if it was dropped)
ALTER TABLE core_attribute_catalog
ADD COLUMN IF NOT EXISTS default_value TEXT;

-- Remove NOT NULL constraint from source
ALTER TABLE core_attribute_catalog 
ALTER COLUMN source DROP NOT NULL;

-- Rename source column back to category
ALTER TABLE core_attribute_catalog 
RENAME COLUMN source TO category;

-- Remove comments (note: source was renamed to category above, so we reference category)
COMMENT ON COLUMN core_attribute_catalog.context IS NULL;
COMMENT ON COLUMN core_attribute_catalog.category IS NULL;
COMMENT ON COLUMN core_attribute_catalog.path IS NULL;
