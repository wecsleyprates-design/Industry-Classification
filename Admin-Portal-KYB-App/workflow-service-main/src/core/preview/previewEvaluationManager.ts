import { logger } from "#helpers/logger";
import { caseService } from "#services/case";
import { warehouseService } from "#services/warehouse";
import { PreviewEvaluationRequestValidator } from "#core/validators";
import { RuleEvaluator, TriggerEvaluator } from "#core/evaluators";
import { WorkflowRepository } from "#core/workflow";
import { VersionRepository } from "#core/versioning";
import { FactsManager } from "../facts";
import { transformCustomFields } from "#helpers/customFields";
import { normalizeFacts } from "#helpers/dates";
import { FIELD_PREFIXES } from "#constants";
import type {
	PreviewEvaluationRequest,
	PreviewEvaluationResponse,
	PreviewEvaluationResult,
	PreviewEvaluationLog,
	WorkflowActionRequest,
	PreviewBusinessResult
} from "#types/workflow-dtos";
import type { CaseData } from "#core/types";
import type { Workflow } from "#core/workflow/types";
import type { WorkflowAction } from "#core/actions/types";
import type { WorkflowExecutionResult } from "#core/evaluators/types";
import { UserInfo } from "#types/common";
import { v4 as uuidv4 } from "uuid";

export class PreviewEvaluationManager {
	private previewValidator: PreviewEvaluationRequestValidator;
	private workflowRepository: WorkflowRepository;
	private versionRepository: VersionRepository;
	private factsManager: FactsManager;

	/**
	 * Prepares the complete input payload for storage (case, facts, custom_fields)
	 * @param caseData - The case data with potential custom_fields
	 * @param facts - Optional facts data from warehouse service
	 * @returns Complete payload object with case, facts, and custom_fields
	 */
	private prepareInputAttributes(caseData: CaseData, facts?: Record<string, unknown>): Record<string, unknown> {
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

	constructor(
		workflowRepository: WorkflowRepository,
		versionRepository: VersionRepository,
		factsManager: FactsManager,
		previewValidator?: PreviewEvaluationRequestValidator
	) {
		this.workflowRepository = workflowRepository;
		this.versionRepository = versionRepository;
		this.factsManager = factsManager;
		this.previewValidator = previewValidator ?? new PreviewEvaluationRequestValidator();
	}

	async previewEvaluation(
		workflowId: string,
		request: PreviewEvaluationRequest,
		userInfo: UserInfo
	): Promise<PreviewEvaluationResponse> {
		const startTime = Date.now();
		const { user_id: userId, customer_id: customerId } = userInfo;

		logger.info(
			`PreviewEvaluationManager: Starting preview evaluation: workflow_id=${workflowId}, user=${userId}, customer=${customerId}`
		);

		try {
			// Use validator to handle all business logic validation
			const validatedData = await this.previewValidator.validate(workflowId, request, userInfo);
			const { workflow } = validatedData;

			// Load version data once; we will use its trigger conditions and rules downstream
			const versionAndRules = await this.versionRepository.getWorkflowVersionAndRules(workflowId);
			const triggerConditions = versionAndRules?.trigger_conditions ?? null;
			if (triggerConditions) {
				logger.debug(`Loaded trigger conditions from Version for workflow ${workflowId}`);
			}

			const evaluationId = uuidv4();

			let result: PreviewEvaluationResponse;
			if (request.case_id) {
				result = await this.evaluateByCaseId(evaluationId, workflow, request, startTime);
			} else {
				// Check if it's an array (multiple businesses) or a single string
				const businessIds = Array.isArray(request.business_id) ? request.business_id : [request.business_id as string];

				if (businessIds.length === 1) {
					// Single business - use existing logic for backward compatibility
					result = await this.evaluateByBusinessId(
						evaluationId,
						workflow,
						{ ...request, business_id: businessIds[0] },
						startTime
					);
				} else {
					// Multiple businesses - evaluate each and return aggregated results
					result = await this.evaluateByMultipleBusinessIds(
						evaluationId,
						workflow,
						businessIds,
						request.sample_size ?? 10,
						startTime
					);
				}
			}

			// Log successful evaluation
			logger.info(
				`PreviewEvaluationManager: Preview evaluation completed: evaluation_id=${evaluationId}, workflow_id=${workflowId}, user=${userId}`
			);

			return result;
		} catch (error) {
			logger.error(
				`PreviewEvaluationManager: Preview evaluation failed: workflow_id=${workflowId}, user=${userId}:`,
				error
			);
			throw error;
		}
	}

	/**
	 * Evaluates workflow for a specific case
	 */
	private async evaluateByCaseId(
		evaluationId: string,
		workflow: Workflow,
		request: PreviewEvaluationRequest,
		startTime: number
	): Promise<PreviewEvaluationResponse> {
		const caseId = request.case_id as string; // Safe because we checked in calling method
		logger.debug(`Evaluating case ${caseId} for workflow ${workflow.id}`);

		// Get case data
		const caseData = await caseService.getCaseById(caseId);

		// Perform workflow evaluation (without executing actions)
		const evaluationResult = await this.performWorkflowEvaluation(workflow, caseData, startTime);

		return {
			evaluation_id: evaluationId,
			case_id: caseId,
			business_id: caseData.business_id,
			evaluation_result: evaluationResult
		};
	}

	/**
	 * Evaluates workflow for a business with sampling
	 */
	private async evaluateByBusinessId(
		evaluationId: string,
		workflow: Workflow,
		request: PreviewEvaluationRequest,
		startTime: number
	): Promise<PreviewEvaluationResponse> {
		const businessId = request.business_id as string; // Safe because we checked in calling method
		const sampleSize = request.sample_size ?? 10;

		logger.debug(`Evaluating business ${businessId} for workflow ${workflow.id} with sample size ${sampleSize}`);

		// Fetch real cases from the Case Service for this business
		const cases = await this.fetchCasesForBusiness(businessId, sampleSize);
		if (cases.length === 0) {
			logger.warn(`No cases found for business ${businessId}`);
			// Return empty result with no sampled cases
			return {
				evaluation_id: evaluationId,
				business_id: businessId,
				evaluation_result: {
					workflow_id: workflow.id,
					workflow_name: workflow.name,
					trigger_matched: false,
					applied_action: [],
					default_applied: true,
					evaluation_log: {
						trigger_evaluations: [],
						rule_evaluations: [],
						workflows_evaluated: []
					},
					latency_ms: Date.now() - startTime,
					evaluated_at: new Date().toISOString()
				},
				sampled_cases: []
			};
		}

		// Filter valid cases
		const validCases = cases.filter(caseData => caseData?.id);

		if (validCases.length === 0) {
			logger.warn(`No valid cases found for business ${businessId}`);
			return {
				evaluation_id: evaluationId,
				business_id: businessId,
				evaluation_result: {
					workflow_id: workflow.id,
					workflow_name: workflow.name,
					trigger_matched: false,
					applied_action: [],
					default_applied: true,
					evaluation_log: {
						trigger_evaluations: [],
						rule_evaluations: [],
						workflows_evaluated: []
					},
					latency_ms: Date.now() - startTime,
					evaluated_at: new Date().toISOString()
				},
				sampled_cases: []
			};
		}

		// Evaluate all cases for business_id preview
		// For business_id evaluations, we evaluate all sampled cases
		// The evaluation_result shows the aggregate/example result (first case)
		// while sampled_cases contains individual results for each case
		const sampledCases = await Promise.all(
			validCases.map(async caseData => {
				const caseStartTime = Date.now();
				const caseResult = await this.performWorkflowEvaluation(workflow, caseData, caseStartTime);
				return {
					case_id: caseData.id,
					business_id: businessId,
					result: caseResult
				};
			})
		);

		// For business_id evaluation, the evaluation_result is an EXAMPLE/SAMPLE
		// representing the first case evaluated, while sampled_cases contains
		// all individual evaluation results for each case in the sample
		// This allows the frontend to see both:
		// 1. A specific example evaluation (evaluation_result)
		// 2. All sampled cases and their individual results (sampled_cases)
		const evaluationResult = sampledCases[0]?.result || {
			workflow_id: workflow.id,
			workflow_name: workflow.name,
			trigger_matched: false,
			applied_action: [],
			default_applied: true,
			evaluation_log: {
				trigger_evaluations: [],
				rule_evaluations: [],
				workflows_evaluated: []
			},
			latency_ms: Date.now() - startTime,
			evaluated_at: new Date().toISOString()
		};

		return {
			evaluation_id: evaluationId,
			business_id: businessId,
			evaluation_result: evaluationResult, // First case result as example
			sampled_cases: sampledCases // All cases with their individual results
		};
	}

	/**
	 * Evaluates workflow for multiple businesses
	 */
	private async evaluateByMultipleBusinessIds(
		evaluationId: string,
		workflow: Workflow,
		businessIds: string[],
		sampleSize: number,
		startTime: number
	): Promise<PreviewEvaluationResponse> {
		logger.debug(
			`Evaluating ${businessIds.length} businesses for workflow ${workflow.id} with sample size ${sampleSize}`
		);

		// Evaluate each business in parallel
		const businessResults: PreviewBusinessResult[] = await Promise.all(
			businessIds.map(async businessId => {
				const businessStartTime = Date.now();
				const singleBusinessResult = await this.evaluateByBusinessId(
					evaluationId,
					workflow,
					{ business_id: businessId, sample_size: sampleSize },
					businessStartTime
				);

				return {
					business_id: businessId,
					evaluation_result: singleBusinessResult.evaluation_result,
					sampled_cases: singleBusinessResult.sampled_cases || []
				};
			})
		);

		// Use the first business's result as the example/aggregate evaluation_result
		// This maintains backward compatibility with single business responses
		const aggregateEvaluationResult =
			businessResults[0]?.evaluation_result ?? this.createEmptyEvaluationResult(workflow, startTime);

		return {
			evaluation_id: evaluationId,
			business_id: businessIds,
			evaluation_result: aggregateEvaluationResult,
			business_results: businessResults
		};
	}

	/**
	 * Creates an empty evaluation result for error/empty cases
	 */
	private createEmptyEvaluationResult(workflow: Workflow, startTime: number): PreviewEvaluationResult {
		return {
			workflow_id: workflow.id,
			workflow_name: workflow.name,
			trigger_matched: false,
			applied_action: [],
			default_applied: true,
			evaluation_log: {
				trigger_evaluations: [],
				rule_evaluations: [],
				workflows_evaluated: []
			},
			latency_ms: Date.now() - startTime,
			evaluated_at: new Date().toISOString()
		};
	}

	/**
	 * Fetches real cases from the Case Service for a business with sampling
	 */
	private async fetchCasesForBusiness(businessId: string, sampleSize: number): Promise<CaseData[]> {
		try {
			logger.debug(`Fetching cases for business ${businessId} with sample size ${sampleSize}`);

			// Use the Case Service to fetch cases by business_id
			const cases = await caseService.getCasesByBusinessId(businessId, sampleSize, 0);
			logger.debug(`Found ${cases.length} cases for business ${businessId}`);
			return cases;
		} catch (error) {
			logger.error({ error }, `Error fetching cases for business ${businessId}`);
			return [];
		}
	}

	/**
	 * Performs dry-run workflow evaluation using existing Facts infrastructure
	 * @param workflow - The workflow to evaluate
	 * @param caseData - The case data to evaluate against
	 * @param startTime - Start time for latency calculation
	 * @returns Evaluation result in preview format
	 * @note This method intentionally replicates the same logic as WorkflowManager for:
	 *   - Self-containment and testability
	 *   - Clear preview-specific behavior (no side effects)
	 *   - Avoiding complex refactoring of WorkflowManager
	 */
	private async performWorkflowEvaluation(
		workflow: Workflow,
		caseData: CaseData,
		startTime: number
	): Promise<PreviewEvaluationResult> {
		logger.debug(`Performing dry-run workflow evaluation for case ${caseData.id} on workflow ${workflow.id}`);

		try {
			// Use the existing workflow evaluation logic but in dry-run mode
			// This replicates the same Facts fetching and evaluation logic as the real workflow manager
			return await this.performDryRunEvaluationInternal(workflow, caseData, startTime);
		} catch (error) {
			logger.error({ error }, `Error performing workflow evaluation for case ${caseData.id}`);

			// Return error result
			return {
				workflow_id: workflow.id,
				workflow_name: workflow.name,
				trigger_matched: false,
				applied_action: [],
				default_applied: true,
				evaluation_log: {
					trigger_evaluations: [],
					rule_evaluations: [],
					workflows_evaluated: []
				},
				latency_ms: Date.now() - startTime,
				evaluated_at: new Date().toISOString()
			};
		}
	}

	/**
	 * Performs dry-run evaluation using existing workflow infrastructure
	 * This mirrors the logic in WorkflowManager.evaluateWorkflowsAndRules
	 */
	private async performDryRunEvaluationInternal(
		workflow: Workflow,
		caseData: CaseData,
		startTime: number
	): Promise<PreviewEvaluationResult> {
		logger.debug(`Performing dry-run evaluation for workflow ${workflow.id}`);

		// Step 1: In preview mode, we log trigger status but ALWAYS continue to evaluate rules
		const versionAndRules = await this.versionRepository.getWorkflowVersionAndRules(workflow.id);
		const triggerConditions = versionAndRules?.trigger_conditions ?? undefined;
		const triggerResult = TriggerEvaluator.evaluateTrigger(caseData, { id: workflow.id, trigger: triggerConditions });

		// Log trigger result but don't block rule evaluation
		logger.debug(
			`Preview trigger evaluation for workflow ${workflow.id}: matched=${triggerResult.matched}` +
				(triggerResult.error ? `, error=${triggerResult.error}` : "")
		);

		// Step 2: Extract required facts and fetch from Warehouse Service
		const factsRequired = await this.factsManager.extractRequiredFactsFromWorkflow(workflow.id);
		logger.debug(`Required facts for evaluation: ${factsRequired.join(", ")}`);

		const facts = await warehouseService.getFacts(caseData.business_id ?? "", factsRequired);
		logger.debug(`Fetched facts for business ${caseData.business_id}`);

		// Step 3: Get workflow rules (same as existing)
		const { version, rules } = (await this.versionRepository.getWorkflowVersionAndRules(workflow.id)) || {
			version: null,
			rules: []
		};
		logger.debug(`Loaded ${rules.length} rules for workflow ${workflow.id}`);

		// Step 4: Evaluate rules (dry-run - no side effects)
		const ruleEvaluations: Array<{
			workflow_id: string;
			rule_id: string;
			rule_name: string;
			matched: boolean;
			error?: string;
			conditions: Record<string, unknown>;
		}> = [];
		let matchedRule: { id: string; name: string; actions: WorkflowActionRequest[] } | null = null;

		for (const rule of rules) {
			logger.debug(`Evaluating rule ${rule.id} (${rule.name}) for workflow ${workflow.id}`);

			const ruleResult = RuleEvaluator.evaluateRule(rule, caseData, facts);

			const ruleEvaluation = {
				workflow_id: workflow.id,
				rule_id: rule.id,
				rule_name: rule.name,
				matched: ruleResult.matched,
				error: ruleResult.error,
				conditions: rule.conditions
			};
			ruleEvaluations.push(ruleEvaluation);

			if (ruleResult.matched) {
				matchedRule = {
					id: rule.id,
					name: rule.name,
					actions: (rule.actions as WorkflowActionRequest[]) || []
				};
				break; // First terminal match wins (as per TDD requirement)
			}
		}

		// Step 5: Generate evaluation result
		const evaluationResult: WorkflowExecutionResult = {
			workflow_id: workflow.id,
			matched_rule_id: matchedRule?.id,
			applied_action: matchedRule ? (matchedRule.actions as WorkflowAction[]) : [],
			default_applied: !matchedRule,
			evaluation_log: {
				trigger_evaluations: [
					{
						workflow_id: workflow.id,
						matched: triggerResult.matched,
						error: triggerResult.error
					}
				],
				rule_evaluations: ruleEvaluations,
				workflows_evaluated: [
					{
						workflow_id: workflow.id,
						trigger_matched: triggerResult.matched,
						rules_evaluated: rules.length,
						matched_rule_id: matchedRule?.id
					}
				]
			},
			workflow_version_id: version?.id || "current-version",
			input_attr: this.prepareInputAttributes(caseData, facts),
			latency_ms: Date.now() - startTime,
			case_id: caseData.id
		};

		return {
			workflow_id: evaluationResult.workflow_id,
			workflow_name: workflow.name,
			trigger_matched: triggerResult.matched,
			matched_rule_id: evaluationResult.matched_rule_id,
			matched_rule_name: matchedRule?.name,
			applied_action: evaluationResult.applied_action as WorkflowActionRequest[],
			default_applied: evaluationResult.default_applied,
			evaluation_log: evaluationResult.evaluation_log as unknown as PreviewEvaluationLog,
			latency_ms: evaluationResult.latency_ms,
			evaluated_at: new Date().toISOString()
		};
	}
}
