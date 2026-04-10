import { workflowManager, publishManager, previewEvaluationManager } from "#core";
import { catchAsync } from "#utils/catchAsync";
import { parseWorkflowsListQuery } from "#utils/queryParser";
import { StatusCodes } from "http-status-codes";
import { SUCCESS_MESSAGES, WORKFLOW_ERROR_CODES_COMBINED as ERROR_CODES } from "#constants";
import {
	type CreateWorkflowRequestWithBody,
	type PublishWorkflowRequestWithBody,
	type AddRulesRequestWithBody,
	type DeleteWorkflowRequestWithBody,
	type PreviewEvaluationRequestWithBody,
	type GetWorkflowsListRequest,
	type UpdateWorkflowStatusRequestWithBody,
	type GetWorkflowByIdRequest,
	type ChangePriorityRequestWithBody
} from "./types";
import type { GetWorkflowsResponse } from "#types/workflow-dtos";
import { type Request, type Response } from "express";
import { ApiError, UserInfo } from "#types/common";
import { UpdateWorkflowRequestWithBody } from "#core/versioning";

export const controller = {
	createWorkflow: catchAsync(async (req: Request, res: Response) => {
		const createWorkflowReq = req as CreateWorkflowRequestWithBody;
		const { name, description, trigger_id: triggerId, rules, default_action, auto_publish } = createWorkflowReq.body;
		const customerId = createWorkflowReq.params.customerId;
		const userInfo: UserInfo = res.locals.user as UserInfo;

		const result = await workflowManager.createWorkflow(
			{ name, description, trigger_id: triggerId, rules, default_action, auto_publish },
			customerId,
			userInfo
		);

		const message = auto_publish ? SUCCESS_MESSAGES.WORKFLOW_PUBLISHED : SUCCESS_MESSAGES.DRAFT_CREATED;
		res.jsend.success(result, message, StatusCodes.CREATED);
	}),

	addRules: catchAsync(async (req: Request, res: Response) => {
		const addRulesReq = req as AddRulesRequestWithBody;
		const workflowId = addRulesReq.params.id;
		if (!workflowId) {
			throw new ApiError("Workflow ID is required", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}
		const { rules } = addRulesReq.body;
		const userInfo: UserInfo = res.locals.user as UserInfo;

		const result = await workflowManager.addRules(workflowId, { rules }, userInfo);

		res.jsend.success(result, SUCCESS_MESSAGES.RULES_ADDED, StatusCodes.OK);
	}),

	updateWorkflow: catchAsync(async (req: Request, res: Response) => {
		const updateWorkflowReq = req as UpdateWorkflowRequestWithBody;
		const workflowId = updateWorkflowReq.params.id;
		const body = updateWorkflowReq.body;
		const userInfo: UserInfo = res.locals.user as UserInfo;

		if (!workflowId) {
			throw new ApiError("Workflow ID is required", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}

		const result = await workflowManager.updateWorkflow(workflowId, body, userInfo);

		const message = result.published_at ? SUCCESS_MESSAGES.WORKFLOW_PUBLISHED : SUCCESS_MESSAGES.WORKFLOW_UPDATED;

		res.jsend.success(
			{
				workflow_id: workflowId,
				requires_new_version: result.requiresNewVersion,
				changes: result.changes,
				published_at: result.published_at,
				message
			},
			message,
			StatusCodes.OK
		);
	}),

	publishWorkflow: catchAsync(async (req: Request, res: Response) => {
		const publishWorkflowReq = req as PublishWorkflowRequestWithBody;
		const versionId = publishWorkflowReq.params.id as string;
		const userInfo: UserInfo = res.locals.user as UserInfo;

		const result = await publishManager.publishWorkflow(versionId, userInfo);

		res.jsend.success(result, SUCCESS_MESSAGES.WORKFLOW_PUBLISHED, StatusCodes.OK);
	}),

	deleteDraftWorkflow: catchAsync(async (req: Request, res: Response) => {
		const deleteDraftWorkflowReq = req as DeleteWorkflowRequestWithBody;
		const workflowId = deleteDraftWorkflowReq.params.id;
		if (!workflowId) {
			throw new ApiError("Workflow ID is required", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}
		const userInfo: UserInfo = res.locals.user as UserInfo;

		const result = await workflowManager.deleteDraftWorkflow(workflowId, userInfo);

		res.jsend.success(result, result.message, StatusCodes.OK);
	}),

	previewEvaluation: catchAsync(async (req: Request, res: Response) => {
		const previewEvaluationReq = req as PreviewEvaluationRequestWithBody;
		const workflowId = previewEvaluationReq.params.id;
		const { case_id, business_id, sample_size } = previewEvaluationReq.body;
		const userInfo: UserInfo = res.locals.user as UserInfo;

		if (!workflowId) {
			throw new ApiError("Workflow ID is required", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}

		const result = await previewEvaluationManager.previewEvaluation(
			workflowId,
			{
				case_id,
				business_id,
				sample_size
			},
			userInfo
		);

		res.jsend.success(result, SUCCESS_MESSAGES.PREVIEW_EVALUATION, StatusCodes.OK);
	}),

	changePriority: catchAsync(async (req: Request, res: Response) => {
		const changePriorityReq = req as ChangePriorityRequestWithBody;
		const workflowId = changePriorityReq.params.id;
		const { priority } = changePriorityReq.body;
		const userInfo: UserInfo = res.locals.user as UserInfo;

		if (!workflowId) {
			throw new ApiError("Workflow ID is required", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}

		const result = await workflowManager.changePriority(workflowId, priority, userInfo);

		res.jsend.success(result, SUCCESS_MESSAGES.WORKFLOW_PRIORITY_CHANGED, StatusCodes.OK);
	}),

	getWorkflowsList: catchAsync(async (req: Request, res: Response) => {
		const getWorkflowsListReq = req as unknown as GetWorkflowsListRequest;
		const customerId = getWorkflowsListReq.params.customerId;
		const userInfo: UserInfo = res.locals.user as UserInfo;

		const query = getWorkflowsListReq.query;

		// Parse query parameters using utility function
		const parsedQuery = parseWorkflowsListQuery(query as Record<string, unknown>);

		// Get workflows list from manager
		const result = await workflowManager.getWorkflowsList(
			{
				customerId,
				...parsedQuery
			},
			userInfo
		);

		// Format response
		const response: GetWorkflowsResponse = {
			records: result.records,
			total_pages: result.totalPages,
			total_items: result.totalItems
		};

		res.jsend.success(response, SUCCESS_MESSAGES.WORKFLOWS_RETRIEVED, StatusCodes.OK);
	}),

	updateWorkflowStatus: catchAsync(async (req: Request, res: Response) => {
		const updateWorkflowStatusReq = req as UpdateWorkflowStatusRequestWithBody;
		const workflowId = updateWorkflowStatusReq.params.id;
		const { active } = updateWorkflowStatusReq.body;
		const userInfo: UserInfo = res.locals.user as UserInfo;

		if (!workflowId) {
			throw new ApiError("Workflow ID is required", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}

		const result = await workflowManager.updateWorkflowStatus(workflowId, active, userInfo);

		res.jsend.success(result, SUCCESS_MESSAGES.WORKFLOW_STATUS_UPDATED, StatusCodes.OK);
	}),

	getWorkflowById: catchAsync(async (req: Request, res: Response) => {
		const getWorkflowByIdReq = req as GetWorkflowByIdRequest;
		const workflowId = getWorkflowByIdReq.params.id as string;
		const userInfo: UserInfo = res.locals.user as UserInfo;

		const result = await workflowManager.getWorkflowById(workflowId, userInfo);

		res.jsend.success(result, SUCCESS_MESSAGES.WORKFLOW_RETRIEVED, StatusCodes.OK);
	})
};
