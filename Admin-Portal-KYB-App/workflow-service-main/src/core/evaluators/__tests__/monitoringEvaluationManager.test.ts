import { MonitoringEvaluationManager } from "../monitoringEvaluationManager";
import type { SharedRuleManager } from "#core/shared/sharedRuleManager";
import { ApiError } from "#types/common";
import { StatusCodes } from "http-status-codes";
import { WORKFLOW_ERROR_CODES_COMBINED as ERROR_CODES } from "#constants";

const staticConditions = {
	operator: "AND" as const,
	conditions: [{ field: "facts.country", operator: "=" as const, value: "US" }]
};

const variationConditions = {
	operator: "AND" as const,
	conditions: [{ field: "facts.amount", operator: "INCREASED_BY" as const, value: 1 }]
};

describe("MonitoringEvaluationManager.evaluateRules", () => {
	let mockShared: { getMonitoringRulesByIds: jest.Mock };
	let manager: MonitoringEvaluationManager;

	beforeEach(() => {
		mockShared = {
			getMonitoringRulesByIds: jest.fn()
		};
		manager = new MonitoringEvaluationManager(mockShared as unknown as SharedRuleManager);
	});

	it("throws 400 when ruleIds is an empty array", async () => {
		await expect(
			manager.evaluateRules({
				currentState: { facts: { country: "US" } },
				ruleIds: []
			})
		).rejects.toMatchObject({
			status: StatusCodes.BAD_REQUEST,
			errorCode: ERROR_CODES.INVALID
		});
		expect(mockShared.getMonitoringRulesByIds).not.toHaveBeenCalled();
	});

	it("throws 400 when a rule uses variation DSL but previousState is missing", async () => {
		const ruleId = "660e8400-e29b-41d4-a716-446655440001";
		mockShared.getMonitoringRulesByIds.mockResolvedValue([
			{ id: ruleId, name: "Variation rule", conditions: variationConditions }
		]);

		await expect(
			manager.evaluateRules({
				currentState: { facts: { amount: 2 } },
				ruleIds: [ruleId]
			})
		).rejects.toMatchObject({
			status: StatusCodes.BAD_REQUEST,
			message: expect.stringContaining(ruleId)
		});
	});

	it("returns rule_id, rule_name and matched for static evaluation", async () => {
		const ruleId = "660e8400-e29b-41d4-a716-446655440001";
		mockShared.getMonitoringRulesByIds.mockResolvedValue([
			{ id: ruleId, name: "Country US", conditions: staticConditions }
		]);

		const result = await manager.evaluateRules({
			currentState: { facts: { country: "US" } },
			ruleIds: [ruleId],
			evaluationId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
		});

		expect(mockShared.getMonitoringRulesByIds).toHaveBeenCalledWith([ruleId]);
		expect(result.evaluation_id).toBe("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
		expect(result.results).toHaveLength(1);
		expect(result.results[0]).toMatchObject({
			rule_id: ruleId,
			rule_name: "Country US",
			matched: true
		});
		expect(result.results[0].true_conditions.length + result.results[0].false_conditions.length).toBeGreaterThan(0);
	});

	it("propagates ApiError from sharedRuleManager", async () => {
		const err = new ApiError("Rules not found: x", StatusCodes.NOT_FOUND, ERROR_CODES.WORKFLOW_NOT_FOUND);
		mockShared.getMonitoringRulesByIds.mockRejectedValue(err);

		await expect(
			manager.evaluateRules({
				currentState: {},
				ruleIds: ["660e8400-e29b-41d4-a716-446655440001"]
			})
		).rejects.toBe(err);
	});
});
