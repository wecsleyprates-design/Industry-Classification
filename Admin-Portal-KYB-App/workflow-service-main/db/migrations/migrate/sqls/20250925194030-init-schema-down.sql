BEGIN;

DROP TABLE IF EXISTS data_workflow_change_log CASCADE;
DROP TABLE IF EXISTS core_attribute_catalog CASCADE;
DROP TABLE IF EXISTS data_workflow_executions CASCADE;
DROP TABLE IF EXISTS data_workflow_rules CASCADE;
DROP TABLE IF EXISTS data_workflow_versions CASCADE;
DROP TABLE IF EXISTS data_workflow_triggers CASCADE;
DROP TABLE IF EXISTS data_workflows CASCADE;

DROP FUNCTION IF EXISTS trigger_set_timestamp();

COMMIT;