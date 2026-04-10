import { formatDate } from "../helper";

describe("formatDate", () => {
	it("should convert dates to local timezone by default", () => {
		process.env.TZ = "America/New_York"; // Set timezone to Eastern Time for testing

		/** Arrange */
		const date = "1990-05-15T00:00:00Z"; // ISO date string
		/** Act */
		const formattedDate = formatDate(date);
		/** Assert */
		expect(formattedDate).toBe(new Date(date).toLocaleDateString());
	});

	it("should not convert dates to local if options.local is false", () => {
		process.env.TZ = "America/New_York"; // Set timezone to Eastern Time for testing

		/** Arrange */
		const date = "1990-05-15T00:00:00Z"; // ISO date string
		/** Act */
		const formattedDate = formatDate(date);
		/** Assert */
		expect(formattedDate).toBe("5/15/1990");
	});
});
