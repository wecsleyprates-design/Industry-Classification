import { formatPercentageFromDecimal } from "../index";

describe("formatPercentageFromDecimal", () => {
	it("should format decimal to percentage string", () => {
		expect(formatPercentageFromDecimal(0.25)).toBe("(25%)");
		expect(formatPercentageFromDecimal(0.5)).toBe("(50%)");
		expect(formatPercentageFromDecimal(1)).toBe("(100%)");
	});

	it("should handle decimals with precision", () => {
		expect(formatPercentageFromDecimal(0.1234)).toBe("(12.34%)");
		expect(formatPercentageFromDecimal(0.6789)).toBe("(67.89%)");
	});

	it("should handle values greater than 1", () => {
		expect(formatPercentageFromDecimal(1.5)).toBe("(150%)");
		expect(formatPercentageFromDecimal(2.25)).toBe("(225%)");
	});

	it("should return undefined for undefined or null", () => {
		expect(formatPercentageFromDecimal(undefined)).toBeUndefined();
		expect(formatPercentageFromDecimal(null)).toBeUndefined();
	});

	it("should handle negative values", () => {
		expect(formatPercentageFromDecimal(-0.25)).toBe("(-25%)");
		expect(formatPercentageFromDecimal(-1)).toBe("(-100%)");
	});

	it("should handle very small numbers", () => {
		expect(formatPercentageFromDecimal(0.0001)).toBe("(0.01%)");
		expect(formatPercentageFromDecimal(0.00001)).toBe("(0.001%)");
	});

	it("should handle 0", () => {
		expect(formatPercentageFromDecimal(0)).toBe("(0%)");
	});
});
