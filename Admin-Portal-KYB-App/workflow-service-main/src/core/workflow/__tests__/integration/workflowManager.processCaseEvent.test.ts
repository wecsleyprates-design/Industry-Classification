const mockFetchCase = jest.fn();
const mockValidateConnection = jest.fn();
const mockIsCaseProcessed = jest.fn();
const mockLoadActiveWorkflowsByPriority = jest.fn();
const mockLoadWorkflowVersionAndRules = jest.fn();
const mockRecordWorkflowExecution = jest.fn();
const mockGetFacts = jest.fn();
const mockProcessActions = jest.fn();

jest.resetModules();

jest.doMock("#services/case", () => ({
	CaseService: jest.fn().mockImplementation(() => ({
		getCaseById: mockFetchCase,
		validateConnection: mockValidateConnection
	}))
}));

jest.doMock("#services/warehouse", () => ({
	warehouseService: {
		getFacts: mockGetFacts,
		validateConnection: jest.fn().mockResolvedValue(true)
	}
}));

jest.doMock("#core/workflow/workflowRepository", () => ({
	WorkflowRepository: jest.fn().mockImplementation(() => ({
		loadActiveWorkflowsByPriority: mockLoadActiveWorkflowsByPriority
	}))
}));

jest.doMock("#core/audit/auditRepository", () => ({
	AuditRepository: jest.fn().mockImplementation(() => ({
		isCaseProcessed: mockIsCaseProcessed,
		recordWorkflowExecution: mockRecordWorkflowExecution
	}))
}));

jest.doMock("#core/versioning/versionRepository", () => ({
	VersionRepository: jest.fn().mockImplementation(() => ({
		getWorkflowVersionAndRules: mockLoadWorkflowVersionAndRules
	}))
}));

jest.doMock("#core/actions", () => ({
	actionProcessor: {
		processActions: mockProcessActions
	}
}));

import { workflowManager } from "#core";

describe("WorkflowManager", () => {
	const mockCaseId = "case-123";
	const mockCustomerId = "customer-456";

	const mockCaseData = {
		id: "case-123",
		customer_id: "customer-456",
		status: { id: "SUBMITTED", code: "12", label: "SUBMITTED" },
		business_id: "business-789",
		created_at: new Date("2024-01-01T00:00:00Z"),
		updated_at: new Date("2024-01-01T00:00:00Z")
	};

	const mockFacts = {
		credit_score: 750,
		annual_income: 50000,
		employment_status: "employed"
	};

	const mockWorkflow = {
		id: "workflow-1",
		customer_id: "customer-456",
		name: "Test Workflow",
		description: "Test workflow for case submission",
		trigger: {
			and: [{ "==": [{ var: "case.status.id" }, "SUBMITTED"] }]
		},
		active: true,
		priority: 1,
		created_by: "user-1",
		created_at: new Date("2024-01-01T00:00:00Z"),
		updated_by: "user-1",
		updated_at: new Date("2024-01-01T00:00:00Z")
	};

	const mockWorkflows = [mockWorkflow];

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("processCaseEvent", () => {
		it("should process a case event successfully", async () => {
			mockFetchCase.mockResolvedValue(mockCaseData);
			mockLoadActiveWorkflowsByPriority.mockResolvedValue(mockWorkflows);
			mockLoadWorkflowVersionAndRules.mockResolvedValue({
				version: { id: "version-1", workflow_id: "workflow-1" },
				rules: []
			});
			mockGetFacts.mockResolvedValue({});

			await workflowManager.processCaseEvent(mockCaseId, { customerId: mockCustomerId });

			expect(mockFetchCase).toHaveBeenCalledWith("case-123");
			expect(mockLoadActiveWorkflowsByPriority).toHaveBeenCalledWith("customer-456");
			expect(mockLoadWorkflowVersionAndRules).toHaveBeenCalledWith("workflow-1");
			expect(mockGetFacts).toHaveBeenCalled();
		});

		it("should process case with matching rule and record execution", async () => {
			mockIsCaseProcessed.mockResolvedValue(false);
			mockFetchCase.mockResolvedValue(mockCaseData);
			mockLoadActiveWorkflowsByPriority.mockResolvedValue(mockWorkflows);

			const mockRule = {
				id: "rule-1",
				workflow_version_id: "version-1",
				name: "Test Rule",
				priority: 1,
				conditions: {
					operator: "AND",
					conditions: [{ field: "case.status.id", operator: "=", value: "SUBMITTED" }]
				},
				actions: { type: "SET_FIELD", parameters: { field: "case.status", value: "APPROVED" } },
				created_by: "user-1",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_by: "user-1",
				updated_at: new Date("2024-01-01T00:00:00Z")
			};

			mockLoadWorkflowVersionAndRules.mockResolvedValue({
				version: { id: "version-1", workflow_id: "workflow-1" },
				rules: [mockRule]
			});
			mockGetFacts.mockResolvedValue({
				credit_score: 750,
				annual_income: 50000
			});

			await workflowManager.processCaseEvent(mockCaseId, { customerId: mockCustomerId });

			expect(mockRecordWorkflowExecution).toHaveBeenCalledWith(
				expect.objectContaining({
					workflow_id: "workflow-1",
					matched_rule_id: "rule-1",
					case_id: "case-123",
					workflow_version_id: "version-1",
					input_attr: expect.objectContaining({
						case: expect.objectContaining({
							id: "case-123",
							customer_id: "customer-456",
							business_id: "business-789"
						}),
						facts: expect.objectContaining({
							credit_score: 750,
							annual_income: 50000
						}),
						custom_fields: expect.any(Object)
					}),
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					evaluation_log: expect.objectContaining({
						// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
						workflows_evaluated: expect.any(Array),
						// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
						trigger_evaluations: expect.any(Array),
						// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
						rule_evaluations: expect.any(Array)
					}),
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					latency_ms: expect.any(Number)
				})
			);
		});

		it("should handle case with no matching rules", async () => {
			mockIsCaseProcessed.mockResolvedValue(false);
			mockFetchCase.mockResolvedValue(mockCaseData);
			mockLoadActiveWorkflowsByPriority.mockResolvedValue(mockWorkflows);

			const mockRule = {
				id: "rule-1",
				workflow_version_id: "version-1",
				name: "Test Rule",
				priority: 1,
				conditions: {
					operator: "AND",
					conditions: [{ field: "case.status.id", operator: "=", value: "REJECTED" }]
				},
				actions: { type: "SET_FIELD", parameters: { field: "case.status", value: "APPROVED" } },
				created_by: "user-1",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_by: "user-1",
				updated_at: new Date("2024-01-01T00:00:00Z")
			};

			mockLoadWorkflowVersionAndRules.mockResolvedValue({
				version: { id: "version-1", workflow_id: "workflow-1" },
				rules: [mockRule]
			});
			mockGetFacts.mockResolvedValue({});

			await workflowManager.processCaseEvent(mockCaseId, { customerId: mockCustomerId });

			expect(mockRecordWorkflowExecution).not.toHaveBeenCalled();
		});

		it("should handle errors gracefully", async () => {
			mockFetchCase.mockRejectedValue(new Error("Case not found"));

			await expect(workflowManager.processCaseEvent(mockCaseId, { customerId: mockCustomerId })).rejects.toThrow(
				"Case not found"
			);
			expect(mockFetchCase).toHaveBeenCalledWith("case-123");
		});

		it("should handle case with no matching workflow", async () => {
			mockFetchCase.mockResolvedValue(mockCaseData);
			mockLoadActiveWorkflowsByPriority.mockResolvedValue([]);

			await workflowManager.processCaseEvent(mockCaseId, { customerId: mockCustomerId });

			expect(mockFetchCase).toHaveBeenCalledWith("case-123");
			expect(mockLoadActiveWorkflowsByPriority).toHaveBeenCalledWith("customer-456");
		});

		it("should handle multiple workflows with different priorities", async () => {
			mockIsCaseProcessed.mockResolvedValue(false);
			mockFetchCase.mockResolvedValue(mockCaseData);

			const highPriorityWorkflow = {
				...mockWorkflow,
				id: "workflow-high",
				priority: 1
			};
			const lowPriorityWorkflow = {
				...mockWorkflow,
				id: "workflow-low",
				priority: 2
			};

			mockLoadActiveWorkflowsByPriority.mockResolvedValue([highPriorityWorkflow, lowPriorityWorkflow]);

			const mockRule = {
				id: "rule-1",
				workflow_version_id: "version-1",
				name: "Test Rule",
				priority: 1,
				conditions: {
					operator: "AND",
					conditions: [{ field: "case.status.id", operator: "=", value: "SUBMITTED" }]
				},
				actions: { type: "SET_FIELD", parameters: { field: "case.status", value: "APPROVED" } },
				created_by: "user-1",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_by: "user-1",
				updated_at: new Date("2024-01-01T00:00:00Z")
			};

			mockLoadWorkflowVersionAndRules.mockResolvedValue({
				version: { id: "version-1", workflow_id: "workflow-high" },
				rules: [mockRule]
			});
			mockGetFacts.mockResolvedValue({});

			await workflowManager.processCaseEvent(mockCaseId, { customerId: mockCustomerId });

			expect(mockLoadWorkflowVersionAndRules).toHaveBeenCalledWith("workflow-high");
			expect(mockLoadWorkflowVersionAndRules).not.toHaveBeenCalledWith("workflow-low");
			expect(mockRecordWorkflowExecution).toHaveBeenCalledWith(
				expect.objectContaining({
					workflow_id: "workflow-high",
					matched_rule_id: "rule-1"
				})
			);
		});

		it("should handle workflow with trigger that doesn't match", async () => {
			mockIsCaseProcessed.mockResolvedValue(false);
			mockFetchCase.mockResolvedValue(mockCaseData);

			const workflowWithNonMatchingTrigger = {
				...mockWorkflow,
				trigger: {
					and: [{ "==": [{ var: "case.status.id" }, "REJECTED"] }] // Won't match
				}
			};

			mockLoadActiveWorkflowsByPriority.mockResolvedValue([workflowWithNonMatchingTrigger]);
			mockLoadWorkflowVersionAndRules.mockResolvedValue({
				version: { id: "version-1", workflow_id: "workflow-1" },
				rules: []
			});

			await workflowManager.processCaseEvent(mockCaseId, { customerId: mockCustomerId });

			expect(mockLoadWorkflowVersionAndRules).toHaveBeenCalledWith("workflow-1");
			expect(mockRecordWorkflowExecution).not.toHaveBeenCalled();
		});

		it("should restore previous_status when no active workflows found", async () => {
			mockFetchCase.mockResolvedValue(mockCaseData);
			mockLoadActiveWorkflowsByPriority.mockResolvedValue([]);
			mockProcessActions.mockResolvedValue(undefined);

			await workflowManager.processCaseEvent(mockCaseId, {
				customerId: mockCustomerId,
				previous_status: "IN_REVIEW"
			});

			expect(mockProcessActions).toHaveBeenCalledWith(
				[
					{
						type: "set_field",
						parameters: {
							field: "case.status",
							value: "IN_REVIEW"
						}
					}
				],
				mockCaseData
			);
		});

		it("should not restore previous_status when no active workflows and no previous_status provided", async () => {
			mockFetchCase.mockResolvedValue(mockCaseData);
			mockLoadActiveWorkflowsByPriority.mockResolvedValue([]);

			await workflowManager.processCaseEvent(mockCaseId, { customerId: mockCustomerId });

			expect(mockProcessActions).not.toHaveBeenCalled();
		});

		it("should restore previous_status when no rules match and previous_status exists", async () => {
			mockIsCaseProcessed.mockResolvedValue(false);
			mockFetchCase.mockResolvedValue(mockCaseData);
			mockLoadActiveWorkflowsByPriority.mockResolvedValue(mockWorkflows);
			mockProcessActions.mockResolvedValue(undefined);

			const mockRule = {
				id: "rule-1",
				workflow_version_id: "version-1",
				name: "Test Rule",
				priority: 1,
				conditions: {
					operator: "AND",
					conditions: [{ field: "case.status.id", operator: "=", value: "REJECTED" }]
				},
				actions: { type: "set_field", parameters: { field: "case.status", value: "APPROVED" } },
				created_by: "user-1",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_by: "user-1",
				updated_at: new Date("2024-01-01T00:00:00Z")
			};

			mockLoadWorkflowVersionAndRules.mockResolvedValue({
				version: { id: "version-1", workflow_id: "workflow-1" },
				rules: [mockRule]
			});
			mockGetFacts.mockResolvedValue({});

			await workflowManager.processCaseEvent(mockCaseId, {
				customerId: mockCustomerId,
				previous_status: "PENDING"
			});

			expect(mockRecordWorkflowExecution).not.toHaveBeenCalled();
			expect(mockProcessActions).toHaveBeenCalledWith(
				[
					{
						type: "set_field",
						parameters: {
							field: "case.status",
							value: "PENDING"
						}
					}
				],
				mockCaseData
			);
		});

		it("should not restore previous_status when a rule matches", async () => {
			mockIsCaseProcessed.mockResolvedValue(false);
			mockFetchCase.mockResolvedValue(mockCaseData);
			mockLoadActiveWorkflowsByPriority.mockResolvedValue(mockWorkflows);
			mockProcessActions.mockResolvedValue(undefined);

			const mockRule = {
				id: "rule-1",
				workflow_version_id: "version-1",
				name: "Test Rule",
				priority: 1,
				conditions: {
					operator: "AND",
					conditions: [{ field: "case.status.id", operator: "=", value: "SUBMITTED" }]
				},
				actions: { type: "SET_FIELD", parameters: { field: "case.status", value: "APPROVED" } },
				created_by: "user-1",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_by: "user-1",
				updated_at: new Date("2024-01-01T00:00:00Z")
			};

			mockLoadWorkflowVersionAndRules.mockResolvedValue({
				version: { id: "version-1", workflow_id: "workflow-1" },
				rules: [mockRule]
			});
			mockGetFacts.mockResolvedValue({});

			await workflowManager.processCaseEvent(mockCaseId, {
				customerId: mockCustomerId,
				previous_status: "PENDING"
			});

			expect(mockRecordWorkflowExecution).toHaveBeenCalled();
		});
	});

	describe("recordWorkflowExecution", () => {
		it("should record workflow execution with detailed evaluation log", async () => {
			mockIsCaseProcessed.mockResolvedValue(false);
			mockFetchCase.mockResolvedValue(mockCaseData);
			mockLoadActiveWorkflowsByPriority.mockResolvedValue(mockWorkflows);

			const mockRuleConditions = {
				operator: "AND",
				conditions: [{ field: "case.status.id", operator: "=", value: "SUBMITTED" }]
			};

			const mockRule = {
				id: "rule-1",
				workflow_version_id: "version-1",
				name: "Test Rule",
				priority: 1,
				conditions: mockRuleConditions,
				actions: { type: "SET_FIELD", parameters: { field: "case.status", value: "APPROVED" } },
				created_by: "user-1",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_by: "user-1",
				updated_at: new Date("2024-01-01T00:00:00Z")
			};

			mockLoadWorkflowVersionAndRules.mockResolvedValue({
				version: { id: "version-1", workflow_id: "workflow-1" },
				rules: [mockRule]
			});
			mockGetFacts.mockResolvedValue({
				credit_score: 750,
				annual_income: 50000,
				employment_status: "employed"
			});

			await workflowManager.processCaseEvent(mockCaseId, { customerId: mockCustomerId });

			expect(mockRecordWorkflowExecution).toHaveBeenCalledWith(
				expect.objectContaining({
					workflow_id: "workflow-1",
					matched_rule_id: "rule-1",
					case_id: "case-123",
					workflow_version_id: "version-1",
					input_attr: expect.objectContaining({
						case: expect.objectContaining({
							id: "case-123",
							customer_id: "customer-456",
							business_id: "business-789"
						}),
						facts: expect.objectContaining({
							credit_score: 750,
							annual_income: 50000,
							employment_status: "employed"
						}),
						custom_fields: expect.any(Object)
					}),
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					evaluation_log: expect.objectContaining({
						// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
						workflows_evaluated: expect.arrayContaining([
							expect.objectContaining({
								workflow_id: "workflow-1",
								trigger_matched: true,
								rules_evaluated: 1,
								matched_rule_id: "rule-1"
							})
						]),
						// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
						trigger_evaluations: expect.arrayContaining([
							expect.objectContaining({
								workflow_id: "workflow-1",
								matched: true
							})
						]),
						// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
						rule_evaluations: expect.arrayContaining([
							expect.objectContaining({
								workflow_id: "workflow-1",
								rule_id: "rule-1",
								rule_name: "Test Rule",
								matched: true,
								conditions: mockRuleConditions
							})
						])
					}),
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					latency_ms: expect.any(Number),
					applied_action: { type: "SET_FIELD", parameters: { field: "case.status", value: "APPROVED" } },
					default_applied: false
				})
			);
		});

		it("should handle recording errors gracefully", async () => {
			mockFetchCase.mockResolvedValue(mockCaseData);
			mockLoadActiveWorkflowsByPriority.mockResolvedValue(mockWorkflows);

			const mockRule = {
				id: "rule-1",
				workflow_version_id: "version-1",
				name: "Test Rule",
				priority: 1,
				conditions: {
					operator: "AND",
					conditions: [{ field: "case.status.id", operator: "=", value: "SUBMITTED" }]
				},
				actions: { type: "SET_FIELD", parameters: { field: "case.status", value: "APPROVED" } },
				created_by: "user-1",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_by: "user-1",
				updated_at: new Date("2024-01-01T00:00:00Z")
			};

			mockLoadWorkflowVersionAndRules.mockResolvedValue({
				version: { id: "version-1", workflow_id: "workflow-1" },
				rules: [mockRule]
			});
			mockGetFacts.mockResolvedValue({});
			mockRecordWorkflowExecution.mockRejectedValue(new Error("Database error"));

			await workflowManager.processCaseEvent(mockCaseId, { customerId: mockCustomerId });

			expect(mockRecordWorkflowExecution).toHaveBeenCalled();
		});
	});

	describe("validateSetup", () => {
		it("should return true when all services are healthy", async () => {
			mockValidateConnection.mockResolvedValue(true);

			const result = await workflowManager.validateSetup();

			expect(result).toBe(true);
			expect(mockValidateConnection).toHaveBeenCalled();
		});

		it("should return false when Case Service is unhealthy", async () => {
			mockValidateConnection.mockResolvedValue(false);

			const result = await workflowManager.validateSetup();

			expect(result).toBe(false);
			expect(mockValidateConnection).toHaveBeenCalled();
		});
	});

	describe("default action", () => {
		it("should apply default action when no rules match but trigger matched", async () => {
			mockIsCaseProcessed.mockResolvedValue(false);
			mockFetchCase.mockResolvedValue(mockCaseData);
			mockLoadActiveWorkflowsByPriority.mockResolvedValue([
				{
					id: "workflow-1",
					customer_id: "customer-456",
					name: "Test Workflow",
					priority: 1,
					trigger: { "==": [{ var: "case.status.id" }, "SUBMITTED"] }
				}
			]);
			mockGetFacts.mockResolvedValue(mockFacts);
			mockLoadWorkflowVersionAndRules.mockResolvedValue({
				version: {
					id: "version-1",
					default_action: {
						type: "SET_FIELD",
						parameters: { field: "case.status", value: "DEFAULT_APPROVED" }
					}
				},
				rules: [
					{
						id: "rule-1",
						name: "Test Rule",
						conditions: {
							operator: "AND",
							conditions: [{ field: "case.status.id", operator: "=", value: "REJECTED" }]
						},
						actions: { type: "SET_FIELD", parameters: { field: "case.status", value: "APPROVED" } }
					}
				]
			});

			await workflowManager.processCaseEvent("case-123");

			expect(mockRecordWorkflowExecution).toHaveBeenCalledWith(
				expect.objectContaining({
					workflow_id: "workflow-1",
					matched_rule_id: undefined,
					applied_action: {
						type: "SET_FIELD",
						parameters: { field: "case.status", value: "DEFAULT_APPROVED" }
					},
					default_applied: true,
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					evaluation_log: expect.objectContaining({
						default_action_applied: true
					})
				})
			);
		});

		it("should not apply default action when no workflows have trigger match", async () => {
			mockIsCaseProcessed.mockResolvedValue(false);
			mockFetchCase.mockResolvedValue(mockCaseData);
			mockLoadActiveWorkflowsByPriority.mockResolvedValue([
				{
					id: "workflow-1",
					customer_id: "customer-456",
					name: "Test Workflow",
					priority: 1,
					trigger: { "==": [{ var: "case.status.id" }, "REJECTED"] }
				}
			]);

			await workflowManager.processCaseEvent("case-123");

			expect(mockRecordWorkflowExecution).not.toHaveBeenCalled();
		});

		it("should not apply default action when workflow has no default_action", async () => {
			mockIsCaseProcessed.mockResolvedValue(false);
			mockFetchCase.mockResolvedValue(mockCaseData);
			mockLoadActiveWorkflowsByPriority.mockResolvedValue([
				{
					id: "workflow-1",
					customer_id: "customer-456",
					name: "Test Workflow",
					priority: 1,
					trigger: { "==": [{ var: "case.status.id" }, "SUBMITTED"] }
				}
			]);
			mockGetFacts.mockResolvedValue(mockFacts);
			mockLoadWorkflowVersionAndRules.mockResolvedValue({
				version: {
					id: "version-1"
				},
				rules: [
					{
						id: "rule-1",
						name: "Test Rule",
						conditions: {
							operator: "AND",
							conditions: [{ field: "case.status.id", operator: "=", value: "REJECTED" }]
						},
						actions: { type: "SET_FIELD", parameters: { field: "case.status", value: "APPROVED" } }
					}
				]
			});

			await workflowManager.processCaseEvent("case-123");

			expect(mockRecordWorkflowExecution).not.toHaveBeenCalled();
		});
	});
});
