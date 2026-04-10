CREATE SCHEMA IF NOT EXISTS shared;

CREATE TABLE shared.data_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    context_type VARCHAR(64) NOT NULL,
    context_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT current_timestamp,
    updated_at TIMESTAMP NOT NULL DEFAULT current_timestamp
);

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON shared.data_rules
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();