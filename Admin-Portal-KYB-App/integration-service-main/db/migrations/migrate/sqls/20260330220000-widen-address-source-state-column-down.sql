-- Revert state column back to varchar(2).
-- Truncate any values longer than 2 characters so the ALTER does not fail.
UPDATE integration_data.business_entity_address_source
SET state = LEFT(state, 2)
WHERE LENGTH(state) > 2;

ALTER TABLE integration_data.business_entity_address_source
ALTER COLUMN state TYPE varchar(2);
