-- annotations stores metadata about source events that triggered workflow execution
-- Format: { "source_events": { "facts": "timeout_monitor" } }
ALTER TABLE data_workflow_executions 
ADD COLUMN IF NOT EXISTS annotations JSONB;

-- Add comment to document the column purpose
COMMENT ON COLUMN data_workflow_executions.annotations IS 'Metadata about source events that triggered workflow execution. Format: { "source_events": { "facts": "timeout_monitor" } }';

