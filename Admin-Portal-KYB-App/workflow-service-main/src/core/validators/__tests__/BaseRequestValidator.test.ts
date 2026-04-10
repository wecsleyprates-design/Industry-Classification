import { BaseRequestValidator } from "#core/validators/BaseRequestValidator";
import { WorkflowRepository } from "#core/workflow/workflowRepository";
import { TriggerRepository } from "#core/trigger";
import type { Workflow } from "#core/workflow/types";
import { UserInfo } from "#types/common";
import { ROLE_ID, ROLES } from "#constants";

jest.mock("#core/workflow/workflowRepository");
jest.mock("#core/trigger");

class TestValidator extends BaseRequestValidator {
	async validate(..._args: unknown[]): Promise<unknown> {
		return { success: true };
	}
}

describe("BaseRequestValidator", () => {
	let validator: TestValidator;
	let mockWorkflowRepository: jest.Mocked<WorkflowRepository>;
	let mockTriggerRepository: jest.Mocked<TriggerRepository>;

	beforeEach(() => {
		jest.clearAllMocks();
		mockWorkflowRepository = {
			getWorkflowById: jest.fn()
		} as jest.Mocked<Partial<WorkflowRepository>> as jest.Mocked<WorkflowRepository>;
		mockTriggerRepository = {} as jest.Mocked<Partial<TriggerRepository>> as jest.Mocked<TriggerRepository>;

		(WorkflowRepository as jest.Mock).mockImplementation(() => mockWorkflowRepository);
		(TriggerRepository as jest.Mock).mockImplementation(() => mockTriggerRepository);

		validator = new TestValidator();
	});

	describe("validateWorkflowExists", () => {
		it("should return workflow when it exists", async () => {
			const mockWorkflow: Workflow = {
				id: "workflow-123",
				customer_id: "customer-456",
				name: "Test Workflow",
				description: "Test Description",
				active: true,
				priority: 1,
				created_by: "user-123",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_by: "user-123",
				updated_at: new Date("2024-01-01T00:00:00Z")
			};

			mockWorkflowRepository.getWorkflowById.mockResolvedValue(mockWorkflow);

			const result = await validator["validateWorkflowExists"]("workflow-123");

			expect(mockWorkflowRepository.getWorkflowById).toHaveBeenCalledWith("workflow-123", undefined);
			expect(result).toEqual(mockWorkflow);
		});

		it("should throw error when workflow does not exist", async () => {
			mockWorkflowRepository.getWorkflowById.mockResolvedValue(null);

			await expect(validator["validateWorkflowExists"]("non-existent")).rejects.toThrow(
				"Workflow with ID non-existent not found"
			);
		});
	});

	describe("validateWorkflowActive", () => {
		it("should return workflow when it is active", async () => {
			const mockWorkflow: Workflow = {
				id: "workflow-123",
				customer_id: "customer-456",
				name: "Test Workflow",
				description: "Test Description",
				active: true,
				priority: 1,
				created_by: "user-123",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_by: "user-123",
				updated_at: new Date("2024-01-01T00:00:00Z")
			};

			mockWorkflowRepository.getWorkflowById.mockResolvedValue(mockWorkflow);

			const result = await validator["validateWorkflowActive"]("workflow-123");

			expect(result).toEqual(mockWorkflow);
		});

		it("should throw error when workflow is not active", async () => {
			const mockWorkflow: Workflow = {
				id: "workflow-123",
				customer_id: "customer-456",
				name: "Test Workflow",
				description: "Test Description",
				active: false,
				priority: 1,
				created_by: "user-123",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_by: "user-123",
				updated_at: new Date("2024-01-01T00:00:00Z")
			};

			mockWorkflowRepository.getWorkflowById.mockResolvedValue(mockWorkflow);

			await expect(validator["validateWorkflowActive"]("workflow-123")).rejects.toThrow(
				"Workflow with ID workflow-123 is not active"
			);
		});

		it("should throw error when workflow does not exist", async () => {
			mockWorkflowRepository.getWorkflowById.mockResolvedValue(null);

			await expect(validator["validateWorkflowActive"]("non-existent")).rejects.toThrow(
				"Workflow with ID non-existent not found"
			);
		});
	});

	describe("validateWorkflowAccess", () => {
		const mockWorkflow: Workflow = {
			id: "workflow-123",
			customer_id: "customer-456",
			name: "Test Workflow",
			description: "Test Description",
			active: true,
			priority: 1,
			created_by: "user-123",
			created_at: new Date("2024-01-01T00:00:00Z"),
			updated_by: "user-123",
			updated_at: new Date("2024-01-01T00:00:00Z")
		};

		it("should not throw error when customer has access to their workflow", () => {
			const userInfo = {
				user_id: "d21f8e91-806c-4cc0-bbb7-ccc6ec2fd0fe",
				email: "test@example.com",
				given_name: "John",
				family_name: "Doe",
				customer_id: "customer-456",
				"custom:customer_id": "customer-456",
				role: { id: ROLE_ID.CUSTOMER, code: "CUSTOMER" }
			} as UserInfo & { "custom:customer_id": string };

			expect(() => validator["validateWorkflowAccess"](mockWorkflow, userInfo)).not.toThrow();
		});

		it("should throw error when customer tries to access different customer workflow", () => {
			const userInfo = {
				user_id: "d21f8e91-806c-4cc0-bbb7-ccc6ec2fd0fe",
				email: "test@example.com",
				given_name: "John",
				family_name: "Doe",
				customer_id: "different-customer",
				"custom:customer_id": "different-customer",
				role: { id: ROLE_ID.CUSTOMER, code: "CUSTOMER" }
			} as UserInfo & { "custom:customer_id": string };

			expect(() => validator["validateWorkflowAccess"](mockWorkflow, userInfo)).toThrow(
				"Access denied. You are not authorized to access this workflow."
			);
		});

		it("should not throw error when admin user accesses any workflow", () => {
			const userInfo = {
				user_id: "d21f8e91-806c-4cc0-bbb7-ccc6ec2fd0fe",
				email: "admin@example.com",
				given_name: "Admin",
				family_name: "User",
				customer_id: "different-customer",
				"custom:customer_id": "different-customer",
				role: { id: ROLE_ID.ADMIN, code: ROLES.ADMIN }
			} as UserInfo & { "custom:customer_id": string };

			// Admin should have access to any workflow, even from different customer
			expect(() => validator["validateWorkflowAccess"](mockWorkflow, userInfo)).not.toThrow();
		});

		it("should throw error when user is not a customer and not an admin", () => {
			const userInfo = {
				user_id: "d21f8e91-806c-4cc0-bbb7-ccc6ec2fd0fe",
				email: "applicant@example.com",
				given_name: "Applicant",
				family_name: "User",
				customer_id: "customer-456",
				"custom:customer_id": "customer-456",
				role: { id: ROLE_ID.APPLICANT, code: ROLES.APPLICANT }
			} as UserInfo & { "custom:customer_id": string };

			expect(() => validator["validateWorkflowAccess"](mockWorkflow, userInfo)).toThrow(
				"Access denied. You are not authorized to access this workflow."
			);
		});
	});
});
