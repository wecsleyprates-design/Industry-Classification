import { v4 as uuidv4 } from "uuid";
import { db } from "#database/knex";
import { logger } from "#helpers/logger";
import { ApiError } from "#types/common";
import { StatusCodes } from "http-status-codes";
import { ERROR_MESSAGES, WORKFLOW_ERROR_CODES_COMBINED as ERROR_CODES } from "#constants";
import type { Knex } from "knex";
import type { AddRuleVersionPayload } from "./types";

const TABLE = "data_rule_versions";
const SCHEMA = "shared";

function parseStoredConditions(raw: unknown): Record<string, unknown> {
	if (raw == null) {
		return {};
	}
	if (typeof raw === "string") {
		try {
			return JSON.parse(raw) as Record<string, unknown>;
		} catch {
			return {};
		}
	}
	return raw as Record<string, unknown>;
}

export class SharedRuleVersionRepository {
	protected db: Knex;

	constructor({ db: injectedDb }: { db?: Knex } = {}) {
		this.db = injectedDb ?? (db as Knex);
	}

	private table(query: Knex | Knex.Transaction = this.db) {
		return query(TABLE).withSchema(SCHEMA);
	}

	/**
	 * Persists a new version row for a shared rule.
	 * @param ruleId - Shared rule identifier that owns the new version.
	 * @param versionNumber - Sequential version number assigned to the new version.
	 * @param payload - Conditions and audit metadata stored with the version row.
	 * @param trx - Optional transaction used for atomic multi-step writes.
	 * @returns The generated shared rule version id.
	 */
	async insert(
		ruleId: string,
		versionNumber: number,
		payload: AddRuleVersionPayload,
		trx?: Knex.Transaction
	): Promise<string> {
		const id = uuidv4();
		const query = trx ?? this.db;

		try {
			await query(TABLE)
				.withSchema(SCHEMA)
				.insert({
					id,
					rule_id: ruleId,
					version_number: versionNumber,
					conditions: JSON.stringify(payload.conditions),
					created_at: query.fn.now(),
					created_by: payload.created_by ?? null
				});

			logger.debug(`SharedRuleVersionRepository.insert: rule_id=${ruleId}, version=${versionNumber}`);
			return id;
		} catch (error) {
			logger.error({ error }, `SharedRuleVersionRepository.insert failed for rule_id=${ruleId}`);
			throw new ApiError(
				ERROR_MESSAGES.SHARED_RULE_FAILED_CREATE_VERSION,
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}

	/**
	 * Returns the current highest version number for a rule.
	 * When called inside a transaction, row-level locking is handled by the rule lookup in the manager.
	 * @param ruleId - Shared rule identifier.
	 * @param trx - Optional transaction used to read within an existing transaction scope.
	 * @returns The highest persisted version number, or 0 when the rule has no versions.
	 */
	async getMaxVersionNumber(ruleId: string, trx?: Knex.Transaction): Promise<number> {
		try {
			const query = this.table(trx ?? this.db)
				.where("rule_id", ruleId)
				.max("version_number as max");
			const row = (await query.first()) as { max?: number | string | null } | undefined;
			const max = row?.max;
			if (max == null) return 0;
			return typeof max === "number" ? max : Number(max);
		} catch (error) {
			logger.error({ error }, `SharedRuleVersionRepository.getMaxVersionNumber failed for rule_id=${ruleId}`);
			throw new ApiError(
				ERROR_MESSAGES.SHARED_RULE_FAILED_GET_MAX_VERSION,
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}

	/**
	 * Returns the conditions JSON from the highest version_number row for a rule, or null if none exist.
	 */
	async getLatestVersionConditions(ruleId: string, trx?: Knex.Transaction): Promise<Record<string, unknown> | null> {
		try {
			const query = trx ?? this.db;
			const row = (await query(TABLE)
				.withSchema(SCHEMA)
				.where("rule_id", ruleId)
				.orderBy("version_number", "desc")
				.select("conditions")
				.first()) as { conditions?: unknown } | undefined;

			if (!row) {
				return null;
			}
			return parseStoredConditions(row.conditions);
		} catch (error) {
			logger.error({ error }, `SharedRuleVersionRepository.getLatestVersionConditions failed for rule_id=${ruleId}`);
			throw new ApiError(
				ERROR_MESSAGES.SHARED_RULE_FAILED_GET_LATEST_VERSION,
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}
}
