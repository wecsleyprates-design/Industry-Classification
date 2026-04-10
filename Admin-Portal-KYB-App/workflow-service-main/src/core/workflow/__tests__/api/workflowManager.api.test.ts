import { controller } from "#api/v1/modules/workflows/controller";
import { workflowManager } from "#core";
import { StatusCodes } from "http-status-codes";
import { type CreateWorkflowRequestWithBody } from "#api/v1/modules/workflows/types";
import { type Response } from "express";

// Mock the workflowManager
jest.mock("#core", () => ({
	workflowManager: {
		createWorkflow: jest.fn(),
		addRules: jest.fn()
	}
}));

jest.mock("#helpers/logger", () => ({
	logger: {
		info: jest.fn(),
		error: jest.fn(),
		warn: jest.fn()
	}
}));

jest.mock("uuid", () => ({
	v4: jest.fn(() => "mock-uuid-123")
}));

describe("Workflow Controller", () => {
	let mockCreateReq: Partial<CreateWorkflowRequestWithBody>;
	let mockRes: Partial<Response>;
	let mockNext: jest.Mock;

	beforeEach(() => {
		// Reset mocks
		(workflowManager.createWorkflow as jest.Mock).mockClear();
		(workflowManager.addRules as jest.Mock).mockClear();

		mockCreateReq = {
			body: {
				name: "Test Workflow",
				description: "Test workflow description",
				trigger_id: "123e4567-e89b-12d3-a456-426614174000"
			},
			params: {
				customerId: "customer-123"
			}
		};

		mockRes = {
			locals: {
				user: {
					user_id: "user-123",
					email: "test@example.com",
					role: {
						id: 1,
						code: "ADMIN"
					},
					given_name: "Test",
					family_name: "User",
					customer_id: "customer-123"
				}
			},
			jsend: {
				success: jest.fn(),
				fail: jest.fn(),
				error: jest.fn()
			}
		};

		mockNext = jest.fn();

		jest.clearAllMocks();
	});

	describe("createWorkflowDraft", () => {
		it("should successfully create workflow draft with valid data", async () => {
			const mockCreateResponse = {
				workflow_id: "workflow-123",
				draft_version_id: "version-456",
				message: "Workflow draft created successfully"
			};

			(workflowManager.createWorkflow as jest.Mock).mockResolvedValue(mockCreateResponse);

			await controller.createWorkflow(mockCreateReq as CreateWorkflowRequestWithBody, mockRes as Response, mockNext);

			expect(workflowManager.createWorkflow).toHaveBeenCalledWith(
				{
					name: "Test Workflow",
					description: "Test workflow description",
					trigger_id: "123e4567-e89b-12d3-a456-426614174000"
				},
				"customer-123",
				mockRes.locals?.user
			);

			expect(mockRes.jsend?.success).toHaveBeenCalledWith(
				mockCreateResponse,
				"Workflow draft created successfully",
				StatusCodes.CREATED
			);

			expect(mockNext).not.toHaveBeenCalled();
		});

		it("should create workflow draft with minimal required data", async () => {
			const minimalReq = {
				body: {
					name: "Minimal Workflow"
				},
				params: {
					customerId: "customer-123"
				}
			};

			const mockCreateResponse = {
				workflow_id: "workflow-789",
				draft_version_id: "version-101",
				message: "Workflow draft created successfully"
			};

			(workflowManager.createWorkflow as jest.Mock).mockResolvedValue(mockCreateResponse);

			await controller.createWorkflow(minimalReq as CreateWorkflowRequestWithBody, mockRes as Response, mockNext);

			expect(workflowManager.createWorkflow).toHaveBeenCalledWith(
				{
					name: "Minimal Workflow",
					description: undefined,
					trigger_id: undefined
				},
				"customer-123",
				mockRes.locals?.user
			);

			expect(mockRes.jsend?.success).toHaveBeenCalledWith(
				mockCreateResponse,
				"Workflow draft created successfully",
				StatusCodes.CREATED
			);
		});

		it("should call next with error when WorkflowService.createWorkflowDraft throws", async () => {
			const error = new Error("Database connection failed");
			(workflowManager.createWorkflow as jest.Mock).mockRejectedValue(error);

			await controller.createWorkflow(mockCreateReq as CreateWorkflowRequestWithBody, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalledWith(error);
			expect(mockRes.jsend?.success).not.toHaveBeenCalled();
		});

		it("should extract correct data from request body and user info", async () => {
			const mockCreateResponse = {
				workflow_id: "workflow-999",
				draft_version_id: "version-888",
				message: "Workflow draft created successfully"
			};

			(workflowManager.createWorkflow as jest.Mock).mockResolvedValue(mockCreateResponse);

			await controller.createWorkflow(mockCreateReq as CreateWorkflowRequestWithBody, mockRes as Response, mockNext);

			expect(workflowManager.createWorkflow).toHaveBeenCalledWith(
				{
					name: (mockCreateReq.body as { name: string }).name,
					description: (mockCreateReq.body as { description?: string }).description,
					trigger_id: (mockCreateReq.body as { trigger_id?: string }).trigger_id
				},
				"customer-123",
				(mockRes as { locals: { user: unknown } }).locals.user
			);
		});

		it("should handle workflow creation with description", async () => {
			const withDescriptionReq = {
				body: {
					name: "High Priority Workflow",
					description: "This is a high priority workflow"
				},
				params: {
					customerId: "customer-123"
				}
			};

			const mockCreateResponse = {
				workflow_id: "workflow-priority",
				draft_version_id: "version-priority",
				message: "Workflow draft created successfully"
			};

			(workflowManager.createWorkflow as jest.Mock).mockResolvedValue(mockCreateResponse);

			await controller.createWorkflow(
				withDescriptionReq as CreateWorkflowRequestWithBody,
				mockRes as Response,
				mockNext
			);

			expect(workflowManager.createWorkflow).toHaveBeenCalledWith(
				{
					name: "High Priority Workflow",
					description: "This is a high priority workflow",
					trigger_id: undefined
				},
				"customer-123",
				mockRes.locals?.user
			);
		});

		it("should handle workflow creation with trigger_id", async () => {
			const reqWithTrigger = {
				body: {
					name: "Workflow with Trigger",
					trigger_id: "628e1991-bf73-4027-924c-cacde8948839"
				},
				params: {
					customerId: "customer-123"
				}
			};

			const mockCreateResponse = {
				workflow_id: "workflow-trigger-123",
				version_id: "version-trigger-456",
				message: "Workflow draft created successfully"
			};

			(workflowManager.createWorkflow as jest.Mock).mockResolvedValue(mockCreateResponse);

			await controller.createWorkflow(reqWithTrigger as CreateWorkflowRequestWithBody, mockRes as Response, mockNext);

			expect(workflowManager.createWorkflow).toHaveBeenCalledWith(
				{
					name: "Workflow with Trigger",
					description: undefined,
					trigger_id: "628e1991-bf73-4027-924c-cacde8948839"
				},
				"customer-123",
				mockRes.locals?.user
			);

			expect(mockRes.jsend?.success).toHaveBeenCalledWith(
				mockCreateResponse,
				"Workflow draft created successfully",
				StatusCodes.CREATED
			);

			expect(mockNext).not.toHaveBeenCalled();
		});
	});
});
