import { ActionProcessor } from "#core/actions/actionProcessor";
import { ACTION_TYPES } from "#constants";
import type { CaseData } from "#core/types";
import type { WorkflowAction } from "#core/actions/types";

jest.mock("#helpers/logger", () => ({
	logger: {
		debug: jest.fn(),
		warn: jest.fn(),
		error: jest.fn()
	}
}));

jest.mock("#core/actions/setFieldStrategy", () => ({
	SetFieldStrategy: jest.fn().mockImplementation(() => ({
		execute: jest.fn().mockResolvedValue(undefined)
	}))
}));

import { logger } from "#helpers/logger";
import * as mockSetFieldStrategy from "#core/actions/setFieldStrategy";

describe("ActionProcessor", () => {
	let actionProcessor: ActionProcessor;
	let mockCaseData: CaseData;

	beforeEach(() => {
		actionProcessor = new ActionProcessor();
		mockCaseData = {
			id: "case-123",
			customer_id: "customer-456",
			status: "SUBMITTED",
			business_id: "business-789",
			created_at: new Date("2024-01-01T00:00:00Z"),
			updated_at: new Date("2024-01-01T00:00:00Z")
		};
	});

	describe("processActions", () => {
		it("should process multiple actions sequentially", async () => {
			const actions: WorkflowAction[] = [
				{
					type: ACTION_TYPES.SET_FIELD,
					parameters: { field: "case.status", value: "APPROVED" }
				},
				{
					type: ACTION_TYPES.SET_FIELD,
					parameters: { field: "case.priority", value: "HIGH" }
				}
			];

			await actionProcessor.processActions(actions, mockCaseData);

			expect(actions).toHaveLength(2);
		});

		it("should handle empty actions array", async () => {
			await expect(actionProcessor.processActions([], mockCaseData)).resolves.not.toThrow();
		});

		it("should throw error when action execution fails", async () => {
			const mockExecute = jest.fn().mockRejectedValue(new Error("Strategy execution failed"));
			(mockSetFieldStrategy.SetFieldStrategy as jest.Mock).mockImplementation(() => ({
				execute: mockExecute
			}));

			const actionProcessor = new ActionProcessor();
			const actions: WorkflowAction[] = [
				{
					type: ACTION_TYPES.SET_FIELD,
					parameters: { field: "case.status", value: "APPROVED" }
				}
			];

			await expect(actionProcessor.processActions(actions, mockCaseData)).rejects.toThrow("Strategy execution failed");
		});
	});

	describe("processAction", () => {
		it("should warn and return for unknown action type", async () => {
			const action: WorkflowAction = {
				type: "UNKNOWN_ACTION" as WorkflowAction["type"], // Intentionally invalid for testing
				parameters: {}
			} as WorkflowAction;

			await actionProcessor.processActions([action], mockCaseData);

			expect(logger.warn).toHaveBeenCalledWith("Unknown action type: UNKNOWN_ACTION for case case-123");
		});

		it("should execute known action type successfully", async () => {
			const mockExecute = jest.fn().mockResolvedValue(undefined);
			(mockSetFieldStrategy.SetFieldStrategy as jest.Mock).mockImplementation(() => ({
				execute: mockExecute
			}));

			const actionProcessor = new ActionProcessor();
			const action: WorkflowAction = {
				type: ACTION_TYPES.SET_FIELD,
				parameters: { field: "case.status", value: "APPROVED" }
			};

			await actionProcessor.processActions([action], mockCaseData);

			expect(mockExecute).toHaveBeenCalledWith(action.parameters, mockCaseData);
		});
	});
});
