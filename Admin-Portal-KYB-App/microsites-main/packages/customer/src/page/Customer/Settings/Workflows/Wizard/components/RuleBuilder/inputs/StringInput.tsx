import React, { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { ConditionValue } from "@/types/workflows";
import {
	baseInputStyles,
	errorInputStyles,
	getDisplayValue,
	validateWithRegex,
} from "./shared";

interface StringInputProps {
	value: ConditionValue;
	onChange: (value: ConditionValue) => void;
	placeholder?: string;
	disabled?: boolean;
	className?: string;
	validationRegex?: string | null;
	hasError?: boolean;
	ignoreValidation?: boolean;
}

export const StringInput: React.FC<StringInputProps> = ({
	value,
	onChange,
	placeholder,
	disabled,
	className,
	validationRegex,
	hasError = false,
	ignoreValidation = false,
}) => {
	const [localValue, setLocalValue] = useState(() => getDisplayValue(value));
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setLocalValue(getDisplayValue(value));
	}, [value]);

	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			setLocalValue(e.target.value);
			if (error) setError(null);
		},
		[error],
	);

	const handleBlur = useCallback(() => {
		if (localValue === "") {
			onChange(null);
			setError(null);
			return;
		}

		if (!validateWithRegex(localValue, validationRegex)) {
			setError("Invalid format");
			return;
		}

		onChange(localValue);
		setError(null);
	}, [localValue, onChange, validationRegex]);

	const hasValidationError = ignoreValidation ? false : error !== null;
	const showRequiredError = ignoreValidation
		? false
		: hasError && (value === null || value === undefined || value === "");
	const showError = ignoreValidation
		? false
		: hasValidationError || showRequiredError;

	return (
		<div className="flex flex-col">
			<input
				type="text"
				value={localValue}
				onChange={handleChange}
				onBlur={handleBlur}
				placeholder={placeholder}
				disabled={disabled}
				className={cn(
					baseInputStyles,
					showError && errorInputStyles,
					showRequiredError && "bg-red-50",
					className,
				)}
			/>
			{hasValidationError && (
				<span className="text-xs text-red-500 mt-1">{error}</span>
			)}
		</div>
	);
};
