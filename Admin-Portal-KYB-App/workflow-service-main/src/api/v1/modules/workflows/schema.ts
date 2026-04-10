import Joi from "joi";
import { Workflows } from "@joinworth/types";
import { COMPARISON_OPERATOR, LOGICAL_OPERATOR } from "#helpers/workflow";

const comparisonOperators = Object.values(COMPARISON_OPERATOR);

const NULL_CHECK_OPERATORS = [COMPARISON_OPERATOR.IS_NULL, COMPARISON_OPERATOR.IS_NOT_NULL];

const simpleConditionSchema = Joi.object({
	field: Joi.string().required().min(1).messages({
		"string.empty": "Condition field is required",
		"string.min": "Condition field must not be empty"
	}),
	value: Joi.any().when("operator", {
		is: Joi.string().valid(...NULL_CHECK_OPERATORS),
		then: Joi.optional(),
		otherwise: Joi.required().messages({
			"any.required": "Condition value is required"
		})
	}),
	operator: Joi.string()
		.valid(...comparisonOperators)
		.required()
		.messages({
			"any.only": `Condition operator must be one of: ${comparisonOperators.join(", ")}`
		})
});

const orConditionGroupSchema = Joi.object({
	operator: Joi.string()
		.valid(LOGICAL_OPERATOR.OR)
		.required()
		.messages({
			"any.only": `Nested condition operator must be '${LOGICAL_OPERATOR.OR}'`
		}),
	conditions: Joi.array().items(simpleConditionSchema).min(1).required().messages({
		"array.min": "OR condition group must have at least one condition",
		"array.base": "OR condition group must be an array"
	})
});

const level1ConditionSchema = Joi.alternatives().try(simpleConditionSchema, orConditionGroupSchema).messages({
	"alternatives.match": "Condition must be either a simple condition or an OR group"
});

const conditionsSchema = Joi.object({
	operator: Joi.string()
		.valid(LOGICAL_OPERATOR.AND)
		.required()
		.messages({
			"any.only": `Root condition operator must be '${LOGICAL_OPERATOR.AND}'`
		}),
	conditions: Joi.array().items(level1ConditionSchema).min(1).required().messages({
		"array.min": "At least one condition is required",
		"array.base": "Conditions must be an array"
	})
});

export const actionSchema = Joi.object({
	type: Joi.string()
		.valid(...Workflows.Validations.WorkflowValidationConstants.ACTIONS.VALID_TYPES)
		.required()
		.messages({
			"any.only": `Action type must be one of: ${Workflows.Validations.WorkflowValidationConstants.ACTIONS.VALID_TYPES.join(", ")}`
		}),
	parameters: Joi.object({
		field: Joi.string().required().min(1).messages({
			"string.empty": "Action parameter field is required",
			"string.min": "Action parameter field must not be empty"
		}),
		value: Joi.any().required().messages({
			"any.required": "Action parameter value is required"
		})
	})
		.required()
		.messages({
			"object.base": "Action parameters must be a valid object"
		})
});

const ruleSchema = Joi.object({
	name: Joi.string()
		.min(Workflows.Validations.WorkflowValidationConstants.RULE_NAME.MIN_LENGTH)
		.max(Workflows.Validations.WorkflowValidationConstants.RULE_NAME.MAX_LENGTH)
		.required()
		.messages({
			"string.empty": "Rule name is required",
			"string.min": `Rule name must be at least ${Workflows.Validations.WorkflowValidationConstants.RULE_NAME.MIN_LENGTH} character long`,
			"string.max": `Rule name must not exceed ${Workflows.Validations.WorkflowValidationConstants.RULE_NAME.MAX_LENGTH} characters`
		}),
	conditions: conditionsSchema.required().messages({
		"object.base": "Rule conditions must be a valid JSON object"
	}),
	actions: Joi.array()
		.items(actionSchema)
		.min(Workflows.Validations.WorkflowValidationConstants.ACTIONS.MIN_COUNT)
		.required()
		.messages({
			"array.min": `At least ${Workflows.Validations.WorkflowValidationConstants.ACTIONS.MIN_COUNT} action is required`,
			"array.base": "Actions must be an array"
		})
});

const ruleSchemaWithPriority = ruleSchema.keys({
	priority: Joi.number()
		.integer()
		.min(Workflows.Validations.WorkflowValidationConstants.PRIORITY.MIN_VALUE)
		.optional()
		.messages({
			"number.base": "Rule priority must be a number",
			"number.integer": "Rule priority must be an integer",
			"number.min": `Rule priority must be at least ${Workflows.Validations.WorkflowValidationConstants.PRIORITY.MIN_VALUE}`
		})
});

export const addRulesSchema = Joi.object({
	rules: Joi.array()
		.items(ruleSchemaWithPriority)
		.min(Workflows.Validations.WorkflowValidationConstants.RULES.MIN_COUNT)
		.required()
		.messages({
			"array.min": `At least ${Workflows.Validations.WorkflowValidationConstants.RULES.MIN_COUNT} rule is required`,
			"array.base": "Rules must be an array"
		})
});

export const previewEvaluationSchema = Joi.object({
	case_id: Joi.string().uuid().optional().messages({
		"string.guid": "Case ID must be a valid UUID"
	}),
	business_id: Joi.alternatives()
		.try(
			Joi.string().uuid().messages({
				"string.guid": "Business ID must be a valid UUID"
			}),
			Joi.array()
				.items(
					Joi.string().uuid().messages({
						"string.guid": "Each business ID must be a valid UUID"
					})
				)
				.min(1)
				.max(10)
				.messages({
					"array.min": "At least one business ID must be provided",
					"array.max": "Maximum of 10 business IDs allowed",
					"array.base": "Business IDs must be an array"
				})
		)
		.optional(),
	sample_size: Joi.number().integer().min(1).max(100).optional().messages({
		"number.base": "Sample size must be a number",
		"number.integer": "Sample size must be an integer",
		"number.min": "Sample size must be at least 1",
		"number.max": "Sample size must not exceed 100"
	})
})
	.custom((value: Record<string, unknown>, helpers) => {
		// At least one of case_id or business_id must be provided
		if (!value.case_id && !value.business_id) {
			return helpers.error("custom.atLeastOneRequired");
		}

		// If both are provided, case_id takes precedence
		if (value.case_id && value.business_id) {
			delete value.business_id;
			delete value.sample_size;
		}

		// Normalize business_id to array format if it's a single string
		if (value.business_id && !Array.isArray(value.business_id)) {
			value.business_id = [value.business_id];
		}

		// If business_id is provided without sample_size, set default
		if (value.business_id && !value.sample_size) {
			value.sample_size = 10;
		}

		return value;
	})
	.messages({
		"custom.atLeastOneRequired": "Either case_id or business_id must be provided"
	});

export const updateWorkflowSchema = Joi.object({
	name: Joi.string().min(1).max(255).optional().messages({
		"string.empty": "Workflow name must not be empty",
		"string.min": "Workflow name must be at least 1 character long",
		"string.max": "Workflow name must not exceed 255 characters"
	}),
	description: Joi.string().max(1000).optional().allow("").messages({
		"string.max": "Workflow description must not exceed 1000 characters"
	}),
	active: Joi.boolean().optional().messages({
		"boolean.base": "Status must be a boolean"
	}),
	trigger_id: Joi.string().uuid().optional().messages({
		"string.guid": "Trigger ID must be a valid UUID"
	}),
	rules: Joi.array().items(ruleSchema).optional().messages({
		"array.base": "Rules must be an array"
	}),
	default_action: Joi.alternatives().try(actionSchema, Joi.array().items(actionSchema)).optional().messages({
		"alternatives.match": "default_action must be either a single action object or an array of action objects"
	}),
	auto_publish: Joi.boolean().optional().default(false).messages({
		"boolean.base": "auto_publish must be a boolean"
	})
})
	.min(1)
	.messages({
		"object.min": "At least one field must be provided for update"
	});

export const createWorkflowDraftSchema = Joi.object({
	name: Joi.string().min(1).max(255).required().messages({
		"string.empty": "Workflow name is required",
		"string.min": "Workflow name must be at least 1 character long",
		"string.max": "Workflow name must not exceed 255 characters"
	}),
	description: Joi.string().max(1000).optional().allow("").messages({
		"string.max": "Workflow description must not exceed 1000 characters"
	}),
	trigger_id: Joi.string().uuid().required().messages({
		"string.guid": "Trigger ID must be a valid UUID"
	}),
	rules: Joi.array().items(ruleSchema).optional().messages({
		"array.base": "Rules must be an array"
	}),
	default_action: Joi.alternatives().try(actionSchema, Joi.array().items(actionSchema)).optional().messages({
		"alternatives.match": "default_action must be either a single action object or an array of action objects"
	}),
	auto_publish: Joi.boolean().optional().default(false).messages({
		"boolean.base": "auto_publish must be a boolean"
	})
});
