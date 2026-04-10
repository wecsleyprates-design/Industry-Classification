import { scoreRangesSchema } from "../validation";

import ERROR_MSG from "@/constants/ErrorMessages";

describe("scoreRangesSchema - max > min validation", () => {
	describe("HIGHmax validation", () => {
		it("should reject when HIGHmax is less than HIGHmin", async () => {
			/** Arrange */
			const invalidData = {
				HIGHmin: 100,
				HIGHmax: 50, // max < min
				MODERATEmin: 101,
				MODERATEmax: 200,
				LOWmin: 201,
				LOWmax: 300,
				agingThreshold: false,
				riskAlertsStatus: false,
			};

			/** Act */
			try {
				await scoreRangesSchema.validate(invalidData, { abortEarly: false });
				fail("Validation should have failed");
			} catch (error: any) {
				/** Assert */
				expect(error.errors).toContain(ERROR_MSG.MAX_MUST_BE_GREATER_THAN_MIN);
			}
		});

		it("should reject when HIGHmax equals HIGHmin", async () => {
			/** Arrange */
			const invalidData = {
				HIGHmin: 100,
				HIGHmax: 100, // max === min
				MODERATEmin: 101,
				MODERATEmax: 200,
				LOWmin: 201,
				LOWmax: 300,
				agingThreshold: false,
				riskAlertsStatus: false,
			};

			/** Act */
			try {
				await scoreRangesSchema.validate(invalidData, { abortEarly: false });
				fail("Validation should have failed");
			} catch (error: any) {
				/** Assert */
				expect(error.errors).toContain(ERROR_MSG.MAX_MUST_BE_GREATER_THAN_MIN);
			}
		});

		it("should accept when HIGHmax is greater than HIGHmin", async () => {
			/** Arrange */
			const validData = {
				HIGHmin: 0,
				HIGHmax: 549, // max > min
				MODERATEmin: 550,
				MODERATEmax: 699,
				LOWmin: 700,
				LOWmax: 850,
				agingThreshold: false,
				riskAlertsStatus: false,
			};

			/** Act */
			const result = await scoreRangesSchema.validate(validData);

			/** Assert */
			expect(result).toEqual(validData);
		});
	});

	describe("MODERATEmax validation", () => {
		it("should reject when MODERATEmax is less than MODERATEmin", async () => {
			/** Arrange */
			const invalidData = {
				HIGHmin: 0,
				HIGHmax: 549,
				MODERATEmin: 550,
				MODERATEmax: 500, // max < min
				LOWmin: 501,
				LOWmax: 850,
				agingThreshold: false,
				riskAlertsStatus: false,
			};

			/** Act */
			try {
				await scoreRangesSchema.validate(invalidData, { abortEarly: false });
				fail("Validation should have failed");
			} catch (error: any) {
				/** Assert */
				expect(error.errors).toContain(ERROR_MSG.MAX_MUST_BE_GREATER_THAN_MIN);
			}
		});

		it("should reject when MODERATEmax equals MODERATEmin", async () => {
			/** Arrange */
			const invalidData = {
				HIGHmin: 0,
				HIGHmax: 549,
				MODERATEmin: 550,
				MODERATEmax: 550, // max === min
				LOWmin: 551,
				LOWmax: 850,
				agingThreshold: false,
				riskAlertsStatus: false,
			};

			/** Act */
			try {
				await scoreRangesSchema.validate(invalidData, { abortEarly: false });
				fail("Validation should have failed");
			} catch (error: any) {
				/** Assert */
				expect(error.errors).toContain(ERROR_MSG.MAX_MUST_BE_GREATER_THAN_MIN);
			}
		});

		it("should accept when MODERATEmax is greater than MODERATEmin", async () => {
			/** Arrange */
			const validData = {
				HIGHmin: 0,
				HIGHmax: 549,
				MODERATEmin: 550,
				MODERATEmax: 699, // max > min
				LOWmin: 700,
				LOWmax: 850,
				agingThreshold: false,
				riskAlertsStatus: false,
			};

			/** Act */
			const result = await scoreRangesSchema.validate(validData);

			/** Assert */
			expect(result).toEqual(validData);
		});
	});

	describe("LOWmax validation", () => {
		it("should reject when LOWmax is less than LOWmin", async () => {
			/** Arrange */
			const invalidData = {
				HIGHmin: 0,
				HIGHmax: 549,
				MODERATEmin: 550,
				MODERATEmax: 699,
				LOWmin: 700,
				LOWmax: 650, // max < min
				agingThreshold: false,
				riskAlertsStatus: false,
			};

			/** Act */
			try {
				await scoreRangesSchema.validate(invalidData, { abortEarly: false });
				fail("Validation should have failed");
			} catch (error: any) {
				/** Assert */
				expect(error.errors).toContain(ERROR_MSG.MAX_MUST_BE_GREATER_THAN_MIN);
			}
		});

		it("should reject when LOWmax equals LOWmin", async () => {
			/** Arrange */
			const invalidData = {
				HIGHmin: 0,
				HIGHmax: 549,
				MODERATEmin: 550,
				MODERATEmax: 699,
				LOWmin: 700,
				LOWmax: 700, // max === min
				agingThreshold: false,
				riskAlertsStatus: false,
			};

			/** Act */
			try {
				await scoreRangesSchema.validate(invalidData, { abortEarly: false });
				fail("Validation should have failed");
			} catch (error: any) {
				/** Assert */
				expect(error.errors).toContain(ERROR_MSG.MAX_MUST_BE_GREATER_THAN_MIN);
			}
		});

		it("should accept when LOWmax is greater than LOWmin", async () => {
			/** Arrange */
			const validData = {
				HIGHmin: 0,
				HIGHmax: 549,
				MODERATEmin: 550,
				MODERATEmax: 699,
				LOWmin: 700,
				LOWmax: 850, // max > min
				agingThreshold: false,
				riskAlertsStatus: false,
			};

			/** Act */
			const result = await scoreRangesSchema.validate(validData);

			/** Assert */
			expect(result).toEqual(validData);
		});
	});

	describe("Edge cases", () => {
		it("should handle boundary values correctly", async () => {
			/** Arrange */
			const validData = {
				HIGHmin: 0,
				HIGHmax: 1, // min + 1
				MODERATEmin: 2,
				MODERATEmax: 3, // min + 1
				LOWmin: 4,
				LOWmax: 5, // min + 1
				agingThreshold: false,
				riskAlertsStatus: false,
			};

			/** Act */
			const result = await scoreRangesSchema.validate(validData);

			/** Assert */
			expect(result).toEqual(validData);
		});

		it("should handle null/undefined values gracefully", async () => {
			/** Arrange */
			const dataWithNulls = {
				HIGHmin: 0,
				HIGHmax: null,
				MODERATEmin: 550,
				MODERATEmax: null,
				LOWmin: 700,
				LOWmax: null,
				agingThreshold: false,
				riskAlertsStatus: false,
			};

			/** Act */
			try {
				await scoreRangesSchema.validate(dataWithNulls, { abortEarly: false });
			} catch (error: any) {
				/** Assert */
				// Should fail validation due to required fields, not max > min check
				expect(error.errors).not.toContain(
					ERROR_MSG.MAX_MUST_BE_GREATER_THAN_MIN,
				);
			}
		});
	});
});
