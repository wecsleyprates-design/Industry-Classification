import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { formatSourceDate } from "../formatSourceDate";

import { DATE_FORMATS } from "@/constants";

dayjs.extend(utc);

describe("formatSourceDate", () => {
	describe("with Date object input", () => {
		it("should format a Date object with default format in UTC", () => {
			const testDate = new Date("2024-01-15T10:30:00Z");
			const result = formatSourceDate(testDate);

			expect(result).toBe("01/15/2024");
		});

		it("should format a Date object with custom format in UTC", () => {
			const testDate = new Date("2024-01-15T10:30:00Z");
			const result = formatSourceDate(testDate, DATE_FORMATS.MONTH);

			expect(result).toBe("Jan");
		});

		it("should maintain UTC timezone regardless of local timezone", () => {
			const testDate = new Date("2024-01-15T00:00:00Z");
			const result = formatSourceDate(testDate);

			// Should always be 01/15/2024 regardless of local timezone
			expect(result).toBe("01/15/2024");
		});
	});

	describe("with string input", () => {
		it("should format an ISO string with default format in UTC", () => {
			const result = formatSourceDate("2024-01-15T10:30:00Z");

			expect(result).toBe("01/15/2024");
		});

		it("should format a date string with custom format in UTC", () => {
			const result = formatSourceDate(
				"2024-01-15T10:30:00Z",
				DATE_FORMATS.MONTH_DAY_YEAR,
			);

			expect(result).toBe("01/15/2024");
		});

		it.each([
			"2024-01-15",
			"2024-01-15T10:30:00",
			"2024-01-15T10:30:00Z",
			"January 15, 2024",
		])("should handle date string format: %s", (dateString) => {
			const result = formatSourceDate(dateString);
			expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
		});
	});

	describe("with different formats", () => {
		const testDate = new Date("2024-01-15T10:30:00Z");

		it("should use DEFAULT format when no format specified", () => {
			const result = formatSourceDate(testDate);
			expect(result).toBe("01/15/2024");
		});

		it("should use MONTH_DAY_YEAR format", () => {
			const result = formatSourceDate(
				testDate,
				DATE_FORMATS.MONTH_DAY_YEAR,
			);
			expect(result).toBe("01/15/2024");
		});

		it("should use MONTH format", () => {
			const result = formatSourceDate(testDate, DATE_FORMATS.MONTH);
			expect(result).toBe("Jan");
		});
	});

	describe("edge cases", () => {
		it("should handle invalid date strings gracefully", () => {
			const result = formatSourceDate("invalid-date");
			expect(result).toBe("Invalid Date");
		});

		it("should handle null/undefined inputs", () => {
			/**
			 * dayjs(null) returns "Invalid Date"
			 * dayjs(undefined) returns current date
			 */
			const nullResult = formatSourceDate(null as any);
			expect(nullResult).toBe("Invalid Date");

			const undefinedResult = formatSourceDate(undefined as any);
			// dayjs treats undefined as current date, so we just verify it's a valid format
			expect(undefinedResult).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
		});

		it("should handle empty string", () => {
			const result = formatSourceDate("");
			expect(result).toBe("Invalid Date");
		});
	});

	describe("UTC timezone behavior", () => {
		it("should format date and time in UTC timezone", () => {
			/**
			 * This is the key test that verifies TIME stays in UTC (not converted to local).
			 * We use a known UTC time and verify both date and time stay in UTC.
			 */
			const utcDate = new Date("2024-01-15T14:30:00Z");
			const result = formatSourceDate(
				utcDate,
				DATE_FORMATS.MONTH_DAY_YEAR_TIME,
			);

			// Should be 2:30 PM in UTC, not converted to local time
			expect(result).toBe("01/15/2024 2:30 PM");

			// Verify it includes time component in UTC
			expect(result).toMatch(
				/^\d{2}\/\d{2}\/\d{4} \d{1,2}:\d{2} (AM|PM)$/,
			);
		});

		it("should format dates in UTC timezone", () => {
			const utcDate = new Date("2024-01-15T00:00:00Z");
			const result = formatSourceDate(utcDate);

			// Should always be 01/15/2024 in UTC
			expect(result).toBe("01/15/2024");
		});

		it("should maintain UTC timezone across different input types", () => {
			const dateObj = new Date("2024-01-15T00:00:00Z");
			const dateString = "2024-01-15T00:00:00Z";

			const result1 = formatSourceDate(dateObj);
			const result2 = formatSourceDate(dateString);

			expect(result1).toBe(result2);
		});

		it("should not convert to local timezone", () => {
			/**
			 * Verify that formatSourceDate keeps dates in UTC regardless of system timezone.
			 * Compare with dayjs UTC formatting to ensure consistency.
			 */
			const testDate = new Date("2024-01-15T23:30:00Z");
			const result = formatSourceDate(testDate);

			// Should always format as UTC, matching dayjs.utc behavior
			const expected = dayjs.utc(testDate).format("MM/DD/YYYY");
			expect(result).toBe(expected);
			expect(result).toBe("01/15/2024");
		});

		it("should handle dates near midnight UTC consistently", () => {
			/**
			 * Testing dates at 23:30 UTC should stay on the same date (01/15)
			 * even though they might be 01/16 in some local timezones.
			 */
			const lateDate = new Date("2024-01-15T23:30:00Z");
			const result = formatSourceDate(lateDate);

			expect(result).toBe("01/15/2024");
		});
	});
});
