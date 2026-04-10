import { ChangePriorityRequestValidator } from "#core/validators/ChangePriorityRequestValidator";
import { WorkflowRepository } from "#core/workflow/workflowRepository";
import type { Workflow } from "#core/workflow/types";
import { UserInfo } from "#types/common";
import { ROLE_ID } from "#constants";

jest.mock("#core/workflow/workflowRepository");
jest.mock("#core/trigger");

describe("ChangePriorityRequestValidator", () => {
	let validator: ChangePriorityRequestValidator;
	let mockWorkflowRepository: jest.Mocked<WorkflowRepository>;

	const mockWorkflow: Workflow = {
		id: "workflow-123",
		customer_id: "customer-456",
		name: "Test Workflow",
		description: "Test Description",
		active: true,
		priority: 3,
		created_by: "user-123",
		created_at: new Date("2024-01-01T00:00:00Z"),
		updated_by: "user-123",
		updated_at: new Date("2024-01-01T00:00:00Z")
	};

	const mockUserInfo: UserInfo & { "custom:customer_id": string } = {
		user_id: "d21f8e91-806c-4cc0-bbb7-ccc6ec2fd0fe",
		email: "test@example.com",
		given_name: "John",
		family_name: "Doe",
		customer_id: "customer-456",
		"custom:customer_id": "customer-456",
		role: { id: ROLE_ID.CUSTOMER, code: "CUSTOMER" }
	} as UserInfo & { "custom:customer_id": string };

	beforeEach(() => {
		jest.clearAllMocks();

		mockWorkflowRepository = {
			getWorkflowById: jest.fn(),
			getMaxPriority: jest.fn()
		} as jest.Mocked<Partial<WorkflowRepository>> as jest.Mocked<WorkflowRepository>;

		(WorkflowRepository as jest.Mock).mockImplementation(() => mockWorkflowRepository);

		validator = new ChangePriorityRequestValidator(mockWorkflowRepository);
	});

	describe("validate", () => {
		it("should successfully validate change priority request", async () => {
			mockWorkflowRepository.getWorkflowById.mockResolvedValue(mockWorkflow);
			mockWorkflowRepository.getMaxPriority.mockResolvedValue(5);

			const result = await validator.validate("workflow-123", 2, mockUserInfo);

			expect(result).toEqual({
				workflowId: "workflow-123",
				workflow: mockWorkflow,
				newPriority: 2,
				userInfo: mockUserInfo
			});
			expect(mockWorkflowRepository.getWorkflowById).toHaveBeenCalledWith("workflow-123", undefined);
			expect(mockWorkflowRepository.getMaxPriority).toHaveBeenCalledWith("customer-456", undefined);
		});

		it("should successfully validate with transaction", async () => {
			const mockTrx = {} as any;
			mockWorkflowRepository.getWorkflowById.mockResolvedValue(mockWorkflow);
			mockWorkflowRepository.getMaxPriority.mockResolvedValue(5);

			const result = await validator.validate("workflow-123", 2, mockUserInfo, mockTrx);

			expect(result).toEqual({
				workflowId: "workflow-123",
				workflow: mockWorkflow,
				newPriority: 2,
				userInfo: mockUserInfo
			});
			expect(mockWorkflowRepository.getWorkflowById).toHaveBeenCalledWith("workflow-123", mockTrx);
			expect(mockWorkflowRepository.getMaxPriority).toHaveBeenCalledWith("customer-456", mockTrx);
		});

		it("should throw error when workflow does not exist", async () => {
			mockWorkflowRepository.getWorkflowById.mockResolvedValue(null);

			await expect(validator.validate("non-existent", 2, mockUserInfo)).rejects.toThrow(
				"Workflow with ID non-existent not found"
			);
		});

		it("should throw error when user does not have access to workflow", async () => {
			const differentUserInfo: UserInfo & { "custom:customer_id": string } = {
				...mockUserInfo,
				customer_id: "different-customer",
				"custom:customer_id": "different-customer"
			};

			mockWorkflowRepository.getWorkflowById.mockResolvedValue(mockWorkflow);

			await expect(validator.validate("workflow-123", 2, differentUserInfo)).rejects.toThrow(
				"Access denied. You are not authorized to access this workflow."
			);
		});

		it("should throw error when priority is less than 1", async () => {
			mockWorkflowRepository.getWorkflowById.mockResolvedValue(mockWorkflow);

			await expect(validator.validate("workflow-123", 0, mockUserInfo)).rejects.toThrow("Priority must be at least 1");
		});

		it("should throw error when priority is greater than max priority", async () => {
			mockWorkflowRepository.getWorkflowById.mockResolvedValue(mockWorkflow);
			mockWorkflowRepository.getMaxPriority.mockResolvedValue(5);

			await expect(validator.validate("workflow-123", 10, mockUserInfo)).rejects.toThrow(
				"Priority must be between 1 and 5"
			);
		});

		it("should throw error when no workflows found for customer", async () => {
			mockWorkflowRepository.getWorkflowById.mockResolvedValue(mockWorkflow);
			mockWorkflowRepository.getMaxPriority.mockResolvedValue(0);

			await expect(validator.validate("workflow-123", 2, mockUserInfo)).rejects.toThrow(
				"No workflows found for this customer"
			);
		});

		it("should throw error when workflow does not have a valid priority", async () => {
			const workflowWithoutPriority = { ...mockWorkflow, priority: undefined };
			mockWorkflowRepository.getWorkflowById.mockResolvedValue(workflowWithoutPriority as Workflow);
			mockWorkflowRepository.getMaxPriority.mockResolvedValue(5);

			await expect(validator.validate("workflow-123", 2, mockUserInfo)).rejects.toThrow(
				"Workflow does not have a valid priority"
			);
		});

		it("should throw error when workflow priority is null", async () => {
			const workflowWithNullPriority = { ...mockWorkflow, priority: null as any };
			mockWorkflowRepository.getWorkflowById.mockResolvedValue(workflowWithNullPriority);
			mockWorkflowRepository.getMaxPriority.mockResolvedValue(5);

			await expect(validator.validate("workflow-123", 2, mockUserInfo)).rejects.toThrow(
				"Workflow does not have a valid priority"
			);
		});

		it("should throw error when workflow already has the same priority", async () => {
			mockWorkflowRepository.getWorkflowById.mockResolvedValue(mockWorkflow);
			mockWorkflowRepository.getMaxPriority.mockResolvedValue(5);

			await expect(validator.validate("workflow-123", 3, mockUserInfo)).rejects.toThrow(
				"Workflow already has priority 3"
			);
		});

		it("should throw error when user is not a customer", async () => {
			const adminUserInfo: UserInfo & { "custom:customer_id": string } = {
				...mockUserInfo,
				role: { id: ROLE_ID.ADMIN, code: "ADMIN" }
			};

			mockWorkflowRepository.getWorkflowById.mockResolvedValue(mockWorkflow);

			await expect(validator.validate("workflow-123", 2, adminUserInfo)).rejects.toThrow(
				"Access denied. You are not authorized to access this workflow."
			);
		});
	});
});
