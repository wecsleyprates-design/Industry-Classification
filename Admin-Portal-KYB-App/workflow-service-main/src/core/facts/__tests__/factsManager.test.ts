import { FactsManager } from "../factsManager";
import { VersionRepository } from "#core/versioning";
import type { WorkflowVersion } from "#core/versioning/types";
import type { WorkflowRule } from "#core/rule/types";
import { logger } from "#helpers/logger";

// Mock logger
jest.mock("#helpers/logger", () => ({
	logger: {
		debug: jest.fn(),
		warn: jest.fn(),
		error: jest.fn()
	}
}));

describe("FactsManager", () => {
	let factsManager: FactsManager;
	let mockVersionRepository: jest.Mocked<VersionRepository>;

	beforeEach(() => {
		mockVersionRepository = {
			getWorkflowVersionAndRules: jest.fn()
		} as unknown as jest.Mocked<VersionRepository>;

		factsManager = new FactsManager(mockVersionRepository);
		jest.clearAllMocks();
	});

	describe("extractRequiredFactsFromWorkflow", () => {
		it("should extract facts from workflow rules", async () => {
			const workflowId = "workflow-123";
			const mockRules = [
				{
					id: "rule-1",
					name: "Test Rule 1",
					priority: 1,
					conditions: {
						operator: "AND",
						conditions: [
							{
								field: "facts.risk_score",
								operator: "<",
								value: 0.5
							},
							{
								field: "facts.mcc_code",
								operator: "=",
								value: "5411"
							}
						]
					}
				},
				{
					id: "rule-2",
					name: "Test Rule 2",
					priority: 2,
					conditions: {
						operator: "AND",
						conditions: [
							{
								field: "facts.naics_code",
								operator: "=",
								value: "44-45"
							}
						]
					}
				}
			];

			mockVersionRepository.getWorkflowVersionAndRules.mockResolvedValue({
				rules: mockRules
			} as unknown as { version: WorkflowVersion; rules: WorkflowRule[] });

			const result = await factsManager.extractRequiredFactsFromWorkflow(workflowId);

			expect(result).toEqual(["risk_score", "mcc_code", "naics_code"]);
			expect(mockVersionRepository.getWorkflowVersionAndRules).toHaveBeenCalledWith(workflowId);
		});

		it("should handle empty rules array", async () => {
			const workflowId = "workflow-123";

			mockVersionRepository.getWorkflowVersionAndRules.mockResolvedValue({
				rules: []
			} as unknown as { version: WorkflowVersion; rules: WorkflowRule[] });

			const result = await factsManager.extractRequiredFactsFromWorkflow(workflowId);

			expect(result).toEqual([]);
			expect(logger.debug).toHaveBeenCalledWith("Extracted 0 required facts from rules: ");
		});

		it("should deduplicate facts", async () => {
			const workflowId = "workflow-123";
			const mockRules = [
				{
					id: "rule-1",
					name: "Test Rule 1",
					priority: 1,
					conditions: {
						operator: "AND",
						conditions: [
							{
								field: "facts.risk_score",
								operator: "<",
								value: 0.5
							}
						]
					}
				},
				{
					id: "rule-2",
					name: "Test Rule 2",
					priority: 2,
					conditions: {
						operator: "AND",
						conditions: [
							{
								field: "facts.risk_score",
								operator: ">",
								value: 0.8
							}
						]
					}
				}
			];

			mockVersionRepository.getWorkflowVersionAndRules.mockResolvedValue({
				rules: mockRules
			} as unknown as { version: WorkflowVersion; rules: WorkflowRule[] });

			const result = await factsManager.extractRequiredFactsFromWorkflow(workflowId);

			// risk_score should appear only once despite being in multiple rules
			expect(result).toEqual(["risk_score"]);
			expect(result.length).toBe(1);
		});

		it("should handle nested OR conditions", async () => {
			const workflowId = "workflow-123";
			const mockRules = [
				{
					id: "rule-1",
					name: "Test Rule 1",
					priority: 1,
					conditions: {
						operator: "OR",
						conditions: [
							{
								field: "facts.mcc_code",
								operator: "=",
								value: "5411"
							},
							{
								field: "facts.naics_code",
								operator: "=",
								value: "44-45"
							}
						]
					}
				}
			];

			mockVersionRepository.getWorkflowVersionAndRules.mockResolvedValue({
				rules: mockRules
			} as unknown as { version: WorkflowVersion; rules: WorkflowRule[] });

			const result = await factsManager.extractRequiredFactsFromWorkflow(workflowId);

			expect(result).toEqual(["mcc_code", "naics_code"]);
		});

		it("should handle repository errors gracefully", async () => {
			const workflowId = "workflow-123";

			mockVersionRepository.getWorkflowVersionAndRules.mockRejectedValue(new Error("Repository error"));

			const result = await factsManager.extractRequiredFactsFromWorkflow(workflowId);

			expect(result).toEqual([]);
			expect(logger.warn).toHaveBeenCalledWith(`Error loading rules for workflow ${workflowId}:`, expect.any(Error));
		});

		it("should handle errors in individual rules and continue processing", async () => {
			const workflowId = "workflow-123";
			const mockRules = [
				{
					id: "rule-1",
					name: "Test Rule 1",
					priority: 1,
					conditions: {
						field: "facts.risk_score",
						operator: "<",
						value: 0.5
					}
				},
				{
					id: "rule-2",
					name: "Test Rule 2",
					priority: 2,
					conditions: null // This will cause an error in extractFactsFromDSL
				},
				{
					id: "rule-3",
					name: "Test Rule 3",
					priority: 3,
					conditions: {
						field: "facts.mcc_code",
						operator: "=",
						value: "5411"
					}
				}
			];

			mockVersionRepository.getWorkflowVersionAndRules.mockResolvedValue({
				rules: mockRules
			} as unknown as { version: WorkflowVersion; rules: WorkflowRule[] });

			const result = await factsManager.extractRequiredFactsFromWorkflow(workflowId);

			// Should extract facts from rule-1 and rule-3, skip rule-2
			expect(result).toEqual(["risk_score", "mcc_code"]);
		});

		it("should ignore non-facts fields", async () => {
			const workflowId = "workflow-123";
			const mockRules = [
				{
					id: "rule-1",
					name: "Test Rule 1",
					priority: 1,
					conditions: {
						operator: "AND",
						conditions: [
							{
								field: "facts.risk_score",
								operator: "<",
								value: 0.5
							},
							{
								field: "case.status.id",
								operator: "=",
								value: "ACTIVE"
							}
						]
					}
				}
			];

			mockVersionRepository.getWorkflowVersionAndRules.mockResolvedValue({
				rules: mockRules
			} as unknown as { version: WorkflowVersion; rules: WorkflowRule[] });

			const result = await factsManager.extractRequiredFactsFromWorkflow(workflowId);

			// Should only extract "risk_score", not "case.status.id"
			expect(result).toEqual(["risk_score"]);
		});

		it("should extract base fact name from nested properties", async () => {
			const workflowId = "workflow-123";
			const mockRules = [
				{
					id: "rule-1",
					name: "Test Rule with Nested Property",
					priority: 1,
					conditions: {
						operator: "AND",
						conditions: [
							{
								field: "facts.primary_address.city",
								operator: "=",
								value: "Winder"
							},
							{
								field: "facts.primary_address.state",
								operator: "=",
								value: "GA"
							}
						]
					}
				}
			];

			mockVersionRepository.getWorkflowVersionAndRules.mockResolvedValue({
				rules: mockRules
			} as unknown as { version: WorkflowVersion; rules: WorkflowRule[] });

			const result = await factsManager.extractRequiredFactsFromWorkflow(workflowId);

			expect(result).toEqual(["primary_address"]);
			expect(result.length).toBe(1);
		});

		it("should handle mix of simple and nested fact properties", async () => {
			const workflowId = "workflow-123";
			const mockRules = [
				{
					id: "rule-1",
					name: "Test Rule with Mixed Properties",
					priority: 1,
					conditions: {
						operator: "AND",
						conditions: [
							{
								field: "facts.credit_score",
								operator: ">",
								value: 700
							},
							{
								field: "facts.primary_address.city",
								operator: "=",
								value: "Atlanta"
							},
							{
								field: "facts.business_info.annual_revenue",
								operator: ">=",
								value: 100000
							}
						]
					}
				}
			];

			mockVersionRepository.getWorkflowVersionAndRules.mockResolvedValue({
				rules: mockRules
			} as unknown as { version: WorkflowVersion; rules: WorkflowRule[] });

			const result = await factsManager.extractRequiredFactsFromWorkflow(workflowId);

			// Should extract base facts: "credit_score", "primary_address", "business_info"
			expect(result).toContain("credit_score");
			expect(result).toContain("primary_address");
			expect(result).toContain("business_info");
			expect(result.length).toBe(3);
		});

		it("should handle deeply nested properties", async () => {
			const workflowId = "workflow-123";
			const mockRules = [
				{
					id: "rule-1",
					name: "Test Rule with Deeply Nested Property",
					priority: 1,
					conditions: {
						operator: "AND",
						conditions: [
							{
								field: "facts.company.address.coordinates.latitude",
								operator: ">",
								value: 33.0
							}
						]
					}
				}
			];

			mockVersionRepository.getWorkflowVersionAndRules.mockResolvedValue({
				rules: mockRules
			} as unknown as { version: WorkflowVersion; rules: WorkflowRule[] });

			const result = await factsManager.extractRequiredFactsFromWorkflow(workflowId);

			expect(result).toEqual(["company"]);
		});

		it("should strip [*] from the top-level fact key for warehouse fetch (array path DSL)", async () => {
			const workflowId = "workflow-123";
			const mockRules = [
				{
					id: "rule-1",
					name: "Array path rule",
					priority: 1,
					conditions: {
						operator: "AND",
						conditions: [
							{
								field: "facts.owner_verification[*].fraud_report.synthetic_identity_risk_score",
								operator: "<",
								value: 0.5
							}
						]
					}
				}
			];

			mockVersionRepository.getWorkflowVersionAndRules.mockResolvedValue({
				rules: mockRules
			} as unknown as { version: WorkflowVersion; rules: WorkflowRule[] });

			const result = await factsManager.extractRequiredFactsFromWorkflow(workflowId);

			expect(result).toEqual(["owner_verification"]);
		});
	});

	describe("extractFactsFromDSL (instance method)", () => {
		it("should extract facts from instance method", () => {
			const factsSet = new Set<string>();
			const dsl = {
				operator: "AND",
				conditions: [
					{
						field: "facts.risk_score",
						operator: "<",
						value: 0.5
					}
				]
			};

			factsManager.extractFactsFromDSL(dsl, factsSet);

			expect(Array.from(factsSet)).toEqual(["risk_score"]);
		});

		it("should extract base fact from nested property path", () => {
			const factsSet = new Set<string>();
			const dsl = {
				operator: "AND",
				conditions: [
					{
						field: "facts.primary_address.city",
						operator: "=",
						value: "Winder"
					}
				]
			};

			factsManager.extractFactsFromDSL(dsl, factsSet);

			expect(Array.from(factsSet)).toEqual(["primary_address"]);
		});

		it("should deduplicate base facts from multiple nested properties", () => {
			const factsSet = new Set<string>();
			const dsl = {
				operator: "AND",
				conditions: [
					{
						field: "facts.primary_address.city",
						operator: "=",
						value: "Winder"
					},
					{
						field: "facts.primary_address.state",
						operator: "=",
						value: "GA"
					},
					{
						field: "facts.primary_address.postal_code",
						operator: "=",
						value: "30680"
					}
				]
			};

			factsManager.extractFactsFromDSL(dsl, factsSet);

			expect(Array.from(factsSet)).toEqual(["primary_address"]);
			expect(factsSet.size).toBe(1);
		});

		it("should map facts.owner_verification[*]... to warehouse key owner_verification", () => {
			const factsSet = new Set<string>();
			const dsl = {
				operator: "AND",
				conditions: [
					{
						field: "facts.owner_verification[*].fraud_report.score",
						operator: "<",
						value: 1
					}
				]
			};

			factsManager.extractFactsFromDSL(dsl, factsSet);

			expect(Array.from(factsSet)).toEqual(["owner_verification"]);
		});
	});

	describe("extractFactsFromDSL (static method)", () => {
		it("should extract base fact from nested property path using static method", () => {
			const factsSet = new Set<string>();
			const dsl = {
				operator: "AND",
				conditions: [
					{
						field: "facts.business_info.annual_revenue",
						operator: ">=",
						value: 100000
					}
				]
			};

			FactsManager.extractFactsFromDSL(dsl, factsSet);

			expect(Array.from(factsSet)).toEqual(["business_info"]);
		});

		it("should handle nested OR conditions with nested properties using static method", () => {
			const factsSet = new Set<string>();
			const dsl = {
				operator: "OR",
				conditions: [
					{
						field: "facts.primary_address.city",
						operator: "=",
						value: "Atlanta"
					},
					{
						field: "facts.secondary_address.city",
						operator: "=",
						value: "Marietta"
					}
				]
			};

			FactsManager.extractFactsFromDSL(dsl, factsSet);

			expect(Array.from(factsSet)).toContain("primary_address");
			expect(Array.from(factsSet)).toContain("secondary_address");
			expect(factsSet.size).toBe(2);
		});
	});
});
