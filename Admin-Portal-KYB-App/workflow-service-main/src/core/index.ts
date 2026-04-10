import { PublishManager, PublishRepository } from "#core/publish";

export * from "./workflow";
export * from "./trigger";
export * from "./attributes";
export * from "./evaluators";
export * from "./actions";
export * from "#constants";

export { VersionManager, VersionRepository, VersionChangeDetector } from "./versioning";
export { RuleRepository } from "./rule";
export { SharedRuleRepository, SharedRuleVersionRepository, SharedRuleManager } from "./shared";

export type {
	CaseData,
	EventConfig,
	WorkflowAnnotations,
	CaseAttributeChangeEvent,
	WorkflowNotificationData,
	WorkflowNotificationResponse
} from "./types";

export type { Workflow, WorkflowWithTrigger } from "./workflow/types";
export type {
	WorkflowVersion,
	VersionChange,
	VersionCreationResult,
	WorkflowVersionWithRulesAndTriggerConditions
} from "./versioning/types";
export type { WorkflowAction, ActionType } from "./actions/types";
export type { WorkflowRule, RuleEvaluationResult, RuleEvaluationLog } from "./rule/types";

export type {
	JsonLogicTrigger,
	TriggerCondition,
	TriggerConditionGroup,
	TriggerConditions,
	WorkflowTrigger,
	TriggerEvaluationLog,
	WorkflowTriggerCarrier
} from "./trigger/types";

export type {
	WorkflowEvaluationLog,
	EvaluationLog,
	WorkflowExecutionResult,
	TypedWorkflowExecutionResult
} from "./evaluators/types";

// Create singleton instances for the application
import { WorkflowManager, WorkflowRepository } from "./workflow";
import { VersionRepository } from "./versioning";
import { RuleRepository } from "./rule";
import { AuditManager, AuditRepository } from "./audit";
import { TriggerManager, TriggerRepository } from "./trigger";
import { AttributeRepository } from "./attributes";
import { CaseService } from "#services/case";
import { AuthService } from "#services/auth";
import { PreviewEvaluationManager } from "./preview";
import { FactsManager } from "./facts";
import { SharedRuleRepository, SharedRuleVersionRepository, SharedRuleManager } from "./shared";
import { OrchestratorService } from "./orchestrator";
import { redis } from "#helpers/redis";
import { MonitoringEvaluationManager } from "./evaluators";

export { EVENT_TYPE_FACTS_READY, EVENT_TYPE_CASE_STATUS_UPDATED } from "./orchestrator";

export const workflowRepository = new WorkflowRepository();
export const versionRepository = new VersionRepository();
export const ruleRepository = new RuleRepository();
export const auditRepository = new AuditRepository();
export const attributeRepository = new AttributeRepository();
export const triggerRepository = new TriggerRepository({});
export const publishRepository = new PublishRepository();
export const caseService = new CaseService();
export const authService = new AuthService();
export const factsManager = new FactsManager(versionRepository);
export const publishManager = new PublishManager(publishRepository, auditRepository, versionRepository);
export const triggerManager = new TriggerManager(triggerRepository);
export const auditManager = new AuditManager(auditRepository);
export const workflowManager = new WorkflowManager(
	workflowRepository,
	versionRepository,
	ruleRepository,
	triggerRepository,
	auditRepository,
	caseService,
	authService,
	factsManager,
	publishManager
);
export const previewEvaluationManager = new PreviewEvaluationManager(
	workflowRepository,
	versionRepository,
	factsManager
);
export const sharedRuleRepository = new SharedRuleRepository();
export const sharedRuleVersionRepository = new SharedRuleVersionRepository();
export const sharedRuleManager = new SharedRuleManager(sharedRuleRepository, sharedRuleVersionRepository);
export const monitoringEvaluationManager = new MonitoringEvaluationManager(sharedRuleManager);
export const orchestratorService = new OrchestratorService(redis, caseService, workflowManager);
