import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { formatLocalDate } from "../formatLocalDate";

import { DATE_FORMATS } from "@/constants";

dayjs.extend(utc);

describe("formatLocalDate", () => {
	describe("with Date object input", () => {
		it("should format a Date object with default format", () => {
			const testDate = new Date("2024-01-15T10:30:00Z");
			const result = formatLocalDate(testDate);

			expect(result).toBe("01/15/2024");
		});

		it("should format a Date object with custom format", () => {
			const testDate = new Date("2024-01-15T10:30:00Z");
			const result = formatLocalDate(testDate, DATE_FORMATS.MONTH);

			expect(result).toBe("Jan");
		});

		it("should format dates in local timezone", () => {
			/**
			 * This test verifies that dates are converted from UTC to local timezone.
			 * The exact result depends on the system timezone, but we verify the format is correct.
			 */
			const testDate = new Date("2024-01-15T23:30:00Z");
			const result = formatLocalDate(testDate);

			// Verify format is correct
			expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);

			// Verify it matches expected dayjs behavior
			const expected = dayjs.utc(testDate).local().format("MM/DD/YYYY");
			expect(result).toBe(expected);
		});
	});

	describe("with string input", () => {
		it("should format an ISO string with default format", () => {
			const result = formatLocalDate("2024-01-15T10:30:00Z");

			expect(result).toBe("01/15/2024");
		});

		it("should format a date string with custom format", () => {
			const result = formatLocalDate(
				"2024-01-15T10:30:00Z",
				DATE_FORMATS.MONTH_DAY_YEAR,
			);

			expect(result).toBe("01/15/2024");
		});

		it.each([
			{ dateString: "2024-01-15", description: "date without time" },
			{
				dateString: "2024-01-15T10:30:00",
				description: "ISO without timezone",
			},
			{
				dateString: "2024-01-15T10:30:00Z",
				description: "ISO with UTC timezone",
			},
			{
				dateString: "January 15, 2024",
				description: "natural language date",
			},
		])("should handle $description", ({ dateString }) => {
			const result = formatLocalDate(dateString);
			expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
		});
	});

	describe("with different formats", () => {
		const testDate = new Date("2024-01-15T10:30:00Z");

		it("should use DEFAULT format when no format specified", () => {
			const result = formatLocalDate(testDate);
			expect(result).toBe("01/15/2024");
		});

		it("should use MONTH_DAY_YEAR format", () => {
			const result = formatLocalDate(
				testDate,
				DATE_FORMATS.MONTH_DAY_YEAR,
			);
			expect(result).toBe("01/15/2024");
		});

		it("should use MONTH format", () => {
			const result = formatLocalDate(testDate, DATE_FORMATS.MONTH);
			expect(result).toBe("Jan");
		});
	});

	describe("edge cases", () => {
		it("should handle invalid date strings gracefully", () => {
			const result = formatLocalDate("invalid-date");
			expect(result).toBe("Invalid Date");
		});

		it("should handle null/undefined inputs", () => {
			/**
			 * dayjs(null) returns "Invalid Date"
			 * dayjs(undefined) returns current date
			 * We test the actual behavior rather than throwing errors
			 */
			const nullResult = formatLocalDate(null as any);
			expect(nullResult).toBe("Invalid Date");

			const undefinedResult = formatLocalDate(undefined as any);
			// dayjs treats undefined as current date, so we just verify it's a valid format
			expect(undefinedResult).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
		});

		it("should handle empty string", () => {
			const result = formatLocalDate("");
			expect(result).toBe("Invalid Date");
		});
	});

	describe("local timezone behavior", () => {
		it("should convert UTC time to local timezone with time format", () => {
			/**
			 * This is the key test that verifies TIME conversion from UTC to local.
			 * We use a known UTC time and verify both date and time are converted.
			 */
			const utcDate = new Date("2024-01-15T14:30:00Z");
			const result = formatLocalDate(
				utcDate,
				DATE_FORMATS.MONTH_DAY_YEAR_TIME,
			);

			// Verify it matches what dayjs produces with local timezone
			const expected = dayjs
				.utc(utcDate)
				.local()
				.format("MM/DD/YYYY h:mm A");
			expect(result).toBe(expected);

			// Verify it includes time component
			expect(result).toMatch(
				/^\d{2}\/\d{2}\/\d{4} \d{1,2}:\d{2} (AM|PM)$/,
			);
		});

		it("should format dates in local timezone", () => {
			const utcDate = new Date("2024-01-15T00:00:00Z");
			const result = formatLocalDate(utcDate);

			// The result should be in local timezone, not UTC
			expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
		});

		it("should maintain local timezone across different input types", () => {
			const dateObj = new Date("2024-01-15T00:00:00Z");
			const dateString = "2024-01-15T00:00:00Z";

			const result1 = formatLocalDate(dateObj);
			const result2 = formatLocalDate(dateString);

			expect(result1).toBe(result2);
		});

		it("should convert UTC to local timezone for date component", () => {
			/**
			 * Testing that formatLocalDate converts UTC date to local date.
			 * The actual result depends on the system's timezone where tests run.
			 * We're verifying the conversion happens by comparing with dayjs's expected output.
			 */
			const testDate = new Date("2024-01-15T23:30:00Z");
			const result = formatLocalDate(testDate);

			// Verify the format is correct
			expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);

			// Verify it matches what dayjs would produce with local timezone
			const expectedLocalDate = dayjs
				.utc(testDate)
				.local()
				.format("MM/DD/YYYY");
			expect(result).toBe(expectedLocalDate);
		});

		it("should handle dates that cross day boundaries when converted to local", () => {
			/**
			 * Testing dates near midnight UTC to ensure day boundaries are handled correctly.
			 * For example, 2024-01-16T01:00:00Z might be 2024-01-15 in Pacific timezone.
			 */
			const midnightDate = new Date("2024-01-16T01:00:00Z");
			const result = formatLocalDate(midnightDate);

			// Verify format
			expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);

			// Verify it matches dayjs's local conversion
			const expectedLocalDate = dayjs
				.utc(midnightDate)
				.local()
				.format("MM/DD/YYYY");
			expect(result).toBe(expectedLocalDate);
		});
	});
});
