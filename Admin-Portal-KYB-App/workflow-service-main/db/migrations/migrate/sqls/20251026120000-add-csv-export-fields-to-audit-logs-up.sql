-- Add customer_id, workflow_id, and action_applied to data_workflow_executions table
-- Note: No foreign key constraints are added to preserve audit log integrity.
-- When workflows or customers are deleted, their historical logs must remain intact for auditing purposes.
-- Note: PostgreSQL doesn't support column positioning in ALTER TABLE, so columns will be added at the end
-- action_applied stores the complete action that was executed for immutable audit logs
ALTER TABLE data_workflow_executions 
ADD COLUMN IF NOT EXISTS workflow_id UUID,
ADD COLUMN IF NOT EXISTS customer_id UUID,
ADD COLUMN IF NOT EXISTS action_applied JSONB;

-- Add customer_id column to data_workflow_change_log table
ALTER TABLE data_workflow_change_log 
ADD COLUMN IF NOT EXISTS customer_id UUID;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_workflow_executions_customer 
ON data_workflow_executions(customer_id, executed_at);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow 
ON data_workflow_executions(workflow_id, executed_at);

CREATE INDEX IF NOT EXISTS idx_workflow_change_log_customer 
ON data_workflow_change_log(customer_id, created_at);
