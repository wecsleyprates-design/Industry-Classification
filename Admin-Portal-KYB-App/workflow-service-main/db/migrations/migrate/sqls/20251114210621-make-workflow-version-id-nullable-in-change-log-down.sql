-- Delete change logs with NULL workflow_version_id (e.g., priority change logs)
-- before setting the column back to NOT NULL
DELETE FROM data_workflow_change_log
WHERE workflow_version_id IS NULL;

-- Now we can safely set the column back to NOT NULL
ALTER TABLE data_workflow_change_log
ALTER COLUMN workflow_version_id SET NOT NULL;