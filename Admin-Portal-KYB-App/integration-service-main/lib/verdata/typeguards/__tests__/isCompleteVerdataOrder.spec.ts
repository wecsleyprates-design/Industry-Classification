import { isCompleteVerdataOrder } from "../isCompleteVerdataOrder";

describe("isCompleteVerdataOrder", () => {
	it("should return true if the order is complete", () => {
		/** Arrange */
		const order = {
			business_id: "123",
			name: "Test Business",
			address_line_1: "123 Main St",
			city: "Anytown",
			state: "CA",
			zip5: "12345"
		};

		/** Act */
		const result = isCompleteVerdataOrder(order);

		/** Assert */
		expect(result).toBe(true);
	});

	it("should return true if a non-required field is empty", () => {
		/** Arrange */
		const order = {
			business_id: "123",
			name: "Test Business",
			address_line_1: "123 Main St",
			city: "Anytown",
			state: "CA",
			zip5: "12345",
			ein: undefined
		};

		/** Act */
		const result = isCompleteVerdataOrder(order);

		/** Assert */
		expect(result).toBe(true);
	});

	it("should return false if even one required field is empty", () => {
		/** Arrange */
		const order = {
			business_id: "123",
			name: "",
			address_line_1: "123 Main St",
			city: "Anytown",
			state: "CA",
			zip5: "12345"
		};

		/** Act */
		const result = isCompleteVerdataOrder(order);

		/** Assert */
		expect(result).toBe(false);
	});

	it("should return false if the order is null", () => {
		/** Arrange */
		const order = null;

		/** Act */
		const result = isCompleteVerdataOrder(order);

		/** Assert */
		expect(result).toBe(false);
	});

	it("should return false if the order is undefined", () => {
		/** Arrange */
		const order = undefined;

		/** Act */
		const result = isCompleteVerdataOrder(order);

		/** Assert */
		expect(result).toBe(false);
	});
});
