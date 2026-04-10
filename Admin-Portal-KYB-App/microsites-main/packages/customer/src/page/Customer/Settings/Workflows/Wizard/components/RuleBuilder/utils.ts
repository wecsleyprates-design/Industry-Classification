import type {
	AttributesCatalog,
	BaseCondition,
	ConditionFormData,
	ConditionGroupFormData,
	ConditionOperator,
	ConditionValue,
	DecisionValue,
	NestedConditionGroup,
	RuleConditionItem,
	RuleFormData,
	WorkflowAction,
	WorkflowDefaultAction,
	WorkflowRule,
} from "@/types/workflows";
import { ACTION_FIELD, ACTION_TYPE, isValidDecisionValue } from "./constants";
import {
	isArrayEmptyOperator,
	isArrayMultiValueOperator,
	isArrayNumberOperator,
	isArrayStringOperator,
	isConditionGroup,
	isMultiValueOperator,
	isNullOperator,
	isRangeOperator,
	type RuleValidationError,
} from "./types";

export const generateId = (): string => crypto.randomUUID();

export const createEmptyCondition = (): ConditionFormData => ({
	id: generateId(),
	context: "",
	source: "",
	attribute: "",
	attributeLabel: "",
	operator: "",
	value: null,
});

export const createEmptyConditionGroup = (
	initialCondition?: ConditionFormData,
): ConditionGroupFormData => ({
	id: generateId(),
	operator: "OR",
	conditions: [initialCondition ?? createEmptyCondition()],
});

export const createEmptyRule = (index: number): RuleFormData => ({
	id: generateId(),
	name: `Rule ${index + 1}`,
	conditions: [createEmptyCondition()],
	decision: "",
});

export const createDefaultAction = (
	decision: DecisionValue,
): WorkflowDefaultAction => ({
	type: ACTION_TYPE,
	parameters: {
		field: ACTION_FIELD,
		value: decision,
	},
});

export const createWorkflowAction = (
	decision: DecisionValue,
): WorkflowAction => ({
	type: ACTION_TYPE,
	parameters: {
		field: ACTION_FIELD,
		value: decision,
	},
});

type InputType = "string" | "number" | "multi" | "range" | "null";

const getInputType = (operator: ConditionOperator | ""): InputType => {
	if (!operator) return "string";
	if (isNullOperator(operator) || isArrayEmptyOperator(operator)) return "null";
	if (isArrayNumberOperator(operator)) return "number";
	if (isArrayStringOperator(operator)) return "string";
	if (isArrayMultiValueOperator(operator) || isMultiValueOperator(operator))
		return "multi";
	if (isRangeOperator(operator)) return "range";
	return "string";
};

const areInputTypesCompatible = (
	fromType: InputType,
	toType: InputType,
): boolean => {
	if (fromType === toType) return true;
	if (fromType === "null" || toType === "null") return false;
	if (fromType === "string" && toType === "number") return false;
	if (fromType === "number" && toType === "string") return true;
	if (fromType === "number" && (toType === "multi" || toType === "range"))
		return false;
	if ((fromType === "multi" || fromType === "range") && toType === "number")
		return false;
	return true;
};

export const transformValueForOperator = (
	currentValue: ConditionValue,
	fromOperator: ConditionOperator | "",
	toOperator: ConditionOperator | "",
): ConditionValue => {
	const toType = getInputType(toOperator);

	if (toType === "null") return null;

	if (currentValue === null || currentValue === undefined) return null;

	const fromType = getInputType(fromOperator);

	if (!areInputTypesCompatible(fromType, toType)) {
		return null;
	}

	if (fromType === toType) return currentValue;

	if (fromType === "string" && toType === "multi") {
		return [currentValue as string | number];
	}

	if (fromType === "string" && toType === "range") {
		return [currentValue as string | number, null] as ConditionValue;
	}

	if (fromType === "multi" && toType === "string") {
		const arr = currentValue as Array<string | number>;
		return arr.length > 0 ? arr[0] : null;
	}

	if (fromType === "multi" && toType === "range") {
		const arr = currentValue as Array<string | number>;
		return [arr[0] ?? null, arr[1] ?? null] as ConditionValue;
	}

	if (fromType === "range" && toType === "string") {
		const arr = currentValue as Array<string | number | null>;
		return arr[0] ?? null;
	}

	if (fromType === "range" && toType === "multi") {
		const arr = currentValue as Array<string | number | null>;
		return arr.filter((v): v is string | number => v !== null);
	}

	return currentValue;
};

interface TransformOptions {
	includeDisplayLabel?: boolean;
}

const buildFieldPath = (source: string, attribute: string): string =>
	`${source}.${attribute}`;

const transformCondition = (
	condition: ConditionFormData,
	options: TransformOptions = {},
): BaseCondition & { display_label?: string } => ({
	field: buildFieldPath(condition.source, condition.attribute),
	operator: condition.operator,
	value: condition.value,
	...(options.includeDisplayLabel &&
		condition.attributeLabel && { display_label: condition.attributeLabel }),
});

const transformGroup = (
	group: ConditionGroupFormData,
	options: TransformOptions = {},
): NestedConditionGroup => ({
	operator: "OR",
	conditions: group.conditions.map((c) => transformCondition(c, options)),
});

const transformRule = (
	rule: RuleFormData,
	options: TransformOptions = {},
): WorkflowRule | null => {
	if (!rule.decision) return null;

	return {
		name: rule.name,
		conditions: {
			operator: "AND",
			conditions: rule.conditions.map((item) =>
				isConditionGroup(item)
					? transformGroup(item, options)
					: transformCondition(item, options),
			),
		},
		actions: [createWorkflowAction(rule.decision)],
	};
};

const transformRules = (
	rules: RuleFormData[],
	options: TransformOptions = {},
): WorkflowRule[] => {
	return rules
		.map((rule) => transformRule(rule, options))
		.filter((rule): rule is WorkflowRule => rule !== null);
};

export const transformRulesToPayload = (
	rules: RuleFormData[],
): WorkflowRule[] => {
	return transformRules(rules);
};

export const transformRulesToPreview = (
	rules: RuleFormData[],
): WorkflowRule[] => {
	return transformRules(rules, { includeDisplayLabel: true });
};

/**
 * Find context from catalog by matching field path against catalog entries.
 * The field can be in formats like:
 * - "facts.annual_revenue" -> look for attribute.name = "annual_revenue" with source = "facts"
 * - "external.facts.adverse_media_hits" -> look for attribute.name = "facts.adverse_media_hits" with source = "external"
 */
const findContextFromCatalog = (
	field: string,
	catalog: AttributesCatalog,
): {
	context: string;
	source: string;
	attribute: string;
	attributeLabel: string;
} => {
	// Try to find the attribute in the catalog
	for (const [contextKey, items] of Object.entries(catalog)) {
		for (const item of items) {
			// Build the full field path as it would appear in the API
			// Format: source.attribute.name (e.g., "facts.annual_revenue" or "external.facts.adverse_media_hits")
			const catalogFieldPath = `${item.source}.${item.attribute.name}`;

			if (field === catalogFieldPath) {
				return {
					context: contextKey,
					source: item.source,
					attribute: item.attribute.name,
					attributeLabel: item.attribute.label,
				};
			}
		}
	}

	// Fallback: parse the field path manually if not found in catalog
	const firstDotIndex = field.indexOf(".");
	if (firstDotIndex === -1) {
		return { context: "", source: "", attribute: field, attributeLabel: "" };
	}

	const source = field.substring(0, firstDotIndex);
	const attribute = field.substring(firstDotIndex + 1);

	return { context: "", source, attribute, attributeLabel: "" };
};

const transformPayloadToCondition = (
	condition: BaseCondition,
	catalog: AttributesCatalog,
): ConditionFormData => {
	const { context, source, attribute, attributeLabel } = findContextFromCatalog(
		condition.field,
		catalog,
	);
	return {
		id: generateId(),
		context,
		source,
		attribute,
		attributeLabel,
		operator: condition.operator as ConditionFormData["operator"],
		value: condition.value as ConditionValue,
	};
};

const transformPayloadToGroup = (
	group: NestedConditionGroup,
	catalog: AttributesCatalog,
): ConditionGroupFormData => ({
	id: generateId(),
	operator: "OR",
	conditions: group.conditions.map((c) =>
		transformPayloadToCondition(c, catalog),
	),
});

const isNestedGroup = (
	item: BaseCondition | NestedConditionGroup,
): item is NestedConditionGroup => {
	return "conditions" in item && item.operator === "OR";
};

const extractDecisionFromAction = (
	action: WorkflowAction | undefined,
): DecisionValue | "" => {
	if (!action || action.type !== ACTION_TYPE) {
		return "";
	}

	const value = action.parameters?.value;
	return isValidDecisionValue(value) ? value : "";
};

const transformConditionItem = (
	item: BaseCondition | NestedConditionGroup,
	catalog: AttributesCatalog,
): RuleConditionItem => {
	if (isNestedGroup(item)) {
		return transformPayloadToGroup(item, catalog);
	}
	return transformPayloadToCondition(item, catalog);
};

export const transformPayloadToRule = (
	rule: WorkflowRule,
	index: number,
	catalog: AttributesCatalog,
): RuleFormData => {
	const action = rule.actions[0];
	const decision = extractDecisionFromAction(action);
	const conditionsToTransform = rule.conditions?.conditions ?? [];

	const transformedConditions =
		conditionsToTransform.length > 0
			? conditionsToTransform.map((item) =>
					transformConditionItem(item, catalog),
				)
			: [createEmptyCondition()];

	return {
		id: generateId(),
		name: rule.name || `Rule ${index + 1}`,
		conditions: transformedConditions,
		decision,
	};
};

export const transformPayloadToRules = (
	rules: WorkflowRule[],
	catalog: AttributesCatalog = {},
): RuleFormData[] => {
	return rules.map((rule, index) =>
		transformPayloadToRule(rule, index, catalog),
	);
};

export const generateNextRuleName = (existingRules: RuleFormData[]): string => {
	const ruleNumbers = existingRules
		.map((rule) => {
			const match = rule.name.match(/^Rule (\d+)$/);
			return match ? parseInt(match[1], 10) : 0;
		})
		.filter((num) => num > 0);

	const maxNumber = ruleNumbers.length > 0 ? Math.max(...ruleNumbers) : 0;
	return `Rule ${maxNumber + 1}`;
};

export const canCreateOrGroup = (
	item: RuleConditionItem,
	conditions: RuleConditionItem[],
): boolean => {
	if (isConditionGroup(item)) return false;
	if (conditions.length < 1) return false;
	return true;
};

export const hasValidCondition = (condition: ConditionFormData): boolean => {
	return (
		condition.context !== "" &&
		condition.attribute !== "" &&
		condition.operator !== ""
	);
};

export const hasValidRule = (rule: RuleFormData): boolean => {
	if (!rule.decision) return false;
	if (rule.conditions.length === 0) return false;

	return rule.conditions.some((item) => {
		if (isConditionGroup(item)) {
			return item.conditions.some(hasValidCondition);
		}
		return hasValidCondition(item);
	});
};

const isValueEmpty = (value: ConditionValue): boolean => {
	if (value === null || value === undefined) return true;
	if (typeof value === "string" && value.trim() === "") return true;
	if (Array.isArray(value) && value.length === 0) return true;
	return false;
};

const validateRangeValue = (value: ConditionValue): boolean => {
	if (!Array.isArray(value)) return false;
	if (value.length !== 2) return false;
	const [min, max] = value;
	if (min === null || min === undefined || min === "") return false;
	if (max === null || max === undefined || max === "") return false;
	return true;
};

const validateMultiValue = (value: ConditionValue): boolean => {
	if (!Array.isArray(value)) return false;
	return value.length > 0;
};

export const getConditionErrors = (condition: ConditionFormData): string[] => {
	const errors: string[] = [];

	if (!condition.context) {
		errors.push("Context is required");
	}

	if (!condition.attribute) {
		errors.push("Attribute is required");
	}

	if (!condition.operator) {
		errors.push("Operator is required");
	}

	if (condition.operator) {
		if (isRangeOperator(condition.operator)) {
			if (!validateRangeValue(condition.value)) {
				errors.push("Both range values are required");
			}
		} else if (isMultiValueOperator(condition.operator)) {
			if (!validateMultiValue(condition.value)) {
				errors.push("At least one value is required");
			}
		} else if (
			!isNullOperator(condition.operator) &&
			!isArrayEmptyOperator(condition.operator) &&
			isValueEmpty(condition.value)
		) {
			errors.push("Value is required");
		}
	}

	return errors;
};

export const getRuleErrors = (rule: RuleFormData): string[] => {
	const errors: string[] = [];

	if (!rule.decision) {
		errors.push("Decision is required");
	}

	if (rule.conditions.length === 0) {
		errors.push("At least one condition is required");
		return errors;
	}

	let conditionIndex = 0;
	for (const item of rule.conditions) {
		if (isConditionGroup(item)) {
			let groupConditionIndex = 0;
			for (const groupCondition of item.conditions) {
				const conditionErrors = getConditionErrors(groupCondition);
				if (conditionErrors.length > 0) {
					const label = `Condition ${conditionIndex + 1}.${
						groupConditionIndex + 1
					}`;
					errors.push(`${label}: ${conditionErrors.join(", ")}`);
				}
				groupConditionIndex++;
			}
		} else {
			const conditionErrors = getConditionErrors(item);
			if (conditionErrors.length > 0) {
				const label = `Condition ${conditionIndex + 1}`;
				errors.push(`${label}: ${conditionErrors.join(", ")}`);
			}
		}
		conditionIndex++;
	}

	return errors;
};

export const validateRules = (rules: RuleFormData[]): RuleValidationError[] => {
	const validationErrors: RuleValidationError[] = [];

	if (rules.length === 0) {
		validationErrors.push({
			ruleIndex: -1,
			ruleName: "General",
			errors: ["At least one rule is required"],
		});
		return validationErrors;
	}

	rules.forEach((rule, index) => {
		const errors = getRuleErrors(rule);
		if (errors.length > 0) {
			validationErrors.push({
				ruleIndex: index,
				ruleName: rule.name,
				errors,
			});
		}
	});

	return validationErrors;
};

export const hasRuleErrors = (rule: RuleFormData): boolean => {
	return getRuleErrors(rule).length > 0;
};
