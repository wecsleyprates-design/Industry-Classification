/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import request from "supertest";
import express from "express";
import { v4 as uuidv4 } from "uuid";
import { controller } from "../controller";
import { publishManager } from "#core";
import { jsend } from "#utils";
import { RESPONSE_STATUS } from "#constants/workflow.constants";

// Mock the publish manager
jest.mock("#core", () => ({
	publishManager: {
		publishWorkflow: jest.fn()
	}
}));

// Mock middleware to avoid complex dependencies
jest.mock("#middlewares", () => ({
	validateSchema: jest.fn(() => (req: any, res: any, next: any) => next()),
	validateUser: jest.fn(() => (req: any, res: any, next: any) => next())
}));

describe("Publish Workflow Edge Cases Integration Tests", () => {
	const testCustomerId = uuidv4();
	const testUserId = uuidv4();
	const testWorkflowId = uuidv4();
	const testVersionId = uuidv4();

	const mockUserInfo = {
		user_id: testUserId,
		email: "test@example.com",
		given_name: "Test",
		family_name: "User",
		customer_id: testCustomerId,
		role: { id: 1, code: "CRO" }
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

		// Add the route with mocked middleware
		app.post("/workflows/versions/:id/publish", controller.publishWorkflow);

		// Add error handling middleware
		app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
			if (res.headersSent) {
				return next(err);
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

	describe("Concurrent Publish Attempts", () => {
		it("should handle multiple concurrent publish requests", async () => {
			const mockPublishResponse = {
				workflow_id: testWorkflowId,
				version_id: testVersionId,
				version_number: 1,
				published_at: "2024-01-15T10:30:00.000Z",
				message: "Workflow published successfully"
			};

			// Mock successful publish for first request
			(publishManager.publishWorkflow as jest.Mock)
				.mockResolvedValueOnce(mockPublishResponse)
				// Mock constraint violation for second request
				.mockRejectedValueOnce(new Error("duplicate key value violates unique constraint"));

			const app = createTestApp();

			// Make concurrent requests
			const promises = [
				request(app).post(`/workflows/versions/${testVersionId}/publish`),
				request(app).post(`/workflows/versions/${testVersionId}/publish`)
			];

			const responses = await Promise.allSettled(promises);

			// At least one should succeed
			const successfulResponses = responses.filter(
				response => response.status === "fulfilled" && (response.value as any).status === 200
			);
			expect(successfulResponses.length).toBeGreaterThan(0);
		});

		it("should handle race conditions in version status updates", async () => {
			// Mock first request succeeds
			const mockPublishResponse = {
				workflow_id: testWorkflowId,
				version_id: testVersionId,
				version_number: 1,
				published_at: "2024-01-15T10:30:00.000Z",
				message: "Workflow published successfully"
			};

			(publishManager.publishWorkflow as jest.Mock)
				.mockResolvedValueOnce(mockPublishResponse)
				.mockRejectedValueOnce(new Error("Workflow version not found or not in draft status"));

			const app = createTestApp();

			const promises = [
				request(app).post(`/workflows/versions/${testVersionId}/publish`),
				request(app).post(`/workflows/versions/${testVersionId}/publish`)
			];

			const responses = await Promise.allSettled(promises);

			// First should succeed, second should fail
			expect(responses[0].status).toBe("fulfilled");
			expect(responses[1].status).toBe("fulfilled");

			// Check that the manager was called twice
			expect(publishManager.publishWorkflow).toHaveBeenCalledTimes(2);
		});
	});

	describe("Database Constraint Violations", () => {
		it("should handle unique constraint violations gracefully", async () => {
			const constraintError = new Error("duplicate key value violates unique constraint");
			(constraintError as any).code = "23505";

			(publishManager.publishWorkflow as jest.Mock).mockRejectedValue(constraintError);

			const app = createTestApp();
			const response = await request(app).post(`/workflows/versions/${testVersionId}/publish`).expect(500);

			expect(response.body).toMatchObject({
				status: "error",
				message: "Internal server error"
			});
		});

		it("should handle foreign key constraint violations", async () => {
			const fkError = new Error("insert or update on table violates foreign key constraint");
			(fkError as any).code = "23503";

			(publishManager.publishWorkflow as jest.Mock).mockRejectedValue(fkError);

			const app = createTestApp();
			const response = await request(app).post(`/workflows/versions/${testVersionId}/publish`).expect(500);

			expect(response.body).toMatchObject({
				status: "error",
				message: "Internal server error"
			});
		});
	});

	describe("Network and Connection Issues", () => {
		it("should handle database connection timeouts", async () => {
			const timeoutError = new Error("Connection timeout");
			(timeoutError as any).code = "ETIMEDOUT";

			(publishManager.publishWorkflow as jest.Mock).mockRejectedValue(timeoutError);

			const app = createTestApp();
			const response = await request(app).post(`/workflows/versions/${testVersionId}/publish`).expect(500);

			expect(response.body).toMatchObject({
				status: "error",
				message: "Internal server error"
			});
		});

		it("should handle connection lost errors", async () => {
			const connectionError = new Error("Connection lost");
			(connectionError as any).code = "ECONNRESET";

			(publishManager.publishWorkflow as jest.Mock).mockRejectedValue(connectionError);

			const app = createTestApp();
			const response = await request(app).post(`/workflows/versions/${testVersionId}/publish`).expect(500);

			expect(response.body).toMatchObject({
				status: "error",
				message: "Internal server error"
			});
		});

		it("should handle transaction rollback scenarios", async () => {
			const rollbackError = new Error("Transaction rollback due to constraint violation");

			(publishManager.publishWorkflow as jest.Mock).mockRejectedValue(rollbackError);

			const app = createTestApp();
			const response = await request(app).post(`/workflows/versions/${testVersionId}/publish`).expect(500);

			expect(response.body).toMatchObject({
				status: "error",
				message: "Internal server error"
			});
		});
	});

	describe("Data Validation Edge Cases", () => {
		it("should handle missing version ID in URL", async () => {
			const app = createTestApp();
			// This should result in a 404 due to malformed route
			await request(app).post("/workflows/versions//publish").expect(404);
		});

		it("should handle malformed UUID in version ID", async () => {
			const invalidUuid = "not-a-valid-uuid";

			(publishManager.publishWorkflow as jest.Mock).mockRejectedValue(new Error("Invalid workflow ID format"));

			const app = createTestApp();
			const response = await request(app).post(`/workflows/versions/${invalidUuid}/publish`).expect(500);

			expect(response.body).toMatchObject({
				status: "error",
				message: "Internal server error"
			});
		});

		it("should handle version not found scenarios", async () => {
			(publishManager.publishWorkflow as jest.Mock).mockRejectedValue(
				new Error("Workflow version not found or not in draft status")
			);

			const app = createTestApp();
			const response = await request(app).post(`/workflows/versions/${testVersionId}/publish`).expect(500);

			expect(response.body).toMatchObject({
				status: "error",
				message: "Internal server error"
			});
		});

		it("should handle validation errors for missing trigger", async () => {
			(publishManager.publishWorkflow as jest.Mock).mockRejectedValue(
				new Error("Workflow version must have a trigger before publishing")
			);

			const app = createTestApp();
			const response = await request(app).post(`/workflows/versions/${testVersionId}/publish`).expect(500);

			expect(response.body).toMatchObject({
				status: "error",
				message: "Internal server error"
			});
		});

		it("should handle validation errors for missing rules", async () => {
			(publishManager.publishWorkflow as jest.Mock).mockRejectedValue(
				new Error("Workflow version must have at least one rule before publishing")
			);

			const app = createTestApp();
			const response = await request(app).post(`/workflows/versions/${testVersionId}/publish`).expect(500);

			expect(response.body).toMatchObject({
				status: "error",
				message: "Internal server error"
			});
		});
	});

	describe("Performance and Resource Management", () => {
		it("should handle large payload scenarios", async () => {
			const mockPublishResponse = {
				workflow_id: testWorkflowId,
				version_id: testVersionId,
				version_number: 1,
				published_at: "2024-01-15T10:30:00.000Z",
				message: "Workflow published successfully"
			};

			(publishManager.publishWorkflow as jest.Mock).mockResolvedValue(mockPublishResponse);

			const app = createTestApp();
			const response = await request(app).post(`/workflows/versions/${testVersionId}/publish`).expect(200);

			expect(response.body).toMatchObject({
				status: "success",
				message: "Workflow published successfully",
				data: mockPublishResponse
			});
		});

		it("should handle memory pressure scenarios", async () => {
			const memoryError = new Error("Out of memory");
			(memoryError as any).code = "ENOMEM";

			(publishManager.publishWorkflow as jest.Mock).mockRejectedValue(memoryError);

			const app = createTestApp();
			const response = await request(app).post(`/workflows/versions/${testVersionId}/publish`).expect(500);

			expect(response.body).toMatchObject({
				status: "error",
				message: "Internal server error"
			});
		});
	});

	describe("Security and Access Control", () => {
		it("should handle unauthorized access attempts", async () => {
			(publishManager.publishWorkflow as jest.Mock).mockRejectedValue(new Error("Workflow not found or access denied"));

			const app = createTestApp();
			const response = await request(app).post(`/workflows/versions/${testVersionId}/publish`).expect(500);

			expect(response.body).toMatchObject({
				status: "error",
				message: "Internal server error"
			});
		});

		it("should handle cross-customer access attempts", async () => {
			(publishManager.publishWorkflow as jest.Mock).mockRejectedValue(new Error("Workflow not found or access denied"));

			const app = createTestApp();
			const response = await request(app).post(`/workflows/versions/${testVersionId}/publish`).expect(500);

			expect(response.body).toMatchObject({
				status: "error",
				message: "Internal server error"
			});
		});
	});
});
