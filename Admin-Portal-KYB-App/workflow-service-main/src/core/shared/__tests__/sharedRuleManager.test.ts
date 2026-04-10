import { StatusCodes } from "http-status-codes";
import { ERROR_MESSAGES } from "#constants";
import { SharedRuleManager } from "../sharedRuleManager";
import type { SharedRuleRepository } from "../sharedRuleRepository";
import type { SharedRuleVersionRepository } from "../sharedRuleVersionRepository";
import type { SharedRuleRow } from "../types";

const RULE_ID = "550e8400-e29b-41d4-a716-446655440000";
const VERSION_ID = "660e8400-e29b-41d4-a716-446655440001";
const conditions = { operator: "AND" as const, conditions: [{ field: "x", operator: "=" as const, value: 1 }] };

/** Conditions that are never equal to `conditions`, so updateRule still creates a new version when tests expect it. */
const staleConditions = {
	operator: "AND" as const,
	conditions: [{ field: "stale", operator: "=" as const, value: 0 }]
};

const mockRuleRow: SharedRuleRow = {
	id: RULE_ID,
	context_type: "monitoring",
	context_id: "770e8400-e29b-41d4-a716-446655440002",
	name: "Test Rule",
	description: null,
	created_at: new Date(),
	updated_at: new Date()
};

describe("SharedRuleManager", () => {
	let manager: SharedRuleManager;
	let mockRuleRepository: jest.Mocked<SharedRuleRepository>;
	let mockVersionRepository: jest.Mocked<SharedRuleVersionRepository>;
	let mockTrx: object;

	beforeEach(() => {
		mockTrx = {};
		mockRuleRepository = {
			transaction: jest.fn().mockImplementation((cb: (trx: object) => Promise<unknown>) => cb(mockTrx)),
			insert: jest.fn(),
			getById: jest.fn(),
			updateMetadata: jest.fn(),
			getRuleDetailsBatchByIds: jest.fn()
		} as unknown as jest.Mocked<SharedRuleRepository>;

		mockVersionRepository = {
			insert: jest.fn(),
			getMaxVersionNumber: jest.fn(),
			getLatestVersionConditions: jest.fn().mockResolvedValue(staleConditions)
		} as unknown as jest.Mocked<SharedRuleVersionRepository>;

		manager = new SharedRuleManager(mockRuleRepository, mockVersionRepository);
		jest.clearAllMocks();
	});

	describe("createRule", () => {
		it("should create rule and initial version inside a transaction", async () => {
			const payload = {
				context_type: "monitoring",
				context_id: "ctx-uuid",
				name: "My Rule",
				description: "Desc",
				conditions
			};
			mockRuleRepository.insert.mockResolvedValue(RULE_ID);
			mockVersionRepository.insert.mockResolvedValue(VERSION_ID);

			const result = await manager.createRule(payload, "user-uuid");

			expect(mockRuleRepository.transaction).toHaveBeenCalledTimes(1);
			expect(mockRuleRepository.insert).toHaveBeenCalledWith(payload, mockTrx);
			expect(mockVersionRepository.insert).toHaveBeenCalledWith(
				RULE_ID,
				1,
				{ conditions: payload.conditions, created_by: "user-uuid" },
				mockTrx
			);
			expect(result).toEqual({ rule_id: RULE_ID, version_id: VERSION_ID });
		});

		it("should pass created_by as null when not provided", async () => {
			const payload = {
				context_type: "monitoring",
				context_id: "ctx-uuid",
				name: "Rule",
				conditions
			};
			mockRuleRepository.insert.mockResolvedValue(RULE_ID);
			mockVersionRepository.insert.mockResolvedValue(VERSION_ID);

			await manager.createRule(payload);

			expect(mockVersionRepository.insert).toHaveBeenCalledWith(
				RULE_ID,
				1,
				{ conditions: payload.conditions, created_by: null },
				mockTrx
			);
		});

		it("should propagate errors from transaction", async () => {
			const payload = {
				context_type: "monitoring",
				context_id: "ctx-uuid",
				name: "Rule",
				conditions
			};
			const err = new Error("DB error");
			mockRuleRepository.transaction.mockRejectedValue(err);

			await expect(manager.createRule(payload)).rejects.toThrow("DB error");
		});
	});

	describe("updateRuleMetadata", () => {
		it("should update metadata when rule exists", async () => {
			mockRuleRepository.getById.mockResolvedValue(mockRuleRow);
			mockRuleRepository.updateMetadata.mockResolvedValue(undefined);

			await manager.updateRuleMetadata(RULE_ID, { name: "New Name", description: "New desc" });

			expect(mockRuleRepository.getById).toHaveBeenCalledWith(RULE_ID, undefined);
			expect(mockRuleRepository.updateMetadata).toHaveBeenCalledWith(
				RULE_ID,
				{ name: "New Name", description: "New desc" },
				undefined
			);
		});

		it("should throw ApiError NOT_FOUND when rule does not exist", async () => {
			mockRuleRepository.getById.mockResolvedValue(null);

			await expect(manager.updateRuleMetadata(RULE_ID, { name: "New Name" })).rejects.toMatchObject({
				message: ERROR_MESSAGES.SHARED_RULE_NOT_FOUND,
				status: StatusCodes.NOT_FOUND
			});
			expect(mockRuleRepository.updateMetadata).not.toHaveBeenCalled();
		});

		it("should pass trx to getById and updateMetadata", async () => {
			mockRuleRepository.getById.mockResolvedValue(mockRuleRow);
			mockRuleRepository.updateMetadata.mockResolvedValue(undefined);

			await manager.updateRuleMetadata(RULE_ID, { name: "X" }, mockTrx as never);

			expect(mockRuleRepository.getById).toHaveBeenCalledWith(RULE_ID, mockTrx);
			expect(mockRuleRepository.updateMetadata).toHaveBeenCalledWith(RULE_ID, { name: "X" }, mockTrx);
		});
	});

	describe("addRuleVersion", () => {
		it("should add version when rule exists and return version_id and version_number", async () => {
			mockRuleRepository.getById.mockResolvedValue(mockRuleRow);
			mockVersionRepository.getMaxVersionNumber.mockResolvedValue(1);
			mockVersionRepository.insert.mockResolvedValue(VERSION_ID);

			const result = await manager.addRuleVersion(RULE_ID, { conditions, created_by: "user-id" }, "user-id");

			expect(mockRuleRepository.getById).toHaveBeenCalledWith(RULE_ID, undefined, true);
			expect(mockVersionRepository.getMaxVersionNumber).toHaveBeenCalledWith(RULE_ID, undefined);
			expect(mockVersionRepository.insert).toHaveBeenCalledWith(
				RULE_ID,
				2,
				{ conditions, created_by: "user-id" },
				undefined
			);
			expect(result).toEqual({ version_id: VERSION_ID, version_number: 2 });
		});

		it("should throw ApiError NOT_FOUND when rule does not exist", async () => {
			mockRuleRepository.getById.mockResolvedValue(null);

			await expect(manager.addRuleVersion(RULE_ID, { conditions })).rejects.toMatchObject({
				message: ERROR_MESSAGES.SHARED_RULE_NOT_FOUND,
				status: StatusCodes.NOT_FOUND
			});
			expect(mockVersionRepository.insert).not.toHaveBeenCalled();
		});

		it("should use version 1 when getMaxVersionNumber returns 0", async () => {
			mockRuleRepository.getById.mockResolvedValue(mockRuleRow);
			mockVersionRepository.getMaxVersionNumber.mockResolvedValue(0);
			mockVersionRepository.insert.mockResolvedValue(VERSION_ID);

			await manager.addRuleVersion(RULE_ID, { conditions });

			expect(mockVersionRepository.insert).toHaveBeenCalledWith(
				RULE_ID,
				1,
				{ conditions, created_by: null },
				undefined
			);
		});
	});

	describe("updateRule", () => {
		it("should update only metadata when payload has name/description only", async () => {
			mockRuleRepository.transaction.mockImplementation(cb => cb(mockTrx as never));
			mockRuleRepository.getById.mockResolvedValue(mockRuleRow);
			mockRuleRepository.updateMetadata.mockResolvedValue(undefined);

			const result = await manager.updateRule(RULE_ID, {
				name: "Updated",
				description: "Desc"
			});

			expect(mockRuleRepository.transaction).toHaveBeenCalledTimes(1);
			expect(mockRuleRepository.updateMetadata).toHaveBeenCalledWith(
				RULE_ID,
				{ name: "Updated", description: "Desc" },
				mockTrx
			);
			expect(mockVersionRepository.insert).not.toHaveBeenCalled();
			expect(result).toEqual({});
		});

		it("should add version only when payload has conditions only", async () => {
			mockRuleRepository.transaction.mockImplementation(cb => cb(mockTrx as never));
			mockRuleRepository.getById.mockResolvedValue(mockRuleRow);
			mockVersionRepository.getMaxVersionNumber.mockResolvedValue(1);
			mockVersionRepository.insert.mockResolvedValue(VERSION_ID);

			const result = await manager.updateRule(RULE_ID, {
				conditions,
				created_by: "user-uuid"
			});

			expect(mockRuleRepository.updateMetadata).not.toHaveBeenCalled();
			expect(mockVersionRepository.getLatestVersionConditions).toHaveBeenCalledWith(RULE_ID, mockTrx);
			expect(mockVersionRepository.getMaxVersionNumber).toHaveBeenCalledWith(RULE_ID, mockTrx);
			expect(mockVersionRepository.insert).toHaveBeenCalledWith(
				RULE_ID,
				2,
				{ conditions, created_by: "user-uuid" },
				mockTrx
			);
			expect(result).toEqual({ version_id: VERSION_ID, version_number: 2 });
		});

		it("should not add a version when conditions match the latest stored DSL", async () => {
			mockRuleRepository.transaction.mockImplementation(cb => cb(mockTrx as never));
			mockRuleRepository.getById.mockResolvedValue(mockRuleRow);
			mockVersionRepository.getLatestVersionConditions.mockResolvedValue(conditions);

			const result = await manager.updateRule(RULE_ID, {
				conditions,
				created_by: "user-uuid"
			});

			expect(mockVersionRepository.getLatestVersionConditions).toHaveBeenCalledWith(RULE_ID, mockTrx);
			expect(mockVersionRepository.getMaxVersionNumber).not.toHaveBeenCalled();
			expect(mockVersionRepository.insert).not.toHaveBeenCalled();
			expect(result).toEqual({});
		});

		it("should update metadata without a new version when conditions are unchanged", async () => {
			mockRuleRepository.transaction.mockImplementation(cb => cb(mockTrx as never));
			mockRuleRepository.getById.mockResolvedValue(mockRuleRow);
			mockRuleRepository.updateMetadata.mockResolvedValue(undefined);
			mockVersionRepository.getLatestVersionConditions.mockResolvedValue(conditions);

			const result = await manager.updateRule(RULE_ID, {
				name: "New Name",
				conditions,
				created_by: "user-uuid"
			});

			expect(mockRuleRepository.updateMetadata).toHaveBeenCalledWith(RULE_ID, { name: "New Name" }, mockTrx);
			expect(mockVersionRepository.insert).not.toHaveBeenCalled();
			expect(result).toEqual({});
		});

		it("should add a version when there is no prior version row (latest is null)", async () => {
			mockRuleRepository.transaction.mockImplementation(cb => cb(mockTrx as never));
			mockRuleRepository.getById.mockResolvedValue(mockRuleRow);
			mockVersionRepository.getLatestVersionConditions.mockResolvedValue(null);
			mockVersionRepository.getMaxVersionNumber.mockResolvedValue(0);
			mockVersionRepository.insert.mockResolvedValue(VERSION_ID);

			const result = await manager.updateRule(RULE_ID, {
				conditions,
				created_by: "user-uuid"
			});

			expect(mockVersionRepository.insert).toHaveBeenCalled();
			expect(result).toEqual({ version_id: VERSION_ID, version_number: 1 });
		});

		it("should update metadata and add version when payload has both", async () => {
			mockRuleRepository.transaction.mockImplementation(cb => cb(mockTrx as never));
			mockRuleRepository.getById.mockResolvedValue(mockRuleRow);
			mockRuleRepository.updateMetadata.mockResolvedValue(undefined);
			mockVersionRepository.getMaxVersionNumber.mockResolvedValue(2);
			mockVersionRepository.insert.mockResolvedValue(VERSION_ID);

			const result = await manager.updateRule(RULE_ID, {
				name: "New Name",
				conditions,
				created_by: "user-uuid"
			});

			expect(mockRuleRepository.updateMetadata).toHaveBeenCalledWith(RULE_ID, { name: "New Name" }, mockTrx);
			expect(mockVersionRepository.insert).toHaveBeenCalledWith(
				RULE_ID,
				3,
				{ conditions, created_by: "user-uuid" },
				mockTrx
			);
			expect(result).toEqual({ version_id: VERSION_ID, version_number: 3 });
		});

		it("should throw when rule not found during metadata update", async () => {
			mockRuleRepository.transaction.mockImplementation(cb => cb(mockTrx as never));
			mockRuleRepository.getById.mockResolvedValue(null);

			await expect(manager.updateRule(RULE_ID, { name: "X" })).rejects.toMatchObject({
				message: ERROR_MESSAGES.SHARED_RULE_NOT_FOUND,
				status: StatusCodes.NOT_FOUND
			});
		});

		it("should throw when rule not found during add version", async () => {
			mockRuleRepository.transaction.mockImplementation(cb => cb(mockTrx as never));
			mockRuleRepository.getById.mockResolvedValueOnce(mockRuleRow).mockResolvedValueOnce(null);

			mockRuleRepository.updateMetadata.mockResolvedValue(undefined);

			await expect(manager.updateRule(RULE_ID, { name: "X", conditions })).rejects.toMatchObject({
				message: ERROR_MESSAGES.SHARED_RULE_NOT_FOUND,
				status: StatusCodes.NOT_FOUND
			});
		});
	});

	describe("getRuleDetailsBatchByIds", () => {
		it("delegates to ruleRepository.getRuleDetailsBatchByIds", async () => {
			const batchResult = { rules: [], missing_rule_ids: [RULE_ID] };
			mockRuleRepository.getRuleDetailsBatchByIds.mockResolvedValue(batchResult);

			const result = await manager.getRuleDetailsBatchByIds([RULE_ID]);

			expect(mockRuleRepository.getRuleDetailsBatchByIds).toHaveBeenCalledWith([RULE_ID]);
			expect(result).toBe(batchResult);
		});
	});
});
