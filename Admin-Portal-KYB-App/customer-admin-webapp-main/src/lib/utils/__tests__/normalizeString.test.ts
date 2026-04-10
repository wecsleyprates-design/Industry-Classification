import { normalizeString } from "../normalizeString";

describe("normalizeString", () => {
	test.each`
		input        | expected
		${"QUÉBEC"}  | ${"QUEBEC"}
		${"MÉXICO"}  | ${"MEXICO"}
		${"NAVARRO"} | ${"NAVARRO"}
	`(
		"should remove accents and diacritical marks from $input and return $expected",
		({ input, expected }) => {
			expect(normalizeString(input)).toBe(expected);
		},
	);

	it("should return the same string if it does not contain accents or diacritical marks", () => {
		expect(normalizeString("Hello")).toBe("Hello");
	});
});
