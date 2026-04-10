import { TriggerRepository } from "../triggerRepository";
import { db } from "#database/knex";
import { ApiError } from "#types/common";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants";

// Mock the database
jest.mock("#database/knex", () => ({
	db: jest.fn().mockReturnValue({
		select: jest.fn().mockReturnThis(),
		from: jest.fn().mockReturnThis(),
		orderBy: jest.fn().mockReturnThis()
	})
}));

jest.mock("#helpers/logger", () => ({
	logger: {
		info: jest.fn(),
		error: jest.fn(),
		debug: jest.fn(),
		warn: jest.fn()
	}
}));

interface MockQuery {
	select: jest.Mock;
	from: jest.Mock;
	orderBy: jest.Mock;
}

interface MockDb {
	mockReturnValue: jest.Mock;
}

describe("TriggerRepository.getTriggers", () => {
	let triggerRepository: TriggerRepository;
	let mockDb: MockDb;
	let mockQuery: MockQuery;

	beforeEach(() => {
		triggerRepository = new TriggerRepository();
		mockDb = db as unknown as MockDb;
		mockQuery = {
			select: jest.fn().mockReturnThis(),
			from: jest.fn().mockReturnThis(),
			orderBy: jest.fn().mockReturnThis()
		};
		mockDb.mockReturnValue(mockQuery);
		jest.clearAllMocks();
	});

	describe("getTriggers", () => {
		it("should successfully retrieve triggers from database", async () => {
			const mockTriggers = [
				{
					id: "trigger-123",
					name: "On Boarding",
					conditions: {
						operator: "AND",
						conditions: [{ field: "cases.status", operator: "=", value: "onboarding" }]
					},
					created_by: "user-123",
					created_at: new Date("2024-01-01T12:00:00.000Z"),
					updated_by: "user-123",
					updated_at: new Date("2024-01-01T12:00:00.000Z")
				}
			];

			mockQuery.orderBy.mockResolvedValue(mockTriggers);

			const result = await triggerRepository.getTriggers();

			expect(mockDb).toHaveBeenCalledWith("data_workflow_triggers");
			expect(mockQuery.select).toHaveBeenCalledWith(
				"id",
				"name",
				"conditions",
				"created_by",
				"created_at",
				"updated_by",
				"updated_at"
			);
			expect(mockQuery.orderBy).toHaveBeenCalledWith("name", "asc");

			expect(result).toEqual(mockTriggers);
		});

		it("should handle empty triggers list", async () => {
			mockQuery.orderBy.mockResolvedValue([]);

			const result = await triggerRepository.getTriggers();

			expect(mockDb).toHaveBeenCalledWith("data_workflow_triggers");
			expect(mockQuery.select).toHaveBeenCalledWith(
				"id",
				"name",
				"conditions",
				"created_by",
				"created_at",
				"updated_by",
				"updated_at"
			);
			expect(mockQuery.orderBy).toHaveBeenCalledWith("name", "asc");

			expect(result).toEqual([]);
		});

		it("should handle multiple triggers", async () => {
			const mockTriggers = [
				{
					id: "trigger-1",
					name: "On Boarding",
					conditions: {
						operator: "AND",
						conditions: [{ field: "cases.status", operator: "=", value: "onboarding" }]
					},
					created_by: "user-123",
					created_at: new Date("2024-01-01T12:00:00.000Z"),
					updated_by: "user-123",
					updated_at: new Date("2024-01-01T12:00:00.000Z")
				},
				{
					id: "trigger-2",
					name: "Status Change",
					conditions: {
						operator: "AND",
						conditions: [{ field: "cases.status", operator: "=", value: "submitted" }]
					},
					created_by: "user-123",
					created_at: new Date("2024-01-02T12:00:00.000Z"),
					updated_by: "user-123",
					updated_at: new Date("2024-01-02T12:00:00.000Z")
				}
			];

			mockQuery.orderBy.mockResolvedValue(mockTriggers);

			const result = await triggerRepository.getTriggers();

			expect(result).toEqual(mockTriggers);
		});

		it("should handle database connection errors", async () => {
			const error = new Error("Database connection failed");
			mockQuery.orderBy.mockRejectedValue(error);

			await expect(triggerRepository.getTriggers()).rejects.toThrow(ApiError);

			try {
				await triggerRepository.getTriggers();
			} catch (thrownError) {
				expect(thrownError).toBeInstanceOf(ApiError);
				expect((thrownError as ApiError).message).toBe("Database connection failed during trigger retrieval");
				expect((thrownError as ApiError).status).toBe(StatusCodes.SERVICE_UNAVAILABLE);
				expect((thrownError as ApiError).errorCode).toBe(ERROR_CODES.UNKNOWN_ERROR);
			}
		});

		it("should handle query timeout errors", async () => {
			const timeoutError = new Error("Query timeout");
			mockQuery.orderBy.mockRejectedValue(timeoutError);

			await expect(triggerRepository.getTriggers()).rejects.toThrow(ApiError);

			try {
				await triggerRepository.getTriggers();
			} catch (thrownError) {
				expect(thrownError).toBeInstanceOf(ApiError);
				expect((thrownError as ApiError).message).toBe("Database timeout during trigger retrieval");
				expect((thrownError as ApiError).status).toBe(StatusCodes.REQUEST_TIMEOUT);
				expect((thrownError as ApiError).errorCode).toBe(ERROR_CODES.UNKNOWN_ERROR);
			}
		});

		it("should handle triggers with complex conditions", async () => {
			const mockComplexTriggers = [
				{
					id: "trigger-complex",
					name: "Complex On Boarding",
					conditions: {
						operator: "AND",
						conditions: [
							{ field: "cases.status", operator: "=", value: "onboarding" },
							{
								operator: "OR",
								conditions: [
									{ field: "cases.priority", operator: "=", value: "high" },
									{ field: "cases.amount", operator: ">", value: 10000 }
								]
							}
						]
					},
					created_by: "user-123",
					created_at: new Date("2024-01-01T12:00:00.000Z"),
					updated_by: "user-123",
					updated_at: new Date("2024-01-01T12:00:00.000Z")
				}
			];

			mockQuery.orderBy.mockResolvedValue(mockComplexTriggers);

			const result = await triggerRepository.getTriggers();

			expect(result).toEqual(mockComplexTriggers);
		});

		it("should handle database permission errors", async () => {
			const permissionError = new Error("access denied");
			mockQuery.orderBy.mockRejectedValue(permissionError);

			await expect(triggerRepository.getTriggers()).rejects.toThrow(ApiError);

			try {
				await triggerRepository.getTriggers();
			} catch (thrownError) {
				expect(thrownError).toBeInstanceOf(ApiError);
				expect((thrownError as ApiError).message).toBe("Database access denied during trigger retrieval");
				expect((thrownError as ApiError).status).toBe(StatusCodes.FORBIDDEN);
				expect((thrownError as ApiError).errorCode).toBe(ERROR_CODES.UNAUTHORIZED);
			}
		});

		it("should handle malformed database response", async () => {
			const malformedResponse = [
				{
					id: "trigger-123",
					name: "On Boarding",
					conditions: {},
					// Missing required fields
					created_by: "user-123",
					created_at: new Date("2024-01-01T12:00:00.000Z"),
					updated_by: "user-123",
					updated_at: new Date("2024-01-01T12:00:00.000Z")
				}
			];

			mockQuery.orderBy.mockResolvedValue(malformedResponse);

			const result = await triggerRepository.getTriggers();

			expect(result).toEqual(malformedResponse);
		});
	});
});
