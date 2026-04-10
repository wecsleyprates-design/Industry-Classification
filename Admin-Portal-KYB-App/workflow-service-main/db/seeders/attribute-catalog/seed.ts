/**
 * Attribute Catalog Seeder
 *
 * This script seeds the core_attribute_catalog table with attributes from data.ts.
 *
 * Features:
 * - Idempotent: Can be run multiple times safely (UPSERT)
 * - Updates existing attributes if they change in data.ts
 * - Soft deletes attributes not present in data.ts (sets active = false)
 *
 * Usage:
 *   npm run seed:attributes
 *
 * Or directly:
 *   npx tsx db/seeders/attribute-catalog/seed.ts
 *
 */

import type { Knex } from "knex";
import { createSeederDb, createSeederLogger, chunkArray } from "../base";
import { attributes } from "./data";

type AttributeDataType = "string" | "number" | "boolean" | "date" | "enum";
type AttributeSource = "facts" | "case";

/**
 * Attribute row interface
 */
interface AttributeRow {
	source: string;
	path: string;
	context: string;
	label: string | null;
	data_type: string;
	description: string | null;
	validation_regex: string | null;
	active: boolean;
}

/**
 * Chunk size for processing attributes to limit memory usage
 * Adjust based on available memory and attribute size
 */
const CHUNK_SIZE = 1000;

// Initialize database connection and logger from base
const db: Knex = createSeederDb();
const log = createSeederLogger("ATTRIBUTES");

function validateRegex(regex: string | null): void {
	if (!regex) {
		return;
	}
	try {
		new RegExp(regex);
	} catch (error) {
		throw new Error(`Invalid regex pattern: ${regex}. ${error instanceof Error ? error.message : "Unknown error"}`);
	}
}

function validatePathMatchesSource(path: string, source: AttributeSource): void {
	const expectedPrefix = `${source}.`;
	if (!path.startsWith(expectedPrefix)) {
		throw new Error(`Path "${path}" must start with "${expectedPrefix}" for source "${source}"`);
	}
	const attributeName = path.substring(expectedPrefix.length);
	if (attributeName?.trim().length === 0) {
		throw new Error(`Path "${path}" must have an attribute name after the source prefix`);
	}
}

function validateAttribute(attribute: {
	source: AttributeSource;
	path: string;
	data_type: AttributeDataType;
	validation_regex?: string | null;
}): void {
	validatePathMatchesSource(attribute.path, attribute.source);
	if (attribute.validation_regex) {
		validateRegex(attribute.validation_regex);
	}
}

/**
 * Seeds the attribute catalog table
 * Uses chunking to process large datasets efficiently without memory issues
 */
async function seedAttributeCatalog(): Promise<void> {
	log.info("Starting attribute catalog seeding...");

	try {
		log.info(`Validating ${attributes.length} attributes...`);
		for (const attribute of attributes) {
			validateAttribute({
				source: attribute.source,
				path: attribute.path,
				data_type: attribute.data_type,
				validation_regex: attribute.validation_regex ?? null
			});
		}
		log.info("All attributes validated successfully");

		const attributeChunks = chunkArray(attributes, CHUNK_SIZE);
		log.info(`Processing ${attributes.length} attributes in ${attributeChunks.length} chunks of ${CHUNK_SIZE}`);

		let totalInserted = 0;
		let totalUpdated = 0;
		let totalSkipped = 0;

		for (let chunkIndex = 0; chunkIndex < attributeChunks.length; chunkIndex++) {
			const chunk = attributeChunks[chunkIndex];
			log.info(`Processing chunk ${chunkIndex + 1}/${attributeChunks.length} (${chunk.length} attributes)...`);

			const valuesPlaceholders: string[] = [];
			const bindings: unknown[] = [];

			chunk.forEach(attr => {
				valuesPlaceholders.push(`(?::text, ?::text)`);
				bindings.push(attr.source, attr.path);
			});

			const valuesClause = valuesPlaceholders.join(", ");

			const existingAttributesResult = await db.raw<{ rows: AttributeRow[] }>(
				`
				SELECT 
					c.source,
					c.path,
					c.context,
					c.label,
					c.data_type,
					c.description,
					c.validation_regex,
					c.active
				FROM core_attribute_catalog c
				INNER JOIN (VALUES ${valuesClause}) AS v(source, path)
				ON c.source = v.source AND c.path = v.path
			`,
				bindings
			);

			const existingAttributes = existingAttributesResult.rows;

			const existingMap = new Map<string, (typeof existingAttributes)[0]>();
			for (const attr of existingAttributes) {
				existingMap.set(`${attr.source}:${attr.path}`, attr);
			}

			const toInsert: typeof chunk = [];
			const toUpdate: Array<{ attribute: (typeof chunk)[0]; existing: (typeof existingAttributes)[0] }> = [];
			let skipped = 0;

			for (const attribute of chunk) {
				const key = `${attribute.source}:${attribute.path}`;
				const existing = existingMap.get(key);

				if (existing) {
					const hasChanges =
						existing.context !== attribute.context ||
						existing.label !== attribute.label ||
						existing.data_type !== attribute.data_type ||
						existing.description !== attribute.description ||
						existing.validation_regex !== attribute.validation_regex ||
						existing.active !== true;

					if (hasChanges) {
						toUpdate.push({ attribute, existing });
					} else {
						skipped++;
					}
				} else {
					toInsert.push(attribute);
				}
			}

			if (toInsert.length > 0) {
				log.info(`Batch inserting ${toInsert.length} new attributes in chunk ${chunkIndex + 1}...`);
				await db("core_attribute_catalog").insert(
					toInsert.map(attr => ({
						source: attr.source,
						path: attr.path,
						context: attr.context,
						label: attr.label,
						data_type: attr.data_type,
						description: attr.description,
						validation_regex: attr.validation_regex,
						active: true
					}))
				);
				totalInserted += toInsert.length;
			}

			if (toUpdate.length > 0) {
				log.info(`Batch updating ${toUpdate.length} changed attributes in chunk ${chunkIndex + 1}...`);

				const valuesPlaceholders: string[] = [];
				const bindings: unknown[] = [];

				toUpdate.forEach(({ attribute }) => {
					valuesPlaceholders.push(`(?::text, ?::text, ?::text, ?::text, ?::text, ?::text, ?::text, ?::boolean)`);
					bindings.push(
						attribute.source,
						attribute.path,
						attribute.context,
						attribute.label,
						attribute.data_type,
						attribute.description,
						attribute.validation_regex,
						true // active
					);
				});

				const valuesClause = valuesPlaceholders.join(", ");

				await db.raw(
					`
					UPDATE core_attribute_catalog c
					SET 
						context = v.context::text,
						label = v.label::text,
						data_type = v.data_type::text,
						description = v.description::text,
						validation_regex = v.validation_regex::text,
						active = v.active::boolean
					FROM (VALUES ${valuesClause}) AS v(source, path, context, label, data_type, description, validation_regex, active)
					WHERE c.source = v.source AND c.path = v.path
				`,
					bindings
				);

				totalUpdated += toUpdate.length;
			}

			totalSkipped += skipped;
		}

		log.info(`${totalInserted} inserted, ${totalUpdated} updated, ${totalSkipped} skipped (no changes)`);

		// Soft delete attributes that are not in data.ts (batch operation)
		// Fetch only active attributes that need to be deactivated (memory efficient)
		const newPaths = new Set(attributes.map(attr => `${attr.source}:${attr.path}`));

		const activeAttributes = await db<{ source: string; path: string }>("core_attribute_catalog")
			.where("active", true)
			.select("source", "path");

		const toDeactivate = activeAttributes.filter(attr => !newPaths.has(`${attr.source}:${attr.path}`));

		if (toDeactivate.length > 0) {
			log.info(`Batch soft deleting ${toDeactivate.length} attributes not in data.ts...`);

			const valuesPlaceholders: string[] = [];
			const bindings: unknown[] = [];

			toDeactivate.forEach(attr => {
				valuesPlaceholders.push(`(?::text, ?::text)`);
				bindings.push(attr.source, attr.path);
			});

			const valuesClause = valuesPlaceholders.join(", ");

			const result = await db.raw<{ rowCount: number }>(
				`
				UPDATE core_attribute_catalog c
				SET active = false
				FROM (VALUES ${valuesClause}) AS v(source, path)
				WHERE c.source = v.source AND c.path = v.path AND c.active = true
			`,
				bindings
			);

			const deactivated = result.rowCount ?? 0;
			if (deactivated > 0) {
				log.info(`Soft deleted ${deactivated} attributes`);
			} else {
				log.info("No attributes needed soft deletion (already inactive)");
			}
		} else {
			log.info("No attributes to soft delete");
		}

		log.info("Attribute catalog seeding completed successfully");
	} catch (error) {
		log.error("Error seeding attribute catalog:", error);
		throw error;
	}
}

/**
 * Main execution
 */
async function main(): Promise<void> {
	try {
		await seedAttributeCatalog();
		process.exit(0);
	} catch (error) {
		log.error("Seeder failed:", error);
		process.exit(1);
	} finally {
		await db.destroy();
	}
}

// Run if executed directly
if (require.main === module) {
	void main();
}

export { seedAttributeCatalog };
