import { sharedRuleManager, monitoringEvaluationManager } from "#core";
import { catchAsync } from "#utils/catchAsync";
import { SUCCESS_MESSAGES } from "#constants";
import { StatusCodes } from "http-status-codes";
import { type Request, type Response } from "express";
import type {
	CreateSharedRuleRequest,
	CreateSharedRuleResponse,
	EvaluateRulesInput,
	EvaluateRulesResponse,
	GetSharedRuleDetailsBatchRequest,
	GetSharedRuleDetailsBatchResponse,
	SharedRuleDetailItem,
	UpdateSharedRuleRequest,
	UpdateSharedRuleResponse
} from "#types/workflow-dtos";

export const controller = {
	createRule: catchAsync(async (req: Request, res: Response) => {
		const body = req.body as CreateSharedRuleRequest;
		const createdBy = body.initiated_by_user_id;

		const result = await sharedRuleManager.createRule(
			{
				context_type: body.context_type,
				context_id: body.context_id,
				name: body.name,
				description: body.description ?? undefined,
				conditions: body.conditions
			},
			createdBy
		);

		const response: CreateSharedRuleResponse = {
			rule_id: result.rule_id,
			version_id: result.version_id
		};
		res.jsend.success(response, SUCCESS_MESSAGES.RULE_CREATED, StatusCodes.CREATED);
	}),

	updateRule: catchAsync(async (req: Request, res: Response) => {
		const ruleId = req.params.id;
		const body = req.body as UpdateSharedRuleRequest;
		const createdBy = body.initiated_by_user_id;

		const result = await sharedRuleManager.updateRule(ruleId, {
			name: body.name,
			description: body.description,
			conditions: body.conditions,
			created_by: createdBy
		});

		const response: UpdateSharedRuleResponse = {
			rule_id: ruleId,
			...(result.version_id !== undefined && { version_id: result.version_id }),
			...(result.version_number !== undefined && { version_number: result.version_number })
		};
		res.jsend.success(response, SUCCESS_MESSAGES.RULE_UPDATED, StatusCodes.OK);
	}),

	evaluateRules: catchAsync(async (req: Request, res: Response) => {
		const body = req.body as EvaluateRulesInput;
		const result: EvaluateRulesResponse = await monitoringEvaluationManager.evaluateRules(body);
		res.jsend.success(result, SUCCESS_MESSAGES.EVALUATION_COMPLETED, StatusCodes.OK);
	}),

	getRuleDetailsBatch: catchAsync(async (req: Request, res: Response) => {
		const body = req.body as GetSharedRuleDetailsBatchRequest;
		const batch = await sharedRuleManager.getRuleDetailsBatchByIds(body.rule_ids);
		const response: GetSharedRuleDetailsBatchResponse = {
			rules: batch.rules.map(r => ({
				rule_id: r.rule_id,
				name: r.name,
				description: r.description,
				latest_version_number: r.latest_version_number,
				conditions: r.conditions as SharedRuleDetailItem["conditions"],
				rule_created_at: r.rule_created_at.toISOString(),
				version_created_at: r.version_created_at.toISOString()
			})),
			missing_rule_ids: batch.missing_rule_ids
		};
		res.jsend.success(response, SUCCESS_MESSAGES.RULE_DETAILS_RETRIEVED, StatusCodes.OK);
	})
};
