import { validateRegex, validatePathMatchesSource, validateAttributeCatalogEntry } from "../validators";
import { ApiError } from "#types/common";
import { StatusCodes } from "http-status-codes";
import { WORKFLOW_ERROR_CODES_COMBINED as ERROR_CODES } from "#constants";

describe("Attribute Validators", () => {
	describe("validateRegex", () => {
		it("should not throw for null regex", () => {
			expect(() => validateRegex(null)).not.toThrow();
		});

		it("should not throw for undefined regex", () => {
			expect(() => validateRegex(undefined as unknown as string | null)).not.toThrow();
		});

		it("should not throw for valid regex pattern", () => {
			expect(() => validateRegex("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$")).not.toThrow();
		});

		it("should not throw for simple regex pattern", () => {
			expect(() => validateRegex("^\\d+$")).not.toThrow();
		});

		it("should throw ApiError for invalid regex pattern", () => {
			expect(() => validateRegex("[invalid")).toThrow(ApiError);
		});

		it("should throw ApiError with correct status code for invalid regex", () => {
			try {
				validateRegex("[invalid");
			} catch (error) {
				expect(error).toBeInstanceOf(ApiError);
				expect((error as ApiError).status).toBe(StatusCodes.BAD_REQUEST);
				expect((error as ApiError).errorCode).toBe(ERROR_CODES.INVALID);
			}
		});

		it("should include error message in ApiError for invalid regex", () => {
			try {
				validateRegex("[invalid");
			} catch (error) {
				expect((error as ApiError).message).toContain("Invalid regex pattern");
				expect((error as ApiError).message).toContain("[invalid");
			}
		});
	});

	describe("validatePathMatchesSource", () => {
		it("should not throw for valid path with facts source", () => {
			expect(() => validatePathMatchesSource("facts.credit_score", "facts")).not.toThrow();
		});

		it("should not throw for valid path with case source", () => {
			expect(() => validatePathMatchesSource("case.status", "case")).not.toThrow();
		});

		it("should throw ApiError when path does not start with source prefix", () => {
			expect(() => validatePathMatchesSource("case.credit_score", "facts")).toThrow(ApiError);
		});

		it("should throw ApiError with correct message when path doesn't match source", () => {
			try {
				validatePathMatchesSource("case.credit_score", "facts");
			} catch (error) {
				expect(error).toBeInstanceOf(ApiError);
				expect((error as ApiError).message).toContain('Path "case.credit_score" must start with "facts."');
			}
		});

		it("should throw ApiError when path has no attribute name after prefix", () => {
			expect(() => validatePathMatchesSource("facts.", "facts")).toThrow(ApiError);
		});

		it("should throw ApiError when path is only whitespace after prefix", () => {
			expect(() => validatePathMatchesSource("facts.   ", "facts")).toThrow(ApiError);
		});

		it("should throw ApiError with correct status code", () => {
			try {
				validatePathMatchesSource("case.credit_score", "facts");
			} catch (error) {
				expect(error).toBeInstanceOf(ApiError);
				expect((error as ApiError).status).toBe(StatusCodes.BAD_REQUEST);
				expect((error as ApiError).errorCode).toBe(ERROR_CODES.INVALID);
			}
		});

		it("should accept path with nested attribute names", () => {
			expect(() => validatePathMatchesSource("facts.credit.score", "facts")).not.toThrow();
		});
	});

	describe("validateAttributeCatalogEntry", () => {
		it("should not throw for valid attribute entry without regex", () => {
			const validEntry = {
				source: "facts" as const,
				path: "facts.credit_score",
				data_type: "number" as const
			};

			expect(() => validateAttributeCatalogEntry(validEntry)).not.toThrow();
		});

		it("should not throw for valid attribute entry with valid regex", () => {
			const validEntry = {
				source: "case" as const,
				path: "case.email",
				data_type: "string" as const,
				validation_regex: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
			};

			expect(() => validateAttributeCatalogEntry(validEntry)).not.toThrow();
		});

		it("should throw when path doesn't match source", () => {
			const invalidEntry = {
				source: "facts" as const,
				path: "case.status",
				data_type: "enum" as const
			};

			expect(() => validateAttributeCatalogEntry(invalidEntry)).toThrow(ApiError);
		});

		it("should throw when validation_regex is invalid", () => {
			const invalidEntry = {
				source: "case" as const,
				path: "case.email",
				data_type: "string" as const,
				validation_regex: "[invalid"
			};

			expect(() => validateAttributeCatalogEntry(invalidEntry)).toThrow(ApiError);
		});

		it("should validate path first, then regex", () => {
			const invalidEntry = {
				source: "facts" as const,
				path: "case.status", // Invalid path
				data_type: "string" as const,
				validation_regex: "[invalid" // Also invalid regex
			};

			// Should throw for path validation first
			try {
				validateAttributeCatalogEntry(invalidEntry);
			} catch (error) {
				expect((error as ApiError).message).toContain("must start with");
			}
		});

		it("should not validate regex when it is null", () => {
			const validEntry = {
				source: "facts" as const,
				path: "facts.credit_score",
				data_type: "number" as const,
				validation_regex: null
			};

			expect(() => validateAttributeCatalogEntry(validEntry)).not.toThrow();
		});

		it("should handle all data types correctly", () => {
			const dataTypes = ["string", "number", "boolean", "date", "enum"] as const;

			dataTypes.forEach(dataType => {
				const validEntry = {
					source: "facts" as const,
					path: "facts.test_field",
					data_type: dataType
				};

				expect(() => validateAttributeCatalogEntry(validEntry)).not.toThrow();
			});
		});
	});
});
