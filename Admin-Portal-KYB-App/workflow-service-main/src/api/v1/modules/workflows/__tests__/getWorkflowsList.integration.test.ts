import request from "supertest";
import express from "express";
import { controller } from "../controller";
import { workflowManager } from "#core";
import { GetWorkflowsListRequestValidator } from "#core/validators";
import { jsend } from "#utils";
import { ROLES, ROLE_ID } from "#constants";
import type { UserInfo } from "#types/common";

jest.mock("#core", () => ({
	workflowManager: {
		getWorkflowsList: jest.fn()
	}
}));

jest.mock("#core/validators", () => ({
	GetWorkflowsListRequestValidator: jest.fn()
}));

jest.mock("#middlewares", () => ({
	validateUser: jest.fn(() => (req: any, res: any, next: any) => next()),
	validateQuerySchema: jest.fn(() => (req: any, res: any, next: any) => next())
}));

const mockedWorkflowManager = workflowManager as jest.Mocked<typeof workflowManager>;
const mockedGetWorkflowsListRequestValidator = GetWorkflowsListRequestValidator as jest.MockedClass<
	typeof GetWorkflowsListRequestValidator
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
		"/api/v1/customers/:customerId/workflows",
		(req, res, next) => next(), // validateUser mock
		(req, res, next) => next(), // validateQuerySchema mock
		controller.getWorkflowsList
	);

	// Add error handling middleware
	app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
		if (res.headersSent) {
			return next(err);
		}

		return res.status(500).json({
			status: "error",
			message: "Internal server error"
		});
	});

	return app;
};

describe("GET /api/v1/customers/:customerId/workflows - Integration Tests", () => {
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

	// Note: mockAdminUserInfo removed - authorization tests are now in GetWorkflowsListRequestValidator tests

	const mockWorkflows = [
		{
			id: "workflow-1",
			name: "Workflow 1",
			description: "Description 1",
			priority: 1,
			cases: 10,
			published_version: "1.0",
			draft_version: null,
			status: "active" as const,
			created_by: "user-1",
			created_by_name: "User One",
			created_at: "2024-01-15T10:30:00.000Z",
			updated_at: "2024-01-20T14:45:00.000Z"
		}
	];

	beforeEach(() => {
		jest.clearAllMocks();
		// Mock validator to return validated data without errors
		mockedGetWorkflowsListRequestValidator.mockImplementation(() => {
			return {
				validate: jest.fn().mockImplementation(async (customerId: string, params: any, userInfo: UserInfo) => {
					return {
						customerId,
						params,
						userInfo
					};
				})
			} as any;
		});
	});

	describe("Success cases", () => {
		it("should return workflows list successfully", async () => {
			const app = createTestApp(mockUserInfo);
			mockedWorkflowManager.getWorkflowsList.mockResolvedValue({
				records: mockWorkflows,
				totalPages: 1,
				totalItems: 1
			});

			const response = await request(app).get("/api/v1/customers/customer-123/workflows");

			expect(response.status).toBe(200);
			expect(response.body).toEqual({
				status: "success",
				message: "Workflows retrieved successfully",
				data: {
					records: mockWorkflows,
					total_pages: 1,
					total_items: 1
				}
			});

			expect(mockedWorkflowManager.getWorkflowsList).toHaveBeenCalledWith(
				{
					customerId: "customer-123"
				},
				mockUserInfo
			);
		});

		it("should handle pagination parameters", async () => {
			const app = createTestApp(mockUserInfo);
			mockedWorkflowManager.getWorkflowsList.mockResolvedValue({
				records: mockWorkflows,
				totalPages: 3,
				totalItems: 25
			});

			const response = await request(app).get("/api/v1/customers/customer-123/workflows?page=2&items_per_page=10");

			expect(response.status).toBe(200);
			expect(response.body.data.total_pages).toBe(3);
			expect(response.body.data.total_items).toBe(25);

			expect(mockedWorkflowManager.getWorkflowsList).toHaveBeenCalledWith(
				expect.objectContaining({
					customerId: "customer-123",
					page: 2,
					itemsPerPage: 10
				}),
				mockUserInfo
			);
		});

		it("should handle filter parameters", async () => {
			const app = createTestApp(mockUserInfo);
			mockedWorkflowManager.getWorkflowsList.mockResolvedValue({
				records: mockWorkflows,
				totalPages: 1,
				totalItems: 1
			});

			const response = await request(app).get("/api/v1/customers/customer-123/workflows?filter[status]=active");

			expect(response.status).toBe(200);
			expect(mockedWorkflowManager.getWorkflowsList).toHaveBeenCalledWith(
				expect.objectContaining({
					customerId: "customer-123",
					filter: {
						status: "active"
					}
				}),
				mockUserInfo
			);
		});

		it("should handle search parameters", async () => {
			const app = createTestApp(mockUserInfo);
			mockedWorkflowManager.getWorkflowsList.mockResolvedValue({
				records: mockWorkflows,
				totalPages: 1,
				totalItems: 1
			});

			const response = await request(app).get("/api/v1/customers/customer-123/workflows?search[name]=workflow");

			expect(response.status).toBe(200);
			expect(mockedWorkflowManager.getWorkflowsList).toHaveBeenCalledWith(
				expect.objectContaining({
					customerId: "customer-123",
					search: {
						name: "workflow"
					}
				}),
				mockUserInfo
			);
		});

		it("should handle pagination=false", async () => {
			const app = createTestApp(mockUserInfo);
			mockedWorkflowManager.getWorkflowsList.mockResolvedValue({
				records: mockWorkflows,
				totalPages: 1,
				totalItems: 1
			});

			const response = await request(app).get("/api/v1/customers/customer-123/workflows?pagination=false");

			expect(response.status).toBe(200);
			expect(mockedWorkflowManager.getWorkflowsList).toHaveBeenCalledWith(
				expect.objectContaining({
					customerId: "customer-123",
					pagination: false
				}),
				mockUserInfo
			);
		});

		it("should handle multiple query parameters", async () => {
			const app = createTestApp(mockUserInfo);
			mockedWorkflowManager.getWorkflowsList.mockResolvedValue({
				records: mockWorkflows,
				totalPages: 2,
				totalItems: 15
			});

			const response = await request(app).get(
				"/api/v1/customers/customer-123/workflows?page=1&items_per_page=10&filter[status]=active&search[name]=test"
			);

			expect(response.status).toBe(200);
			expect(mockedWorkflowManager.getWorkflowsList).toHaveBeenCalledWith(
				expect.objectContaining({
					customerId: "customer-123",
					page: 1,
					itemsPerPage: 10,
					filter: {
						status: "active"
					},
					search: {
						name: "test"
					}
				}),
				mockUserInfo
			);
		});
	});

	// Note: Authorization tests are now in GetWorkflowsListRequestValidator tests

	describe("Error handling", () => {
		it("should handle manager errors", async () => {
			const app = createTestApp(mockUserInfo);
			mockedWorkflowManager.getWorkflowsList.mockRejectedValue(new Error("Internal server error"));

			const response = await request(app).get("/api/v1/customers/customer-123/workflows");

			expect(response.status).toBe(500);
		});
	});
});
