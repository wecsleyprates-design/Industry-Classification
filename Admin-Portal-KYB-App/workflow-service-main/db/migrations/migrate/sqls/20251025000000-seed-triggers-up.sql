-- Seed data for workflow triggers
-- This script adds the required triggers for the workflow system

-- Insert the SUBMITTED trigger
INSERT INTO data_workflow_triggers (id, name, conditions, created_by, created_at, updated_by, updated_at)
VALUES (
    gen_random_uuid(),
    'SUBMITTED',
    '{
        "operator": "AND",
        "conditions": [
            { "field": "case.status.id", "operator": "=", "value": "SUBMITTED" }
        ]
    }'::jsonb,
    '00000000-0000-0000-0000-000000000000'::uuid, -- System user
    CURRENT_TIMESTAMP,
    '00000000-0000-0000-0000-000000000000'::uuid, -- System user
    CURRENT_TIMESTAMP
);

