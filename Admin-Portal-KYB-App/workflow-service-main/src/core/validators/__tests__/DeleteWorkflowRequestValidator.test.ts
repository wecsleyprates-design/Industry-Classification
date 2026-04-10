import { DeleteWorkflowRequestValidator } from "../DeleteWorkflowRequestValidator";
import { WorkflowRepository } from "#core/workflow/workflowRepository";
import { VersionRepository } from "#core/versioning/versionRepository";
import { ApiError } from "#types/common";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants";

// Mock the repositories
jest.mock("#core/workflow/workflowRepository");
jest.mock("#core/versioning/versionRepository");
jest.mock("#core/trigger");

describe("DeleteWorkflowRequestValidator", () => {
	let validator: DeleteWorkflowRequestValidator;
	let mockWorkflowRepository: jest.Mocked<WorkflowRepository>;
	let mockVersionRepository: jest.Mocked<VersionRepository>;

	const mockUserInfo = {
		user_id: "user-123",
		email: "test@example.com",
		role: { id: 1, code: "admin" },
		given_name: "Test",
		family_name: "User",
		customer_id: "customer-123",
		"custom:customer_id": "customer-123"
	};

	const mockWorkflow = {
		id: "workflow-123",
		customer_id: "customer-123",
		name: "Test Workflow",
		description: "Test Description",
		active: true,
		priority: 1,
		created_by: "user-123",
		created_at: new Date("2024-01-01T00:00:00Z"),
		updated_by: "user-123",
		updated_at: new Date("2024-01-01T00:00:00Z")
	};

	beforeEach(() => {
		jest.clearAllMocks();

		mockWorkflowRepository = {} as jest.Mocked<Partial<WorkflowRepository>> as jest.Mocked<WorkflowRepository>;

		mockVersionRepository = {
			getPublishedVersions: jest.fn(),
			getArchivedVersions: jest.fn(),
			getDraftVersions: jest.fn()
		} as jest.Mocked<Partial<VersionRepository>> as jest.Mocked<VersionRepository>;

		(WorkflowRepository as jest.Mock).mockImplementation(() => mockWorkflowRepository);
		(VersionRepository as jest.Mock).mockImplementation(() => mockVersionRepository);

		validator = new DeleteWorkflowRequestValidator(mockWorkflowRepository, mockVersionRepository);
	});

	describe("validate", () => {
		it("should successfully validate delete request", async () => {
			// Mock workflow exists validation (from BaseRequestValidator)
			jest.spyOn(validator as unknown as any, "validateWorkflowExists").mockResolvedValue(mockWorkflow);
			jest.spyOn(validator as unknown as any, "validateWorkflowAccess").mockImplementation(() => {});

			mockVersionRepository.getPublishedVersions.mockResolvedValue([]);
			mockVersionRepository.getArchivedVersions.mockResolvedValue([]);
			mockVersionRepository.getDraftVersions.mockResolvedValue([
				{
					id: "version-1",
					workflow_id: "workflow-123",
					version_number: 1,
					trigger_id: "trigger-1",
					status: "draft",
					is_current: false,
					snapshot: {},
					created_by: "user-123",
					created_at: new Date("2024-01-01T00:00:00Z"),
					updated_by: "user-123",
					updated_at: new Date("2024-01-01T00:00:00Z")
				}
			]);

			const result = await validator.validate("workflow-123", mockUserInfo);

			expect(result).toEqual({
				workflowId: "workflow-123",
				workflow: mockWorkflow,
				userInfo: mockUserInfo
			});
		});

		it("should throw error when workflow has published versions", async () => {
			jest.spyOn(validator as unknown as any, "validateWorkflowExists").mockResolvedValue(mockWorkflow);
			jest.spyOn(validator as unknown as any, "validateWorkflowAccess").mockImplementation(() => {});

			mockVersionRepository.getPublishedVersions.mockResolvedValue([
				{
					id: "published-version",
					workflow_id: "workflow-123",
					version_number: 1,
					trigger_id: "trigger-1",
					status: "published",
					is_current: true,
					snapshot: {},
					created_by: "user-123",
					created_at: new Date("2024-01-01T00:00:00Z"),
					updated_by: "user-123",
					updated_at: new Date("2024-01-01T00:00:00Z")
				}
			]);

			await expect(validator.validate("workflow-123", mockUserInfo)).rejects.toThrow(ApiError);

			try {
				await validator.validate("workflow-123", mockUserInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(ApiError);
				expect((error as ApiError).message).toBe(
					"Cannot delete workflow with published versions. Please archive or unpublish all versions first."
				);
				expect((error as ApiError).status).toBe(StatusCodes.CONFLICT);
				expect((error as ApiError).errorCode).toBe(ERROR_CODES.UNKNOWN_ERROR);
			}
		});

		it("should throw error when workflow has archived versions", async () => {
			jest.spyOn(validator as unknown as any, "validateWorkflowExists").mockResolvedValue(mockWorkflow);
			jest.spyOn(validator as unknown as any, "validateWorkflowAccess").mockImplementation(() => {});

			mockVersionRepository.getPublishedVersions.mockResolvedValue([]);
			mockVersionRepository.getArchivedVersions.mockResolvedValue([
				{
					id: "archived-version",
					workflow_id: "workflow-123",
					version_number: 1,
					trigger_id: "trigger-1",
					status: "archived",
					is_current: false,
					snapshot: {},
					created_by: "user-123",
					created_at: new Date("2024-01-01T00:00:00Z"),
					updated_by: "user-123",
					updated_at: new Date("2024-01-01T00:00:00Z")
				}
			]);

			await expect(validator.validate("workflow-123", mockUserInfo)).rejects.toThrow(ApiError);

			try {
				await validator.validate("workflow-123", mockUserInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(ApiError);
				expect((error as ApiError).message).toBe(
					"Cannot delete workflow with archived versions. Workflows with execution history cannot be deleted."
				);
				expect((error as ApiError).status).toBe(StatusCodes.CONFLICT);
				expect((error as ApiError).errorCode).toBe(ERROR_CODES.UNKNOWN_ERROR);
			}
		});

		it("should throw error when no draft versions found", async () => {
			jest.spyOn(validator as unknown as any, "validateWorkflowExists").mockResolvedValue(mockWorkflow);
			jest.spyOn(validator as unknown as any, "validateWorkflowAccess").mockImplementation(() => {});

			mockVersionRepository.getPublishedVersions.mockResolvedValue([]);
			mockVersionRepository.getArchivedVersions.mockResolvedValue([]);
			mockVersionRepository.getDraftVersions.mockResolvedValue([]);

			await expect(validator.validate("workflow-123", mockUserInfo)).rejects.toThrow(ApiError);

			try {
				await validator.validate("workflow-123", mockUserInfo);
			} catch (error) {
				expect(error).toBeInstanceOf(ApiError);
				expect((error as ApiError).message).toBe("No draft versions found to delete");
				expect((error as ApiError).status).toBe(StatusCodes.NOT_FOUND);
				expect((error as ApiError).errorCode).toBe(ERROR_CODES.NOT_FOUND);
			}
		});

		it("should throw error when workflow does not exist", async () => {
			jest
				.spyOn(validator as unknown as any, "validateWorkflowExists")
				.mockRejectedValue(new Error("Workflow with ID workflow-123 not found"));

			await expect(validator.validate("workflow-123", mockUserInfo)).rejects.toThrow(
				"Workflow with ID workflow-123 not found"
			);
		});

		it("should throw error when user does not have access", async () => {
			jest.spyOn(validator as unknown as any, "validateWorkflowExists").mockResolvedValue(mockWorkflow);
			jest.spyOn(validator as unknown as any, "validateWorkflowAccess").mockImplementation(() => {
				throw new Error("Access denied. You are not authorized to access this workflow.");
			});

			await expect(validator.validate("workflow-123", mockUserInfo)).rejects.toThrow(
				"Access denied. You are not authorized to access this workflow."
			);
		});
	});

	describe("validateNoPublishedVersions", () => {
		it("should pass when no published versions exist", async () => {
			mockVersionRepository.getPublishedVersions.mockResolvedValue([]);

			await expect(validator["validateNoPublishedVersions"]("workflow-123")).resolves.not.toThrow();
		});

		it("should throw error when published versions exist", async () => {
			mockVersionRepository.getPublishedVersions.mockResolvedValue([
				{
					id: "published-version",
					workflow_id: "workflow-123",
					version_number: 1,
					trigger_id: "trigger-1",
					status: "published",
					is_current: true,
					snapshot: {},
					created_by: "user-123",
					created_at: new Date("2024-01-01T00:00:00Z"),
					updated_by: "user-123",
					updated_at: new Date("2024-01-01T00:00:00Z")
				}
			]);

			await expect(validator["validateNoPublishedVersions"]("workflow-123")).rejects.toThrow(ApiError);
		});
	});

	describe("validateHasDraftVersions", () => {
		it("should pass when draft versions exist", async () => {
			mockVersionRepository.getDraftVersions.mockResolvedValue([
				{
					id: "draft-version",
					workflow_id: "workflow-123",
					version_number: 1,
					trigger_id: "trigger-1",
					status: "draft",
					is_current: false,
					snapshot: {},
					created_by: "user-123",
					created_at: new Date("2024-01-01T00:00:00Z"),
					updated_by: "user-123",
					updated_at: new Date("2024-01-01T00:00:00Z")
				}
			]);

			await expect(validator["validateHasDraftVersions"]("workflow-123")).resolves.not.toThrow();
		});

		it("should throw error when no draft versions exist", async () => {
			mockVersionRepository.getDraftVersions.mockResolvedValue([]);

			await expect(validator["validateHasDraftVersions"]("workflow-123")).rejects.toThrow(ApiError);
		});
	});
});
