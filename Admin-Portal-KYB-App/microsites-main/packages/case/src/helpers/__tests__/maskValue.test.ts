import { maskValue } from "../maskValue";

describe("maskValue", () => {
	it("should mask a string showing only the last 4 digits", () => {
		expect(maskValue("1234567890")).toBe("•••7890");
		expect(maskValue("1234")).toBe("•••1234");
		expect(maskValue("1234567890123456")).toBe("•••3456");
	});

	it("should handle strings with exactly 4 characters", () => {
		expect(maskValue("1234")).toBe("•••1234");
	});

	it("should handle strings with less than 4 characters", () => {
		expect(maskValue("123")).toBe("•••123");
		expect(maskValue("12")).toBe("•••12");
		expect(maskValue("1")).toBe("•••1");
	});

	it("should handle empty string", () => {
		expect(maskValue("")).toBe("•••");
	});

	it("should handle non-numeric strings", () => {
		expect(maskValue("abcdefgh")).toBe("•••efgh");
		expect(maskValue("abc123def")).toBe("•••3def");
	});

	it("should handle custom mask length", () => {
		expect(
			maskValue("1234567890", {
				lengthUnmasked: 6,
				lengthMasked: 6,
				maskCharacter: "•",
			}),
		).toBe("••••••567890");
		expect(
			maskValue("1234567890", {
				lengthUnmasked: 3,
				lengthMasked: 3,
				maskCharacter: "•",
			}),
		).toBe("•••890");

		const value = "1234567890";
		expect(
			maskValue(value, {
				lengthUnmasked: 0,
				lengthMasked: value.length,
				maskCharacter: "•",
			}),
		).toBe("••••••••••");

		expect(
			maskValue("12", {
				lengthUnmasked: 4,
			}),
		).toBe("•••12");
	});
});
