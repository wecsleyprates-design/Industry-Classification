CREATE TABLE shared.data_rule_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL,
    version_number INTEGER NOT NULL,
    conditions JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT current_timestamp,
    created_by UUID NULL,
    CONSTRAINT fk_rule_version_rule
        FOREIGN KEY (rule_id) REFERENCES shared.data_rules(id) ON DELETE CASCADE,
    CONSTRAINT chk_version_number_positive
        CHECK (version_number >= 1),
    CONSTRAINT uniq_rule_version
        UNIQUE (rule_id, version_number)
);

COMMENT ON COLUMN shared.data_rule_versions.conditions IS 'DSL / rule logic payload (JSONB).';