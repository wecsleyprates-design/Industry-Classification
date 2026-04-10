import { logger } from "#helpers/logger";
import { AuditRepository } from "./auditRepository";
import { AttributeRepository } from "#core/attributes/attributeRepository";
import { CaseService } from "#services/case/caseService";
import { convertToCSV } from "#utils/csvConverter";
import { ApiError } from "#types/common";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES, type DecisionType, FIELD_PREFIXES } from "#constants";
import { extractFieldName, hasFieldPrefix } from "#utils/fieldUtils";
import { CsvExportResult } from "./types";
import { exportConfig } from "#configs/export-csv.config";
import { ExecutionLogEnricher } from "./executionLogEnricher";
import { GetCaseExecutionDetailsResponse } from "#types/workflow-dtos";
import type { EvaluationLog } from "#core/evaluators/types";
import type { RuleEvaluationLog } from "#core/rule/types";
import type { ExecutionWithWorkflowInfo, WorkflowInfo, WorkflowVersionIdPair } from "./types";

/**
 * Manager responsible for audit-related business logic orchestration
 * Handles CSV export operations and data transformation
 */
export class AuditManager {
	private auditRepository: AuditRepository;
	private attributeRepository: AttributeRepository;
	private caseService: CaseService;

	constructor(auditRepository?: AuditRepository, attributeRepository?: AttributeRepository, caseService?: CaseService) {
		this.auditRepository = auditRepository ?? new AuditRepository();
		this.attributeRepository = attributeRepository ?? new AttributeRepository();
		this.caseService = caseService ?? new CaseService();
	}

	/**
	 * Generates a filename with timestamp for CSV exports
	 * @param baseName - Base name for the file (e.g., "execution_logs")
	 * @returns Formatted filename with timestamp in ISO format (e.g., "execution_logs_2024-10-27T17-30-45.csv")
	 */
	private getFileName = (baseName: string): string => {
		const now = new Date();
		const timestamp = now.toISOString().replace(/:/g, "-").split(".")[0];
		return `${baseName}_${timestamp}.csv`;
	};

	/**
	 * Exports execution logs as CSV
	 * @param params - Export parameters including customer ID and optional filters
	 * @param userInfo - User information for validation
	 * @returns CSV export result with data and filename
	 */
	async exportExecutionLogs(
		params: {
			workflowId?: string;
			startDate?: string;
			endDate?: string;
		},
		userInfo: { customer_id: string }
	): Promise<CsvExportResult> {
		logger.info("AuditManager: Exporting execution logs", { customerId: userInfo.customer_id, filters: params });

		try {
			if (!userInfo.customer_id) {
				throw new ApiError("Customer ID is required", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}

			const logs = await this.auditRepository.exportExecutionLog({
				customerId: userInfo.customer_id,
				workflowId: params.workflowId,
				startDate: params.startDate,
				endDate: params.endDate
			});

			const allFields = ExecutionLogEnricher.extractAllUniqueFieldsFromLogs(logs);
			logger.debug(`AuditManager: Extracted ${allFields.length} unique fields for label lookup`);

			const attributeLabels = await this.attributeRepository.getAttributesByPaths(allFields);
			logger.debug(`AuditManager: Retrieved ${attributeLabels.size} attribute labels`);

			const customFieldLabels = await this.getCustomFieldLabels(userInfo.customer_id, allFields);

			const combinedLabels = this.combineLabels(attributeLabels, customFieldLabels);

			const evaluationLogs = logs
				.map(log => ExecutionLogEnricher.parseEvaluationLog(log))
				.filter((log): log is EvaluationLog => log !== null && log !== undefined);

			const workflowIds = new Set(
				evaluationLogs
					.flatMap(evaluationLog => evaluationLog.rule_evaluations ?? [])
					.map(ruleEval => ruleEval.workflow_id)
			);

			const workflowNames =
				workflowIds.size > 0
					? await this.auditRepository.getWorkflowsInfoByWorkflowIds(Array.from(workflowIds))
					: new Map<string, { name: string; version: string }>();
			logger.debug(`AuditManager: Retrieved ${workflowNames.size} workflow names`);

			const enrichedLogs = logs.map(log =>
				ExecutionLogEnricher.enrichExecutionLogForCSV(log, combinedLabels, workflowNames)
			);

			const csvData = convertToCSV(enrichedLogs);
			const filename = this.getFileName(exportConfig.filenames.executionLogs);

			logger.info(`AuditManager: Exported ${logs.length} execution logs to CSV`);

			return { csvData, filename };
		} catch (error) {
			logger.error({ error }, "AuditManager: Failed to export execution logs");
			throw error;
		}
	}

	/**
	 * Exports workflow changes logs as CSV
	 * @param params - Export parameters including customer ID and optional filters
	 * @param userInfo - User information for validation
	 * @returns CSV export result with data and filename
	 */
	async exportWorkflowChangesLogs(
		params: {
			workflowId?: string;
			startDate?: string;
			endDate?: string;
		},
		userInfo: { customer_id: string }
	): Promise<CsvExportResult> {
		logger.info("AuditManager: Exporting workflow changes logs", { customerId: userInfo.customer_id, filters: params });

		try {
			if (!userInfo.customer_id) {
				throw new ApiError("Customer ID is required", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}

			const logs = await this.auditRepository.exportWorkflowChangesLog({
				customerId: userInfo.customer_id,
				workflowId: params.workflowId,
				startDate: params.startDate,
				endDate: params.endDate
			});

			const csvData = convertToCSV(logs);
			const filename = this.getFileName(exportConfig.filenames.workflowChangesLogs);

			logger.info(`AuditManager: Exported ${logs.length} workflow changes logs to CSV`);

			return { csvData, filename };
		} catch (error) {
			logger.error({ error }, "AuditManager: Failed to export workflow changes logs");
			throw error;
		}
	}

	/**
	 * Gets the latest workflow execution details for a given execution
	 * @param execution - Execution record with workflow info (already validated)
	 * @returns Promise with workflow execution details including all workflows and rules evaluated
	 */
	async getCaseExecutionDetails(execution: ExecutionWithWorkflowInfo): Promise<GetCaseExecutionDetailsResponse> {
		const evaluationLog = ExecutionLogEnricher.parseEvaluationLog(execution);
		if (!evaluationLog) {
			throw new ApiError(
				"Execution log does not contain evaluation data",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}

		const decisionType = ExecutionLogEnricher.determineDecisionType(execution.matched_rule_id, evaluationLog);
		if (!decisionType) {
			throw new ApiError(
				"Unable to determine decision type from execution log",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}

		return await this.buildWorkflowsEvaluatedResponse(execution, decisionType, evaluationLog);
	}

	/**
	 * Builds the complete response with all workflows evaluated
	 * @param execution - Execution record with workflow info
	 * @param decisionType - Determined decision type
	 * @param evaluationLog - Parsed evaluation log
	 * @returns Response with all workflows and rules evaluated
	 */
	private async buildWorkflowsEvaluatedResponse(
		execution: ExecutionWithWorkflowInfo,
		decisionType: DecisionType,
		evaluationLog: EvaluationLog
	): Promise<GetCaseExecutionDetailsResponse> {
		if (!evaluationLog.workflows_evaluated?.length) {
			return {
				workflows_evaluated: [],
				decision_type: decisionType,
				action_applied: ExecutionLogEnricher.formatRuleOutcome(execution.action_applied),
				generated_at: execution.executed_at.toISOString()
			} as GetCaseExecutionDetailsResponse;
		}

		const { withVersion, withoutVersion } = evaluationLog.workflows_evaluated.reduce(
			(acc, wf) => {
				if (typeof wf.workflow_version_id === "string") {
					acc.withVersion.push({
						workflow_id: wf.workflow_id,
						workflow_version_id: wf.workflow_version_id
					});
				} else if (wf.workflow_id) {
					acc.withoutVersion.push(wf.workflow_id);
				}
				return acc;
			},
			{ withVersion: [] as WorkflowVersionIdPair[], withoutVersion: [] as string[] }
		);

		const [workflowsInfoByVersion, workflowsInfoByWorkflowId] = await Promise.all([
			this.auditRepository.getWorkflowsInfoByVersionIds(withVersion),
			this.auditRepository.getWorkflowsInfoByWorkflowIds(withoutVersion)
		]);

		const workflowsInfo = new Map<string, WorkflowInfo>(workflowsInfoByVersion);
		for (const [workflowId, workflowInfo] of workflowsInfoByWorkflowId) {
			if (!workflowsInfo.has(workflowId)) {
				workflowsInfo.set(workflowId, workflowInfo);
			}
		}

		const ruleEvaluations = evaluationLog.rule_evaluations ?? [];
		const { rulesByWorkflow, uniqueFields } = this.groupRulesAndExtractFields(ruleEvaluations);
		const attributeLabels = await this.attributeRepository.getAttributesByPaths(uniqueFields);
		const customFieldLabels = await this.getCustomFieldLabels(execution.customer_id, uniqueFields);

		const combinedLabels = this.combineLabels(attributeLabels, customFieldLabels);

		const workflowsEvaluated = evaluationLog.workflows_evaluated.map(wfEval => {
			const workflowInfo = workflowsInfo.get(wfEval.workflow_id);
			const rules = rulesByWorkflow.get(wfEval.workflow_id) ?? [];

			const matched = execution.workflow_id === wfEval.workflow_id;

			return {
				workflow_id: wfEval.workflow_id,
				name: workflowInfo?.name ?? "Unknown",
				version: workflowInfo?.version ?? "",
				matched,
				rules: this.mapRulesToResponse(rules, combinedLabels)
			};
		});

		return {
			workflows_evaluated: workflowsEvaluated,
			decision_type: decisionType,
			action_applied: ExecutionLogEnricher.formatRuleOutcome(execution.action_applied),
			generated_at: execution.executed_at.toISOString()
		} as GetCaseExecutionDetailsResponse;
	}

	/**
	 * Groups rule evaluations by workflow_id
	 * @param ruleEvaluations - Array of rule evaluation logs
	 * @returns Object containing rules grouped by workflow and field paths
	 */
	private groupRulesAndExtractFields(ruleEvaluations: RuleEvaluationLog[]): {
		rulesByWorkflow: Map<string, RuleEvaluationLog[]>;
		uniqueFields: string[];
	} {
		const rulesByWorkflow = new Map<string, RuleEvaluationLog[]>();

		for (const ruleEval of ruleEvaluations) {
			const existingRules = rulesByWorkflow.get(ruleEval.workflow_id) ?? [];
			existingRules.push(ruleEval);
			rulesByWorkflow.set(ruleEval.workflow_id, existingRules);
		}

		const uniqueFields = Array.from(
			new Set(
				ruleEvaluations.flatMap(ruleEval =>
					[...(ruleEval.true_conditions ?? []), ...(ruleEval.false_conditions ?? [])].map(condition => condition.field)
				)
			)
		);

		return {
			rulesByWorkflow,
			uniqueFields
		};
	}

	/**
	 * Combines attribute labels and custom field labels, with custom field labels taking precedence
	 * @param attributeLabels - Map of attribute field paths to labels
	 * @param customFieldLabels - Map of custom field paths to labels
	 * @returns Combined Map with custom field labels taking precedence
	 */
	private combineLabels(
		attributeLabels: Map<string, string>,
		customFieldLabels: Map<string, string>
	): Map<string, string> {
		const combined = new Map<string, string>(attributeLabels);
		for (const [field, label] of customFieldLabels) {
			combined.set(field, label);
		}
		return combined;
	}

	/**
	 * Gets custom field labels for fields that start with the custom fields prefix
	 * @param customerId - Customer ID to fetch custom fields for
	 * @param fields - Array of field paths to check
	 * @returns Map of custom field paths to their labels
	 */
	private async getCustomFieldLabels(customerId: string, fields: string[]): Promise<Map<string, string>> {
		const customFieldLabels = new Map<string, string>();

		const customFieldPaths = fields.filter(field => hasFieldPrefix(field, FIELD_PREFIXES.CUSTOM_FIELDS));

		if (customFieldPaths.length === 0) {
			return customFieldLabels;
		}

		try {
			const customFields = await this.caseService.getCustomFieldsSummary(customerId);

			const fieldNameToLabel = new Map<string, string>();
			for (const customField of customFields) {
				if (customField.field) {
					fieldNameToLabel.set(customField.field, customField.label);
				}
			}

			for (const fieldPath of customFieldPaths) {
				const fieldName = extractFieldName(fieldPath, FIELD_PREFIXES.CUSTOM_FIELDS);
				const label = fieldNameToLabel.get(fieldName);

				if (label) {
					customFieldLabels.set(fieldPath, label);
				}
			}

			logger.debug(`Retrieved ${customFieldLabels.size} custom field labels for customer ${customerId}`);
		} catch (error) {
			logger.warn(`Failed to fetch custom fields for customer ${customerId}, continuing without custom field labels`, {
				error: error instanceof Error ? error.message : String(error)
			});
		}

		return customFieldLabels;
	}

	/**
	 * Maps rule evaluations to response format with formatted conditions
	 * @param rules - Array of rule evaluation logs
	 * @param attributeLabels - Map of field paths to their human-readable labels
	 * @returns Array of rule response objects
	 */
	private mapRulesToResponse(
		rules: RuleEvaluationLog[],
		attributeLabels: Map<string, string>
	): Array<{ name: string; matched: boolean; conditions?: { passed: unknown[]; failed: unknown[] } }> {
		return rules.map(rule => {
			const conditions =
				rule.true_conditions || rule.false_conditions
					? ExecutionLogEnricher.formatConditionsAsObjects(rule.true_conditions, rule.false_conditions, attributeLabels)
					: undefined;

			return {
				name: rule.rule_name,
				matched: rule.matched,
				conditions: conditions
					? {
							failed: conditions.failed,
							passed: conditions.passed
						}
					: undefined
			};
		});
	}
}
