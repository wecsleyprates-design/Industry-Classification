import * as yup from "yup";

import COUNTRIES from "@/constants/countries";
import ERROR_MSG from "@/constants/ErrorMessages";
import REGEX from "@/constants/Regex";

export const loginSchema = yup.object().shape({
	email: yup.string().required(ERROR_MSG.REQUIRED_EMAIL),
	password: yup.string().required(ERROR_MSG.REQUIRED_PASSWORD),
});

export const cloneBusinessDetailsSchema = yup.object().shape({
	businessName: yup.string().required(ERROR_MSG.BUSINESS_NAME_REQUIRED),
	dbaName: yup.string(),
	tin: yup
		.string()
		.transform((value, originalValue) =>
			originalValue === "" ? undefined : value,
		)
		.when("country", ([country], schema: yup.StringSchema) => {
			switch (country) {
				case COUNTRIES.CANADA:
					return schema
						.required(ERROR_MSG.CA_BN_REQUIRED)
						.length(9, ERROR_MSG.CA_BN_LENGTH)
						.matches(
							REGEX.ONLY_NUMBERS,
							ERROR_MSG.CA_BN_NUMBERS_ONLY,
						);
				case COUNTRIES.UK:
					return schema
						.required(ERROR_MSG.UK_CRN_REQUIRED)
						.test(
							"valid-uk-tax-id",
							ERROR_MSG.UK_CRN_VALID,
							(value) => {
								if (!value) return false;
								const cleaned = value
									.replace(/\s+/g, "")
									.toUpperCase();

								const patterns = [
									REGEX.UK_UTR,
									REGEX.UK_NONO,
									REGEX.UK_CRN,
									REGEX.UK_VAT,
								];

								return patterns.some((pattern) =>
									pattern.test(cleaned),
								);
							},
						);
				default:
					return schema
						.required(ERROR_MSG.TIN_REQUIRED)
						.length(9, ERROR_MSG.TIN_LENGTH)
						.matches(
							REGEX.ONLY_NUMBERS,
							ERROR_MSG.TIN_NUMBERS_ONLY,
						);
			}
		})
		.required(),
	country: yup
		.string()
		.oneOf(
			[COUNTRIES.USA, COUNTRIES.CANADA, COUNTRIES.UK],
			ERROR_MSG.COUNTRY_REQUIRED,
		)
		.required(ERROR_MSG.COUNTRY_REQUIRED),
	addressLine1: yup.string().required(ERROR_MSG.STREET_REQUIRED),
	addressLine2: yup.string(),
	city: yup.string().required(ERROR_MSG.CITY_REQUIRED),
	state: yup
		.string()
		.transform((value, originalValue) =>
			originalValue === "" ? undefined : value,
		)
		.when("country", ([country], schema: yup.StringSchema) => {
			switch (country) {
				case COUNTRIES.CANADA:
					return schema.required(ERROR_MSG.CA_STATE_REQUIRED);

				case COUNTRIES.UK:
					return schema.optional();

				default:
					return schema.required(ERROR_MSG.STATE_REQUIRED);
			}
		}),
	zip: yup
		.string()
		.transform((val) => val.replaceAll(" ", ""))
		.transform((value, originalValue) =>
			originalValue === "" ? undefined : value,
		)
		.when("country", ([country], schema: yup.StringSchema) => {
			switch (country) {
				case COUNTRIES.CANADA:
					return schema
						.required(ERROR_MSG.ZIP_POSTAL_REQUIRED)
						.matches(
							REGEX.CANADA_POSTAL_CODE,
							ERROR_MSG.ZIP_POSTAL_VALID,
						);
				case COUNTRIES.UK:
					return schema
						.required(ERROR_MSG.ZIP_REQUIRED)
						.length(5, ERROR_MSG.ZIP_LENGTH)
						.matches(
							REGEX.UK_POSTAL_CODE,
							ERROR_MSG.ZIP_POSTAL_VALID,
						);
				default:
					return schema
						.required(ERROR_MSG.ZIP_REQUIRED)
						.length(5, ERROR_MSG.ZIP_LENGTH)
						.matches(
							REGEX.ONLY_NUMBERS,
							ERROR_MSG.ZIP_NUMBERS_ONLY,
						);
			}
		})
		.required(ERROR_MSG.ZIP_REQUIRED),
});

export const agingThresholdsSchema = yup.object().shape({
	agingThresholdLOW: yup
		.number()
		.required("LOW is required")
		.moreThan(0, "LOW must be greater than 0")
		.test(
			"low-less-than-medium",
			"LOW must be less than MEDIUM",
			function (value) {
				const { agingThresholdMEDIUM } = this.parent;
				if (agingThresholdMEDIUM == null) return true;
				return value < agingThresholdMEDIUM;
			},
		),
	agingThresholdMEDIUM: yup
		.number()
		.required("MEDIUM is required")
		.test(
			"medium-greater-than-low",
			"MEDIUM must be greater than LOW",
			function (value) {
				const { agingThresholdLOW } = this.parent;
				if (agingThresholdLOW == null) return true;
				return value > agingThresholdLOW;
			},
		)
		.test(
			"medium-less-than-high",
			"MEDIUM must be lower than HIGH",
			function (value) {
				const { agingThresholdHIGH } = this.parent;
				if (agingThresholdHIGH == null) return true;
				return value < agingThresholdHIGH;
			},
		),
	agingThresholdHIGH: yup
		.number()
		.required("HIGH is required")
		.test(
			"high-greater-than-medium",
			"HIGH must be greater than MEDIUM",
			function (value) {
				const { agingThresholdMEDIUM } = this.parent;
				if (agingThresholdMEDIUM == null) return true;
				return value > agingThresholdMEDIUM;
			},
		),
	agingThresholdMessageLOW: yup
		.string()
		.required("Low Aging threshold message is required"),
	agingThresholdMessageMEDIUM: yup
		.string()
		.required("Medium Aging threshold message is required"),
	agingThresholdMessageHIGH: yup
		.string()
		.required("High Aging threshold message is required"),
});

export const CreateMerchantProfileSchema = yup.object({
	onboardImmediately: yup.boolean().required(),
	capabilities: yup.object({
		card_payments: yup.boolean(),
		transfers: yup.boolean(),
		us_bank_account_ach_payments: yup.boolean(),
	}),
	bankId: yup.string().required(),
});
