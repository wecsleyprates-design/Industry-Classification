-- Re-add the foreign key constraints if we need to rollback
-- Note: This would cascade delete logs if workflow is deleted (not recommended)

-- Re-add FK from data_workflow_change_log to data_workflows
ALTER TABLE data_workflow_change_log
ADD CONSTRAINT fk_workflow_change 
FOREIGN KEY (workflow_id) REFERENCES data_workflows(id) ON DELETE CASCADE;

-- Re-add FK from data_workflow_executions to data_workflow_versions
ALTER TABLE data_workflow_executions
ADD CONSTRAINT fk_version_execution
FOREIGN KEY (workflow_version_id) REFERENCES data_workflow_versions(id) ON DELETE CASCADE;