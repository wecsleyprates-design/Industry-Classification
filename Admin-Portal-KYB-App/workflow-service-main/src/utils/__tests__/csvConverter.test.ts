import { convertToCSV } from "../csvConverter";

jest.mock("#helpers/logger", () => ({
	logger: {
		debug: jest.fn(),
		error: jest.fn()
	}
}));

describe("csvConverter", () => {
	describe("convertToCSV", () => {
		it("should convert array of objects to CSV string with UTF-8 BOM", () => {
			const data = [
				{ name: "John", age: 30 },
				{ name: "大家好", age: 25 }
			];

			const result = convertToCSV(data);

			expect(result.charCodeAt(0)).toBe(0xfeff);
			expect(result).toContain("name,age");
			expect(result).toContain("John,30");
			expect(result).toContain("大家好,25");
		});

		it("should return empty string for empty array", () => {
			const result = convertToCSV([]);

			expect(result).toBe("");
		});

		it("should return empty string for non-array input", () => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
			const result = convertToCSV({} as any);

			expect(result).toBe("");
		});

		it("should use custom delimiter when provided", () => {
			const data = [{ name: "John", age: 30 }];

			const result = convertToCSV(data, { delimiter: ";" });

			expect(result).toContain("name;age");
			expect(result).toContain("John;30");
		});

		it("should disable headers when headers option is false", () => {
			const data = [{ name: "John", age: 30 }];

			const result = convertToCSV(data, { headers: false });

			expect(result).not.toContain("name,age");
			expect(result).toContain("John,30");
		});

		it("should handle complex nested objects", () => {
			const data = [
				{
					id: 1,
					metadata: { role: "admin" },
					tags: ["active", "verified"]
				}
			];

			const result = convertToCSV(data);

			expect(result).toContain("id");
			expect(result).toContain("metadata");
			expect(result).toContain("tags");
		});

		it("should handle empty object arrays", () => {
			const data = [{}, {}];

			const result = convertToCSV(data);

			// Empty objects still generate CSV with headers only
			expect(result.length).toBeGreaterThan(0);
		});
	});
});
