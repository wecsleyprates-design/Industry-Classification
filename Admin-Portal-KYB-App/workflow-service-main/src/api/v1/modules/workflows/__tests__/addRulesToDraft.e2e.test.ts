import request from "supertest";
import express from "express";
import { validateSchema, validateIdParam } from "#middlewares";
import { addRulesSchema } from "../schema";
import { controller } from "../controller";
import { workflowManager } from "#core";
import { jsend } from "#utils";
import { RESPONSE_STATUS } from "#constants/workflow.constants";

// ValidationError interface for error handling
interface ValidationError extends Error {
	details?: unknown;
}

// Test response interface
interface TestResponse {
	status: string;
	data?: Record<string, unknown>;
	message?: string;
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

// Mock the workflow manager
jest.mock("#core", () => ({
	workflowManager: {
		addRules: jest.fn()
	}
}));

describe("Add Rules to Draft Workflow - E2E Tests", () => {
	const mockUserInfo = {
		user_id: "user-123",
		email: "test@example.com",
		given_name: "Test",
		family_name: "User",
		customer_id: "customer-123",
		role: { id: 1, code: "CRO" }
	};

	// Test harness: user injected via app.use; route uses param validation + Joi + controller (no validateUser / JWT)
	const createTestApp = () => {
		const app = express();
		app.use(express.json());
		app.use(jsend());

		// Mock middleware to set user info
		app.use((req, res, next) => {
			res.locals = { user: mockUserInfo };
			next();
		});

		app.put("/workflows/:id/rules", validateIdParam, validateSchema(addRulesSchema), controller.addRules);

		// Add error handling middleware
		app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
			if (res.headersSent) {
				return next(err);
			}

			if (err.name === "ValidationMiddlewareError") {
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

	describe("Complete E2E Flow", () => {
		it("should successfully add rules to a draft workflow (id param, body validation, controller)", async () => {
			const workflowId = "550e8400-e29b-41d4-a716-446655440000";
			const validRequest = {
				rules: [
					{
						name: "High Risk MCC Rule",
						priority: 1,
						conditions: {
							operator: "AND",
							conditions: [
								{ field: "application.mcc", operator: "IN", value: ["5967", "5812"] },
								{ field: "financials.judgments_total", operator: ">", value: 50000 }
							]
						},
						actions: [
							{
								type: "set_field",
								parameters: { field: "case.status", value: "UNDER_MANUAL_REVIEW" }
							}
						]
					}
				]
			};

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

		it("should handle complex rule scenarios with multiple conditions and actions", async () => {
			const workflowId = "550e8400-e29b-41d4-a716-446655440000";
			const complexRequest = {
				rules: [
					{
						name: "Auto Approve Low Risk",
						priority: 1,
						conditions: {
							operator: "AND",
							conditions: [
								{ field: "application.mcc", operator: "=", value: "5411" },
								{ field: "financials.judgments_total", operator: "<", value: 10000 },
								{ field: "application.country", operator: "=", value: "US" }
							]
						},
						actions: [
							{
								type: "set_field",
								parameters: { field: "case.status", value: "AUTO_APPROVED" }
							}
						]
					},
					{
						name: "Manual Review High Risk",
						priority: 2,
						conditions: {
							operator: "AND",
							conditions: [
								{
									operator: "OR",
									conditions: [
										{ field: "financials.judgments_total", operator: ">", value: 100000 },
										{ field: "adverse_media.bankruptcies", operator: "=", value: true }
									]
								}
							]
						},
						actions: [
							{
								type: "set_field",
								parameters: { field: "case.status", value: "UNDER_MANUAL_REVIEW" }
							}
						]
					},
					{
						name: "Auto Reject Unsupported Countries",
						priority: 3,
						conditions: {
							operator: "AND",
							conditions: [{ field: "application.country", operator: "IN", value: ["XX", "YY", "ZZ"] }]
						},
						actions: [
							{
								type: "set_field",
								parameters: { field: "case.status", value: "AUTO_REJECTED" }
							}
						]
					}
				]
			};

			const expectedResponse = {
				workflow_id: workflowId,
				version_id: "version-123",
				rules_added: 3,
				message: "Successfully added 3 rules to draft workflow"
			};

			(workflowManager.addRules as jest.Mock).mockResolvedValue(expectedResponse);

			const app = createTestApp();
			const response = await request(app)
				.put(`/workflows/${workflowId}/rules`)
				.set("Content-Type", "application/json")
				.send(complexRequest);

			expect(response.status).toBe(200);
			expect((response.body as TestResponse).data?.rules_added as number).toBe(3);
		});

		it("should handle workflow not found scenario", async () => {
			const workflowId = "550e8400-e29b-41d4-a716-446655440001";
			const validRequest = {
				rules: [
					{
						name: "Test Rule",
						priority: 1,
						conditions: {
							operator: "AND",
							conditions: [{ field: "application.mcc", operator: "=", value: "5411" }]
						},
						actions: [{ type: "set_field", parameters: { field: "case.status", value: "AUTO_APPROVED" } }]
					}
				]
			};

			const notFoundError = new Error("Workflow not found");
			(workflowManager.addRules as jest.Mock).mockRejectedValue(notFoundError);

			const app = createTestApp();
			const response = await request(app)
				.put(`/workflows/${workflowId}/rules`)
				.set("Content-Type", "application/json")
				.send(validRequest);

			expect(response.status).toBe(500);
			expect((response.body as TestResponse).status).toBe(RESPONSE_STATUS.ERROR);
		});

		it("should handle database connection errors", async () => {
			const workflowId = "550e8400-e29b-41d4-a716-446655440000";
			const validRequest = {
				rules: [
					{
						name: "Test Rule",
						priority: 1,
						conditions: {
							operator: "AND",
							conditions: [{ field: "application.mcc", operator: "=", value: "5411" }]
						},
						actions: [{ type: "set_field", parameters: { field: "case.status", value: "AUTO_APPROVED" } }]
					}
				]
			};

			const dbError = new Error("Database connection failed");
			(workflowManager.addRules as jest.Mock).mockRejectedValue(dbError);

			const app = createTestApp();
			const response = await request(app)
				.put(`/workflows/${workflowId}/rules`)
				.set("Content-Type", "application/json")
				.send(validRequest);

			expect(response.status).toBe(500);
			expect((response.body as TestResponse).status).toBe(RESPONSE_STATUS.ERROR);
		});

		it("should validate all required fields in the request", async () => {
			const workflowId = "550e8400-e29b-41d4-a716-446655440000";
			const invalidRequest = {
				rules: [
					{
						// Missing name
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

		it("should handle different user roles and permissions", async () => {
			const workflowId = "550e8400-e29b-41d4-a716-446655440000";
			const validRequest = {
				rules: [
					{
						name: "Test Rule",
						priority: 1,
						conditions: {
							operator: "AND",
							conditions: [{ field: "application.mcc", operator: "=", value: "5411" }]
						},
						actions: [{ type: "set_field", parameters: { field: "case.status", value: "AUTO_APPROVED" } }]
					}
				]
			};

			const expectedResponse = {
				workflow_id: workflowId,
				version_id: "version-123",
				rules_added: 1,
				message: "Successfully added 1 rules to draft workflow"
			};

			(workflowManager.addRules as jest.Mock).mockResolvedValue(expectedResponse);

			// Test with different user roles
			const testRoles = [
				{ id: 1, code: "CRO" },
				{ id: 2, code: "ADMIN" },
				{ id: 3, code: "ANALYST" }
			];

			for (const role of testRoles) {
				const createTestAppWithRole = () => {
					const app = express();
					app.use(express.json());
					app.use(jsend());

					app.use((req, res, next) => {
						res.locals = { user: { ...mockUserInfo, role } };
						next();
					});

					app.put("/workflows/:id/rules", validateIdParam, validateSchema(addRulesSchema), controller.addRules);

					app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
						if (res.headersSent) {
							return next(err);
						}

						if (err.name === "ValidationMiddlewareError" && "details" in err) {
							const validationError = err as ValidationError;
							return res.status(400).json({
								status: RESPONSE_STATUS.FAIL,
								message: err.message,
								data: validationError.details
							});
						}

						return res.status(500).json({
							status: RESPONSE_STATUS.ERROR,
							message: "Internal server error"
						});
					});

					return app;
				};

				const app = createTestAppWithRole();
				const response = await request(app)
					.put(`/workflows/${workflowId}/rules`)
					.set("Content-Type", "application/json")
					.send(validRequest);

				expect(response.status).toBe(200);
				expect((response.body as TestResponse).status).toBe(RESPONSE_STATUS.SUCCESS);
			}
		});
	});
});
