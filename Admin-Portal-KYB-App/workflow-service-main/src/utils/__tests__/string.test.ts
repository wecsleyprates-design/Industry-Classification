import { safeStringify } from "#utils/string";

describe("safeStringify", () => {
	it("should stringify simple objects", () => {
		const obj = { name: "test", value: 123 };
		const result = safeStringify(obj);
		expect(result).toBe('{"name":"test","value":123}');
	});

	it("should stringify arrays", () => {
		const arr = [1, 2, 3, "test"];
		const result = safeStringify(arr);
		expect(result).toBe('[1,2,3,"test"]');
	});

	it("should stringify primitive values", () => {
		expect(safeStringify("string")).toBe('"string"');
		expect(safeStringify(123)).toBe("123");
		expect(safeStringify(true)).toBe("true");
		expect(safeStringify(null)).toBe("null");
		expect(safeStringify(undefined)).toBe("undefined");
	});

	it("should handle circular references", () => {
		const obj: Record<string, unknown> = { name: "test" };
		obj.self = obj; // Create circular reference

		const result = safeStringify(obj);
		expect(result).toBe("[object Object]");
	});

	it("should handle functions", () => {
		const func = () => "test";
		const result = safeStringify(func);
		expect(result).toBe('() => "test"');
	});

	it("should handle symbols", () => {
		const sym = Symbol("test");
		const result = safeStringify(sym);
		expect(result).toBe("Symbol(test)");
	});

	it("should handle bigint", () => {
		const big = BigInt(123);
		const result = safeStringify(big);
		expect(result).toBe("123");
	});

	it("should handle objects with undefined values", () => {
		const obj = { name: "test", value: undefined };
		const result = safeStringify(obj);
		expect(result).toBe('{"name":"test"}');
	});

	it("should handle nested objects", () => {
		const obj = {
			level1: {
				level2: {
					level3: "deep value"
				}
			}
		};
		const result = safeStringify(obj);
		expect(result).toBe('{"level1":{"level2":{"level3":"deep value"}}}');
	});

	it("should handle empty objects and arrays", () => {
		expect(safeStringify({})).toBe("{}");
		expect(safeStringify([])).toBe("[]");
	});

	it("should handle objects with special characters", () => {
		const obj = {
			"key with spaces": "value",
			"key-with-dashes": "value",
			"key.with.dots": "value"
		};
		const result = safeStringify(obj);
		expect(result).toBe('{"key with spaces":"value","key-with-dashes":"value","key.with.dots":"value"}');
	});

	it("should handle objects with null values", () => {
		const obj = { name: "test", value: null };
		const result = safeStringify(obj);
		expect(result).toBe('{"name":"test","value":null}');
	});

	it("should handle objects with boolean values", () => {
		const obj = { active: true, enabled: false };
		const result = safeStringify(obj);
		expect(result).toBe('{"active":true,"enabled":false}');
	});

	it("should handle objects with number values", () => {
		const obj = { count: 0, price: 99.99, negative: -5 };
		const result = safeStringify(obj);
		expect(result).toBe('{"count":0,"price":99.99,"negative":-5}');
	});

	it("should handle mixed arrays", () => {
		const arr = [1, "string", true, null, { nested: "object" }];
		const result = safeStringify(arr);
		expect(result).toBe('[1,"string",true,null,{"nested":"object"}]');
	});

	it("should handle objects with Date values", () => {
		const date = new Date("2024-01-01T00:00:00Z");
		const obj = { createdAt: date };
		const result = safeStringify(obj);
		expect(result).toBe('{"createdAt":"2024-01-01T00:00:00.000Z"}');
	});

	it("should handle objects with RegExp values", () => {
		const regex = /test/gi;
		const obj = { pattern: regex };
		const result = safeStringify(obj);
		expect(result).toBe('{"pattern":{}}');
	});

	it("should handle objects with Error values", () => {
		const error = new Error("test error");
		const obj = { error };
		const result = safeStringify(obj);
		expect(result).toBe('{"error":{}}');
	});

	it("should handle very deep nesting", () => {
		let obj: Record<string, unknown> = { value: "deep" };
		for (let i = 0; i < 100; i++) {
			obj = { nested: obj };
		}

		const result = safeStringify(obj);
		expect(result).toContain('"value":"deep"');
	});

	it("should handle objects with getters", () => {
		const obj = {
			name: "test",
			get computed() {
				return this.name.toUpperCase();
			}
		};
		const result = safeStringify(obj);
		expect(result).toBe('{"name":"test","computed":"TEST"}');
	});

	it("should handle objects with non-enumerable properties", () => {
		const obj = { name: "test" };
		Object.defineProperty(obj, "hidden", {
			value: "secret",
			enumerable: false
		});

		const result = safeStringify(obj);
		expect(result).toBe('{"name":"test"}');
	});
});
