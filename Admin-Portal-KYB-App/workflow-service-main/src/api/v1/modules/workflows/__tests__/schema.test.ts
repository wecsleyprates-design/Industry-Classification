import { createWorkflowDraftSchema, previewEvaluationSchema } from "../schema";

describe("Create Workflow Draft Schema", () => {
	describe("createWorkflowDraftSchema", () => {
		it("should validate correct data with all fields", () => {
			const validData = {
				name: "Test Workflow",
				description: "Test description",
				trigger_id: "123e4567-e89b-12d3-a456-426614174000"
			};

			const { error, value } = createWorkflowDraftSchema.validate(validData) as { error: unknown; value: unknown };

			expect(error).toBeUndefined();
			expect(value).toEqual({ ...validData, auto_publish: false });
		});

		it("should validate correct data with only required fields", () => {
			const validData = {
				name: "Test Workflow",
				trigger_id: "123e4567-e89b-12d3-a456-426614174000"
			};

			const { error, value } = createWorkflowDraftSchema.validate(validData) as { error: unknown; value: unknown };

			expect(error).toBeUndefined();
			expect(value).toEqual({ ...validData, auto_publish: false });
		});

		it("should validate correct data with trigger_id only", () => {
			const validData = {
				name: "Test Workflow",
				trigger_id: "123e4567-e89b-12d3-a456-426614174000"
			};

			const { error, value } = createWorkflowDraftSchema.validate(validData) as { error: unknown; value: unknown };

			expect(error).toBeUndefined();
			expect(value).toEqual({ ...validData, auto_publish: false });
		});

		it("should reject invalid UUID format for trigger_id", () => {
			const invalidData = {
				name: "Test Workflow",
				trigger_id: "not-a-uuid"
			};

			const { error } = createWorkflowDraftSchema.validate(invalidData);

			expect(error).toBeDefined();
			expect(error?.details[0].message).toContain("Trigger ID must be a valid UUID");
		});

		it("should reject missing name", () => {
			const invalidData = {
				description: "Test description"
			};

			const { error } = createWorkflowDraftSchema.validate(invalidData);

			expect(error).toBeDefined();
			expect(error?.details[0].message).toContain("is required");
		});

		it("should reject empty name", () => {
			const invalidData = {
				name: ""
			};

			const { error } = createWorkflowDraftSchema.validate(invalidData);

			expect(error).toBeDefined();
			expect(error?.details[0].message).toContain("Workflow name is required");
		});

		it("should reject name that is too long", () => {
			const invalidData = {
				name: "a".repeat(256) // 256 characters, exceeds max of 255
			};

			const { error } = createWorkflowDraftSchema.validate(invalidData);

			expect(error).toBeDefined();
			expect(error?.details[0].message).toContain("Workflow name must not exceed 255 characters");
		});

		it("should reject description that is too long", () => {
			const invalidData = {
				name: "Test Workflow",
				description: "a".repeat(1001) // 1001 characters, exceeds max of 1000
			};

			const { error } = createWorkflowDraftSchema.validate(invalidData);

			expect(error).toBeDefined();
			expect(error?.details[0].message).toContain("Workflow description must not exceed 1000 characters");
		});

		it("should accept empty description", () => {
			const validData = {
				name: "Test Workflow",
				trigger_id: "123e4567-e89b-12d3-a456-426614174000",
				description: ""
			};

			const { error, value } = createWorkflowDraftSchema.validate(validData) as { error: unknown; value: unknown };

			expect(error).toBeUndefined();
			expect(value).toEqual({ ...validData, auto_publish: false });
		});

		it("should validate with auto_publish set to true", () => {
			const validData = {
				name: "Test Workflow",
				trigger_id: "123e4567-e89b-12d3-a456-426614174000",
				auto_publish: true
			};

			const { error, value } = createWorkflowDraftSchema.validate(validData) as { error: unknown; value: unknown };

			expect(error).toBeUndefined();
			expect(value).toEqual(validData);
		});

		it("should reject additional properties", () => {
			const invalidData = {
				name: "Test Workflow",
				trigger_id: "123e4567-e89b-12d3-a456-426614174000",
				extra_field: "not allowed"
			};

			const { error } = createWorkflowDraftSchema.validate(invalidData);

			expect(error).toBeDefined();
			expect(error?.details[0].message).toContain("is not allowed");
		});
	});
});

describe("Preview Evaluation Schema", () => {
	describe("previewEvaluationSchema", () => {
		it("should validate with single business_id string", () => {
			const validData = {
				business_id: "123e4567-e89b-12d3-a456-426614174000",
				sample_size: 10
			};

			const { error, value } = previewEvaluationSchema.validate(validData) as {
				error: unknown;
				value: { business_id?: string | string[]; sample_size?: number };
			};

			expect(error).toBeUndefined();
			expect(Array.isArray(value.business_id)).toBe(true);
			expect(value.business_id).toEqual([validData.business_id]);
		});

		it("should validate with multiple business_id (array)", () => {
			const businessIds = [
				"123e4567-e89b-12d3-a456-426614174000",
				"223e4567-e89b-12d3-a456-426614174001",
				"323e4567-e89b-12d3-a456-426614174002"
			];
			const validData = {
				business_id: businessIds,
				sample_size: 10
			};

			const { error, value } = previewEvaluationSchema.validate(validData) as {
				error: unknown;
				value: { business_id: string | string[]; sample_size?: number };
			};

			expect(error).toBeUndefined();
			expect(Array.isArray(value.business_id)).toBe(true);
			expect(value.business_id).toEqual(businessIds);
		});

		it("should validate with case_id", () => {
			const validData = {
				case_id: "123e4567-e89b-12d3-a456-426614174000"
			};

			const { error, value } = previewEvaluationSchema.validate(validData) as {
				error: unknown;
				value: { case_id?: string };
			};

			expect(error).toBeUndefined();
			expect(value.case_id).toBe(validData.case_id);
		});

		it("should reject empty business_id array", () => {
			const invalidData = {
				business_id: []
			};

			const { error } = previewEvaluationSchema.validate(invalidData);

			expect(error).toBeDefined();
			expect(error?.details[0].message).toContain("At least one business ID must be provided");
		});

		it("should reject more than 10 business_ids", () => {
			const businessIds = Array.from(
				{ length: 11 },
				(_, i) => `123e4567-e89b-12d3-a456-${String(i).padStart(12, "0")}`
			);
			const invalidData = {
				business_id: businessIds
			};

			const { error } = previewEvaluationSchema.validate(invalidData);

			expect(error).toBeDefined();
			expect(error?.details[0].message).toContain("Maximum of 10 business IDs allowed");
		});

		it("should accept exactly 10 business_ids", () => {
			const businessIds = Array.from(
				{ length: 10 },
				(_, i) => `123e4567-e89b-12d3-a456-${String(i).padStart(12, "0")}`
			);
			const validData = {
				business_id: businessIds
			};

			const { error } = previewEvaluationSchema.validate(validData);

			expect(error).toBeUndefined();
		});

		it("should reject invalid UUID in business_id string", () => {
			const invalidData = {
				business_id: "not-a-uuid"
			};

			const { error } = previewEvaluationSchema.validate(invalidData);

			expect(error).toBeDefined();
			expect(error?.details[0].message).toContain("Business ID must be a valid UUID");
		});

		it("should reject invalid UUID in business_id array", () => {
			const invalidData = {
				business_id: ["123e4567-e89b-12d3-a456-426614174000", "not-a-uuid"]
			};

			const { error } = previewEvaluationSchema.validate(invalidData);

			expect(error).toBeDefined();
			expect(error?.details[0].message).toContain("Each business ID must be a valid UUID");
		});

		it("should reject when neither case_id nor business_id is provided", () => {
			const invalidData = {
				sample_size: 10
			};

			const { error } = previewEvaluationSchema.validate(invalidData);

			expect(error).toBeDefined();
			expect(error?.details[0].message).toContain("Either case_id or business_id must be provided");
		});

		it("should prioritize case_id when both case_id and business_id are provided", () => {
			const validData = {
				case_id: "123e4567-e89b-12d3-a456-426614174000",
				business_id: "223e4567-e89b-12d3-a456-426614174001",
				sample_size: 10
			};

			const { error, value } = previewEvaluationSchema.validate(validData) as {
				error: unknown;
				value: { case_id?: string; business_id?: string | string[]; sample_size?: number };
			};

			expect(error).toBeUndefined();
			expect(value.case_id).toBe(validData.case_id);
			expect(value.business_id).toBeUndefined();
			expect(value.sample_size).toBeUndefined();
		});

		it("should set default sample_size when business_id is provided without sample_size", () => {
			const validData = {
				business_id: "123e4567-e89b-12d3-a456-426614174000"
			};

			const { error, value } = previewEvaluationSchema.validate(validData) as {
				error: unknown;
				value: { business_id?: string | string[]; sample_size?: number };
			};

			expect(error).toBeUndefined();
			expect(value.sample_size).toBe(10);
		});

		it("should reject invalid case_id UUID", () => {
			const invalidData = {
				case_id: "not-a-uuid"
			};

			const { error } = previewEvaluationSchema.validate(invalidData);

			expect(error).toBeDefined();
			expect(error?.details[0].message).toContain("Case ID must be a valid UUID");
		});

		it("should reject sample_size less than 1", () => {
			const invalidData = {
				business_id: "123e4567-e89b-12d3-a456-426614174000",
				sample_size: 0
			};

			const { error } = previewEvaluationSchema.validate(invalidData);

			expect(error).toBeDefined();
			expect(error?.details[0].message).toContain("Sample size must be at least 1");
		});

		it("should reject sample_size greater than 100", () => {
			const invalidData = {
				business_id: "123e4567-e89b-12d3-a456-426614174000",
				sample_size: 101
			};

			const { error } = previewEvaluationSchema.validate(invalidData);

			expect(error).toBeDefined();
			expect(error?.details[0].message).toContain("Sample size must not exceed 100");
		});
	});
});
