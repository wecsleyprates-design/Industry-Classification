import { SetFieldStrategy } from "#core/actions/setFieldStrategy";
import { CASE_STATUS } from "#constants/case.constants";
import { CaseData } from "#core/types";

jest.mock("#helpers/logger", () => ({
	logger: {
		debug: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
		info: jest.fn()
	}
}));

jest.mock("#helpers/kafka", () => ({
	producer: {
		send: jest.fn().mockResolvedValue(undefined)
	}
}));

import { logger as mockLogger } from "#helpers/logger";
import { producer as mockProducer } from "#helpers/kafka";

describe("SetFieldStrategy", () => {
	let strategy: SetFieldStrategy;
	let mockCaseData: CaseData;

	beforeEach(() => {
		jest.clearAllMocks();
		strategy = new SetFieldStrategy();
		mockCaseData = {
			id: "case-123",
			customer_id: "customer-456",
			status: { id: "SUBMITTED", code: "12", label: "SUBMITTED" },
			business_id: "business-789",
			created_at: new Date("2024-01-01T00:00:00Z"),
			updated_at: new Date("2024-01-01T00:00:00Z")
		};
	});

	describe("execute", () => {
		it("should return early for missing field parameter", async () => {
			const parameters = {
				field: "",
				value: "APPROVED"
			};

			await strategy.execute(parameters, mockCaseData);

			expect(mockLogger.error).toHaveBeenCalledWith(
				"Missing required parameters for set_field action: field=, value=APPROVED"
			);
		});

		it("should return early for missing value parameter", async () => {
			const parameters = {
				field: "case.status",
				value: undefined
			};

			await strategy.execute(parameters, mockCaseData);

			expect(mockLogger.error).toHaveBeenCalledWith(
				"Missing required parameters for set_field action: field=case.status, value=undefined"
			);
		});

		it("should warn for unsupported field format", async () => {
			const parameters = {
				field: "invalid.field",
				value: "test"
			};

			await strategy.execute(parameters, mockCaseData);

			expect(mockLogger.warn).toHaveBeenCalledWith(
				"Unsupported field for set_field action: invalid.field for case case-123. Field must start with 'case.'"
			);
		});

		it("should error for invalid status value", async () => {
			const parameters = {
				field: "case.status",
				value: "INVALID_STATUS"
			};

			await strategy.execute(parameters, mockCaseData);

			expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("Invalid status value: INVALID_STATUS"));
		});

		it("should handle valid case.status field", async () => {
			const parameters = {
				field: "case.status",
				value: "APPROVED"
			};

			await expect(strategy.execute(parameters, mockCaseData)).resolves.not.toThrow();
		});

		it("should handle valid non-status field", async () => {
			const parameters = {
				field: "case.priority",
				value: "HIGH"
			};

			await expect(strategy.execute(parameters, mockCaseData)).resolves.not.toThrow();
		});

		it("should handle numeric status value", async () => {
			const parameters = {
				field: "case.status",
				value: CASE_STATUS.AUTO_APPROVED
			};

			await expect(strategy.execute(parameters, mockCaseData)).resolves.not.toThrow();
		});

		it("should send Kafka message with business_id as key", async () => {
			const parameters = {
				field: "case.priority",
				value: "HIGH"
			};

			await strategy.execute(parameters, mockCaseData);

			expect(mockProducer.send).toHaveBeenCalledWith(
				expect.objectContaining({
					messages: expect.arrayContaining([
						expect.objectContaining({
							key: mockCaseData.business_id
						})
					])
				})
			);
		});

		it("should use empty string as key if business_id is missing", async () => {
			const parameters = {
				field: "case.priority",
				value: "HIGH"
			};
			const caseDataWithoutBusinessId = { ...mockCaseData, business_id: undefined } as any;

			await strategy.execute(parameters, caseDataWithoutBusinessId);

			expect(mockProducer.send).toHaveBeenCalledWith(
				expect.objectContaining({
					messages: expect.arrayContaining([
						expect.objectContaining({
							key: ""
						})
					])
				})
			);
		});
	});
});
