import { formatCurrency } from "../formatCurrency";

describe("formatCurrency", () => {
	it("should format positive numbers correctly", () => {
		expect(formatCurrency(1234.56)).toBe("$1,234.56");
		expect(formatCurrency(1000)).toBe("$1,000.00");
		expect(formatCurrency(0.99)).toBe("$0.99");
	});

	it("should format negative numbers correctly", () => {
		expect(formatCurrency(-1234.56)).toBe("-$1,234.56");
		expect(formatCurrency(-1000)).toBe("-$1,000.00");
	});

	it("should handle zero", () => {
		expect(formatCurrency(0)).toBe("$0.00");
	});

	it("should handle large numbers", () => {
		expect(formatCurrency(1234567.89)).toBe("$1,234,567.89");
	});

	it("should handle decimal precision", () => {
		expect(formatCurrency(123.456)).toBe("$123.46");
		expect(formatCurrency(123.444)).toBe("$123.44");
	});

	it("should handle different currencies and default to USD", () => {
		expect(formatCurrency(123.456, { currency: "EUR" })).toBe("€123.46");
		expect(formatCurrency(123.456, { currency: "GBP" })).toBe("£123.46");
		expect(formatCurrency(123.456, { currency: "JPY" })).toBe("¥123.46");
		expect(formatCurrency(123.456)).toBe("$123.46");
	});

	it("should handle minimum and maximum fraction digits", () => {
		expect(
			formatCurrency(123, {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2,
			}),
		).toBe("$123.00");
		expect(
			formatCurrency(123.456, {
				minimumFractionDigits: 1,
				maximumFractionDigits: 2,
			}),
		).toBe("$123.46");
		expect(
			formatCurrency(123.42, {
				minimumFractionDigits: 0,
				maximumFractionDigits: 0,
			}),
		).toBe("$123");
	});

	it("should handle edge cases with fraction digits", () => {
		expect(formatCurrency(123.999, { maximumFractionDigits: 2 })).toBe(
			"$124.00",
		);
		expect(formatCurrency(123.001, { maximumFractionDigits: 2 })).toBe(
			"$123.00",
		);
		expect(formatCurrency(0, { minimumFractionDigits: 0 })).toBe("$0");
	});

	it("should handle empty options object", () => {
		expect(formatCurrency(123.45, {})).toBe("$123.45");
	});

	it("should handle undefined options", () => {
		expect(formatCurrency(123.45)).toBe("$123.45");
	});
});
