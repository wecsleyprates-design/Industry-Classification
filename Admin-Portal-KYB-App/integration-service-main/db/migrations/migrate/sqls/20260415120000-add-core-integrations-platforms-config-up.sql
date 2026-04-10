-- Smart routing: weighted platform selection per task/country/customer.
-- Multiple rows per scope define relative weights; application picks one platform deterministically (hash) per business+customer+task.
-- platform_id references integrations.core_integrations_platforms (e.g. 16 Middesk, 43 Baselayer).
-- task_id references integrations.core_tasks (e.g. fetch_business_entity_verification).

CREATE TABLE integrations.core_integrations_platforms_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid NULL,
    task_id integer NOT NULL,
    platform_id integer NOT NULL,
    weight integer NOT NULL CHECK (weight > 0),
    country varchar(2) NOT NULL DEFAULT 'US',
    is_active boolean NOT NULL DEFAULT true,
    effective_from timestamptz NULL,
    effective_to timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    source varchar(32) NULL,
    CONSTRAINT fk_core_integrations_platforms_config_task
        FOREIGN KEY (task_id)
        REFERENCES integrations.core_tasks (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_core_integrations_platforms_config_platform
        FOREIGN KEY (platform_id)
        REFERENCES integrations.core_integrations_platforms (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

COMMENT ON TABLE integrations.core_integrations_platforms_config IS
    'Smart routing weights: multiple rows per (customer scope, task_id, country) define relative shares between platforms. customer_id NULL = default for all customers until overridden by rows with a specific customer_id.';

COMMENT ON COLUMN integrations.core_integrations_platforms_config.customer_id IS
    'NULL = global default rows; non-NULL = override for that customer only.';

COMMENT ON COLUMN integrations.core_integrations_platforms_config.task_id IS
    'FK to integrations.core_tasks.id (e.g. task for fetch_business_entity_verification).';

COMMENT ON COLUMN integrations.core_integrations_platforms_config.platform_id IS
    'FK to integrations.core_integrations_platforms.id.';

COMMENT ON COLUMN integrations.core_integrations_platforms_config.weight IS
    'Relative weight within the same scope; sum weights then pick by cumulative bucket (deterministic hash).';

COMMENT ON COLUMN integrations.core_integrations_platforms_config.country IS
    'ISO 3166-1 alpha-2 jurisdiction for the rule (e.g. US).';

COMMENT ON COLUMN integrations.core_integrations_platforms_config.source IS
    'Optional provenance: manual, n8n, api, migration.';

-- Partial unique indexes: column order gives useful prefixes without separate lookup indexes
-- (task_id, country) for defaults; (customer_id, task_id, country) for customer overrides.
CREATE UNIQUE INDEX uq_platforms_config_default_scope
    ON integrations.core_integrations_platforms_config (task_id, country, platform_id)
    WHERE customer_id IS NULL AND is_active = true;

CREATE UNIQUE INDEX uq_platforms_config_customer_scope
    ON integrations.core_integrations_platforms_config (customer_id, task_id, country, platform_id)
    WHERE customer_id IS NOT NULL AND is_active = true;
