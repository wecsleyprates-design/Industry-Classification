import React from "react";
import type {
	AttributeDataType,
	ConditionOperator,
	ConditionValue,
} from "@/types/workflows";
import {
	BooleanInput,
	DateInput,
	MultiValueInput,
	NumberInput,
	RangeInput,
	StringInput,
} from "./inputs";
import {
	isArrayEmptyOperator,
	isArrayMultiValueOperator,
	isArrayNumberOperator,
	isArrayStringOperator,
	isMultiValueOperator,
	isNullOperator,
	isRangeOperator,
} from "./types";

interface ValueInputProps {
	operator: ConditionOperator | "";
	value: ConditionValue;
	onChange: (value: ConditionValue) => void;
	placeholder?: string;
	disabled?: boolean;
	className?: string;
	validationRegex?: string | null;
	dataType?: AttributeDataType | null;
	hasError?: boolean;
}

export const ValueInput: React.FC<ValueInputProps> = ({
	operator,
	value,
	onChange,
	placeholder = "Enter value",
	disabled = false,
	className,
	validationRegex,
	dataType,
	hasError = false,
}) => {
	if (isNullOperator(operator) || isArrayEmptyOperator(operator)) {
		return (
			<StringInput
				value={null}
				onChange={() => {}}
				placeholder={isArrayEmptyOperator(operator) ? "EMPTY" : "NULL"}
				disabled={true}
				ignoreValidation={true}
			/>
		);
	}

	if (isArrayNumberOperator(operator)) {
		return (
			<NumberInput
				value={value}
				onChange={onChange}
				placeholder={placeholder}
				disabled={disabled}
				className={className}
				validationRegex={validationRegex}
				hasError={hasError}
			/>
		);
	}

	if (isArrayMultiValueOperator(operator)) {
		return (
			<MultiValueInput
				value={value}
				onChange={onChange}
				placeholder={placeholder}
				disabled={disabled}
				className={className}
				validationRegex={validationRegex}
				dataType={dataType}
				hasError={hasError}
			/>
		);
	}

	if (isArrayStringOperator(operator)) {
		return (
			<StringInput
				value={value}
				onChange={onChange}
				placeholder={placeholder}
				disabled={disabled}
				className={className}
				validationRegex={validationRegex}
				hasError={hasError}
			/>
		);
	}

	if (dataType === "boolean") {
		return (
			<BooleanInput
				value={value}
				onChange={onChange}
				disabled={disabled}
				className={className}
				hasError={hasError}
			/>
		);
	}

	if (isRangeOperator(operator)) {
		return (
			<RangeInput
				value={value}
				onChange={onChange}
				disabled={disabled}
				className={className}
				validationRegex={validationRegex}
				dataType={dataType}
				hasError={hasError}
			/>
		);
	}

	if (isMultiValueOperator(operator)) {
		return (
			<MultiValueInput
				value={value}
				onChange={onChange}
				placeholder={placeholder}
				disabled={disabled}
				className={className}
				validationRegex={validationRegex}
				dataType={dataType}
				hasError={hasError}
			/>
		);
	}

	if (dataType === "date") {
		return (
			<DateInput
				value={value}
				onChange={onChange}
				disabled={disabled}
				className={className}
				hasError={hasError}
			/>
		);
	}

	if (dataType === "number") {
		return (
			<NumberInput
				value={value}
				onChange={onChange}
				placeholder={placeholder}
				disabled={disabled}
				className={className}
				validationRegex={validationRegex}
				hasError={hasError}
			/>
		);
	}

	return (
		<StringInput
			value={value}
			onChange={onChange}
			placeholder={placeholder}
			disabled={disabled}
			className={className}
			validationRegex={validationRegex}
			hasError={hasError}
		/>
	);
};
