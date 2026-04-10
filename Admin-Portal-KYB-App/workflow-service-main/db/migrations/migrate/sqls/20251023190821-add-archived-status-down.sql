-- Rollback migration: Remove ARCHIVED status from workflow versions
-- This migration removes the ARCHIVED status and reverts to the original constraint

-- Step 1: Update ARCHIVED versions back to PUBLISHED
-- Note: This is a destructive operation as we lose the distinction between
-- current and non-current published versions
UPDATE data_workflow_versions 
SET status = 'published', 
    updated_at = CURRENT_TIMESTAMP,
    updated_by = '00000000-0000-0000-0000-000000000000'::uuid -- System user
WHERE status = 'archived';

-- Step 2: Drop the new constraint
ALTER TABLE data_workflow_versions 
DROP CONSTRAINT IF EXISTS data_workflow_versions_status_check;

-- Step 3: Restore the original constraint
ALTER TABLE data_workflow_versions 
ADD CONSTRAINT data_workflow_versions_status_check 
CHECK (status IN ('draft', 'published'));

-- Step 4: Restore the original unique index
DROP INDEX IF EXISTS uniq_current_published;

CREATE UNIQUE INDEX uniq_current_published
ON data_workflow_versions(workflow_id)
WHERE status = 'published' AND is_current = true;

-- Step 5: Remove the comment
COMMENT ON COLUMN data_workflow_versions.status IS NULL;
