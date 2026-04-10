import { sharedRuleManager, monitoringEvaluationManager } from "#core";
import { StatusCodes } from "http-status-codes";
import { SUCCESS_MESSAGES } from "#constants";
import type { Request, Response } from "express";
const TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const INITIATED_BY_USER_ID = "880e8400-e29b-41d4-a716-446655440099";
const TEST_RULE_ID = "660e8400-e29b-41d4-a716-446655440001";
const TEST_VERSION_ID = "770e8400-e29b-41d4-a716-446655440002";

const validConditions = {
	operator: "AND" as const,
	conditions: [
		{
			field: "facts.country",
			operator: "=" as const,
			value: "US"
		}
	]
};

jest.mock("#core", () => ({
	sharedRuleManager: {
		createRule: jest.fn(),
		updateRule: jest.fn(),
		getRuleDetailsBatchByIds: jest.fn()
	},
	monitoringEvaluationManager: {
		evaluateRules: jest.fn()
	}
}));

import { controller } from "../controller";

const mockSharedRuleManager = sharedRuleManager as jest.Mocked<typeof sharedRuleManager>;
const mockMonitoringEvaluationManager = monitoringEvaluationManager as jest.Mocked<typeof monitoringEvaluationManager>;

describe("Shared Controller", () => {
	let mockReq: Partial<Request>;
	let mockRes: Partial<Response>;
	let mockNext: jest.Mock;

	beforeEach(() => {
		mockReq = {
			body: {},
			params: {}
		};

		mockRes = {
			status: jest.fn().mockReturnThis(),
			jsend: {
				success: jest.fn()
			},
			locals: {}
		} as unknown as Response;

		mockNext = jest.fn();
		jest.clearAllMocks();
	});

	describe("createRule", () => {
		it("should create a rule and return 201 with rule_id and version_id", async () => {
			const body = {
				context_type: "monitoring" as const,
				context_id: "550e8400-e29b-41d4-a716-446655440010",
				name: "Test Rule",
				description: "Optional description",
				conditions: validConditions,
				initiated_by_user_id: INITIATED_BY_USER_ID
			};
			mockReq.body = body;

			mockSharedRuleManager.createRule.mockResolvedValue({
				rule_id: TEST_RULE_ID,
				version_id: TEST_VERSION_ID
			});

			await controller.createRule(mockReq as Request, mockRes as Response, mockNext);

			expect(mockSharedRuleManager.createRule).toHaveBeenCalledTimes(1);
			expect(mockSharedRuleManager.createRule).toHaveBeenCalledWith(
				{
					context_type: body.context_type,
					context_id: body.context_id,
					name: body.name,
					description: body.description ?? undefined,
					conditions: body.conditions
				},
				INITIATED_BY_USER_ID
			);
			expect(mockRes.jsend?.success).toHaveBeenCalledWith(
				{
					rule_id: TEST_RULE_ID,
					version_id: TEST_VERSION_ID
				},
				SUCCESS_MESSAGES.RULE_CREATED,
				StatusCodes.CREATED
			);
		});

		it("should pass initiated_by_user_id from body to createRule as createdBy", async () => {
			mockReq.body = {
				context_type: "monitoring",
				context_id: "550e8400-e29b-41d4-a716-446655440010",
				name: "Rule",
				conditions: validConditions,
				initiated_by_user_id: TEST_USER_ID
			};

			mockSharedRuleManager.createRule.mockResolvedValue({
				rule_id: TEST_RULE_ID,
				version_id: TEST_VERSION_ID
			});

			await controller.createRule(mockReq as Request, mockRes as Response, mockNext);

			expect(mockSharedRuleManager.createRule).toHaveBeenCalledWith(expect.any(Object), TEST_USER_ID);
		});

		it("should call next with error when createRule rejects", async () => {
			mockReq.body = {
				context_type: "monitoring",
				context_id: "550e8400-e29b-41d4-a716-446655440010",
				name: "Rule",
				conditions: validConditions,
				initiated_by_user_id: INITIATED_BY_USER_ID
			};

			const error = new Error("Failed to create rule");
			mockSharedRuleManager.createRule.mockRejectedValue(error);

			await controller.createRule(mockReq as Request, mockRes as Response, mockNext);

			expect(mockSharedRuleManager.createRule).toHaveBeenCalledTimes(1);
			expect(mockRes.jsend?.success).not.toHaveBeenCalled();
			expect(mockNext).toHaveBeenCalledWith(error);
		});
	});

	describe("updateRule", () => {
		it("should update rule metadata only and return 200 without version_id", async () => {
			mockReq.params = { id: TEST_RULE_ID };
			mockReq.body = {
				name: "Updated Name",
				description: "Updated description",
				initiated_by_user_id: TEST_USER_ID
			};

			mockSharedRuleManager.updateRule.mockResolvedValue({});

			await controller.updateRule(mockReq as Request, mockRes as Response, mockNext);

			expect(mockSharedRuleManager.updateRule).toHaveBeenCalledTimes(1);
			expect(mockSharedRuleManager.updateRule).toHaveBeenCalledWith(TEST_RULE_ID, {
				name: "Updated Name",
				description: "Updated description",
				conditions: undefined,
				created_by: TEST_USER_ID
			});
			expect(mockRes.jsend?.success).toHaveBeenCalledWith(
				{ rule_id: TEST_RULE_ID },
				SUCCESS_MESSAGES.RULE_UPDATED,
				StatusCodes.OK
			);
		});

		it("should update conditions and return 200 with version_id and version_number", async () => {
			mockReq.params = { id: TEST_RULE_ID };
			mockReq.body = {
				conditions: validConditions,
				initiated_by_user_id: TEST_USER_ID
			};

			mockSharedRuleManager.updateRule.mockResolvedValue({
				version_id: TEST_VERSION_ID,
				version_number: 2
			});

			await controller.updateRule(mockReq as Request, mockRes as Response, mockNext);

			expect(mockSharedRuleManager.updateRule).toHaveBeenCalledWith(TEST_RULE_ID, {
				name: undefined,
				description: undefined,
				conditions: validConditions,
				created_by: TEST_USER_ID
			});
			expect(mockRes.jsend?.success).toHaveBeenCalledWith(
				{
					rule_id: TEST_RULE_ID,
					version_id: TEST_VERSION_ID,
					version_number: 2
				},
				SUCCESS_MESSAGES.RULE_UPDATED,
				StatusCodes.OK
			);
		});

		it("should update both metadata and conditions and return version info", async () => {
			mockReq.params = { id: TEST_RULE_ID };
			mockReq.body = {
				name: "New Name",
				conditions: validConditions,
				initiated_by_user_id: TEST_USER_ID
			};

			mockSharedRuleManager.updateRule.mockResolvedValue({
				version_id: TEST_VERSION_ID,
				version_number: 2
			});

			await controller.updateRule(mockReq as Request, mockRes as Response, mockNext);

			expect(mockSharedRuleManager.updateRule).toHaveBeenCalledWith(TEST_RULE_ID, {
				name: "New Name",
				description: undefined,
				conditions: validConditions,
				created_by: TEST_USER_ID
			});
			expect(mockRes.jsend?.success).toHaveBeenCalledWith(
				{
					rule_id: TEST_RULE_ID,
					version_id: TEST_VERSION_ID,
					version_number: 2
				},
				SUCCESS_MESSAGES.RULE_UPDATED,
				StatusCodes.OK
			);
		});

		it("should pass initiated_by_user_id from body to updateRule as created_by", async () => {
			mockReq.params = { id: TEST_RULE_ID };
			mockReq.body = { name: "Only name", initiated_by_user_id: "another-user-id" };

			mockSharedRuleManager.updateRule.mockResolvedValue({});

			await controller.updateRule(mockReq as Request, mockRes as Response, mockNext);

			expect(mockSharedRuleManager.updateRule).toHaveBeenCalledWith(
				TEST_RULE_ID,
				expect.objectContaining({ created_by: "another-user-id" })
			);
		});

		it("should call next with error when updateRule rejects", async () => {
			mockReq.params = { id: TEST_RULE_ID };
			mockReq.body = { name: "Updated", initiated_by_user_id: INITIATED_BY_USER_ID };

			const error = new Error("Rule not found");
			mockSharedRuleManager.updateRule.mockRejectedValue(error);

			await controller.updateRule(mockReq as Request, mockRes as Response, mockNext);

			expect(mockSharedRuleManager.updateRule).toHaveBeenCalledTimes(1);
			expect(mockRes.jsend?.success).not.toHaveBeenCalled();
			expect(mockNext).toHaveBeenCalledWith(error);
		});
	});

	describe("evaluateRules", () => {
		it("should return 200 with evaluation data from monitoringEvaluationManager", async () => {
			const evalBody = {
				currentState: { facts: { country: "US" } },
				ruleIds: [TEST_RULE_ID],
				evaluationId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
			};
			mockReq.body = evalBody;

			const evalResult = {
				evaluation_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
				results: [
					{
						rule_id: TEST_RULE_ID,
						rule_name: "Test",
						matched: true,
						conditions: {},
						true_conditions: [],
						false_conditions: []
					}
				]
			};
			mockMonitoringEvaluationManager.evaluateRules.mockResolvedValue(evalResult);

			await controller.evaluateRules(mockReq as Request, mockRes as Response, mockNext);

			expect(mockMonitoringEvaluationManager.evaluateRules).toHaveBeenCalledWith(evalBody);
			expect(mockRes.jsend?.success).toHaveBeenCalledWith(
				evalResult,
				SUCCESS_MESSAGES.EVALUATION_COMPLETED,
				StatusCodes.OK
			);
		});

		it("should call next with error when evaluateRules rejects", async () => {
			mockReq.body = { currentState: {}, ruleIds: [TEST_RULE_ID] };
			const error = new Error("boom");
			mockMonitoringEvaluationManager.evaluateRules.mockRejectedValue(error);

			await controller.evaluateRules(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalledWith(error);
		});
	});

	describe("getRuleDetailsBatch", () => {
		const RULE_A = "550e8400-e29b-41d4-a716-446655440010";
		const created = new Date("2025-01-15T12:00:00.000Z");
		const versionCreated = new Date("2025-01-16T08:30:00.000Z");

		it("should return 200 with ISO datetimes and delegate to sharedRuleManager", async () => {
			mockReq.body = { rule_ids: [RULE_A] };
			mockSharedRuleManager.getRuleDetailsBatchByIds.mockResolvedValue({
				rules: [
					{
						rule_id: RULE_A,
						name: "Rule A",
						description: "Desc",
						latest_version_number: 2,
						conditions: validConditions,
						rule_created_at: created,
						version_created_at: versionCreated
					}
				],
				missing_rule_ids: []
			});

			await controller.getRuleDetailsBatch(mockReq as Request, mockRes as Response, mockNext);

			expect(mockSharedRuleManager.getRuleDetailsBatchByIds).toHaveBeenCalledWith([RULE_A]);
			expect(mockRes.jsend?.success).toHaveBeenCalledWith(
				{
					rules: [
						{
							rule_id: RULE_A,
							name: "Rule A",
							description: "Desc",
							latest_version_number: 2,
							conditions: validConditions,
							rule_created_at: created.toISOString(),
							version_created_at: versionCreated.toISOString()
						}
					],
					missing_rule_ids: []
				},
				SUCCESS_MESSAGES.RULE_DETAILS_RETRIEVED,
				StatusCodes.OK
			);
		});

		it("should call next with error when getRuleDetailsBatchByIds rejects", async () => {
			mockReq.body = { rule_ids: [RULE_A] };
			const error = new Error("db error");
			mockSharedRuleManager.getRuleDetailsBatchByIds.mockRejectedValue(error);

			await controller.getRuleDetailsBatch(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalledWith(error);
		});
	});
});
