import { mapCountryCodeToISO3166 } from "../mapCountryCodeToISO3166";

import COUNTRIES from "@/constants/Countries";

describe("mapCountryCodeToISO3166", () => {
	describe("should map common country codes to ISO 3166-1 alpha-2", () => {
		test.each`
			input    | expected
			${"USA"} | ${COUNTRIES.USA}
			${"UK"}  | ${COUNTRIES.UK}
			${"CA"}  | ${COUNTRIES.CANADA}
			${"PR"}  | ${COUNTRIES.PUERTO_RICO}
			${"AU"}  | ${COUNTRIES.AUSTRALIA}
			${"NZ"}  | ${COUNTRIES.NEW_ZEALAND}
		`("should map '$input' to '$expected'", ({ input, expected }) => {
			expect(mapCountryCodeToISO3166(input)).toBe(expected);
		});
	});

	describe("should be case insensitive", () => {
		it("should handle lowercase", () => {
			expect(mapCountryCodeToISO3166("usa")).toBe(COUNTRIES.USA);
			expect(mapCountryCodeToISO3166("uk")).toBe(COUNTRIES.UK);
			expect(mapCountryCodeToISO3166("pr")).toBe(COUNTRIES.PUERTO_RICO);
			expect(mapCountryCodeToISO3166("au")).toBe(COUNTRIES.AUSTRALIA);
			expect(mapCountryCodeToISO3166("nz")).toBe(COUNTRIES.NEW_ZEALAND);
		});
	});

	describe("should return null for unknown codes", () => {
		it("should return null for unrecognized code", () => {
			expect(mapCountryCodeToISO3166("XX")).toBeNull();
		});

		it("should return null for empty string", () => {
			expect(mapCountryCodeToISO3166("")).toBeNull();
		});
	});
});
