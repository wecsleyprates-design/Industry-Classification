import { controller } from "../controller";
import { publishManager } from "#core";
import { StatusCodes } from "http-status-codes";
import { type Response } from "express";
import express from "express";

// Mock the publishManager
jest.mock("#core", () => ({
	publishManager: {
		publishWorkflow: jest.fn()
	}
}));

const mockPublishManager = publishManager as jest.Mocked<typeof publishManager>;

describe("Publish Workflow Controller", () => {
	let mockReq: express.Request;
	let mockRes: Response;
	let mockNext: jest.Mock;

	beforeEach(() => {
		mockReq = {
			params: {
				id: "123e4567-e89b-12d3-a456-426614174000"
			}
		} as unknown as express.Request;

		mockRes = {
			jsend: {
				success: jest.fn()
			},
			locals: {
				user: {
					user_id: "user-123",
					email: "test@example.com",
					role: { id: 1, code: "admin" },
					given_name: "Test",
					family_name: "User",
					customer_id: "customer-123"
				}
			}
		} as unknown as Response;

		mockNext = jest.fn();
		jest.clearAllMocks();
	});

	describe("publishWorkflow", () => {
		it("should successfully publish a workflow version", async () => {
			const mockPublishResponse = {
				workflow_id: "workflow-123",
				version_id: "123e4567-e89b-12d3-a456-426614174000",
				version_number: 1,
				published_at: new Date("2024-01-15T10:30:00Z"),
				message: "Workflow published successfully"
			};

			(mockPublishManager.publishWorkflow as jest.Mock).mockResolvedValue(mockPublishResponse);

			await controller.publishWorkflow(mockReq, mockRes, mockNext);

			expect(mockPublishManager.publishWorkflow).toHaveBeenCalledWith("123e4567-e89b-12d3-a456-426614174000", {
				user_id: "user-123",
				email: "test@example.com",
				role: { id: 1, code: "admin" },
				given_name: "Test",
				family_name: "User",
				customer_id: "customer-123"
			});

			expect(mockRes.jsend.success).toHaveBeenCalledWith(
				mockPublishResponse,
				"Workflow published successfully",
				StatusCodes.OK
			);
		});

		it("should call next with error when workflowManager.publishWorkflow throws", async () => {
			const error = new Error("Database connection failed");
			(mockPublishManager.publishWorkflow as jest.Mock).mockRejectedValue(error);

			await controller.publishWorkflow(mockReq, mockRes, mockNext);

			expect(mockNext).toHaveBeenCalledWith(error);
		});

		it("should handle validation errors from workflowManager", async () => {
			const validationError = new Error("Workflow version must have a trigger before publishing");
			(mockPublishManager.publishWorkflow as jest.Mock).mockRejectedValue(validationError);

			await controller.publishWorkflow(mockReq, mockRes, mockNext);

			expect(mockNext).toHaveBeenCalledWith(validationError);
		});

		it("should handle workflow not found errors", async () => {
			const notFoundError = new Error("Workflow version not found or not in draft status");
			(mockPublishManager.publishWorkflow as jest.Mock).mockRejectedValue(notFoundError);

			await controller.publishWorkflow(mockReq, mockRes, mockNext);

			expect(mockNext).toHaveBeenCalledWith(notFoundError);
		});
	});
});
