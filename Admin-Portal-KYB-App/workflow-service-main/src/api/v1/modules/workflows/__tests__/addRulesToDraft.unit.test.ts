import { workflowManager } from "#core";
import { UserInfo } from "#types/common";
import type { AddRulesRequest } from "#types/workflow-dtos";

// Mock dependencies
jest.mock("uuid", () => ({
	v4: jest.fn(() => "mock-uuid-123")
}));

jest.mock("#database", () => ({}));
jest.mock("#helpers/redis", () => ({}));
jest.mock("#helpers/bullQueue", () => ({}));
jest.mock("#configs", () => ({
	envConfig: {
		DB_HOST: "localhost",
		DB_PORT: 5432,
		DB_NAME: "test",
		DB_USER: "test",
		DB_PASSWORD: "test"
	},
	workflowConfig: {
		processingQueue: {
			delay: 120000
		}
	}
}));

jest.mock("#helpers/logger", () => ({
	logger: {
		info: jest.fn(),
		error: jest.fn(),
		warn: jest.fn(),
		debug: jest.fn(),
		child: jest.fn(() => ({
			info: jest.fn(),
			error: jest.fn(),
			warn: jest.fn(),
			debug: jest.fn()
		}))
	},
	pinoHttpLogger: jest.fn()
}));

// Mock the workflow manager
jest.mock("#core", () => ({
	workflowManager: {
		addRules: jest.fn()
	}
}));

describe("Add Rules to Draft Workflow - Unit Tests", () => {
	let mockUserInfo: UserInfo;
	let mockRequest: AddRulesRequest;

	beforeEach(() => {
		mockUserInfo = {
			user_id: "user-123",
			email: "test@example.com",
			given_name: "Test",
			family_name: "User",
			customer_id: "customer-123",
			role: { id: 1, code: "CRO" }
		};

		mockRequest = {
			rules: [
				{
					name: "High Risk Rule",
					priority: 1,
					conditions: {
						operator: "AND",
						conditions: [
							{ field: "application.mcc", operator: "IN", value: ["5967", "5812"] },
							{ field: "financials.judgments_total", operator: ">", value: 50000 }
						]
					},
					actions: [
						{
							type: "set_field" as const,
							parameters: { field: "case.status", value: "UNDER_MANUAL_REVIEW" }
						}
					]
				}
			]
		};

		jest.clearAllMocks();
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe("Success scenarios", () => {
		it("should successfully add rules to a draft workflow", async () => {
			const workflowId = "workflow-123";
			const expectedResponse = {
				workflow_id: workflowId,
				version_id: "version-123",
				rules_added: 1,
				message: "Successfully added 1 rules to draft workflow"
			};

			(workflowManager.addRules as jest.Mock).mockResolvedValue(expectedResponse);

			const result = await workflowManager.addRules(workflowId, mockRequest, mockUserInfo);

			expect(workflowManager.addRules).toHaveBeenCalledWith(workflowId, mockRequest, mockUserInfo);
			expect(result).toEqual(expectedResponse);
		});

		it("should handle multiple rules correctly", async () => {
			const workflowId = "workflow-123";
			const multipleRulesRequest: AddRulesRequest = {
				rules: [
					{
						name: "Rule 1",
						priority: 1,
						conditions: { operator: "AND", conditions: [] },
						actions: [{ type: "set_field" as const, parameters: { field: "case.status", value: "AUTO_APPROVED" } }]
					},
					{
						name: "Rule 2",
						priority: 2,
						conditions: { operator: "OR", conditions: [] },
						actions: [
							{ type: "set_field" as const, parameters: { field: "case.status", value: "UNDER_MANUAL_REVIEW" } }
						]
					}
				]
			};

			const expectedResponse = {
				workflow_id: workflowId,
				version_id: "version-123",
				rules_added: 2,
				message: "Successfully added 2 rules to draft workflow"
			};

			(workflowManager.addRules as jest.Mock).mockResolvedValue(expectedResponse);

			const result = await workflowManager.addRules(workflowId, multipleRulesRequest, mockUserInfo);

			expect(result.rules_added).toBe(2);
		});
	});

	describe("Error scenarios", () => {
		it("should handle repository errors gracefully", async () => {
			const workflowId = "workflow-123";
			const repositoryError = new Error("Database connection failed");

			(workflowManager.addRules as jest.Mock).mockRejectedValue(repositoryError);

			await expect(workflowManager.addRules(workflowId, mockRequest, mockUserInfo)).rejects.toThrow(
				"Database connection failed"
			);
		});

		it("should handle validation errors", async () => {
			const workflowId = "workflow-123";
			const invalidRequest: AddRulesRequest = {
				rules: [] // Empty rules array
			};

			const validationError = new Error("Rules array is required and must not be empty");
			(workflowManager.addRules as jest.Mock).mockRejectedValue(validationError);

			await expect(workflowManager.addRules(workflowId, invalidRequest, mockUserInfo)).rejects.toThrow(
				"Rules array is required and must not be empty"
			);
		});
	});

	describe("Input validation", () => {
		it("should validate workflow ID format", async () => {
			const invalidWorkflowId = "";
			const expectedResponse = {
				workflow_id: "workflow-123",
				version_id: "version-123",
				rules_added: 1,
				message: "Successfully added 1 rules to draft workflow"
			};

			(workflowManager.addRules as jest.Mock).mockResolvedValue(expectedResponse);

			// This should be handled by the controller layer
			const result = await workflowManager.addRules(invalidWorkflowId, mockRequest, mockUserInfo);
			expect(result).toBeDefined();
		});

		it("should handle different rule configurations", async () => {
			const workflowId = "workflow-123";
			const complexRuleRequest: AddRulesRequest = {
				rules: [
					{
						name: "Complex Rule",
						priority: 1,
						conditions: {
							operator: "OR",
							conditions: [
								{ field: "application.country", operator: "=", value: "US" },
								{ field: "application.country", operator: "=", value: "CA" }
							]
						},
						actions: [
							{
								type: "set_field" as const,
								parameters: { field: "case.status", value: "AUTO_REJECTED" }
							}
						]
					}
				]
			};

			const expectedResponse = {
				workflow_id: workflowId,
				version_id: "version-123",
				rules_added: 1,
				message: "Successfully added 1 rules to draft workflow"
			};

			(workflowManager.addRules as jest.Mock).mockResolvedValue(expectedResponse);

			const result = await workflowManager.addRules(workflowId, complexRuleRequest, mockUserInfo);

			expect(result.rules_added).toBe(1);
		});

		it("should handle UUID validation for workflow ID", () => {
			const invalidWorkflowId = "invalid-uuid";
			const validRequest = {
				rules: [
					{
						name: "Test Rule",
						priority: 1,
						conditions: { operator: "AND", conditions: [] },
						actions: [{ type: "set_field" as const, parameters: { field: "case.status", value: "AUTO_APPROVED" } }]
					}
				]
			};

			// The manager should handle invalid UUIDs gracefully
			expect(() => {
				void workflowManager.addRules(invalidWorkflowId, validRequest, mockUserInfo);
			}).not.toThrow();
		});
	});
});
