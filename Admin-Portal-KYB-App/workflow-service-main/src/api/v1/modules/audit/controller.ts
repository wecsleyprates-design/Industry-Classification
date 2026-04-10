import { catchAsync } from "#utils/catchAsync";
import { StatusCodes } from "http-status-codes";
import { type Request, type Response } from "express";
import { UserInfo } from "#types/common";
import { auditManager } from "#core";
import { SUCCESS_MESSAGES } from "#constants";
import { ExportAuditLogsRequestValidator } from "#core/validators/ExportAuditLogsRequestValidator";
import { GetCaseExecutionDetailsRequestValidator } from "#core/validators/GetCaseExecutionDetailsRequestValidator";
import type {
	ExportExecutionLogsRequest,
	ExportWorkflowChangesLogsRequest,
	GetCaseExecutionDetailsRequest
} from "./types";

export const controller = {
	exportExecutionLogs: catchAsync(async (req: Request, res: Response) => {
		const executionLogsReq = req as unknown as ExportExecutionLogsRequest;
		const { customerId } = executionLogsReq.params;
		const query = executionLogsReq.query;
		const { workflow_id: workflowId, start_date: startDate, end_date: endDate } = query;
		const userInfo: UserInfo = res.locals.user as UserInfo;

		const exportAuditLogsValidator = new ExportAuditLogsRequestValidator();
		await exportAuditLogsValidator.validate(customerId, userInfo);

		const effectiveUserInfo = {
			...userInfo,
			customer_id: customerId
		};

		const { csvData, filename } = await auditManager.exportExecutionLogs(
			{
				workflowId,
				startDate,
				endDate
			},
			effectiveUserInfo
		);

		res.setHeader("Content-Type", "text/csv; charset=utf-8");
		res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
		res.status(StatusCodes.OK).send(csvData);
	}),

	exportWorkflowChangesLogs: catchAsync(async (req: Request, res: Response) => {
		const workflowChangesLogsReq = req as unknown as ExportWorkflowChangesLogsRequest;
		const { customerId } = workflowChangesLogsReq.params;
		const query = workflowChangesLogsReq.query;
		const { workflow_id: workflowId, start_date: startDate, end_date: endDate } = query;
		const userInfo: UserInfo = res.locals.user as UserInfo;

		const exportAuditLogsValidator = new ExportAuditLogsRequestValidator();
		await exportAuditLogsValidator.validate(customerId, userInfo);

		const effectiveUserInfo = {
			...userInfo,
			customer_id: customerId
		};

		const { csvData, filename } = await auditManager.exportWorkflowChangesLogs(
			{
				workflowId,
				startDate,
				endDate
			},
			effectiveUserInfo
		);

		res.setHeader("Content-Type", "text/csv; charset=utf-8");
		res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
		res.status(StatusCodes.OK).send(csvData);
	}),

	getCaseExecutionDetails: catchAsync(async (req: Request, res: Response) => {
		const caseExecutionDetailsReq = req as GetCaseExecutionDetailsRequest;
		const caseId: string = caseExecutionDetailsReq.query.case_id;
		const userInfo: UserInfo = res.locals.user as UserInfo;

		const getCaseExecutionDetailsValidator = new GetCaseExecutionDetailsRequestValidator();
		const validatedData = await getCaseExecutionDetailsValidator.validate(caseId, userInfo);

		const result = await auditManager.getCaseExecutionDetails(validatedData.execution);

		res.jsend.success(result, SUCCESS_MESSAGES.CASE_EXECUTION_DETAILS_RETRIEVED, StatusCodes.OK);
	})
};
