import { Workflows } from "@joinworth/types";
import { logger } from "#helpers/logger";
import type { CaseData } from "#core/types";
import type { JsonLogicTrigger } from "#core/trigger/types";
import type { DetailedEvaluationResult } from "./types";
import type { DSLRule } from "#helpers/workflow/types";
import jsonLogic, { RulesLogic } from "json-logic-js";
import { convertDSLToJSONLogic, isValidDSL, evaluateDSLWithTracking } from "#helpers/workflow";
import { normalizeFacts } from "#helpers/dates";
import { transformCustomFields } from "#helpers/customFields";
import { FIELD_PREFIXES } from "#constants";

const LOGICAL_OPERATOR = Workflows.Conditions.LOGICAL_OPERATOR;

/**
 * Base class for all evaluators that use JSON Logic
 * Provides common functionality for JSON Logic evaluation
 */
export abstract class BaseEvaluator {
	/**
	 * Prepares evaluation data by extracting and transforming custom fields
	 * @param caseData - The case data with potential custom_fields
	 * @param facts - Optional facts data from warehouse service
	 * @returns Prepared data object with case, facts, and custom_fields
	 */
	private static prepareEvaluationData(caseData: CaseData, facts?: Record<string, unknown>): Record<string, unknown> {
		const { custom_fields, ...caseDataBasic } = caseData as CaseData & {
			custom_fields?: Record<string, unknown>;
		};
		const transformedCustomFields = transformCustomFields(custom_fields);
		const normalizedFacts = facts ? normalizeFacts(facts) : undefined;

		return {
			case: caseDataBasic,
			...(normalizedFacts && { [FIELD_PREFIXES.FACTS]: normalizedFacts }),
			[FIELD_PREFIXES.CUSTOM_FIELDS]: transformedCustomFields
		};
	}

	/**
	 * Evaluates a JSON Logic expression against case data and optional facts
	 * Automatically converts DSL to JSON Logic if needed
	 * Normalizes date strings in facts to timestamps for consistent comparison
	 * @param expression - The JSON Logic or DSL expression to evaluate
	 * @param caseData - The case data to evaluate against
	 * @param facts - Optional facts data from warehouse service
	 * @param context - Context for error messages (e.g., "trigger", "rule conditions")
	 * @returns boolean result of the evaluation
	 */
	protected static evaluateJsonLogic(
		expression: JsonLogicTrigger,
		caseData: CaseData,
		facts?: Record<string, unknown>,
		context: string = "expression"
	): boolean {
		const processedExpression = this.validateAndProcessExpression(expression as Record<string, unknown>, context);

		try {
			const data = this.prepareEvaluationData(caseData, facts);

			const result = Boolean(jsonLogic.apply(processedExpression, data));
			logger.debug(`JSON Logic evaluation result: ${result}`, { expression: processedExpression, data });
			return result;
		} catch (err) {
			logger.error({ error: err }, "JSON Logic evaluation failed");
			return false;
		}
	}

	/**
	 * Validates and processes expression in one step (optimized)
	 * @param expression - The expression to validate and process
	 * @param context - Context for error messages
	 * @returns JSON Logic expression ready for evaluation
	 * @throws Error if expression is invalid
	 */
	protected static validateAndProcessExpression(expression: Record<string, unknown>, context: string): RulesLogic {
		if (!expression || typeof expression !== "object") {
			throw new Error(`Invalid ${context} format. Expected JSON Logic or DSL object, got: ${typeof expression}`);
		}

		if (this.isDSLFormat(expression)) {
			logger.debug(`Converting DSL to JSON Logic for ${context}`);
			return convertDSLToJSONLogic(expression);
		}

		if (!this.isValidJsonLogicFormat(expression)) {
			throw new Error(
				`Invalid ${context} format. No valid JSON Logic operators found. Expected valid JSON Logic or DSL format.`
			);
		}

		logger.debug(`Using existing JSON Logic format for ${context}`);
		return expression as RulesLogic;
	}

	/**
	 * Checks if the expression is in DSL format
	 * @param expression - The expression to check
	 * @returns true if DSL format, false if JSON Logic format
	 */
	private static isDSLFormat(expression: Record<string, unknown>): boolean {
		// DSL format has: { operator: "AND", conditions: [...] }
		// JSON Logic format has: { and: [...] } or other JSON Logic operators
		return (
			expression.operator === LOGICAL_OPERATOR.AND &&
			Array.isArray(expression.conditions) &&
			!expression.and &&
			isValidDSL(expression)
		);
	}

	/**
	 * Validates if the expression is a valid JSON Logic format
	 * @param expression - The expression to check
	 * @returns true if valid JSON Logic format
	 */
	private static isValidJsonLogicFormat(expression: Record<string, unknown>): boolean {
		const validOperators = ["and", "or", "==", "!=", ">", "<", ">=", "<=", "in", "contains", "!"];
		return Object.keys(expression).some(key => validOperators.includes(key));
	}

	/**
	 * Evaluates a DSL expression and returns detailed result with condition tracking
	 * Tracks each condition's result with actual/expected values
	 * @param expression - The DSL expression to evaluate
	 * @param caseData - The case data to evaluate against
	 * @param facts - Optional facts data from warehouse service
	 * @param context - Context for error messages
	 * @returns DetailedEvaluationResult with result and classified conditions
	 * @throws Error if expression is not valid DSL format
	 */
	protected static evaluateWithDetails(
		expression: JsonLogicTrigger,
		caseData: CaseData,
		facts?: Record<string, unknown>,
		context: string = "expression"
	): DetailedEvaluationResult {
		if (!expression || typeof expression !== "object") {
			throw new Error(`Invalid ${context} format. Expected DSL object, got: ${typeof expression}`);
		}

		if (!this.isDSLFormat(expression as Record<string, unknown>)) {
			throw new Error(`Invalid ${context} format. Expected DSL format with operator and conditions.`);
		}

		const data = this.prepareEvaluationData(caseData, facts);

		const result = evaluateDSLWithTracking(expression as unknown as DSLRule, data);
		logger.debug(`DSL evaluation with tracking result: ${result.result}`, {
			trueCount: result.true_conditions.length,
			falseCount: result.false_conditions.length
		});
		return result;
	}
}
