-- Migration: Add ARCHIVED status to workflow versions
-- This migration adds the ARCHIVED status to the workflow version status enum
-- and updates existing published versions that are no longer current to ARCHIVED

-- Step 1: Drop the existing constraint
ALTER TABLE data_workflow_versions 
DROP CONSTRAINT IF EXISTS data_workflow_versions_status_check;

-- Step 2: Add the new constraint with ARCHIVED status
ALTER TABLE data_workflow_versions 
ADD CONSTRAINT data_workflow_versions_status_check 
CHECK (status IN ('draft', 'published', 'archived'));

-- Step 3: Update existing published versions that are no longer current to ARCHIVED
-- This handles the case where we have published versions that are not current
UPDATE data_workflow_versions 
SET status = 'archived', 
    updated_at = CURRENT_TIMESTAMP,
    updated_by = '00000000-0000-0000-0000-000000000000'::uuid -- System user
WHERE status = 'published' 
  AND is_current = false;

-- Step 4: Update the unique index to handle ARCHIVED status
-- Drop the existing unique index
DROP INDEX IF EXISTS uniq_current_published;

-- Create a new unique index that only applies to published versions
CREATE UNIQUE INDEX uniq_current_published
ON data_workflow_versions(workflow_id)
WHERE status = 'published' AND is_current = true;

-- Step 5: Add a comment to document the status transitions
COMMENT ON COLUMN data_workflow_versions.status IS 'Workflow version status: draft (editable), published (active), archived (retired)';
