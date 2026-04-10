import { RuleChangeDetector } from "#core/versioning/detectors/rules/ruleChangeDetector";
import { WorkflowVersionWithRulesAndTriggerConditions, UpdateWorkflowRequest } from "#core/versioning/types";
import { WORKFLOW_STATUS, VERSION_CHANGE_TYPES } from "#constants";

jest.mock("#utils", () => ({
	safeStringify: jest.fn(value => JSON.stringify(value))
}));

describe("RuleChangeDetector", () => {
	let detector: RuleChangeDetector;

	const mockWorkflowVersion: WorkflowVersionWithRulesAndTriggerConditions = {
		id: "version-123",
		workflow_id: "workflow-456",
		trigger_id: "trigger-789",
		version_number: 1,
		status: WORKFLOW_STATUS.PUBLISHED,
		snapshot: {},
		default_action: {
			type: "set_field",
			parameters: { field: "case.status", value: "APPROVED" }
		},
		is_current: true,
		published_at: new Date("2024-01-01T00:00:00Z"),
		created_by: "user-123",
		created_at: new Date("2024-01-01T00:00:00Z"),
		updated_by: "user-123",
		updated_at: new Date("2024-01-01T00:00:00Z"),
		rules: [
			{
				id: "rule-1",
				workflow_version_id: "version-123",
				name: "Test Rule 1",
				priority: 1,
				conditions: {
					operator: "AND",
					conditions: [{ field: "cases.status", operator: "=", value: "submitted" }]
				},
				actions: [
					{
						type: "set_field",
						parameters: { field: "case.priority", value: "HIGH" }
					}
				],
				created_by: "user-123",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_by: "user-123",
				updated_at: new Date("2024-01-01T00:00:00Z")
			},
			{
				id: "rule-2",
				workflow_version_id: "version-123",
				name: "Test Rule 2",
				priority: 2,
				conditions: {
					operator: "AND",
					conditions: [{ field: "cases.amount", operator: ">", value: 1000 }]
				},
				actions: [
					{
						type: "set_field",
						parameters: { field: "case.status", value: "APPROVED" }
					}
				],
				created_by: "user-123",
				created_at: new Date("2024-01-01T00:00:00Z"),
				updated_by: "user-123",
				updated_at: new Date("2024-01-01T00:00:00Z")
			}
		]
	};

	beforeEach(() => {
		detector = new RuleChangeDetector();
		jest.clearAllMocks();
	});

	describe("getFieldPath", () => {
		it("should return 'rules' as field path", () => {
			expect(detector.getFieldPath()).toBe("rules");
		});
	});

	describe("hasChanged", () => {
		it("should return false when no rules in request", () => {
			const updateRequest: UpdateWorkflowRequest = {};

			const result = detector.hasChanged(mockWorkflowVersion, updateRequest);

			expect(result).toBe(false);
		});

		it("should return false when rules are identical", () => {
			const updateRequest: UpdateWorkflowRequest = {
				rules: [
					{
						name: "Test Rule 1",
						conditions: {
							operator: "AND",
							conditions: [{ field: "cases.status", operator: "=", value: "submitted" }]
						},
						actions: [
							{
								type: "set_field",
								parameters: { field: "case.priority", value: "HIGH" }
							}
						]
					},
					{
						name: "Test Rule 2",
						conditions: {
							operator: "AND",
							conditions: [{ field: "cases.amount", operator: ">", value: 1000 }]
						},
						actions: [
							{
								type: "set_field",
								parameters: { field: "case.status", value: "APPROVED" }
							}
						]
					}
				]
			};

			const result = detector.hasChanged(mockWorkflowVersion, updateRequest);

			expect(result).toBe(false);
		});

		it("should return true when rules have different priority", () => {
			const updateRequest: UpdateWorkflowRequest = {
				rules: [
					{
						name: "Test Rule 1",
						priority: 2, // Changed from 1 to 2
						conditions: {
							operator: "AND",
							conditions: [{ field: "cases.status", operator: "=", value: "submitted" }]
						},
						actions: [
							{
								type: "set_field",
								parameters: { field: "case.priority", value: "HIGH" }
							}
						]
					}
				]
			};

			const result = detector.hasChanged(mockWorkflowVersion, updateRequest);

			expect(result).toBe(true);
		});

		it("should return true when rules have different conditions", () => {
			const updateRequest: UpdateWorkflowRequest = {
				rules: [
					{
						name: "Test Rule 1",
						priority: 1,
						conditions: {
							operator: "AND",
							conditions: [{ field: "cases.status", operator: "=", value: "pending" }] // Changed value
						},
						actions: [
							{
								type: "set_field",
								parameters: { field: "case.priority", value: "HIGH" }
							}
						]
					}
				]
			};

			const result = detector.hasChanged(mockWorkflowVersion, updateRequest);

			expect(result).toBe(true);
		});

		it("should return true when rules have different actions", () => {
			const updateRequest: UpdateWorkflowRequest = {
				rules: [
					{
						name: "Test Rule 1",
						priority: 1,
						conditions: {
							operator: "AND",
							conditions: [{ field: "cases.status", operator: "=", value: "submitted" }]
						},
						actions: [
							{
								type: "set_field",
								parameters: { field: "case.status", value: "PROCESSED" } // Changed action
							}
						]
					}
				]
			};

			const result = detector.hasChanged(mockWorkflowVersion, updateRequest);

			expect(result).toBe(true);
		});

		it("should return true when number of rules is different", () => {
			const updateRequest: UpdateWorkflowRequest = {
				rules: [
					{
						name: "Test Rule 1",
						priority: 1,
						conditions: {
							operator: "AND",
							conditions: [{ field: "cases.status", operator: "=", value: "submitted" }]
						},
						actions: [
							{
								type: "set_field",
								parameters: { field: "case.priority", value: "HIGH" }
							}
						]
					}
					// Missing second rule
				]
			};

			const result = detector.hasChanged(mockWorkflowVersion, updateRequest);

			expect(result).toBe(true);
		});
	});

	describe("detectChanges", () => {
		it("should return empty array when no rules in request", () => {
			const updateRequest: UpdateWorkflowRequest = {};

			const result = detector.detectChanges(mockWorkflowVersion, updateRequest);

			expect(result).toEqual([]);
		});

		it("should return empty array when no changes detected", () => {
			const updateRequest: UpdateWorkflowRequest = {
				rules: [
					{
						name: "Test Rule 1",
						priority: 1,
						conditions: {
							operator: "AND",
							conditions: [{ field: "cases.status", operator: "=", value: "submitted" }]
						},
						actions: [
							{
								type: "set_field",
								parameters: { field: "case.priority", value: "HIGH" }
							}
						]
					},
					{
						name: "Test Rule 2",
						priority: 2,
						conditions: {
							operator: "AND",
							conditions: [{ field: "cases.amount", operator: ">", value: 1000 }]
						},
						actions: [
							{
								type: "set_field",
								parameters: { field: "case.status", value: "APPROVED" }
							}
						]
					}
				]
			};

			const result = detector.detectChanges(mockWorkflowVersion, updateRequest);

			expect(result).toEqual([]);
		});

		it("should detect changes in actions", () => {
			const updateRequest: UpdateWorkflowRequest = {
				rules: [
					{
						name: "Test Rule 1",
						priority: 1,
						conditions: {
							operator: "AND",
							conditions: [{ field: "cases.status", operator: "=", value: "submitted" }]
						},
						actions: [
							{
								type: "set_field",
								parameters: { field: "case.status", value: "PROCESSED" } // Changed action
							}
						]
					},
					{
						name: "Test Rule 2",
						priority: 2,
						conditions: {
							operator: "AND",
							conditions: [{ field: "cases.amount", operator: ">", value: 1000 }]
						},
						actions: [
							{
								type: "set_field",
								parameters: { field: "case.status", value: "APPROVED" }
							}
						]
					}
				]
			};

			const result = detector.detectChanges(mockWorkflowVersion, updateRequest);

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				field_path: "rules.actions",
				old_value: expect.any(String),
				new_value: expect.any(String),
				change_type: VERSION_CHANGE_TYPES.RULE_MODIFIED
			});
		});

		it("should detect changes in conditions", () => {
			const updateRequest: UpdateWorkflowRequest = {
				rules: [
					{
						name: "Test Rule 1",
						priority: 1,
						conditions: {
							operator: "AND",
							conditions: [{ field: "cases.status", operator: "=", value: "pending" }] // Changed condition
						},
						actions: [
							{
								type: "set_field",
								parameters: { field: "case.priority", value: "HIGH" }
							}
						]
					},
					{
						name: "Test Rule 2",
						priority: 2,
						conditions: {
							operator: "AND",
							conditions: [{ field: "cases.amount", operator: ">", value: 1000 }]
						},
						actions: [
							{
								type: "set_field",
								parameters: { field: "case.status", value: "APPROVED" }
							}
						]
					}
				]
			};

			const result = detector.detectChanges(mockWorkflowVersion, updateRequest);

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				field_path: "rules.conditions",
				old_value: expect.any(String),
				new_value: expect.any(String),
				change_type: VERSION_CHANGE_TYPES.RULE_MODIFIED
			});
		});

		it("should detect changes in name, actions and conditions", () => {
			const updateRequest: UpdateWorkflowRequest = {
				rules: [
					{
						name: "Test Rule 1",
						priority: 1,
						conditions: {
							operator: "AND",
							conditions: [{ field: "cases.status", operator: "=", value: "pending" }] // Changed condition
						},
						actions: [
							{
								type: "set_field",
								parameters: { field: "case.status", value: "PROCESSED" } // Changed action
							}
						]
					}
				]
			};

			const result = detector.detectChanges(mockWorkflowVersion, updateRequest);

			expect(result).toHaveLength(3);
			expect(result[0].field_path).toBe("rules.name");
			expect(result[1].field_path).toBe("rules.actions");
			expect(result[2].field_path).toBe("rules.conditions");
		});
	});
});
