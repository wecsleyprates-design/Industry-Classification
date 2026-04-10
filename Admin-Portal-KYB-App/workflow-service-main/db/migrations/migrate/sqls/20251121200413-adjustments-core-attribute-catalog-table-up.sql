-- Migration: Adjustments to core_attribute_catalog table
-- This migration renames category to source, adds constraints and indexes
-- Note: Path validation is handled at application level (validatePathMatchesSource) for flexibility

-- Rename category column to source
ALTER TABLE core_attribute_catalog 
RENAME COLUMN category TO source;

-- Add NOT NULL constraint to source (since it's required for technical source identification)
ALTER TABLE core_attribute_catalog 
ALTER COLUMN source SET NOT NULL;

-- Add unique constraint on (source, path) for active attributes
CREATE UNIQUE INDEX uniq_attribute_catalog_source_path 
ON core_attribute_catalog(source, path) 
WHERE active = true;

-- Drop allowed_operators column (no longer used, operators are determined by data_type)
ALTER TABLE core_attribute_catalog
DROP COLUMN IF EXISTS allowed_operators;

-- Drop default_value column (not used)
ALTER TABLE core_attribute_catalog
DROP COLUMN IF EXISTS default_value;

-- Add comments for documentation
COMMENT ON COLUMN core_attribute_catalog.context IS 'Business category context (e.g., Financial, KYB, KYC) for UI grouping';
COMMENT ON COLUMN core_attribute_catalog.source IS 'Technical data source (e.g., facts, case, etc.) for system evaluation';
COMMENT ON COLUMN core_attribute_catalog.path IS 'Full attribute path (e.g., facts.credit_score) - must start with source prefix';
