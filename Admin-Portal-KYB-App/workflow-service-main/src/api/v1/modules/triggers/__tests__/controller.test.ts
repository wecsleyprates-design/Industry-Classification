import { controller } from "../controller";
import { triggerManager } from "#core";
import { StatusCodes } from "http-status-codes";
import type { Request, Response, NextFunction } from "express";

// Mock the triggerManager
jest.mock("#core", () => ({
	triggerManager: {
		getTriggers: jest.fn()
	}
}));

const mockTriggerManager = triggerManager as jest.Mocked<typeof triggerManager>;

describe("Trigger Controller", () => {
	let mockReq: Request;
	let mockRes: Response;
	let mockNext: jest.MockedFunction<NextFunction>;

	beforeEach(() => {
		mockReq = {} as Request;
		mockRes = {
			jsend: {
				success: jest.fn(),
				fail: jest.fn(),
				error: jest.fn()
			}
		} as unknown as Response;
		mockNext = jest.fn();
		jest.clearAllMocks();
	});

	describe("getTriggers", () => {
		it("should successfully retrieve triggers", async () => {
			const mockTriggersResponse = {
				triggers: [
					{
						id: "trigger-1",
						name: "On Boarding",
						conditions: {
							operator: "AND" as const,
							conditions: [{ field: "cases.status", operator: "=" as const, value: "onboarding" }]
						},
						created_at: "2024-01-01T00:00:00Z",
						updated_at: "2024-01-01T00:00:00Z"
					}
				],
				total: 1
			};

			mockTriggerManager.getTriggers.mockResolvedValue(mockTriggersResponse);

			await controller.getTriggers(mockReq, mockRes, mockNext);

			expect(mockTriggerManager.getTriggers).toHaveBeenCalledWith();
			expect(mockRes.jsend?.success).toHaveBeenCalledWith(
				mockTriggersResponse,
				"Triggers retrieved successfully",
				StatusCodes.OK
			);
		});

		it("should handle empty triggers list", async () => {
			const mockEmptyResponse = {
				triggers: [],
				total: 0
			};

			mockTriggerManager.getTriggers.mockResolvedValue(mockEmptyResponse);

			await controller.getTriggers(mockReq, mockRes, mockNext);

			expect(mockTriggerManager.getTriggers).toHaveBeenCalledWith();
			expect(mockRes.jsend?.success).toHaveBeenCalledWith(
				mockEmptyResponse,
				"Triggers retrieved successfully",
				StatusCodes.OK
			);
		});

		it("should call next with error when triggerManager.getTriggers throws", async () => {
			const error = new Error("Database connection failed");
			mockTriggerManager.getTriggers.mockRejectedValue(error);

			await controller.getTriggers(mockReq, mockRes, mockNext);

			expect(mockNext).toHaveBeenCalledWith(error);
			expect(mockRes.jsend?.success).not.toHaveBeenCalled();
		});

		it("should handle multiple triggers", async () => {
			const mockMultipleTriggersResponse = {
				triggers: [
					{
						id: "trigger-1",
						name: "On Boarding",
						conditions: {
							operator: "AND" as const,
							conditions: [{ field: "cases.status", operator: "=" as const, value: "onboarding" }]
						},
						created_at: "2024-01-01T00:00:00Z",
						updated_at: "2024-01-01T00:00:00Z"
					},
					{
						id: "trigger-2",
						name: "Status Change",
						conditions: {
							operator: "AND" as const,
							conditions: [{ field: "cases.status", operator: "=" as const, value: "submitted" }]
						},
						created_at: "2024-01-02T00:00:00Z",
						updated_at: "2024-01-02T00:00:00Z"
					}
				],
				total: 2
			};

			mockTriggerManager.getTriggers.mockResolvedValue(mockMultipleTriggersResponse);

			await controller.getTriggers(mockReq, mockRes, mockNext);

			expect(mockTriggerManager.getTriggers).toHaveBeenCalledWith();
			expect(mockRes.jsend?.success).toHaveBeenCalledWith(
				mockMultipleTriggersResponse,
				"Triggers retrieved successfully",
				StatusCodes.OK
			);
		});
	});
});
