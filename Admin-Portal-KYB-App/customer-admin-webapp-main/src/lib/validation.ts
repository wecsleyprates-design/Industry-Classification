import { isPossiblePhoneNumber } from "react-phone-number-input";
import * as yup from "yup";
import { type NewBusinessType } from "@/types/business";
import { type CustomerBrandingSettingRequestBody } from "@/types/customer";
import { type IScoreRangesForm } from "@/types/riskAlerts";
import { CASE_STATUS_ENUM, ERROR_MSG } from "../constants";
import {
	getTaxIdErrorMessage,
	getTaxIdValidationRule,
	GLOBAL_TAX_ID_FALLBACK_MAX,
	GLOBAL_TAX_ID_FALLBACK_MIN,
} from "../lib/taxIdLabels";

import COUNTRIES from "@/constants/Countries";
import REGEX from "@/constants/Regex";

// auth validations
export const loginSchema = yup.object().shape({
	email: yup
		.string()
		.email(ERROR_MSG.PROVIDE_VALID_EMAIL)
		.required(ERROR_MSG.PROVIDE_EMAIL),
	password: yup.string().required(ERROR_MSG.PROVIDE_PASSWORD),
});

export const ssoLoginSchema = yup.object().shape({
	ssoEmail: yup
		.string()
		.email(ERROR_MSG.PROVIDE_VALID_EMAIL)
		.required(ERROR_MSG.PROVIDE_EMAIL),
});

export const resetPasswordSchema = yup.object().shape({
	currentPassword: yup
		.string()
		.trim()
		.required(ERROR_MSG.PROVIDE_CURRENT_PASSWORD)
		.test(
			"is-valid-password",
			ERROR_MSG.PROVIDE_STRONG_PASSWORD,
			function (value) {
				if (typeof value === "string" && value.trim() !== "") {
					return new RegExp(REGEX.PASSWORD).test(value);
				}
				return true;
			},
		)
		.notOneOf([yup.ref("password")], ERROR_MSG.PASSWORD_NOT_SAME),
	password: yup
		.string()
		.trim()
		.required(ERROR_MSG.PROVIDE_NEW_PASSWORD)
		.test(
			"is-valid-password",
			ERROR_MSG.PROVIDE_STRONG_PASSWORD,
			function (value) {
				if (typeof value === "string" && value.trim() !== "") {
					return new RegExp(REGEX.PASSWORD).test(value);
				}
				return true;
			},
		)
		.notOneOf([yup.ref("currentPassword")], ERROR_MSG.PASSWORD_NOT_SAME),
	confirmPassword: yup
		.string()
		.trim()
		.required(ERROR_MSG.PROVIDE_CONFIRM_PASSWORD)
		.oneOf([yup.ref("password"), ""], ERROR_MSG.PASSWORD_NOT_MATCHED),
});

export const setPasswordSchema = yup.object().shape({
	newPassword: yup
		.string()
		.required(ERROR_MSG.PROVIDE_PASSWORD)
		.matches(
			/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,20}$/,
			ERROR_MSG.PROVIDE_STRONG_PASSWORD,
		),
	confirmPassword: yup
		.string()
		.required(ERROR_MSG.PROVIDE_PASSWORD)
		.oneOf([yup.ref("newPassword"), ""], ERROR_MSG.PASSWORD_NOT_MATCHED),
});

export const acceptInviteSchema = yup.object().shape({
	password: yup
		.string()
		.required(ERROR_MSG.PROVIDE_PASSWORD)
		.matches(
			/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,20}$/,
			ERROR_MSG.PROVIDE_STRONG_PASSWORD,
		),
	confirmPassword: yup
		.string()
		.required(ERROR_MSG.PROVIDE_PASSWORD)
		.oneOf([yup.ref("password"), ""], ERROR_MSG.PASSWORD_NOT_MATCHED),
});

export const forgotPasswordSchema = yup.object().shape({
	email: yup
		.string()
		.email(ERROR_MSG.PROVIDE_VALID_EMAIL)
		.required(ERROR_MSG.PROVIDE_EMAIL),
});

export const updatePasswordSchema = yup.object().shape({
	currentPassword: yup.string().required(ERROR_MSG.PROVIDE_PASSWORD),
	newPassword: yup
		.string()
		.required(ERROR_MSG.PROVIDE_PASSWORD)
		.matches(
			/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,20}$/,
			ERROR_MSG.PROVIDE_STRONG_PASSWORD,
		),
	confirmPassword: yup
		.string()
		.required(ERROR_MSG.PROVIDE_PASSWORD)
		.oneOf([yup.ref("newPassword"), ""], ERROR_MSG.PASSWORD_NOT_MATCHED),
});

// user validations

export const createUserSchema = yup.object().shape({
	firstName: yup.string().required(ERROR_MSG.PROVIDE_FIRSTNAME),
	lastName: yup.string().required(ERROR_MSG.PROVIDE_LASTNAME),
	email: yup
		.string()
		.email(ERROR_MSG.PROVIDE_VALID_EMAIL)
		.required(ERROR_MSG.PROVIDE_EMAIL),
	mobile: yup
		.string()
		.trim()
		.notRequired()
		.test("is-valid-mobile", ERROR_MSG.VALID_MOBILE_NUMBER, function (value) {
			if (typeof value === "string" && value.trim() !== "") {
				const isMatch = /^\+1\d{10}$/.test(value);
				return isPossiblePhoneNumber(value) && isMatch;
			}
			return true;
		}),
	subrole: yup.object().required(ERROR_MSG.PROVIDE_SUBROLE),
});

export const editUserSchema = yup.object().shape({
	firstName: yup.string().required(ERROR_MSG.PROVIDE_FIRSTNAME),
	lastName: yup.string().required(ERROR_MSG.PROVIDE_LASTNAME),
	email: yup
		.string()
		.email(ERROR_MSG.PROVIDE_VALID_EMAIL)
		.required(ERROR_MSG.PROVIDE_EMAIL),
	mobile: yup
		.string()
		.trim()
		.notRequired()
		.test("is-valid-mobile", ERROR_MSG.VALID_MOBILE_NUMBER, function (value) {
			if (typeof value === "string" && value.trim() !== "") {
				const isMatch = /^\+1\d{10}$/.test(value);
				return isPossiblePhoneNumber(value) && isMatch;
			}
			return true;
		}),
	subrole: yup.object(),
});

// case validation
export const createCaseSchema = yup.object().shape({
	firstName: yup.string().required(ERROR_MSG.PROVIDE_FIRSTNAME),
	lastName: yup.string().required(ERROR_MSG.PROVIDE_LASTNAME),
	email: yup
		.string()
		.email(ERROR_MSG.PROVIDE_VALID_EMAIL)
		.required(ERROR_MSG.PROVIDE_EMAIL),
	mobile: yup
		.string()
		.trim()
		.notRequired()
		.test("is-valid-mobile", ERROR_MSG.VALID_MOBILE_NUMBER, function (value) {
			if (typeof value === "string" && value.trim() !== "") {
				const isMatch = /^\+1\d{10}$/.test(value);
				return isPossiblePhoneNumber(value) && isMatch;
			}
			return true;
		}),
	companyName: yup.string().required(ERROR_MSG.PROVIDE_COMPANY_NAME),
	companyMobile: yup
		.string()
		.trim()
		.notRequired()
		.test("is-valid-mobile", ERROR_MSG.VALID_MOBILE_NUMBER, function (value) {
			if (typeof value === "string" && value.trim() !== "") {
				const isMatch = /^\+1\d{10}$/.test(value);
				return isPossiblePhoneNumber(value) && isMatch;
			}
			return true;
		}),
});

// business validation
export const createBusinessSchema = yup.object().shape({
	firstName: yup.string().required(ERROR_MSG.PROVIDE_FIRSTNAME),
	lastName: yup.string().required(ERROR_MSG.PROVIDE_LASTNAME),
	email: yup
		.string()
		.email(ERROR_MSG.PROVIDE_VALID_EMAIL)
		.required(ERROR_MSG.PROVIDE_EMAIL),
	mobile: yup
		.string()
		.trim()
		.notRequired()
		.test("is-valid-mobile", ERROR_MSG.VALID_MOBILE_NUMBER, function (value) {
			if (typeof value === "string" && value.trim() !== "") {
				const isMatch = /^\+1\d{10}$/.test(value);
				return isPossiblePhoneNumber(value) && isMatch;
			}
			return true;
		}),
	companyName: yup
		.object()
		.shape({
			business_id: yup.string().optional(),
			label: yup.string().optional(),
			name: yup.string().optional(),
			value: yup.string().optional(),
		})
		.typeError(ERROR_MSG.PROVIDE_BUSINESS_NAME)
		.required(ERROR_MSG.PROVIDE_BUSINESS_NAME),
	companyMobile: yup
		.string()
		.trim()
		.notRequired()
		.test("is-valid-mobile", ERROR_MSG.VALID_MOBILE_NUMBER, function (value) {
			if (typeof value === "string" && value.trim() !== "") {
				const isMatch = /^\+1\d{10}$/.test(value);
				return isPossiblePhoneNumber(value) && isMatch;
			}
			return true;
		}),
	esignTemplates: yup.array().of(yup.string().uuid()).optional(),
	skipCreditCheck: yup.boolean().notRequired(),
	bypassSSN: yup.boolean().notRequired(),
});
export const sendInvitationSchema = yup.object().shape({
	firstName: yup.string().required(ERROR_MSG.PROVIDE_FIRSTNAME),
	lastName: yup.string().required(ERROR_MSG.PROVIDE_LASTNAME),
	email: yup
		.string()
		.email(ERROR_MSG.PROVIDE_VALID_EMAIL)
		.required(ERROR_MSG.PROVIDE_EMAIL),
	mobile: yup
		.string()
		.trim()
		.notRequired()
		.test("is-valid-mobile", ERROR_MSG.VALID_MOBILE_NUMBER, function (value) {
			if (typeof value === "string" && value.trim() !== "") {
				const isMatch = /^\+1\d{10}$/.test(value);
				return isPossiblePhoneNumber(value) && isMatch;
			}
			return true;
		}),
});

export const statusUpdateSchema = yup.object().shape({
	status: yup.string().required("Status is required"),
	assignee: yup.string().when(["status"], (status, schema) => {
		if (
			String(status) === CASE_STATUS_ENUM.ESCALATED ||
			String(status) === CASE_STATUS_ENUM.INVESTIGATING
		) {
			return schema.required("Assignee is required");
		} else {
			return schema.optional();
		}
	}),
	comment: yup.string().max(500),
});

// Score config ranges validations

export const scoreRangesSchema: yup.ObjectSchema<IScoreRangesForm> = yup
	.object()
	.shape({
		HIGHmin: yup
			.number()
			.typeError(ERROR_MSG.PROVIDE_MIN_SCORE)
			.min(0, ERROR_MSG.MIN_SCORE_LIMIT)
			.max(850, ERROR_MSG.MAX_SCORE_LIMIT)
			.required(ERROR_MSG.PROVIDE_MIN_SCORE),
		HIGHmax: yup
			.number()
			.typeError(ERROR_MSG.PROVIDE_MAX_SCORE)
			// .min(0, ERROR_MSG.MIN_SCORE_LIMIT)
			// .max(850, ERROR_MSG.MAX_SCORE_LIMIT)
			.required(ERROR_MSG.PROVIDE_MAX_SCORE)
			.when(["MODERATEmax"], (MODERATEmax, schema) => {
				return schema
					.min(0, ERROR_MSG.MIN_SCORE_LIMIT)
					.max(850, ERROR_MSG.MAX_SCORE_LIMIT)
					.test(
						"is-valid-range",
						ERROR_MSG.PROVIDE_INCLUSIVE_RANGES,
						function (value) {
							if (value) {
								return Number(MODERATEmax) - Number(value) > 1;
							}
							return true;
						},
					);
			}),
		MODERATEmin: yup
			.number()
			.typeError(ERROR_MSG.PROVIDE_MIN_SCORE)
			.min(0, ERROR_MSG.MIN_SCORE_LIMIT)
			.max(850, ERROR_MSG.MAX_SCORE_LIMIT)
			.required(ERROR_MSG.PROVIDE_MIN_SCORE),
		MODERATEmax: yup
			.number()
			.typeError(ERROR_MSG.PROVIDE_MAX_SCORE)
			.min(0, ERROR_MSG.MIN_SCORE_LIMIT)
			.max(850, ERROR_MSG.MAX_SCORE_LIMIT)
			.required(ERROR_MSG.PROVIDE_MAX_SCORE),
		LOWmin: yup
			.number()
			.typeError(ERROR_MSG.PROVIDE_MIN_SCORE)
			.min(0, ERROR_MSG.MIN_SCORE_LIMIT)
			.max(850, ERROR_MSG.MAX_SCORE_LIMIT)
			.required(ERROR_MSG.PROVIDE_MIN_SCORE),
		LOWmax: yup
			.number()
			.typeError(ERROR_MSG.PROVIDE_MAX_SCORE)
			.min(0, ERROR_MSG.MIN_SCORE_LIMIT)
			.max(850, ERROR_MSG.MAX_SCORE_LIMIT)
			.required(ERROR_MSG.PROVIDE_MAX_SCORE),
		creditScoreChange: yup
			.number()
			.typeError(ERROR_MSG.PROVIDE_MAX_SCORE)
			.min(0, ERROR_MSG.MIN_SCORE_LIMIT)
			.max(850, ERROR_MSG.MAX_SCORE_LIMIT)
			.required(ERROR_MSG.PROVIDE_MAX_SCORE),
		worthScoreChange: yup
			.number()
			.typeError(ERROR_MSG.PROVIDE_MAX_SCORE)
			.min(0, ERROR_MSG.MIN_SCORE_LIMIT)
			.max(850, ERROR_MSG.MAX_SCORE_LIMIT)
			.required(ERROR_MSG.PROVIDE_MAX_SCORE),
		creditScoreStatus: yup.boolean().required(ERROR_MSG.REQUIRED_TOGGLE),
		worthScoreStatus: yup.boolean().required(ERROR_MSG.REQUIRED_TOGGLE),
		scoreRiskTierTransitionStatus: yup
			.boolean()
			.required(ERROR_MSG.REQUIRED_TOGGLE),
		newBankruptcyLienJudgementStatus: yup
			.boolean()
			.required(ERROR_MSG.REQUIRED_TOGGLE),
		riskAlertsStatus: yup.boolean().required(ERROR_MSG.REQUIRED_TOGGLE),
		newAdverseMediaStatus: yup.boolean().required(ERROR_MSG.REQUIRED_TOGGLE),
	});

export const settingsSchema = yup.object().shape({
	name: yup.string().optional(),
	email: yup.string().email(ERROR_MSG.PROVIDE_VALID_EMAIL).optional(),
	password: yup.string().optional(),
	role: yup.string().optional(),
	userId: yup.string().optional(),
	customerId: yup.string().optional(),
	businessName: yup.string().optional(),
	companyNumber: yup.string().optional(),
});

export const newBusinessSchema: yup.ObjectSchema<NewBusinessType> = yup
	.object()
	.shape({
		businessName: yup.string().required(ERROR_MSG.PROVIDE_BUSINESS_NAME),
		dbaName: yup.string().optional(),
		tin: yup
			.string()
			.transform((value, originalValue) =>
				originalValue === "" ? undefined : value,
			)
			.when("country", ([country], schema: yup.StringSchema) => {
				const rule = getTaxIdValidationRule(country);
				const requiredMsg = getTaxIdErrorMessage(country, "required");
				const validMsg = getTaxIdErrorMessage(country, "valid");

				// If country has specific validation rule
				if (rule) {
					// Use custom validator if available (e.g., GB with multiple patterns)
					if (rule.validator) {
						const { validator, normalize } = rule;
						return schema
							.required(requiredMsg)
							.test("tax-id-format", validMsg, (value) => {
								if (!value) return true;
								const normalizedValue = normalize ? normalize(value) : value;
								return validator(normalizedValue);
							});
					}
					// Use regex if available
					if (rule.regex) {
						return schema.required(requiredMsg).matches(rule.regex, validMsg);
					}
				}

				// Fallback for unknown countries: 1-22 characters
				return schema
					.required(requiredMsg)
					.min(GLOBAL_TAX_ID_FALLBACK_MIN, validMsg)
					.max(GLOBAL_TAX_ID_FALLBACK_MAX, validMsg);
			})
			.required(),
		street: yup.string().required(ERROR_MSG.PROVIDE_STREET),
		suite: yup.string().optional(),
		city: yup.string().required(ERROR_MSG.PROVIDE_CITY),
		state: yup
			.string()
			.transform((value, originalValue) =>
				originalValue === "" ? undefined : value,
			)
			.when("country", ([country], schema: yup.StringSchema) => {
				switch (country) {
					case COUNTRIES.CANADA:
						return schema.required(ERROR_MSG.PROVIDE_STATE_PROVINCES);

					case COUNTRIES.UK:
						return schema.optional();

					default:
						return schema.required(ERROR_MSG.PROVIDE_STATE);
				}
			}),
		country: yup
			.string()
			.oneOf(
				[
					COUNTRIES.USA,
					COUNTRIES.CANADA,
					COUNTRIES.UK,
					COUNTRIES.PUERTO_RICO,
					COUNTRIES.AUSTRALIA,
					COUNTRIES.NEW_ZEALAND,
				],
				ERROR_MSG.PROVIDE_COUNTRY,
			)
			.required(ERROR_MSG.PROVIDE_COUNTRY),
		npi: yup.string().optional(),
		externalId: yup.string().max(50).optional(),
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
							.matches(REGEX.CANADA_POSTAL_CODE, ERROR_MSG.VALID_ZIP_POSTAL)
							.required(ERROR_MSG.PROVIDE_ZIP_POSTAL);
					case COUNTRIES.UK:
						return schema
							.matches(REGEX.UK_POSTAL_CODE, ERROR_MSG.VALID_ZIP)
							.required(ERROR_MSG.PROVIDE_ZIP);
					case COUNTRIES.AUSTRALIA:
					case COUNTRIES.NEW_ZEALAND:
						// Australian and New Zealand postal codes are typically 4 digits
						return schema
							.matches(/^\d{4}$/, ERROR_MSG.VALID_ZIP)
							.required(ERROR_MSG.PROVIDE_ZIP);
					default:
						return schema
							.matches(/^\d{5}$/, ERROR_MSG.VALID_ZIP)
							.required(ERROR_MSG.PROVIDE_ZIP);
				}
			})
			.required(ERROR_MSG.PROVIDE_ZIP),
		isMailingAddress: yup.boolean().optional(),
		mStreet: yup
			.string()
			.when(["isMailingAddress"], ([isMailingAddress], schema) => {
				if (isMailingAddress) return schema.required(ERROR_MSG.PROVIDE_STREET);
				else return schema.optional();
			}),
		mSuite: yup.string().optional(),
		mCity: yup
			.string()
			.when(["isMailingAddress"], ([isMailingAddress], schema) => {
				if (isMailingAddress) return schema.required(ERROR_MSG.PROVIDE_CITY);
				else return schema.optional();
			}),
		mState: yup
			.string()
			.when(["isMailingAddress"], ([isMailingAddress], schema) => {
				if (!isMailingAddress) return schema.optional();
				return schema.when("country", ([country], schema: yup.StringSchema) => {
					switch (country) {
						case COUNTRIES.CANADA:
							return schema.required(ERROR_MSG.PROVIDE_STATE_PROVINCES);

						case COUNTRIES.UK:
							return schema.optional();

						default:
							return schema.required(ERROR_MSG.PROVIDE_STATE);
					}
				});
			}),
		mZip: yup
			.string()
			.transform((val) => val.replaceAll(" ", ""))
			.when(["isMailingAddress"], ([isMailingAddress], schema) => {
				if (!isMailingAddress) return schema.optional();

				return schema.when("country", ([country], schema: yup.StringSchema) => {
					switch (country) {
						case COUNTRIES.CANADA:
							return schema
								.matches(REGEX.CANADA_POSTAL_CODE, ERROR_MSG.VALID_ZIP_POSTAL)
								.required(ERROR_MSG.PROVIDE_ZIP_POSTAL);
						case COUNTRIES.UK:
							return schema
								.matches(REGEX.UK_POSTAL_CODE, ERROR_MSG.VALID_ZIP)
								.required(ERROR_MSG.PROVIDE_ZIP);
						case COUNTRIES.AUSTRALIA:
						case COUNTRIES.NEW_ZEALAND:
							// Australian and New Zealand postal codes are typically 4 digits
							return schema
								.matches(/^\d{4}$/, ERROR_MSG.VALID_ZIP)
								.required(ERROR_MSG.PROVIDE_ZIP);
						default:
							return schema
								.matches(/^\d{5}$/, ERROR_MSG.VALID_ZIP)
								.required(ERROR_MSG.PROVIDE_ZIP);
					}
				});
			}),
		bypassSSN: yup.boolean().optional(),
		skipCreditCheck: yup.boolean().optional(),
	});

export const startApplicationCreateBusinessSchema: yup.ObjectSchema<{
	businessName: string;
	dbaName?: string;
	address: string;
	country: string;
}> = yup.object().shape({
	businessName: yup.string().required(ERROR_MSG.PROVIDE_BUSINESS_NAME),
	dbaName: yup.string().optional(),
	address: yup.string().required(ERROR_MSG.PROVIDE_ADDRESS),
	country: yup.string().required(ERROR_MSG.PROVIDE_COUNTRY),
});

export const RequestModalBodySchema = yup.object().shape({
	firstName: yup
		.string()
		.when(["isOwnerApplicant"], ([isOwnerApplicant], schema) => {
			if (isOwnerApplicant === false)
				return schema.required(ERROR_MSG.PROVIDE_FIRSTNAME);
			return schema.optional();
		}),
	lastName: yup
		.string()
		.when(["isOwnerApplicant"], ([isOwnerApplicant], schema) => {
			if (isOwnerApplicant === false)
				return schema.required(ERROR_MSG.PROVIDE_LASTNAME);
			return schema.optional();
		}),
	email: yup
		.string()
		.email()
		.when(["isOwnerApplicant"], ([isOwnerApplicant], schema) => {
			if (isOwnerApplicant === false)
				return schema.required(ERROR_MSG.PROVIDE_EMAIL);
			return schema.optional();
		}),
	subjectLine: yup.string().required(),
	subjectBody: yup.string().required(),
	isOwnerApplicant: yup.boolean().optional(),
});

export const CustomerBrandingSettingSchema: yup.ObjectSchema<CustomerBrandingSettingRequestBody> =
	yup
		.object({
			domain: yup.string().trim().required("Custom Subdomain is required"),
			primaryCompanyLogo: yup.mixed<File>().nullable(),
			buttonColor: yup.string().trim().required("Button Color is required"),
			buttonTextColor: yup.string().trim(),
			onboardingEmailBody: yup.string().trim(),
			onboardingEmailButtonText: yup
				.string()
				.trim()
				.required("Onboarding Invite Email button text is required"),
			lightningVerifyEmailButtonText: yup.string().trim(),
			lightningVerifyEmailBody: yup.string().trim(),
			lightningVerifyEmailSubject: yup.string().trim(),
			welcomeBackgroundImage: yup.mixed<File>().nullable(),
			primaryBackgroundColor: yup.string().trim(),
			progressBarColor: yup.string().trim(),
			termsAndConditions: yup
				.string()
				.trim()
				.optional()
				.nullable()
				.max(50, ERROR_MSG.LIMIT_WEBSITE)
				.url(ERROR_MSG.VALID_WEBSITE)
				.transform((currentValue: string) => {
					if (
						currentValue &&
						!currentValue.startsWith("http://") &&
						!currentValue.startsWith("https://")
					) {
						return `http://${currentValue}`;
					}
					return currentValue;
				}),
			privacyPolicyLink: yup
				.string()
				.trim()
				.optional()
				.nullable()
				.max(50, ERROR_MSG.LIMIT_WEBSITE)
				.url(ERROR_MSG.VALID_WEBSITE)
				.transform((currentValue: string) => {
					if (
						currentValue &&
						!currentValue.startsWith("http://") &&
						!currentValue.startsWith("https://")
					) {
						return `http://${currentValue}`;
					}
					return currentValue;
				}),
			companySupportEmailAddress: yup
				.string()
				.email(ERROR_MSG.PROVIDE_VALID_EMAIL),
			thankYouMessageTitle: yup.string().trim(),
			thankYouMessageBodyText: yup.string().trim(),
			customURL: yup.string().trim().optional().nullable(),
			companySupportPhoneNumber: yup
				.string()
				.trim()
				.test("is-valid-phone", ERROR_MSG.SUPPORT_PHONE_FORMAT, (value) => {
					return !value || REGEX.MOBILE_WITH_BRACKETS.test(value);
				}),
		})
		.required();
export const createWebhookSchema = yup.object().shape({
	url: yup
		.string()
		.trim()
		.required(ERROR_MSG.REQUIRED_URL)
		.url(ERROR_MSG.VALID_URL)
		.transform((currentValue: string) => {
			if (
				currentValue &&
				!currentValue.startsWith("http://") &&
				!currentValue.startsWith("https://")
			) {
				return `http://${currentValue}`;
			}
			return currentValue;
		}),
});

export const IntegrationSettingsSchema = yup.object().shape({
	consumerKey: yup
		.string()
		.trim()
		.when("isActive", {
			is: true,
			then: (schema) => schema.required(ERROR_MSG.PROVIDE_CONSUMER_KEY),
			otherwise: (schema) => schema.optional(),
		}),
	keyPassword: yup
		.string()
		.trim()
		.when("isActive", {
			is: true,
			then: (schema) => schema.required(ERROR_MSG.PROVIDE_KEY_PASSWORD),
			otherwise: (schema) => schema.optional(),
		}),
	icas: yup
		.array()
		.of(
			yup
				.object()
				.shape({
					ica: yup.string().trim().optional(),
					isDefault: yup.boolean().required(),
				})
				.required(),
		)
		.when("isActive", {
			is: true,
			then: (schema) =>
				schema
					.min(1, ERROR_MSG.PROVIDE_ICA)
					.max(4, ERROR_MSG.MAX_ICA_LIMIT)
					.required(ERROR_MSG.PROVIDE_ICA)
					.test("all-icas-valid", ERROR_MSG.INVALID_ICA_FORMAT, (value) => {
						if (!value) return false;
						return value.every((item) => {
							const ica = item.ica?.trim();
							return ica && /^[a-zA-Z0-9]+$/.test(ica);
						});
					})
					.test(
						"unique-icas",
						ERROR_MSG.ICA_DUPLICATES_NOT_ALLOWED,
						(value) => {
							if (!value) return false;
							const icaValues = value
								.map((item) => item.ica?.trim().toLowerCase())
								.filter((ica): ica is string => !!ica && ica.length > 0);
							const uniqueIcas = new Set(icaValues);
							return uniqueIcas.size === icaValues.length;
						},
					)
					.test("single-default-ica", ERROR_MSG.SINGLE_DEFAULT_ICA, (value) => {
						if (!value || value.length === 0) return false;
						const defaultCount = value.filter((item) => item?.isDefault).length;
						return defaultCount === 1;
					}),
			otherwise: (schema) => schema.optional(),
		})
		.default([]),
	isActive: yup.boolean().required(ERROR_MSG.REQUIRED_TOGGLE),
	keyFile: yup
		.mixed()
		.nullable()
		.when("isActive", {
			is: true,
			then: (schema) =>
				schema
					.required(ERROR_MSG.REQUIRED_FILE)
					.test("file-type", ERROR_MSG.VALID_FILE_TYPE, (value) => {
						if (!value) return false;
						const file = value as File;
						return [
							"application/pkcs12",
							"application/x-pkcs12",
							"application/pkcs-12",
							"application/x-pkcs12-certificates",
							"application/x-pem-file",
							"application/x-x509-ca-cert",
							"application/x-certificate",
						].includes(file.type);
					}),
			otherwise: (schema) => schema.nullable(),
		}),
});

export const stripeIntegrationSchema = yup.object().shape({
	nickname: yup
		.string()
		.required("Nickname is required")
		.max(50, "Nickname must be at most 50 characters"),
	secretKey: yup
		.string()
		.required("Secret Key is required")
		.max(300, "Secret Key must be at most 300 characters")
		.test(
			"valid-secret-key-prefix",
			"Secret Key must start with 'sk_live_' or 'sk_test_'",
			(value) => {
				if (!value) return false;
				return value.startsWith("sk_live_") || value.startsWith("sk_test_");
			},
		),
	publishableKey: yup
		.string()
		.required("Publishable Key is required")
		.max(300, "Publishable Key must be at most 300 characters")
		.test(
			"valid-publishable-key-prefix",
			"Publishable Key must start with 'pk_live_' or 'pk_test_'",
			(value) => {
				if (!value) return false;
				return value.startsWith("pk_live_") || value.startsWith("pk_test_");
			},
		),
});
