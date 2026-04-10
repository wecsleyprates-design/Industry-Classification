import { getFactName } from "../pathResolver";

describe("pathResolver getFactName", () => {
	it("returns first segment for simple paths", () => {
		expect(getFactName("risk_score")).toBe("risk_score");
	});

	it("returns base fact key for nested paths", () => {
		expect(getFactName("primary_address.city")).toBe("primary_address");
	});

	it("strips [*] from the first segment for array DSL paths", () => {
		expect(getFactName("owner_verification[*].fraud_report.score")).toBe("owner_verification");
	});

	it("handles empty path after facts prefix", () => {
		expect(getFactName("")).toBe("");
	});
});
