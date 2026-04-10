import { normalizeCountryToISO3166 } from "../normalizeCountryToISO3166";

import COUNTRIES from "@/constants/Countries";

describe("normalizeCountryToISO3166", () => {
	describe("should normalize long country names to ISO 3166-1 alpha-2 codes", () => {
		test.each`
			input               | expected
			${"United States"}  | ${COUNTRIES.USA}
			${"UNITED STATES"}  | ${COUNTRIES.USA}
			${"Canada"}         | ${COUNTRIES.CANADA}
			${"CANADA"}         | ${COUNTRIES.CANADA}
			${"United Kingdom"} | ${COUNTRIES.UK}
			${"UNITED KINGDOM"} | ${COUNTRIES.UK}
			${"Puerto Rico"}    | ${COUNTRIES.PUERTO_RICO}
			${"PUERTO RICO"}    | ${COUNTRIES.PUERTO_RICO}
			${"Australia"}      | ${COUNTRIES.AUSTRALIA}
			${"AUSTRALIA"}      | ${COUNTRIES.AUSTRALIA}
			${"New Zealand"}    | ${COUNTRIES.NEW_ZEALAND}
			${"NEW ZEALAND"}    | ${COUNTRIES.NEW_ZEALAND}
		`("should normalize '$input' to '$expected'", ({ input, expected }) => {
			expect(normalizeCountryToISO3166(input)).toBe(expected);
		});
	});

	describe("should pass through valid ISO 3166-1 alpha-2 codes", () => {
		test.each`
			input   | expected
			${"US"} | ${"US"}
			${"CA"} | ${"CA"}
			${"GB"} | ${"GB"}
			${"PR"} | ${"PR"}
			${"AU"} | ${"AU"}
			${"NZ"} | ${"NZ"}
		`("should pass through '$input' as '$expected'", ({ input, expected }) => {
			expect(normalizeCountryToISO3166(input)).toBe(expected);
		});
	});

	describe("should normalize common country codes", () => {
		test.each`
			input    | expected
			${"USA"} | ${COUNTRIES.USA}
			${"UK"}  | ${COUNTRIES.UK}
		`(
			"should normalize country code '$input' to '$expected'",
			({ input, expected }) => {
				expect(normalizeCountryToISO3166(input)).toBe(expected);
			},
		);
	});

	describe("should return null for unknown countries", () => {
		it("should return null for an unrecognized country name", () => {
			expect(normalizeCountryToISO3166("Narnia")).toBeNull();
		});

		it("should return null for an empty string", () => {
			expect(normalizeCountryToISO3166("")).toBeNull();
		});
	});
});
