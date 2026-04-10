-- FAST-273: Widen state column to support international state/province codes.
-- UK businesses use 3+ char codes (e.g. "DBY", "SCT") and Trulioo returns
-- standardized names like "Derby", "Glasgow" which exceed varchar(2).
-- Aligning with city column which already uses varchar(255).
ALTER TABLE integration_data.business_entity_address_source
ALTER COLUMN state TYPE varchar(255);
