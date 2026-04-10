import * as yup from "yup";
import {
	type EnhancementForm,
	type FeaturesSettingsForm,
} from "@/types/customer";
import {
	type WorkflowDefaultAction,
	type WorkflowWizardForm,
} from "@/types/workflows";

import ERROR_MSG from "@/constants/ErrorMessages";

export const scoreRangesSchema = yup.object().shape({
	HIGHmin: yup
		.number()
		.typeError(ERROR_MSG.PROVIDE_MIN_SCORE)
		.min(0, ERROR_MSG.MIN_SCORE_LIMIT)
		.max(850, ERROR_MSG.MAX_SCORE_LIMIT)
		.required(ERROR_MSG.PROVIDE_MIN_SCORE),
	HIGHmax: yup
		.number()
		.typeError(ERROR_MSG.PROVIDE_MAX_SCORE)
		.required(ERROR_MSG.PROVIDE_MAX_SCORE)
		.when(["MODERATEmax", "HIGHmin"], ([MODERATEmax, HIGHmin], schema) => {
			return schema
				.min(0, ERROR_MSG.MIN_SCORE_LIMIT)
				.max(850, ERROR_MSG.MAX_SCORE_LIMIT)
				.test(
					"max-greater-than-min",
					ERROR_MSG.MAX_MUST_BE_GREATER_THAN_MIN,
					function (value) {
						if (value != null && HIGHmin != null) {
							return Number(value) > Number(HIGHmin);
						}
						return true;
					},
				)
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
		.required(ERROR_MSG.PROVIDE_MAX_SCORE)
		.when(["MODERATEmin"], ([MODERATEmin], schema) => {
			return schema.test(
				"max-greater-than-min",
				ERROR_MSG.MAX_MUST_BE_GREATER_THAN_MIN,
				function (value) {
					if (value != null && MODERATEmin != null) {
						return Number(value) > Number(MODERATEmin);
					}
					return true;
				},
			);
		}),
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
		.required(ERROR_MSG.PROVIDE_MAX_SCORE)
		.when(["LOWmin"], ([LOWmin], schema) => {
			return schema.test(
				"max-greater-than-min",
				ERROR_MSG.MAX_MUST_BE_GREATER_THAN_MIN,
				function (value) {
					if (value != null && LOWmin != null) {
						return Number(value) > Number(LOWmin);
					}
					return true;
				},
			);
		}),
	agingThreshold: yup.boolean().required(),
	agingThresholdLOW: yup.number().when("agingThreshold", {
		is: true,
		then: (s) =>
			s
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
		otherwise: (s) => s.optional(),
	}),

	agingThresholdMEDIUM: yup.number().when("agingThreshold", {
		is: true,
		then: (s) =>
			s
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
		otherwise: (s) => s.optional(),
	}),

	agingThresholdHIGH: yup.number().when("agingThreshold", {
		is: true,
		then: (s) =>
			s
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
		otherwise: (s) => s.optional(),
	}),
	creditScoreChange: yup.number().when("riskAlertsStatus", {
		is: true,
		then: (schema) =>
			schema
				.typeError(ERROR_MSG.PROVIDE_MAX_SCORE)
				.min(0, ERROR_MSG.MIN_SCORE_LIMIT)
				.max(850, ERROR_MSG.MAX_SCORE_LIMIT)
				.required(ERROR_MSG.PROVIDE_MAX_SCORE),
		otherwise: (schema) => schema.notRequired(),
	}),
	worthScoreChange: yup.number().when("riskAlertsStatus", {
		is: true,
		then: (schema) =>
			schema
				.typeError(ERROR_MSG.PROVIDE_MAX_SCORE)
				.min(0, ERROR_MSG.MIN_SCORE_LIMIT)
				.max(850, ERROR_MSG.MAX_SCORE_LIMIT)
				.required(ERROR_MSG.PROVIDE_MAX_SCORE),
		otherwise: (schema) => schema.notRequired(),
	}),
	creditScoreStatus: yup.boolean().when("riskAlertsStatus", {
		is: true,
		then: (schema) => schema.required(ERROR_MSG.REQUIRED_TOGGLE),
		otherwise: (schema) => schema.notRequired(),
	}),
	worthScoreStatus: yup.boolean().when("riskAlertsStatus", {
		is: true,
		then: (schema) => schema.required(ERROR_MSG.REQUIRED_TOGGLE),
		otherwise: (schema) => schema.notRequired(),
	}),
	scoreRiskTierTransitionStatus: yup.boolean().when("riskAlertsStatus", {
		is: true,
		then: (schema) => schema.required(ERROR_MSG.REQUIRED_TOGGLE),
		otherwise: (schema) => schema.notRequired(),
	}),
	newBankruptcyLienJudgementStatus: yup.boolean().when("riskAlertsStatus", {
		is: true,
		then: (schema) => schema.required(ERROR_MSG.REQUIRED_TOGGLE),
		otherwise: (schema) => schema.notRequired(),
	}),
	riskAlertsStatus: yup.boolean().required(ERROR_MSG.REQUIRED_TOGGLE),
	newAdverseMediaStatus: yup.boolean().when("riskAlertsStatus", {
		is: true,
		then: (schema) => schema.required(ERROR_MSG.REQUIRED_TOGGLE),
		otherwise: (schema) => schema.notRequired(),
	}),
});

export const FeaturesSchema: yup.ObjectSchema<FeaturesSettingsForm> = yup
	.object({
		settings: yup.object({
			bjl: yup.object({
				mode: yup.string().oneOf(["SANDBOX", "PRODUCTION", "MOCK"]).required(),
				status: yup.string().oneOf(["ACTIVE", "INACTIVE"]).required(),
			}),
			equifax: yup.object({
				mode: yup.string().oneOf(["SANDBOX", "PRODUCTION", "MOCK"]).required(),
				status: yup.string().oneOf(["ACTIVE", "INACTIVE"]).required(),
			}),
			adverse_media: yup.object({
				mode: yup.string().oneOf(["SANDBOX", "PRODUCTION", "MOCK"]).required(),
				status: yup.string().oneOf(["ACTIVE", "INACTIVE"]).required(),
			}),
			gverify: yup.object({
				mode: yup.string().oneOf(["SANDBOX", "PRODUCTION", "MOCK"]).required(),
				status: yup.string().oneOf(["ACTIVE", "INACTIVE"]).required(),
			}),
			gauthenticate: yup.object({
				mode: yup.string().oneOf(["SANDBOX", "PRODUCTION", "MOCK"]).required(),
				status: yup.string().oneOf(["ACTIVE", "INACTIVE"]).required(),
			}),
			identity_verification: yup.object({
				mode: yup.string().oneOf(["SANDBOX", "PRODUCTION", "MOCK"]).required(),
				status: yup.string().oneOf(["ACTIVE", "INACTIVE"]).required(),
			}),
		}),
	})
	.required();

export const EnhancementSchema: yup.ObjectSchema<EnhancementForm> = yup
	.object()
	.shape({
		identityDataPrefill: yup.boolean().required(ERROR_MSG.REQUIRED_TOGGLE),
		internationalKYB: yup.boolean().required(ERROR_MSG.REQUIRED_TOGGLE),
		enhancedKYB: yup.boolean().required(ERROR_MSG.REQUIRED_TOGGLE),
		enhancedPublicRecords: yup.boolean().required(ERROR_MSG.REQUIRED_TOGGLE),
		isPostSubmissionEditingEnabled: yup
			.boolean()
			.required(ERROR_MSG.REQUIRED_TOGGLE),
		processorOrchestration: yup.boolean().required(ERROR_MSG.REQUIRED_TOGGLE),
		riskMonitoring: yup.boolean().required(ERROR_MSG.REQUIRED_TOGGLE),
		advancedWatchlist: yup.boolean().required(ERROR_MSG.REQUIRED_TOGGLE),
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
	keyPassword: yup.string().trim().optional(),
	acquirerId: yup
		.string()
		.trim()
		.when("isActive", {
			is: true,
			then: (schema) => schema.required(ERROR_MSG.PROVIDE_ACQUIRER_ID),
			otherwise: (schema) => schema.optional(),
		}),
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

const defaultActionSchema = yup
	.object({
		type: yup.string().required(),
		parameters: yup
			.object({
				field: yup.string().required(),
				value: yup.mixed<string | boolean | number>().nullable().required(),
			})
			.unknown(true)
			.required(),
	})
	.optional() as yup.Schema<WorkflowDefaultAction | undefined>;

export const WorkflowWizardFormSchema: yup.ObjectSchema<WorkflowWizardForm> =
	yup.object().shape({
		name: yup
			.string()
			.trim()
			.required(ERROR_MSG.WORKFLOW_NAME_REQUIRED)
			.max(100, ERROR_MSG.WORKFLOW_NAME_MAX_LENGTH),
		description: yup
			.string()
			.trim()
			.max(500, ERROR_MSG.WORKFLOW_DESCRIPTION_MAX_LENGTH)
			.optional(),
		trigger: yup.string().required(ERROR_MSG.WORKFLOW_TRIGGER_REQUIRED),
		rules: yup.array().required().default([]),
		default_action: defaultActionSchema,
	});

export const webhookMessageSchema = yup.object().shape({
	lowAgingThresholdMessage: yup
		.string()
		.trim()
		.required("Low aging threshold message is required")
		.max(1000, "Low aging threshold message must be less than 1000 characters"),
	mediumAgingThresholdMessage: yup
		.string()
		.trim()
		.required("Medium aging threshold message is required")
		.max(
			1000,
			"Medium aging threshold message must be less than 1000 characters",
		),
	highAgingThresholdMessage: yup
		.string()
		.trim()
		.required("High aging threshold message is required")
		.max(
			1000,
			"High aging threshold message must be less than 1000 characters",
		),
});
