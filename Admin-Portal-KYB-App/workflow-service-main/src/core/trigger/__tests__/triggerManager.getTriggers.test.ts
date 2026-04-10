import { TriggerManager } from "../triggerManager";
import { TriggerRepository } from "../triggerRepository";
import type { WorkflowTrigger } from "#core/trigger/types";
import type { GetTriggersResponse } from "../types";

// Mock the TriggerRepository
jest.mock("../triggerRepository");
const mockedTriggerRepository = TriggerRepository as jest.MockedClass<typeof TriggerRepository>;

describe("TriggerManager.getTriggers", () => {
	let triggerManager: TriggerManager;
	let mockTriggerRepository: jest.Mocked<TriggerRepository>;

	beforeEach(() => {
		mockTriggerRepository = {
			getTriggers: jest.fn()
		} as unknown as jest.Mocked<TriggerRepository>;

		mockedTriggerRepository.mockImplementation(() => mockTriggerRepository);
		triggerManager = new TriggerManager(mockTriggerRepository);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("getTriggers", () => {
		it("should successfully retrieve triggers", async () => {
			const mockTriggers: WorkflowTrigger[] = [
				{
					id: "trigger-1",
					name: "On Boarding",
					conditions: {
						operator: "AND",
						conditions: [{ field: "cases.status", operator: "=", value: "onboarding" }]
					},
					created_by: "user-123",
					created_at: new Date("2024-01-01T00:00:00.000Z"),
					updated_by: "user-123",
					updated_at: new Date("2024-01-01T00:00:00.000Z")
				}
			];

			const expectedResponse: GetTriggersResponse = {
				triggers: [
					{
						id: "trigger-1",
						name: "On Boarding",
						conditions: {
							operator: "AND",
							conditions: [{ field: "cases.status", operator: "=", value: "onboarding" }]
						},
						created_at: "2024-01-01T00:00:00.000Z",
						updated_at: "2024-01-01T00:00:00.000Z"
					}
				],
				total: 1
			};

			mockTriggerRepository.getTriggers.mockResolvedValue(mockTriggers);

			const result = await triggerManager.getTriggers();

			expect(mockTriggerRepository.getTriggers).toHaveBeenCalledWith();
			expect(result).toEqual(expectedResponse);
		});

		it("should handle empty triggers list", async () => {
			const mockTriggers: WorkflowTrigger[] = [];
			const expectedResponse: GetTriggersResponse = {
				triggers: [],
				total: 0
			};

			mockTriggerRepository.getTriggers.mockResolvedValue(mockTriggers);

			const result = await triggerManager.getTriggers();

			expect(mockTriggerRepository.getTriggers).toHaveBeenCalledWith();
			expect(result).toEqual(expectedResponse);
		});

		it("should handle multiple triggers", async () => {
			const mockTriggers: WorkflowTrigger[] = [
				{
					id: "trigger-1",
					name: "On Boarding",
					conditions: {
						operator: "AND",
						conditions: [{ field: "cases.status", operator: "=", value: "onboarding" }]
					},
					created_by: "user-123",
					created_at: new Date("2024-01-01T00:00:00.000Z"),
					updated_by: "user-123",
					updated_at: new Date("2024-01-01T00:00:00.000Z")
				},
				{
					id: "trigger-2",
					name: "Status Change",
					conditions: {
						operator: "AND",
						conditions: [{ field: "cases.status", operator: "=", value: "submitted" }]
					},
					created_by: "user-123",
					created_at: new Date("2024-01-02T00:00:00.000Z"),
					updated_by: "user-123",
					updated_at: new Date("2024-01-02T00:00:00.000Z")
				}
			];

			const expectedResponse: GetTriggersResponse = {
				triggers: [
					{
						id: "trigger-1",
						name: "On Boarding",
						conditions: {
							operator: "AND",
							conditions: [{ field: "cases.status", operator: "=", value: "onboarding" }]
						},
						created_at: "2024-01-01T00:00:00.000Z",
						updated_at: "2024-01-01T00:00:00.000Z"
					},
					{
						id: "trigger-2",
						name: "Status Change",
						conditions: {
							operator: "AND",
							conditions: [{ field: "cases.status", operator: "=", value: "submitted" }]
						},
						created_at: "2024-01-02T00:00:00.000Z",
						updated_at: "2024-01-02T00:00:00.000Z"
					}
				],
				total: 2
			};

			mockTriggerRepository.getTriggers.mockResolvedValue(mockTriggers);

			const result = await triggerManager.getTriggers();

			expect(mockTriggerRepository.getTriggers).toHaveBeenCalledWith();
			expect(result).toEqual(expectedResponse);
		});

		it("should propagate repository errors", async () => {
			const error = new Error("Database connection failed");
			mockTriggerRepository.getTriggers.mockRejectedValue(error);

			await expect(triggerManager.getTriggers()).rejects.toThrow(error);
			expect(mockTriggerRepository.getTriggers).toHaveBeenCalledWith();
		});

		it("should handle repository timeout errors", async () => {
			const timeoutError = new Error("Database timeout");
			mockTriggerRepository.getTriggers.mockRejectedValue(timeoutError);

			await expect(triggerManager.getTriggers()).rejects.toThrow(timeoutError);
			expect(mockTriggerRepository.getTriggers).toHaveBeenCalledWith();
		});

		it("should handle triggers with complex conditions", async () => {
			const mockTriggers: WorkflowTrigger[] = [
				{
					id: "trigger-complex",
					name: "Complex Trigger",
					conditions: {
						operator: "AND",
						conditions: [
							{ field: "cases.status", operator: "=", value: "onboarding" },
							{
								operator: "OR",
								conditions: [
									{ field: "application.mcc", operator: "IN", value: ["5967", "5812"] },
									{ field: "financials.judgments_total", operator: ">", value: 50000 }
								]
							}
						]
					},
					created_by: "user-123",
					created_at: new Date("2024-01-01T00:00:00.000Z"),
					updated_by: "user-123",
					updated_at: new Date("2024-01-01T00:00:00.000Z")
				}
			];

			const expectedResponse: GetTriggersResponse = {
				triggers: [
					{
						id: "trigger-complex",
						name: "Complex Trigger",
						conditions: {
							operator: "AND",
							conditions: [
								{ field: "cases.status", operator: "=", value: "onboarding" },
								{
									operator: "OR",
									conditions: [
										{ field: "application.mcc", operator: "IN", value: ["5967", "5812"] },
										{ field: "financials.judgments_total", operator: ">", value: 50000 }
									]
								}
							]
						},
						created_at: "2024-01-01T00:00:00.000Z",
						updated_at: "2024-01-01T00:00:00.000Z"
					}
				],
				total: 1
			};

			mockTriggerRepository.getTriggers.mockResolvedValue(mockTriggers);

			const result = await triggerManager.getTriggers();

			expect(mockTriggerRepository.getTriggers).toHaveBeenCalledWith();
			expect(result).toEqual(expectedResponse);
		});
	});
});
