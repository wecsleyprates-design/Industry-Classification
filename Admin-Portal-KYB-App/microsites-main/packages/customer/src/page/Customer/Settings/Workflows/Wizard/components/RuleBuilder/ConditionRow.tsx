import React, { useCallback, useMemo } from "react";
import { TrashIcon } from "@heroicons/react/24/outline";
import { ExclamationCircleIcon } from "@heroicons/react/24/solid";
import SelectComponent from "@/components/Dropdown/SelectComponent";
import { useWorkflowPermissions } from "@/hooks/useWorkflowPermissions";
import { cn } from "@/lib/utils";
import type {
	ConditionFormData,
	ConditionOperator,
	ConditionValue,
} from "@/types/workflows";
import { OPERATOR_LABELS } from "./constants";
import { useRuleBuilderContext } from "./RuleBuilderContext";
import { isPartialMatchOperator } from "./types";
import { transformValueForOperator } from "./utils";
import { ValueInput } from "./ValueInput";

interface ConditionRowProps {
	condition: ConditionFormData;
	onChange: (updates: Partial<ConditionFormData>) => void;
	onDelete: () => void;
	onCreateGroup?: () => void;
	showGroupButton?: boolean;
	canDelete?: boolean;
	isInsideGroup?: boolean;
	showErrors?: boolean;
}

type SelectOption<T> = { value: T; label: string };

const getSelectStyles = (hasError: boolean) => ({
	control: (provided: any, state: any) => ({
		...provided,
		height: 36,
		minHeight: 36,
		fontSize: "0.875rem",
		fontWeight: 400,
		borderRadius: "6px",
		borderColor: hasError ? "#fca5a5" : state.isFocused ? "#2563eb" : "#e5e7eb",
		backgroundColor: hasError ? "#fef2f2" : provided.backgroundColor,
		boxShadow: hasError
			? "0 0 0 1px #fca5a5"
			: state.isFocused
				? "0 0 0 2px rgba(37, 99, 235, 0.2)"
				: "none",
		"&:hover": {
			borderColor: hasError ? "#f87171" : "#9ca3af",
		},
	}),
	menu: (provided: any) => ({
		...provided,
		zIndex: 50,
	}),
	menuList: (provided: any) => ({
		...provided,
		overflowX: "hidden",
	}),
	option: (provided: any) => ({
		...provided,
		fontSize: "0.875rem",
		whiteSpace: "normal",
		wordBreak: "break-word",
		overflowWrap: "break-word",
	}),
});

export const ConditionRow: React.FC<ConditionRowProps> = ({
	condition,
	onChange,
	onDelete,
	onCreateGroup,
	showGroupButton = true,
	canDelete = true,
	isInsideGroup = false,
	showErrors = false,
}) => {
	const { canWrite } = useWorkflowPermissions();
	const isReadOnly = !canWrite;
	const { contexts, getAttributesForContext, getOperatorsForAttribute } =
		useRuleBuilderContext();

	const contextError = showErrors && !condition.context;
	const attributeError = showErrors && !condition.attribute;
	const operatorError = showErrors && !condition.operator;
	const valueError =
		showErrors && !!condition.operator && condition.value === null;

	const contextSelectStyles = useMemo(
		() => getSelectStyles(contextError),
		[contextError],
	);
	const attributeSelectStyles = useMemo(
		() => getSelectStyles(attributeError),
		[attributeError],
	);
	const operatorSelectStyles = useMemo(
		() => getSelectStyles(operatorError),
		[operatorError],
	);

	const contextOptions = useMemo<Array<SelectOption<string>>>(
		() =>
			contexts.map((ctx) => ({
				value: ctx,
				label: ctx.replace(/_/g, " ").toUpperCase(),
			})),
		[contexts],
	);

	const attributeOptions = useMemo<Array<SelectOption<string>>>(() => {
		if (!condition.context) return [];
		const attributes = getAttributesForContext(condition.context);
		return attributes.map((attr) => ({
			value: attr.attribute.name,
			label: attr.attribute.label,
		}));
	}, [condition.context, getAttributesForContext]);

	const operatorOptions = useMemo<
		Array<SelectOption<ConditionOperator>>
	>(() => {
		if (!condition.context || !condition.attribute) return [];
		const operators = getOperatorsForAttribute(
			condition.context,
			condition.attribute,
		);
		return operators.map((op) => ({
			value: op,
			label: OPERATOR_LABELS[op] ?? op,
		}));
	}, [condition.context, condition.attribute, getOperatorsForAttribute]);

	const selectedContext = useMemo(
		() => contextOptions.find((opt) => opt.value === condition.context) ?? null,
		[contextOptions, condition.context],
	);

	const selectedAttribute = useMemo(
		() =>
			attributeOptions.find((opt) => opt.value === condition.attribute) ?? null,
		[attributeOptions, condition.attribute],
	);

	const selectedOperator = useMemo(
		() =>
			operatorOptions.find((opt) => opt.value === condition.operator) ?? null,
		[operatorOptions, condition.operator],
	);

	const handleContextChange = useCallback(
		(option: SelectOption<string> | null) => {
			const attributes = option ? getAttributesForContext(option.value) : [];
			const firstAttr = attributes[0];

			onChange({
				context: option?.value ?? "",
				source: firstAttr?.source ?? "",
				attribute: "",
				operator: "",
				value: null,
				validationRegex: null,
				dataType: null,
			});
		},
		[onChange, getAttributesForContext],
	);

	const handleAttributeChange = useCallback(
		(option: SelectOption<string> | null) => {
			if (!condition.context || !option) {
				onChange({
					attribute: "",
					attributeLabel: "",
					operator: "",
					value: null,
					dataType: null,
				});
				return;
			}

			const attributes = getAttributesForContext(condition.context);
			const selectedAttr = attributes.find(
				(attr) => attr.attribute.name === option.value,
			);

			onChange({
				attribute: option.value,
				attributeLabel: selectedAttr?.attribute.label ?? option.label,
				source: selectedAttr?.source ?? condition.source,
				operator: "",
				value: null,
				validationRegex: selectedAttr?.validation_regex ?? null,
				dataType: selectedAttr?.data_type ?? null,
			});
		},
		[condition.context, condition.source, onChange, getAttributesForContext],
	);

	const handleOperatorChange = useCallback(
		(option: SelectOption<ConditionOperator> | null) => {
			const newOperator = option?.value ?? "";
			const transformedValue = transformValueForOperator(
				condition.value,
				condition.operator,
				newOperator,
			);
			onChange({
				operator: newOperator,
				value: transformedValue,
			});
		},
		[onChange, condition.value, condition.operator],
	);

	const handleValueChange = useCallback(
		(value: ConditionValue) => {
			onChange({ value });
		},
		[onChange],
	);

	const canShowOrButton = showGroupButton && !isInsideGroup && onCreateGroup;

	return (
		<div
			className={cn(
				"relative flex flex-col xl:flex-row xl:items-start gap-3 py-2",
				isInsideGroup && "pl-0 xl:pl-4",
			)}
		>
			<div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-[180px_180px_150px_minmax(100px,1fr)] gap-3 flex-1">
				<div>
					<label
						className={cn(
							"block text-xs font-medium mb-1",
							contextError ? "text-red-500" : "text-gray-500",
							isInsideGroup ? "xl:hidden" : "",
						)}
					>
						Context
					</label>
					<SelectComponent
						value={selectedContext ?? { value: "", label: "" }}
						defaultValue={{ value: "", label: "" }}
						options={contextOptions}
						onChange={handleContextChange}
						customStyles={contextSelectStyles}
						isSearchable={true}
						isDisabled={isReadOnly}
					/>
					{contextError && (
						<div className="flex items-center gap-1 mt-1">
							<ExclamationCircleIcon className="h-3.5 w-3.5 text-red-500" />
							<span className="text-xs text-red-500">Required</span>
						</div>
					)}
				</div>

				<div>
					<label
						className={cn(
							"block text-xs font-medium mb-1",
							attributeError ? "text-red-500" : "text-gray-500",
							isInsideGroup ? "xl:hidden" : "",
						)}
					>
						Attribute
					</label>
					<SelectComponent
						value={selectedAttribute ?? { value: "", label: "" }}
						defaultValue={{ value: "", label: "" }}
						options={attributeOptions}
						onChange={handleAttributeChange}
						customStyles={attributeSelectStyles}
						isSearchable={true}
						isDisabled={isReadOnly}
					/>
					{attributeError && (
						<div className="flex items-center gap-1 mt-1">
							<ExclamationCircleIcon className="h-3.5 w-3.5 text-red-500" />
							<span className="text-xs text-red-500">Required</span>
						</div>
					)}
				</div>

				<div>
					<label
						className={cn(
							"block text-xs font-medium mb-1",
							operatorError ? "text-red-500" : "text-gray-500",
							isInsideGroup ? "xl:hidden" : "",
						)}
					>
						Operator
					</label>
					<SelectComponent
						value={selectedOperator ?? { value: "", label: "" }}
						defaultValue={{ value: "", label: "" }}
						options={operatorOptions}
						onChange={handleOperatorChange}
						customStyles={operatorSelectStyles}
						isDisabled={isReadOnly}
					/>
					{operatorError && (
						<div className="flex items-center gap-1 mt-1">
							<ExclamationCircleIcon className="h-3.5 w-3.5 text-red-500" />
							<span className="text-xs text-red-500">Required</span>
						</div>
					)}
				</div>

				<div>
					<label
						className={cn(
							"block text-xs font-medium mb-1",
							valueError ? "text-red-500" : "text-gray-500",
							isInsideGroup ? "xl:hidden" : "",
						)}
					>
						Value
					</label>
					<ValueInput
						operator={condition.operator}
						value={condition.value}
						onChange={handleValueChange}
						placeholder="Enter value"
						disabled={!condition.operator || isReadOnly}
						className="min-h-9"
						validationRegex={
							isPartialMatchOperator(condition.operator)
								? null
								: condition.validationRegex
						}
						dataType={condition.dataType}
						hasError={valueError}
					/>
					{valueError && (
						<div className="flex items-center gap-1 mt-1">
							<ExclamationCircleIcon className="h-3.5 w-3.5 text-red-500" />
							<span className="text-xs text-red-500">Required</span>
						</div>
					)}
				</div>
			</div>

			{!isReadOnly && (
				<div
					className={cn(
						"flex items-center gap-2 xl:self-start",
						!isInsideGroup && "xl:pt-5",
					)}
				>
					{canShowOrButton && (
						<button
							type="button"
							onClick={onCreateGroup}
							className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors xl:px-2 xl:py-1"
							title="Create OR group"
						>
							+OR
						</button>
					)}
					{canDelete && (
						<button
							type="button"
							onClick={onDelete}
							className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 rounded hover:text-red-500 hover:bg-red-50 hover:border-red-200 transition-colors xl:p-1.5 xl:bg-transparent xl:border-0"
							title="Delete condition"
						>
							<TrashIcon className="h-4 w-4" />
							<span className="xl:hidden">Delete</span>
						</button>
					)}
				</div>
			)}
		</div>
	);
};
