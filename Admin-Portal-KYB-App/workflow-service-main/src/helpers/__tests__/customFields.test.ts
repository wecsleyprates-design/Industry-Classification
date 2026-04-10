import { transformCustomFields } from "../customFields";
import { logger } from "../logger";

// Mock logger
jest.mock("../logger", () => ({
	logger: {
		warn: jest.fn(),
		error: jest.fn(),
		info: jest.fn(),
		debug: jest.fn()
	}
}));

describe("transformCustomFields", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("Empty and null cases", () => {
		it("should return empty object when customFields is null", () => {
			const result = transformCustomFields(null);
			expect(result).toEqual({});
		});

		it("should return empty object when customFields is undefined", () => {
			const result = transformCustomFields(undefined);
			expect(result).toEqual({});
		});

		it("should return empty object when customFields is empty object", () => {
			const result = transformCustomFields({});
			expect(result).toEqual({});
		});

		it("should set null fields to null", () => {
			const result = transformCustomFields({
				field1: null,
				field2: undefined
			});
			expect(result).toEqual({
				field1: null,
				field2: null
			});
		});
	});

	describe("Checkbox arrays", () => {
		it("should extract labels from checked items", () => {
			const customFields = {
				currency: [
					{ label: "Swiped", value: "32", checked: true },
					{ label: "Keyed", value: "4", checked: true },
					{ label: "Online", value: "5", checked: false }
				]
			};

			const result = transformCustomFields(customFields);

			expect(result.currency).toEqual(["Swiped", "Keyed"]);
		});

		it("should return null for empty checkbox array", () => {
			const customFields = {
				currency: []
			};

			const result = transformCustomFields(customFields);

			expect(result.currency).toBeNull();
		});

		it("should return null when no items are checked", () => {
			const customFields = {
				currency: [
					{ label: "Swiped", value: "32", checked: false },
					{ label: "Keyed", value: "4", checked: false }
				]
			};

			const result = transformCustomFields(customFields);

			expect(result.currency).toBeNull();
		});

		it("should handle items without checked property (defaults to false)", () => {
			const customFields = {
				currency: [
					{ label: "Swiped", value: "32", checked: true },
					{ label: "Keyed", value: "4" }
				]
			};

			const result = transformCustomFields(customFields);

			expect(result.currency).toEqual(["Swiped"]);
		});

		it("should apply trim to labels", () => {
			const customFields = {
				language: [
					{ label: "  English  ", value: "E", checked: true },
					{ label: "\nHindi\n", value: "H", checked: true }
				]
			};

			const result = transformCustomFields(customFields);

			expect(result.language).toEqual(["English", "Hindi"]);
		});

		it("should skip items without label and log warning", () => {
			const customFields = {
				currency: [
					{ label: "Swiped", value: "32", checked: true },
					{ value: "4", checked: true }, // No label
					{ label: "Keyed", value: "4", checked: true }
				]
			};

			const result = transformCustomFields(customFields);

			expect(result.currency).toEqual(["Swiped", "Keyed"]);
			expect(logger.warn).toHaveBeenCalledWith("Custom field currency: checkbox item missing label, skipping");
		});

		it("should skip items with non-string label and log warning", () => {
			const customFields = {
				currency: [
					{ label: "Swiped", value: "32", checked: true },
					{ label: 123, value: "4", checked: true }, // Non-string label
					{ label: "Keyed", value: "4", checked: true }
				]
			};

			const result = transformCustomFields(customFields);

			expect(result.currency).toEqual(["Swiped", "Keyed"]);
			expect(logger.warn).toHaveBeenCalledWith("Custom field currency: checkbox item label is not a string, skipping");
		});

		it("should skip non-object items and log warning", () => {
			const customFields = {
				currency: [
					{ label: "Swiped", value: "32", checked: true },
					"invalid-item", // Not an object
					{ label: "Keyed", value: "4", checked: true }
				]
			};

			const result = transformCustomFields(customFields);

			expect(result.currency).toEqual(["Swiped", "Keyed"]);
			expect(logger.warn).toHaveBeenCalledWith("Custom field currency: checkbox item is not an object, skipping");
		});

		it("should skip empty labels after trim", () => {
			const customFields = {
				currency: [
					{ label: "Swiped", value: "32", checked: true },
					{ label: "   ", value: "4", checked: true }, // Only whitespace
					{ label: "Keyed", value: "4", checked: true }
				]
			};

			const result = transformCustomFields(customFields);

			expect(result.currency).toEqual(["Swiped", "Keyed"]);
		});
	});

	describe("Checkbox booleans", () => {
		it("should convert true boolean to [true]", () => {
			const customFields = {
				onboarded: true
			};

			const result = transformCustomFields(customFields);

			expect(result.onboarded).toEqual([true]);
		});

		it("should convert false boolean to [false]", () => {
			const customFields = {
				onboarded: false
			};

			const result = transformCustomFields(customFields);

			expect(result.onboarded).toEqual([false]);
		});
	});

	describe("Dropdowns", () => {
		it("should extract label from dropdown object", () => {
			const customFields = {
				gender: {
					label: "No gender",
					value: "NG"
				}
			};

			const result = transformCustomFields(customFields);

			expect(result.gender).toBe("No gender");
		});

		it("should apply trim to dropdown label", () => {
			const customFields = {
				gender: {
					label: "\nNo gender\n",
					value: "NG"
				}
			};

			const result = transformCustomFields(customFields);

			expect(result.gender).toBe("No gender");
		});

		it("should convert to null when dropdown has no label and log warning", () => {
			const customFields = {
				gender: {
					value: "NG"
					// No label
				}
			};

			const result = transformCustomFields(customFields);

			expect(result.gender).toBeNull();
			expect(logger.warn).toHaveBeenCalledWith(
				"Custom field gender: dropdown missing label property, converting to null"
			);
		});

		it("should convert to null when dropdown label is null and log warning", () => {
			const customFields = {
				gender: {
					label: null,
					value: "NG"
				}
			};

			const result = transformCustomFields(customFields);

			expect(result.gender).toBeNull();
			expect(logger.warn).toHaveBeenCalledWith(
				"Custom field gender: dropdown missing label property, converting to null"
			);
		});

		it("should convert to null when dropdown label is not a string and log warning", () => {
			const customFields = {
				gender: {
					label: 123,
					value: "NG"
				}
			};

			const result = transformCustomFields(customFields);

			expect(result.gender).toBeNull();
			expect(logger.warn).toHaveBeenCalledWith(
				"Custom field gender: dropdown label is not a string, converting to null"
			);
		});

		it("should handle dropdown with only value property", () => {
			const customFields = {
				gender: {
					value: "NG"
				}
			};

			const result = transformCustomFields(customFields);

			expect(result.gender).toBeNull();
		});

		it("should return null for empty string after trim", () => {
			const customFields = {
				gender: {
					label: "   ",
					value: "NG"
				}
			};

			const result = transformCustomFields(customFields);

			expect(result.gender).toBeNull();
		});
	});

	describe("String 'null' handling", () => {
		it("should convert string 'null' to null", () => {
			const customFields = {
				field1: "null",
				field2: "NULL",
				field3: "Null"
			};

			const result = transformCustomFields(customFields);

			expect(result.field1).toBeNull();
			expect(result.field2).toBeNull();
			expect(result.field3).toBeNull();
		});

		it("should not convert strings containing 'null' to null", () => {
			const customFields = {
				field1: "null-value",
				field2: "value-null"
			};

			const result = transformCustomFields(customFields);

			expect(result.field1).toBe("null-value");
			expect(result.field2).toBe("value-null");
		});
	});

	describe("String fields", () => {
		it("should apply trim to string values", () => {
			const customFields = {
				email: "  test@test.com  ",
				name: "\nJohn Doe\n",
				phone: "  1234567890  "
			};

			const result = transformCustomFields(customFields);

			expect(result.email).toBe("test@test.com");
			expect(result.name).toBe("John Doe");
			expect(result.phone).toBe("1234567890");
		});

		it("should handle empty strings", () => {
			const customFields = {
				field1: "",
				field2: "   "
			};

			const result = transformCustomFields(customFields);

			expect(result.field1).toBe("");
			expect(result.field2).toBe("");
		});
	});

	describe("Numeric fields", () => {
		it("should leave numeric values unchanged", () => {
			const customFields = {
				age: 23,
				percent: 100,
				score: 85.5
			};

			const result = transformCustomFields(customFields);

			expect(result.age).toBe(23);
			expect(result.percent).toBe(100);
			expect(result.score).toBe(85.5);
		});
	});

	describe("Unexpected object types", () => {
		it("should log warning and keep unexpected objects as-is", () => {
			const customFields = {
				metadata: {
					some: "data",
					nested: { value: 123 }
				}
			};

			const result = transformCustomFields(customFields);

			expect(result.metadata).toEqual({
				some: "data",
				nested: { value: 123 }
			});
			expect(logger.warn).toHaveBeenCalledWith(
				"Custom field metadata: unexpected object type (not checkbox array or dropdown), keeping as-is",
				{ value: customFields.metadata }
			);
		});
	});

	describe("Complex real-world example", () => {
		it("should transform complete custom fields object correctly", () => {
			const customFields = {
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
				application_letter: "Hello Team Hello Team ",
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
				age: 23,
				phone_number: "0234567890",
				name: "Nimish Knope__test",
				enteredjob: null
			};

			const result = transformCustomFields(customFields);

			expect(result).toEqual({
				acc: null,
				is_customer: [false],
				processor: null,
				currency: ["Swiped", "Keyed"],
				jobtype: "Manager",
				onboarded: [false],
				gender: "No gender",
				application_letter: "Hello Team Hello Team",
				email: "test@test.com",
				language: ["English"],
				id_file: "file1.pdf",
				percent: 23,
				age: 23,
				phone_number: "0234567890",
				name: "Nimish Knope__test",
				enteredjob: null
			});
		});
	});
});
