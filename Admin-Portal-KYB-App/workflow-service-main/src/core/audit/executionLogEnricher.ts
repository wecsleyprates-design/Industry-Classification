import { logger } from "#helpers/logger";
import type { ExecutionLogRecord } from "./types";
import type { EnrichedExecutionLogRecord } from "./types";
import type { EvaluationLog, WorkflowEvaluationLog } from "#core/evaluators/types";
import type { ConditionEvaluationDetail } from "#core/evaluators/types";
import type { RuleEvaluationLog } from "#core/rule/types";
import {
	ACTION_TYPES,
	DECISION_TYPES,
	OPERATOR_LABELS,
	CONDITION_RESULT_LABELS,
	VALUE_LABELS,
	BOOLEAN_LABELS,
	BETWEEN_SEPARATOR,
	CONDITION_PREFIX
} from "#constants";
import { COMPARISON_OPERATOR } from "#helpers/workflow";

/**
 * Utility class for enriching execution logs with human-readable fields
 * Provides static methods for parsing, formatting, and extracting data from execution logs
 */
export class ExecutionLogEnricher {
	/**
	 * Type guard for action objects
	 */
	private static isActionObject(value: unknown): value is { type: string; parameters?: Record<string, unknown> } {
		return typeof value === "object" && value !== null && "type" in value;
	}

	/**
	 * Parses evaluation_log from ExecutionLogRecord to EvaluationLog
	 * Handles both string (JSON) and object formats
	 * @param log - The execution log record containing evaluation_log
	 * @returns Parsed EvaluationLog or null if parsing fails or log is missing
	 */
	static parseEvaluationLog(log: ExecutionLogRecord): EvaluationLog | null {
		if (!log.evaluation_log) {
			return null;
		}

		try {
			return typeof log.evaluation_log === "string"
				? (JSON.parse(log.evaluation_log) as unknown as EvaluationLog)
				: (log.evaluation_log as unknown as EvaluationLog);
		} catch (error) {
			logger.debug("Failed to parse evaluation_log, continuing with null", {
				case_id: log.case_id,
				workflow_id: log.workflow_id,
				error: error instanceof Error ? error.message : String(error)
			});
			return null;
		}
	}

	/**
	 * Finds the matched rule from evaluation log
	 * @param evaluationLog - The evaluation log containing rule evaluations
	 * @param workflowId - The workflow ID to match against
	 * @returns Object with rule name and evaluation details, or null if no match found
	 */
	static findMatchedRule(
		evaluationLog: EvaluationLog | null,
		workflowId: string
	): { rule_name: string; rule_evaluation: RuleEvaluationLog } | null {
		if (!evaluationLog?.rule_evaluations) {
			return null;
		}

		const matchedRule = evaluationLog.rule_evaluations.find(
			(rule: RuleEvaluationLog) => rule.workflow_id === workflowId && rule.matched
		);

		if (!matchedRule) {
			return null;
		}

		return {
			rule_name: matchedRule.rule_name,
			rule_evaluation: matchedRule
		};
	}

	/**
	 * Determines the decision type (RULE_MATCHED, DEFAULT_ACTION, or NO_ACTION)
	 * @param matchedRuleId - The ID of the matched rule, if any
	 * @param evaluationLog - The evaluation log containing workflow evaluations
	 * @returns Decision type (RULE_MATCHED, DEFAULT_ACTION, NO_ACTION) or null if evaluationLog is missing
	 */
	static determineDecisionType(
		matchedRuleId: string | null,
		evaluationLog: EvaluationLog | null
	):
		| typeof DECISION_TYPES.RULE_MATCHED
		| typeof DECISION_TYPES.DEFAULT_ACTION
		| typeof DECISION_TYPES.NO_ACTION
		| null {
		if (matchedRuleId) {
			return DECISION_TYPES.RULE_MATCHED;
		}

		if (!evaluationLog) {
			return null;
		}

		if (evaluationLog.default_action_applied) {
			return DECISION_TYPES.DEFAULT_ACTION;
		}

		return DECISION_TYPES.NO_ACTION;
	}

	/**
	 * Extracts rule outcome value from action parameters
	 * @param params - The action parameters object
	 * @returns Formatted rule outcome string or null if not applicable
	 */
	private static extractRuleOutcomeFromParams(params: unknown): string | null {
		if (typeof params !== "object" || params === null || !("field" in params) || !("value" in params)) {
			return null;
		}

		const fieldValue = params.field;
		const value = params.value;

		if (fieldValue !== "case.status" || value === undefined) {
			return null;
		}

		return typeof value === "string" ? value.replace(/_/g, " ") : String(value);
	}

	/**
	 * Formats rule outcome by converting underscores to spaces
	 * @param actionApplied - The action applied record from the execution log
	 * @returns Formatted rule outcome string (e.g., "AUTO APPROVED") or null if not applicable
	 */
	static formatRuleOutcome(actionApplied: Record<string, unknown> | null): string | null {
		if (!actionApplied) {
			return null;
		}

		const action = Array.isArray(actionApplied) ? (actionApplied[0] as Record<string, unknown>) : actionApplied;

		if (!this.isActionObject(action)) {
			return null;
		}

		if (action.type !== ACTION_TYPES.SET_FIELD || !action.parameters) {
			return null;
		}

		return this.extractRuleOutcomeFromParams(action.parameters);
	}

	/**
	 * Extracts action details (type, target field, value) from action applied record
	 * @param actionApplied - The action applied record from the execution log
	 * @returns Object containing action_type, action_target_field, and action_value
	 */
	static extractActionDetails(actionApplied: Record<string, unknown> | null): {
		action_type: string | null;
		action_target_field: string | null;
		action_value: unknown;
	} {
		if (!actionApplied) {
			return {
				action_type: null,
				action_target_field: null,
				action_value: null
			};
		}

		const action = Array.isArray(actionApplied) ? (actionApplied[0] as Record<string, unknown>) : actionApplied;

		if (!this.isActionObject(action)) {
			return {
				action_type: null,
				action_target_field: null,
				action_value: null
			};
		}

		const params = typeof action.parameters === "object" && action.parameters !== null ? action.parameters : {};

		const actionTargetField =
			typeof params === "object" && params !== null && "field" in params && typeof params.field === "string"
				? params.field
				: null;

		const actionValue = typeof params === "object" && params !== null && "value" in params ? params.value : null;

		return {
			action_type: typeof action.type === "string" ? action.type : null,
			action_target_field: actionTargetField,
			action_value: actionValue
		};
	}

	/**
	 * Extracts trigger_matched from evaluation log
	 * @param evaluationLog - The evaluation log containing workflow evaluations
	 * @param workflowId - The workflow ID to check
	 * @returns Boolean indicating if trigger matched, or null if not available
	 */
	static extractTriggerMatched(evaluationLog: EvaluationLog | null, workflowId: string): boolean | null {
		if (!evaluationLog?.workflows_evaluated) {
			return null;
		}

		const workflowEval = evaluationLog.workflows_evaluated.find(
			(w: WorkflowEvaluationLog) => w.workflow_id === workflowId
		);

		return workflowEval?.trigger_matched ?? null;
	}

	/**
	 * Formats boolean value to human-readable "Yes" or "No"
	 * @param value - Boolean value to format, or null/undefined
	 * @returns "Yes" if true, "No" if false, or null if value is null/undefined
	 */
	private static formatBoolean(value: boolean | null | undefined): string | null {
		if (value === null || value === undefined) {
			return null;
		}
		return value ? BOOLEAN_LABELS.YES : BOOLEAN_LABELS.NO;
	}

	/**
	 * Extracts total_rules_evaluated from evaluation log
	 * @param evaluationLog - The evaluation log containing workflow evaluations
	 * @param workflowId - The workflow ID to check
	 * @returns Number of rules evaluated, or null if not available
	 */
	static extractTotalRulesEvaluated(evaluationLog: EvaluationLog | null, workflowId: string): number | null {
		if (!evaluationLog?.workflows_evaluated) {
			return null;
		}

		const workflowEval = evaluationLog.workflows_evaluated.find(
			(w: WorkflowEvaluationLog) => w.workflow_id === workflowId
		);

		return workflowEval?.rules_evaluated ?? null;
	}

	/**
	 * Formats operator for human-readable display
	 * Uses OPERATOR_LABELS from constants as source of truth
	 * @param operator - The operator string to format
	 * @returns Human-readable operator name for display
	 */
	private static formatOperator(operator: string): string {
		const label = operator in OPERATOR_LABELS ? OPERATOR_LABELS[operator as keyof typeof OPERATOR_LABELS] : undefined;
		return label ?? operator;
	}

	/**
	 * Formats value for human-readable display
	 * @param value - The value to format (unknown type - can be string, number, boolean, array, object, null, or undefined)
	 * @returns Formatted string representation of the value
	 */
	private static formatValue(value: unknown): string {
		if (value === null) {
			return VALUE_LABELS.NULL;
		}
		if (value === undefined) {
			return VALUE_LABELS.UNDEFINED;
		}
		if (typeof value === "string") {
			return `'${value}'`;
		}
		if (typeof value === "boolean") {
			return String(value);
		}
		if (typeof value === "number") {
			return String(value);
		}
		if (Array.isArray(value)) {
			return `[${value.map(v => this.formatValue(v)).join(", ")}]`;
		}
		if (typeof value === "object") {
			return JSON.stringify(value);
		}
		return String(value);
	}

	/**
	 * Formats expected value with operator for human-readable display
	 * @param operator - The operator being used
	 * @param expectedValue - The expected value to format
	 * @returns Formatted string representation of the expected value with operator context
	 */
	private static formatExpectedValue(operator: string, expectedValue: unknown): string {
		if (operator === COMPARISON_OPERATOR.BETWEEN && Array.isArray(expectedValue) && expectedValue.length === 2) {
			return `${this.formatValue(expectedValue[0])} ${BETWEEN_SEPARATOR} ${this.formatValue(expectedValue[1])}`;
		}
		if (operator === COMPARISON_OPERATOR.IN || operator === COMPARISON_OPERATOR.NOT_IN) {
			return this.formatValue(expectedValue);
		}
		return this.formatValue(expectedValue);
	}

	/**
	 * Checks if an operator is a null/empty check operator that doesn't require an expected value
	 * @param operator - The comparison operator to check
	 * @returns True if the operator is a null/empty check operator
	 */
	private static isNullCheckOperator(operator: string): boolean {
		return (
			operator === COMPARISON_OPERATOR.IS_NULL ||
			operator === COMPARISON_OPERATOR.IS_NOT_NULL ||
			operator === COMPARISON_OPERATOR.ARRAY_IS_EMPTY ||
			operator === COMPARISON_OPERATOR.ARRAY_IS_NOT_EMPTY
		);
	}

	/**
	 * Extracts formatted parts of a condition for reuse
	 * @param condition - The condition evaluation detail to format
	 * @param attributeLabels - Map of field paths to their human-readable labels
	 * @returns Object with formatted parts (label, operator, expectedStr, actualStr, isNullCheckOperator)
	 */
	private static extractConditionParts(
		condition: ConditionEvaluationDetail,
		attributeLabels: Map<string, string>
	): {
		label: string;
		operator: string;
		expectedStr: string | null;
		actualStr: string;
		isNullCheckOperator: boolean;
	} {
		const label = attributeLabels.get(condition.field) ?? condition.field;
		const operator = this.formatOperator(condition.operator);
		const actualStr = this.formatValue(condition.actual_value);
		const isNullCheckOperator = this.isNullCheckOperator(condition.operator);

		const expectedStr = isNullCheckOperator
			? null
			: this.formatExpectedValue(condition.operator, condition.expected_value);

		return { label, operator, expectedStr, actualStr, isNullCheckOperator };
	}

	/**
	 * Formats a single condition for human-readable display
	 * @param condition - The condition evaluation detail to format
	 * @param attributeLabels - Map of field paths to their human-readable labels
	 * @param isPassed - Whether the condition passed or failed
	 * @param workflowName - Optional workflow name to prefix the condition
	 * @returns Human-readable string representation of the condition
	 */
	private static formatCondition(
		condition: ConditionEvaluationDetail,
		attributeLabels: Map<string, string>,
		isPassed: boolean,
		workflowName?: string
	): string {
		const parts = this.extractConditionParts(condition, attributeLabels);
		const resultLabels = isPassed ? CONDITION_RESULT_LABELS.PASSED : CONDITION_RESULT_LABELS.FAILED;
		const workflowPrefix = workflowName ? `Workflow ${workflowName} - ` : "";

		if (parts.isNullCheckOperator) {
			return `${workflowPrefix}${CONDITION_PREFIX} ${parts.label} ${parts.operator}, ${resultLabels.TEXT} ${parts.actualStr} ${resultLabels.SYMBOL}`;
		}

		return `${workflowPrefix}${CONDITION_PREFIX} ${parts.label} ${parts.operator} ${parts.expectedStr}, ${resultLabels.TEXT} ${parts.actualStr} ${resultLabels.SYMBOL}`;
	}

	/**
	 * Formats all conditions (passed and failed) into a single string
	 * @param trueConditions - Array of passed condition evaluation details
	 * @param falseConditions - Array of failed condition evaluation details
	 * @param attributeLabels - Map of field paths to their human-readable labels
	 * @param workflowName - Optional workflow name to prefix each condition
	 * @returns Multi-line string with all formatted conditions, or empty string if no conditions
	 */
	static formatAllConditions(
		trueConditions: ConditionEvaluationDetail[] | undefined,
		falseConditions: ConditionEvaluationDetail[] | undefined,
		attributeLabels: Map<string, string>,
		workflowName?: string
	): string {
		const passed = trueConditions?.map(c => this.formatCondition(c, attributeLabels, true, workflowName) + "\n") ?? [];
		const failed =
			falseConditions?.map(c => this.formatCondition(c, attributeLabels, false, workflowName) + "\n") ?? [];

		return [...passed, ...failed].join("");
	}

	/**
	 * Formats a single condition as an object
	 * @param condition - The condition evaluation detail to format
	 * @param attributeLabels - Map of field paths to their human-readable labels
	 * @param isPassed - Whether the condition passed or failed
	 * @returns Object with name, field and description properties
	 */
	private static formatConditionAsObject(
		condition: ConditionEvaluationDetail,
		attributeLabels: Map<string, string>,
		isPassed: boolean
	): { name: string; field: string; description: string } {
		const parts = this.extractConditionParts(condition, attributeLabels);
		const description = this.formatCondition(condition, attributeLabels, isPassed);

		return {
			name: parts.label,
			field: condition.field,
			description
		};
	}

	/**
	 * Formats conditions (passed and failed) as arrays of objects with name and description
	 * @param trueConditions - Array of passed condition evaluation details
	 * @param falseConditions - Array of failed condition evaluation details
	 * @param attributeLabels - Map of field paths to their human-readable labels
	 * @returns Object with failed and passed arrays of condition objects
	 */
	static formatConditionsAsObjects(
		trueConditions: ConditionEvaluationDetail[] | undefined,
		falseConditions: ConditionEvaluationDetail[] | undefined,
		attributeLabels: Map<string, string>
	): {
		failed: Array<{ name: string; description: string }>;
		passed: Array<{ name: string; description: string }>;
	} {
		const failed = falseConditions?.map(c => this.formatConditionAsObject(c, attributeLabels, false)) ?? [];
		const passed = trueConditions?.map(c => this.formatConditionAsObject(c, attributeLabels, true)) ?? [];

		return { failed, passed };
	}

	/**
	 * Extracts all unique field paths from rule evaluations
	 * @param ruleEvaluations - Array of rule evaluation logs to extract fields from
	 * @returns Array of unique field paths found in true_conditions and false_conditions
	 */
	static extractUniqueFields(ruleEvaluations: RuleEvaluationLog[]): string[] {
		const fields = new Set<string>();

		for (const ruleEval of ruleEvaluations) {
			if (ruleEval.true_conditions) {
				for (const condition of ruleEval.true_conditions) {
					fields.add(condition.field);
				}
			}
			if (ruleEval.false_conditions) {
				for (const condition of ruleEval.false_conditions) {
					fields.add(condition.field);
				}
			}
		}

		return Array.from(fields);
	}

	/**
	 * Extracts field paths from a rule evaluation
	 * @param ruleEval - The rule evaluation log to extract fields from
	 * @param fields - Set to add extracted field paths to
	 */
	private static extractFieldsFromRuleEvaluation(ruleEval: RuleEvaluationLog, fields: Set<string>): void {
		ruleEval.true_conditions?.forEach(condition => fields.add(condition.field));
		ruleEval.false_conditions?.forEach(condition => fields.add(condition.field));
	}

	/**
	 * Extracts all unique fields from all logs for batch label fetching
	 * @param logs - Array of execution log records to extract fields from
	 * @returns Array of unique field paths found across all logs' rule evaluations
	 */
	static extractAllUniqueFieldsFromLogs(logs: ExecutionLogRecord[]): string[] {
		const fields = new Set<string>();

		for (const log of logs) {
			const evaluationLog = this.parseEvaluationLog(log);
			if (!evaluationLog?.rule_evaluations) {
				continue;
			}

			for (const ruleEval of evaluationLog.rule_evaluations) {
				this.extractFieldsFromRuleEvaluation(ruleEval, fields);
			}
		}

		return Array.from(fields);
	}

	/**
	 * Groups rule evaluations by workflow_id
	 * @param ruleEvaluations - Array of rule evaluation logs
	 * @returns Map of workflow_id to array of rule evaluations
	 */
	private static groupRulesByWorkflow(ruleEvaluations: RuleEvaluationLog[]): Map<string, RuleEvaluationLog[]> {
		const rulesByWorkflow = new Map<string, RuleEvaluationLog[]>();
		for (const ruleEval of ruleEvaluations) {
			const existingRules = rulesByWorkflow.get(ruleEval.workflow_id) ?? [];
			existingRules.push(ruleEval);
			rulesByWorkflow.set(ruleEval.workflow_id, existingRules);
		}
		return rulesByWorkflow;
	}

	/**
	 * Formats all conditions from all workflows and rules into a single string
	 * Groups rules by workflow and formats conditions with workflow identifier
	 * @param evaluationLog - The evaluation log containing all workflows and rules
	 * @param attributeLabels - Map of field paths to their human-readable labels
	 * @param workflowNames - Map of workflow_id to workflow name
	 * @returns Multi-line string with all formatted conditions from all workflows
	 */
	private static formatAllConditionsFromAllWorkflows(
		evaluationLog: EvaluationLog | null,
		attributeLabels: Map<string, string>,
		workflowNames: Map<string, { name: string; version: string }>
	): string {
		if (!evaluationLog?.rule_evaluations || evaluationLog.rule_evaluations.length === 0) {
			return "";
		}

		const rulesByWorkflow = this.groupRulesByWorkflow(evaluationLog.rule_evaluations);

		const allConditions = Array.from(rulesByWorkflow.entries()).flatMap(([workflowId, rules]) => {
			const workflowInfo = workflowNames.get(workflowId);
			const workflowName = workflowInfo?.name;

			return rules
				.map(rule =>
					this.formatAllConditions(rule.true_conditions, rule.false_conditions, attributeLabels, workflowName)
				)
				.filter(conditions => conditions !== "");
		});

		return allConditions.join("");
	}

	/**
	 * Main function to enrich execution log with human-readable fields
	 * @param log - The execution log record to enrich
	 * @param attributeLabels - Map of field paths to their human-readable labels
	 * @param workflowNames - Map of workflow_id to workflow name
	 * @returns Enriched execution log record with human-readable fields
	 */
	static enrichExecutionLogForCSV(
		log: ExecutionLogRecord,
		attributeLabels: Map<string, string>,
		workflowNames: Map<string, { name: string; version: string }> = new Map()
	): EnrichedExecutionLogRecord {
		const enriched: EnrichedExecutionLogRecord = {
			...log
		};

		const evaluationLog = this.parseEvaluationLog(log);

		const matchedRule = this.findMatchedRule(evaluationLog, log.workflow_id);
		enriched.matched_rule_name = matchedRule?.rule_name ?? null;

		enriched.decision_type = this.determineDecisionType(log.matched_rule_id, evaluationLog);

		const triggerMatched = this.extractTriggerMatched(evaluationLog, log.workflow_id);
		enriched.trigger_matched = this.formatBoolean(triggerMatched);
		enriched.total_rules_evaluated = this.extractTotalRulesEvaluated(evaluationLog, log.workflow_id);

		enriched.rule_outcome = this.formatRuleOutcome(log.action_applied);

		const actionDetails = this.extractActionDetails(log.action_applied);
		enriched.action_type = actionDetails.action_type;
		enriched.action_target_field = actionDetails.action_target_field;
		enriched.action_value = actionDetails.action_value;

		const allConditions = this.formatAllConditionsFromAllWorkflows(evaluationLog, attributeLabels, workflowNames);
		enriched.conditions = allConditions === "" ? null : allConditions.trim();

		return enriched;
	}
}
