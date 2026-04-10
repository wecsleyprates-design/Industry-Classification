import { normalizeStateToCode } from "../normalizeStateToCode";

import COUNTRIES from "@/constants/Countries";

describe("normalizeStateToCode", () => {
	describe("should normalize Australian states to 2-character codes", () => {
		test.each`
			state                             | expected
			${"NEW SOUTH WALES"}              | ${"NS"}
			${"new south wales"}              | ${"NS"}
			${"New South Wales"}              | ${"NS"}
			${"VICTORIA"}                     | ${"VI"}
			${"QUEENSLAND"}                   | ${"QL"}
			${"WESTERN AUSTRALIA"}            | ${"WA"}
			${"SOUTH AUSTRALIA"}              | ${"SA"}
			${"TASMANIA"}                     | ${"TA"}
			${"AUSTRALIAN CAPITAL TERRITORY"} | ${"AC"}
			${"NORTHERN TERRITORY"}           | ${"NT"}
			${"NSW"}                          | ${"NS"}
			${"VIC"}                          | ${"VI"}
			${"QLD"}                          | ${"QL"}
			${"WA"}                           | ${"WA"}
			${"SA"}                           | ${"SA"}
			${"TAS"}                          | ${"TA"}
			${"ACT"}                          | ${"AC"}
			${"NT"}                           | ${"NT"}
		`(
			"should normalize Australian state '$state' to '$expected'",
			({ state, expected }) => {
				expect(normalizeStateToCode(state, COUNTRIES.AUSTRALIA)).toBe(expected);
			},
		);

		it("should handle 'AU' country code (ISO format)", () => {
			expect(normalizeStateToCode("NEW SOUTH WALES", "AU")).toBe("NS");
			expect(normalizeStateToCode("VICTORIA", "AU")).toBe("VI");
		});

		it("should truncate unknown Australian states to first 2 characters", () => {
			expect(normalizeStateToCode("UNKNOWN STATE", COUNTRIES.AUSTRALIA)).toBe(
				"UN",
			);
			expect(normalizeStateToCode("XYZ", COUNTRIES.AUSTRALIA)).toBe("XY");
		});
	});

	describe("should handle other countries", () => {
		it("should return state as-is for US", () => {
			expect(normalizeStateToCode("CA", COUNTRIES.USA)).toBe("CA");
			expect(normalizeStateToCode("NY", COUNTRIES.USA)).toBe("NY");
			expect(normalizeStateToCode("Texas", COUNTRIES.USA)).toBe("TEXAS");
		});

		it("should return state as-is for Canada", () => {
			expect(normalizeStateToCode("ON", COUNTRIES.CANADA)).toBe("ON");
			expect(normalizeStateToCode("QC", COUNTRIES.CANADA)).toBe("QC");
		});

		it("should return state as-is for UK", () => {
			expect(normalizeStateToCode("England", COUNTRIES.UK)).toBe("ENGLAND");
		});

		it("should return 'PR' for Puerto Rico regardless of input", () => {
			expect(normalizeStateToCode("San Juan", COUNTRIES.PUERTO_RICO)).toBe(
				"PR",
			);
			expect(normalizeStateToCode("JUANA DÍAZ", COUNTRIES.PUERTO_RICO)).toBe(
				"PR",
			);
			expect(normalizeStateToCode("Bayamón", COUNTRIES.PUERTO_RICO)).toBe("PR");
		});

		it("should return 'PR' when country code is 'PR' (ISO format)", () => {
			expect(normalizeStateToCode("San Juan", "PR")).toBe("PR");
		});

		it("should return state as-is for New Zealand", () => {
			expect(normalizeStateToCode("Auckland", COUNTRIES.NEW_ZEALAND)).toBe(
				"AUCKLAND",
			);
		});
	});

	describe("should handle edge cases", () => {
		it("should return undefined when state is undefined", () => {
			expect(
				normalizeStateToCode(undefined, COUNTRIES.AUSTRALIA),
			).toBeUndefined();
			expect(normalizeStateToCode(undefined, COUNTRIES.USA)).toBeUndefined();
		});

		it("should return undefined when state is null", () => {
			expect(normalizeStateToCode(null, COUNTRIES.AUSTRALIA)).toBeUndefined();
			expect(normalizeStateToCode(null, COUNTRIES.USA)).toBeUndefined();
		});

		it("should return undefined when state is undefined or null", () => {
			expect(
				normalizeStateToCode(undefined, COUNTRIES.AUSTRALIA),
			).toBeUndefined();
			expect(normalizeStateToCode(null, COUNTRIES.AUSTRALIA)).toBeUndefined();
		});

		it("should handle empty string by trimming and returning empty result", () => {
			// Empty string after trim returns empty string (not undefined)
			// This is expected behavior - the function trims and processes
			const result = normalizeStateToCode("   ", COUNTRIES.AUSTRALIA);
			expect(result).toBe("");
		});

		it("should trim whitespace from state", () => {
			expect(
				normalizeStateToCode("  NEW SOUTH WALES  ", COUNTRIES.AUSTRALIA),
			).toBe("NS");
			expect(normalizeStateToCode("  CA  ", COUNTRIES.USA)).toBe("CA");
		});

		it("should handle case-insensitive country codes", () => {
			expect(normalizeStateToCode("NEW SOUTH WALES", "au")).toBe("NS");
			expect(normalizeStateToCode("NEW SOUTH WALES", "Au")).toBe("NS");
		});

		it("should handle undefined country", () => {
			expect(normalizeStateToCode("CA", undefined)).toBe("CA");
			expect(normalizeStateToCode("NSW", undefined)).toBe("NSW");
		});

		it("should handle null country", () => {
			expect(normalizeStateToCode("CA", null)).toBe("CA");
			expect(normalizeStateToCode("NSW", null)).toBe("NSW");
		});
	});
});
