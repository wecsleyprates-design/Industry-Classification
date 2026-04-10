import request from "supertest";
import express from "express";
import { controller } from "../controller";
import { triggerManager } from "#core";

// Mock the trigger manager
jest.mock("#core", () => ({
	triggerManager: {
		getTriggers: jest.fn()
	}
}));

const mockTriggerManager = triggerManager as jest.Mocked<typeof triggerManager>;

describe("GET /api/v1/triggers", () => {
	let app: express.Application;

	beforeEach(() => {
		app = express();
		app.use(express.json());

		// Add jsend middleware
		app.use((req, res, next) => {
			res.jsend = {
				success: (data: unknown, message = "Success", statusCode = 200) => {
					res.status(statusCode).json({
						status: "success",
						message,
						data
					});
				},
				fail: (message: string, data: unknown, errorCode: number | null = null, statusCode = 400) => {
					res.status(statusCode).json({
						status: "fail",
						message,
						errorCode,
						data
					});
				},
				error: (message: string, statusCode = 500, errorCode: number | null = null, data: unknown = null) => {
					res.status(statusCode).json({
						status: "error",
						message,
						errorCode,
						data
					});
				}
			};
			next();
		});

		// Add the route
		app.get("/triggers", controller.getTriggers);

		// Add error handling middleware
		app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
			if (res.headersSent) {
				return next(err);
			}
			res.status(500).json({
				status: "error",
				message: "Internal server error"
			});
		});

		jest.clearAllMocks();
	});

	it("should successfully retrieve triggers", async () => {
		const mockTriggers = [
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
		];

		const mockResponse = {
			triggers: mockTriggers,
			total: 1
		};

		mockTriggerManager.getTriggers.mockResolvedValue(mockResponse);

		const response = await request(app).get("/triggers");

		expect(response.status).toBe(200);
		expect(response.body).toEqual({
			status: "success",
			data: mockResponse,
			message: "Triggers retrieved successfully"
		});
	});

	it("should handle empty triggers list", async () => {
		const mockResponse = {
			triggers: [],
			total: 0
		};

		mockTriggerManager.getTriggers.mockResolvedValue(mockResponse);

		const response = await request(app).get("/triggers");

		expect(response.status).toBe(200);
		expect(response.body).toEqual({
			status: "success",
			data: mockResponse,
			message: "Triggers retrieved successfully"
		});
	});

	it("should handle multiple triggers", async () => {
		const mockTriggers = [
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
		];

		const mockResponse = {
			triggers: mockTriggers,
			total: 2
		};

		mockTriggerManager.getTriggers.mockResolvedValue(mockResponse);

		const response = await request(app).get("/triggers");

		expect(response.status).toBe(200);
		expect(response.body).toEqual({
			status: "success",
			data: mockResponse,
			message: "Triggers retrieved successfully"
		});
	});

	it("should handle database errors", async () => {
		mockTriggerManager.getTriggers.mockRejectedValue(new Error("Database connection failed"));

		const response = await request(app).get("/triggers");

		expect(response.status).toBe(500);
		expect((response.body as { status: string }).status).toBe("error");
		expect((response.body as { message: string }).message).toBe("Internal server error");
	});

	it("should handle triggers with complex conditions", async () => {
		const mockTriggers = [
			{
				id: "trigger-complex",
				name: "Complex Trigger",
				conditions: {
					operator: "AND" as const,
					conditions: [
						{ field: "cases.status", operator: "=" as const, value: "onboarding" },
						{
							operator: "OR" as const,
							conditions: [
								{ field: "application.mcc", operator: "IN" as const, value: ["5967", "5812"] },
								{ field: "financials.judgments_total", operator: ">" as const, value: 50000 }
							]
						}
					]
				},
				created_at: "2024-01-01T00:00:00Z",
				updated_at: "2024-01-01T00:00:00Z"
			}
		];

		const mockResponse = {
			triggers: mockTriggers,
			total: 1
		};

		mockTriggerManager.getTriggers.mockResolvedValue(mockResponse);

		const response = await request(app).get("/triggers");

		expect(response.status).toBe(200);
		expect((response.body as { data: { triggers: unknown[] } }).data.triggers[0]).toEqual(mockTriggers[0]);
	});

	it("should return proper HTTP status codes", async () => {
		const mockResponse = {
			triggers: [],
			total: 0
		};

		mockTriggerManager.getTriggers.mockResolvedValue(mockResponse);

		const response = await request(app).get("/triggers");

		expect(response.status).toBe(200);
		expect((response.body as { status: string }).status).toBe("success");
	});

	it("should handle malformed database response gracefully", async () => {
		// Simulate malformed response
		mockTriggerManager.getTriggers.mockRejectedValue(new Error("Malformed response"));

		const response = await request(app).get("/triggers");

		expect(response.status).toBe(500);
		expect((response.body as { status: string }).status).toBe("error");
	});

	it("should handle database timeout errors", async () => {
		const timeoutError = new Error("Database timeout");
		timeoutError.name = "TimeoutError";
		mockTriggerManager.getTriggers.mockRejectedValue(timeoutError);

		const response = await request(app).get("/triggers");

		expect(response.status).toBe(500);
		expect((response.body as { status: string }).status).toBe("error");
	});

	it("should handle database permission errors", async () => {
		const permissionError = new Error("Database permission denied");
		permissionError.name = "PermissionError";
		mockTriggerManager.getTriggers.mockRejectedValue(permissionError);

		const response = await request(app).get("/triggers");

		expect(response.status).toBe(500);
		expect((response.body as { status: string }).status).toBe("error");
	});
});
