-- Drop indexes
DROP INDEX IF EXISTS idx_workflow_change_log_customer;
DROP INDEX IF EXISTS idx_workflow_executions_workflow;
DROP INDEX IF EXISTS idx_workflow_executions_customer;

-- Drop columns
ALTER TABLE data_workflow_change_log 
DROP COLUMN IF EXISTS customer_id;

ALTER TABLE data_workflow_executions 
DROP COLUMN IF EXISTS workflow_id,
DROP COLUMN IF EXISTS customer_id,
DROP COLUMN IF EXISTS action_applied;
