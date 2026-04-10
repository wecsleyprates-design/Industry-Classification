const mockFetchCase = jest.fn();
const mockValidateConnection = jest.fn();
const mockIsCaseProcessed = jest.fn();
const mockLoadActiveWorkflowsByPriority = jest.fn();
const mockLoadWorkflowVersionAndRules = jest.fn();
const mockRecordWorkflowExecution = jest.fn();
const mockGetFacts = jest.fn();
const mockProcessActions = jest.fn();
const mockExtractRequiredFactsFromWorkflow = jest.fn();

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

jest.doMock("#core/facts", () => ({
	FactsManager: jest.fn().mockImplementation(() => ({
		extractRequiredFactsFromWorkflow: mockExtractRequiredFactsFromWorkflow
	}))
}));

jest.doMock("#core/actions", () => ({
	actionProcessor: {
		processActions: mockProcessActions
	}
}));

import { workflowManager } from "#core";
import { initializeJsonLogic } from "#helpers";

// Initialize custom JSON Logic operators after module reset
initializeJsonLogic();

describe("WorkflowManager - Realistic Data Integration Tests", () => {
	const mockCaseId = "d8c09468-536c-4eac-adb7-50b6fe737a20";
	const mockCustomerId = "e02cb108-e2a1-46a5-ba37-cd64e02b3222";
	const mockBusinessId = "fb44e6ef-291a-4132-b9fa-642745283db9";

	const realisticCaseData = {
		id: mockCaseId,
		applicant_id: "bf192e53-82e5-4eda-8998-c5c97ec8ca9b",
		customer_id: mockCustomerId,
		business_id: mockBusinessId,
		status: {
			id: "UNDER_MANUAL_REVIEW",
			code: 4,
			label: "UNDER MANUAL REVIEW"
		},
		created_at: new Date("2024-12-28T08:54:25.76966Z"),
		created_by: "bf192e53-82e5-4eda-8998-c5c97ec8ca9b",
		updated_at: new Date("2024-12-28T20:16:12.61975Z"),
		updated_by: "e9d43901-3fc6-4ee9-97be-74cd23b39aa0",
		case_type: 1,
		assignee: null,
		assigner: null,
		customer_initiated: false,
		business: {
			id: mockBusinessId,
			name: "Ukrop's Market Hall",
			tin: "vI1QImz+8zCjrXN82jzBsA==",
			mobile: "+12342343243",
			official_website: "http://ukropshomestylefoods.com/ukrops-market-hall/",
			public_website: null,
			social_account: null,
			address_apartment: null,
			address_line_1: "7250  Patterson Ave",
			address_line_2: null,
			address_city: "Richmond",
			address_state: "VA",
			address_postal_code: "23229",
			address_country: "USA",
			created_at: new Date("2024-12-28T08:51:42.806383Z"),
			created_by: "24b56812-bb8d-42c6-b070-e80662ae4d0c",
			updated_at: new Date("2025-05-19T00:16:49.2231Z"),
			updated_by: "bf192e53-82e5-4eda-8998-c5c97ec8ca9b",
			status: "VERIFIED",
			industry: {
				id: 18,
				name: "Accommodation and Food Services",
				code: "accommodation_and_food_services",
				sector_code: "72",
				created_at: new Date("2024-05-03T05:49:55.142937Z"),
				updated_at: new Date("2024-05-03T05:49:55.142937Z")
			},
			mcc_id: 78,
			naics_id: 936,
			is_deleted: false,
			naics_code: 722511,
			naics_title: "Full-Service Restaurants",
			mcc_code: 5812,
			mcc_title: "Eating Places & Restaurants"
		},
		owners: [
			{
				id: "93927d9b-3644-4975-9474-a0ef3252d62f",
				title: {
					id: 3,
					title: "Director"
				},
				first_name: "Nimish",
				last_name: "Knope__test",
				ssn: "jUpEQRFaBjJekXtb5x0fwQ==",
				email: "test@test.com",
				mobile: "+12342343432",
				date_of_birth: "2024-12-05",
				address_apartment: null,
				address_line_1: "300 College Avenue",
				address_line_2: null,
				address_city: "Los Gatos",
				address_state: "California",
				address_postal_code: "95030",
				address_country: "USA",
				created_at: new Date("2024-12-28T08:55:09.421802Z"),
				created_by: "bf192e53-82e5-4eda-8998-c5c97ec8ca9b",
				updated_at: new Date("2024-12-28T08:55:09.421802Z"),
				updated_by: "bf192e53-82e5-4eda-8998-c5c97ec8ca9b",
				ownership_percentage: 0,
				owner_type: "CONTROL"
			}
		],
		status_history: [
			{
				id: 3,
				status: "ONBOARDING",
				created_at: new Date("2024-12-28T08:54:25.772Z"),
				created_by: "bf192e53-82e5-4eda-8998-c5c97ec8ca9b"
			},
			{
				id: 12,
				status: "SUBMITTED",
				created_at: new Date("2024-12-28T08:58:46.142Z"),
				created_by: "bf192e53-82e5-4eda-8998-c5c97ec8ca9b"
			},
			{
				id: 4,
				status: "UNDER_MANUAL_REVIEW",
				created_at: new Date("2024-12-28T08:58:47.076Z"),
				created_by: "e9d43901-3fc6-4ee9-97be-74cd23b39aa0"
			}
		],
		active_decisioning_type: "worth_score",
		custom_fields: {
			acc: null,
			is_customer: false,
			processor: null,
			currency: [
				{
					label: "Swiped",
					value: "32",
					checkbox_type: "input",
					input_type: "number",
					icon: "$",
					icon_position: "first",
					checked: true
				},
				{
					label: "Keyed",
					value: "4",
					checkbox_type: "input",
					input_type: "number",
					icon: "$",
					icon_position: "first",
					checked: true
				}
			],
			jobtype: {
				value: " manager",
				label: " Manager"
			},
			onboarded: false,
			gender: {
				label: "\nNo gender",
				value: "NG",
				checkbox_type: null,
				input_type: null,
				icon: null,
				icon_position: null
			},
			application_letter:
				"Hello Team Hello Team Hello Team Hello Team Hello Team Hello Team Hello Team Hello Team Hello Team Hello Team Hello Team Hello Team Hello Team Hello Team Hello Team ",
			email: "test@test.com",
			language: [
				{
					label: "Hindi",
					value: "H",
					checkbox_type: "string",
					input_type: "",
					icon: "",
					icon_position: "",
					checked: false
				},
				{
					label: "English",
					value: "E",
					checkbox_type: "string",
					input_type: "",
					icon: "",
					icon_position: "",
					checked: true
				}
			],
			id_file: "file1.pdf",
			percent: 23,
			precent: [
				{
					label: "Swiped",
					value: null,
					checkbox_type: "input",
					input_type: "number",
					icon: "%",
					icon_position: "last",
					checked: false
				},
				{
					label: "Keyed",
					value: "100",
					checkbox_type: "input",
					input_type: "number",
					icon: "%",
					icon_position: "last",
					checked: true
				}
			],
			age: 23,
			phone_number: "0234567890",
			name: "Nimish Knope__test",
			enteredjob: null
		}
	};

	const realisticFacts = {
		risk_score: 0.65,
		credit_score: 720,
		annual_revenue: 1500000,
		transaction_volume: 50000,
		kyc_status: "VERIFIED",
		kyb_status: "APPROVED",
		mcc_code: 5812,
		naics_code: 722511,
		industry_risk: "LOW",
		geographic_risk: "MEDIUM",
		tags: ["restaurant", "food_service", "verified"]
	};

	const mockWorkflow = {
		id: "workflow-realistic-1",
		customer_id: mockCustomerId,
		name: "Realistic Test Workflow",
		description: "Workflow for testing with realistic data",
		trigger: {
			and: [{ "==": [{ var: "case.status.id" }, "UNDER_MANUAL_REVIEW"] }]
		},
		active: true,
		priority: 1,
		created_by: "user-1",
		created_at: new Date("2024-01-01T00:00:00Z"),
		updated_by: "user-1",
		updated_at: new Date("2024-01-01T00:00:00Z")
	};

	beforeEach(() => {
		jest.clearAllMocks();
		mockIsCaseProcessed.mockResolvedValue(false);
		mockFetchCase.mockResolvedValue(realisticCaseData);
		mockGetFacts.mockResolvedValue(realisticFacts);
		mockLoadActiveWorkflowsByPriority.mockResolvedValue([mockWorkflow]);
		mockProcessActions.mockResolvedValue(undefined);
		mockExtractRequiredFactsFromWorkflow.mockResolvedValue([]);
	});

	describe("Array Operators with Realistic Custom Fields", () => {
		it("should evaluate ANY_EQUALS operator with transformed checkbox array", async () => {
			const mockRule = {
				id: "rule-any-equals",
				workflow_version_id: "version-1",
				name: "Test ANY_EQUALS with currency",
				priority: 1,
				conditions: {
					operator: "AND",
					conditions: [
						{
							field: "custom_fields.currency",
							operator: "ANY_EQUALS",
							value: "Swiped"
						}
					]
				},
				actions: { type: "SET_FIELD", parameters: { field: "case.status", value: "APPROVED" } },
				created_by: "user-1",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_by: "user-1",
				updated_at: new Date("2024-01-01T00:00:00Z")
			};

			mockExtractRequiredFactsFromWorkflow.mockResolvedValueOnce([]);
			mockLoadWorkflowVersionAndRules.mockResolvedValue({
				version: { id: "version-1", workflow_id: "workflow-realistic-1" },
				rules: [mockRule]
			});

			await workflowManager.processCaseEvent(mockCaseId, { customerId: mockCustomerId });

			expect(mockRecordWorkflowExecution).toHaveBeenCalledWith(
				expect.objectContaining({
					workflow_id: "workflow-realistic-1",
					matched_rule_id: "rule-any-equals",
					case_id: mockCaseId,
					input_attr: expect.objectContaining({
						case: expect.objectContaining({
							id: mockCaseId,
							customer_id: mockCustomerId
						}),
						facts: expect.objectContaining(realisticFacts),
						custom_fields: expect.objectContaining({
							currency: ["Swiped", "Keyed"]
						})
					})
				})
			);
		});

		it("should evaluate ANY_CONTAINS operator with language array", async () => {
			const mockRule = {
				id: "rule-any-contains",
				workflow_version_id: "version-1",
				name: "Test ANY_CONTAINS with language",
				priority: 1,
				conditions: {
					operator: "AND",
					conditions: [
						{
							field: "custom_fields.language",
							operator: "ANY_CONTAINS",
							value: "Eng"
						}
					]
				},
				actions: { type: "SET_FIELD", parameters: { field: "case.status", value: "APPROVED" } },
				created_by: "user-1",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_by: "user-1",
				updated_at: new Date("2024-01-01T00:00:00Z")
			};

			mockExtractRequiredFactsFromWorkflow.mockResolvedValueOnce([]);
			mockLoadWorkflowVersionAndRules.mockResolvedValue({
				version: { id: "version-1", workflow_id: "workflow-realistic-1" },
				rules: [mockRule]
			});

			await workflowManager.processCaseEvent(mockCaseId, { customerId: mockCustomerId });

			expect(mockRecordWorkflowExecution).toHaveBeenCalledWith(
				expect.objectContaining({
					matched_rule_id: "rule-any-contains",
					input_attr: expect.objectContaining({
						custom_fields: expect.objectContaining({
							language: ["English"]
						})
					})
				})
			);
		});

		it("should evaluate ARRAY_INTERSECTS operator with multiple arrays", async () => {
			const mockRule = {
				id: "rule-array-intersects",
				workflow_version_id: "version-1",
				name: "Test ARRAY_INTERSECTS",
				priority: 1,
				conditions: {
					operator: "AND",
					conditions: [
						{
							field: "custom_fields.currency",
							operator: "ARRAY_INTERSECTS",
							value: ["Swiped", "Keyed", "Other"]
						}
					]
				},
				actions: { type: "SET_FIELD", parameters: { field: "case.status", value: "APPROVED" } },
				created_by: "user-1",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_by: "user-1",
				updated_at: new Date("2024-01-01T00:00:00Z")
			};

			mockExtractRequiredFactsFromWorkflow.mockResolvedValueOnce([]);
			mockLoadWorkflowVersionAndRules.mockResolvedValue({
				version: { id: "version-1", workflow_id: "workflow-realistic-1" },
				rules: [mockRule]
			});

			await workflowManager.processCaseEvent(mockCaseId, { customerId: mockCustomerId });

			expect(mockRecordWorkflowExecution).toHaveBeenCalledWith(
				expect.objectContaining({
					matched_rule_id: "rule-array-intersects"
				})
			);
		});

		it("should evaluate ARRAY_LENGTH operator", async () => {
			const mockRule = {
				id: "rule-array-length",
				workflow_version_id: "version-1",
				name: "Test ARRAY_LENGTH",
				priority: 1,
				conditions: {
					operator: "AND",
					conditions: [
						{
							field: "custom_fields.currency",
							operator: "ARRAY_LENGTH",
							value: 2
						}
					]
				},
				actions: { type: "SET_FIELD", parameters: { field: "case.status", value: "APPROVED" } },
				created_by: "user-1",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_by: "user-1",
				updated_at: new Date("2024-01-01T00:00:00Z")
			};

			mockExtractRequiredFactsFromWorkflow.mockResolvedValueOnce([]);
			mockLoadWorkflowVersionAndRules.mockResolvedValue({
				version: { id: "version-1", workflow_id: "workflow-realistic-1" },
				rules: [mockRule]
			});

			await workflowManager.processCaseEvent(mockCaseId, { customerId: mockCustomerId });

			expect(mockRecordWorkflowExecution).toHaveBeenCalledWith(
				expect.objectContaining({
					matched_rule_id: "rule-array-length"
				})
			);
		});

		it("should evaluate ARRAY_IS_EMPTY operator with empty array", async () => {
			const caseDataWithEmptyArray = {
				...realisticCaseData,
				custom_fields: {
					...realisticCaseData.custom_fields,
					approval_statuses: []
				}
			};

			mockFetchCase.mockResolvedValueOnce(caseDataWithEmptyArray);
			mockExtractRequiredFactsFromWorkflow.mockResolvedValueOnce([]);

			const mockRule = {
				id: "rule-array-is-empty",
				workflow_version_id: "version-1",
				name: "Test ARRAY_IS_EMPTY",
				priority: 1,
				conditions: {
					operator: "AND",
					conditions: [
						{
							field: "custom_fields.approval_statuses",
							operator: "ARRAY_IS_EMPTY",
							value: null
						}
					]
				},
				actions: { type: "SET_FIELD", parameters: { field: "case.status", value: "APPROVED" } },
				created_by: "user-1",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_by: "user-1",
				updated_at: new Date("2024-01-01T00:00:00Z")
			};

			mockLoadWorkflowVersionAndRules.mockResolvedValue({
				version: { id: "version-1", workflow_id: "workflow-realistic-1" },
				rules: [mockRule]
			});

			await workflowManager.processCaseEvent(mockCaseId, { customerId: mockCustomerId });

			expect(mockRecordWorkflowExecution).toHaveBeenCalledWith(
				expect.objectContaining({
					matched_rule_id: "rule-array-is-empty",
					input_attr: expect.objectContaining({
						custom_fields: expect.objectContaining({
							approval_statuses: null
						})
					})
				})
			);
		});

		it("should evaluate ARRAY_IS_NOT_EMPTY operator with non-empty array", async () => {
			const mockRule = {
				id: "rule-array-is-not-empty",
				workflow_version_id: "version-1",
				name: "Test ARRAY_IS_NOT_EMPTY",
				priority: 1,
				conditions: {
					operator: "AND",
					conditions: [
						{
							field: "custom_fields.currency",
							operator: "ARRAY_IS_NOT_EMPTY",
							value: null
						}
					]
				},
				actions: { type: "SET_FIELD", parameters: { field: "case.status", value: "APPROVED" } },
				created_by: "user-1",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_by: "user-1",
				updated_at: new Date("2024-01-01T00:00:00Z")
			};

			mockExtractRequiredFactsFromWorkflow.mockResolvedValueOnce([]);
			mockLoadWorkflowVersionAndRules.mockResolvedValue({
				version: { id: "version-1", workflow_id: "workflow-realistic-1" },
				rules: [mockRule]
			});

			await workflowManager.processCaseEvent(mockCaseId, { customerId: mockCustomerId });

			expect(mockRecordWorkflowExecution).toHaveBeenCalledWith(
				expect.objectContaining({
					matched_rule_id: "rule-array-is-not-empty"
				})
			);
		});
	});

	describe("Standard Operators with Realistic Data", () => {
		it("should evaluate EQUALS operator with case status", async () => {
			const mockRule = {
				id: "rule-equals",
				workflow_version_id: "version-1",
				name: "Test EQUALS with status",
				priority: 1,
				conditions: {
					operator: "AND",
					conditions: [
						{
							field: "case.status.id",
							operator: "=",
							value: "UNDER_MANUAL_REVIEW"
						}
					]
				},
				actions: { type: "SET_FIELD", parameters: { field: "case.status", value: "APPROVED" } },
				created_by: "user-1",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_by: "user-1",
				updated_at: new Date("2024-01-01T00:00:00Z")
			};

			mockExtractRequiredFactsFromWorkflow.mockResolvedValueOnce([]);
			mockLoadWorkflowVersionAndRules.mockResolvedValue({
				version: { id: "version-1", workflow_id: "workflow-realistic-1" },
				rules: [mockRule]
			});

			await workflowManager.processCaseEvent(mockCaseId, { customerId: mockCustomerId });

			expect(mockRecordWorkflowExecution).toHaveBeenCalledWith(
				expect.objectContaining({
					matched_rule_id: "rule-equals"
				})
			);
		});

		it("should evaluate GREATER_THAN operator with facts", async () => {
			const mockRule = {
				id: "rule-greater-than",
				workflow_version_id: "version-1",
				name: "Test GREATER_THAN with credit_score",
				priority: 1,
				conditions: {
					operator: "AND",
					conditions: [
						{
							field: "facts.credit_score",
							operator: ">",
							value: 700
						}
					]
				},
				actions: { type: "SET_FIELD", parameters: { field: "case.status", value: "APPROVED" } },
				created_by: "user-1",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_by: "user-1",
				updated_at: new Date("2024-01-01T00:00:00Z")
			};

			mockExtractRequiredFactsFromWorkflow.mockResolvedValueOnce(["credit_score"]);
			mockLoadWorkflowVersionAndRules.mockResolvedValue({
				version: { id: "version-1", workflow_id: "workflow-realistic-1" },
				rules: [mockRule]
			});

			await workflowManager.processCaseEvent(mockCaseId, { customerId: mockCustomerId });

			expect(mockRecordWorkflowExecution).toHaveBeenCalledWith(
				expect.objectContaining({
					matched_rule_id: "rule-greater-than"
				})
			);
		});

		it("should evaluate CONTAINS operator with dropdown custom field", async () => {
			const mockRule = {
				id: "rule-contains",
				workflow_version_id: "version-1",
				name: "Test CONTAINS with jobtype",
				priority: 1,
				conditions: {
					operator: "AND",
					conditions: [
						{
							field: "custom_fields.jobtype",
							operator: "CONTAINS",
							value: "Manager"
						}
					]
				},
				actions: { type: "SET_FIELD", parameters: { field: "case.status", value: "APPROVED" } },
				created_by: "user-1",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_by: "user-1",
				updated_at: new Date("2024-01-01T00:00:00Z")
			};

			mockExtractRequiredFactsFromWorkflow.mockResolvedValueOnce([]);
			mockLoadWorkflowVersionAndRules.mockResolvedValue({
				version: { id: "version-1", workflow_id: "workflow-realistic-1" },
				rules: [mockRule]
			});

			await workflowManager.processCaseEvent(mockCaseId, { customerId: mockCustomerId });

			expect(mockRecordWorkflowExecution).toHaveBeenCalledWith(
				expect.objectContaining({
					matched_rule_id: "rule-contains",
					input_attr: expect.objectContaining({
						custom_fields: expect.objectContaining({
							jobtype: "Manager"
						})
					})
				})
			);
		});

		it("should evaluate IS_NULL operator with null custom field", async () => {
			const mockRule = {
				id: "rule-is-null",
				workflow_version_id: "version-1",
				name: "Test IS_NULL with acc",
				priority: 1,
				conditions: {
					operator: "AND",
					conditions: [
						{
							field: "custom_fields.acc",
							operator: "IS_NULL",
							value: null
						}
					]
				},
				actions: { type: "SET_FIELD", parameters: { field: "case.status", value: "APPROVED" } },
				created_by: "user-1",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_by: "user-1",
				updated_at: new Date("2024-01-01T00:00:00Z")
			};

			mockExtractRequiredFactsFromWorkflow.mockResolvedValueOnce([]);
			mockLoadWorkflowVersionAndRules.mockResolvedValue({
				version: { id: "version-1", workflow_id: "workflow-realistic-1" },
				rules: [mockRule]
			});

			await workflowManager.processCaseEvent(mockCaseId, { customerId: mockCustomerId });

			expect(mockRecordWorkflowExecution).toHaveBeenCalledWith(
				expect.objectContaining({
					matched_rule_id: "rule-is-null"
				})
			);
		});
	});

	describe("Complex Scenarios with Multiple Operators", () => {
		it("should evaluate complex rule with case, facts, and custom_fields", async () => {
			const mockRule = {
				id: "rule-complex",
				workflow_version_id: "version-1",
				name: "Complex Rule with Multiple Conditions",
				priority: 1,
				conditions: {
					operator: "AND",
					conditions: [
						{
							field: "case.status.id",
							operator: "=",
							value: "UNDER_MANUAL_REVIEW"
						},
						{
							field: "facts.credit_score",
							operator: ">=",
							value: 700
						},
						{
							field: "custom_fields.currency",
							operator: "ANY_EQUALS",
							value: "Swiped"
						},
						{
							field: "custom_fields.language",
							operator: "ARRAY_LENGTH",
							value: 1
						}
					]
				},
				actions: { type: "SET_FIELD", parameters: { field: "case.status", value: "APPROVED" } },
				created_by: "user-1",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_by: "user-1",
				updated_at: new Date("2024-01-01T00:00:00Z")
			};

			mockExtractRequiredFactsFromWorkflow.mockResolvedValueOnce(["credit_score"]);
			mockLoadWorkflowVersionAndRules.mockResolvedValue({
				version: { id: "version-1", workflow_id: "workflow-realistic-1" },
				rules: [mockRule]
			});

			await workflowManager.processCaseEvent(mockCaseId, { customerId: mockCustomerId });

			expect(mockRecordWorkflowExecution).toHaveBeenCalledWith(
				expect.objectContaining({
					matched_rule_id: "rule-complex",
					input_attr: expect.objectContaining({
						case: expect.objectContaining({
							id: mockCaseId,
							business: expect.objectContaining({
								name: "Ukrop's Market Hall"
							}),
							owners: expect.arrayContaining([
								expect.objectContaining({
									first_name: "Nimish",
									last_name: "Knope__test"
								})
							])
						}),
						facts: expect.objectContaining(realisticFacts),
						custom_fields: expect.objectContaining({
							currency: ["Swiped", "Keyed"],
							language: ["English"],
							jobtype: "Manager"
						})
					})
				})
			);
		});

		it("should verify custom_fields transformation is correct", async () => {
			const mockRule = {
				id: "rule-transform-check",
				workflow_version_id: "version-1",
				name: "Check Custom Fields Transformation",
				priority: 1,
				conditions: {
					operator: "AND",
					conditions: [
						{
							field: "custom_fields.currency",
							operator: "ARRAY_IS_NOT_EMPTY",
							value: null
						}
					]
				},
				actions: { type: "SET_FIELD", parameters: { field: "case.status", value: "APPROVED" } },
				created_by: "user-1",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_by: "user-1",
				updated_at: new Date("2024-01-01T00:00:00Z")
			};

			mockExtractRequiredFactsFromWorkflow.mockResolvedValueOnce([]);
			mockLoadWorkflowVersionAndRules.mockResolvedValue({
				version: { id: "version-1", workflow_id: "workflow-realistic-1" },
				rules: [mockRule]
			});

			await workflowManager.processCaseEvent(mockCaseId, { customerId: mockCustomerId });

			const executionCall = mockRecordWorkflowExecution.mock.calls[0][0];
			const customFields = executionCall.input_attr.custom_fields;

			expect(customFields.currency).toEqual(["Swiped", "Keyed"]);
			expect(customFields.language).toEqual(["English"]);
			expect(customFields.jobtype).toBe("Manager");
			expect(customFields.gender).toBe("No gender");
			expect(customFields.precent).toEqual(["Keyed"]);
			expect(customFields.acc).toBeNull();
			expect(customFields.is_customer).toEqual([false]);
			expect(customFields.age).toBe(23);
			expect(customFields.percent).toBe(23);
		});
	});
});
