-- Remove foreign key constraints that cause cascade deletion of logs
-- This allows deleting workflows without deleting logs (logs should be immutable)
-- Both change_log and executions are audit trails and should remain even if workflow is deleted

-- Remove FK from data_workflow_change_log to data_workflows
ALTER TABLE data_workflow_change_log
DROP CONSTRAINT IF EXISTS fk_workflow_change;

-- Remove FK from data_workflow_executions to data_workflow_versions (cascade deletion)
-- Executions should be preserved as immutable logs
ALTER TABLE data_workflow_executions
DROP CONSTRAINT IF EXISTS fk_version_execution;
