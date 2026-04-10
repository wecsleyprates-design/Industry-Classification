/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import request from "supertest";
import express from "express";
import { controller } from "../controller";

// Mock the workflowManager
jest.mock("#core", () => ({
	workflowManager: {
		deleteDraftWorkflow: jest.fn()
	}
}));

// Mock middleware to avoid complex dependencies
jest.mock("#middlewares", () => ({
	validateSchema: jest.fn(() => (req: any, res: any, next: any) => next()),
	validateUser: jest.fn(() => (req: any, res: any, next: any) => next())
}));

import { jsend } from "#utils";
import { workflowManager } from "#core";

const mockedWorkflowManager = workflowManager as jest.Mocked<typeof workflowManager>;

const createTestApp = () => {
	const app = express();
	app.use(express.json());
	app.use(jsend());

	// Mock middleware to set user info
	app.use((req, res, next) => {
		res.locals = {
			user: {
				user_id: "test-user-123",
				email: "test@example.com",
				given_name: "Test",
				family_name: "User",
				customer_id: "test-customer-123",
				role: { id: 1, code: "admin" }
			}
		};
		next();
	});

	// Add the route with mocked middleware
	app.delete(
		"/workflows/:id",
		(req, res, next) => next(), // validateUser mock
		controller.deleteDraftWorkflow
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

describe("DELETE /workflows/:id - Integration Tests", () => {
	let app: express.Application;

	beforeEach(() => {
		jest.clearAllMocks();
		app = createTestApp();
	});

	describe("Success cases", () => {
		it("should delete draft workflow successfully", async () => {
			const workflowId = "123e4567-e89b-12d3-a456-426614174000";
			const mockResult = {
				message: "Draft workflow deleted successfully"
			};

			mockedWorkflowManager.deleteDraftWorkflow.mockResolvedValue(mockResult);

			const response = await request(app).delete(`/workflows/${workflowId}`).expect(200);

			expect(response.body).toEqual({
				status: "success",
				message: "Draft workflow deleted successfully",
				data: {
					message: "Draft workflow deleted successfully"
				}
			});

			expect(mockedWorkflowManager.deleteDraftWorkflow).toHaveBeenCalledWith(
				workflowId,
				expect.objectContaining({
					user_id: expect.any(String),
					customer_id: expect.any(String)
				})
			);
		});
	});

	describe("Error cases", () => {
		it("should handle workflow not found errors", async () => {
			const workflowId = "123e4567-e89b-12d3-a456-426614174000";
			const error = new Error("Workflow not found");

			mockedWorkflowManager.deleteDraftWorkflow.mockRejectedValue(error);

			const response = await request(app).delete(`/workflows/${workflowId}`).expect(500);

			expect(response.body.status).toBe("error");
			expect(response.body.message).toBe("Internal server error");
		});

		it("should handle workflow with published versions error", async () => {
			const workflowId = "123e4567-e89b-12d3-a456-426614174000";
			const error = new Error("Cannot delete workflow with published versions");

			mockedWorkflowManager.deleteDraftWorkflow.mockRejectedValue(error);

			const response = await request(app).delete(`/workflows/${workflowId}`).expect(500);

			expect(response.body.status).toBe("error");
			expect(response.body.message).toBe("Internal server error");
		});

		it("should handle workflow with archived versions error", async () => {
			const workflowId = "123e4567-e89b-12d3-a456-426614174000";
			const error = new Error(
				"Cannot delete workflow with archived versions. Workflows with execution history cannot be deleted."
			);

			mockedWorkflowManager.deleteDraftWorkflow.mockRejectedValue(error);

			const response = await request(app).delete(`/workflows/${workflowId}`).expect(500);

			expect(response.body.status).toBe("error");
			expect(response.body.message).toBe("Internal server error");
		});

		it("should handle no draft versions found error", async () => {
			const workflowId = "123e4567-e89b-12d3-a456-426614174000";
			const error = new Error("No draft versions found to delete");

			mockedWorkflowManager.deleteDraftWorkflow.mockRejectedValue(error);

			const response = await request(app).delete(`/workflows/${workflowId}`).expect(500);

			expect(response.body.status).toBe("error");
			expect(response.body.message).toBe("Internal server error");
		});

		it("should return 500 for internal server errors", async () => {
			const workflowId = "123e4567-e89b-12d3-a456-426614174000";

			mockedWorkflowManager.deleteDraftWorkflow.mockRejectedValue(new Error("Database connection failed"));

			const response = await request(app).delete(`/workflows/${workflowId}`).expect(500);

			expect(response.body.status).toBe("error");
		});
	});
});
