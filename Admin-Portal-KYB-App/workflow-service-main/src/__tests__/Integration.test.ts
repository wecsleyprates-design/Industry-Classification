/**
 * Integration test to verify the workflow between the queue system and evaluation engine
 * This test verifies the conceptual integration without requiring actual dependencies
 */

// Mock the dependencies BEFORE importing the module under test
const mockProcessCaseEvent = jest.fn();

// Clear module cache to ensure fresh imports
jest.resetModules();

// Use jest.doMock to ensure mocks are applied before module loading
jest.doMock("../core", () => ({
	workflowManager: {
		processCaseEvent: mockProcessCaseEvent
	}
}));

// Now import the module under test
import { WorkflowProcessor } from "../workers/workflowProcessor";

describe("Workflow Integration", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("should integrate WorkflowProcessor with EvaluationEngine", async () => {
		// This test verifies that:
		// 1. WorkflowProcessor can call EvaluationEngine
		// 2. The message format is correctly transformed
		// 3. The integration point works as expected

		const mockCaseId = "case-123";
		const mockCustomerId = "customer-456";
		const mockEnqueuedAt = "2024-01-01T00:00:00Z";

		// Setup mock to return successfully
		mockProcessCaseEvent.mockResolvedValue(undefined);

		// Execute the workflow processor
		const processor = new WorkflowProcessor();
		const result = await processor.processWorkflow(mockCaseId, mockCustomerId, mockEnqueuedAt);

		// Verify the result structure matches the expected format
		expect(result).toEqual({
			case_id: mockCaseId,
			customer_id: mockCustomerId,
			status: "completed",
			processed_at: expect.any(String) as string,
			enqueued_at: mockEnqueuedAt
		});

		// Verify that EvaluationEngine.processCaseEvent was called with the correct message format
		expect(mockProcessCaseEvent).toHaveBeenCalledWith(mockCaseId, { customerId: mockCustomerId });
	});

	it("should handle EvaluationEngine errors gracefully", async () => {
		// Mock EvaluationEngine to throw an error
		mockProcessCaseEvent.mockRejectedValueOnce(new Error("Evaluation failed"));

		const processor = new WorkflowProcessor();

		// Should propagate the error
		await expect(processor.processWorkflow("case-123", "customer-456", "2024-01-01T00:00:00Z")).rejects.toThrow(
			"Evaluation failed"
		);
	});
});
