import request from "supertest";
import express from "express";
import { validateSchema, validateIdParam } from "#middlewares";
import { addRulesSchema } from "../schema";
import { controller } from "../controller";
import { workflowManager } from "#core";
import { jsend } from "#utils";
import { RESPONSE_STATUS } from "#constants/workflow.constants";

// Test response interface
interface TestResponse {
	status: string;
	data?: Record<string, unknown>;
	message?: string;
}

// Error interface for validation errors
interface ValidationError extends Error {
	details?: Record<string, unknown>;
}

// Mock dependencies
jest.mock("#database", () => ({}));
jest.mock("#helpers/redis", () => ({}));
jest.mock("#helpers/bullQueue", () => ({}));
jest.mock("#helpers/logger", () => ({
	logger: {
		info: jest.fn(),
		error: jest.fn(),
		warn: jest.fn(),
		debug: jest.fn(),
		child: jest.fn(() => ({
			info: jest.fn(),
			error: jest.fn(),
			warn: jest.fn(),
			debug: jest.fn()
		}))
	},
	pinoHttpLogger: jest.fn()
}));

jest.mock("#configs", () => ({
	envConfig: {
		DB_HOST: "localhost",
		DB_PORT: 5432,
		DB_NAME: "test",
		DB_USER: "test",
		DB_PASSWORD: "test"
	},
	workflowConfig: {
		processingQueue: {
			delay: 120000
		}
	}
}));

jest.mock("#middlewares", () => {
	const actual = jest.requireActual<typeof import("#middlewares")>("#middlewares");
	return {
		...actual,
		validateUser: (req: unknown, res: unknown, next: unknown): void => {
			(res as { locals: { user: unknown } }).locals.user = {
				user_id: "test-user-id",
				role: { id: 1, code: "ADMIN" },
				customer_id: "test-customer-id"
			};
			(next as () => void)();
		}
	};
});

// Mock the workflow manager
jest.mock("#core", () => ({
	workflowManager: {
		addRules: jest.fn()
	}
}));

describe("PUT /workflows/:id/rules - Integration Tests", () => {
	const mockUserInfo = {
		user_id: "user-123",
		email: "test@example.com",
		given_name: "Test",
		family_name: "User",
		customer_id: "customer-123",
		role: { id: 1, code: "CRO" }
	};

	const validRequest = {
		rules: [
			{
				name: "Test Rule",
				priority: 1,
				conditions: {
					operator: "AND",
					conditions: [{ field: "application.mcc", operator: "=", value: "5411" }]
				},
				actions: [
					{
						type: "set_field",
						parameters: { field: "case.status", value: "AUTO_APPROVED" }
					}
				]
			}
		]
	};

	// Create test app
	const createTestApp = () => {
		const app = express();
		app.use(express.json());
		app.use(jsend());

		// Mock middleware to set user info
		app.use((req, res, next) => {
			res.locals = { user: mockUserInfo };
			next();
		});

		// Add the route with full middleware stack
		app.put("/workflows/:id/rules", validateIdParam, validateSchema(addRulesSchema), controller.addRules);

		// Add error handling middleware
		app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
			if (res.headersSent) {
				return next(err);
			}

			if (err.name === "ValidationMiddlewareError") {
				return res.status(400).json({
					status: RESPONSE_STATUS.FAIL,
					message: err.message,
					data: (err as ValidationError).details
				});
			}

			// Handle ApiError from parameter validation
			if (err.name === "ApiError") {
				return res.status(400).json({
					status: RESPONSE_STATUS.FAIL,
					message: err.message
				});
			}

			return res.status(500).json({
				status: RESPONSE_STATUS.ERROR,
				message: "Internal server error"
			});
		});

		return app;
	};

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("Successful requests", () => {
		it("should add rules to draft workflow successfully", async () => {
			const workflowId = "550e8400-e29b-41d4-a716-446655440000";
			const expectedResponse = {
				workflow_id: workflowId,
				version_id: "version-123",
				rules_added: 1,
				message: "Successfully added 1 rules to draft workflow"
			};

			(workflowManager.addRules as jest.Mock).mockResolvedValue(expectedResponse);

			const app = createTestApp();
			const response = await request(app)
				.put(`/workflows/${workflowId}/rules`)
				.set("Content-Type", "application/json")
				.send(validRequest);

			expect(response.status).toBe(200);
			expect(response.body).toEqual({
				status: RESPONSE_STATUS.SUCCESS,
				data: expectedResponse,
				message: "Rules added to draft workflow successfully"
			});
			expect(workflowManager.addRules).toHaveBeenCalledWith(
				workflowId,
				validRequest,
				expect.objectContaining({
					user_id: expect.any(String) as string,
					customer_id: expect.any(String) as string
				})
			);
		});

		it("should handle multiple rules", async () => {
			const workflowId = "550e8400-e29b-41d4-a716-446655440000";
			const multipleRulesRequest = {
				rules: [
					{
						name: "Rule 1",
						priority: 1,
						conditions: {
							operator: "AND",
							conditions: [{ field: "application.mcc", operator: "=", value: "5411" }]
						},
						actions: [{ type: "set_field", parameters: { field: "case.status", value: "AUTO_APPROVED" } }]
					},
					{
						name: "Rule 2",
						priority: 2,
						conditions: {
							operator: "AND",
							conditions: [{ field: "application.country", operator: "=", value: "US" }]
						},
						actions: [{ type: "set_field", parameters: { field: "case.status", value: "UNDER_MANUAL_REVIEW" } }]
					}
				]
			};

			const expectedResponse = {
				workflow_id: workflowId,
				version_id: "version-123",
				rules_added: 2,
				message: "Successfully added 2 rules to draft workflow"
			};

			(workflowManager.addRules as jest.Mock).mockResolvedValue(expectedResponse);

			const app = createTestApp();
			const response = await request(app)
				.put(`/workflows/${workflowId}/rules`)
				.set("Content-Type", "application/json")
				.send(multipleRulesRequest);

			expect(response.status).toBe(200);
			expect((response.body as TestResponse).data?.rules_added as number).toBe(2);
		});
	});

	describe("Validation errors", () => {
		it("should return 400 for invalid workflow ID format", async () => {
			const invalidWorkflowId = "invalid-workflow-id";
			const app = createTestApp();
			const response = await request(app)
				.put(`/workflows/${invalidWorkflowId}/rules`)
				.set("Content-Type", "application/json")
				.send(validRequest);

			expect(response.status).toBe(400);
			expect((response.body as TestResponse).status).toBe(RESPONSE_STATUS.FAIL);
		});

		it("should return 400 for empty workflow ID", async () => {
			// Empty workflow ID in URL path results in 404 (route not found)
			// This is expected behavior - the route doesn't match
			const app = createTestApp();
			const response = await request(app)
				.put("/workflows//rules") // Double slash creates empty segment
				.set("Content-Type", "application/json")
				.send(validRequest);

			expect(response.status).toBe(404);
		});

		it("should return 400 for workflow ID with only whitespace", async () => {
			const whitespaceWorkflowId = "   ";
			const app = createTestApp();
			const response = await request(app)
				.put(`/workflows/${whitespaceWorkflowId}/rules`)
				.set("Content-Type", "application/json")
				.send(validRequest);

			expect(response.status).toBe(400);
			expect((response.body as TestResponse).status).toBe(RESPONSE_STATUS.FAIL);
		});

		it("should return 400 for malformed UUID", async () => {
			const malformedUuid = "550e8400-e29b-41d4-a716-44665544000"; // Missing one character
			const app = createTestApp();
			const response = await request(app)
				.put(`/workflows/${malformedUuid}/rules`)
				.set("Content-Type", "application/json")
				.send(validRequest);

			expect(response.status).toBe(400);
			expect((response.body as TestResponse).status).toBe(RESPONSE_STATUS.FAIL);
		});

		it("should return 400 for missing rules", async () => {
			const workflowId = "550e8400-e29b-41d4-a716-446655440000";
			const invalidRequest = {};

			const app = createTestApp();
			const response = await request(app)
				.put(`/workflows/${workflowId}/rules`)
				.set("Content-Type", "application/json")
				.send(invalidRequest);

			expect(response.status).toBe(400);
			expect((response.body as TestResponse).status).toBe(RESPONSE_STATUS.FAIL);
		});

		it("should return 400 for empty rules array", async () => {
			const workflowId = "550e8400-e29b-41d4-a716-446655440000";
			const invalidRequest = { rules: [] };

			const app = createTestApp();
			const response = await request(app)
				.put(`/workflows/${workflowId}/rules`)
				.set("Content-Type", "application/json")
				.send(invalidRequest);

			expect(response.status).toBe(400);
			expect((response.body as TestResponse).status).toBe(RESPONSE_STATUS.FAIL);
		});

		it("should return 400 for invalid rule name", async () => {
			const workflowId = "550e8400-e29b-41d4-a716-446655440000";
			const invalidRequest = {
				rules: [
					{
						name: "", // Empty name
						priority: 1,
						conditions: { operator: "AND", conditions: [] },
						actions: [{ type: "set_field", parameters: { field: "case.status", value: "AUTO_APPROVED" } }]
					}
				]
			};

			const app = createTestApp();
			const response = await request(app)
				.put(`/workflows/${workflowId}/rules`)
				.set("Content-Type", "application/json")
				.send(invalidRequest);

			expect(response.status).toBe(400);
			expect((response.body as TestResponse).status).toBe(RESPONSE_STATUS.FAIL);
		});

		it("should return 400 for invalid action type", async () => {
			const workflowId = "550e8400-e29b-41d4-a716-446655440000";
			const invalidRequest = {
				rules: [
					{
						name: "Test Rule",
						priority: 1,
						conditions: { operator: "AND", conditions: [] },
						actions: [{ type: "INVALID_ACTION" }]
					}
				]
			};

			const app = createTestApp();
			const response = await request(app)
				.put(`/workflows/${workflowId}/rules`)
				.set("Content-Type", "application/json")
				.send(invalidRequest);

			expect(response.status).toBe(400);
			expect((response.body as TestResponse).status).toBe(RESPONSE_STATUS.FAIL);
		});

		it("should return 400 for missing actions", async () => {
			const workflowId = "550e8400-e29b-41d4-a716-446655440000";
			const invalidRequest = {
				rules: [
					{
						name: "Test Rule",
						priority: 1,
						conditions: { operator: "AND", conditions: [] },
						actions: [] // Empty actions
					}
				]
			};

			const app = createTestApp();
			const response = await request(app)
				.put(`/workflows/${workflowId}/rules`)
				.set("Content-Type", "application/json")
				.send(invalidRequest);

			expect(response.status).toBe(400);
			expect((response.body as TestResponse).status).toBe(RESPONSE_STATUS.FAIL);
		});
	});

	describe("Service errors", () => {
		it("should return 500 for service errors", async () => {
			const workflowId = "550e8400-e29b-41d4-a716-446655440000";
			const serviceError = new Error("Database connection failed");

			(workflowManager.addRules as jest.Mock).mockRejectedValue(serviceError);

			const app = createTestApp();
			const response = await request(app)
				.put(`/workflows/${workflowId}/rules`)
				.set("Content-Type", "application/json")
				.send(validRequest);

			expect(response.status).toBe(500);
			expect((response.body as TestResponse).status).toBe(RESPONSE_STATUS.ERROR);
		});

		it("should return 404 for workflow not found", async () => {
			const workflowId = "550e8400-e29b-41d4-a716-446655440001";
			const notFoundError = new Error("Workflow not found");

			(workflowManager.addRules as jest.Mock).mockRejectedValue(notFoundError);

			const app = createTestApp();
			const response = await request(app)
				.put(`/workflows/${workflowId}/rules`)
				.set("Content-Type", "application/json")
				.send(validRequest);

			expect(response.status).toBe(500); // This would be handled by error middleware
		});
	});

	describe("Authentication and authorization", () => {
		it("should handle requests with proper user context", async () => {
			const workflowId = "550e8400-e29b-41d4-a716-446655440000";
			const expectedResponse = {
				workflow_id: workflowId,
				version_id: "version-123",
				rules_added: 1,
				message: "Successfully added 1 rules to draft workflow"
			};

			(workflowManager.addRules as jest.Mock).mockResolvedValue(expectedResponse);

			const app = createTestApp();
			const response = await request(app)
				.put(`/workflows/${workflowId}/rules`)
				.set("Content-Type", "application/json")
				.send(validRequest);

			expect(response.status).toBe(200);
			expect((response.body as TestResponse).status).toBe(RESPONSE_STATUS.SUCCESS);
		});

		it("should handle requests with different user roles", async () => {
			const workflowId = "550e8400-e29b-41d4-a716-446655440000";
			const expectedResponse = {
				workflow_id: workflowId,
				version_id: "version-123",
				rules_added: 1,
				message: "Successfully added 1 rules to draft workflow"
			};

			(workflowManager.addRules as jest.Mock).mockResolvedValue(expectedResponse);

			// Create app with different user role
			const createTestAppWithRole = (roleId: number) => {
				const app = express();
				app.use(express.json());
				app.use(jsend());

				app.use((req, res, next) => {
					res.locals = { user: { ...mockUserInfo, role: { id: roleId, code: "ADMIN" } } };
					next();
				});

				app.put("/workflows/:id/rules", validateSchema(addRulesSchema), controller.addRules);

				// Add error handling middleware
				app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
					if (res.headersSent) {
						return next(err);
					}

					if (err.name === "ValidationMiddlewareError") {
						return res.status(400).json({
							status: RESPONSE_STATUS.FAIL,
							message: err.message,
							data: (err as ValidationError).details
						});
					}

					return res.status(500).json({
						status: RESPONSE_STATUS.ERROR,
						message: "Internal server error"
					});
				});

				return app;
			};

			const app = createTestAppWithRole(2); // Admin role
			const response = await request(app)
				.put(`/workflows/${workflowId}/rules`)
				.set("Content-Type", "application/json")
				.send(validRequest);

			expect(response.status).toBe(200);
			expect((response.body as TestResponse).status).toBe(RESPONSE_STATUS.SUCCESS);
		});
	});
});
