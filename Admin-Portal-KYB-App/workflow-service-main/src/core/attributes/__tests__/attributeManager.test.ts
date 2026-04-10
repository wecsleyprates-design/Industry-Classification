import { AttributeManager } from "../attributeManager";
import { AttributeRepository } from "../attributeRepository";
import { ATTRIBUTE_CATALOG_OPERATORS_FILTER as FILTER, buildCatalogOperatorsForDataType } from "../catalogOperators";
import { logger } from "#helpers/logger";
import type { AttributeCatalogRecord } from "../types";

// Mock logger
jest.mock("#helpers/logger", () => ({
	logger: {
		info: jest.fn(),
		debug: jest.fn(),
		error: jest.fn(),
		warn: jest.fn()
	}
}));

// Mock AttributeRepository
jest.mock("../attributeRepository");
const mockedAttributeRepository = AttributeRepository as jest.MockedClass<typeof AttributeRepository>;

const mockGetCustomFieldsSummary = jest.fn();
jest.mock("#services/case", () => ({
	CaseService: jest.fn().mockImplementation(() => ({
		getCustomFieldsSummary: mockGetCustomFieldsSummary
	}))
}));

describe("AttributeManager", () => {
	let attributeManager: AttributeManager;
	let mockAttributeRepository: jest.Mocked<AttributeRepository>;

	beforeEach(() => {
		mockAttributeRepository = {
			getAttributes: jest.fn()
		} as unknown as jest.Mocked<AttributeRepository>;

		mockedAttributeRepository.mockImplementation(() => mockAttributeRepository);
		attributeManager = new AttributeManager(mockAttributeRepository);

		// Mock CaseService to return empty array by default (no custom fields)
		mockGetCustomFieldsSummary.mockResolvedValue([]);

		jest.clearAllMocks();
	});

	describe("getAttributeCatalog", () => {
		it("should successfully retrieve and group attributes by context", async () => {
			const mockRecords: AttributeCatalogRecord[] = [
				{
					id: "attr-1",
					context: "financial",
					source: "facts",
					path: "facts.credit_score",
					label: "Credit Score",
					data_type: "number",
					description: "Credit score from credit bureau",
					active: true,
					validation_regex: null,
					created_at: new Date("2024-01-01T00:00:00Z"),
					updated_at: new Date("2024-01-01T00:00:00Z")
				},
				{
					id: "attr-2",
					context: "financial",
					source: "facts",
					path: "facts.annual_income",
					label: "Annual Income",
					data_type: "number",
					description: "Annual income in USD",
					active: true,
					validation_regex: null,
					created_at: new Date("2024-01-01T00:00:00Z"),
					updated_at: new Date("2024-01-01T00:00:00Z")
				},
				{
					id: "attr-3",
					context: "kyc",
					source: "case",
					path: "case.status",
					label: "Case Status",
					data_type: "enum",
					description: "Current status of the case",
					active: true,
					validation_regex: null,
					created_at: new Date("2024-01-01T00:00:00Z"),
					updated_at: new Date("2024-01-01T00:00:00Z")
				}
			];

			mockAttributeRepository.getAttributes.mockResolvedValue(mockRecords);

			const result = await attributeManager.getAttributeCatalog({}, "550e8400-e29b-41d4-a716-446655440000");

			expect(mockAttributeRepository.getAttributes).toHaveBeenCalledWith({});
			expect(result).toEqual({
				financial: [
					{
						context: "financial",
						source: "facts",
						attribute: {
							name: "credit_score",
							label: "Credit Score"
						},
						operators: buildCatalogOperatorsForDataType("number", FILTER.ALL),
						data_type: "number",
						validation_regex: null,
						description: "Credit score from credit bureau"
					},
					{
						context: "financial",
						source: "facts",
						attribute: {
							name: "annual_income",
							label: "Annual Income"
						},
						operators: buildCatalogOperatorsForDataType("number", FILTER.ALL),
						data_type: "number",
						validation_regex: null,
						description: "Annual income in USD"
					}
				],
				kyc: [
					{
						context: "kyc",
						source: "case",
						attribute: {
							name: "status",
							label: "Case Status"
						},
						operators: buildCatalogOperatorsForDataType("enum", FILTER.ALL),
						data_type: "enum",
						validation_regex: null,
						description: "Current status of the case"
					}
				]
			});
		});

		it("should filter by source when provided", async () => {
			const mockRecords: AttributeCatalogRecord[] = [
				{
					id: "attr-1",
					context: "financial",
					source: "facts",
					path: "facts.credit_score",
					label: "Credit Score",
					data_type: "number",
					description: "Credit score",
					active: true,
					validation_regex: null,
					created_at: new Date("2024-01-01T00:00:00Z"),
					updated_at: new Date("2024-01-01T00:00:00Z")
				}
			];

			mockAttributeRepository.getAttributes.mockResolvedValue(mockRecords);

			await attributeManager.getAttributeCatalog({ source: "facts" }, "550e8400-e29b-41d4-a716-446655440000");

			expect(mockAttributeRepository.getAttributes).toHaveBeenCalledWith({
				source: "facts"
			});
		});

		it("should filter by context when provided", async () => {
			const mockRecords: AttributeCatalogRecord[] = [
				{
					id: "attr-1",
					context: "financial",
					source: "facts",
					path: "facts.credit_score",
					label: "Credit Score",
					data_type: "number",
					description: "Credit score",
					active: true,
					validation_regex: null,
					created_at: new Date("2024-01-01T00:00:00Z"),
					updated_at: new Date("2024-01-01T00:00:00Z")
				}
			];

			mockAttributeRepository.getAttributes.mockResolvedValue(mockRecords);

			await attributeManager.getAttributeCatalog({ context: "financial" }, "550e8400-e29b-41d4-a716-446655440000");

			expect(mockAttributeRepository.getAttributes).toHaveBeenCalledWith({
				context: "financial"
			});
		});

		it("should filter by both source and context when provided", async () => {
			const mockRecords: AttributeCatalogRecord[] = [
				{
					id: "attr-1",
					context: "financial",
					source: "facts",
					path: "facts.credit_score",
					label: "Credit Score",
					data_type: "number",
					description: "Credit score",
					active: true,
					validation_regex: null,
					created_at: new Date("2024-01-01T00:00:00Z"),
					updated_at: new Date("2024-01-01T00:00:00Z")
				}
			];

			mockAttributeRepository.getAttributes.mockResolvedValue(mockRecords);

			await attributeManager.getAttributeCatalog(
				{ source: "facts", context: "financial" },
				"550e8400-e29b-41d4-a716-446655440000"
			);

			expect(mockAttributeRepository.getAttributes).toHaveBeenCalledWith({
				source: "facts",
				context: "financial"
			});
		});

		it("should handle empty records array", async () => {
			mockAttributeRepository.getAttributes.mockResolvedValue([]);

			const result = await attributeManager.getAttributeCatalog({}, "550e8400-e29b-41d4-a716-446655440000");

			expect(result).toEqual({});
		});

		it("should use attribute name as label when label is null", async () => {
			const mockRecords: AttributeCatalogRecord[] = [
				{
					id: "attr-1",
					context: "financial",
					source: "facts",
					path: "facts.custom_field",
					label: null,
					data_type: "string",
					description: null,
					active: true,
					validation_regex: null,
					created_at: new Date("2024-01-01T00:00:00Z"),
					updated_at: new Date("2024-01-01T00:00:00Z")
				}
			];

			mockAttributeRepository.getAttributes.mockResolvedValue(mockRecords);

			const result = await attributeManager.getAttributeCatalog({}, "550e8400-e29b-41d4-a716-446655440000");

			expect(result.financial[0].attribute.label).toBe("custom_field");
			expect(result.financial[0].attribute.name).toBe("custom_field");
		});

		it("should extract attribute name correctly from path", async () => {
			const mockRecords: AttributeCatalogRecord[] = [
				{
					id: "attr-1",
					context: "financial",
					source: "facts",
					path: "facts.credit_score",
					label: "Credit Score",
					data_type: "number",
					description: null,
					active: true,
					validation_regex: null,
					created_at: new Date("2024-01-01T00:00:00Z"),
					updated_at: new Date("2024-01-01T00:00:00Z")
				}
			];

			mockAttributeRepository.getAttributes.mockResolvedValue(mockRecords);

			const result = await attributeManager.getAttributeCatalog({}, "550e8400-e29b-41d4-a716-446655440000");

			expect(result.financial[0].attribute.name).toBe("credit_score");
		});

		it("should return correct operators for each data type", async () => {
			const mockRecords: AttributeCatalogRecord[] = [
				{
					id: "attr-1",
					context: "Test",
					source: "facts",
					path: "facts.number_field",
					label: "Number Field",
					data_type: "number",
					description: null,
					active: true,
					validation_regex: null,
					created_at: new Date("2024-01-01T00:00:00Z"),
					updated_at: new Date("2024-01-01T00:00:00Z")
				},
				{
					id: "attr-2",
					context: "Test",
					source: "facts",
					path: "facts.string_field",
					label: "String Field",
					data_type: "string",
					description: null,
					active: true,
					validation_regex: null,
					created_at: new Date("2024-01-01T00:00:00Z"),
					updated_at: new Date("2024-01-01T00:00:00Z")
				},
				{
					id: "attr-3",
					context: "Test",
					source: "facts",
					path: "facts.boolean_field",
					label: "Boolean Field",
					data_type: "boolean",
					description: null,
					active: true,
					validation_regex: null,
					created_at: new Date("2024-01-01T00:00:00Z"),
					updated_at: new Date("2024-01-01T00:00:00Z")
				},
				{
					id: "attr-4",
					context: "Test",
					source: "facts",
					path: "facts.date_field",
					label: "Date Field",
					data_type: "date",
					description: null,
					active: true,
					validation_regex: null,
					created_at: new Date("2024-01-01T00:00:00Z"),
					updated_at: new Date("2024-01-01T00:00:00Z")
				},
				{
					id: "attr-5",
					context: "Test",
					source: "facts",
					path: "facts.enum_field",
					label: "Enum Field",
					data_type: "enum",
					description: null,
					active: true,
					validation_regex: null,
					created_at: new Date("2024-01-01T00:00:00Z"),
					updated_at: new Date("2024-01-01T00:00:00Z")
				}
			];

			mockAttributeRepository.getAttributes.mockResolvedValue(mockRecords);

			const result = await attributeManager.getAttributeCatalog({}, "550e8400-e29b-41d4-a716-446655440000");

			expect(result.Test[0].operators).toEqual(buildCatalogOperatorsForDataType("number", FILTER.ALL));
			expect(result.Test[1].operators).toEqual(buildCatalogOperatorsForDataType("string", FILTER.ALL));
			expect(result.Test[2].operators).toEqual(buildCatalogOperatorsForDataType("boolean", FILTER.ALL));
			expect(result.Test[3].operators).toEqual(buildCatalogOperatorsForDataType("date", FILTER.ALL));
			expect(result.Test[4].operators).toEqual(buildCatalogOperatorsForDataType("enum", FILTER.ALL));
		});

		it("should return correct operators for ARRAY data type", async () => {
			const mockRecords: AttributeCatalogRecord[] = [
				{
					id: "attr-1",
					context: "Test",
					source: "custom_fields",
					path: "custom_fields.tags",
					label: "Tags",
					data_type: "array",
					description: null,
					active: true,
					validation_regex: null,
					created_at: new Date("2024-01-01T00:00:00Z"),
					updated_at: new Date("2024-01-01T00:00:00Z")
				}
			];

			mockAttributeRepository.getAttributes.mockResolvedValue(mockRecords);

			const result = await attributeManager.getAttributeCatalog({}, "550e8400-e29b-41d4-a716-446655440000");

			expect(result.Test[0].operators).toEqual(buildCatalogOperatorsForDataType("array", FILTER.ALL));
		});

		it("should return default operators for unknown data type", async () => {
			const mockRecords: AttributeCatalogRecord[] = [
				{
					id: "attr-1",
					context: "Test",
					source: "facts",
					path: "facts.unknown_field",
					label: "Unknown Field",
					data_type: "unknown" as any,
					description: null,
					active: true,
					validation_regex: null,
					created_at: new Date("2024-01-01T00:00:00Z"),
					updated_at: new Date("2024-01-01T00:00:00Z")
				}
			];

			mockAttributeRepository.getAttributes.mockResolvedValue(mockRecords);

			const result = await attributeManager.getAttributeCatalog({}, "550e8400-e29b-41d4-a716-446655440000");

			expect(result.Test[0].operators).toEqual(buildCatalogOperatorsForDataType("unknown", FILTER.ALL));
		});

		it("should return only comparison operators when operatorType is comparison", async () => {
			const mockRecords: AttributeCatalogRecord[] = [
				{
					id: "attr-1",
					context: "financial",
					source: "facts",
					path: "facts.credit_score",
					label: "Credit Score",
					data_type: "number",
					description: null,
					active: true,
					validation_regex: null,
					created_at: new Date("2024-01-01T00:00:00Z"),
					updated_at: new Date("2024-01-01T00:00:00Z")
				}
			];

			mockAttributeRepository.getAttributes.mockResolvedValue(mockRecords);

			const result = await attributeManager.getAttributeCatalog(
				{},
				"550e8400-e29b-41d4-a716-446655440000",
				FILTER.COMPARISON
			);

			expect(result.financial[0].operators).toEqual(buildCatalogOperatorsForDataType("number", FILTER.COMPARISON));
		});

		it("should return only variation operators when operatorType is variation", async () => {
			const mockRecords: AttributeCatalogRecord[] = [
				{
					id: "attr-1",
					context: "financial",
					source: "facts",
					path: "facts.credit_score",
					label: "Credit Score",
					data_type: "number",
					description: null,
					active: true,
					validation_regex: null,
					created_at: new Date("2024-01-01T00:00:00Z"),
					updated_at: new Date("2024-01-01T00:00:00Z")
				}
			];

			mockAttributeRepository.getAttributes.mockResolvedValue(mockRecords);

			const result = await attributeManager.getAttributeCatalog(
				{},
				"550e8400-e29b-41d4-a716-446655440000",
				FILTER.VARIATION
			);

			expect(result.financial[0].operators).toEqual(buildCatalogOperatorsForDataType("number", FILTER.VARIATION));
		});

		it("should include validation regex when present", async () => {
			const mockRecords: AttributeCatalogRecord[] = [
				{
					id: "attr-1",
					context: "kyc",
					source: "case",
					path: "case.email",
					label: "Email Address",
					data_type: "string",
					description: "Customer email",
					active: true,
					validation_regex: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
					created_at: new Date("2024-01-01T00:00:00Z"),
					updated_at: new Date("2024-01-01T00:00:00Z")
				}
			];

			mockAttributeRepository.getAttributes.mockResolvedValue(mockRecords);

			const result = await attributeManager.getAttributeCatalog({}, "550e8400-e29b-41d4-a716-446655440000");

			expect(result.kyc[0].validation_regex).toBe("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$");
		});

		it("should propagate repository errors", async () => {
			const error = new Error("Database connection failed");
			mockAttributeRepository.getAttributes.mockRejectedValue(error);

			await expect(attributeManager.getAttributeCatalog({}, "550e8400-e29b-41d4-a716-446655440000")).rejects.toThrow(
				error
			);
			expect(logger.error).toHaveBeenCalledWith({ error }, "AttributeManager: Failed to retrieve attribute catalog");
		});

		describe("Custom Fields Integration", () => {
			it("should include custom fields when source is custom_fields", async () => {
				const mockCustomFields = [
					{
						field: "product_code",
						label: "Product Code",
						type: "text"
					},
					{
						field: "risk_level",
						label: "Risk Level",
						type: "dropdown"
					}
				];

				mockGetCustomFieldsSummary.mockResolvedValue(mockCustomFields);
				mockAttributeRepository.getAttributes.mockResolvedValue([]);

				const result = await attributeManager.getAttributeCatalog(
					{ source: "custom_fields" },
					"550e8400-e29b-41d4-a716-446655440000"
				);

				expect(mockGetCustomFieldsSummary).toHaveBeenCalledWith("550e8400-e29b-41d4-a716-446655440000");
				expect(result.custom_fields).toBeDefined();
				expect(result.custom_fields).toHaveLength(2);
				expect(result.custom_fields[0].attribute.name).toBe("product_code");
				expect(result.custom_fields[0].attribute.label).toBe("Product Code");
				expect(result.custom_fields[0].data_type).toBe("string");
			});

			it("should include custom fields when no source filter is provided", async () => {
				const mockCustomFields = [
					{
						field: "tags",
						label: "Tags",
						type: "checkbox"
					}
				];

				mockGetCustomFieldsSummary.mockResolvedValue(mockCustomFields);
				mockAttributeRepository.getAttributes.mockResolvedValue([]);

				const result = await attributeManager.getAttributeCatalog({}, "550e8400-e29b-41d4-a716-446655440000");

				expect(mockGetCustomFieldsSummary).toHaveBeenCalled();
				expect(result.custom_fields).toBeDefined();
				expect(result.custom_fields[0].data_type).toBe("array");
				expect(result.custom_fields[0].operators).toContain("ANY_EQUALS");
			});

			it("should not include custom fields when source is facts", async () => {
				mockAttributeRepository.getAttributes.mockResolvedValue([]);

				await attributeManager.getAttributeCatalog({ source: "facts" }, "550e8400-e29b-41d4-a716-446655440000");

				expect(mockGetCustomFieldsSummary).not.toHaveBeenCalled();
			});

			it("should not include custom fields when source is case", async () => {
				mockAttributeRepository.getAttributes.mockResolvedValue([]);

				await attributeManager.getAttributeCatalog({ source: "case" }, "550e8400-e29b-41d4-a716-446655440000");

				expect(mockGetCustomFieldsSummary).not.toHaveBeenCalled();
			});

			it("should map custom field types correctly", async () => {
				const mockCustomFields = [
					{ field: "text_field", label: "Text", type: "text" },
					{ field: "number_field", label: "Number", type: "integer" },
					{ field: "bool_field", label: "Boolean", type: "boolean" },
					{ field: "date_field", label: "Date", type: "date" },
					{ field: "array_field", label: "Array", type: "checkbox" },
					{ field: "unknown_field", label: "Unknown", type: "unknown_type" }
				];

				mockGetCustomFieldsSummary.mockResolvedValue(mockCustomFields);
				mockAttributeRepository.getAttributes.mockResolvedValue([]);

				const result = await attributeManager.getAttributeCatalog(
					{ source: "custom_fields" },
					"550e8400-e29b-41d4-a716-446655440000"
				);

				expect(result.custom_fields[0].data_type).toBe("string"); // text
				expect(result.custom_fields[1].data_type).toBe("number"); // integer
				expect(result.custom_fields[2].data_type).toBe("boolean"); // boolean
				expect(result.custom_fields[3].data_type).toBe("date"); // date
				expect(result.custom_fields[4].data_type).toBe("array"); // checkbox
				expect(result.custom_fields[5].data_type).toBe("string"); // unknown defaults to string
			});

			it("should combine custom fields with database attributes", async () => {
				const mockCustomFields = [
					{
						field: "product_code",
						label: "Product Code",
						type: "text"
					}
				];

				const mockRecords: AttributeCatalogRecord[] = [
					{
						id: "attr-1",
						context: "financial",
						source: "facts",
						path: "facts.credit_score",
						label: "Credit Score",
						data_type: "number",
						description: null,
						active: true,
						validation_regex: null,
						created_at: new Date("2024-01-01T00:00:00Z"),
						updated_at: new Date("2024-01-01T00:00:00Z")
					}
				];

				mockGetCustomFieldsSummary.mockResolvedValue(mockCustomFields);
				mockAttributeRepository.getAttributes.mockResolvedValue(mockRecords);

				const result = await attributeManager.getAttributeCatalog({}, "550e8400-e29b-41d4-a716-446655440000");

				expect(result.financial).toBeDefined();
				expect(result.financial).toHaveLength(1);
				expect(result.custom_fields).toBeDefined();
				expect(result.custom_fields).toHaveLength(1);
			});

			it("should handle Case Service errors gracefully", async () => {
				const error = new Error("Case Service unavailable");
				mockGetCustomFieldsSummary.mockRejectedValue(error);
				mockAttributeRepository.getAttributes.mockResolvedValue([]);

				await expect(
					attributeManager.getAttributeCatalog({ source: "custom_fields" }, "550e8400-e29b-41d4-a716-446655440000")
				).rejects.toThrow(error);

				expect(logger.error).toHaveBeenCalledWith({ error }, "AttributeManager: Failed to fetch custom fields");
			});

			it("should not fetch from database when source is only custom_fields", async () => {
				const mockCustomFields = [
					{
						field: "product_code",
						label: "Product Code",
						type: "text"
					}
				];

				mockGetCustomFieldsSummary.mockResolvedValue(mockCustomFields);

				await attributeManager.getAttributeCatalog({ source: "custom_fields" }, "550e8400-e29b-41d4-a716-446655440000");

				expect(mockAttributeRepository.getAttributes).not.toHaveBeenCalled();
			});

			it("should include custom fields when context is custom_fields", async () => {
				const mockCustomFields = [
					{
						field: "product_code",
						label: "Product Code",
						type: "text"
					}
				];

				mockGetCustomFieldsSummary.mockResolvedValue(mockCustomFields);
				mockAttributeRepository.getAttributes.mockResolvedValue([]);

				await attributeManager.getAttributeCatalog(
					{ context: "custom_fields" },
					"550e8400-e29b-41d4-a716-446655440000"
				);

				expect(mockGetCustomFieldsSummary).toHaveBeenCalled();
			});

			it("should not include custom fields when context is not custom_fields", async () => {
				mockAttributeRepository.getAttributes.mockResolvedValue([]);

				await attributeManager.getAttributeCatalog({ context: "financial" }, "550e8400-e29b-41d4-a716-446655440000");

				expect(mockGetCustomFieldsSummary).not.toHaveBeenCalled();
			});
		});
	});
});
