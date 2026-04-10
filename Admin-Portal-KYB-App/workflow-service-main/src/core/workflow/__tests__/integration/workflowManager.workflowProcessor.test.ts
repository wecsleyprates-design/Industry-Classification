// Mock the dependencies BEFORE importing the module under test
const mockProcessCaseEvent = jest.fn();

// Clear module cache to ensure fresh imports
jest.resetModules();

// Use jest.doMock to ensure mocks are applied before module loading
jest.doMock("#core", () => ({
	workflowManager: {
		processCaseEvent: mockProcessCaseEvent
	}
}));

// Now import the module under test
import { WorkflowProcessor } from "#workers/workflowProcessor";

describe("WorkflowProcessor", () => {
	const mockCaseId = "case-123";
	const mockCustomerId = "customer-456";
	const mockEnqueuedAt = "2024-01-01T00:00:00Z";

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("processWorkflow", () => {
		it("should process workflow using EvaluationEngine", async () => {
			// Setup mocks
			mockProcessCaseEvent.mockResolvedValue(undefined);

			// Execute
			const processor = new WorkflowProcessor();
			const result = await processor.processWorkflow(mockCaseId, mockCustomerId, mockEnqueuedAt);

			// Verify
			expect(mockProcessCaseEvent).toHaveBeenCalledWith(mockCaseId, { customerId: mockCustomerId });

			expect(result).toEqual({
				case_id: mockCaseId,
				customer_id: mockCustomerId,
				status: "completed",
				processed_at: expect.any(String) as string,
				enqueued_at: mockEnqueuedAt
			});
		});

		it("should handle EvaluationEngine errors", async () => {
			// Setup mocks
			const mockError = new Error("Evaluation engine failed");
			mockProcessCaseEvent.mockRejectedValue(mockError);

			// Execute and expect error
			const processor = new WorkflowProcessor();
			await expect(processor.processWorkflow(mockCaseId, mockCustomerId, mockEnqueuedAt)).rejects.toThrow(
				"Evaluation engine failed"
			);

			// Verify
			expect(mockProcessCaseEvent).toHaveBeenCalledWith(mockCaseId, { customerId: mockCustomerId });
		});
	});
});
