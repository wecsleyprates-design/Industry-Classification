import { normalizeCountryToISO } from "../normalizeCountryToISO";

import COUNTRIES from "@/constants/Countries";

describe("normalizeCountryToISO", () => {
	describe("should normalize country constants to ISO 3166-1 alpha-2 codes", () => {
		test.each`
			input                    | expected
			${COUNTRIES.UK}          | ${"GB"}
			${COUNTRIES.CANADA}      | ${"CA"}
			${COUNTRIES.PUERTO_RICO} | ${"PR"}
			${COUNTRIES.AUSTRALIA}   | ${"AU"}
			${COUNTRIES.NEW_ZEALAND} | ${"NZ"}
			${COUNTRIES.USA}         | ${"US"}
		`("should normalize $input to $expected", ({ input, expected }) => {
			expect(normalizeCountryToISO(input)).toBe(expected);
		});
	});

	describe("should handle edge cases", () => {
		it("should return 'US' when country is undefined", () => {
			expect(normalizeCountryToISO(undefined)).toBe("US");
		});

		it("should return 'US' when country is null", () => {
			expect(normalizeCountryToISO(null)).toBe("US");
		});

		it("should return 'US' when country is empty string", () => {
			expect(normalizeCountryToISO("")).toBe("US");
		});

		it("should return the country as-is when it's not a recognized constant", () => {
			expect(normalizeCountryToISO("BR")).toBe("BR");
			expect(normalizeCountryToISO("MX")).toBe("MX");
			expect(normalizeCountryToISO("FR")).toBe("FR");
		});

		it("should handle lowercase country codes", () => {
			expect(normalizeCountryToISO("us")).toBe("us");
			expect(normalizeCountryToISO("ca")).toBe("ca");
		});
	});
});
