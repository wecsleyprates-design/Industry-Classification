import Joi, { type Schema } from "joi";
import { ProcessCompletionFactsEvent, ApplicationEditFactsReadyEvent, CaseStatusUpdatedEvent } from "./types";

export const processCompletionFactsEventSchema: Schema = Joi.object<ProcessCompletionFactsEvent>({
	business_id: Joi.string().uuid().required().messages({
		"string.base": "business_id must be a string",
		"string.guid": "business_id must be a valid UUID",
		"any.required": "business_id is required"
	}),

	customer_id: Joi.string().uuid().allow(null).optional().messages({
		"string.base": "customer_id must be a string",
		"string.guid": "customer_id must be a valid UUID"
	}),

	case_id: Joi.string().uuid().allow(null).optional().messages({
		"string.base": "case_id must be a string",
		"string.guid": "case_id must be a valid UUID"
	}),

	score_trigger_id: Joi.string().uuid().allow(null).optional().messages({
		"string.base": "score_trigger_id must be a string",
		"string.guid": "score_trigger_id must be a valid UUID"
	}),

	action: Joi.string().required().messages({
		"string.base": "action must be a string",
		"any.required": "action is required"
	}),

	category_id: Joi.alternatives()
		.try(Joi.string().valid("all"), Joi.number().integer().min(1).max(9))
		.required()
		.messages({
			"alternatives.match": "category_id must be either 'all' or a number between 1 and 9",
			"any.required": "category_id is required"
		}),

	category_name: Joi.string().allow(null, "").optional().messages({
		"string.base": "category_name must be a string"
	}),

	completion_state: Joi.object().unknown(true).required().messages({
		"object.base": "completion_state must be an object",
		"any.required": "completion_state is required"
	})
});

export const applicationEditFactsReadyEventSchema: Schema = Joi.object<ApplicationEditFactsReadyEvent>({
	business_id: Joi.string().uuid().required().messages({
		"string.base": "business_id must be a string",
		"string.guid": "business_id must be a valid UUID",
		"any.required": "business_id is required"
	}),

	case_id: Joi.string().uuid().required().messages({
		"string.base": "case_id must be a string",
		"string.guid": "case_id must be a valid UUID",
		"any.required": "case_id is required"
	}),

	customer_id: Joi.string().uuid().allow(null).optional().messages({
		"string.base": "customer_id must be a string",
		"string.guid": "customer_id must be a valid UUID"
	}),

	previous_status: Joi.string().allow(null, "").optional().messages({
		"string.base": "previous_status must be a string"
	})
});

export const caseStatusUpdatedEventSchema: Schema = Joi.object<CaseStatusUpdatedEvent>({
	case_id: Joi.string().uuid().required().messages({
		"string.base": "case_id must be a string",
		"string.guid": "case_id must be a valid UUID",
		"any.required": "case_id is required"
	}),
	business_id: Joi.string().uuid().required().messages({
		"string.base": "business_id must be a string",
		"string.guid": "business_id must be a valid UUID",
		"any.required": "business_id is required"
	}),
	case_status: Joi.string().required().messages({
		"string.base": "case_status must be a string",
		"any.required": "case_status is required"
	})
});
