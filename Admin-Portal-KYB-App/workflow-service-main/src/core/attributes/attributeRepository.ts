import { logger } from "#helpers/logger";
import { db } from "#database/knex";
import { ApiError } from "#types/common";
import { StatusCodes } from "http-status-codes";
import { WORKFLOW_ERROR_CODES_COMBINED as ERROR_CODES } from "#constants";
import { extractAttributeName } from "#utils";
import type { Knex } from "knex";
import type { AttributeCatalogRecordForListing } from "./types";
import type { GetAttributeCatalogQuery } from "#types/workflow-dtos";

/**
 * Repository responsible for attribute catalog operations
 * Handles all database operations related to the attribute catalog
 */
export class AttributeRepository {
	protected db: Knex;

	constructor({ db: injectedDb }: { db?: Knex } = {}) {
		this.db = injectedDb ?? (db as Knex);
	}

	/**
	 * Retrieves all active attributes from the catalog
	 * @param params - Optional filters (source, context, active)
	 * @returns Promise<AttributeCatalogRecordForListing[]> - Array of attribute records with only required fields
	 */
	async getAttributes(params: GetAttributeCatalogQuery = {}): Promise<AttributeCatalogRecordForListing[]> {
		logger.debug("AttributeRepository: Retrieving attributes", params);

		try {
			let query = this.db<AttributeCatalogRecordForListing>("core_attribute_catalog").select(
				"context",
				"source",
				"path",
				"label",
				"data_type",
				"description",
				"validation_regex"
			);

			if (params.source !== undefined) {
				query = query.where("source", params.source);
			}

			if (params.context !== undefined) {
				query = query.where("context", params.context);
			}

			const activeFilter = params.active ?? true;
			query = query.where("active", activeFilter);

			query = query.orderBy("context", "asc").orderBy("path", "asc");

			const records = await query;

			logger.debug(`AttributeRepository: Retrieved ${records.length} attributes`);

			return records;
		} catch (error) {
			logger.error({ error }, "AttributeRepository: Failed to retrieve attributes");
			throw new ApiError(
				"Failed to retrieve attribute catalog",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}

	/**
	 * Retrieves attribute labels by their paths in a single query
	 * @param paths - Array of attribute paths (e.g., ["facts.score", "case.status"])
	 * @returns Promise<Map<string, string>> - Map of path to label (or path without prefix if label is null)
	 */
	async getAttributesByPaths(paths: string[]): Promise<Map<string, string>> {
		logger.debug(`AttributeRepository: Retrieving attributes by paths`, { count: paths.length });

		if (paths.length === 0) {
			return new Map();
		}

		try {
			const records = await this.db<AttributeCatalogRecordForListing>("core_attribute_catalog")
				.select("path", "label", "source")
				.where("active", true)
				.whereIn("path", paths);

			const labelMap = new Map<string, string>();

			for (const record of records) {
				const label = record.label ?? extractAttributeName(record.path, record.source);
				labelMap.set(record.path, label);
			}

			for (const path of paths) {
				if (!labelMap.has(path)) {
					const source = path.split(".")[0];
					const attributeName = extractAttributeName(path, source);
					labelMap.set(path, attributeName);
				}
			}

			return labelMap;
		} catch (error) {
			logger.error({ error }, "AttributeRepository: Failed to retrieve attributes by paths");
			throw new ApiError(
				"Failed to retrieve attribute labels",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}
}
