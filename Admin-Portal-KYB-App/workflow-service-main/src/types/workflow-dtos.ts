/**
 * Centralized re-exports of DTOs from @joinworth/types
 * Import from here instead of using z.infer<> directly in each file
 */

import { Workflows, Cases } from "@joinworth/types";

export type GetCaseExecutionDetailsResponse = Workflows.Audits.GetCaseExecutionDetailsResponse;

export type ExportExecutionLogsQuery = Workflows.Audits.ExportExecutionLogsQuery;
export type ExportWorkflowChangesLogsQuery = Workflows.Audits.ExportWorkflowChangesLogsQuery;
export type GetCaseExecutionDetailsQuery = Workflows.Audits.GetCaseExecutionDetailsQuery;

export type GetWorkflowsListQuery = Workflows.Workflows.GetWorkflowsListQuery;
export type CreateWorkflowRequest = Workflows.Workflows.CreateWorkflowRequest;
export type CreateWorkflowResponse = Workflows.Workflows.CreateWorkflowResponse;
export type AddRulesRequest = Workflows.Workflows.AddRulesRequest;
export type AddRulesResponse = Workflows.Workflows.AddRulesResponse;
export type PublishWorkflowResponse = Workflows.Workflows.PublishWorkflowResponse;
export type WorkflowRuleRequest = Workflows.Workflows.WorkflowRuleRequest;
export type WorkflowActionRequest = Workflows.Workflows.WorkflowActionRequest;
export type UpdateWorkflowStatusRequest = Workflows.Workflows.UpdateWorkflowStatusRequest;
export type UpdateWorkflowStatusResponse = Workflows.Workflows.UpdateWorkflowStatusResponse;
export type WorkflowListItem = Workflows.Workflows.WorkflowListItem;
export type GetWorkflowsResponse = Workflows.Workflows.GetWorkflowsResponse;
export type GetWorkflowByIdTrigger = Workflows.Workflows.GetWorkflowByIdTrigger;
export type GetWorkflowByIdRule = Workflows.Workflows.GetWorkflowByIdRule;
export type GetWorkflowByIdCurrentVersion = Workflows.Workflows.GetWorkflowByIdCurrentVersion;
export type GetWorkflowByIdResponse = Workflows.Workflows.GetWorkflowByIdResponse;

export type PreviewEvaluationRequest = Workflows.Previews.PreviewEvaluationRequest;
export type PreviewEvaluationResponse = Workflows.Previews.PreviewEvaluationResponse;
export type PreviewEvaluationResult = Workflows.Previews.PreviewEvaluationResult;
export type PreviewEvaluationLog = Workflows.Previews.PreviewEvaluationLog;
export type PreviewBusinessResult = Workflows.Previews.PreviewBusinessResult;

export type WorkflowVersionResponse = Workflows.Versions.WorkflowVersionResponse;
export type VersionStatus = Workflows.Versions.VersionStatus;

export type TriggerCondition = Workflows.Conditions.TriggerCondition;
export type TriggerConditionGroup = Workflows.Conditions.TriggerConditionGroup;
export type TriggerConditions = Workflows.Conditions.TriggerConditions;
export type TriggerResponse = Workflows.Triggers.TriggerResponse;
export type GetTriggersResponse = Workflows.Triggers.GetTriggersResponse;

export type GetAttributeCatalogQuery = Workflows.Attributes.GetAttributeCatalogQuery;
export type AttributeCatalogItem = Workflows.Attributes.AttributeCatalogItem;
export type GetAttributeCatalogResponse = Workflows.Attributes.GetAttributeCatalogResponse;

export type CustomFieldsSummaryResponse = Cases.CustomFields.GetCustomFieldsSummaryResponse;

export type CreateSharedRuleRequest = Workflows.Shared.Rules.CreateSharedRuleRequest;
export type CreateSharedRuleResponse = Workflows.Shared.Rules.CreateSharedRuleResponse;
export type UpdateSharedRuleRequest = Workflows.Shared.Rules.UpdateSharedRuleRequest;
export type UpdateSharedRuleResponse = Workflows.Shared.Rules.UpdateSharedRuleResponse;

export type EvaluateRulesInput = Workflows.Shared.Evaluations.EvaluateRulesInput;
export type EvaluationState = Workflows.Shared.Evaluations.EvaluationState;
export type ConditionEvaluationDetail = Workflows.Shared.Evaluations.ConditionEvaluationDetail;
export type RuleEvaluationResultItem = Workflows.Shared.Evaluations.RuleEvaluationResultItem;
export type EvaluateRulesResponse = Workflows.Shared.Evaluations.EvaluateRulesResponse;
export type SharedRulesEvaluationKafkaPayload = Workflows.Shared.Evaluations.SharedRulesEvaluationKafkaPayload;
export type SharedRulesEvaluationKafkaRuleRow = Workflows.Shared.Evaluations.SharedRulesEvaluationKafkaRuleRow;

export type GetSharedRuleDetailsBatchRequest = Workflows.Shared.Rules.GetSharedRuleDetailsBatchRequest;
export type GetSharedRuleDetailsBatchResponse = Workflows.Shared.Rules.GetSharedRuleDetailsBatchResponse;
export type SharedRuleDetailItem = Workflows.Shared.Rules.SharedRuleDetailItem;
