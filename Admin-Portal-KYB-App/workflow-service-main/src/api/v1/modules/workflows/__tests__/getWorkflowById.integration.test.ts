import request from "supertest";
import express from "express";
import { controller } from "../controller";
import { workflowManager } from "#core";
import { GetWorkflowByIdRequestValidator } from "#core/validators";
import { jsend } from "#utils";
import { ROLES, ROLE_ID, ACTION_TYPES } from "#constants";
import type { UserInfo } from "#types/common";
import { ApiError } from "#types/common";
import { StatusCodes } from "http-status-codes";
import type { WorkflowAction } from "#core/actions/types";

jest.mock("#core", () => ({
	workflowManager: {
		getWorkflowById: jest.fn()
	}
}));

jest.mock("#core/validators", () => ({
	GetWorkflowByIdRequestValidator: jest.fn()
}));

jest.mock("#middlewares", () => ({
	validateUser: jest.fn(() => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next()),
	validateIdParam: jest.fn(() => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next())
}));

const mockedWorkflowManager = workflowManager as jest.Mocked<typeof workflowManager>;
const mockedGetWorkflowByIdRequestValidator = GetWorkflowByIdRequestValidator as jest.MockedClass<
	typeof GetWorkflowByIdRequestValidator
>;

const createTestApp = (userInfo: UserInfo) => {
	const app = express();
	app.use(express.json());
	app.use(jsend());

	// Mock middleware to set user info
	app.use((req, res, next) => {
		res.locals = { user: userInfo };
		next();
	});

	// Add the route with mocked middleware
	app.get(
		"/api/v1/workflows/:id",
		(req, res, next) => next(), // validateUser mock
		(req, res, next) => next(), // validateIdParam mock
		controller.getWorkflowById
	);

	// Add error handling middleware
	app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
		if (res.headersSent) {
			return next(err);
		}

		if (err instanceof ApiError) {
			return res.status(err.status).json({
				status: err.status >= 500 ? "error" : "fail",
				message: err.message,
				errorCode: err.errorCode
			});
		}

		return res.status(500).json({
			status: "error",
			message: "Internal server error"
		});
	});

	return app;
};

describe("GET /api/v1/workflows/:id - Integration Tests", () => {
	const mockUserInfo: UserInfo = {
		user_id: "user-123",
		email: "user@example.com",
		given_name: "Test",
		family_name: "User",
		customer_id: "customer-123",
		role: {
			id: ROLE_ID.CUSTOMER,
			code: ROLES.CUSTOMER
		}
	};

	const mockAdminUserInfo: UserInfo = {
		user_id: "admin-123",
		email: "admin@example.com",
		given_name: "Admin",
		family_name: "User",
		customer_id: "customer-123",
		role: {
			id: ROLE_ID.ADMIN,
			code: ROLES.ADMIN
		}
	};

	const mockWorkflowDetails = {
		id: "workflow-123",
		name: "Test Workflow",
		description: "Test workflow description",
		priority: 1,
		active: true,
		created_at: "2024-01-15T10:30:00Z",
		updated_at: "2024-01-20T14:45:00Z",
		current_version: {
			id: "version-123",
			version_number: 1,
			status: "draft" as const,
			trigger_id: "trigger-123",
			trigger: {
				id: "trigger-123",
				name: "SUBMITTED",
				conditions: { "==": [{ var: "status.code" }, "SUBMITTED"] }
			},
			default_action: {
				type: ACTION_TYPES.SET_FIELD,
				parameters: { field: "case.status", value: "AUTO_APPROVED" }
			} as WorkflowAction,
			rules: [
				{
					id: "rule-123",
					name: "High Risk Rule",
					priority: 1,
					conditions: {
						operator: "AND",
						conditions: [{ field: "facts.mcc_code", operator: "=", value: "1234" }]
					},
					actions: [
						{
							type: ACTION_TYPES.SET_FIELD,
							parameters: { field: "case.status", value: "UNDER_MANUAL_REVIEW" }
						} as WorkflowAction
					]
				}
			]
		}
	};

	beforeEach(() => {
		jest.clearAllMocks();
		// Mock validator to return validated data without errors
		mockedGetWorkflowByIdRequestValidator.mockImplementation(() => {
			return {
				validate: jest.fn().mockImplementation(async (workflowId: string, userInfo: UserInfo) => {
					return {
						workflowId,
						workflow: { id: workflowId, customer_id: userInfo.customer_id },
						userInfo
					};
				})
			} as unknown as GetWorkflowByIdRequestValidator;
		});
	});

	describe("Success cases", () => {
		it("should return workflow details successfully", async () => {
			const app = createTestApp(mockUserInfo);
			mockedWorkflowManager.getWorkflowById.mockResolvedValue(mockWorkflowDetails);

			const response = await request(app).get("/api/v1/workflows/workflow-123");

			expect(response.status).toBe(200);
			expect(response.body).toEqual({
				status: "success",
				message: "Workflow retrieved successfully",
				data: mockWorkflowDetails
			});

			expect(mockedWorkflowManager.getWorkflowById).toHaveBeenCalledWith("workflow-123", mockUserInfo);
		});

		it("should return workflow with DRAFT version when exists", async () => {
			const app = createTestApp(mockUserInfo);
			const draftWorkflow = {
				...mockWorkflowDetails,
				current_version: {
					...mockWorkflowDetails.current_version,
					status: "draft" as const,
					version_number: 2
				}
			};
			mockedWorkflowManager.getWorkflowById.mockResolvedValue(draftWorkflow);

			const response = await request(app).get("/api/v1/workflows/workflow-123");

			expect(response.status).toBe(200);
			expect(response.body.data.current_version.status).toBe("draft");
			expect(response.body.data.current_version.version_number).toBe(2);
		});

		it("should return workflow with PUBLISHED version when no DRAFT exists", async () => {
			const app = createTestApp(mockUserInfo);
			const publishedWorkflow = {
				...mockWorkflowDetails,
				current_version: {
					...mockWorkflowDetails.current_version,
					status: "published" as const
				}
			};
			mockedWorkflowManager.getWorkflowById.mockResolvedValue(publishedWorkflow);

			const response = await request(app).get("/api/v1/workflows/workflow-123");

			expect(response.status).toBe(200);
			expect(response.body.data.current_version.status).toBe("published");
		});

		it("should return workflow with no rules", async () => {
			const app = createTestApp(mockUserInfo);
			const workflowNoRules = {
				...mockWorkflowDetails,
				current_version: {
					...mockWorkflowDetails.current_version,
					rules: []
				}
			};
			mockedWorkflowManager.getWorkflowById.mockResolvedValue(workflowNoRules);

			const response = await request(app).get("/api/v1/workflows/workflow-123");

			expect(response.status).toBe(200);
			expect(response.body.data.current_version.rules).toEqual([]);
		});

		it("should return workflow with null default_action", async () => {
			const app = createTestApp(mockUserInfo);
			const workflowNoDefaultAction = {
				...mockWorkflowDetails,
				current_version: {
					...mockWorkflowDetails.current_version,
					default_action: null
				}
			};
			mockedWorkflowManager.getWorkflowById.mockResolvedValue(workflowNoDefaultAction);

			const response = await request(app).get("/api/v1/workflows/workflow-123");

			expect(response.status).toBe(200);
			expect(response.body.data.current_version.default_action).toBeNull();
		});

		it("should allow admin to access any workflow", async () => {
			const app = createTestApp(mockAdminUserInfo);
			mockedWorkflowManager.getWorkflowById.mockResolvedValue(mockWorkflowDetails);

			const response = await request(app).get("/api/v1/workflows/workflow-123");

			expect(response.status).toBe(200);
			expect(mockedWorkflowManager.getWorkflowById).toHaveBeenCalledWith("workflow-123", mockAdminUserInfo);
		});
	});

	describe("Error handling", () => {
		it("should return 404 when workflow not found", async () => {
			const app = createTestApp(mockUserInfo);
			mockedWorkflowManager.getWorkflowById.mockRejectedValue(
				new ApiError("Workflow with ID workflow-123 not found", StatusCodes.NOT_FOUND, "NOT_FOUND")
			);

			const response = await request(app).get("/api/v1/workflows/workflow-123");

			expect(response.status).toBe(404);
			expect(response.body.message).toContain("not found");
		});

		it("should return 403 when user does not have access", async () => {
			const app = createTestApp(mockUserInfo);
			mockedWorkflowManager.getWorkflowById.mockRejectedValue(
				new ApiError(
					"Access denied. You are not authorized to access this workflow.",
					StatusCodes.FORBIDDEN,
					"UNAUTHORIZED"
				)
			);

			const response = await request(app).get("/api/v1/workflows/workflow-123");

			expect(response.status).toBe(403);
			expect(response.body.message).toContain("Access denied");
		});

		it("should return 400 when workflow ID is invalid UUID", async () => {
			const app = createTestApp(mockUserInfo);
			mockedWorkflowManager.getWorkflowById.mockRejectedValue(
				new ApiError("Workflow ID must be a valid UUID format", StatusCodes.BAD_REQUEST, "INVALID")
			);

			const response = await request(app).get("/api/v1/workflows/invalid-uuid");

			expect(response.status).toBe(400);
			expect(response.body.message).toContain("UUID");
		});

		it("should return 500 on internal server error", async () => {
			const app = createTestApp(mockUserInfo);
			mockedWorkflowManager.getWorkflowById.mockRejectedValue(new Error("Database connection failed"));

			const response = await request(app).get("/api/v1/workflows/workflow-123");

			expect(response.status).toBe(500);
		});
	});
});
