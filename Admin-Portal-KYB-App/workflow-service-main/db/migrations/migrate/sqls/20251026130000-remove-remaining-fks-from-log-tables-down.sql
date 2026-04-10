-- Re-add the foreign key constraints for rollback
-- Note: This would affect log immutability (not recommended for production use)

-- Re-add FK from data_workflow_change_log to data_workflow_versions
ALTER TABLE data_workflow_change_log
ADD CONSTRAINT fk_version_change
FOREIGN KEY (workflow_version_id) REFERENCES data_workflow_versions(id) ON DELETE CASCADE;

-- Re-add FK from data_workflow_executions to data_workflow_rules
ALTER TABLE data_workflow_executions
ADD CONSTRAINT fk_rule_execution
FOREIGN KEY (matched_rule_id) REFERENCES data_workflow_rules(id) ON DELETE SET NULL;

