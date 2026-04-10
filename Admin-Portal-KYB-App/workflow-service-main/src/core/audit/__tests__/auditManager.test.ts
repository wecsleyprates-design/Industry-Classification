import { AuditManager } from "../auditManager";
import { AuditRepository } from "../auditRepository";
import { AttributeRepository } from "#core/attributes/attributeRepository";
import { CaseService } from "#services/case/caseService";
import { ApiError, UserInfo } from "#types/common";
import { StatusCodes } from "http-status-codes";
import { convertToCSV } from "#utils/csvConverter";
import { DECISION_TYPES, FIELD_PREFIXES } from "#constants";
import type { ExecutionWithWorkflowInfo, ExecutionLogRecord, WorkflowChangeLogRecord } from "../types";
import type { EvaluationLog } from "#core/evaluators/types";
import type { RuleEvaluationLog } from "#core/rule/types";

jest.mock("#utils/csvConverter");
jest.mock("../executionLogEnricher", () => ({
	ExecutionLogEnricher: {
		parseEvaluationLog: jest.fn(),
		determineDecisionType: jest.fn(),
		findMatchedRule: jest.fn(),
		formatRuleOutcome: jest.fn(),
		extractUniqueFields: jest.fn(),
		formatConditionsAsObjects: jest.fn(),
		extractAllUniqueFieldsFromLogs: jest.fn(),
		enrichExecutionLogForCSV: jest.fn()
	}
}));

import { ExecutionLogEnricher } from "../executionLogEnricher";

describe("AuditManager", () => {
	let auditManager: AuditManager;
	let mockAuditRepository: jest.Mocked<AuditRepository>;
	let mockAttributeRepository: jest.Mocked<AttributeRepository>;
	let mockCaseService: jest.Mocked<CaseService>;

	beforeEach(() => {
		mockAuditRepository = {
			exportExecutionLog: jest.fn(),
			exportWorkflowChangesLog: jest.fn(),
			getWorkflowsInfoByVersionIds: jest.fn(),
			getWorkflowsInfoByWorkflowIds: jest.fn()
		} as unknown as jest.Mocked<AuditRepository>;

		mockAttributeRepository = {
			getAttributesByPaths: jest.fn()
		} as unknown as jest.Mocked<AttributeRepository>;

		mockCaseService = {
			getCustomFieldsSummary: jest.fn()
		} as unknown as jest.Mocked<CaseService>;

		auditManager = new AuditManager(mockAuditRepository, mockAttributeRepository, mockCaseService);
		jest.clearAllMocks();
	});

	describe("exportExecutionLogs", () => {
		const mockUserInfo = { customer_id: "customer-123" };

		it("should return csvData and filename", async () => {
			const mockLogs = [
				{
					case_id: "case-1",
					workflow_version_id: "version-1",
					matched_rule_id: null,
					executed_at: new Date("2024-01-01"),
					input_attr: null,
					evaluation_log: null,
					latency_ms: 10,
					created_at: new Date("2024-01-01"),
					customer_id: "customer-123",
					workflow_id: "workflow-1",
					action_applied: null
				}
			];
			const mockCsv = "case_id,workflow_id\ncase-1,workflow-1";

			mockAuditRepository.exportExecutionLog.mockResolvedValue(mockLogs as ExecutionLogRecord[]);
			(ExecutionLogEnricher.parseEvaluationLog as jest.Mock).mockReturnValue(null);
			(ExecutionLogEnricher.extractAllUniqueFieldsFromLogs as jest.Mock).mockReturnValue([]);
			mockAttributeRepository.getAttributesByPaths.mockResolvedValue(new Map());
			mockAuditRepository.getWorkflowsInfoByWorkflowIds.mockResolvedValue(new Map());
			(ExecutionLogEnricher.enrichExecutionLogForCSV as jest.Mock).mockImplementation(log => log);
			(convertToCSV as jest.Mock).mockReturnValue(mockCsv);

			const result = await auditManager.exportExecutionLogs({}, mockUserInfo);

			expect(result).toHaveProperty("csvData", mockCsv);
			expect(result).toHaveProperty("filename");
			expect(result.filename).toContain("execution_logs_");
			expect(result.filename).toContain(".csv");
		});

		it("should throw error when customer_id is missing", async () => {
			const emptyUserInfo = { customer_id: "" };

			await expect(auditManager.exportExecutionLogs({}, emptyUserInfo)).rejects.toThrow(ApiError);

			expect(mockAuditRepository.exportExecutionLog).not.toHaveBeenCalled();
		});

		it("should throw error when customer_id is undefined", async () => {
			const emptyUserInfo = { customer_id: undefined } as unknown as UserInfo;

			await expect(auditManager.exportExecutionLogs({}, emptyUserInfo)).rejects.toThrow(ApiError);

			expect(mockAuditRepository.exportExecutionLog).not.toHaveBeenCalled();
		});

		it("should propagate repository errors", async () => {
			const error = new Error("Database error");
			mockAuditRepository.exportExecutionLog.mockRejectedValue(error);

			await expect(auditManager.exportExecutionLogs({}, mockUserInfo)).rejects.toThrow("Database error");
		});

		it("should use custom field labels when custom fields are present", async () => {
			const mockLogs = [
				{
					case_id: "case-1",
					workflow_version_id: "version-1",
					matched_rule_id: null,
					executed_at: new Date("2024-01-01"),
					input_attr: null,
					evaluation_log: null,
					latency_ms: 10,
					created_at: new Date("2024-01-01"),
					customer_id: "customer-123",
					workflow_id: "workflow-1",
					action_applied: null
				}
			];
			const mockCsv = "case_id,workflow_id\ncase-1,workflow-1";
			const customFieldPath = `${FIELD_PREFIXES.CUSTOM_FIELDS}.currency`;
			const customFieldName = "currency";
			const customFieldLabel = "Currency Type";

			mockAuditRepository.exportExecutionLog.mockResolvedValue(mockLogs as ExecutionLogRecord[]);
			(ExecutionLogEnricher.parseEvaluationLog as jest.Mock).mockReturnValue(null);
			(ExecutionLogEnricher.extractAllUniqueFieldsFromLogs as jest.Mock).mockReturnValue([
				"facts.score",
				customFieldPath
			]);
			mockAttributeRepository.getAttributesByPaths.mockResolvedValue(new Map([["facts.score", "Credit Score"]]));
			mockCaseService.getCustomFieldsSummary.mockResolvedValue([
				{ field: customFieldName, type: "string", label: customFieldLabel }
			]);
			mockAuditRepository.getWorkflowsInfoByWorkflowIds.mockResolvedValue(new Map());
			(ExecutionLogEnricher.enrichExecutionLogForCSV as jest.Mock).mockImplementation((log, labels) => {
				expect(labels.has(customFieldPath)).toBe(true);
				expect(labels.get(customFieldPath)).toBe(customFieldLabel);
				return log;
			});
			(convertToCSV as jest.Mock).mockReturnValue(mockCsv);

			await auditManager.exportExecutionLogs({}, mockUserInfo);

			expect(mockCaseService.getCustomFieldsSummary).toHaveBeenCalledWith("customer-123");
			expect(ExecutionLogEnricher.enrichExecutionLogForCSV).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({
					has: expect.any(Function)
				}),
				expect.anything()
			);
		});

		it("should handle CaseService errors gracefully and continue without custom field labels", async () => {
			const mockLogs = [
				{
					case_id: "case-1",
					workflow_version_id: "version-1",
					matched_rule_id: null,
					executed_at: new Date("2024-01-01"),
					input_attr: null,
					evaluation_log: null,
					latency_ms: 10,
					created_at: new Date("2024-01-01"),
					customer_id: "customer-123",
					workflow_id: "workflow-1",
					action_applied: null
				}
			];
			const mockCsv = "case_id,workflow_id\ncase-1,workflow-1";
			const customFieldPath = `${FIELD_PREFIXES.CUSTOM_FIELDS}.currency`;

			mockAuditRepository.exportExecutionLog.mockResolvedValue(mockLogs as ExecutionLogRecord[]);
			(ExecutionLogEnricher.parseEvaluationLog as jest.Mock).mockReturnValue(null);
			(ExecutionLogEnricher.extractAllUniqueFieldsFromLogs as jest.Mock).mockReturnValue([
				"facts.score",
				customFieldPath
			]);
			mockAttributeRepository.getAttributesByPaths.mockResolvedValue(new Map([["facts.score", "Credit Score"]]));
			mockCaseService.getCustomFieldsSummary.mockRejectedValue(new Error("Service unavailable"));
			mockAuditRepository.getWorkflowsInfoByWorkflowIds.mockResolvedValue(new Map());
			(ExecutionLogEnricher.enrichExecutionLogForCSV as jest.Mock).mockImplementation(log => log);
			(convertToCSV as jest.Mock).mockReturnValue(mockCsv);

			const result = await auditManager.exportExecutionLogs({}, mockUserInfo);

			expect(result).toHaveProperty("csvData", mockCsv);
			expect(mockCaseService.getCustomFieldsSummary).toHaveBeenCalledWith("customer-123");
			expect(ExecutionLogEnricher.enrichExecutionLogForCSV).toHaveBeenCalled();
		});

		it("should prioritize custom field labels over attribute labels when both exist", async () => {
			const mockLogs = [
				{
					case_id: "case-1",
					workflow_version_id: "version-1",
					matched_rule_id: null,
					executed_at: new Date("2024-01-01"),
					input_attr: null,
					evaluation_log: null,
					latency_ms: 10,
					created_at: new Date("2024-01-01"),
					customer_id: "customer-123",
					workflow_id: "workflow-1",
					action_applied: null
				}
			];
			const mockCsv = "case_id,workflow_id\ncase-1,workflow-1";
			const customFieldPath = `${FIELD_PREFIXES.CUSTOM_FIELDS}.currency`;
			const customFieldName = "currency";
			const customFieldLabel = "Currency Type (Custom)";
			const attributeLabel = "Currency (Attribute)";

			mockAuditRepository.exportExecutionLog.mockResolvedValue(mockLogs as ExecutionLogRecord[]);
			(ExecutionLogEnricher.parseEvaluationLog as jest.Mock).mockReturnValue(null);
			(ExecutionLogEnricher.extractAllUniqueFieldsFromLogs as jest.Mock).mockReturnValue([customFieldPath]);
			mockAttributeRepository.getAttributesByPaths.mockResolvedValue(new Map([[customFieldPath, attributeLabel]]));
			mockCaseService.getCustomFieldsSummary.mockResolvedValue([
				{ field: customFieldName, type: "string", label: customFieldLabel }
			]);
			mockAuditRepository.getWorkflowsInfoByWorkflowIds.mockResolvedValue(new Map());
			(ExecutionLogEnricher.enrichExecutionLogForCSV as jest.Mock).mockImplementation((log, labels) => {
				expect(labels.get(customFieldPath)).toBe(customFieldLabel);
				expect(labels.get(customFieldPath)).not.toBe(attributeLabel);
				return log;
			});
			(convertToCSV as jest.Mock).mockReturnValue(mockCsv);

			await auditManager.exportExecutionLogs({}, mockUserInfo);

			expect(ExecutionLogEnricher.enrichExecutionLogForCSV).toHaveBeenCalled();
		});

		it("should return early when no custom field paths are present", async () => {
			const mockLogs = [
				{
					case_id: "case-1",
					workflow_version_id: "version-1",
					matched_rule_id: null,
					executed_at: new Date("2024-01-01"),
					input_attr: null,
					evaluation_log: null,
					latency_ms: 10,
					created_at: new Date("2024-01-01"),
					customer_id: "customer-123",
					workflow_id: "workflow-1",
					action_applied: null
				}
			];
			const mockCsv = "case_id,workflow_id\ncase-1,workflow-1";

			mockAuditRepository.exportExecutionLog.mockResolvedValue(mockLogs as ExecutionLogRecord[]);
			(ExecutionLogEnricher.parseEvaluationLog as jest.Mock).mockReturnValue(null);
			(ExecutionLogEnricher.extractAllUniqueFieldsFromLogs as jest.Mock).mockReturnValue(["facts.score"]);
			mockAttributeRepository.getAttributesByPaths.mockResolvedValue(new Map([["facts.score", "Credit Score"]]));
			mockAuditRepository.getWorkflowsInfoByWorkflowIds.mockResolvedValue(new Map());
			(ExecutionLogEnricher.enrichExecutionLogForCSV as jest.Mock).mockImplementation(log => log);
			(convertToCSV as jest.Mock).mockReturnValue(mockCsv);

			await auditManager.exportExecutionLogs({}, mockUserInfo);

			expect(mockCaseService.getCustomFieldsSummary).not.toHaveBeenCalled();
		});
	});

	describe("exportWorkflowChangesLogs", () => {
		const mockUserInfo = { customer_id: "customer-123" };

		it("should return csvData and filename", async () => {
			const mockLogs = [
				{
					workflow_version_id: "version-1",
					workflow_id: "workflow-1",
					field_path: "rules",
					old_value: "[]",
					new_value: "[{}]",
					change_type: "update",
					note: null,
					changed_by: "user-1",
					created_at: new Date("2024-01-01"),
					customer_id: "customer-123"
				}
			];
			const mockCsv = "workflow_version_id,workflow_id\nversion-1,workflow-1";

			mockAuditRepository.exportWorkflowChangesLog.mockResolvedValue(mockLogs as WorkflowChangeLogRecord[]);
			(convertToCSV as jest.Mock).mockReturnValue(mockCsv);

			const result = await auditManager.exportWorkflowChangesLogs({}, mockUserInfo);

			expect(result).toHaveProperty("csvData", mockCsv);
			expect(result).toHaveProperty("filename");
			expect(result.filename).toContain("workflow_changes_logs_");
			expect(result.filename).toContain(".csv");
		});

		it("should throw error when customer_id is missing", async () => {
			const emptyUserInfo = { customer_id: "" };

			await expect(auditManager.exportWorkflowChangesLogs({}, emptyUserInfo)).rejects.toThrow(ApiError);

			expect(mockAuditRepository.exportWorkflowChangesLog).not.toHaveBeenCalled();
		});

		it("should throw error when customer_id is undefined", async () => {
			const emptyUserInfo = { customer_id: undefined } as unknown as UserInfo;

			await expect(auditManager.exportWorkflowChangesLogs({}, emptyUserInfo)).rejects.toThrow(ApiError);

			expect(mockAuditRepository.exportWorkflowChangesLog).not.toHaveBeenCalled();
		});

		it("should propagate repository errors", async () => {
			const error = new Error("Database error");
			mockAuditRepository.exportWorkflowChangesLog.mockRejectedValue(error);

			await expect(auditManager.exportWorkflowChangesLogs({}, mockUserInfo)).rejects.toThrow("Database error");
		});
	});

	describe("getCaseExecutionDetails", () => {
		const mockExecution: ExecutionWithWorkflowInfo = {
			case_id: "case-123",
			workflow_version_id: "version-123",
			matched_rule_id: "rule-123",
			executed_at: new Date("2024-01-15T10:30:00Z"),
			input_attr: {},
			evaluation_log: {
				workflows_evaluated: [
					{
						workflow_id: "workflow-123",
						trigger_matched: true,
						rules_evaluated: 2
					}
				],
				trigger_evaluations: [],
				rule_evaluations: []
			},
			latency_ms: 100,
			created_at: new Date("2024-01-15T10:30:00Z"),
			customer_id: "customer-123",
			workflow_id: "workflow-123",
			action_applied: {
				type: "SET_FIELD",
				parameters: {
					field: "case.status",
					value: "AUTO_APPROVED"
				}
			},
			workflow_name: "Test Workflow",
			version_number: "1.0"
		};

		const mockEvaluationLog: EvaluationLog = {
			workflows_evaluated: [
				{
					workflow_id: "workflow-123",
					workflow_version_id: "version-123",
					trigger_matched: true,
					rules_evaluated: 2,
					matched_rule_id: "rule-123"
				}
			],
			trigger_evaluations: [],
			rule_evaluations: [
				{
					workflow_id: "workflow-123",
					workflow_version_id: "version-123",
					rule_id: "rule-123",
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
				} as RuleEvaluationLog
			]
		};

		beforeEach(() => {
			// No validator needed, manager receives execution directly
		});

		it("should return execution details for RULE_MATCHED decision type", async () => {
			(ExecutionLogEnricher.parseEvaluationLog as jest.Mock).mockReturnValue(mockEvaluationLog);
			(ExecutionLogEnricher.determineDecisionType as jest.Mock).mockReturnValue(DECISION_TYPES.RULE_MATCHED);
			(ExecutionLogEnricher.extractUniqueFields as jest.Mock).mockReturnValue(["facts.score"]);
			(ExecutionLogEnricher.formatConditionsAsObjects as jest.Mock).mockReturnValue({
				passed: [{ name: "Credit Score", field: "facts.score", description: "Credit Score >= 700, and it was 750 ✓" }],
				failed: []
			});
			(ExecutionLogEnricher.formatRuleOutcome as jest.Mock).mockReturnValue("AUTO APPROVED");
			mockAttributeRepository.getAttributesByPaths.mockResolvedValue(new Map([["facts.score", "Credit Score"]]));
			mockAuditRepository.getWorkflowsInfoByVersionIds.mockResolvedValue(
				new Map([["workflow-123", { name: "Test Workflow", version: "1.0" }]])
			);
			mockAuditRepository.getWorkflowsInfoByWorkflowIds.mockResolvedValue(new Map());

			const result = await auditManager.getCaseExecutionDetails(mockExecution);

			expect(result).toMatchObject({
				workflows_evaluated: [
					{
						workflow_id: "workflow-123",
						name: "Test Workflow",
						version: "1.0",
						matched: true,
						rules: [
							{
								name: "Test Rule",
								matched: true,
								conditions: {
									passed: [{ name: "Credit Score", field: "facts.score", description: expect.any(String) }],
									failed: []
								}
							}
						]
					}
				],
				decision_type: DECISION_TYPES.RULE_MATCHED,
				action_applied: "AUTO APPROVED"
			});
			expect(result.generated_at).toBe(mockExecution.executed_at.toISOString());
		});

		it("should return execution details for DEFAULT_ACTION decision type", async () => {
			const defaultActionExecution = {
				...mockExecution,
				matched_rule_id: null
			};
			const defaultActionEvaluationLog: EvaluationLog = {
				...mockEvaluationLog,
				default_action_applied: true,
				rule_evaluations: []
			};

			(ExecutionLogEnricher.parseEvaluationLog as jest.Mock).mockReturnValue(defaultActionEvaluationLog);
			(ExecutionLogEnricher.determineDecisionType as jest.Mock).mockReturnValue(DECISION_TYPES.DEFAULT_ACTION);
			(ExecutionLogEnricher.formatRuleOutcome as jest.Mock).mockReturnValue("AUTO APPROVED");
			mockAuditRepository.getWorkflowsInfoByVersionIds.mockResolvedValue(
				new Map([["workflow-123", { name: "Test Workflow", version: "1.0" }]])
			);
			mockAuditRepository.getWorkflowsInfoByWorkflowIds.mockResolvedValue(new Map());

			const result = await auditManager.getCaseExecutionDetails(defaultActionExecution);

			expect(result).toMatchObject({
				workflows_evaluated: [
					{
						workflow_id: "workflow-123",
						name: "Test Workflow",
						version: "1.0",
						matched: true,
						rules: []
					}
				],
				decision_type: DECISION_TYPES.DEFAULT_ACTION,
				action_applied: "AUTO APPROVED"
			});
		});

		it("should return execution details for NO_ACTION decision type", async () => {
			const noActionExecution = {
				...mockExecution,
				matched_rule_id: null,
				action_applied: null
			};
			const noActionEvaluationLog: EvaluationLog = {
				...mockEvaluationLog,
				default_action_applied: false,
				rule_evaluations: []
			};

			(ExecutionLogEnricher.parseEvaluationLog as jest.Mock).mockReturnValue(noActionEvaluationLog);
			(ExecutionLogEnricher.determineDecisionType as jest.Mock).mockReturnValue(DECISION_TYPES.NO_ACTION);
			(ExecutionLogEnricher.formatRuleOutcome as jest.Mock).mockReturnValue(null);
			mockAuditRepository.getWorkflowsInfoByVersionIds.mockResolvedValue(
				new Map([["workflow-123", { name: "Test Workflow", version: "1.0" }]])
			);
			mockAuditRepository.getWorkflowsInfoByWorkflowIds.mockResolvedValue(new Map());

			const result = await auditManager.getCaseExecutionDetails(noActionExecution);

			expect(result).toMatchObject({
				workflows_evaluated: [
					{
						workflow_id: "workflow-123",
						name: "Test Workflow",
						version: "1.0",
						matched: true,
						rules: []
					}
				],
				decision_type: DECISION_TYPES.NO_ACTION,
				action_applied: null
			});
		});

		it("should throw error when evaluation log is null", async () => {
			(ExecutionLogEnricher.parseEvaluationLog as jest.Mock).mockReturnValue(null);

			await expect(auditManager.getCaseExecutionDetails(mockExecution)).rejects.toThrow(ApiError);

			try {
				await auditManager.getCaseExecutionDetails(mockExecution);
			} catch (error) {
				expect(error).toBeInstanceOf(ApiError);
				expect((error as ApiError).status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
				expect((error as ApiError).message).toContain("evaluation data");
			}
		});

		it("should throw error when decision type cannot be determined", async () => {
			(ExecutionLogEnricher.parseEvaluationLog as jest.Mock).mockReturnValue(mockEvaluationLog);
			(ExecutionLogEnricher.determineDecisionType as jest.Mock).mockReturnValue(null);

			await expect(auditManager.getCaseExecutionDetails(mockExecution)).rejects.toThrow(ApiError);

			try {
				await auditManager.getCaseExecutionDetails(mockExecution);
			} catch (error) {
				expect(error).toBeInstanceOf(ApiError);
				expect((error as ApiError).status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
				expect((error as ApiError).message).toContain("Unable to determine decision type");
			}
		});

		it("should return execution details for RULE_MATCHED even when no rule evaluations exist", async () => {
			const evaluationLogWithoutRules: EvaluationLog = {
				workflows_evaluated: [
					{
						workflow_id: "workflow-123",
						workflow_version_id: "version-123",
						trigger_matched: true,
						rules_evaluated: 0,
						matched_rule_id: "rule-123"
					}
				],
				trigger_evaluations: [],
				rule_evaluations: []
			};

			(ExecutionLogEnricher.parseEvaluationLog as jest.Mock).mockReturnValue(evaluationLogWithoutRules);
			(ExecutionLogEnricher.determineDecisionType as jest.Mock).mockReturnValue(DECISION_TYPES.RULE_MATCHED);
			(ExecutionLogEnricher.formatRuleOutcome as jest.Mock).mockReturnValue("AUTO APPROVED");
			mockAuditRepository.getWorkflowsInfoByVersionIds.mockResolvedValue(
				new Map([["workflow-123", { name: "Test Workflow", version: "1.0" }]])
			);
			mockAuditRepository.getWorkflowsInfoByWorkflowIds.mockResolvedValue(new Map());
			mockAttributeRepository.getAttributesByPaths.mockResolvedValue(new Map());

			const result = await auditManager.getCaseExecutionDetails(mockExecution);

			expect(result).toMatchObject({
				workflows_evaluated: [
					{
						workflow_id: "workflow-123",
						name: "Test Workflow",
						version: "1.0",
						matched: true,
						rules: []
					}
				],
				decision_type: DECISION_TYPES.RULE_MATCHED,
				action_applied: "AUTO APPROVED"
			});
		});

		it("should handle historical log without workflow_version_id", async () => {
			const historicalEvaluationLog: EvaluationLog = {
				workflows_evaluated: [
					{
						workflow_id: "workflow-456",
						// No workflow_version_id (historical log)
						trigger_matched: true,
						rules_evaluated: 1,
						matched_rule_id: "rule-456"
					}
				],
				trigger_evaluations: [],
				rule_evaluations: [
					{
						workflow_id: "workflow-456",
						// No workflow_version_id
						rule_id: "rule-456",
						rule_name: "Historical Rule",
						matched: true,
						true_conditions: [],
						false_conditions: []
					} as RuleEvaluationLog
				]
			};

			const historicalExecution = {
				...mockExecution,
				workflow_id: "workflow-456",
				workflow_version_id: "version-456"
			};

			(ExecutionLogEnricher.parseEvaluationLog as jest.Mock).mockReturnValue(historicalEvaluationLog);
			(ExecutionLogEnricher.determineDecisionType as jest.Mock).mockReturnValue(DECISION_TYPES.RULE_MATCHED);
			(ExecutionLogEnricher.extractUniqueFields as jest.Mock).mockReturnValue([]);
			(ExecutionLogEnricher.formatConditionsAsObjects as jest.Mock).mockReturnValue({
				passed: [],
				failed: []
			});
			(ExecutionLogEnricher.formatRuleOutcome as jest.Mock).mockReturnValue("AUTO APPROVED");
			mockAuditRepository.getWorkflowsInfoByVersionIds.mockResolvedValue(new Map());
			mockAuditRepository.getWorkflowsInfoByWorkflowIds.mockResolvedValue(
				new Map([["workflow-456", { name: "Historical Workflow", version: "" }]])
			);
			mockAttributeRepository.getAttributesByPaths.mockResolvedValue(new Map());

			const result = await auditManager.getCaseExecutionDetails(historicalExecution);

			expect(result).toMatchObject({
				workflows_evaluated: [
					{
						workflow_id: "workflow-456",
						name: "Historical Workflow",
						version: "",
						matched: true,
						rules: [
							{
								name: "Historical Rule",
								matched: true
							}
						]
					}
				],
				decision_type: DECISION_TYPES.RULE_MATCHED
			});
			expect(mockAuditRepository.getWorkflowsInfoByWorkflowIds).toHaveBeenCalledWith(["workflow-456"]);
		});

		it("should handle mixed workflows with and without workflow_version_id", async () => {
			const mixedEvaluationLog: EvaluationLog = {
				workflows_evaluated: [
					{
						workflow_id: "workflow-123",
						workflow_version_id: "version-123",
						trigger_matched: true,
						rules_evaluated: 1,
						matched_rule_id: "rule-123"
					},
					{
						workflow_id: "workflow-456",
						// No workflow_version_id (historical)
						trigger_matched: false,
						rules_evaluated: 0
					}
				],
				trigger_evaluations: [],
				rule_evaluations: [
					{
						workflow_id: "workflow-123",
						workflow_version_id: "version-123",
						rule_id: "rule-123",
						rule_name: "New Rule",
						matched: true,
						true_conditions: [],
						false_conditions: []
					} as RuleEvaluationLog
				]
			};

			(ExecutionLogEnricher.parseEvaluationLog as jest.Mock).mockReturnValue(mixedEvaluationLog);
			(ExecutionLogEnricher.determineDecisionType as jest.Mock).mockReturnValue(DECISION_TYPES.RULE_MATCHED);
			(ExecutionLogEnricher.extractUniqueFields as jest.Mock).mockReturnValue([]);
			(ExecutionLogEnricher.formatConditionsAsObjects as jest.Mock).mockReturnValue({
				passed: [],
				failed: []
			});
			(ExecutionLogEnricher.formatRuleOutcome as jest.Mock).mockReturnValue("AUTO APPROVED");
			mockAuditRepository.getWorkflowsInfoByVersionIds.mockResolvedValue(
				new Map([["workflow-123", { name: "New Workflow", version: "1.0" }]])
			);
			mockAuditRepository.getWorkflowsInfoByWorkflowIds.mockResolvedValue(
				new Map([["workflow-456", { name: "Historical Workflow", version: "" }]])
			);
			mockAttributeRepository.getAttributesByPaths.mockResolvedValue(new Map());

			const result = await auditManager.getCaseExecutionDetails(mockExecution);

			expect(result.workflows_evaluated).toHaveLength(2);
			expect(result.workflows_evaluated).toMatchObject([
				{
					workflow_id: "workflow-123",
					name: "New Workflow",
					version: "1.0",
					matched: true
				},
				{
					workflow_id: "workflow-456",
					name: "Historical Workflow",
					version: "",
					matched: false
				}
			]);
			expect(mockAuditRepository.getWorkflowsInfoByVersionIds).toHaveBeenCalledWith([
				{ workflow_id: "workflow-123", workflow_version_id: "version-123" }
			]);
			expect(mockAuditRepository.getWorkflowsInfoByWorkflowIds).toHaveBeenCalledWith(["workflow-456"]);
		});

		it("should return Unknown when workflow is not found in database", async () => {
			const evaluationLogWithUnknownWorkflow: EvaluationLog = {
				workflows_evaluated: [
					{
						workflow_id: "workflow-unknown",
						workflow_version_id: "version-unknown",
						trigger_matched: true,
						rules_evaluated: 0
					}
				],
				trigger_evaluations: [],
				rule_evaluations: []
			};

			(ExecutionLogEnricher.parseEvaluationLog as jest.Mock).mockReturnValue(evaluationLogWithUnknownWorkflow);
			(ExecutionLogEnricher.determineDecisionType as jest.Mock).mockReturnValue(DECISION_TYPES.NO_ACTION);
			(ExecutionLogEnricher.formatRuleOutcome as jest.Mock).mockReturnValue(null);
			mockAuditRepository.getWorkflowsInfoByVersionIds.mockResolvedValue(new Map());
			mockAuditRepository.getWorkflowsInfoByWorkflowIds.mockResolvedValue(new Map());
			mockAttributeRepository.getAttributesByPaths.mockResolvedValue(new Map());

			const result = await auditManager.getCaseExecutionDetails(mockExecution);

			expect(result).toMatchObject({
				workflows_evaluated: [
					{
						workflow_id: "workflow-unknown",
						name: "Unknown",
						version: "",
						matched: false,
						rules: []
					}
				],
				decision_type: DECISION_TYPES.NO_ACTION
			});
		});

		it("should handle multiple workflows evaluated", async () => {
			const multipleWorkflowsLog: EvaluationLog = {
				workflows_evaluated: [
					{
						workflow_id: "workflow-1",
						workflow_version_id: "version-1",
						trigger_matched: true,
						rules_evaluated: 1,
						matched_rule_id: "rule-1"
					},
					{
						workflow_id: "workflow-2",
						workflow_version_id: "version-2",
						trigger_matched: true,
						rules_evaluated: 2
					},
					{
						workflow_id: "workflow-3",
						workflow_version_id: "version-3",
						trigger_matched: false,
						rules_evaluated: 0
					}
				],
				trigger_evaluations: [],
				rule_evaluations: [
					{
						workflow_id: "workflow-1",
						workflow_version_id: "version-1",
						rule_id: "rule-1",
						rule_name: "Rule 1",
						matched: true,
						true_conditions: [],
						false_conditions: []
					} as RuleEvaluationLog,
					{
						workflow_id: "workflow-2",
						workflow_version_id: "version-2",
						rule_id: "rule-2a",
						rule_name: "Rule 2A",
						matched: false,
						true_conditions: [],
						false_conditions: []
					} as RuleEvaluationLog,
					{
						workflow_id: "workflow-2",
						workflow_version_id: "version-2",
						rule_id: "rule-2b",
						rule_name: "Rule 2B",
						matched: false,
						true_conditions: [],
						false_conditions: []
					} as RuleEvaluationLog
				]
			};

			const multiWorkflowExecution = {
				...mockExecution,
				workflow_id: "workflow-1"
			};

			(ExecutionLogEnricher.parseEvaluationLog as jest.Mock).mockReturnValue(multipleWorkflowsLog);
			(ExecutionLogEnricher.determineDecisionType as jest.Mock).mockReturnValue(DECISION_TYPES.RULE_MATCHED);
			(ExecutionLogEnricher.extractUniqueFields as jest.Mock).mockReturnValue([]);
			(ExecutionLogEnricher.formatConditionsAsObjects as jest.Mock).mockReturnValue({
				passed: [],
				failed: []
			});
			(ExecutionLogEnricher.formatRuleOutcome as jest.Mock).mockReturnValue("AUTO APPROVED");
			mockAuditRepository.getWorkflowsInfoByVersionIds.mockResolvedValue(
				new Map([
					["workflow-1", { name: "Workflow 1", version: "1.0" }],
					["workflow-2", { name: "Workflow 2", version: "2.0" }],
					["workflow-3", { name: "Workflow 3", version: "3.0" }]
				])
			);
			mockAuditRepository.getWorkflowsInfoByWorkflowIds.mockResolvedValue(new Map());
			mockAttributeRepository.getAttributesByPaths.mockResolvedValue(new Map());

			const result = await auditManager.getCaseExecutionDetails(multiWorkflowExecution);

			expect(result.workflows_evaluated).toHaveLength(3);
			expect(result.workflows_evaluated[0]).toMatchObject({
				workflow_id: "workflow-1",
				name: "Workflow 1",
				version: "1.0",
				matched: true,
				rules: [{ name: "Rule 1", matched: true }]
			});
			expect(result.workflows_evaluated[1]).toMatchObject({
				workflow_id: "workflow-2",
				name: "Workflow 2",
				version: "2.0",
				matched: false,
				rules: [
					{ name: "Rule 2A", matched: false },
					{ name: "Rule 2B", matched: false }
				]
			});
			expect(result.workflows_evaluated[2]).toMatchObject({
				workflow_id: "workflow-3",
				name: "Workflow 3",
				version: "3.0",
				matched: false,
				rules: []
			});
		});

		it("should prioritize workflowsInfoByVersion over workflowsInfoByWorkflowId when both exist", async () => {
			const evaluationLog: EvaluationLog = {
				workflows_evaluated: [
					{
						workflow_id: "workflow-123",
						workflow_version_id: "version-123",
						trigger_matched: true,
						rules_evaluated: 1,
						matched_rule_id: "rule-123"
					}
				],
				trigger_evaluations: [],
				rule_evaluations: []
			};

			(ExecutionLogEnricher.parseEvaluationLog as jest.Mock).mockReturnValue(evaluationLog);
			(ExecutionLogEnricher.determineDecisionType as jest.Mock).mockReturnValue(DECISION_TYPES.RULE_MATCHED);
			(ExecutionLogEnricher.formatRuleOutcome as jest.Mock).mockReturnValue("AUTO APPROVED");
			// Both methods return the same workflow_id but with different info
			mockAuditRepository.getWorkflowsInfoByVersionIds.mockResolvedValue(
				new Map([["workflow-123", { name: "Correct Workflow Name", version: "1.0" }]])
			);
			mockAuditRepository.getWorkflowsInfoByWorkflowIds.mockResolvedValue(
				new Map([["workflow-123", { name: "Wrong Workflow Name", version: "" }]])
			);
			mockAttributeRepository.getAttributesByPaths.mockResolvedValue(new Map());

			const result = await auditManager.getCaseExecutionDetails(mockExecution);

			expect(result.workflows_evaluated[0]).toMatchObject({
				workflow_id: "workflow-123",
				name: "Correct Workflow Name",
				version: "1.0"
			});
			// Verify that getWorkflowsInfoByWorkflowIds was called but its result was filtered out
			expect(mockAuditRepository.getWorkflowsInfoByWorkflowIds).toHaveBeenCalled();
		});

		it("should handle workflow with multiple rules", async () => {
			const multipleRulesLog: EvaluationLog = {
				workflows_evaluated: [
					{
						workflow_id: "workflow-123",
						workflow_version_id: "version-123",
						trigger_matched: true,
						rules_evaluated: 3,
						matched_rule_id: "rule-2"
					}
				],
				trigger_evaluations: [],
				rule_evaluations: [
					{
						workflow_id: "workflow-123",
						workflow_version_id: "version-123",
						rule_id: "rule-1",
						rule_name: "First Rule",
						matched: false,
						true_conditions: [],
						false_conditions: [
							{
								field: "facts.score",
								operator: ">=",
								expected_value: 800,
								actual_value: 750,
								result: false
							}
						]
					} as RuleEvaluationLog,
					{
						workflow_id: "workflow-123",
						workflow_version_id: "version-123",
						rule_id: "rule-2",
						rule_name: "Second Rule",
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
					} as RuleEvaluationLog,
					{
						workflow_id: "workflow-123",
						workflow_version_id: "version-123",
						rule_id: "rule-3",
						rule_name: "Third Rule",
						matched: false,
						true_conditions: [],
						false_conditions: []
					} as RuleEvaluationLog
				]
			};

			(ExecutionLogEnricher.parseEvaluationLog as jest.Mock).mockReturnValue(multipleRulesLog);
			(ExecutionLogEnricher.determineDecisionType as jest.Mock).mockReturnValue(DECISION_TYPES.RULE_MATCHED);
			(ExecutionLogEnricher.extractUniqueFields as jest.Mock).mockReturnValue(["facts.score"]);
			(ExecutionLogEnricher.formatConditionsAsObjects as jest.Mock).mockImplementation(
				(trueConditions: unknown, falseConditions: unknown) => ({
					passed: trueConditions ?? [],
					failed: falseConditions ?? []
				})
			);
			(ExecutionLogEnricher.formatRuleOutcome as jest.Mock).mockReturnValue("AUTO APPROVED");
			mockAuditRepository.getWorkflowsInfoByVersionIds.mockResolvedValue(
				new Map([["workflow-123", { name: "Test Workflow", version: "1.0" }]])
			);
			mockAuditRepository.getWorkflowsInfoByWorkflowIds.mockResolvedValue(new Map());
			mockAttributeRepository.getAttributesByPaths.mockResolvedValue(new Map([["facts.score", "Credit Score"]]));

			const result = await auditManager.getCaseExecutionDetails(mockExecution);

			expect(result.workflows_evaluated[0].rules).toHaveLength(3);
			expect(result.workflows_evaluated[0].rules[0]).toMatchObject({
				name: "First Rule",
				matched: false
			});
			expect(result.workflows_evaluated[0].rules[1]).toMatchObject({
				name: "Second Rule",
				matched: true
			});
			expect(result.workflows_evaluated[0].rules[2]).toMatchObject({
				name: "Third Rule",
				matched: false
			});
		});

		it("should return empty workflows_evaluated array when no workflows were evaluated", async () => {
			const emptyEvaluationLog: EvaluationLog = {
				workflows_evaluated: [],
				trigger_evaluations: [],
				rule_evaluations: []
			};

			(ExecutionLogEnricher.parseEvaluationLog as jest.Mock).mockReturnValue(emptyEvaluationLog);
			(ExecutionLogEnricher.determineDecisionType as jest.Mock).mockReturnValue(DECISION_TYPES.NO_ACTION);
			(ExecutionLogEnricher.formatRuleOutcome as jest.Mock).mockReturnValue(null);

			const result = await auditManager.getCaseExecutionDetails(mockExecution);

			expect(result.workflows_evaluated).toEqual([]);
			expect(result.decision_type).toBe(DECISION_TYPES.NO_ACTION);
			expect(result.action_applied).toBeNull();
			// Should not call repository methods when there are no workflows
			expect(mockAuditRepository.getWorkflowsInfoByVersionIds).not.toHaveBeenCalled();
			expect(mockAuditRepository.getWorkflowsInfoByWorkflowIds).not.toHaveBeenCalled();
		});

		it("should use custom field labels when custom fields are present in rule conditions", async () => {
			const customFieldPath = `${FIELD_PREFIXES.CUSTOM_FIELDS}.currency`;
			const customFieldName = "currency";
			const customFieldLabel = "Currency Type";
			const evaluationLogWithCustomFields: EvaluationLog = {
				...mockEvaluationLog,
				rule_evaluations: [
					{
						workflow_id: "workflow-123",
						workflow_version_id: "version-123",
						rule_id: "rule-123",
						rule_name: "Test Rule",
						matched: true,
						true_conditions: [
							{
								field: customFieldPath,
								operator: "==",
								expected_value: "USD",
								actual_value: "USD",
								result: true
							}
						],
						false_conditions: []
					} as RuleEvaluationLog
				]
			};

			(ExecutionLogEnricher.parseEvaluationLog as jest.Mock).mockReturnValue(evaluationLogWithCustomFields);
			(ExecutionLogEnricher.determineDecisionType as jest.Mock).mockReturnValue(DECISION_TYPES.RULE_MATCHED);
			(ExecutionLogEnricher.extractUniqueFields as jest.Mock).mockReturnValue([customFieldPath]);
			(ExecutionLogEnricher.formatConditionsAsObjects as jest.Mock).mockImplementation(
				(trueConditions, falseConditions, labels) => {
					expect(labels.has(customFieldPath)).toBe(true);
					expect(labels.get(customFieldPath)).toBe(customFieldLabel);
					return {
						passed: trueConditions ?? [],
						failed: falseConditions ?? []
					};
				}
			);
			(ExecutionLogEnricher.formatRuleOutcome as jest.Mock).mockReturnValue("AUTO APPROVED");
			mockAttributeRepository.getAttributesByPaths.mockResolvedValue(new Map());
			mockCaseService.getCustomFieldsSummary.mockResolvedValue([
				{ field: customFieldName, type: "string", label: customFieldLabel }
			]);
			mockAuditRepository.getWorkflowsInfoByVersionIds.mockResolvedValue(
				new Map([["workflow-123", { name: "Test Workflow", version: "1.0" }]])
			);
			mockAuditRepository.getWorkflowsInfoByWorkflowIds.mockResolvedValue(new Map());

			await auditManager.getCaseExecutionDetails(mockExecution);

			expect(mockCaseService.getCustomFieldsSummary).toHaveBeenCalledWith("customer-123");
			expect(ExecutionLogEnricher.formatConditionsAsObjects).toHaveBeenCalledWith(
				expect.anything(),
				expect.anything(),
				expect.objectContaining({
					get: expect.any(Function),
					has: expect.any(Function)
				})
			);
		});

		it("should handle CaseService errors gracefully in getCaseExecutionDetails", async () => {
			const customFieldPath = `${FIELD_PREFIXES.CUSTOM_FIELDS}.currency`;
			const evaluationLogWithCustomFields: EvaluationLog = {
				...mockEvaluationLog,
				rule_evaluations: [
					{
						workflow_id: "workflow-123",
						workflow_version_id: "version-123",
						rule_id: "rule-123",
						rule_name: "Test Rule",
						matched: true,
						true_conditions: [
							{
								field: customFieldPath,
								operator: "==",
								expected_value: "USD",
								actual_value: "USD",
								result: true
							}
						],
						false_conditions: []
					} as RuleEvaluationLog
				]
			};

			(ExecutionLogEnricher.parseEvaluationLog as jest.Mock).mockReturnValue(evaluationLogWithCustomFields);
			(ExecutionLogEnricher.determineDecisionType as jest.Mock).mockReturnValue(DECISION_TYPES.RULE_MATCHED);
			(ExecutionLogEnricher.extractUniqueFields as jest.Mock).mockReturnValue([customFieldPath]);
			(ExecutionLogEnricher.formatConditionsAsObjects as jest.Mock).mockReturnValue({
				passed: [],
				failed: []
			});
			(ExecutionLogEnricher.formatRuleOutcome as jest.Mock).mockReturnValue("AUTO APPROVED");
			mockAttributeRepository.getAttributesByPaths.mockResolvedValue(new Map());
			mockCaseService.getCustomFieldsSummary.mockRejectedValue(new Error("Service unavailable"));
			mockAuditRepository.getWorkflowsInfoByVersionIds.mockResolvedValue(
				new Map([["workflow-123", { name: "Test Workflow", version: "1.0" }]])
			);
			mockAuditRepository.getWorkflowsInfoByWorkflowIds.mockResolvedValue(new Map());

			const result = await auditManager.getCaseExecutionDetails(mockExecution);

			expect(result).toHaveProperty("workflows_evaluated");
			expect(mockCaseService.getCustomFieldsSummary).toHaveBeenCalledWith("customer-123");
			expect(ExecutionLogEnricher.formatConditionsAsObjects).toHaveBeenCalled();
		});

		it("should prioritize custom field labels over attribute labels in getCaseExecutionDetails", async () => {
			const customFieldPath = `${FIELD_PREFIXES.CUSTOM_FIELDS}.currency`;
			const customFieldName = "currency";
			const customFieldLabel = "Currency Type (Custom)";
			const attributeLabel = "Currency (Attribute)";
			const evaluationLogWithCustomFields: EvaluationLog = {
				...mockEvaluationLog,
				rule_evaluations: [
					{
						workflow_id: "workflow-123",
						workflow_version_id: "version-123",
						rule_id: "rule-123",
						rule_name: "Test Rule",
						matched: true,
						true_conditions: [
							{
								field: customFieldPath,
								operator: "==",
								expected_value: "USD",
								actual_value: "USD",
								result: true
							}
						],
						false_conditions: []
					} as RuleEvaluationLog
				]
			};

			(ExecutionLogEnricher.parseEvaluationLog as jest.Mock).mockReturnValue(evaluationLogWithCustomFields);
			(ExecutionLogEnricher.determineDecisionType as jest.Mock).mockReturnValue(DECISION_TYPES.RULE_MATCHED);
			(ExecutionLogEnricher.extractUniqueFields as jest.Mock).mockReturnValue([customFieldPath]);
			(ExecutionLogEnricher.formatConditionsAsObjects as jest.Mock).mockImplementation(
				(trueConditions, falseConditions, labels) => {
					expect(labels.get(customFieldPath)).toBe(customFieldLabel);
					expect(labels.get(customFieldPath)).not.toBe(attributeLabel);
					return {
						passed: trueConditions ?? [],
						failed: falseConditions ?? []
					};
				}
			);
			(ExecutionLogEnricher.formatRuleOutcome as jest.Mock).mockReturnValue("AUTO APPROVED");
			mockAttributeRepository.getAttributesByPaths.mockResolvedValue(new Map([[customFieldPath, attributeLabel]]));
			mockCaseService.getCustomFieldsSummary.mockResolvedValue([
				{ field: customFieldName, type: "string", label: customFieldLabel }
			]);
			mockAuditRepository.getWorkflowsInfoByVersionIds.mockResolvedValue(
				new Map([["workflow-123", { name: "Test Workflow", version: "1.0" }]])
			);
			mockAuditRepository.getWorkflowsInfoByWorkflowIds.mockResolvedValue(new Map());

			await auditManager.getCaseExecutionDetails(mockExecution);

			expect(ExecutionLogEnricher.formatConditionsAsObjects).toHaveBeenCalled();
		});
	});
});
