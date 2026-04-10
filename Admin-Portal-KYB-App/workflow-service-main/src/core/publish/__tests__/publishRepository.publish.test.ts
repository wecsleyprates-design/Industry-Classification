import { PublishRepository } from "../publishRepository";
import { db } from "#database/knex";
import { ApiError } from "#types/common";
import { StatusCodes } from "http-status-codes";
import { WORKFLOW_STATUS, WORKFLOW_ERROR_CODES_COMBINED as ERROR_CODES } from "#constants";

// Mock the database
jest.mock("#database/knex", () => ({
	db: jest.fn()
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
	where: jest.Mock;
	whereIn: jest.Mock;
	first: jest.Mock;
	count: jest.Mock;
	update: jest.Mock;
	insert: jest.Mock;
	fn: {
		now: jest.Mock;
		uuid: jest.Mock;
		uuidToBin: jest.Mock;
		binToUuid: jest.Mock;
	};
}

interface MockDb {
	mockReturnValue: jest.Mock;
}

describe("PublishRepository", () => {
	let publishRepository: PublishRepository;
	let mockDb: MockDb;
	let mockQuery: MockQuery;

	beforeEach(() => {
		jest.clearAllMocks();
		mockDb = db as unknown as MockDb;
		mockQuery = {
			select: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			whereIn: jest.fn().mockReturnThis(),
			first: jest.fn().mockReturnThis(),
			count: jest.fn().mockReturnThis(),
			update: jest.fn().mockReturnThis(),
			insert: jest.fn().mockReturnThis(),
			fn: {
				now: jest.fn().mockReturnValue("NOW()"),
				uuid: jest.fn().mockReturnValue("UUID()"),
				uuidToBin: jest.fn().mockImplementation((uuid: string) => uuid),
				binToUuid: jest.fn().mockImplementation((bin: string) => bin)
			}
		};
		mockDb.mockReturnValue(mockQuery);

		// Create a mock database that returns the mockQuery
		const mockDatabase = jest.fn().mockReturnValue(mockQuery) as unknown as typeof db;
		(mockDatabase as typeof db & { fn: MockQuery["fn"] }).fn = mockQuery.fn;

		publishRepository = new PublishRepository({ db: mockDatabase });
	});

	describe("retireCurrentPublishedVersions", () => {
		it("should successfully retire published versions", async () => {
			// Mock the select query to return version IDs
			const mockVersions = [{ id: "version-1" }, { id: "version-2" }];

			// Create separate mocks for the two queries (select and update)
			const mockSelectQuery = {
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis()
			};

			const mockUpdateQuery = {
				whereIn: jest.fn().mockReturnThis(),
				update: jest.fn().mockResolvedValue(2)
			};

			// Make the select query resolve with the versions after all where calls
			mockSelectQuery.where.mockImplementation(function (this: typeof mockSelectQuery, ...args: unknown[]) {
				// On last where call, return promise that resolves to mockVersions
				if (args[0] === "is_current") {
					return Promise.resolve(mockVersions);
				}
				return this;
			});

			// Mock the database to return different queries based on call order
			let callCount = 0;
			const mockDatabase = jest.fn().mockImplementation(() => {
				callCount++;
				if (callCount === 1) {
					return mockSelectQuery; // First call is for select
				} else {
					return mockUpdateQuery; // Second call is for update
				}
			}) as unknown as typeof db;

			(mockDatabase as typeof db & { fn: MockQuery["fn"] }).fn = {
				now: jest.fn().mockReturnValue("NOW()"),
				uuid: jest.fn().mockReturnValue("UUID()"),
				uuidToBin: jest.fn().mockImplementation((uuid: string) => uuid),
				binToUuid: jest.fn().mockImplementation((bin: string) => bin)
			};

			publishRepository = new PublishRepository({ db: mockDatabase });

			const result = await publishRepository.retireCurrentPublishedVersions("workflow-123", "user-123");

			// Verify the select query was called correctly
			expect(mockSelectQuery.select).toHaveBeenCalledWith("id");
			expect(mockSelectQuery.where).toHaveBeenCalledWith("workflow_id", "workflow-123");
			expect(mockSelectQuery.where).toHaveBeenCalledWith("status", WORKFLOW_STATUS.PUBLISHED);
			expect(mockSelectQuery.where).toHaveBeenCalledWith("is_current", true);

			// Verify the update query was called correctly
			expect(mockUpdateQuery.whereIn).toHaveBeenCalledWith("id", ["version-1", "version-2"]);
			expect(mockUpdateQuery.update).toHaveBeenCalledWith({
				status: WORKFLOW_STATUS.ARCHIVED,
				is_current: false,
				updated_by: "user-123",
				updated_at: "NOW()"
			});

			// The method should return the array of version IDs
			expect(result).toEqual(["version-1", "version-2"]);
		});

		it("should handle database errors", async () => {
			const error = new Error("Database connection failed");
			// Mock the select query to succeed but the update to fail
			mockQuery.select.mockResolvedValue([{ id: "version-1" }]);
			mockQuery.update.mockRejectedValue(error);

			await expect(publishRepository.retireCurrentPublishedVersions("workflow-123", "user-123")).rejects.toThrow(
				ApiError
			);

			try {
				await publishRepository.retireCurrentPublishedVersions("workflow-123", "user-123");
			} catch (thrownError) {
				expect(thrownError).toBeInstanceOf(ApiError);
				expect((thrownError as ApiError).message).toBe("Failed to archive published versions");
				expect((thrownError as ApiError).status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
				expect((thrownError as ApiError).errorCode).toBe(ERROR_CODES.UNKNOWN_ERROR);
			}
		});
	});

	describe("publishWorkflowVersion", () => {
		it("should successfully publish workflow version", async () => {
			// Mock the update method to return a successful result
			mockQuery.update.mockResolvedValue(1);

			const result = await publishRepository.publishWorkflowVersion("version-123", "user-123");

			expect(mockQuery.where).toHaveBeenCalledWith("id", "version-123");
			expect(mockQuery.update).toHaveBeenCalledWith({
				status: WORKFLOW_STATUS.PUBLISHED,
				is_current: true,
				published_at: expect.any(Date),
				updated_by: "user-123",
				updated_at: "NOW()"
			});
			expect(result).toEqual({
				published_at: expect.any(String) as string
			});
		});

		it("should handle database errors", async () => {
			const error = new Error("Database connection failed");
			mockQuery.update.mockRejectedValue(error);

			await expect(publishRepository.publishWorkflowVersion("version-123", "user-123")).rejects.toThrow(ApiError);

			try {
				await publishRepository.publishWorkflowVersion("version-123", "user-123");
			} catch (thrownError) {
				expect(thrownError).toBeInstanceOf(ApiError);
				expect((thrownError as ApiError).message).toBe("Failed to publish workflow version");
				expect((thrownError as ApiError).status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
				expect((thrownError as ApiError).errorCode).toBe(ERROR_CODES.UNKNOWN_ERROR);
			}
		});
	});

	describe("activateWorkflow", () => {
		it("should successfully activate workflow", async () => {
			mockQuery.update.mockResolvedValue(1);

			await publishRepository.activateWorkflow("workflow-123", "user-123");

			expect(mockQuery.where).toHaveBeenCalledWith("id", "workflow-123");
			expect(mockQuery.update).toHaveBeenCalledWith({
				active: true,
				updated_by: "user-123",
				updated_at: "NOW()"
			});
		});

		it("should handle database errors", async () => {
			mockQuery.update.mockRejectedValue(new Error("Database error"));

			await expect(publishRepository.activateWorkflow("workflow-123", "user-123")).rejects.toThrow();
		});
	});
});
