-- Remove remaining foreign key constraints from log tables
-- This completes the removal of FKs from audit log tables to ensure complete immutability
-- Previous migration (remove-cascade-fks-immutable-logs) only removed some FKs
-- This migration removes the remaining FKs that could affect log integrity

-- Remove FK from data_workflow_change_log to data_workflow_versions
-- Note: Log tables should not have FKs to preserve historical data even when referenced items are deleted
ALTER TABLE data_workflow_change_log
DROP CONSTRAINT IF EXISTS fk_version_change;

-- Remove FK from data_workflow_executions to data_workflow_rules
-- This FK was not removed in the previous migration and could cause issues if rules are deleted
ALTER TABLE data_workflow_executions
DROP CONSTRAINT IF EXISTS fk_rule_execution;
