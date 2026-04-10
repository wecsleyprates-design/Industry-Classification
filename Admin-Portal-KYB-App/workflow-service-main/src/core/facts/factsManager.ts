/**
 * Centralized service for extracting required facts from workflow rules
 * Used by both WorkflowManager and PreviewEvaluationManager
 */

import { Workflows } from "@joinworth/types";
import { logger } from "#helpers/logger";
import { VersionRepository } from "#core/versioning";
import { isValidString } from "#utils/validation";
import { ATTRIBUTE_SOURCES } from "#core/attributes/types";
import { getFactName } from "#helpers/workflow/pathResolver";

const LOGICAL_OPERATOR = Workflows.Conditions.LOGICAL_OPERATOR;

/**
 * Service for extracting facts from workflow rules
 * Follows dependency injection pattern consistent with other services
 */
export class FactsManager {
	private versionRepository: VersionRepository;

	constructor(versionRepository: VersionRepository) {
		this.versionRepository = versionRepository;
	}

	/**
	 * Extracts required facts from workflow rules by analyzing DSL conditions
	 * @param workflowId - The workflow ID to analyze
	 * @returns Array of unique fact names required for evaluation
	 */
	async extractRequiredFactsFromWorkflow(workflowId: string): Promise<string[]> {
		const factsSet = new Set<string>();

		try {
			const { rules } = await this.versionRepository.getWorkflowVersionAndRules(workflowId);

			for (const rule of rules) {
				try {
					this.extractFactsFromDSL(rule.conditions, factsSet);
				} catch (error) {
					logger.warn(`Error extracting facts from rule ${rule.id} in workflow ${workflowId}:`, error);
				}
			}
		} catch (error) {
			logger.warn(`Error loading rules for workflow ${workflowId}:`, error);
		}

		const requiredFacts = Array.from(factsSet);
		logger.debug(`Extracted ${requiredFacts.length} required facts from rules: ${requiredFacts.join(", ")}`);

		return requiredFacts;
	}

	/**
	 * Recursively extracts fact references from DSL expressions
	 * Only extracts variables with explicit "facts." prefix
	 * @param dsl - DSL expression to analyze
	 * @param factsSet - Set to collect fact names
	 */
	public extractFactsFromDSL(dsl: unknown, factsSet: Set<string>): void {
		if (!dsl || typeof dsl !== "object") {
			return;
		}

		const dslObj = dsl as Record<string, unknown>;
		const factsPrefix = `${ATTRIBUTE_SOURCES.FACTS}.`;

		if (dslObj.operator === LOGICAL_OPERATOR.AND && Array.isArray(dslObj.conditions)) {
			(dslObj.conditions as unknown[]).forEach(condition => this.extractFactsFromDSL(condition, factsSet));
			return;
		}

		if (dslObj.operator === LOGICAL_OPERATOR.OR && Array.isArray(dslObj.conditions)) {
			(dslObj.conditions as unknown[]).forEach(condition => this.extractFactsFromDSL(condition, factsSet));
			return;
		}

		if (dslObj.field && typeof dslObj.field === "string" && dslObj.field.startsWith(factsPrefix)) {
			const pathAfterFactsPrefix = dslObj.field.replace(factsPrefix, "");
			const factName = getFactName(pathAfterFactsPrefix);
			if (isValidString(factName)) {
				factsSet.add(factName);
			}
		}
	}

	/**
	 * Static version for testing purposes
	 * Recursively extracts fact references from DSL expressions
	 * @param dsl - DSL expression to analyze
	 * @param factsSet - Set to collect fact names
	 */
	static extractFactsFromDSL(dsl: unknown, factsSet: Set<string>): void {
		if (!dsl || typeof dsl !== "object") {
			return;
		}

		const dslObj = dsl as Record<string, unknown>;
		const factsPrefix = `${ATTRIBUTE_SOURCES.FACTS}.`;

		if (dslObj.operator === LOGICAL_OPERATOR.AND && Array.isArray(dslObj.conditions)) {
			(dslObj.conditions as unknown[]).forEach(condition => FactsManager.extractFactsFromDSL(condition, factsSet));
			return;
		}

		if (dslObj.operator === LOGICAL_OPERATOR.OR && Array.isArray(dslObj.conditions)) {
			(dslObj.conditions as unknown[]).forEach(condition => FactsManager.extractFactsFromDSL(condition, factsSet));
			return;
		}

		if (dslObj.field && typeof dslObj.field === "string" && dslObj.field.startsWith(factsPrefix)) {
			const pathAfterFactsPrefix = dslObj.field.replace(factsPrefix, "");
			const factName = getFactName(pathAfterFactsPrefix);
			if (isValidString(factName)) {
				factsSet.add(factName);
			}
		}
	}
}
