-- Remove annotations column from data_workflow_executions table
ALTER TABLE data_workflow_executions 
DROP COLUMN IF EXISTS annotations;

