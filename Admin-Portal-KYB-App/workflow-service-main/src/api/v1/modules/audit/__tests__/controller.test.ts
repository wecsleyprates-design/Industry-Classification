import { auditManager } from "#core";
import { StatusCodes } from "http-status-codes";
import { SUCCESS_MESSAGES } from "#constants";
import type { Request, Response } from "express";
import type { UserInfo } from "#types/common";
import type { ExecutionWithWorkflowInfo } from "#core/audit/types";

const TEST_CUSTOMER_ID = "550e8400-e29b-41d4-a716-446655440000";
const TEST_CASE_ID = "660e8400-e29b-41d4-a716-446655440001";
const TEST_USER_ID = "770e8400-e29b-41d4-a716-446655440002";
const TEST_WORKFLOW_ID = "880e8400-e29b-41d4-a716-446655440003";

jest.mock("#core", () => ({
	auditManager: {
		exportExecutionLogs: jest.fn(),
		exportWorkflowChangesLogs: jest.fn(),
		getCaseExecutionDetails: jest.fn()
	}
}));

jest.mock("#core/validators/ExportAuditLogsRequestValidator", () => ({
	ExportAuditLogsRequestValidator: jest.fn().mockImplementation(() => ({
		validate: jest.fn().mockResolvedValue(undefined)
	}))
}));

const mockValidatorInstance = {
	validate: jest.fn()
};

jest.mock("#core/validators/GetCaseExecutionDetailsRequestValidator", () => ({
	GetCaseExecutionDetailsRequestValidator: jest.fn().mockImplementation(() => mockValidatorInstance)
}));

// Import controller after mock is set up
import { controller } from "../controller";

const mockAuditManager = auditManager as jest.Mocked<typeof auditManager>;

describe("Audit Controller", () => {
	let mockReq: Partial<Request>;
	let mockRes: Partial<Response>;
	let mockUserInfo: UserInfo;
	let mockNext: jest.Mock;

	beforeEach(() => {
		mockUserInfo = {
			user_id: TEST_USER_ID,
			email: "test@example.com",
			role: { id: 1, code: "admin" },
			given_name: "Test",
			family_name: "User",
			customer_id: TEST_CUSTOMER_ID
		};

		mockReq = {
			query: {},
			params: {
				customerId: TEST_CUSTOMER_ID
			}
		};

		mockRes = {
			setHeader: jest.fn(),
			status: jest.fn().mockReturnThis(),
			send: jest.fn(),
			jsend: {
				success: jest.fn()
			},
			locals: {
				user: mockUserInfo
			}
		} as unknown as Response;

		mockNext = jest.fn();
		jest.clearAllMocks();
	});

	describe("exportExecutionLogs", () => {
		it("should successfully export execution logs as CSV", async () => {
			const mockResult = {
				csvData: "case_id,workflow_id\ncase-1,workflow-1",
				filename: "execution_logs_2024-10-27T17-30-45.csv"
			};
			mockAuditManager.exportExecutionLogs.mockResolvedValue(mockResult);

			await controller.exportExecutionLogs(mockReq as Request, mockRes as Response, mockNext);

			expect(mockAuditManager.exportExecutionLogs).toHaveBeenCalledWith(
				{},
				expect.objectContaining({ customer_id: TEST_CUSTOMER_ID })
			);
			expect(mockRes.setHeader).toHaveBeenCalledWith("Content-Type", "text/csv; charset=utf-8");
			expect(mockRes.setHeader).toHaveBeenCalledWith(
				"Content-Disposition",
				`attachment; filename="${mockResult.filename}"`
			);
			expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.OK);
			expect(mockRes.send).toHaveBeenCalledWith(mockResult.csvData);
		});

		it("should handle workflow filter", async () => {
			const mockResult = {
				csvData: "case_id,workflow_id\ncase-1,workflow-123",
				filename: "execution_logs_2024-10-27T17-30-45.csv"
			};
			mockReq.query = { workflow_id: "workflow-123" };
			mockAuditManager.exportExecutionLogs.mockResolvedValue(mockResult);

			await controller.exportExecutionLogs(mockReq as Request, mockRes as Response, mockNext);

			expect(mockAuditManager.exportExecutionLogs).toHaveBeenCalledWith(
				{ workflowId: "workflow-123" },
				expect.objectContaining({ customer_id: TEST_CUSTOMER_ID })
			);
		});

		it("should handle date range filter", async () => {
			const mockResult = {
				csvData: "case_id,executed_at\ncase-1,2024-01-01",
				filename: "execution_logs_2024-10-27T17-30-45.csv"
			};
			mockReq.query = {
				start_date: "2024-01-01",
				end_date: "2024-12-31"
			};
			mockAuditManager.exportExecutionLogs.mockResolvedValue(mockResult);

			await controller.exportExecutionLogs(mockReq as Request, mockRes as Response, mockNext);

			expect(mockAuditManager.exportExecutionLogs).toHaveBeenCalledWith(
				{
					startDate: "2024-01-01",
					endDate: "2024-12-31"
				},
				expect.objectContaining({ customer_id: TEST_CUSTOMER_ID })
			);
		});
	});

	describe("exportWorkflowChangesLogs", () => {
		it("should successfully export workflow changes logs as CSV", async () => {
			const mockResult = {
				csvData: "workflow_id,field_path,created_at\nworkflow-1,rules,2024-01-01",
				filename: "workflow_changes_logs_2024-10-27T17-30-45.csv"
			};
			mockAuditManager.exportWorkflowChangesLogs.mockResolvedValue(mockResult);

			await controller.exportWorkflowChangesLogs(mockReq as Request, mockRes as Response, mockNext);

			expect(mockAuditManager.exportWorkflowChangesLogs).toHaveBeenCalledWith(
				{},
				expect.objectContaining({ customer_id: TEST_CUSTOMER_ID })
			);
			expect(mockRes.setHeader).toHaveBeenCalledWith("Content-Type", "text/csv; charset=utf-8");
			expect(mockRes.setHeader).toHaveBeenCalledWith(
				"Content-Disposition",
				`attachment; filename="${mockResult.filename}"`
			);
			expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.OK);
			expect(mockRes.send).toHaveBeenCalledWith(mockResult.csvData);
		});

		it("should handle filters", async () => {
			const mockResult = {
				csvData: "workflow_id,field_path\nworkflow-123,rules",
				filename: "workflow_changes_logs_2024-10-27T17-30-45.csv"
			};
			mockReq.query = {
				workflow_id: "workflow-123",
				start_date: "2024-01-01",
				end_date: "2024-12-31"
			};
			mockAuditManager.exportWorkflowChangesLogs.mockResolvedValue(mockResult);

			await controller.exportWorkflowChangesLogs(mockReq as Request, mockRes as Response, mockNext);

			expect(mockAuditManager.exportWorkflowChangesLogs).toHaveBeenCalledWith(
				{
					workflowId: "workflow-123",
					startDate: "2024-01-01",
					endDate: "2024-12-31"
				},
				expect.objectContaining({ customer_id: TEST_CUSTOMER_ID })
			);
		});
	});

	describe("getCaseExecutionDetails", () => {
		it("should successfully return case execution details", async () => {
			const mockExecution: ExecutionWithWorkflowInfo = {
				case_id: TEST_CASE_ID,
				workflow_version_id: "version-123",
				matched_rule_id: "rule-123",
				executed_at: new Date("2024-01-15T10:30:00Z"),
				input_attr: {},
				evaluation_log: {},
				latency_ms: 100,
				created_at: new Date("2024-01-15T10:30:00Z"),
				customer_id: TEST_CUSTOMER_ID,
				workflow_id: TEST_WORKFLOW_ID,
				action_applied: {},
				workflow_name: "Test Workflow",
				version_number: "1.0"
			};

			const mockResult = {
				workflows_evaluated: [
					{
						workflow_id: TEST_WORKFLOW_ID,
						name: "Test Workflow",
						version: "1.0",
						matched: true,
						rules: [
							{
								name: "Test Rule",
								matched: true,
								conditions: {
									passed: [
										{ name: "Credit Score", field: "facts.score", description: "Credit Score >= 700, and it was 750 ✓" }
									],
									failed: []
								}
							}
						]
					}
				],
				decision_type: "RULE_MATCHED" as const,
				action_applied: "AUTO APPROVED",
				generated_at: "2024-01-15T10:30:00.000Z"
			};

			mockReq.query = { case_id: TEST_CASE_ID };
			mockValidatorInstance.validate.mockResolvedValue({
				caseId: TEST_CASE_ID,
				execution: mockExecution,
				userInfo: mockUserInfo
			});
			mockAuditManager.getCaseExecutionDetails.mockResolvedValue(mockResult);

			await controller.getCaseExecutionDetails(mockReq as Request, mockRes as Response, mockNext);

			expect(mockValidatorInstance.validate).toHaveBeenCalledWith(TEST_CASE_ID, mockUserInfo);
			expect(mockAuditManager.getCaseExecutionDetails).toHaveBeenCalledWith(mockExecution);
			expect(mockRes.jsend?.success).toHaveBeenCalledWith(
				mockResult,
				SUCCESS_MESSAGES.CASE_EXECUTION_DETAILS_RETRIEVED,
				StatusCodes.OK
			);
		});

		it("should handle errors from auditManager", async () => {
			const mockExecution: ExecutionWithWorkflowInfo = {
				case_id: TEST_CASE_ID,
				workflow_version_id: "version-123",
				matched_rule_id: "rule-123",
				executed_at: new Date("2024-01-15T10:30:00Z"),
				input_attr: {},
				evaluation_log: {},
				latency_ms: 100,
				created_at: new Date("2024-01-15T10:30:00Z"),
				customer_id: TEST_CUSTOMER_ID,
				workflow_id: TEST_WORKFLOW_ID,
				action_applied: {},
				workflow_name: "Test Workflow",
				version_number: "1.0"
			};

			const error = new Error("Execution not found");
			mockReq.query = { case_id: TEST_CASE_ID };
			mockValidatorInstance.validate.mockResolvedValue({
				caseId: TEST_CASE_ID,
				execution: mockExecution,
				userInfo: mockUserInfo
			});
			mockAuditManager.getCaseExecutionDetails.mockRejectedValue(error);

			await controller.getCaseExecutionDetails(mockReq as Request, mockRes as Response, mockNext);

			expect(mockValidatorInstance.validate).toHaveBeenCalledWith(TEST_CASE_ID, mockUserInfo);
			expect(mockAuditManager.getCaseExecutionDetails).toHaveBeenCalledWith(mockExecution);
			expect(mockNext).toHaveBeenCalledWith(error);
		});
	});
});
