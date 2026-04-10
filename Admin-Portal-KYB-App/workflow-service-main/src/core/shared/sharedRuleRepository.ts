import { v4 as uuidv4 } from "uuid";
import { db } from "#database/knex";
import { logger } from "#helpers/logger";
import { ApiError } from "#types/common";
import { StatusCodes } from "http-status-codes";
import { ERROR_MESSAGES, WORKFLOW_ERROR_CODES_COMBINED as ERROR_CODES } from "#constants";
import type { Knex } from "knex";
import type {
	SharedRuleRow,
	CreateRulePayload,
	UpdateRuleMetadataPayload,
	SharedRuleWithLatestConditions,
	SharedRuleDetailBatchResult
} from "./types";

const TABLE = "data_rules";
const VERSIONS_TABLE = "data_rule_versions";
const SCHEMA = "shared";

function parseRuleConditions(raw: string | Record<string, unknown>): Record<string, unknown> {
	return typeof raw === "string" ? (JSON.parse(raw) as Record<string, unknown>) : raw;
}

function latestConditionsByRuleId(
	rows: { rule_id: string; conditions: string | Record<string, unknown> }[]
): Map<string, Record<string, unknown>> {
	const map = new Map<string, Record<string, unknown>>();
	for (const row of rows) {
		if (map.has(row.rule_id)) {
			continue;
		}
		map.set(row.rule_id, parseRuleConditions(row.conditions));
	}
	return map;
}

function latestVersionSnapshotByRuleId(
	rows: {
		rule_id: string;
		version_number: number;
		conditions: string | Record<string, unknown>;
		created_at: Date;
	}[]
): Map<string, { version_number: number; conditions: Record<string, unknown>; created_at: Date }> {
	const map = new Map<string, { version_number: number; conditions: Record<string, unknown>; created_at: Date }>();
	for (const row of rows) {
		if (map.has(row.rule_id)) {
			continue;
		}
		map.set(row.rule_id, {
			version_number: row.version_number,
			conditions: parseRuleConditions(row.conditions),
			created_at: row.created_at
		});
	}
	return map;
}

export class SharedRuleRepository {
	protected db: Knex;

	constructor({ db: injectedDb }: { db?: Knex } = {}) {
		this.db = injectedDb ?? (db as Knex);
	}

	private table(query: Knex | Knex.Transaction = this.db) {
		return query(TABLE).withSchema(SCHEMA);
	}

	/**
	 * Executes a callback inside a database transaction.
	 * @param callback - Work to execute inside the transaction scope.
	 * @returns The value returned by the transaction callback.
	 */
	async transaction<T>(callback: (trx: Knex.Transaction) => Promise<T>): Promise<T> {
		return this.db.transaction(callback);
	}

	/**
	 * Inserts the shared rule metadata row.
	 * @param payload - Shared rule metadata to persist.
	 * @param trx - Optional transaction used for atomic multi-step writes.
	 * @returns The generated shared rule id.
	 */
	async insert(payload: CreateRulePayload, trx?: Knex.Transaction): Promise<string> {
		const id = uuidv4();
		const query = trx ?? this.db;

		try {
			await query(TABLE)
				.withSchema(SCHEMA)
				.insert({
					id,
					context_type: payload.context_type,
					context_id: payload.context_id,
					name: payload.name ?? null,
					description: payload.description ?? null,
					created_at: query.fn.now(),
					updated_at: query.fn.now()
				});

			logger.debug(`SharedRuleRepository.insert: rule_id=${id}`);
			return id;
		} catch (error) {
			logger.error(
				{ error },
				`SharedRuleRepository.insert failed for context_type=${payload.context_type} context_id=${payload.context_id}`
			);
			throw new ApiError(
				ERROR_MESSAGES.SHARED_RULE_FAILED_CREATE,
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}

	/**
	 * Loads a shared rule by id and optionally applies a row lock within a transaction.
	 * @param id - Shared rule identifier.
	 * @param trx - Optional transaction used to read within an existing transaction scope.
	 * @param forUpdate - Whether to apply a row-level lock when a transaction is provided.
	 * @returns The matching shared rule row, or null when no rule exists.
	 */
	async getById(id: string, trx?: Knex.Transaction, forUpdate = false): Promise<SharedRuleRow | null> {
		try {
			const query = this.table(trx ?? this.db).where("id", id);
			const row = (await (forUpdate && trx ? query.forUpdate() : query).first()) as SharedRuleRow | undefined;
			return row ?? null;
		} catch (error) {
			logger.error({ error }, `SharedRuleRepository.getById failed for id=${id}`);
			throw new ApiError(
				ERROR_MESSAGES.SHARED_RULE_FAILED_GET,
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}

	/**
	 * Updates mutable shared rule metadata fields.
	 * @param id - Shared rule identifier.
	 * @param payload - Metadata fields to update.
	 * @param trx - Optional transaction used for atomic multi-step writes.
	 * @returns A promise that resolves when the update finishes.
	 */
	async updateMetadata(id: string, payload: UpdateRuleMetadataPayload, trx?: Knex.Transaction): Promise<void> {
		try {
			const query = trx ?? this.db;
			const update: Record<string, unknown> = { updated_at: query.fn.now() };
			if (payload.name !== undefined) update.name = payload.name;
			if (payload.description !== undefined) update.description = payload.description;

			if (Object.keys(update).length <= 1) {
				return;
			}

			await this.table(query).where("id", id).update(update);
			logger.debug(`SharedRuleRepository.updateMetadata: rule_id=${id}`);
		} catch (error) {
			logger.error({ error }, `SharedRuleRepository.updateMetadata failed for id=${id}`);
			throw new ApiError(
				ERROR_MESSAGES.SHARED_RULE_FAILED_UPDATE_METADATA,
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}

	/**
	 * Fetches shared rules by IDs with their latest version conditions (for evaluation).
	 * Throws if any requested ID is not found.
	 * @param ruleIds - Array of rule IDs to fetch.
	 * @returns Rules with id, name, and conditions from the latest version.
	 */
	async getRulesWithLatestVersionByIds(ruleIds: string[]): Promise<SharedRuleWithLatestConditions[]> {
		if (ruleIds.length === 0) {
			return [];
		}
		try {
			const rules = await this.table(this.db).whereIn("id", ruleIds).select("id", "name");
			const foundIds = new Set((rules as { id: string }[]).map(r => r.id));
			const missingIds = ruleIds.filter(id => !foundIds.has(id));
			if (missingIds.length > 0) {
				throw new ApiError(
					`Rules not found: ${missingIds.join(", ")}`,
					StatusCodes.NOT_FOUND,
					ERROR_CODES.WORKFLOW_NOT_FOUND
				);
			}

			const versionRows = await this.db(VERSIONS_TABLE)
				.withSchema(SCHEMA)
				.whereIn("rule_id", ruleIds)
				.select("rule_id", "conditions")
				.orderBy("rule_id")
				.orderBy("version_number", "desc");

			const latestByRuleId = latestConditionsByRuleId(
				versionRows as { rule_id: string; conditions: string | Record<string, unknown> }[]
			);

			const missingVersionIds = ruleIds.filter(id => !latestByRuleId.has(id));
			if (missingVersionIds.length > 0) {
				throw new ApiError(
					`Rules not found (no version): ${missingVersionIds.join(", ")}`,
					StatusCodes.NOT_FOUND,
					ERROR_CODES.WORKFLOW_NOT_FOUND
				);
			}

			return (rules as { id: string; name: string | null }[]).map(r => ({
				id: r.id,
				name: r.name ?? "",
				conditions: latestByRuleId.get(r.id) as Record<string, unknown>
			}));
		} catch (error) {
			if (error instanceof ApiError) throw error;
			logger.error({ error }, "SharedRuleRepository.getRulesWithLatestVersionByIds failed");
			throw new ApiError(
				ERROR_MESSAGES.SHARED_RULE_FAILED_GET,
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}

	/**
	 * Loads rule metadata and latest version rows for the given IDs.
	 * Omits IDs that do not exist or have no version row; lists them in
	 * {@link SharedRuleDetailBatchResult.missing_rule_ids}.
	 */
	async getRuleDetailsBatchByIds(ruleIds: string[]): Promise<SharedRuleDetailBatchResult> {
		if (ruleIds.length === 0) {
			return { rules: [], missing_rule_ids: [] };
		}

		const seen = new Set<string>();
		const uniqueOrdered: string[] = [];
		for (const id of ruleIds) {
			if (!seen.has(id)) {
				seen.add(id);
				uniqueOrdered.push(id);
			}
		}

		try {
			const ruleRows = await this.table(this.db)
				.whereIn("id", uniqueOrdered)
				.select("id", "name", "description", "created_at");

			const ruleById = new Map(
				(
					ruleRows as {
						id: string;
						name: string | null;
						description: string | null;
						created_at: Date;
					}[]
				).map(r => [r.id, r])
			);

			const foundIds = [...ruleById.keys()];
			if (foundIds.length === 0) {
				return { rules: [], missing_rule_ids: uniqueOrdered };
			}

			const versionRows = await this.db(VERSIONS_TABLE)
				.withSchema(SCHEMA)
				.whereIn("rule_id", foundIds)
				.select("rule_id", "version_number", "conditions", "created_at")
				.orderBy("rule_id")
				.orderBy("version_number", "desc");

			const latestByRule = latestVersionSnapshotByRuleId(
				versionRows as {
					rule_id: string;
					version_number: number;
					conditions: string | Record<string, unknown>;
					created_at: Date;
				}[]
			);

			const rules: SharedRuleDetailBatchResult["rules"] = [];
			const missingRuleIds: string[] = [];

			for (const id of uniqueOrdered) {
				const rule = ruleById.get(id);
				const latest = latestByRule.get(id);
				if (!rule || !latest) {
					missingRuleIds.push(id);
					continue;
				}
				rules.push({
					rule_id: rule.id,
					name: rule.name,
					description: rule.description,
					latest_version_number: latest.version_number,
					conditions: latest.conditions,
					rule_created_at: rule.created_at,
					version_created_at: latest.created_at
				});
			}

			return { rules, missing_rule_ids: missingRuleIds };
		} catch (error) {
			if (error instanceof ApiError) throw error;
			logger.error({ error }, "SharedRuleRepository.getRuleDetailsBatchByIds failed");
			throw new ApiError(
				ERROR_MESSAGES.SHARED_RULE_FAILED_GET,
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}
}
