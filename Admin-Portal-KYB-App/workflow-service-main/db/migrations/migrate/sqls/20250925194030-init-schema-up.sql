--
-- Function to update updated_at column automatically
--
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

--
-- Table: data_workflows
--
CREATE TABLE data_workflows (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID NOT NULL,
    name VARCHAR NOT NULL,
    description TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    priority INT NOT NULL CHECK (priority > 0),
    created_by UUID NOT NULL,
    created_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    updated_by UUID NOT NULL,
    updated_at TIMESTAMP DEFAULT current_timestamp NOT NULL
);

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON data_workflows
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

--
-- Table: data_workflow_triggers
--
CREATE TABLE data_workflow_triggers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR NOT NULL,
    conditions JSONB NOT NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    updated_by UUID NOT NULL,
    updated_at TIMESTAMP DEFAULT current_timestamp NOT NULL
);

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON data_workflow_triggers
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

--
-- Table: data_workflow_versions
--
CREATE TABLE data_workflow_versions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workflow_id UUID NOT NULL,
    trigger_id UUID NOT NULL,
    version_number INT NOT NULL DEFAULT 1 CHECK (version_number > 0),
    status VARCHAR NOT NULL CHECK (status IN ('draft','published')),
    snapshot JSONB,
    published_at TIMESTAMP,
    default_action JSONB,
    is_current BOOLEAN DEFAULT false,
    created_by UUID NOT NULL,
    created_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    updated_by UUID NOT NULL,
    updated_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    CONSTRAINT unique_workflow_version UNIQUE (workflow_id, version_number),
    CONSTRAINT fk_workflow FOREIGN KEY (workflow_id) REFERENCES data_workflows(id) ON DELETE CASCADE,
    CONSTRAINT fk_trigger FOREIGN KEY (trigger_id) REFERENCES data_workflow_triggers(id) ON DELETE RESTRICT
);

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON data_workflow_versions
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

--
-- Table: data_workflow_rules
--
CREATE TABLE data_workflow_rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workflow_version_id UUID NOT NULL,
    name VARCHAR NOT NULL,
    priority INT NOT NULL CHECK (priority > 0),
    conditions JSONB NOT NULL,
    actions JSONB NOT NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    updated_by UUID NOT NULL,
    updated_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    CONSTRAINT unique_priority_per_workflow_version UNIQUE (workflow_version_id, priority),
    CONSTRAINT fk_workflow_version_rule FOREIGN KEY (workflow_version_id) REFERENCES data_workflow_versions(id) ON DELETE CASCADE
);

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON data_workflow_rules
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

--
-- Table: data_workflow_executions
--
CREATE TABLE data_workflow_executions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    case_id UUID NOT NULL,
    workflow_version_id UUID NOT NULL,
    matched_rule_id UUID,
    executed_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    input_attr JSONB,
    evaluation_log JSONB,
    latency_ms INT,
    created_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    CONSTRAINT fk_version_execution FOREIGN KEY (workflow_version_id) REFERENCES data_workflow_versions(id) ON DELETE CASCADE,
    CONSTRAINT fk_rule_execution FOREIGN KEY (matched_rule_id) REFERENCES data_workflow_rules(id) ON DELETE SET NULL
);


--
-- Table: core_attribute_catalog
--
CREATE TABLE core_attribute_catalog (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    context VARCHAR NOT NULL,
    path VARCHAR NOT NULL,
    label VARCHAR,
    data_type VARCHAR NOT NULL CHECK (data_type IN ('string','number','boolean','date','enum')),
    allowed_operators JSONB,
    default_value TEXT,
    description TEXT,
    active BOOLEAN DEFAULT true,
    validation_regex TEXT,
    category VARCHAR,
    created_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    updated_at TIMESTAMP DEFAULT current_timestamp NOT NULL
);

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON core_attribute_catalog
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

--
-- Table: data_workflow_change_log
--
CREATE TABLE data_workflow_change_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workflow_version_id UUID NOT NULL,
    workflow_id UUID NOT NULL,
    field_path TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    change_type VARCHAR NOT NULL,
    note TEXT,
    changed_by UUID NOT NULL,
    created_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    CONSTRAINT fk_version_change FOREIGN KEY (workflow_version_id) REFERENCES data_workflow_versions(id) ON DELETE CASCADE,
    CONSTRAINT fk_workflow_change FOREIGN KEY (workflow_id) REFERENCES data_workflows(id) ON DELETE CASCADE
);


--
-- Indexes for performance
--
CREATE INDEX idx_workflows_customer_active
ON data_workflows(customer_id) WHERE active = true;

CREATE INDEX idx_workflow_versions_workflow_status
ON data_workflow_versions(workflow_id, status);

CREATE INDEX idx_workflow_rules_version_priority
ON data_workflow_rules(workflow_version_id, priority);

CREATE INDEX idx_workflow_executions_case
ON data_workflow_executions(case_id, executed_at);

CREATE INDEX idx_workflow_change_log_workflow
ON data_workflow_change_log(workflow_id, created_at);

CREATE INDEX idx_workflow_executions_workflow
ON data_workflow_executions(workflow_version_id);

CREATE UNIQUE INDEX uniq_current_published
ON data_workflow_versions(workflow_id)
WHERE status='published' AND is_current=true;
