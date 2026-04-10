import { ExecutionLogEnricher } from "../executionLogEnricher";
import type { EvaluationLog, WorkflowEvaluationLog } from "#core/evaluators/types";
import type { RuleEvaluationLog } from "#core/rule/types";
import type { ConditionEvaluationDetail } from "#core/evaluators/types";
import type { ExecutionLogRecord } from "../types";
import { ACTION_TYPES, DECISION_TYPES } from "#constants";

describe("executionLogEnricher", () => {
	describe("findMatchedRule", () => {
		it("should find matched rule when it exists", () => {
			const evaluationLog: EvaluationLog = {
				workflows_evaluated: [],
				trigger_evaluations: [],
				rule_evaluations: [
					{
						workflow_id: "workflow-1",
						rule_id: "rule-1",
						rule_name: "Test Rule",
						matched: true
					} as RuleEvaluationLog
				]
			};

			const result = ExecutionLogEnricher.findMatchedRule(evaluationLog, "workflow-1");

			expect(result).not.toBeNull();
			expect(result?.rule_name).toBe("Test Rule");
		});

		it("should return null when no rule matched", () => {
			const evaluationLog: EvaluationLog = {
				workflows_evaluated: [],
				trigger_evaluations: [],
				rule_evaluations: [
					{
						workflow_id: "workflow-1",
						rule_id: "rule-1",
						rule_name: "Test Rule",
						matched: false
					} as RuleEvaluationLog
				]
			};

			const result = ExecutionLogEnricher.findMatchedRule(evaluationLog, "workflow-1");

			expect(result).toBeNull();
		});

		it("should return null when evaluation log is null", () => {
			const result = ExecutionLogEnricher.findMatchedRule(null, "workflow-1");
			expect(result).toBeNull();
		});
	});

	describe("determineDecisionType", () => {
		it("should return RULE_MATCHED when matched_rule_id exists", () => {
			const evaluationLog: EvaluationLog = {
				workflows_evaluated: [],
				trigger_evaluations: [],
				rule_evaluations: []
			};

			const result = ExecutionLogEnricher.determineDecisionType("rule-1", evaluationLog);

			expect(result).toBe(DECISION_TYPES.RULE_MATCHED);
		});

		it("should return DEFAULT_ACTION when default_action_applied is true", () => {
			const evaluationLog = {
				workflows_evaluated: [],
				trigger_evaluations: [],
				rule_evaluations: [],
				default_action_applied: true
			} as unknown as EvaluationLog;

			const result = ExecutionLogEnricher.determineDecisionType(null, evaluationLog);

			expect(result).toBe(DECISION_TYPES.DEFAULT_ACTION);
		});

		it("should return NO_ACTION when no rule matched and no default action applied", () => {
			const evaluationLog: EvaluationLog = {
				workflows_evaluated: [
					{
						workflow_id: "workflow-1",
						trigger_matched: true,
						rules_evaluated: 2
					} as WorkflowEvaluationLog
				],
				trigger_evaluations: [],
				rule_evaluations: [],
				default_action_applied: false
			};

			const result = ExecutionLogEnricher.determineDecisionType(null, evaluationLog);

			expect(result).toBe(DECISION_TYPES.NO_ACTION);
		});
	});

	describe("formatRuleOutcome", () => {
		it("should format AUTO_APPROVED to AUTO APPROVED", () => {
			const actionApplied = {
				type: ACTION_TYPES.SET_FIELD,
				parameters: {
					field: "case.status",
					value: "AUTO_APPROVED"
				}
			};

			const result = ExecutionLogEnricher.formatRuleOutcome(actionApplied);

			expect(result).toBe("AUTO APPROVED");
		});

		it("should format AUTO_REJECTED to AUTO REJECTED", () => {
			const actionApplied = {
				type: ACTION_TYPES.SET_FIELD,
				parameters: {
					field: "case.status",
					value: "AUTO_REJECTED"
				}
			};

			const result = ExecutionLogEnricher.formatRuleOutcome(actionApplied);

			expect(result).toBe("AUTO REJECTED");
		});

		it("should return null for non-SET_FIELD actions", () => {
			const actionApplied = {
				type: "OTHER_ACTION",
				parameters: {}
			};

			const result = ExecutionLogEnricher.formatRuleOutcome(actionApplied);

			expect(result).toBeNull();
		});

		it("should return null when action_applied is null", () => {
			const result = ExecutionLogEnricher.formatRuleOutcome(null);
			expect(result).toBeNull();
		});
	});

	describe("extractActionDetails", () => {
		it("should extract action details correctly", () => {
			const actionApplied = {
				type: ACTION_TYPES.SET_FIELD,
				parameters: {
					field: "case.status",
					value: "AUTO_APPROVED"
				}
			};

			const result = ExecutionLogEnricher.extractActionDetails(actionApplied);

			expect(result.action_type).toBe(ACTION_TYPES.SET_FIELD);
			expect(result.action_target_field).toBe("case.status");
			expect(result.action_value).toBe("AUTO_APPROVED");
		});

		it("should handle array of actions", () => {
			const actionApplied = [
				{
					type: ACTION_TYPES.SET_FIELD,
					parameters: {
						field: "case.status",
						value: "AUTO_APPROVED"
					}
				}
			] as unknown as Record<string, unknown>;

			const result = ExecutionLogEnricher.extractActionDetails(actionApplied);

			expect(result.action_type).toBe(ACTION_TYPES.SET_FIELD);
			expect(result.action_target_field).toBe("case.status");
		});

		it("should return null values when action_applied is null", () => {
			const result = ExecutionLogEnricher.extractActionDetails(null);

			expect(result.action_type).toBeNull();
			expect(result.action_target_field).toBeNull();
			expect(result.action_value).toBeNull();
		});
	});

	describe("formatAllConditions", () => {
		it("should format all conditions with passed first, then failed", () => {
			const attributeLabels = new Map<string, string>([
				["facts.score", "Credit Score"],
				["facts.age", "Age"]
			]);

			const trueConditions: ConditionEvaluationDetail[] = [
				{
					field: "facts.score",
					operator: ">=",
					expected_value: 700,
					actual_value: 750,
					result: true
				}
			];

			const falseConditions: ConditionEvaluationDetail[] = [
				{
					field: "facts.age",
					operator: ">=",
					expected_value: 18,
					actual_value: 16,
					result: false
				}
			];

			const result = ExecutionLogEnricher.formatAllConditions(trueConditions, falseConditions, attributeLabels);

			expect(result).toContain("Credit Score");
			expect(result).toContain("Age");
			expect(result).toContain("✓");
			expect(result).toContain("✗");

			const lines = result.split("\n").filter(line => line.trim() !== "");
			expect(lines.length).toBeGreaterThanOrEqual(2);
			expect(lines.some(line => line.includes("✓"))).toBe(true);
			expect(lines.some(line => line.includes("✗"))).toBe(true);
		});

		it("should return empty string when no conditions", () => {
			const result = ExecutionLogEnricher.formatAllConditions(undefined, undefined, new Map());
			expect(result).toBe("");
		});

		it("should return empty string when conditions are empty arrays", () => {
			const result = ExecutionLogEnricher.formatAllConditions([], [], new Map());
			expect(result).toBe("");
		});

		it("should return only passed conditions when no failed conditions", () => {
			const attributeLabels = new Map<string, string>([["facts.score", "Credit Score"]]);
			const trueConditions: ConditionEvaluationDetail[] = [
				{
					field: "facts.score",
					operator: ">=",
					expected_value: 700,
					actual_value: 750,
					result: true
				}
			];

			const result = ExecutionLogEnricher.formatAllConditions(trueConditions, undefined, attributeLabels);
			expect(result).toContain("Credit Score");
			expect(result).toContain("✓");
			expect(result).not.toContain("✗");
		});

		it("should return only failed conditions when no passed conditions", () => {
			const attributeLabels = new Map<string, string>([["facts.age", "Age"]]);
			const falseConditions: ConditionEvaluationDetail[] = [
				{
					field: "facts.age",
					operator: ">=",
					expected_value: 18,
					actual_value: 16,
					result: false
				}
			];

			const result = ExecutionLogEnricher.formatAllConditions(undefined, falseConditions, attributeLabels);
			expect(result).toContain("Age");
			expect(result).toContain("✗");
			expect(result).not.toContain("✓");
		});
	});

	describe("extractUniqueFields", () => {
		it("should extract unique fields from rule evaluations", () => {
			const ruleEvaluations: RuleEvaluationLog[] = [
				{
					workflow_id: "workflow-1",
					rule_id: "rule-1",
					rule_name: "Rule 1",
					matched: true,
					true_conditions: [
						{
							field: "facts.score",
							operator: ">=",
							expected_value: 700,
							actual_value: 750,
							result: true
						}
					],
					false_conditions: [
						{
							field: "facts.country",
							operator: "!=",
							expected_value: "US",
							actual_value: "US",
							result: false
						}
					]
				} as RuleEvaluationLog
			];

			const result = ExecutionLogEnricher.extractUniqueFields(ruleEvaluations);

			expect(result).toContain("facts.score");
			expect(result).toContain("facts.country");
			expect(result.length).toBe(2);
		});
	});

	describe("enrichExecutionLogForCSV", () => {
		it("should enrich log with all fields", () => {
			const log: ExecutionLogRecord = {
				case_id: "case-1",
				workflow_version_id: "version-1",
				matched_rule_id: "rule-1",
				executed_at: new Date(),
				input_attr: {},
				evaluation_log: {
					workflows_evaluated: [
						{
							workflow_id: "workflow-1",
							trigger_matched: true,
							rules_evaluated: 2
						}
					],
					trigger_evaluations: [],
					rule_evaluations: [
						{
							workflow_id: "workflow-1",
							rule_id: "rule-1",
							rule_name: "Test Rule",
							matched: true,
							true_conditions: [
								{
									field: "facts.score",
									operator: ">=",
									expected_value: 700,
									actual_value: 750,
									result: true
								}
							],
							false_conditions: []
						}
					]
				} as unknown as Record<string, unknown>,
				latency_ms: 100,
				created_at: new Date(),
				customer_id: "customer-1",
				workflow_id: "workflow-1",
				action_applied: {
					type: ACTION_TYPES.SET_FIELD,
					parameters: {
						field: "case.status",
						value: "AUTO_APPROVED"
					}
				}
			};

			const attributeLabels = new Map<string, string>([["facts.score", "Credit Score"]]);
			const workflowNames = new Map<string, { name: string; version: string }>([
				["workflow-1", { name: "Test Workflow", version: "1.0" }]
			]);

			const result = ExecutionLogEnricher.enrichExecutionLogForCSV(log, attributeLabels, workflowNames);

			expect(result.matched_rule_name).toBe("Test Rule");
			expect(result.decision_type).toBe(DECISION_TYPES.RULE_MATCHED);
			expect(result.trigger_matched).toBe("Yes");
			expect(result.total_rules_evaluated).toBe(2);
			expect(result.rule_outcome).toBe("AUTO APPROVED");
			expect(result.action_type).toBe(ACTION_TYPES.SET_FIELD);
			expect(result.action_target_field).toBe("case.status");
			expect(result.conditions).toBeTruthy();
			expect(result.conditions).toContain("✓");
			expect(result.conditions).toContain("Workflow Test Workflow");
		});

		it("should set conditions to null when no conditions exist", () => {
			const log: ExecutionLogRecord = {
				case_id: "case-2",
				workflow_version_id: "version-1",
				matched_rule_id: "rule-1",
				executed_at: new Date(),
				input_attr: {},
				evaluation_log: {
					workflows_evaluated: [
						{
							workflow_id: "workflow-1",
							trigger_matched: true,
							rules_evaluated: 1
						}
					],
					trigger_evaluations: [],
					rule_evaluations: [
						{
							workflow_id: "workflow-1",
							rule_id: "rule-1",
							rule_name: "Test Rule",
							matched: true,
							true_conditions: [],
							false_conditions: []
						}
					]
				} as unknown as Record<string, unknown>,
				latency_ms: 100,
				created_at: new Date(),
				customer_id: "customer-1",
				workflow_id: "workflow-1",
				action_applied: {
					type: ACTION_TYPES.SET_FIELD,
					parameters: {
						field: "case.status",
						value: "AUTO_APPROVED"
					}
				}
			};

			const attributeLabels = new Map<string, string>();
			const workflowNames = new Map<string, { name: string; version: string }>();
			const result = ExecutionLogEnricher.enrichExecutionLogForCSV(log, attributeLabels, workflowNames);

			expect(result.conditions).toBeNull();
		});

		it("should include conditions from all workflows with workflow names", () => {
			const log: ExecutionLogRecord = {
				case_id: "case-3",
				workflow_version_id: "version-1",
				matched_rule_id: "rule-1",
				executed_at: new Date(),
				input_attr: {},
				evaluation_log: {
					workflows_evaluated: [
						{
							workflow_id: "workflow-1",
							trigger_matched: true,
							rules_evaluated: 1
						},
						{
							workflow_id: "workflow-2",
							trigger_matched: true,
							rules_evaluated: 1
						}
					],
					trigger_evaluations: [],
					rule_evaluations: [
						{
							workflow_id: "workflow-1",
							rule_id: "rule-1",
							rule_name: "Rule 1",
							matched: true,
							true_conditions: [
								{
									field: "facts.score",
									operator: ">=",
									expected_value: 700,
									actual_value: 750,
									result: true
								}
							],
							false_conditions: []
						},
						{
							workflow_id: "workflow-2",
							rule_id: "rule-2",
							rule_name: "Rule 2",
							matched: false,
							true_conditions: [],
							false_conditions: [
								{
									field: "facts.age",
									operator: ">=",
									expected_value: 18,
									actual_value: 16,
									result: false
								}
							]
						}
					]
				} as unknown as Record<string, unknown>,
				latency_ms: 100,
				created_at: new Date(),
				customer_id: "customer-1",
				workflow_id: "workflow-1",
				action_applied: null
			};

			const attributeLabels = new Map<string, string>([
				["facts.score", "Credit Score"],
				["facts.age", "Age"]
			]);
			const workflowNames = new Map<string, { name: string; version: string }>([
				["workflow-1", { name: "First Workflow", version: "1.0" }],
				["workflow-2", { name: "Second Workflow", version: "2.0" }]
			]);

			const result = ExecutionLogEnricher.enrichExecutionLogForCSV(log, attributeLabels, workflowNames);

			expect(result.conditions).toBeTruthy();
			expect(result.conditions).toContain("Workflow First Workflow");
			expect(result.conditions).toContain("Workflow Second Workflow");
			expect(result.conditions).toContain("Credit Score");
			expect(result.conditions).toContain("Age");
			expect(result.conditions).toContain("✓");
			expect(result.conditions).toContain("✗");
		});

		it("should use workflow_id when workflow name is not found", () => {
			const log: ExecutionLogRecord = {
				case_id: "case-4",
				workflow_version_id: "version-1",
				matched_rule_id: "rule-1",
				executed_at: new Date(),
				input_attr: {},
				evaluation_log: {
					workflows_evaluated: [
						{
							workflow_id: "workflow-unknown",
							trigger_matched: true,
							rules_evaluated: 1
						}
					],
					trigger_evaluations: [],
					rule_evaluations: [
						{
							workflow_id: "workflow-unknown",
							rule_id: "rule-1",
							rule_name: "Test Rule",
							matched: true,
							true_conditions: [
								{
									field: "facts.score",
									operator: ">=",
									expected_value: 700,
									actual_value: 750,
									result: true
								}
							],
							false_conditions: []
						}
					]
				} as unknown as Record<string, unknown>,
				latency_ms: 100,
				created_at: new Date(),
				customer_id: "customer-1",
				workflow_id: "workflow-unknown",
				action_applied: null
			};

			const attributeLabels = new Map<string, string>([["facts.score", "Credit Score"]]);
			const workflowNames = new Map<string, { name: string; version: string }>();

			const result = ExecutionLogEnricher.enrichExecutionLogForCSV(log, attributeLabels, workflowNames);

			expect(result.conditions).toBeTruthy();
			expect(result.conditions).toContain("Credit Score");
			expect(result.conditions).not.toContain("Workflow workflow-unknown");
			expect(result.conditions).not.toContain("Workflow");
		});
	});
});
