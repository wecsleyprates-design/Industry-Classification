import { PreviewEvaluationManager } from "../previewEvaluationManager";
import { PreviewEvaluationRequestValidator } from "#core/validators";
import { WorkflowRepository } from "#core/workflow";
import { VersionRepository } from "#core/versioning";
import { FactsManager } from "#core/facts";
import { caseService } from "#services/case";
import { warehouseService } from "#services/warehouse";
import { TriggerEvaluator } from "#core/evaluators";
import { UserInfo } from "#types/common";
import type { Workflow } from "#core/workflow/types";
import { ApiError } from "#types/common";
import { v4 as uuidv4 } from "uuid";
import type { PreviewEvaluationRequest } from "#types/workflow-dtos";

// Mock dependencies
jest.mock("#core/validators");
jest.mock("#core/workflow");
jest.mock("#services/case");
jest.mock("#services/warehouse");
jest.mock("#core/evaluators");

describe("PreviewEvaluationManager", () => {
	let manager: PreviewEvaluationManager;
	let mockValidator: jest.Mocked<PreviewEvaluationRequestValidator>;
	let mockRepository: jest.Mocked<WorkflowRepository>;
	let mockVersionRepository: jest.Mocked<VersionRepository>;
	let mockFactsManager: jest.Mocked<FactsManager>;
	let mockWorkflow: Workflow;
	let mockUserInfo: UserInfo;

	beforeEach(() => {
		// Setup mocks
		mockValidator = {
			validate: jest.fn()
		} as unknown as jest.Mocked<PreviewEvaluationRequestValidator>;

		mockRepository = {
			getTriggerConditionsForWorkflow: jest.fn()
		} as unknown as jest.Mocked<WorkflowRepository>;

		mockVersionRepository = {
			getWorkflowVersionAndRules: jest.fn()
		} as unknown as jest.Mocked<VersionRepository>;

		mockFactsManager = {
			extractRequiredFactsFromWorkflow: jest.fn()
		} as unknown as jest.Mocked<FactsManager>;

		manager = new PreviewEvaluationManager(mockRepository, mockVersionRepository, mockFactsManager, mockValidator);

		mockWorkflow = {
			id: uuidv4(),
			name: "Test Workflow",
			description: "Test Description",
			customer_id: uuidv4(),
			active: true,
			priority: 1,
			created_at: new Date(),
			created_by: uuidv4(),
			updated_at: new Date(),
			updated_by: uuidv4()
		};

		mockUserInfo = {
			user_id: uuidv4(),
			email: "test@example.com",
			given_name: "Test",
			family_name: "User",
			customer_id: mockWorkflow.customer_id,
			role: { id: 1, code: "CRO" }
		};
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("previewEvaluation", () => {
		it("should successfully evaluate with case_id", async () => {
			// Arrange
			const request: PreviewEvaluationRequest = {
				case_id: uuidv4()
			};

			mockValidator.validate.mockResolvedValue({
				workflowId: mockWorkflow.id,
				workflow: mockWorkflow,
				request,
				userInfo: mockUserInfo
			});

			(caseService.getCaseById as jest.Mock).mockResolvedValue({
				id: request.case_id,
				business_id: uuidv4(),
				customer_id: mockUserInfo.customer_id,
				case_type: 1,
				status: { id: "SUBMITTED", code: 12, label: "SUBMITTED" }
			});

			(TriggerEvaluator.evaluateTrigger as jest.Mock).mockReturnValue({
				matched: true
			});

			mockVersionRepository.getWorkflowVersionAndRules.mockResolvedValue({
				version: {
					id: uuidv4(),
					workflow_id: mockWorkflow.id,
					status: "published" as const,
					is_current: true,
					trigger_id: uuidv4(),
					version_number: 1,
					snapshot: {},
					created_at: new Date(),
					updated_at: new Date(),
					created_by: uuidv4(),
					updated_by: uuidv4(),
					published_at: new Date()
				},
				rules: []
			});

			(warehouseService.getFacts as jest.Mock).mockResolvedValue({
				risk_score: 0.3
			});

			// Act
			const result = await manager.previewEvaluation(mockWorkflow.id, request, mockUserInfo);

			// Assert
			expect(mockValidator.validate).toHaveBeenCalledWith(mockWorkflow.id, request, mockUserInfo);
			expect(caseService.getCaseById).toHaveBeenCalledWith(request.case_id);
			expect(result.evaluation_id).toBeDefined();
			expect(result.case_id).toBe(request.case_id);
		});

		it("should successfully evaluate with business_id and sampling", async () => {
			// Arrange
			const request: PreviewEvaluationRequest = {
				business_id: uuidv4(),
				sample_size: 5
			};

			mockValidator.validate.mockResolvedValue({
				workflowId: mockWorkflow.id,
				workflow: mockWorkflow,
				request,
				userInfo: mockUserInfo
			});

			const mockCases = [
				{
					id: uuidv4(),
					business_id: request.business_id as string,
					customer_id: mockUserInfo.customer_id,
					case_type: 1,
					status: { id: "SUBMITTED", code: 12, label: "SUBMITTED" }
				},
				{
					id: uuidv4(),
					business_id: request.business_id as string,
					customer_id: mockUserInfo.customer_id,
					case_type: 1,
					status: { id: "SUBMITTED", code: 12, label: "SUBMITTED" }
				}
			];

			(caseService.getCasesByBusinessId as jest.Mock).mockResolvedValue(mockCases);

			(TriggerEvaluator.evaluateTrigger as jest.Mock).mockReturnValue({
				matched: true
			});

			mockVersionRepository.getWorkflowVersionAndRules.mockResolvedValue({
				version: {
					id: uuidv4(),
					workflow_id: mockWorkflow.id,
					status: "published" as const,
					is_current: true,
					trigger_id: uuidv4(),
					version_number: 1,
					snapshot: {},
					created_at: new Date(),
					updated_at: new Date(),
					created_by: uuidv4(),
					updated_by: uuidv4(),
					published_at: new Date()
				},
				rules: []
			});

			(warehouseService.getFacts as jest.Mock).mockResolvedValue({
				risk_score: 0.3
			});

			// Act
			const result = await manager.previewEvaluation(mockWorkflow.id, request, mockUserInfo);

			// Assert
			expect(mockValidator.validate).toHaveBeenCalledWith(mockWorkflow.id, request, mockUserInfo);
			expect(caseService.getCasesByBusinessId).toHaveBeenCalledWith(request.business_id, 5, 0);
			expect(result.evaluation_id).toBeDefined();
			expect(result.business_id).toBe(request.business_id);
			expect(result.sampled_cases).toBeDefined();
		});

		it("should handle validation errors", async () => {
			// Arrange
			const request: PreviewEvaluationRequest = {
				case_id: uuidv4()
			};

			const error = new ApiError("Validation failed", 400, "INVALID");
			mockValidator.validate.mockRejectedValue(error);

			// Act & Assert
			await expect(manager.previewEvaluation(mockWorkflow.id, request, mockUserInfo)).rejects.toThrow(
				"Validation failed"
			);
		});

		it("should handle case not found", async () => {
			// Arrange
			const request: PreviewEvaluationRequest = {
				case_id: uuidv4()
			};

			mockValidator.validate.mockResolvedValue({
				workflowId: mockWorkflow.id,
				workflow: mockWorkflow,
				request,
				userInfo: mockUserInfo
			});

			(caseService.getCaseById as jest.Mock).mockRejectedValue(new ApiError("Case not found", 404, "NOT_FOUND"));

			// Act & Assert
			await expect(manager.previewEvaluation(mockWorkflow.id, request, mockUserInfo)).rejects.toThrow("Case not found");
		});

		it("should successfully evaluate with multiple business_id (array)", async () => {
			// Arrange
			const businessId1 = uuidv4();
			const businessId2 = uuidv4();
			const businessId3 = uuidv4();
			const request: PreviewEvaluationRequest = {
				business_id: [businessId1, businessId2, businessId3],
				sample_size: 5
			};

			mockValidator.validate.mockResolvedValue({
				workflowId: mockWorkflow.id,
				workflow: mockWorkflow,
				request,
				userInfo: mockUserInfo
			});

			// Mock cases for each business
			const mockCases1 = [
				{
					id: uuidv4(),
					business_id: businessId1,
					customer_id: mockUserInfo.customer_id,
					case_type: 1,
					status: { id: "SUBMITTED", code: 12, label: "SUBMITTED" }
				}
			];

			const mockCases2 = [
				{
					id: uuidv4(),
					business_id: businessId2,
					customer_id: mockUserInfo.customer_id,
					case_type: 1,
					status: { id: "SUBMITTED", code: 12, label: "SUBMITTED" }
				}
			];

			const mockCases3 = [
				{
					id: uuidv4(),
					business_id: businessId3,
					customer_id: mockUserInfo.customer_id,
					case_type: 1,
					status: { id: "SUBMITTED", code: 12, label: "SUBMITTED" }
				}
			];

			(caseService.getCasesByBusinessId as jest.Mock)
				.mockResolvedValueOnce(mockCases1)
				.mockResolvedValueOnce(mockCases2)
				.mockResolvedValueOnce(mockCases3);

			(TriggerEvaluator.evaluateTrigger as jest.Mock).mockReturnValue({
				matched: true
			});

			mockVersionRepository.getWorkflowVersionAndRules.mockResolvedValue({
				version: {
					id: uuidv4(),
					workflow_id: mockWorkflow.id,
					status: "published" as const,
					is_current: true,
					trigger_id: uuidv4(),
					version_number: 1,
					snapshot: {},
					created_at: new Date(),
					updated_at: new Date(),
					created_by: uuidv4(),
					updated_by: uuidv4(),
					published_at: new Date()
				},
				rules: []
			});

			(warehouseService.getFacts as jest.Mock).mockResolvedValue({
				risk_score: 0.3
			});

			// Act
			const result = await manager.previewEvaluation(mockWorkflow.id, request, mockUserInfo);

			// Assert
			expect(mockValidator.validate).toHaveBeenCalledWith(mockWorkflow.id, request, mockUserInfo);
			expect(caseService.getCasesByBusinessId).toHaveBeenCalledTimes(3);
			expect(caseService.getCasesByBusinessId).toHaveBeenNthCalledWith(1, businessId1, 5, 0);
			expect(caseService.getCasesByBusinessId).toHaveBeenNthCalledWith(2, businessId2, 5, 0);
			expect(caseService.getCasesByBusinessId).toHaveBeenNthCalledWith(3, businessId3, 5, 0);
			expect(result.evaluation_id).toBeDefined();
			expect(Array.isArray(result.business_id)).toBe(true);
			expect(result.business_id).toEqual([businessId1, businessId2, businessId3]);
			expect(result.business_results).toBeDefined();
			expect(result.business_results?.length).toBe(3);
			expect(result.business_results?.[0]?.business_id).toBe(businessId1);
			expect(result.business_results?.[1]?.business_id).toBe(businessId2);
			expect(result.business_results?.[2]?.business_id).toBe(businessId3);
		});

		it("should maintain backward compatibility with single business_id string", async () => {
			// Arrange
			const businessId = uuidv4();
			const request: PreviewEvaluationRequest = {
				business_id: businessId,
				sample_size: 5
			};

			mockValidator.validate.mockResolvedValue({
				workflowId: mockWorkflow.id,
				workflow: mockWorkflow,
				request,
				userInfo: mockUserInfo
			});

			const mockCases = [
				{
					id: uuidv4(),
					business_id: businessId,
					customer_id: mockUserInfo.customer_id,
					case_type: 1,
					status: { id: "SUBMITTED", code: 12, label: "SUBMITTED" }
				}
			];

			(caseService.getCasesByBusinessId as jest.Mock).mockResolvedValue(mockCases);

			(TriggerEvaluator.evaluateTrigger as jest.Mock).mockReturnValue({
				matched: true
			});

			mockVersionRepository.getWorkflowVersionAndRules.mockResolvedValue({
				version: {
					id: uuidv4(),
					workflow_id: mockWorkflow.id,
					status: "published" as const,
					is_current: true,
					trigger_id: uuidv4(),
					version_number: 1,
					snapshot: {},
					created_at: new Date(),
					updated_at: new Date(),
					created_by: uuidv4(),
					updated_by: uuidv4(),
					published_at: new Date()
				},
				rules: []
			});

			(warehouseService.getFacts as jest.Mock).mockResolvedValue({
				risk_score: 0.3
			});

			// Act
			const result = await manager.previewEvaluation(mockWorkflow.id, request, mockUserInfo);

			// Assert
			expect(caseService.getCasesByBusinessId).toHaveBeenCalledWith(businessId, 5, 0);
			expect(result.business_id).toBe(businessId);
			expect(result.sampled_cases).toBeDefined();
			// business_results should NOT be present for single business
			expect(result.business_results).toBeUndefined();
		});

		it("should handle multiple businesses with no cases", async () => {
			// Arrange
			const businessId1 = uuidv4();
			const businessId2 = uuidv4();
			const request: PreviewEvaluationRequest = {
				business_id: [businessId1, businessId2],
				sample_size: 5
			};

			mockValidator.validate.mockResolvedValue({
				workflowId: mockWorkflow.id,
				workflow: mockWorkflow,
				request,
				userInfo: mockUserInfo
			});

			// No cases for either business
			(caseService.getCasesByBusinessId as jest.Mock).mockResolvedValue([]);

			// Act
			const result = await manager.previewEvaluation(mockWorkflow.id, request, mockUserInfo);

			// Assert
			expect(caseService.getCasesByBusinessId).toHaveBeenCalledTimes(2);
			expect(result.business_id).toEqual([businessId1, businessId2]);
			expect(result.business_results).toBeDefined();
			expect(result.business_results?.length).toBe(2);
			// Both businesses should have empty sampled_cases
			expect(result.business_results?.[0]?.sampled_cases).toEqual([]);
			expect(result.business_results?.[1]?.sampled_cases).toEqual([]);
		});

		it("should handle mixed scenarios with some businesses having cases and others not", async () => {
			// Arrange
			const businessId1 = uuidv4();
			const businessId2 = uuidv4();
			const request: PreviewEvaluationRequest = {
				business_id: [businessId1, businessId2],
				sample_size: 5
			};

			mockValidator.validate.mockResolvedValue({
				workflowId: mockWorkflow.id,
				workflow: mockWorkflow,
				request,
				userInfo: mockUserInfo
			});

			const mockCases1 = [
				{
					id: uuidv4(),
					business_id: businessId1,
					customer_id: mockUserInfo.customer_id,
					case_type: 1,
					status: { id: "SUBMITTED", code: 12, label: "SUBMITTED" }
				}
			];

			// Business 2 has no cases
			const mockCases2: unknown[] = [];

			(caseService.getCasesByBusinessId as jest.Mock)
				.mockResolvedValueOnce(mockCases1)
				.mockResolvedValueOnce(mockCases2);

			(TriggerEvaluator.evaluateTrigger as jest.Mock).mockReturnValue({
				matched: true
			});

			mockVersionRepository.getWorkflowVersionAndRules.mockResolvedValue({
				version: {
					id: uuidv4(),
					workflow_id: mockWorkflow.id,
					status: "published" as const,
					is_current: true,
					trigger_id: uuidv4(),
					version_number: 1,
					snapshot: {},
					created_at: new Date(),
					updated_at: new Date(),
					created_by: uuidv4(),
					updated_by: uuidv4(),
					published_at: new Date()
				},
				rules: []
			});

			(warehouseService.getFacts as jest.Mock).mockResolvedValue({
				risk_score: 0.3
			});

			// Act
			const result = await manager.previewEvaluation(mockWorkflow.id, request, mockUserInfo);

			// Assert
			expect(result.business_results).toBeDefined();
			expect(result.business_results?.length).toBe(2);
			expect(result.business_results?.[0]?.sampled_cases?.length).toBeGreaterThan(0);
			expect(result.business_results?.[1]?.sampled_cases).toEqual([]);
		});
	});
});
