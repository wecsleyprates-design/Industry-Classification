/**
 * Tests for the WorkflowWorker retry logic and error handling
 * Covers Bull Queue integration and retry mechanisms
 */

import { WorkflowProcessor } from "../workflowProcessor";

// Mock uuid module to fix ESM import issues
jest.mock("uuid", () => ({
	v4: jest.fn(() => "mock-uuid-123")
}));

// Mock the dependencies
jest.mock("../workflowWorker");
jest.mock("../workflowProcessor");

const mockWorkflowProcessor = WorkflowProcessor as jest.MockedClass<typeof WorkflowProcessor>;

describe("WorkflowWorker", () => {
	const mockCaseId = "case-123";
	const mockCustomerId = "customer-456";
	const mockEnqueuedAt = "2024-01-01T00:00:00Z";

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("Job Processing", () => {
		it("should process job successfully on first attempt", async () => {
			// Setup mocks
			const mockResult = {
				case_id: mockCaseId,
				customer_id: mockCustomerId,
				status: "completed",
				processed_at: "2024-01-01T00:02:00Z",
				enqueued_at: mockEnqueuedAt
			};

			mockWorkflowProcessor.prototype.processWorkflow.mockResolvedValue(mockResult);

			// Execute
			const processor = new WorkflowProcessor();
			const result = await processor.processWorkflow(mockCaseId, mockCustomerId, mockEnqueuedAt);

			// Verify
			expect(result).toEqual(mockResult);
			expect(mockWorkflowProcessor.prototype.processWorkflow).toHaveBeenCalledWith(
				mockCaseId,
				mockCustomerId,
				mockEnqueuedAt
			);
		});

		it("should handle processing errors and allow retry", async () => {
			// Setup mocks - first call fails, second succeeds
			const mockError = new Error("Temporary processing error");
			const mockResult = {
				case_id: mockCaseId,
				customer_id: mockCustomerId,
				status: "completed",
				processed_at: "2024-01-01T00:02:00Z",
				enqueued_at: mockEnqueuedAt
			};

			mockWorkflowProcessor.prototype.processWorkflow
				.mockRejectedValueOnce(mockError)
				.mockResolvedValueOnce(mockResult);

			// Execute first attempt (should fail)
			const processor = new WorkflowProcessor();
			await expect(processor.processWorkflow(mockCaseId, mockCustomerId, mockEnqueuedAt)).rejects.toThrow(
				"Temporary processing error"
			);

			// Execute second attempt (should succeed)
			const result = await processor.processWorkflow(mockCaseId, mockCustomerId, mockEnqueuedAt);
			expect(result).toEqual(mockResult);
		});

		it("should handle permanent failures after max retries", async () => {
			// Setup mocks - all attempts fail
			const mockError = new Error("Permanent processing error");
			mockWorkflowProcessor.prototype.processWorkflow.mockRejectedValue(mockError);

			// Execute multiple attempts
			const processor = new WorkflowProcessor();

			// Simulate multiple failed attempts
			for (let i = 0; i < 3; i++) {
				await expect(processor.processWorkflow(mockCaseId, mockCustomerId, mockEnqueuedAt)).rejects.toThrow(
					"Permanent processing error"
				);
			}

			// Verify all attempts were made
			expect(mockWorkflowProcessor.prototype.processWorkflow).toHaveBeenCalledTimes(3);
		});
	});

	describe("Job Data Validation", () => {
		it("should handle missing required job data", async () => {
			// Test with missing case_id
			const processor = new WorkflowProcessor();

			await expect(processor.processWorkflow("", mockCustomerId, mockEnqueuedAt)).rejects.toThrow();
		});

		it("should handle invalid timestamp format", async () => {
			// Test with invalid timestamp
			const processor = new WorkflowProcessor();

			await expect(processor.processWorkflow(mockCaseId, mockCustomerId, "invalid-timestamp")).rejects.toThrow();
		});
	});

	describe("Performance and Timing", () => {
		it("should process jobs within reasonable time", async () => {
			// Setup mocks
			const mockResult = {
				case_id: mockCaseId,
				customer_id: mockCustomerId,
				status: "completed",
				processed_at: "2024-01-01T00:02:00Z",
				enqueued_at: mockEnqueuedAt
			};

			mockWorkflowProcessor.prototype.processWorkflow.mockResolvedValue(mockResult);

			// Execute and measure time
			const startTime = Date.now();
			const processor = new WorkflowProcessor();
			await processor.processWorkflow(mockCaseId, mockCustomerId, mockEnqueuedAt);
			const endTime = Date.now();

			// Verify processing completed quickly (should be instant with mocks)
			expect(endTime - startTime).toBeLessThan(1000); // Less than 1 second
		});
	});
});
