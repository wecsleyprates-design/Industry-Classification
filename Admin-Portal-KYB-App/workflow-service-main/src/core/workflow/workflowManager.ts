import { logger } from "#helpers/logger";
import { CaseService } from "#services/case";
import { AuthService } from "#services/auth";
import { workflowQueue } from "#workers/workflowWorker";
import { transformCustomFields } from "#helpers/customFields";
import { normalizeFacts } from "#helpers/dates";
import {
	ERROR_MESSAGES,
	EVENTS,
	WORKFLOW_ERROR_CODES_COMBINED as ERROR_CODES,
	WORKFLOW_STATUS,
	WORKFLOW_CHANGE_TYPES,
	SUCCESS_MESSAGES,
	ACTION_TYPES,
	TRIGGER_TYPES,
	FIELD_PREFIXES
} from "#constants";
import { ApiError, UserInfo } from "#types/common";
import { StatusCodes } from "http-status-codes";
import { v4 as uuidv4 } from "uuid";
import { normalizePagination, calculateTotalPages } from "#utils/queryHelpers";
import { type WorkflowJobData } from "./types";
import type {
	CreateWorkflowRequest,
	CreateWorkflowResponse,
	AddRulesRequest,
	AddRulesResponse,
	WorkflowRuleRequest,
	WorkflowActionRequest
} from "#types/workflow-dtos";
import { type WorkflowNotificationData, type WorkflowNotificationResponse } from "#core/types";
import { warehouseService } from "#services/warehouse";
import { actionProcessor } from "#core/actions";
import { WorkflowRepository } from "#core/workflow/workflowRepository";
import type { GetWorkflowsListParams, GetWorkflowsListRepositoryParams, GetWorkflowsListManagerResult } from "./types";
import type { GetWorkflowByIdResponse } from "#types/workflow-dtos";
import { VersionRepository } from "#core/versioning/versionRepository";
import { RuleRepository } from "#core/rule/ruleRepository";
import { TriggerRepository } from "#core/trigger/triggerRepository";
import { AuditRepository } from "#core/audit/auditRepository";
import { TriggerEvaluator, RuleEvaluator } from "#core/evaluators";
import type { EventConfig, CaseData } from "#core/types";
import type { Workflow, WorkflowWithTrigger } from "#core/workflow/types";
import type { WorkflowVersion } from "#core/versioning/types";
import type { WorkflowAction } from "#core/actions/types";
import type { WorkflowExecutionResult, EvaluationLog } from "#core/evaluators/types";
import { isValidUUID } from "#utils/validation";
import { UpdateWorkflowRequest, VersionChange, WorkflowVersionWithRulesAndTriggerConditions } from "#core/versioning";
import {
	CreateWorkflowRequestValidator,
	UpdateWorkflowRequestValidator,
	DeleteWorkflowRequestValidator,
	GetWorkflowsListRequestValidator,
	ChangePriorityRequestValidator,
	UpdateWorkflowStatusRequestValidator,
	GetWorkflowByIdRequestValidator
} from "#core/validators";
import { VersionChangeDetector } from "#core/versioning/versionChangeDetector";
import { VersionManager } from "#core/versioning/versionManager";
import { FactsManager } from "../facts";
import { PublishManager } from "#core/publish";
import type { Knex } from "knex";

export class WorkflowManager {
	private workflowRepository: WorkflowRepository;
	private versionRepository: VersionRepository;
	private ruleRepository: RuleRepository;
	private triggerRepository: TriggerRepository;
	private auditRepository: AuditRepository;
	private caseService: CaseService;
	private authService: AuthService;
	private versionManager: VersionManager;
	private factsManager: FactsManager;
	private publishManager: PublishManager;

	constructor(
		workflowRepository?: WorkflowRepository,
		versionRepository?: VersionRepository,
		ruleRepository?: RuleRepository,
		triggerRepository?: TriggerRepository,
		auditRepository?: AuditRepository,
		caseService?: CaseService,
		authService?: AuthService,
		factsManager?: FactsManager,
		publishManager?: PublishManager
	) {
		this.workflowRepository = workflowRepository ?? new WorkflowRepository();
		this.versionRepository = versionRepository ?? new VersionRepository();
		this.ruleRepository = ruleRepository ?? new RuleRepository();
		this.triggerRepository = triggerRepository ?? new TriggerRepository();
		this.auditRepository = auditRepository ?? new AuditRepository();
		this.caseService = caseService ?? new CaseService();
		this.authService = authService ?? new AuthService();
		this.versionManager = new VersionManager(this.versionRepository, this.ruleRepository, this.auditRepository);
		this.factsManager = factsManager ?? new FactsManager(this.versionRepository);
		this.publishManager = publishManager ?? new PublishManager();
	}

	/**
	 * Main entry point for processing cases from the workflow queue
	 * @param caseId - The case ID to process
	 * @param eventConfig - Optional event configuration for scalability
	 * @returns Promise<void>
	 */
	async processCaseEvent(caseId: string, eventConfig?: EventConfig): Promise<void> {
		const customerId = eventConfig?.customerId;
		const previousStatus = eventConfig?.previous_status;
		const isResubmit = this.isResubmitEvent(eventConfig);

		logger.info(
			`Processing case: case_id=${caseId}, customer_id=${customerId ?? "unknown"}${previousStatus ? `, previous_status=${previousStatus}` : ""}${isResubmit ? ", trigger_type=resubmit" : ""}`
		);

		const startTime = Date.now();

		// TODO(metrics): increment counters (received, processed_ok, matched_count)

		try {
			if (this.shouldSkipProcessing(caseId, isResubmit, await this.auditRepository.isCaseProcessed(caseId))) {
				return;
			}

			// Fetch fresh case data from Case Service
			const caseData = await this.caseService.getCaseById(caseId);
			logger.debug(`Fetched case data for ${caseId}: status=${caseData.status}, customer_id=${caseData.customer_id}`);

			const workflows = await this.workflowRepository.loadActiveWorkflowsByPriority(caseData.customer_id);
			logger.debug(`Loaded ${workflows.length} active workflows for customer ${caseData.customer_id}`);

			if (workflows.length === 0) {
				logger.info(`No active workflows found for customer ${caseData.customer_id}`);
				if (previousStatus) {
					await this.restorePreviousStatus(caseId, caseData, previousStatus);
				}
				return;
			}

			const executionResult = await this.evaluateWorkflowsAndRules(workflows, caseData, caseId, startTime);

			if (executionResult) {
				await this.applyActions(executionResult.applied_action, caseData);

				if (eventConfig?.annotations) {
					executionResult.annotations = eventConfig.annotations;
				}

				await this.recordWorkflowExecution(executionResult);

				logger.info(`Case ${caseId} processed successfully with workflow ${executionResult.workflow_id}`);
			} else {
				logger.info(`No workflow rules matched for case ${caseId}`);
				if (previousStatus) {
					await this.restorePreviousStatus(caseId, caseData, previousStatus);
				}
			}
		} catch (error) {
			logger.error({ error }, `Error processing case event for case ${caseId}`);
			throw error;
		}
	}

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

	/**
	 * Evaluates workflows and their rules until a match is found
	 * @param workflows - Array of workflows with trigger conditions ordered by priority
	 * @param caseData - The case data to evaluate against
	 * @param caseId - The case ID for logging
	 * @param startTime - Start time for latency calculation
	 * @returns WorkflowExecutionResult or null if no match
	 */
	private async evaluateWorkflowsAndRules(
		workflows: WorkflowWithTrigger[],
		caseData: CaseData,
		caseId: string,
		startTime: number
	): Promise<WorkflowExecutionResult | null> {
		const evaluationLog: EvaluationLog = {
			workflows_evaluated: [],
			trigger_evaluations: [],
			rule_evaluations: [],
			default_action_applied: false
		};

		let lastWorkflowWithTriggerMatch: {
			workflow: Workflow;
			version: WorkflowVersion;
			facts: Record<string, unknown>;
		} | null = null;

		for (const workflow of workflows) {
			logger.debug(`Evaluating workflow ${workflow.id} (priority: ${workflow.priority}) for case ${caseId}`);

			const triggerResult = TriggerEvaluator.evaluateTrigger(caseData, {
				id: workflow.id,
				trigger: workflow.trigger
			});

			const { version, rules } = await this.versionRepository.getWorkflowVersionAndRules(workflow.id);

			evaluationLog.trigger_evaluations.push({
				workflow_id: workflow.id,
				workflow_version_id: version.id,
				matched: triggerResult.matched,
				error: triggerResult.error
			});

			if (!triggerResult.matched) {
				logger.debug(`Trigger did not match for workflow ${workflow.id}`);
				evaluationLog.workflows_evaluated.push({
					workflow_id: workflow.id,
					workflow_version_id: version.id,
					trigger_matched: false,
					rules_evaluated: 0
				});
				continue;
			}

			const factsRequired = await this.factsManager.extractRequiredFactsFromWorkflow(workflow.id);
			logger.debug(`Required facts for evaluation: ${factsRequired.join(", ")}`);

			const facts = await warehouseService.getFacts(caseData.business_id ?? "", factsRequired);
			logger.debug(`Fetched facts for business ${caseData.business_id}`);

			logger.debug(`Trigger matched for workflow ${workflow.id}, loading rules`);
			logger.debug(`Loaded ${rules.length} rules for workflow ${workflow.id}`);

			lastWorkflowWithTriggerMatch = { workflow, version, facts };

			for (const rule of rules) {
				logger.debug(`Evaluating rule ${rule.id} (${rule.name}) for workflow ${workflow.id}`);

				const ruleResult = RuleEvaluator.evaluateRule(rule, caseData, facts);
				evaluationLog.rule_evaluations.push({
					workflow_id: workflow.id,
					workflow_version_id: version.id,
					rule_id: rule.id,
					rule_name: rule.name,
					matched: ruleResult.matched,
					error: ruleResult.error,
					conditions: rule.conditions,
					true_conditions: ruleResult.true_conditions,
					false_conditions: ruleResult.false_conditions
				});

				if (ruleResult.matched) {
					logger.info(`Rule ${rule.id} matched for workflow ${workflow.id}, applying action`);

					const latencyMs = Date.now() - startTime;

					evaluationLog.workflows_evaluated.push({
						workflow_id: workflow.id,
						workflow_version_id: version.id,
						trigger_matched: true,
						rules_evaluated: rules.indexOf(rule) + 1,
						matched_rule_id: rule.id
					});

					const inputAttributes = this.prepareInputAttributes(caseData, facts);

					return {
						workflow_id: workflow.id,
						matched_rule_id: rule.id,
						applied_action: rule.actions,
						default_applied: false,
						evaluation_log: evaluationLog,
						workflow_version_id: version.id,
						input_attr: inputAttributes,
						latency_ms: latencyMs,
						case_id: caseId,
						customer_id: workflow.customer_id
					};
				}
			}

			evaluationLog.workflows_evaluated.push({
				workflow_id: workflow.id,
				workflow_version_id: version.id,
				trigger_matched: true,
				rules_evaluated: rules.length,
				matched_rule_id: null
			});
		}

		// If it reaches here, no rules matched any workflow
		const finalLatencyMs = Date.now() - startTime;
		logger.debug(`No rules matched for case ${caseId}, total latency: ${finalLatencyMs}ms`);

		if (lastWorkflowWithTriggerMatch?.version.default_action) {
			logger.info(
				`Applying default action for workflow ${lastWorkflowWithTriggerMatch.workflow.id} for case ${caseId}`
			);

			evaluationLog.default_action_applied = true;

			const inputAttributes = this.prepareInputAttributes(caseData, lastWorkflowWithTriggerMatch.facts);

			return {
				workflow_id: lastWorkflowWithTriggerMatch.workflow.id,
				matched_rule_id: undefined,
				applied_action: lastWorkflowWithTriggerMatch.version.default_action,
				default_applied: true,
				evaluation_log: evaluationLog,
				workflow_version_id: lastWorkflowWithTriggerMatch.version.id,
				input_attr: inputAttributes,
				latency_ms: finalLatencyMs,
				case_id: caseId,
				customer_id: lastWorkflowWithTriggerMatch.workflow.customer_id
			};
		}

		return null;
	}

	/**
	 * Applies actions from a matched rule
	 * @param actions - The actions to apply (can be single action or array)
	 * @param caseData - The case data
	 */
	private async applyActions(actions: WorkflowAction | WorkflowAction[], caseData: CaseData): Promise<void> {
		try {
			logger.debug(`Applying actions for case ${caseData.id}:`, actions);

			let actionList: WorkflowAction[];

			if (Array.isArray(actions)) {
				actionList = actions;
			} else {
				actionList = [actions];
			}

			await actionProcessor.processActions(actionList, caseData);

			logger.debug(`Actions applied successfully for case ${caseData.id}`);
		} catch (error) {
			logger.error({ error }, `Error applying action for case ${caseData.id}`);
			throw error;
		}
	}

	/**
	 * Restores the previous status of a case when no workflow action is executed
	 * This is used in re-submit scenarios where the case status was temporarily changed to SUBMITTED
	 * @param caseId - The case ID
	 * @param caseData - The case data
	 * @param previousStatus - The status to restore
	 */
	private async restorePreviousStatus(caseId: string, caseData: CaseData, previousStatus: string): Promise<void> {
		try {
			logger.info(`Restoring previous status for case ${caseId}: ${previousStatus} (no workflow action executed)`);

			const restoreAction: WorkflowAction = {
				type: ACTION_TYPES.SET_FIELD,
				parameters: {
					field: "case.status",
					value: previousStatus
				}
			};

			await actionProcessor.processActions([restoreAction], caseData);

			logger.info(`Successfully restored status to ${previousStatus} for case ${caseId}`);
		} catch (error) {
			logger.error({ error }, `Error restoring previous status for case ${caseId}`);
			throw error;
		}
	}

	/**
	 * Determines if the event is a re-submit (application edit) event
	 * @param eventConfig - The event configuration
	 * @returns boolean indicating if this is a re-submit event
	 */
	private isResubmitEvent(eventConfig?: EventConfig): boolean {
		return eventConfig?.annotations?.trigger_type === TRIGGER_TYPES.RESUBMIT;
	}

	/**
	 * Determines if case processing should be skipped based on idempotency rules.
	 * Re-submit events bypass the idempotency check to allow workflow re-evaluation.
	 * @param caseId - The case ID for logging
	 * @param isResubmit - Whether this is a re-submit event
	 * @param isAlreadyProcessed - Whether the case has been processed before
	 * @returns boolean indicating if processing should be skipped
	 */
	private shouldSkipProcessing(caseId: string, isResubmit: boolean, isAlreadyProcessed: boolean): boolean {
		if (isResubmit) {
			logger.debug(`Case ${caseId} is a re-submit, bypassing idempotency check`);
			return false;
		}

		if (isAlreadyProcessed) {
			logger.info(`Case ${caseId} has already been processed, skipping`);
			return true;
		}

		return false;
	}

	/**
	 * Validates the workflow manager setup
	 * @returns Promise<boolean>
	 */
	async validateSetup(): Promise<boolean> {
		try {
			logger.debug("Validating workflow manager setup");

			// Check Case Service connectivity
			const caseServiceHealthy = await this.caseService.validateConnection();
			if (!caseServiceHealthy) {
				logger.error("Case Service is not accessible");
				return false;
			}

			// Check Warehouse Service connectivity
			const warehouseServiceHealthy = await warehouseService.validateConnection();
			if (!warehouseServiceHealthy) {
				logger.error("Warehouse Service is not accessible");
				return false;
			}

			logger.info("Workflow manager setup validation passed");
			return true;
		} catch (error) {
			logger.error({ error }, "Workflow manager setup validation failed");
			return false;
		}
	}

	/**
	 * Queues a workflow notification for processing
	 * @param notificationData - The workflow notification data from Kafka event
	 * @returns Promise<WorkflowNotificationResponse>
	 */
	async notifyWorkflow(notificationData: WorkflowNotificationData): Promise<WorkflowNotificationResponse> {
		const { case_id: caseId, customer_id: customerId, annotations, previous_status } = notificationData;
		const enqueuedAt = new Date().toISOString();

		logger.info(`Queuing workflow notification for case ${caseId}, customer ${customerId}`);

		try {
			const jobData: WorkflowJobData = {
				case_id: caseId,
				customer_id: customerId,
				enqueued_at: enqueuedAt,
				annotations,
				previous_status
			};

			const job = await workflowQueue.queue.add(EVENTS.PROCESS_WORKFLOW, jobData);

			const estimatedProcessingTime = new Date().toISOString();

			logger.info(`Workflow job queued successfully: ${job.id} for case ${caseId}`);

			return {
				message: "Workflow notification received and queued for processing",
				job_id: job.id as string,
				estimated_processing_time: estimatedProcessingTime
			};
		} catch (error) {
			logger.error({ error }, `Failed to queue workflow notification for case ${caseId}`);
			throw error;
		}
	}

	/**
	 * Creates a new workflow. By default creates as draft, but can auto-publish if specified.
	 * @param request - The workflow creation request
	 * @param customerId - Customer ID from path parameters
	 * @param userInfo - User information for audit logging
	 * @returns Promise<CreateWorkflowResponse>
	 */
	async createWorkflow(
		request: CreateWorkflowRequest,
		customerId: string,
		userInfo: UserInfo
	): Promise<CreateWorkflowResponse> {
		const context = "data_workflows";
		const { user_id: userId } = userInfo;

		const validator = new CreateWorkflowRequestValidator();
		const validatedData = await validator.validate(request, customerId, userInfo);

		const { name, description, trigger_id: triggerId, rules, default_action, auto_publish } = validatedData.request;
		const validatedCustomerId = validatedData.customerId;

		if (rules && (!Array.isArray(rules) || rules.length === 0)) {
			throw new ApiError(ERROR_MESSAGES.INVALID_RULES_ARRAY, StatusCodes.BAD_REQUEST, ERROR_CODES.UNKNOWN_ERROR);
		}

		logger.info(
			`Creating workflow: name=${name}, user=${userId}, customer=${validatedCustomerId}, trigger_id=${triggerId ?? "default"}, rules_count=${rules?.length ?? 0}, auto_publish=${!!auto_publish}`
		);

		try {
			const workflowId = uuidv4();
			const versionId = uuidv4();

			const finalTriggerId = triggerId ?? (await this.triggerRepository.getTriggerIdByName("SUBMITTED"));

			const maxPriority = await this.workflowRepository.getMaxPriority(validatedCustomerId);
			const nextPriority = maxPriority + 1;

			const workflowData = {
				id: workflowId,
				customer_id: validatedCustomerId,
				name,
				description: description ?? undefined,
				active: false,
				priority: nextPriority,
				created_by: userId
			};

			const versionData = {
				id: versionId,
				workflow_id: workflowId,
				trigger_id: finalTriggerId,
				status: "draft",
				is_current: true,
				created_by: userId,
				default_action: default_action as WorkflowAction | WorkflowAction[] | undefined
			};

			let publishedAt: string | undefined;

			await this.workflowRepository.transaction(async trx => {
				await this.workflowRepository.insertWorkflow(workflowData, trx);
				await this.versionRepository.insertWorkflowVersion(versionData, trx);

				if (rules && rules.length > 0) {
					for (let i = 0; i < rules.length; i++) {
						const rule = rules[i];
						if (!rule.priority) {
							rule.priority = i + 1;
						}
						await this.ruleRepository.insertRule(versionId, rule, userId, trx);
					}
					logger.debug(`Inserted ${rules.length} rules during workflow creation`);
				}

				await this.auditRepository.insertWorkflowChangeLog(
					{
						field_path: context,
						workflow_id: workflowId,
						version_id: versionId,
						change_type: WORKFLOW_CHANGE_TYPES.CREATED,
						change_description: `Workflow created: ${name}${rules && rules.length > 0 ? ` with ${rules.length} rules` : ""}${default_action ? " with default_action" : ""}`,
						updated_by: userId,
						customer_id: validatedCustomerId
					},
					trx
				);

				if (auto_publish) {
					const workflowForPublish: Workflow = {
						id: workflowId,
						customer_id: validatedCustomerId,
						name,
						description: description ?? undefined,
						active: false,
						priority: nextPriority,
						created_by: userId,
						created_at: new Date(),
						updated_by: userId,
						updated_at: new Date()
					};

					const publishResult = await this.publishManager.publishNewWorkflow(
						workflowId,
						versionId,
						workflowForPublish,
						userInfo,
						trx
					);
					publishedAt = publishResult.published_at;
				}
			});

			const message = auto_publish ? SUCCESS_MESSAGES.WORKFLOW_CREATED_AND_PUBLISHED : SUCCESS_MESSAGES.DRAFT_CREATED;

			logger.info(
				`Workflow created successfully: workflow_id=${workflowId}, version_id=${versionId}, rules_count=${rules?.length ?? 0}, auto_publish=${!!auto_publish}`
			);

			return {
				workflow_id: workflowId,
				version_id: versionId,
				message,
				published_at: publishedAt
			};
		} catch (error) {
			logger.error({ error }, `Failed to create workflow: name=${name}, user=${userId}`);
			throw error;
		}
	}

	/**
	 * Records a workflow execution in the database with detailed evaluation log
	 * @param executionResult - The workflow execution result
	 */
	private async recordWorkflowExecution(executionResult: WorkflowExecutionResult): Promise<void> {
		try {
			logger.debug(`Recording workflow execution for case ${executionResult.case_id}`);

			await this.auditRepository.recordWorkflowExecution(executionResult);

			logger.debug(`Workflow execution recorded for case ${executionResult.case_id}`);
		} catch (error) {
			logger.error({ error }, `Error recording workflow execution for case ${executionResult.case_id}`);
		}
	}

	/**
	 * Adds or updates rules for a workflow
	 * @param workflowId - The workflow ID
	 * @param request - The rules to add/update
	 * @param userInfo - User information for audit logging
	 * @returns Promise<AddRulesResponse>
	 */
	async addRules(workflowId: string, request: AddRulesRequest, userInfo: UserInfo): Promise<AddRulesResponse> {
		const { rules } = request;
		const { user_id: userId, customer_id: customerId } = userInfo;

		// Validate workflow ID format
		if (!isValidUUID(workflowId)) {
			throw new ApiError(ERROR_MESSAGES.INVALID_WORKFLOW_ID, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}

		logger.info(`Adding rules to workflow: workflow_id=${workflowId}, user=${userId}, customer=${customerId}`);

		try {
			// Input validation
			if (!workflowId || !userId || !customerId) {
				throw new ApiError(ERROR_MESSAGES.INVALID_INPUT_PARAMETERS, StatusCodes.BAD_REQUEST, ERROR_CODES.UNKNOWN_ERROR);
			}

			if (!rules || !Array.isArray(rules) || rules.length === 0) {
				throw new ApiError(ERROR_MESSAGES.INVALID_RULES_ARRAY, StatusCodes.BAD_REQUEST, ERROR_CODES.UNKNOWN_ERROR);
			}

			// Verify the workflow exists and get draft version
			const workflow = await this.workflowRepository.getWorkflowById(workflowId);
			if (!workflow) {
				throw new ApiError(ERROR_MESSAGES.WORKFLOW_NOT_FOUND, StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			const draftVersion = await this.versionRepository.getDraftVersion(workflowId);
			if (!draftVersion) {
				throw new ApiError(ERROR_MESSAGES.NO_DRAFT_VERSION, StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			// Orchestrate rule operations: delete existing and insert new ones
			const deletedCount = await this.ruleRepository.deleteRulesForVersion(draftVersion.id);
			logger.debug(`Deleted ${deletedCount} existing rules for workflow version ${draftVersion.id}`);

			// Insert new rules one by one
			const insertedRuleIds: string[] = [];
			for (const rule of rules) {
				const ruleId = await this.ruleRepository.insertRule(draftVersion.id, rule, userId);
				insertedRuleIds.push(ruleId);
			}

			const result = {
				workflow_id: workflowId,
				version_id: draftVersion.id,
				rules_added: rules.length,
				message: `Successfully added ${rules.length} rules to workflow`
			};

			// Note: Changes to draft version rules are not tracked per audit requirements
			// Snapshot is only created when the version is published, not during draft edits

			logger.info(`Rules added successfully to workflow: workflow_id=${workflowId}, rules_added=${result.rules_added}`);

			return result;
		} catch (error) {
			logger.error({ error }, `Failed to add rules to workflow: workflow_id=${workflowId}, user=${userId}`);
			throw error;
		}
	}

	/**
	 * Updates a workflow and handles versioning logic. Can auto-publish after update if specified.
	 * @param workflowId - The workflow ID to update
	 * @param updateRequest - The update request containing changes
	 * @param userInfo - User information for audit logging
	 * @returns Object indicating if new version is required, detected changes, and publish timestamp if auto-published
	 */
	async updateWorkflow(
		workflowId: string,
		updateRequest: UpdateWorkflowRequest,
		userInfo: UserInfo
	): Promise<{ requiresNewVersion: boolean; changes: VersionChange[]; published_at?: string }> {
		try {
			const { auto_publish } = updateRequest;
			logger.debug(
				`Updating workflow: workflow_id=${workflowId}, user=${userInfo.user_id}, auto_publish=${!!auto_publish}`
			);

			const validator = new UpdateWorkflowRequestValidator();
			const validatedData = await validator.validate(workflowId, updateRequest, userInfo);

			const versionAndRules = await this.versionRepository.getWorkflowVersionAndRules(validatedData.workflowId);
			const workflow = validatedData.workflow;

			if (!versionAndRules) {
				throw new ApiError("Workflow version not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			const workflowBaseFields = {
				name: validatedData.updateData.name,
				description: validatedData.updateData.description
			};

			const workflowVersionedFields = {
				trigger_id: validatedData.updateData.trigger_id,
				rules: validatedData.updateData.rules,
				default_action: validatedData.updateData.default_action
			};

			const hasWorkflowBaseChanges =
				(validatedData.updateData.name !== undefined && validatedData.updateData.name !== workflow.name) ||
				(validatedData.updateData.description !== undefined &&
					validatedData.updateData.description !== workflow.description);

			if (hasWorkflowBaseChanges) {
				await this.workflowRepository.updateWorkflow(
					validatedData.workflowId,
					workflowBaseFields,
					validatedData.userInfo.user_id
				);
				logger.info(`Workflow base fields updated: workflow_id=${validatedData.workflowId}`);

				await this.logWorkflowBaseChanges(
					validatedData.workflowId,
					workflow,
					validatedData.updateData,
					validatedData.userInfo
				);
			}

			const currentVersion: WorkflowVersionWithRulesAndTriggerConditions = {
				...versionAndRules.version,
				rules: versionAndRules.rules
			};

			const isDraftVersion = currentVersion.status === WORKFLOW_STATUS.DRAFT;

			if (isDraftVersion) {
				await this.updateDraftVersion(
					validatedData.workflowId,
					currentVersion,
					workflowVersionedFields,
					validatedData.userInfo.user_id
				);

				logger.info(`DRAFT version updated for workflow: workflow_id=${validatedData.workflowId}`);

				if (auto_publish) {
					const publishResult = await this.publishManager.publishWorkflow(currentVersion.id, userInfo);
					return {
						requiresNewVersion: false,
						changes: [],
						published_at: publishResult.published_at
					};
				}

				return {
					requiresNewVersion: false,
					changes: []
				};
			}

			const requiresNewVersion: boolean = VersionChangeDetector.requiresNewVersion(
				currentVersion,
				workflowVersionedFields
			);

			if (requiresNewVersion) {
				const versionResult = await this.versionManager.createVersion(
					currentVersion,
					workflowVersionedFields,
					validatedData.userInfo,
					workflow.customer_id
				);

				if (auto_publish) {
					const publishResult = await this.publishManager.publishWorkflow(versionResult.version_id, userInfo);
					return {
						requiresNewVersion: true,
						changes: versionResult.changes ?? [],
						published_at: publishResult.published_at
					};
				}

				return {
					requiresNewVersion: true,
					changes: versionResult.changes ?? []
				};
			}

			logger.info(`No versioning required for workflow: workflow_id=${validatedData.workflowId}`);
			return {
				requiresNewVersion: false,
				changes: []
			};
		} catch (error) {
			logger.error({ error }, `Error updating workflow ${workflowId}`);
			if (error instanceof ApiError) {
				throw error;
			}

			throw new ApiError("Failed to update workflow", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.UNKNOWN_ERROR);
		}
	}

	/**
	 * Updates an existing DRAFT version with new changes
	 * @param workflowId - The workflow ID
	 * @param currentVersion - The current DRAFT version
	 * @param workflowVersionedFields - The versioned fields to update
	 * @param userId - The user making the changes
	 */
	private async updateDraftVersion(
		workflowId: string,
		currentVersion: WorkflowVersionWithRulesAndTriggerConditions,
		workflowVersionedFields: {
			trigger_id?: string;
			rules?: WorkflowRuleRequest[];
			default_action?: WorkflowActionRequest | WorkflowActionRequest[];
		},
		userId: string
	): Promise<void> {
		try {
			logger.debug(`Updating DRAFT version for workflow ${workflowId}`);

			const versionUpdateData: Record<string, unknown> = {
				updated_by: userId,
				updated_at: new Date().toISOString()
			};

			if (workflowVersionedFields.trigger_id !== undefined) {
				versionUpdateData.trigger_id = workflowVersionedFields.trigger_id;
			}

			if (workflowVersionedFields.default_action !== undefined) {
				versionUpdateData.default_action = workflowVersionedFields.default_action;
			}

			if (Object.keys(versionUpdateData).length > 2) {
				await this.versionRepository.updateWorkflowVersion(currentVersion.id, versionUpdateData, userId);
			}

			if (workflowVersionedFields.rules) {
				await this.ruleRepository.deleteRulesForVersion(currentVersion.id);

				for (let i = 0; i < workflowVersionedFields.rules.length; i++) {
					const rule = workflowVersionedFields.rules[i];
					rule.priority = i + 1;

					await this.ruleRepository.insertRule(currentVersion.id, rule, userId);
				}

				logger.info(`Updated ${workflowVersionedFields.rules.length} rules for DRAFT version ${currentVersion.id}`);
			}

			logger.info(`DRAFT version ${currentVersion.id} updated successfully for workflow ${workflowId}`);
		} catch (error) {
			logger.error({ error }, `Error updating DRAFT version for workflow ${workflowId}`);
			throw error;
		}
	}

	/**
	 * Deletes a draft workflow and all its draft versions
	 * Uses validator for all business logic validation, then orchestrates repository operations
	 * @param workflowId - The workflow ID to delete
	 * @param userInfo - User information for audit logging
	 * @returns Promise<{ message: string }>
	 */
	async deleteDraftWorkflow(workflowId: string, userInfo: UserInfo): Promise<{ message: string }> {
		const { user_id: userId } = userInfo;

		logger.info(`WorkflowManager: Deleting draft workflow: workflow_id=${workflowId}, user=${userId}`);

		return await this.workflowRepository.transaction(async trx => {
			const deleteValidator = new DeleteWorkflowRequestValidator();
			const validatedData = await deleteValidator.validate(workflowId, userInfo);

			const { workflow } = validatedData;
			const deletedPriority = workflow.priority ?? 0;

			await this.deleteWorkflowVersionsAndRules(workflowId, trx);

			await this.workflowRepository.deleteWorkflowWithCount(workflowId, trx);

			await this.reorderPrioritiesAfterDeletion(workflow.customer_id, deletedPriority, workflowId, userId, trx);

			logger.info(`WorkflowManager: Draft workflow deleted successfully: workflow_id=${workflowId}`);

			return {
				message: "Draft workflow deleted successfully"
			};
		});
	}

	/**
	 * Logs base changes (name/description) for workflows with published versions
	 * @param workflowId - The workflow ID
	 * @param workflow - The current workflow state before update
	 * @param updateData - The update request data
	 * @param userInfo - User information for audit logging
	 */
	private async logWorkflowBaseChanges(
		workflowId: string,
		workflow: Workflow,
		updateData: { name?: string; description?: string },
		userInfo: UserInfo
	): Promise<void> {
		const context = "data_workflows";
		const publishedVersions = await this.versionRepository.getPublishedVersions(workflowId);
		if (publishedVersions.length === 0) {
			return;
		}

		// Only one published version can exist at a time, so we take the first (and only) one
		const currentPublishedVersion = publishedVersions[0];

		const metadataFields: Array<{
			fieldPath: string;
			oldValue: string | undefined;
			newValue: string | undefined;
			getDescription: (oldVal: string | undefined, newVal: string | undefined) => string;
		}> = [
			{
				fieldPath: `${context}.name`,
				oldValue: workflow.name,
				newValue: updateData.name,
				getDescription: (oldVal, newVal) => `Workflow name updated from "${oldVal ?? ""}" to "${newVal ?? ""}"`
			},
			{
				fieldPath: `${context}.description`,
				oldValue: workflow.description ?? undefined,
				newValue: updateData.description ?? undefined,
				getDescription: () => "Workflow description updated"
			}
		];

		for (const fieldConfig of metadataFields) {
			if (fieldConfig.newValue !== undefined && fieldConfig.newValue !== fieldConfig.oldValue) {
				await this.logFieldChange({
					workflow,
					versionId: currentPublishedVersion.id,
					fieldPath: fieldConfig.fieldPath,
					oldValue: fieldConfig.oldValue,
					newValue: fieldConfig.newValue,
					changeDescription: fieldConfig.getDescription(fieldConfig.oldValue, fieldConfig.newValue),
					userInfo
				});
			}
		}
	}

	/**
	 * Logs a single field change to the audit repository
	 * @param params - Parameters for the field change log
	 */
	private async logFieldChange(params: {
		workflow: Workflow;
		versionId: string;
		fieldPath: string;
		oldValue: string | undefined;
		newValue: string | undefined;
		changeDescription: string;
		userInfo: UserInfo;
	}): Promise<void> {
		await this.auditRepository.insertWorkflowChangeLog({
			workflow_id: params.workflow.id,
			version_id: params.versionId,
			change_type: WORKFLOW_CHANGE_TYPES.FIELD_CHANGED,
			change_description: params.changeDescription,
			updated_by: params.userInfo.user_id,
			field_path: params.fieldPath,
			old_value: params.oldValue,
			new_value: params.newValue,
			customer_id: params.workflow.customer_id
		});
	}

	/**
	 * Gets workflows affected by a priority change within the specified range
	 */
	private async getAffectedWorkflowsInPriorityRange(
		customerId: string,
		oldPriority: number,
		newPriority: number,
		trx: Knex.Transaction
	): Promise<Array<{ id: string; priority: number; name: string }>> {
		const minPriority = Math.min(oldPriority, newPriority);
		const maxPriority = Math.max(oldPriority, newPriority);

		return await this.workflowRepository.getWorkflowsInPriorityRange(customerId, minPriority, maxPriority, true, trx);
	}

	/**
	 * Validates that the workflow exists in the priority range and has the expected priority
	 */
	private validateWorkflowInPriorityRange(
		workflowId: string,
		expectedPriority: number,
		affectedWorkflowsList: Array<{ id: string; priority: number; name: string }>
	): void {
		const workflowInRange = affectedWorkflowsList.find(wf => wf.id === workflowId);
		if (!workflowInRange) {
			throw new ApiError(
				`Workflow ${workflowId} not found in priority range. The workflow may have been modified or deleted.`,
				StatusCodes.CONFLICT,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}

		if (workflowInRange.priority !== expectedPriority) {
			throw new ApiError(
				`Workflow priority mismatch. Expected priority ${expectedPriority}, but found ${workflowInRange.priority}. The workflow may have been modified by another process.`,
				StatusCodes.CONFLICT,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}

	/**
	 * Calculates the priority updates needed when changing a workflow's priority
	 * Returns both the database updates and the affected workflows list for audit logging
	 */
	private calculatePriorityUpdates(
		workflowId: string,
		oldPriority: number,
		newPriority: number,
		affectedWorkflowsList: Array<{ id: string; priority: number; name: string }>
	): {
		updates: Array<{ workflowId: string; priority: number }>;
		affectedWorkflows: Array<{ workflow_id: string; old_priority: number; new_priority: number }>;
	} {
		const updates: Array<{ workflowId: string; priority: number }> = [];
		const affectedWorkflows: Array<{ workflow_id: string; old_priority: number; new_priority: number }> = [];

		const isMovingUp = oldPriority > newPriority;

		for (const wf of affectedWorkflowsList) {
			if (wf.id === workflowId) {
				// Update the target workflow
				updates.push({ workflowId: wf.id, priority: newPriority });
				affectedWorkflows.push({
					workflow_id: wf.id,
					old_priority: wf.priority,
					new_priority: newPriority
				});
			} else if (isMovingUp) {
				// Moving up: workflows between newPriority and oldPriority need to increment
				if (wf.priority >= newPriority && wf.priority < oldPriority) {
					const newPriorityValue = wf.priority + 1;
					updates.push({ workflowId: wf.id, priority: newPriorityValue });
					affectedWorkflows.push({
						workflow_id: wf.id,
						old_priority: wf.priority,
						new_priority: newPriorityValue
					});
				}
			} else {
				// Moving down: workflows between oldPriority and newPriority need to decrement
				if (wf.priority > oldPriority && wf.priority <= newPriority) {
					const newPriorityValue = wf.priority - 1;
					updates.push({ workflowId: wf.id, priority: newPriorityValue });
					affectedWorkflows.push({
						workflow_id: wf.id,
						old_priority: wf.priority,
						new_priority: newPriorityValue
					});
				}
			}
		}

		return { updates, affectedWorkflows };
	}

	/**
	 * Logs a priority change to the audit repository
	 */
	private async logPriorityChange(
		workflowId: string,
		oldPriority: number,
		newPriority: number,
		affectedWorkflows: Array<{ workflow_id: string; old_priority: number; new_priority: number }>,
		customerId: string,
		userId: string,
		trx: Knex.Transaction
	): Promise<void> {
		const otherWorkflowsCount = Math.max(0, affectedWorkflows.length - 1);
		await this.auditRepository.insertWorkflowChangeLog(
			{
				workflow_id: workflowId,
				version_id: undefined,
				change_type: WORKFLOW_CHANGE_TYPES.PRIORITY_CHANGED,
				change_description: `Workflow priority changed from ${oldPriority} to ${newPriority}, affecting ${otherWorkflowsCount} other workflows`,
				updated_by: userId,
				field_path: "data_workflows.priority",
				old_value: oldPriority.toString(),
				new_value: newPriority.toString(),
				note: JSON.stringify({
					affected_workflows: affectedWorkflows
				}),
				customer_id: customerId
			},
			trx
		);
	}

	/**
	 * Deletes all draft versions and their associated rules for a workflow
	 * @param workflowId - The workflow ID
	 * @param trx - Database transaction to ensure all deletions are atomic
	 */
	private async deleteWorkflowVersionsAndRules(workflowId: string, trx: Knex.Transaction): Promise<void> {
		const draftVersions = await this.versionRepository.getDraftVersions(workflowId);

		for (const version of draftVersions) {
			await this.ruleRepository.deleteRulesForVersionWithCount(version.id, trx);
			await this.versionRepository.deleteWorkflowVersionWithCount(version.id, trx);
		}
	}

	/**
	 * Reorders priorities after deleting a workflow by decrementing priorities of workflows with higher priority
	 */
	private async reorderPrioritiesAfterDeletion(
		customerId: string,
		deletedPriority: number,
		deletedWorkflowId: string,
		userId: string,
		trx: Knex.Transaction
	): Promise<void> {
		if (deletedPriority <= 0) {
			return;
		}

		const maxPriority = await this.workflowRepository.getMaxPriority(customerId, trx);

		if (maxPriority <= deletedPriority) {
			return;
		}

		const workflowsToReorder = await this.workflowRepository.getWorkflowsInPriorityRange(
			customerId,
			deletedPriority + 1,
			maxPriority,
			true,
			trx
		);

		if (workflowsToReorder.length === 0) {
			return;
		}

		const updates = workflowsToReorder.map(wf => ({
			workflowId: wf.id,
			priority: wf.priority - 1
		}));

		await this.workflowRepository.updateWorkflowPrioritiesBatch(updates, userId, trx);

		logger.info(
			`Reordered priorities for ${updates.length} workflows after deleting workflow ${deletedWorkflowId} with priority ${deletedPriority}`
		);
	}

	/**
	 * Changes the priority of a workflow and reorders other affected workflows
	 * @param workflowId - The workflow ID to change priority
	 * @param newPriority - The new priority value
	 * @param userInfo - User information for validation and audit logging
	 * @returns Promise with affected workflows and their priority changes
	 */
	async changePriority(
		workflowId: string,
		newPriority: number,
		userInfo: UserInfo
	): Promise<{
		workflow_id: string;
		affected_workflows: Array<{ workflow_id: string; old_priority: number; new_priority: number }>;
	}> {
		return await this.workflowRepository.transaction(async trx => {
			const validator = new ChangePriorityRequestValidator(this.workflowRepository);
			const validatedData = await validator.validate(workflowId, newPriority, userInfo, trx);

			const { workflow, newPriority: validatedPriority } = validatedData;
			const oldPriority = workflow.priority ?? 0;

			const affectedWorkflowsList = await this.getAffectedWorkflowsInPriorityRange(
				workflow.customer_id,
				oldPriority,
				validatedPriority,
				trx
			);

			this.validateWorkflowInPriorityRange(workflowId, oldPriority, affectedWorkflowsList);

			const { updates, affectedWorkflows } = this.calculatePriorityUpdates(
				workflowId,
				oldPriority,
				validatedPriority,
				affectedWorkflowsList
			);

			if (updates.length > 0) {
				await this.workflowRepository.updateWorkflowPrioritiesBatch(updates, userInfo.user_id, trx);
			}

			await this.logPriorityChange(
				workflowId,
				oldPriority,
				validatedPriority,
				affectedWorkflows,
				workflow.customer_id,
				userInfo.user_id,
				trx
			);

			logger.info(
				`Changed priority of workflow ${workflowId} from ${oldPriority} to ${validatedPriority}, affecting ${affectedWorkflows.length} workflows`
			);

			return {
				workflow_id: workflowId,
				affected_workflows: affectedWorkflows
			};
		});
	}

	/**
	 * Gets workflows list with pagination, filtering, searching, sorting, and enriched with customer names
	 * Uses validator for all business logic validation, then orchestrates repository calls and external service calls
	 * @param params - Query parameters for filtering, pagination, search, and sort
	 * @param userInfo - User information for access validation
	 * @returns Object containing workflows list with customer names and pagination metadata
	 */
	async getWorkflowsList(params: GetWorkflowsListParams, userInfo: UserInfo): Promise<GetWorkflowsListManagerResult> {
		try {
			logger.debug(`WorkflowManager: Getting workflows list for customer ${params.customerId}`, { params });

			// Use validator to handle all business logic validation
			const getWorkflowsListValidator = new GetWorkflowsListRequestValidator();
			const validatedData = await getWorkflowsListValidator.validate(params.customerId, params, userInfo);

			// Normalize pagination parameters (business logic - belongs in manager layer)
			const pagination = normalizePagination(validatedData.params);

			// Prepare repository params with normalized pagination
			const repositoryParams: GetWorkflowsListRepositoryParams = {
				customerId: validatedData.customerId,
				pagination,
				filter: validatedData.params.filter,
				search: validatedData.params.search
			};

			// Get workflows from repository (data access only - no business logic)
			const result = await this.workflowRepository.getWorkflowsList(repositoryParams);
			const workflowsToEnrich = result.workflows;

			// Extract unique customer IDs from workflows
			const customerIds: string[] = [...new Set(workflowsToEnrich.map(w => w.created_by))];

			// Fetch customer names from Auth Service (non-blocking - returns empty map on error)
			const customerNames = await this.authService.getCustomerNames(customerIds);

			// Enrich workflows with customer names
			// Version fields are returned separately for frontend to format as needed (e.g., with links)
			const enrichedWorkflows = workflowsToEnrich.map(workflow => ({
				id: workflow.id,
				name: workflow.name,
				description: workflow.description ?? "",
				priority: workflow.priority,
				cases: workflow.cases,
				published_version: workflow.published_version,
				draft_version: workflow.draft_version,
				status: workflow.status,
				created_by: workflow.created_by,
				created_by_name: customerNames[workflow.created_by],
				created_at: workflow.created_at.toISOString(),
				updated_at: workflow.updated_at?.toISOString()
			}));

			// Calculate totalPages
			const totalPages = calculateTotalPages(result.totalItems, pagination.itemsPerPage, pagination.usePagination);

			logger.debug(
				`WorkflowManager: Successfully retrieved ${enrichedWorkflows.length} workflows for customer ${validatedData.customerId}`
			);

			return {
				records: enrichedWorkflows,
				totalPages,
				totalItems: result.totalItems
			};
		} catch (error) {
			logger.error({ error }, `WorkflowManager: Error getting workflows list for customer ${params.customerId}`);
			// Re-throw ApiError from validator, wrap other errors
			if (error instanceof ApiError) {
				throw error;
			}
			throw new ApiError("Failed to get workflows list", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.UNKNOWN_ERROR);
		}
	}

	/**
	 * Gets a single workflow with all its details including version, trigger, and rules
	 * Prioritizes DRAFT version if exists, otherwise returns current PUBLISHED version
	 * @param workflowId - The workflow ID to retrieve
	 * @param userInfo - User information for access validation
	 * @returns Promise<WorkflowDetailsResult> - Complete workflow details
	 */
	async getWorkflowById(workflowId: string, userInfo: UserInfo): Promise<GetWorkflowByIdResponse> {
		try {
			logger.debug(`WorkflowManager: Getting workflow details for ${workflowId}`);

			// Use validator to handle all business logic validation (format, existence, access)
			const validator = new GetWorkflowByIdRequestValidator();
			await validator.validate(workflowId, userInfo);

			// Get workflow with full details from repository
			const details = await this.workflowRepository.getWorkflowWithDetails(workflowId);

			if (!details) {
				throw new ApiError(
					`Workflow with ID ${workflowId} not found or has no version`,
					StatusCodes.NOT_FOUND,
					ERROR_CODES.NOT_FOUND
				);
			}

			const { workflow, version, trigger, rules } = details;

			// Build response
			const result: GetWorkflowByIdResponse = {
				id: workflow.id,
				name: workflow.name,
				description: workflow.description ?? null,
				priority: workflow.priority ?? 0,
				active: workflow.active,
				created_at: workflow.created_at.toISOString(),
				updated_at: workflow.updated_at.toISOString(),
				current_version: {
					id: version.id,
					version_number: version.version_number,
					status: version.status as "draft" | "published",
					trigger_id: version.trigger_id,
					trigger: {
						id: trigger.id,
						name: trigger.name,
						conditions: trigger.conditions
					},
					default_action: version.default_action,
					rules: rules.map(rule => ({
						id: rule.id,
						name: rule.name,
						priority: rule.priority,
						conditions: rule.conditions,
						actions: rule.actions
					}))
				}
			};

			logger.debug(`WorkflowManager: Successfully retrieved workflow ${workflowId}`);

			return result;
		} catch (error) {
			logger.error({ error }, `WorkflowManager: Error getting workflow ${workflowId}`);
			// Re-throw ApiError from validator, wrap other errors
			if (error instanceof ApiError) {
				throw error;
			}
			throw new ApiError("Failed to get workflow", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.UNKNOWN_ERROR);
		}
	}

	/**
	 * Updates the active status of a workflow
	 * @param workflowId - The workflow ID to update
	 * @param active - The new active status (true/false)
	 * @param userInfo - User information for validation and audit logging
	 * @returns Promise with workflow_id and active status
	 */
	async updateWorkflowStatus(
		workflowId: string,
		active: boolean,
		userInfo: UserInfo
	): Promise<{ workflow_id: string; active: boolean }> {
		return await this.workflowRepository.transaction(async trx => {
			logger.debug(`Updating workflow ${workflowId} active status to ${active}`);

			const validator = new UpdateWorkflowStatusRequestValidator(this.workflowRepository, this.versionRepository);
			const validatedData = await validator.validate(workflowId, active, userInfo, trx);

			const { workflow } = validatedData;

			const versionId = await this.versionRepository.getCurrentPublishedVersionId(workflowId, trx);

			const oldStatus = workflow.active;
			await this.workflowRepository.updateWorkflowStatus(workflowId, active, userInfo.user_id, trx);

			if (oldStatus !== active) {
				const context = "data_workflows";
				await this.auditRepository.insertWorkflowChangeLog(
					{
						workflow_id: workflowId,
						version_id: versionId ?? undefined,
						change_type: WORKFLOW_CHANGE_TYPES.FIELD_CHANGED,
						change_description: `Workflow status changed from ${oldStatus ? "active" : "inactive"} to ${active ? "active" : "inactive"}`,
						updated_by: userInfo.user_id,
						field_path: `${context}.active`,
						old_value: oldStatus.toString(),
						new_value: active.toString(),
						customer_id: workflow.customer_id
					},
					trx
				);
			}

			logger.info(`Updated workflow ${workflowId} active status to ${active}`);

			return {
				workflow_id: workflowId,
				active
			};
		});
	}
}
