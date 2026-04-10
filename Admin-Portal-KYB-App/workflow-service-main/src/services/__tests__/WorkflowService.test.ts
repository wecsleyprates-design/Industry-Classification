/**
 * Tests for the complete workflow service integration
 * Covers the core integration points without complex dependencies
 */

// Mock the dependencies BEFORE importing the module under test
const mockProcessCaseEvent = jest.fn();

// Clear module cache to ensure fresh imports
jest.resetModules();

// Use jest.doMock to ensure mocks are applied before module loading
jest.doMock("../../core", () => ({
	workflowManager: {
		processCaseEvent: mockProcessCaseEvent
	}
}));

// Now import the module under test
import { WorkflowProcessor } from "#workers/workflowProcessor";

describe("Workflow Service Integration", () => {
	const mockCaseId = "case-123";
	const mockCustomerId = "customer-456";
	const mockEnqueuedAt = "2024-01-01T00:00:00Z";

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("Core Integration", () => {
		it("should integrate WorkflowProcessor with EvaluationEngine", async () => {
			// Setup mocks
			mockProcessCaseEvent.mockResolvedValue(undefined);

			// Execute
			const processor = new WorkflowProcessor();
			const result = await processor.processWorkflow(mockCaseId, mockCustomerId, mockEnqueuedAt);

			// Verify EvaluationEngine was called with correct parameters
			expect(mockProcessCaseEvent).toHaveBeenCalledWith(mockCaseId, { customerId: mockCustomerId });

			// Verify result format
			expect(result).toEqual({
				case_id: mockCaseId,
				customer_id: mockCustomerId,
				status: "completed",
				processed_at: expect.any(String) as string,
				enqueued_at: mockEnqueuedAt
			});
		});

		it("should handle EvaluationEngine errors gracefully", async () => {
			// Setup mocks
			mockProcessCaseEvent.mockRejectedValue(new Error("Evaluation failed"));

			// Execute and expect error
			const processor = new WorkflowProcessor();
			await expect(processor.processWorkflow(mockCaseId, mockCustomerId, mockEnqueuedAt)).rejects.toThrow(
				"Evaluation failed"
			);
		});

		it("should pass correct parameters to EvaluationEngine", async () => {
			// This test specifically validates the parameters passed
			mockProcessCaseEvent.mockResolvedValue(undefined);

			const processor = new WorkflowProcessor();
			await processor.processWorkflow("case-456", "customer-789", "2024-01-01T12:00:00Z");

			// Verify the exact parameters passed to EvaluationEngine
			expect(mockProcessCaseEvent).toHaveBeenCalledWith("case-456", { customerId: "customer-789" });
		});
	});
});
