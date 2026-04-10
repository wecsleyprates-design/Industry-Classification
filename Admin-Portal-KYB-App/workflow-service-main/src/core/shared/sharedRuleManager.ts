import { isEqual } from "lodash";
import { ApiError } from "#types/common";
import { StatusCodes } from "http-status-codes";
import { ERROR_MESSAGES, WORKFLOW_ERROR_CODES_COMBINED as ERROR_CODES } from "#constants";
import type { Knex } from "knex";
import { SharedRuleRepository } from "./sharedRuleRepository";
import { SharedRuleVersionRepository } from "./sharedRuleVersionRepository";
import type {
	CreateRulePayload,
	UpdateRuleMetadataPayload,
	AddRuleVersionPayload,
	UpdateRulePayload,
	UpdateRuleResult,
	SharedRuleWithLatestConditions,
	SharedRuleDetailBatchResult
} from "./types";

export class SharedRuleManager {
	constructor(
		private ruleRepository: SharedRuleRepository,
		private versionRepository: SharedRuleVersionRepository
	) {}

	/**
	 * Creates a shared rule and its initial version in a single transaction.
	 * @param payload - Shared rule data used to create the metadata row and initial version.
	 * @param createdBy - Authenticated user id recorded as the version creator.
	 * @returns The created rule id and initial version id.
	 */
	async createRule(
		payload: CreateRulePayload,
		createdBy?: string | null
	): Promise<{ rule_id: string; version_id: string }> {
		return this.ruleRepository.transaction(async trx => {
			const ruleId = await this.ruleRepository.insert(payload, trx);
			const versionId = await this.versionRepository.insert(
				ruleId,
				1,
				{
					conditions: payload.conditions,
					created_by: createdBy ?? null
				},
				trx
			);

			return { rule_id: ruleId, version_id: versionId };
		});
	}

	/**
	 * Updates shared rule metadata after verifying the rule exists.
	 * @param ruleId - Shared rule identifier.
	 * @param payload - Metadata fields that can be updated on the shared rule.
	 * @param trx - Optional transaction used to keep the update atomic with related operations.
	 * @returns A promise that resolves when the metadata update completes.
	 */
	async updateRuleMetadata(ruleId: string, payload: UpdateRuleMetadataPayload, trx?: Knex.Transaction): Promise<void> {
		const rule = await this.ruleRepository.getById(ruleId, trx);
		if (!rule) {
			throw new ApiError(ERROR_MESSAGES.SHARED_RULE_NOT_FOUND, StatusCodes.NOT_FOUND, ERROR_CODES.WORKFLOW_NOT_FOUND);
		}
		await this.ruleRepository.updateMetadata(ruleId, payload, trx);
	}

	/**
	 * Appends a new version for an existing shared rule.
	 * @param ruleId - Shared rule identifier.
	 * @param payload - Version payload containing the serialized conditions and audit metadata.
	 * @param createdBy - Authenticated user id recorded as the version creator.
	 * @param trx - Optional transaction used to serialize version creation with related writes.
	 * @returns The created version id and computed version number.
	 */
	async addRuleVersion(
		ruleId: string,
		payload: AddRuleVersionPayload,
		createdBy?: string | null,
		trx?: Knex.Transaction
	): Promise<{ version_id: string; version_number: number }> {
		const rule = await this.ruleRepository.getById(ruleId, trx, true);
		if (!rule) {
			throw new ApiError(ERROR_MESSAGES.SHARED_RULE_NOT_FOUND, StatusCodes.NOT_FOUND, ERROR_CODES.WORKFLOW_NOT_FOUND);
		}
		const nextVersion = (await this.versionRepository.getMaxVersionNumber(ruleId, trx)) + 1;
		const versionId = await this.versionRepository.insert(
			ruleId,
			nextVersion,
			{
				conditions: payload.conditions,
				created_by: createdBy ?? null
			},
			trx
		);
		return { version_id: versionId, version_number: nextVersion };
	}

	/**
	 * Updates rule metadata and/or creates a new version atomically.
	 * @param ruleId - Shared rule identifier.
	 * @param payload - Requested metadata and condition changes for the shared rule.
	 * @returns The identifiers of any version created during the update.
	 */
	async updateRule(ruleId: string, payload: UpdateRulePayload): Promise<UpdateRuleResult> {
		return this.ruleRepository.transaction(async trx => {
			const result: UpdateRuleResult = {};

			if (payload.name !== undefined || payload.description !== undefined) {
				await this.updateRuleMetadata(
					ruleId,
					{
						...(payload.name !== undefined && { name: payload.name }),
						...(payload.description !== undefined && { description: payload.description })
					},
					trx
				);
			}

			if (payload.conditions !== undefined) {
				const latestConditions = await this.versionRepository.getLatestVersionConditions(ruleId, trx);
				const sameAsLatest = latestConditions !== null && isEqual(latestConditions, payload.conditions);

				if (!sameAsLatest) {
					const versionResult = await this.addRuleVersion(
						ruleId,
						{ conditions: payload.conditions, created_by: payload.created_by ?? undefined },
						payload.created_by,
						trx
					);
					result.version_id = versionResult.version_id;
					result.version_number = versionResult.version_number;
				}
			}

			return result;
		});
	}

	/**
	 * Fetches shared (monitoring) rules by IDs with their latest version conditions for evaluation.
	 * @param ruleIds - Array of rule IDs to fetch.
	 * @returns Rules with id, name, and conditions (DSL) from the latest version.
	 */
	async getMonitoringRulesByIds(ruleIds: string[]): Promise<SharedRuleWithLatestConditions[]> {
		return this.ruleRepository.getRulesWithLatestVersionByIds(ruleIds);
	}

	/**
	 * Loads rule metadata and latest version snapshot for each requested ID.
	 * Missing rule rows or rules without a version are listed in {@link SharedRuleDetailBatchResult.missing_rule_ids}.
	 * @param ruleIds - Shared rule identifiers (duplicates are de-duplicated in repository order).
	 */
	async getRuleDetailsBatchByIds(ruleIds: string[]): Promise<SharedRuleDetailBatchResult> {
		return this.ruleRepository.getRuleDetailsBatchByIds(ruleIds);
	}
}
